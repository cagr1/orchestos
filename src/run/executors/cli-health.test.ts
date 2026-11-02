import { expect, test } from 'bun:test'
import { type CliHealthProbe, createCliHealthReader } from './cli-health.ts'
import { KNOWN_CLIS } from './cli-registry.ts'

function fixture(id: string) {
  let now = 0
  const calls: string[] = []
  const probe: CliHealthProbe = {
    env: {},
    home: '/fake',
    loginPath: () => null,
    which: (binary) => `/fake/${binary}`,
    now: () => now,
    command: async (binary, args) => {
      calls.push(`${binary} ${args.join(' ')}`)
      return 'cli 1.2.3\nignored'
    },
    authCommand: async (binary, args) => {
      calls.push(`${binary} ${args.join(' ')}`)
      return { stdout: '', exitCode: 0 }
    },
  }
  const definition = KNOWN_CLIS.find((cli) => cli.id === id)!
  return {
    probe,
    calls,
    advance: (ms: number) => {
      now += ms
    },
    read: createCliHealthReader(probe, () => [definition]),
  }
}

for (const [id, args, ok, missing] of [
  [
    'claude',
    'auth status',
    '{"loggedIn":true,"authMethod":"oauth_token","subscriptionType":"max","email":"private"}',
    '{"loggedIn":false}',
  ],
  ['codex', 'login status', 'Logged in using ChatGPT', 'Not logged in'],
  ['opencode', 'auth list', '\u001b[90m└  2 credentials\u001b[0m', '└  0 credentials'],
] as const) {
  test(`${id}: authenticates with the expected read-only command and reports missing sessions`, async () => {
    const f = fixture(id)
    f.probe.authCommand = async (binary, actualArgs) => {
      expect(binary).toBe(`/fake/${id}`)
      expect(actualArgs.join(' ')).toBe(args)
      return { stdout: ok, exitCode: 0 }
    }
    const [healthy] = await f.read()
    expect(healthy).toMatchObject({
      id,
      installed: true,
      version: '1.2.3',
      auth: 'ok',
      functional: true,
      checkedAt: 0,
    })
    expect(JSON.stringify(healthy)).not.toContain('private')
    f.probe.authCommand = async () => ({ stdout: missing, exitCode: id === 'opencode' ? 0 : 1 })
    expect((await f.read(true))[0]).toMatchObject({ auth: 'missing', functional: false })
  })
  test(`${id}: failed probes and absent binaries remain unknown`, async () => {
    const f = fixture(id)
    for (const error of ['probe timed out after 5 s', 'binary disappeared']) {
      f.probe.authCommand = async () => {
        throw new Error(error)
      }
      expect((await f.read(true))[0]).toMatchObject({
        auth: 'unknown',
        authDetail: error,
        functional: true,
      })
    }
    f.probe.authCommand = async () => ({ stdout: 'unexpected', exitCode: 0 })
    expect((await f.read(true))[0]).toMatchObject({
      auth: 'unknown',
      authDetail: expect.any(String),
    })
    f.probe.which = () => null
    f.probe.command = async () => {
      throw new Error('must not probe absent binary')
    }
    f.probe.authCommand = async () => {
      throw new Error('must not probe absent binary')
    }
    expect((await f.read(true))[0]).toEqual({
      id,
      installed: false,
      path: null,
      version: null,
      auth: 'unknown',
      functional: false,
      checkedAt: 0,
    })
  })
}

test('Codex reads stderr and treats nonzero exit as missing; other malformed failures stay unknown', async () => {
  for (const id of ['claude', 'codex', 'opencode']) {
    const f = fixture(id)
    f.probe.authCommand = async () => ({
      stdout: '',
      stderr: 'Logged in using ChatGPT',
      exitCode: 0,
    })
    expect((await f.read())[0]?.auth).toBe(id === 'codex' ? 'ok' : 'unknown')
    f.probe.authCommand = async () => ({ stdout: 'unexpected', exitCode: 42 })
    expect((await f.read(true))[0]?.auth).toBe(id === 'codex' ? 'missing' : 'unknown')
  }
})

test('OpenCode with zero stored credentials and a known provider key has unknown auth', async () => {
  const f = fixture('opencode')
  f.probe.authCommand = async () => ({ stdout: '0 credentials', exitCode: 0 })
  f.probe.env.OPENAI_API_KEY = 'private-key'
  expect((await f.read())[0]).toMatchObject({ auth: 'unknown', functional: true })
  f.probe.env = { UNRELATED_API_KEY: 'private-key', OPENAI_API_KEY: '' }
  expect((await f.read(true))[0]).toMatchObject({ auth: 'missing', functional: false })
})

test('unknown adapters and custom CLIs stay functional without auth commands', async () => {
  const f = fixture('gemini')
  f.probe.authCommand = async () => {
    throw new Error('must not run')
  }
  expect((await f.read())[0]).toMatchObject({ auth: 'unknown', functional: true })
  const custom = createCliHealthReader(f.probe, () => [
    { ...KNOWN_CLIS[0]!, id: 'custom', generic: true },
  ])
  expect((await custom())[0]).toMatchObject({ id: 'custom', auth: 'unknown', functional: true })
})

test('coalesces concurrent reads for five minutes, refreshes explicitly and detects changed binaries', async () => {
  const f = fixture('claude')
  await Promise.all([f.read(), f.read()])
  expect(f.calls).toHaveLength(2)
  f.advance(299_999)
  await f.read()
  expect(f.calls).toHaveLength(2)
  f.advance(1)
  await f.read()
  expect(f.calls).toHaveLength(4)
  await f.read(true)
  expect(f.calls).toHaveLength(6)
  f.probe.which = () => '/new/claude'
  await f.read()
  expect(f.calls).toHaveLength(8)
})

test('probes CLIs, versions and auth concurrently; one failure cannot reject the batch', async () => {
  const f = fixture('claude')
  let release = () => {}
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const started: string[] = []
  f.probe.command = async (binary) => {
    started.push(`version:${binary}`)
    await waiting
    throw new Error('version timeout')
  }
  f.probe.authCommand = async (binary) => {
    started.push(`auth:${binary}`)
    await waiting
    throw new Error('auth timeout')
  }
  const read = createCliHealthReader(f.probe, () => KNOWN_CLIS.slice(0, 3))
  const pending = read()
  expect(started).toHaveLength(6)
  release()
  const states = await pending
  expect(states).toHaveLength(3)
  expect(states.every((cli) => cli.version === null && cli.auth === 'unknown')).toBe(true)
})
