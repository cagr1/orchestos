#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LOCK_NAME = 'agent-writer.lock'

export function gitDirFor(dir) {
  const result = spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : null
}

export function readLock(gitDir) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(gitDir, LOCK_NAME), 'utf8'))
    if (!value || typeof value.session !== 'string' || typeof value.touchedAt !== 'string')
      return null
    return value
  } catch {
    return null
  }
}

export function ageMinutes(iso, now = Date.now()) {
  const timestamp = Date.parse(iso)
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 60000)) : Infinity
}

export function isExpired(
  lock,
  now = Date.now(),
  ttl = Number(process.env.AGENT_WRITER_TTL_MIN || 45),
) {
  return !lock || ageMinutes(lock.touchedAt, now) >= ttl
}

export function atomicWrite(gitDir, lock, initial = false) {
  const filename = path.join(gitDir, LOCK_NAME)
  if (initial) {
    const fd = fs.openSync(filename, 'wx')
    try {
      fs.writeFileSync(fd, `${JSON.stringify(lock, null, 2)}\n`)
    } finally {
      fs.closeSync(fd)
    }
    return
  }
  const temp = path.join(
    gitDir,
    `.${LOCK_NAME}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`,
  )
  fs.writeFileSync(temp, `${JSON.stringify(lock, null, 2)}\n`, { flag: 'wx' })
  try {
    fs.renameSync(temp, filename)
  } catch (error) {
    try {
      fs.unlinkSync(temp)
    } catch {}
    throw error
  }
}

export function firstExistingAncestor(target) {
  let current = path.resolve(target)
  try {
    if (!fs.statSync(current).isDirectory()) current = path.dirname(current)
  } catch {
    current = path.dirname(current)
  }
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return process.cwd()
    current = parent
  }
  return current
}

export function gitWrite(command) {
  return commandEntries(command).some((entry) =>
    /^git\s+(?:-C\s+\S+\s+)?(?:add|commit|merge|rebase|reset|checkout|switch|restore|stash|cherry-pick|revert|rm|mv|apply|am|push|pull)(?:\s|$)/.test(
      entry,
    ),
  )
}

export function delegateWrite(command) {
  return commandEntries(command).some(
    (entry) => /^(?:\S*\/)?delegate\b/.test(entry) && !/--dry-run\b/.test(entry),
  )
}

function commandEntries(command) {
  const entries = []
  const start = /(?:^|[;&|()]\s*)(?:(?:[A-Za-z_][A-Za-z0-9_]*=[^\s;&|()]*\s+)*)([^;&|()]+)/g
  for (const match of command.matchAll(start)) entries.push(match[1].trim())
  return entries
}

export function targetDir(command, cwd) {
  const gitC = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)
  if (gitC) return gitC[1].replace(/^['"]|['"]$/g, '')
  const cd = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*(?:&&|;)/)
  if (cd) return path.resolve(cwd, cd[1].replace(/^['"]|['"]$/g, ''))
  return cwd
}

export function isWriteCall(input) {
  const name = input?.tool_name || input?.toolName || input?.name || ''
  const args = input?.tool_input || input?.toolInput || {}
  if (['Edit', 'Write', 'MultiEdit'].includes(name))
    return args.file_path ? { target: args.file_path } : null
  if (name === 'NotebookEdit') return args.notebook_path ? { target: args.notebook_path } : null
  if (
    name === 'Bash' &&
    typeof args.command === 'string' &&
    (gitWrite(args.command) || delegateWrite(args.command))
  ) {
    return { target: targetDir(args.command, input.cwd || process.cwd()) }
  }
  return null
}

export function outputFor(lock, root, now = Date.now()) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyMessage(lock, root, now),
    },
  }
}

function denyMessage(lock, root, now = Date.now()) {
  const age = ageMinutes(lock.startedAt, now)
  const touched = ageMinutes(lock.touchedAt, now)
  return `Un árbol, un escritor: otra sesión (${lock.agent}, ${lock.session.slice(0, 8)}) escribe en ${root} desde hace ${age} min; último cambio hace ${touched} min. Trabaja en solo lectura, en otro repo, o espera. Si esa sesión ya cerró: node ~/.agent-method/hooks/writer-lock.js release ${root}`
}

function writeLockFor(gitDir, session, agent, cwd, existing) {
  const now = new Date().toISOString()
  const lock = {
    session,
    agent,
    cwd,
    startedAt: existing?.session === session ? existing.startedAt : now,
    touchedAt: now,
  }
  atomicWrite(gitDir, lock, !fs.existsSync(path.join(gitDir, LOCK_NAME)))
  return lock
}

