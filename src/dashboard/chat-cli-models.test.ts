import { beforeEach, describe, expect, test } from 'bun:test'
import {
  formatClaudeModelIds,
  parseClaudeHelp,
  parseCodexModelsCache,
  parseOpencodeModels,
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

  test('keeps healthy CLI catalogs when one CLI spawn fails', async () => {
    const catalogs = await readCliModelCatalogs(
      async (command) => {
        if (command === 'claude-broken') throw new Error('ENOEXEC: spawn failed')
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
      { id: 'claude', models: [], efforts: [], error: 'ENOEXEC: spawn failed' },
      {
        id: 'opencode',
        models: [
          { id: 'openai/gpt-5', name: 'gpt-5', short: 'gpt-5', efforts: [], group: 'openai' },
        ],
        efforts: [],
      },
    ])
  })
})
