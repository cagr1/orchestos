import { afterEach, beforeEach, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cliSearchPath } from '../../run/executors/cli-discovery.ts'
import { detectInstalledClis } from '../../run/executors/cli-registry.ts'
import { createProviderReader, handleApiProviders, type ProviderProbe } from './providers.ts'

let home: string
let probe: ProviderProbe
let calls: string[]
let now: number
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'set2-providers-'))
  calls = []
  now = 0
  probe = {
    home,
    env: { PATH: '/process/bin', SHELL: '/fake/shell' },
    loginPath: () => '/login/bin',
    which: (binary, path) =>
      ['claude', 'codex', 'opencode'].includes(binary) && path.split(':').includes('/login/bin')
        ? `/login/bin/${binary}`
        : null,
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return null
      }
    },
    command: async (binary, args) => {
      calls.push(`${binary} ${args.join(' ')}`)
      return args[0] === '--version' ? `${binary.split('/').at(-1)} 1.2.3\nsecond line` : ''
    },
    now: () => now,
  }
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

function reader() {
  return createProviderReader(probe, {
    models: async () => [
      { id: 'claude', models: [{ id: 'sonnet', name: 'Sonnet', short: 'Sonnet' }], efforts: [] },
    ],
    executor: (root) => ({
      agent: root === '/codex-project' ? 'codex' : 'claude',
      model: 'selected-model',
    }),
    customClis: () => [],
  })
}

it('detects login-shell binaries using the shared detector and includes all fallback directories', async () => {
  const path = cliSearchPath(probe).split(':')
  for (const dir of [
    '/process/bin',
    '/login/bin',
    join(home, '.local/bin'),
    join(home, '.bun/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(home, '.opencode/bin'),
  ])
    expect(path).toContain(dir)
  expect(detectInstalledClis(() => null, probe).find((cli) => cli.id === 'codex')).toMatchObject({
    installed: true,
    path: '/login/bin/codex',
  })
  const providers = await reader()('/project')
  expect(providers.find((cli) => cli.id === 'claude')).toMatchObject({
    installed: true,
    version: 'claude 1.2.3',
    models: ['sonnet'],
    defaultModel: 'selected-model',
    taskEngine: true,
    session: 'chat',
  })
  expect(providers.find((cli) => cli.id === 'opencode')?.session).toBe('terminal')
  expect(providers.find((cli) => cli.id === 'gemini')).toMatchObject({
    installed: false,
    version: null,
    auth: { status: 'unknown' },
    taskEngine: false,
    session: null,
  })
  expect(calls).toHaveLength(3)
})

it('reads Claude and Codex identities from temporary HOME; response never includes auth tokens', async () => {
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      oauthAccount: {
        emailAddress: 'claude@example.test',
        organizationType: 'claude_max',
        accessToken: 'private-claude-token',
      },
    }),
  )
  mkdirSync(join(home, '.codex'))
  const idToken = [
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        email: 'codex@example.test',
        'https://api.openai.com/auth': { chatgpt_plan_type: 'pro' },
      }),
    ).toString('base64url'),
    'private-signature',
  ].join('.')
  writeFileSync(
    join(home, '.codex/auth.json'),
    JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'private-access',
        id_token: idToken,
        refresh_token: 'private-refresh',
        account_id: 'private-account',
      },
      last_refresh: '2026-10-26T00:00:00Z',
    }),
  )
  const response = await handleApiProviders(
    new URL('http://localhost/api/providers'),
    '/project',
    reader(),
  )
  const data = (await response.json()) as { providers: { id: string; auth: unknown }[] }
  expect(data.providers.find((cli) => cli.id === 'claude')?.auth).toEqual({
    status: 'ok',
    account: 'claude@example.test',
    plan: 'max',
  })
  expect(data.providers.find((cli) => cli.id === 'codex')?.auth).toEqual({
    status: 'ok',
    account: 'codex@example.test',
    plan: 'pro',
  })
  expect(JSON.stringify(data)).not.toMatch(
    /private-|access_token|id_token|refresh_token|OPENAI_API_KEY/,
  )
  expect(JSON.stringify(data)).not.toContain(idToken)
})

it('honors CODEX_HOME and handles malformed JWTs without inventing account details', async () => {
  probe.env.CODEX_HOME = join(home, 'custom-codex')
  mkdirSync(probe.env.CODEX_HOME)
  writeFileSync(join(probe.env.CODEX_HOME, 'auth.json'), '{"tokens":{"id_token":"opaque-token"}}')
  const providers = await reader()('/project')
  expect(providers.find((cli) => cli.id === 'codex')?.auth).toEqual({ status: 'ok' })
  expect(providers.find((cli) => cli.id === 'claude')?.auth).toEqual({ status: 'missing' })
})

