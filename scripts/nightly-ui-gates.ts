import { spawn } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export interface Attempt {
  ok: boolean
  error: string
  evidence: string[]
}
export interface NightlyResult {
  startedAt: string
  finishedAt: string
  sha: string
  total: number
  passed: number
  flaky: Array<{ flow: string; firstError: string; evidence: string[] }>
  failed: Array<{ flow: string; error: string; evidence: string[] }>
}

/** Only unavailable OpenCode is excluded: that flow requires the external binary. */
export function selectFlows(names: string[], hasOpenCode: boolean): string[] {
  return names.filter((name) => name !== 'opencode-terminal' || hasOpenCode).sort()
}

export function expiredDates(names: string[], now: Date): string[] {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - 6)
  const oldest = cutoff.toISOString().slice(0, 10)
  return names.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < oldest)
}

export async function runFlows(
  flows: string[],
  sha: string,
  runner: (flow: string, attempt: number) => Promise<Attempt>,
  clock: () => Date = () => new Date(),
): Promise<NightlyResult> {
  const result: NightlyResult = {
    startedAt: clock().toISOString(),
    finishedAt: '',
    sha,
    total: flows.length,
    passed: 0,
    flaky: [],
    failed: [],
  }
  const attempt = async (flow: string, n: number): Promise<Attempt> => {
    try {
      return await runner(flow, n)
    } catch (error) {
      return { ok: false, error: String(error), evidence: [] }
    }
  }
  for (const flow of flows) {
    const first = await attempt(flow, 1)
    if (first.ok) {
      result.passed++
      continue
    }
    const retry = await attempt(flow, 2)
    const evidence = [...first.evidence, ...retry.evidence]
    if (retry.ok) result.flaky.push({ flow, firstError: first.error, evidence })
    else result.failed.push({ flow, error: retry.error, evidence })
  }
  result.finishedAt = clock().toISOString()
  return result
}

function command(
  args: string[],
  cwd: string,
  log: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    appendFileSync(log, `$ ${args.join(' ')}\n`)
    const child = spawn(args[0] as string, args.slice(1), {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const collect = (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      appendFileSync(log, text)
      process.stdout.write(text)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => {
      collect(Buffer.from(`${error.message}\n`))
      done({ code: 1, output })
    })
    child.on('close', (code) => done({ code: code ?? 1, output }))
  })
}

// Preserve only gate evidence, never the gate's HOME (which can contain credentials).
export function preserveFailure(output: string, target: string): string[] {
  const source = [...output.matchAll(/^EVIDENCE (.+)$/gm)].at(-1)?.[1]?.trim()
  if (!source || !existsSync(source)) return []
  mkdirSync(target, { recursive: true })
  const copied = join(target, 'result.json')
  cpSync(source, copied)
  const evidence = [source, dirname(source), copied]
  const results: unknown = JSON.parse(readFileSync(source, 'utf8'))
  if (!Array.isArray(results)) return evidence
  const root = realpathSync(dirname(source))
  for (const [index, result] of results.entries()) {
    if (!Array.isArray(result?.capturas)) continue
    for (const [shot, path] of result.capturas.entries()) {
      if (typeof path !== 'string' || !existsSync(path)) continue
      const real = realpathSync(path)
      if (!real.startsWith(`${root}/`) || !real.endsWith('.png')) continue
      const destination = join(target, `${index}-${shot}-${basename(real)}`)
      cpSync(real, destination)
      evidence.push(destination)
    }
  }
  return evidence
}

