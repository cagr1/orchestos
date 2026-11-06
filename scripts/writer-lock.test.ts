import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LOCK_NAME } from './writer-lock.mjs'

const hook = path.resolve(import.meta.dirname, 'writer-lock.mjs')
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-lock-'))
  spawnSync('git', ['init', dir], { stdio: 'ignore' })
  return dir
}
function runHook(
  dir: string,
  session: string,
  tool: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv = {},
  executable = hook,
) {
  const input = {
    hook_event_name: 'PreToolUse',
    session_id: session,
    cwd: dir,
    tool_name: tool,
    tool_input: args,
  }
  return spawnSync('node', [executable], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: cleanEnv(env),
  })
}
function lock(dir: string) {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
          encoding: 'utf8',
        }).stdout.trim(),
        LOCK_NAME,
      ),
      'utf8',
    ),
  )
}
function setLock(dir: string, value: unknown) {
  fs.writeFileSync(
    path.join(
      spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
        encoding: 'utf8',
      }).stdout.trim(),
      LOCK_NAME,
    ),
    JSON.stringify(value),
  )
}
function cli(...args: Array<string | NodeJS.ProcessEnv>) {
  const env =
    args.at(-1) && typeof args.at(-1) === 'object' ? (args.pop() as NodeJS.ProcessEnv) : {}
  return spawnSync('node', [hook, ...(args as string[])], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  })
}
const cleanEnv = (extra: NodeJS.ProcessEnv = {}) => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ...extra,
})