it('uses Claude email fallback and requires an email for authenticated status', async () => {
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      oauthAccount: { email: 'fallback@example.test', organizationType: 'claude_pro' },
    }),
  )
  const read = reader()
  expect((await read('/project')).find((cli) => cli.id === 'claude')?.auth).toEqual({
    status: 'ok',
    account: 'fallback@example.test',
    plan: 'pro',
  })
  writeFileSync(join(home, '.claude.json'), JSON.stringify({ oauthAccount: {} }))
  expect((await read('/project', true)).find((cli) => cli.id === 'claude')?.auth).toEqual({
    status: 'missing',
  })
})

it('recognizes Codex API key authentication without exposing credentials or account details', async () => {
  mkdirSync(join(home, '.codex'))
  const read = reader()
  for (const auth of [{ auth_mode: 'apikey' }, { OPENAI_API_KEY: 'private-key' }]) {
    writeFileSync(join(home, '.codex/auth.json'), JSON.stringify(auth))
    const providers = await read('/project', true)
    expect(providers.find((cli) => cli.id === 'codex')?.auth).toEqual({ status: 'ok' })
    expect(JSON.stringify(providers)).not.toMatch(/private-key|OPENAI_API_KEY/)
  }
})

it('returns null version on timeout and safely handles malformed auth', async () => {
  probe.command = async () => null
  writeFileSync(join(home, '.claude.json'), 'invalid json')
  const providers = await reader()('/project')
  expect(providers.find((cli) => cli.id === 'claude')).toMatchObject({
    version: null,
    auth: { status: 'unknown' },
  })
})

it('caches for 30 seconds, refresh invalidates, and executor defaults remain project-specific', async () => {
  const read = reader()
  await Promise.all([read('/project'), read('/project')])
  expect(calls).toHaveLength(3)
  now = 29_999
  const second = await read('/codex-project')
  expect(second.find((cli) => cli.id === 'codex')?.defaultModel).toBe('selected-model')
  expect(second.find((cli) => cli.id === 'claude')?.defaultModel).toBeUndefined()
  expect(calls).toHaveLength(3)
  now = 30_000
  await read('/project')
  expect(calls).toHaveLength(6)
  await handleApiProviders(new URL('http://localhost/api/providers?refresh=1'), '/project', read)
  expect(calls).toHaveLength(9)
})

it('continues detection when login shell times out', async () => {
  probe.loginPath = () => null
  probe.which = (binary, path) =>
    binary === 'codex' && path.includes(join(home, '.bun/bin'))
      ? join(home, '.bun/bin/codex')
      : null
  expect((await reader()('/project')).find((cli) => cli.id === 'codex')?.installed).toBe(true)
})

it('includes configured CLIs and their Model routing catalog', async () => {
  const previous = process.env.ORCHESTOS_HOME
  process.env.ORCHESTOS_HOME = home
  try {
    mkdirSync(join(home, '.orchestos'))
    writeFileSync(
      join(home, '.orchestos/config.yaml'),
      'clis:\n  - id: custom\n    label: Custom CLI\n    command: custom-bin\n    args: []\n    modelArgs: ["--model", "{model}"]\n    models: [small, large]\n',
    )
    probe.which = (binary) => (binary === 'custom-bin' ? '/login/bin/custom-bin' : null)
    const read = createProviderReader(probe, {
      models: async () => [],
      executor: () => ({ agent: 'custom', model: 'large' }),
    })
    const providers = await read('/project')
    expect(providers.find((cli) => cli.id === 'custom')).toEqual({
      id: 'custom',
      label: 'Custom CLI',
      installed: true,
      path: '/login/bin/custom-bin',
      version: 'custom-bin 1.2.3',
      auth: { status: 'unknown' },
      models: ['default', 'small', 'large'],
      defaultModel: 'large',
      taskEngine: true,
      session: null,
    })
  } finally {
    if (previous === undefined) delete process.env.ORCHESTOS_HOME
    else process.env.ORCHESTOS_HOME = previous
  }
})

it('reuses the CLI model catalog with fake commands and a temporary model cache', async () => {
  mkdirSync(join(home, '.codex'))
  writeFileSync(
    join(home, '.codex/models_cache.json'),
    '{"models":[{"slug":"cached-codex","display_name":"Cached"}]}',
  )
  const original = probe.command
  probe.command = async (binary, args) => {
    if (args[0] === '--help') return '--model (e.g. "sonnet", "opus")'
    if (args[0] === 'models') return 'openai/cached-opencode'
    return original(binary, args)
  }
  const read = createProviderReader(probe, { executor: () => undefined, customClis: () => [] })
  const providers = await read('/project')
  expect(providers.find((cli) => cli.id === 'claude')?.models).toEqual(['sonnet', 'opus'])
  expect(providers.find((cli) => cli.id === 'codex')?.models).toEqual(['cached-codex'])
  expect(providers.find((cli) => cli.id === 'opencode')?.models).toEqual(['openai/cached-opencode'])
  expect(providers.every((cli) => cli.defaultModel === undefined)).toBe(true)
})