async function main() {
  const repo = resolve(import.meta.dir, '..')
  const base = join(homedir(), '.orchestos/nightly')
  const date = new Date().toISOString().slice(0, 10)
  const archive = join(base, date)
  const worktree = join(base, 'worktree')
  mkdirSync(archive, { recursive: true })
  const log = join(archive, 'ui-gates.log')
  // Hooks may export git locations; every child must resolve its own checkout.
  const env: NodeJS.ProcessEnv = { ...process.env, ORCHESTOS_CLAUDE_USAGE_LIVE: '0' }
  for (const name of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_PREFIX',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'ORCHESTOS_HOME',
    'ORCHESTOS_GATE_EVIDENCE_HOME',
  ])
    delete env[name]
  const run = (args: string[], cwd = worktree, overrides = env) =>
    command(args, cwd, log, overrides)
  const requireSuccess = async (args: string[], cwd = worktree, overrides = env) => {
    const result = await run(args, cwd, overrides)
    if (result.code !== 0) throw new Error(`${args.join(' ')}: exit ${result.code}`)
    return result.output.trim()
  }
  const lock = join(base, 'running')
  try {
    mkdirSync(lock)
  } catch {
    throw new Error(`No se pudo preparar el worktree: corrida ya activa (${lock})`)
  }
  try {
    let sha: string
    let flows: string[]
    try {
      await requireSuccess(['git', 'fetch', 'origin', 'master'], repo)
      if (existsSync(worktree)) {
        const common = await requireSuccess([
          'git',
          'rev-parse',
          '--path-format=absolute',
          '--git-common-dir',
        ])
        const expected = await requireSuccess(
          ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
          repo,
        )
        if (realpathSync(common) !== realpathSync(expected))
          throw new Error('Worktree de otro repositorio')
        const root = await requireSuccess(['git', 'rev-parse', '--show-toplevel'])
        if (
          realpathSync(root) !== realpathSync(worktree) ||
          realpathSync(root) === realpathSync(repo)
        ) {
          throw new Error('El checkout nocturno no es un árbol separado')
        }
        if (await requireSuccess(['git', 'status', '--porcelain']))
          throw new Error('Worktree nocturno con cambios locales')
        await requireSuccess(['git', 'checkout', '--detach', 'origin/master'])
      } else {
        await requireSuccess(
          ['git', 'worktree', 'add', '--detach', worktree, 'origin/master'],
          repo,
        )
      }
      sha = await requireSuccess(['git', 'rev-parse', 'HEAD'])
      await requireSuccess(['bun', 'install', '--frozen-lockfile'])
      // The migration is isolated too: never migrate Carlos's durable database.
      await requireSuccess(['bun', 'run', 'db:migrate'], worktree, {
        ...env,
        ORCHESTOS_HOME: join(base, 'migration-home'),
      })
      const available = readdirSync(join(worktree, 'scripts/ui-gate/flows'))
        .filter((name) => name.endsWith('.mjs'))
        .map((name) => name.slice(0, -4))
      const args = process.argv.slice(2).filter((arg) => arg !== '--')
      if (args.length && (args.length !== 2 || args[0] !== '--flows'))
        throw new Error('Uso: --flows smoke,plan-doc')
      const requested = args[1]?.split(',') ?? available
      if (requested.some((name) => !available.includes(name))) throw new Error('Flujo desconocido')
      flows = selectFlows([...new Set(requested)], Boolean(Bun.which('opencode')))
    } catch (error) {
      appendFileSync(log, `Preparación fallida: ${String(error)}\n`)
      process.exitCode = 1
      return
    }
    const result = await runFlows(flows, sha, async (flow, attempt) => {
      const { code, output } = await run(['bun', 'run', 'ui:gate', flow])
      const evidence =
        code === 0 ? [] : preserveFailure(output, join(archive, flow, `attempt-${attempt}`))
      return { ok: code === 0, error: code === 0 ? '' : output.trim(), evidence }
    })
    const json = `${JSON.stringify(result, null, 2)}\n`
    writeFileSync(join(archive, 'ui-gates.json'), json)
    // Publish atomically so readers never see a half-written JSON.
    const latest = join(base, 'ui-gates-latest.json')
    const temporary = `${latest}.tmp`
    writeFileSync(temporary, json)
    renameSync(temporary, latest)
    for (const old of expiredDates(readdirSync(base), new Date())) {
      rmSync(join(base, old), { recursive: true, force: true })
    }
    console.log(json)
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
