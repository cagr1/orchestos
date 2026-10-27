import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatClaudeModelIds,
  parseClaudeHelp,
  parseClaudeModelCatalog,
  parseCodexModelsCache,
  parseOpencodeModels,
  readClaudeModelIds,
  readCliModelCatalogs,
  readCliModelCatalogsCached,
  resetCliModelCatalogCache,
} from './chat-cli-models.ts'

describe('UI.14 round 5 CLI model catalogs', () => {
  beforeEach(() => resetCliModelCatalogCache())

  test('shares one in-flight read between simultaneous callers', async () => {
    let resolveRead!: (catalogs: Awaited<ReturnType<typeof readCliModelCatalogs>>) => void
    let reads = 0
    const read = () => {
      reads += 1
      return new Promise<Awaited<ReturnType<typeof readCliModelCatalogs>>>((resolve) => {
        resolveRead = resolve
      })
    }
    const first = readCliModelCatalogsCached({ read })
    const second = readCliModelCatalogsCached({ read })
    const catalogs = [{ id: 'codex', models: [], efforts: [] }]
    resolveRead(catalogs)
    const [result1, result2] = await Promise.all([first, second])
    expect(reads).toBe(1)
    expect(result1).toBe(result2)
  })

  test('caches within TTL and rereads after expiry', async () => {
    let time = 100
    let reads = 0
    const read = async () => {
      reads += 1
      return [{ id: 'codex', models: [], efforts: [] }]
    }
    await readCliModelCatalogsCached({ ttlMs: 10, now: () => time, read })
    await readCliModelCatalogsCached({ ttlMs: 10, now: () => time, read })
    expect(reads).toBe(1)
    time = 111
    await readCliModelCatalogsCached({ ttlMs: 10, now: () => time, read })
    expect(reads).toBe(2)
  })

  test('does not cache catalogs containing an error', async () => {
    let reads = 0
    const read = async () => {
      reads += 1
      return [{ id: 'codex', models: [], efforts: [], ...(reads === 1 ? { error: 'failed' } : {}) }]
    }
    await readCliModelCatalogsCached({ read })
    await readCliModelCatalogsCached({ read })
    expect(reads).toBe(2)
  })

  test('propagates a rejected read and retries on the next call', async () => {
    let reads = 0
    const read = async () => {
      reads += 1
      if (reads === 1) throw new Error('read failed')
      return [{ id: 'codex', models: [], efforts: [] }]
    }
    await expect(readCliModelCatalogsCached({ read })).rejects.toThrow('read failed')
    await expect(readCliModelCatalogsCached({ read })).resolves.toEqual([
      { id: 'codex', models: [], efforts: [] },
    ])
    expect(reads).toBe(2)
  })

  test('parses Codex models and per-model reasoning levels mechanically', () => {
    expect(
      parseCodexModelsCache(
        JSON.stringify({
          models: [
            {
              slug: 'gpt-6-astra',
              display_name: 'GPT-6-Astra',
              supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }],
            },
          ],
        }),
      ),
    ).toEqual([
      {
        id: 'gpt-6-astra',
        name: 'GPT-6-Astra',
        short: 'GPT-6-Astra',
        efforts: ['low', 'high'],
      },
    ])
  })

  test('parses Claude aliases and effort values from help', () => {
    expect(
      parseClaudeHelp(
        " --effort <level> (low, medium, high, xhigh, max)\n--model <model> Provide an alias for the latest model (e.g. 'fable', 'opus', or 'sonnet')",
      ),
    ).toEqual({
      models: [
        { id: 'fable', name: 'fable', short: 'fable' },
        { id: 'opus', name: 'opus', short: 'opus' },
        { id: 'sonnet', name: 'sonnet', short: 'sonnet' },
      ],
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    })
  })

  test('parses the wrapped help layout emitted by the installed Claude CLI', () => {
    expect(
      parseClaudeHelp(
        "  --effort <level>                      Effort level for the current session\n                                        (low, medium, high, xhigh, max)\n  --model <model>                       Model for the current session. Provide\n                                        an alias for the latest model (e.g.\n                                        'fable', 'opus', or 'sonnet') or a",
      ).models.map((model) => model.id),
    ).toEqual(['fable', 'opus', 'sonnet'])
  })

  test('parses only provider/model rows from OpenCode output', () => {
    expect(parseOpencodeModels('openai/gpt-5\nWarning: noisy\nnot-a-model')).toEqual([
      { id: 'openai/gpt-5', name: 'gpt-5', short: 'gpt-5', efforts: [], group: 'openai' },
    ])
  })

  test('groups OpenCode providers and displays final model names with vendors', () => {
    expect(
      parseOpencodeModels(
        'openrouter/~anthropic/claude-haiku-latest\nopencode/big-pickle\nlocal/model/vendor',
      ),
    ).toEqual([
      {
        id: 'openrouter/~anthropic/claude-haiku-latest',
        name: 'claude-haiku-latest',
        short: 'claude-haiku-latest',
        efforts: [],
        group: 'OpenRouter',
        vendor: 'anthropic',
      },
      {
        id: 'opencode/big-pickle',
        name: 'big-pickle',
        short: 'big-pickle',
        efforts: [],
        group: 'Zen',
      },
      {
        id: 'local/model/vendor',
        name: 'vendor',
        short: 'vendor',
        efforts: [],
        group: 'local',
        vendor: 'model',
      },
    ])
  })

  test('parses OpenCode verbose variants in order and tolerates malformed model blocks', () => {
    expect(
      parseOpencodeModels(
        'openai/gpt-6\n{"variants":{"low":{},"high":{}}}\nopenai/broken\n{oops}\nanthropic/claude\n{\n  "variants": {"minimal": {}, "xhigh": {}}\n}',
      ),
    ).toEqual([
      {
        id: 'openai/gpt-6',
        name: 'gpt-6',
        short: 'gpt-6',
        efforts: ['low', 'high'],
        group: 'openai',
      },
      { id: 'openai/broken', name: 'broken', short: 'broken', efforts: [], group: 'openai' },
      {
        id: 'anthropic/claude',
        name: 'claude',
        short: 'claude',
        efforts: ['minimal', 'xhigh'],
        group: 'anthropic',
      },
    ])
  })

  test('normalizes and orders Claude versions without date suffixes', () => {
    expect(
      formatClaudeModelIds([
        'claude-sonnet-4-5-20250929',
        'claude-haiku-4-5-20251001',
        'claude-opus-5',
        'claude-fable-5',
        'claude-sonnet-4-5',
      ]),
    ).toEqual([
      { id: 'claude-fable-5', name: 'Fable 5', short: 'Fable 5' },
      { id: 'claude-opus-5', name: 'Opus 5', short: 'Opus 5' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', short: 'Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', short: 'Haiku 4.5' },
    ])
  })

  test('runs detected CLIs by their absolute path outside the process PATH', async () => {
    const home = mkdtempSync(join(tmpdir(), 'cli-model-path-'))
    const binary = join(home, 'login-shell-bin', 'claude')
    const calls: Array<{ command: string; args: string[] }> = []
    try {
      expect(Bun.which('claude', { PATH: join(home, 'process-bin') })).toBeNull()
      const catalogs = await readCliModelCatalogs(
        async (command, args) => {
          calls.push({ command, args })
          if (command !== binary) throw new Error('CLI is outside the process PATH')
          return { stdout: "--model <model> (e.g. 'opus', 'sonnet')", exitCode: 0 }
        },
        [
          {
            id: 'claude',
            label: 'Claude',
            binary: 'claude',
            icon: 'claude',
            installed: true,
            path: binary,
            readBoundary: { kind: 'none', reason: 'test' },
          },
        ],
        home,
      )
      expect(calls).toEqual([{ command: binary, args: ['--help'] }])
      expect(catalogs[0]?.models.map((model) => model.id)).toEqual(['opus', 'sonnet'])
      expect(catalogs[0]?.error).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('keeps healthy CLI catalogs when one CLI spawn fails', async () => {
    const catalogs = await readCliModelCatalogs(
      async (command) => {
        if (command === '/claude-broken') throw new Error('ENOEXEC: spawn failed')
        return { stdout: 'openai/gpt-5', exitCode: 0 }
      },
      [
        {
          id: 'claude',
          label: 'Claude',
          binary: 'claude-broken',
          icon: 'claude',
          installed: true,
          path: '/claude-broken',
          readBoundary: { kind: 'none', reason: 'test' },
        },
        {
          id: 'opencode',
          label: 'OpenCode',
          binary: 'opencode-good',
          icon: 'opencode',
          installed: true,
          path: '/opencode-good',
          readBoundary: { kind: 'none', reason: 'test' },
        },
      ],
    )

    expect(catalogs).toEqual([
      {
        id: 'claude',
        models: [],
        efforts: [],
        error: 'ENOEXEC: spawn failed',
        chat: true,
        installed: true,
        label: 'Claude',
      },
      {
        id: 'opencode',
        chat: false,
        installed: true,
        label: 'OpenCode',
        models: [
          { id: 'openai/gpt-5', name: 'gpt-5', short: 'gpt-5', efforts: [], group: 'openai' },
        ],
        efforts: [],
      },
    ])
  })
})

function claudeCatalog(
  surface: string,
  fetchedAt: number,
  models: Array<{ id: string; name: string; section: string }>,
) {
  return JSON.stringify({
    version: 2,
    fetchedAt,
    staleAt: fetchedAt + 1000,
    catalog: {
      surface,
      config: {
        models: models.map((model) => ({ ...model, short_name: model.name.split(' ')[0] })),
      },
    },
  })
}

const claudeFixture = claudeCatalog('cc', 100, [
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', section: 'overflow' },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', section: 'main' },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', section: 'main' },
])

describe('MOD.1 Claude model catalog from the CLI source', () => {
  test('parses names with version, main before overflow', () => {
    expect(parseClaudeModelCatalog(claudeFixture)).toEqual([
      { id: 'claude-opus-5-5', name: 'Opus 5.5', short: 'Opus 5.5' },
      { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', short: 'Sonnet 5.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', short: 'Haiku 4.5', group: 'Older' },
    ])
    expect(parseClaudeModelCatalog('{oops')).toEqual([])
    expect(parseClaudeModelCatalog('{}')).toEqual([])
  })

  test('readClaudeModelIds uses the newest cc catalog and appends unknown history', () => {
    const home = mkdtempSync(join(tmpdir(), 'mod1-'))
    try {
      const dir = join(home, '.claude', 'cache', 'model-catalog')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'a-cc.json'), claudeFixture)
      writeFileSync(
        join(dir, 'b-cc.json'),
        claudeCatalog('cc', 50, [{ id: 'claude-old-1', name: 'Old 1', section: 'main' }]),
      )
      writeFileSync(
        join(dir, 'c-ccd.json'),
        claudeCatalog('ccd', 999, [{ id: 'claude-desktop-1', name: 'Desktop 1', section: 'main' }]),
      )
      writeFileSync(
        join(home, '.claude', 'stats-cache.json'),
        JSON.stringify({ modelUsage: { 'claude-opus-5-5': {}, 'claude-fable-4': {} } }),
      )
      const models = readClaudeModelIds(home)
      expect(models.map((model) => model.id)).toEqual([
        'claude-opus-5-5',
        'claude-sonnet-5-5',
        'claude-haiku-4-5-20251001',
        'claude-fable-4',
      ])
      expect(models.at(-1)?.group).toBe('Older')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('readClaudeModelIds without a catalog keeps the usage-history behaviour', () => {
    const home = mkdtempSync(join(tmpdir(), 'mod1-'))
    try {
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.claude', 'stats-cache.json'),
        JSON.stringify({ modelUsage: { 'claude-opus-5': {} } }),
      )
      expect(readClaudeModelIds(home)).toEqual([
        { id: 'claude-opus-5', name: 'Opus 5', short: 'Opus 5' },
      ])
      expect(readClaudeModelIds(join(home, 'missing'))).toEqual([])
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('contract: every CLI source yields a non-empty list with readable names', () => {
    const sources: Record<string, ReturnType<typeof parseClaudeModelCatalog>> = {
      claude: parseClaudeModelCatalog(claudeFixture),
      codex: parseCodexModelsCache(
        JSON.stringify({ models: [{ slug: 'gpt-6-astra', display_name: 'GPT-6-Astra' }] }),
      ),
      opencode: parseOpencodeModels('openai/gpt-5\n{"name":"GPT-5"}\n'),
    }
    for (const [cli, models] of Object.entries(sources)) {
      expect(models.length, cli).toBeGreaterThan(0)
      for (const model of models) expect(model.name.length, `${cli}:${model.id}`).toBeGreaterThan(0)
    }
    for (const cli of ['claude', 'codex'])
      for (const model of sources[cli] ?? []) expect(model.name).not.toBe(model.id)
  })
})
