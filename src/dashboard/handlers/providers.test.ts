import { afterEach, beforeEach, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cliSearchPath } from '../../run/executors/cli-discovery.ts'
import { detectInstalledClis } from '../../run/executors/cli-registry.ts'
import { readCliModelCatalogsCached, resetCliModelCatalogCache } from '../chat-cli-models.ts'
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
      ...['claude', 'codex', 'opencode'].map((id) => ({
        id,
        models: [{ id: 'sonnet', name: 'Sonnet', short: 'Sonnet' }],
        efforts: [],
      })),
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
    version: '1.2.3',
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

it('normalizes versions from the first output line, preserving lines without version tokens', async () => {
  for (const [output, version] of [
    ['2.1.311 (Claude Code)', '2.1.311'],
    ['codex-cli 0.164.0', '0.164.0'],
    ['1.19.0', '1.19.0'],
    ['cli 1.2.3-beta.1+build', '1.2.3-beta.1'],
    ['development\n1.2.3', 'development'],
  ] as const) {
    probe.command = async () => output
    expect((await reader()('/project')).find((cli) => cli.id === 'claude')?.version).toBe(version)
  }
})

for (const failure of ['empty', 'error', 'throw']) {
  it(`retries a ${failure} model catalog without refresh and caches healthy CLIs separately`, async () => {
    let attempts = 0
    const batches: string[][] = []
    const read = createProviderReader(probe, {
      models: async (clis) => {
        batches.push(clis.map((cli) => cli.id))
        attempts++
        if (failure === 'throw' && attempts === 1) throw new Error('catalog unavailable')
        return clis.map((cli) => ({
          id: cli.id,
          models:
            cli.id === 'opencode' && attempts === 1
              ? []
              : [{ id: 'recovered', name: 'Recovered', short: 'Recovered' }],
          efforts: [],
          ...(failure === 'error' && cli.id === 'opencode' && attempts === 1
            ? { error: 'catalog unavailable' }
            : {}),
        }))
      },
      executor: () => undefined,
      customClis: () => [],
    })
    expect((await read('/project')).find((cli) => cli.id === 'opencode')?.models).toEqual([])
    expect((await read('/project')).find((cli) => cli.id === 'opencode')?.models).toEqual([
      'recovered',
    ])
    expect(batches[1]).toEqual(failure === 'throw' ? ['claude', 'codex', 'opencode'] : ['opencode'])
    await read('/project')
    expect(attempts).toBe(2)
  })
}

it('keeps an in-flight retry intact when refresh clears the cache', async () => {
  let attempts = 0
  let release = () => {}
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const read = createProviderReader(probe, {
    models: async (clis) => {
      const attempt = ++attempts
      if (attempt === 2) await waiting
      return clis.map((cli) => ({
        id: cli.id,
        models:
          attempt === 1 && cli.id === 'opencode'
            ? []
            : [{ id: `model-${attempt}`, name: 'Model', short: 'Model' }],
        efforts: [],
      }))
    },
    executor: () => undefined,
    customClis: () => [],
  })
  await read('/project')
  const retry = read('/project')
  const refreshed = await read('/project', true)
  release()
  const retried = await retry
  expect(retried.find((cli) => cli.id === 'claude')?.models).toEqual(['model-1'])
  expect(retried.find((cli) => cli.id === 'opencode')?.models).toEqual(['model-2'])
  expect(await read('/project')).toEqual(refreshed)
  expect(attempts).toBe(3)
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
      version: '1.2.3',
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

it('shares the default model catalog with concurrent providers and refresh without probing models', async () => {
  resetCliModelCatalogCache()
  let catalogReads = 0
  let release = () => {}
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const catalog = readCliModelCatalogsCached({
      read: async () => {
        catalogReads++
        await waiting
        return ['claude', 'codex', 'opencode'].map((id) => ({
          id,
          models: [{ id: `cached-${id}`, name: 'Cached', short: 'Cached' }],
          efforts: [],
        }))
      },
    })
    const read = createProviderReader(probe, { executor: () => undefined, customClis: () => [] })
    const first = read('/project')
    const refreshed = read('/project', true)
    expect(catalogReads).toBe(1)
    release()
    const [providers, refreshedProviders] = await Promise.all([first, refreshed, catalog])
    expect(refreshedProviders).toEqual(providers)
    for (const id of ['claude', 'codex', 'opencode'])
      expect(providers.find((cli) => cli.id === id)?.models).toEqual([`cached-${id}`])
    expect(providers.every((cli) => cli.defaultModel === undefined)).toBe(true)
    expect(await read('/project', true)).toEqual(providers)
    expect(catalogReads).toBe(1)
    expect(calls).toHaveLength(9)
    expect(calls.every((call) => call.endsWith(' --version'))).toBe(true)
  } finally {
    release()
    resetCliModelCatalogCache()
  }
})
