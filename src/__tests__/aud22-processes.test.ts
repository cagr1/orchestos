import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOneCheck } from '../run/checks.ts'
import { runCodexChat } from '../run/executors/codex.ts'
import { CodexAppServer } from '../run/executors/codex-app-server.ts'
import { runClaudeChat } from '../run/executors/external.ts'
import { runOpencodeChat } from '../run/executors/opencode.ts'

let dir: string
let originalPath: string | undefined
let originalHome: string | undefined
let watchdog: ReturnType<typeof setTimeout>
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aud22-engines-'))
  originalPath = process.env.PATH
  originalHome = process.env.ORCHESTOS_HOME
  process.env.PATH = `${dir}:/usr/bin:/bin:${originalPath}`
  process.env.ORCHESTOS_HOME = join(dir, 'home')
  const fixtureDir = dir
  watchdog = setTimeout(() => cleanupPids(fixtureDir), 4000)
})
function cleanupPids(fixtureDir: string) {
  for (const name of ['child', 'grandchild']) {
    if (existsSync(join(fixtureDir, name))) {
      try {
        process.kill(Number(readFileSync(join(fixtureDir, name), 'utf8')), 'SIGKILL')
      } catch {}
    }
  }
}
afterEach(() => {
  clearTimeout(watchdog)
  cleanupPids(dir)
  process.env.PATH = originalPath
  process.env.ORCHESTOS_HOME = originalHome
  rmSync(dir, { recursive: true, force: true })
})
function cli(name: string, body: string) {
  writeFileSync(
    join(dir, name),
    `#!/bin/sh\ncase "$1" in --help) echo --restricted; exit 0;; --version) echo fake; exit 0;; esac\n${body}\n`,
    { mode: 0o755 },
  )
}
async function noPids() {
  await Bun.sleep(100)
  for (const name of ['child', 'grandchild']) {
    const pid = Number(readFileSync(join(dir, name), 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow('No such process')
  }
}
const runners = {
  codex: (timeout: number, step?: () => void) =>
    runCodexChat(dir, '', 'hello', timeout, undefined, undefined, step),
  opencode: (timeout: number, step?: () => void) =>
    runOpencodeChat(dir, '', 'hello', timeout, undefined, undefined, step),
  claude: (timeout: number) => runClaudeChat(dir, '', 'hello', timeout),
  checks: (timeout: number) =>
    runOneCheck({ cmd: 'fake-check', timeout_ms: timeout, trusted: true }, dir),
}
for (const [engine, run] of Object.entries(runners)) {
  test(`${engine}: timeout kills the whole group even if TERM is ignored`, async () => {
    cli(
      engine === 'checks' ? 'fake-check' : engine,
      "trap '' TERM\necho $$ > child\n/bin/sleep 300 &\necho $! > grandchild\nwait",
    )
    // Synchronous CLI provisioning precedes the subprocess timeout.
    const running = run(500)
    watchdog.refresh()
    const start = Date.now()
    let error: unknown
    let result: unknown
    try {
      result = await running
    } catch (e) {
      error = e
    }
    expect(Date.now() - start).toBeLessThan(3500)
    if (engine === 'checks') expect(result).toMatchObject({ timedOut: true })
    else expect(String(error)).toContain('timed out')
    await noPids()
  }, 6000)
}
test('external: AbortSignal kills the entire process group', async () => {
  cli('claude', 'echo $$ > child\n/bin/sleep 300 &\necho $! > grandchild\nwait')
  const controller = new AbortController()
  const running = runClaudeChat(
    dir,
    '',
    'hello',
    4000,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    controller.signal,
  )
  for (let i = 0; i < 400 && !existsSync(join(dir, 'grandchild')); i++) await Bun.sleep(10)
  expect(existsSync(join(dir, 'grandchild'))).toBe(true)
  watchdog.refresh()
  const abortedAt = Date.now()
  controller.abort()
  await expect(running).rejects.toThrow()
  expect(Date.now() - abortedAt).toBeLessThan(3000)
  await noPids()
}, 6000)
test('codex exec: AbortSignal kills the entire process group', async () => {
  cli('codex', 'echo $$ > child\n/bin/sleep 300 &\necho $! > grandchild\nwait')
  const controller = new AbortController()
  const running = runCodexChat(
    dir,
    '',
    'hello',
    4000,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    [],
    undefined,
    controller.signal,
  )
  for (let i = 0; i < 400 && !existsSync(join(dir, 'grandchild')); i++) await Bun.sleep(10)
  expect(existsSync(join(dir, 'grandchild'))).toBe(true)
  watchdog.refresh()
  const abortedAt = Date.now()
  controller.abort()
  await expect(running).rejects.toThrow()
  expect(Date.now() - abortedAt).toBeLessThan(3000)
  await noPids()
}, 6000)
test('opencode drains more than a pipe buffer of stderr', async () => {
  cli(
    'opencode',
    `/usr/bin/head -c 1048576 /dev/zero >&2\necho '${JSON.stringify({ type: 'step_finish', part: { type: 'step-finish', cost: 0, tokens: {} } })}'`,
  )
  await expect(runOpencodeChat(dir, '', 'hello', 1500)).resolves.toMatchObject({ usd: 0 })
})
for (const engine of ['codex', 'opencode'] as const) {
  // Un fallo al mostrar un paso no aborta la corrida (comportamiento previo, conservado).
  test(`${engine}: an onStep exception does not abort the run`, async () => {
    const event =
      engine === 'codex'
        ? { type: 'item.completed', item: { type: 'agent_message', text: 'hello' } }
        : { type: 'text', part: { type: 'text', text: 'hello' } }
    cli(engine, `echo $$ > child\necho '${JSON.stringify(event)}'`)
    let calls = 0
    // El CLI falso no emite evento final, así que el motor puede rechazar por eso; nunca por el callback.
    const outcome = await runners[engine](3000, () => {
      calls++
      throw new Error('callback failed')
    }).catch((error: Error) => error)
    expect(outcome instanceof Error ? outcome.message : '').not.toContain('callback failed')
    expect(calls).toBeGreaterThan(0)
    const pid = Number(readFileSync(join(dir, 'child'), 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow('No such process')
  }, 6000)
}

test('app-server: kill followed by a new request survives the old CLI exit', async () => {
  const worker = join(dir, 'app-server.ts')
  writeFileSync(
    worker,
    `
    process.on('SIGTERM', () => setTimeout(() => process.exit(0), 30))
    let buffer = ''
    process.stdin.on('data', chunk => {
      buffer += String(chunk)
      for (;;) {
        const end = buffer.indexOf('\\n')
        if (end < 0) break
        const request = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1)
        if (request.id === undefined) continue
        setTimeout(() => {
          let result = {}
          if (request.method === 'thread/start') result = { thread: { id: 't-' + process.pid } }
          if (request.method === 'turn/start') result = { turn: { id: 'u' } }
          console.log(JSON.stringify({ id: request.id, result }))
          if (request.method === 'turn/start') console.log(JSON.stringify({ method: 'turn/completed', params: { threadId: request.params.threadId, turn: { id: 'u', status: 'completed' } } }))
        }, 100)
      }
    })
  `,
  )
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  cli('codex', `exec ${quote(process.execPath)} ${quote(worker)}`)
  const server = new CodexAppServer({
    binary: join(dir, 'codex'),
    env: { ...process.env } as Record<string, string>,
    store: { get: () => ({ threadId: null, contextHash: null }), set: () => {} },
  })
  try {
    const input = { sessionId: 's', cwd: dir, systemPrompt: '', message: 'hello', timeoutMs: 2000 }
    const first = await server.turn(input)
    server.kill()
    const second = await server.turn(input)
    expect(second.threadId).not.toBe(first.threadId)
  } finally {
    server.kill()
  }
})