export async function handleHook(event, env = process.env) {
  try {
    if (event.hook_event_name === 'SessionEnd') {
      const gitDir = gitDirFor(event.cwd || process.cwd())
      if (!gitDir) return
      const lock = readLock(gitDir)
      if (lock?.session === event.session_id) fs.unlinkSync(path.join(gitDir, LOCK_NAME))
      return
    }
    if (event.hook_event_name !== 'PreToolUse') return
    const write = isWriteCall(event)
    if (!write) return
    const objective = path.isAbsolute(write.target)
      ? write.target
      : path.resolve(event.cwd || process.cwd(), write.target)
    const targetDirectory = firstExistingAncestor(objective)
    const gitDir = gitDirFor(targetDirectory)
    if (!gitDir) return
    const current = readLock(gitDir)
    const live = current && !isExpired(current)
    if (env.AGENT_WRITER_TOKEN && live && env.AGENT_WRITER_TOKEN === current.session) {
      writeLockFor(gitDir, current.session, current.agent, event.cwd || process.cwd(), current)
      return
    }
    if (env.AGENT_WRITER_TOKEN && !live) return
    if (!live || current.session === event.session_id) {
      writeLockFor(gitDir, event.session_id, 'claude', event.cwd || process.cwd(), current)
      return
    }
    const root = spawnSync('git', ['-C', targetDirectory, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).stdout.trim()
    process.stdout.write(`${JSON.stringify(outputFor(current, root))}\n`)
  } catch {
    /* fail open */
  }
}

function cliStatus(dir, env = process.env) {
  const gitDir = gitDirFor(dir)
  if (!gitDir) return { code: 2, line: 'no es un repo git' }
  const lock = readLock(gitDir)
  if (!lock || isExpired(lock)) return { code: 0, line: 'libre' }
  const now = Date.now()
  const tokenStatus = env.AGENT_WRITER_TOKEN
    ? env.AGENT_WRITER_TOKEN === lock.session
      ? ' — tu AGENT_WRITER_TOKEN coincide: eres el ejecutor delegado, puedes escribir'
      : ' — tu AGENT_WRITER_TOKEN no coincide'
    : ''
  return {
    code: 0,
    line: `ocupado: ${lock.agent} ${lock.session.slice(0, 8)} desde hace ${ageMinutes(lock.startedAt, now)} min (último cambio hace ${ageMinutes(lock.touchedAt, now)} min)${tokenStatus}`,
  }
}

export function main(argv = process.argv.slice(2)) {
  const [action, ...rest] = argv
  const dir = rest[action === 'claim' ? 1 : 0] || process.cwd()
  const gitDir = gitDirFor(dir)
  if (!gitDir) {
    process.stdout.write('no es un repo git\n')
    return 2
  }
  if (action === 'status') {
    process.stdout.write(`${cliStatus(dir).line}\n`)
    return 0
  }
  if (action === 'check') {
    const lock = readLock(gitDir)
    if (!lock || isExpired(lock)) return 0
    const identity =
      process.env.AGENT_WRITER_TOKEN ||
      process.env.CLAUDE_CODE_SESSION_ID ||
      process.env.AGENT_WRITER_NAME ||
      ''
    if (identity && identity === lock.session) {
      try {
        writeLockFor(gitDir, lock.session, lock.agent, dir, lock)
      } catch {}
      return 0
    }
    if (!identity && lock.agent === lock.session) return 0
    const root = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).stdout.trim()
    process.stderr.write(`${denyMessage(lock, root)}\n`)
    return 1
  }
  if (action === 'release') {
    const filename = path.join(gitDir, LOCK_NAME)
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename)
      process.stdout.write('liberado\n')
    } else process.stdout.write('libre\n')
    return 0
  }
  if (action === 'claim') {
    const name = rest[0]
    if (!name) {
      process.stdout.write('uso: writer-lock.js claim <nombre> [dir]\n')
      return 2
    }
    const current = readLock(gitDir)
    if (current && !isExpired(current) && current.session !== name) {
      process.stdout.write(`${cliStatus(dir).line}\n`)
      return 1
    }
    writeLockFor(gitDir, name, name, dir, current)
    process.stdout.write('tomado\n')
    return 0
  }
  process.stdout.write(
    'uso: writer-lock.js status [dir] | check [dir] | release [dir] | claim <nombre> [dir]\n',
  )
  return 2
}

if (
  process.argv[1] &&
  fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])
) {
  if (process.argv.length === 2) {
    let raw = ''
    for await (const chunk of process.stdin) raw += chunk
    try {
      await handleHook(JSON.parse(raw))
    } catch {
      /* fail open */
    }
    process.exit(0)
  }
  process.exit(main())
}