test('Edit toma árbol libre', () => {
  const dir = repo()
  const result = runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(lock(dir).session, 'A')
})
test('Edit de otra sesión deniega', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const result = runHook(dir, 'B', 'Edit', { file_path: path.join(dir, 'b') })
  assert.match(result.stdout, /"permissionDecision":"deny"/)
  assert.match(result.stdout, /Un árbol, un escritor/)
  const reason = JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason
  const realRoot = fs.realpathSync(dir)
  assert.equal(reason.split(realRoot).length - 1, 2)
})
test('hook invocado por symlink también deniega', () => {
  const dir = repo()
  const link = path.join(os.tmpdir(), `writer-lock-link-${process.pid}-${Date.now()}.js`)
  try {
    fs.symlinkSync(hook, link)
    runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
    const result = runHook(dir, 'B', 'Edit', { file_path: path.join(dir, 'b') }, {}, link)
    assert.match(result.stdout, /"permissionDecision":"deny"/)
  } finally {
    try {
      fs.unlinkSync(link)
    } catch {}
  }
})
test('Bash read-only no altera el candado', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  for (const command of ['git status', 'bun test']) {
    const result = runHook(dir, 'B', 'Bash', { command })
    assert.equal(result.stdout, '')
  }
  assert.equal(lock(dir).session, 'A')
})
test('git commit deniega y git -C usa el repo indicado', () => {
  const a = repo()
  const b = repo()
  runHook(a, 'A', 'Edit', { file_path: path.join(a, 'a') })
  assert.match(
    runHook(a, 'B', 'Bash', { command: 'git commit -m x' }).stdout,
    /"permissionDecision":"deny"/,
  )
  assert.equal(runHook(a, 'B', 'Bash', { command: `git -C ${b} commit -m x` }).stdout, '')
  assert.equal(lock(b).session, 'B')
})
test('solo reconoce git y delegate en posición de comando', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  for (const command of [
    'cat method/bin/delegate',
    'bash -n method/bin/delegate',
    'grep -n "git commit" README.md',
    'echo "delegate mecanico x"',
  ]) {
    assert.equal(runHook(dir, 'B', 'Bash', { command }).stdout, '')
  }
  assert.equal(lock(dir).session, 'A')
  for (const command of [
    'FOO=1 git commit -m x',
    'git status && git add .',
    '~/.agent-method/bin/delegate mecanico spec.md',
  ]) {
    assert.match(runHook(dir, 'B', 'Bash', { command }).stdout, /"permissionDecision":"deny"/)
  }
})
test('cd seguido de git add usa el otro repo', () => {
  const a = repo()
  const b = repo()
  runHook(a, 'A', 'Edit', { file_path: path.join(a, 'a') })
  assert.equal(runHook(a, 'B', 'Bash', { command: `cd ${b} && git add .` }).stdout, '')
  assert.equal(lock(b).session, 'B')
})
test('candado vencido se reemplaza', () => {
  const dir = repo()
  setLock(dir, {
    session: 'A',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    touchedAt: new Date(Date.now() - 3600000).toISOString(),
  })
  runHook(dir, 'B', 'Edit', { file_path: path.join(dir, 'x') })
  assert.equal(lock(dir).session, 'B')
  assert.ok(Date.now() - Date.parse(lock(dir).startedAt) < 5000)
})
test('candado JSON corrupto se reemplaza', () => {
  const dir = repo()
  const gitDir = spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  }).stdout.trim()
  fs.writeFileSync(path.join(gitDir, LOCK_NAME), 'xx')
  const result = runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(lock(dir).session, 'A')
})
test('TTL configurable conserva candado de 60 minutos', () => {
  const dir = repo()
  setLock(dir, {
    session: 'A',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    touchedAt: new Date(Date.now() - 3600000).toISOString(),
  })
  assert.match(
    runHook(dir, 'B', 'Edit', { file_path: path.join(dir, 'x') }, { AGENT_WRITER_TTL_MIN: '120' })
      .stdout,
    /"permissionDecision":"deny"/,
  )
})
test('token hijo refresca sin cambiar dueño', async () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const before = lock(dir).touchedAt
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(
    runHook(dir, 'C', 'Edit', { file_path: path.join(dir, 'x') }, { AGENT_WRITER_TOKEN: 'A' })
      .stdout,
    '',
  )
  assert.equal(lock(dir).session, 'A')
  assert.notEqual(lock(dir).touchedAt, before)
})
test('check con token coincide aunque .git no permita escritura', () => {
  const dir = repo()
  setLock(dir, {
    session: 'X',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date().toISOString(),
    touchedAt: new Date().toISOString(),
  })
  const gitDir = spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  }).stdout.trim()
  const mode = fs.statSync(gitDir).mode & 0o777
  try {
    fs.chmodSync(gitDir, 0o555)
    const result = cli('check', dir, { AGENT_WRITER_TOKEN: 'X' })
    assert.equal(result.status, 0)
  } finally {
    fs.chmodSync(gitDir, mode)
  }
})
test('SessionEnd solo libera sesión propietaria', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const filename = path.join(
    spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
      encoding: 'utf8',
    }).stdout.trim(),
    LOCK_NAME,
  )
  for (const session of ['B', 'A']) {
    spawnSync('node', [hook], {
      input: JSON.stringify({ hook_event_name: 'SessionEnd', session_id: session, cwd: dir }),
      encoding: 'utf8',
    })
    assert.equal(fs.existsSync(filename), session !== 'A')
  }
})
test('fallos de entrada y directorio ajeno fallan abiertos', () => {
  const noRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'no-repo-'))
  for (const input of ['', 'bad json']) {
    const result = spawnSync('node', [hook], { input, encoding: 'utf8' })
    assert.equal(result.status, 0)
    assert.equal(result.stdout, '')
  }
  const result = runHook(noRepo, 'A', 'Edit', { file_path: path.join(noRepo, 'x') })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})
test('delegate bloquea salvo --dry-run', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  assert.match(
    runHook(dir, 'B', 'Bash', { command: 'delegate x spec' }).stdout,
    /"permissionDecision":"deny"/,
  )
  assert.equal(runHook(dir, 'B', 'Bash', { command: 'delegate x spec --dry-run' }).stdout, '')
})
test('CLI status claim release', () => {
  const dir = repo()
  assert.equal(cli('status', dir).stdout.trim(), 'libre')
  assert.equal(cli('claim', 'codex', dir).status, 0)
  assert.match(cli('status', dir).stdout, /^ocupado: codex/)
  assert.equal(cli('claim', 'otro', dir).status, 1)
  assert.equal(cli('release', dir).stdout.trim(), 'liberado')
})
test('status con token coincidente identifica al ejecutor delegado', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const result = cli('status', dir, { AGENT_WRITER_TOKEN: 'A' })
  assert.equal(result.status, 0)
  assert.equal(
    result.stdout,
    'ocupado: claude A desde hace 0 min (último cambio hace 0 min) — tu AGENT_WRITER_TOKEN coincide: eres el ejecutor delegado, puedes escribir\n',
  )
})
test('status con token distinto informa que no coincide', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const result = cli('status', dir, { AGENT_WRITER_TOKEN: 'B' })
  assert.equal(result.status, 0)
  assert.equal(
    result.stdout,
    'ocupado: claude A desde hace 0 min (último cambio hace 0 min) — tu AGENT_WRITER_TOKEN no coincide\n',
  )
})
test('status sin token conserva el mensaje del candado vivo', () => {
  const dir = repo()
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  const result = cli('status', dir)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, 'ocupado: claude A desde hace 0 min (último cambio hace 0 min)\n')
})
test('worktree tiene candado independiente', () => {
  const dir = repo()
  const wt = `${dir}-wt`
  const seed = path.join(dir, 'seed')
  fs.writeFileSync(seed, 'x')
  spawnSync('git', ['-C', dir, 'add', 'seed'])
  spawnSync(
    'git',
    ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'seed'],
    { stdio: 'ignore' },
  )
  spawnSync('git', ['-C', dir, 'worktree', 'add', '-b', 'test-wt', wt], { stdio: 'ignore' })
  runHook(dir, 'A', 'Edit', { file_path: path.join(dir, 'a') })
  assert.equal(runHook(wt, 'B', 'Edit', { file_path: path.join(wt, 'b') }).stdout, '')
  assert.equal(lock(wt).session, 'B')
})

test('check en árbol libre no crea candado', () => {
  const dir = repo()
  const result = cli('check', dir)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
  const gitDir = spawnSync('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  }).stdout.trim()
  assert.equal(fs.existsSync(path.join(gitDir, LOCK_NAME)), false)
})
test('check dueño de sesión refresca touchedAt', async () => {
  const dir = repo()
  setLock(dir, {
    session: 's1',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date().toISOString(),
    touchedAt: new Date().toISOString(),
  })
  const before = lock(dir).touchedAt
  await new Promise((resolve) => setTimeout(resolve, 15))
  const result = cli('check', dir, cleanEnv({ CLAUDE_CODE_SESSION_ID: 's1' }))
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
  assert.notEqual(lock(dir).touchedAt, before)
})
test('check otra sesión deniega en stderr', () => {
  const dir = repo()
  setLock(dir, {
    session: 's1',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date().toISOString(),
    touchedAt: new Date().toISOString(),
  })
  const result = cli('check', dir, cleanEnv({ CLAUDE_CODE_SESSION_ID: 's2' }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Un árbol, un escritor/)
})
test('check sin identidad deniega candado de sesión', () => {
  const dir = repo()
  setLock(dir, {
    session: 's1',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date().toISOString(),
    touchedAt: new Date().toISOString(),
  })
  assert.equal(cli('check', dir, cleanEnv()).status, 1)
})
test('check sin identidad permite claim codex', () => {
  const dir = repo()
  assert.equal(cli('claim', 'codex', dir, cleanEnv()).status, 0)
  const result = cli('check', dir, cleanEnv())
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
})
test('check con identidad distinta deniega claim codex', () => {
  const dir = repo()
  assert.equal(cli('claim', 'codex', dir, cleanEnv()).status, 0)
  assert.equal(cli('check', dir, cleanEnv({ CLAUDE_CODE_SESSION_ID: 's2' })).status, 1)
})
test('check acepta token del dueño', () => {
  const dir = repo()
  setLock(dir, {
    session: 's1',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date().toISOString(),
    touchedAt: new Date().toISOString(),
  })
  assert.equal(cli('check', dir, cleanEnv({ AGENT_WRITER_TOKEN: 's1' })).status, 0)
})
test('check permite candado vencido', () => {
  const dir = repo()
  setLock(dir, {
    session: 's1',
    agent: 'claude',
    cwd: dir,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    touchedAt: new Date(Date.now() - 3600000).toISOString(),
  })
  const result = cli('check', dir, cleanEnv({ CLAUDE_CODE_SESSION_ID: 's2' }))
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
})
