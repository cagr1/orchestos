import { describe, expect, test } from 'bun:test'
import {
  formatClaudeModelIds,
  parseClaudeHelp,
  parseCodexModelsCache,
  parseOpencodeModels,
  readCliModelCatalogs,
} from './chat-cli-models.ts'

describe('UI.14 round 5 CLI model catalogs', () => {
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
      { id: 'openai/gpt-5', name: 'openai/gpt-5', short: 'openai/gpt-5', efforts: [] },
    ])
  })

  test('strips only the OpenCode prefix from display names while preserving model ids', () => {
    expect(parseOpencodeModels('opencode/big-pickle\nopenrouter/other-model')).toEqual([
      { id: 'opencode/big-pickle', name: 'big-pickle', short: 'big-pickle', efforts: [] },
      {
        id: 'openrouter/other-model',
        name: 'openrouter/other-model',
        short: 'openrouter/other-model',
        efforts: [],
      },
    ])
  })

  test('parses OpenCode verbose variants in order and tolerates malformed model blocks', () => {
    expect(
      parseOpencodeModels(
        'openai/gpt-6\n{"variants":{"low":{},"high":{}}}\nopenai/broken\n{oops}\nanthropic/claude\n{\n  "variants": {"minimal": {}, "xhigh": {}}\n}',
      ),
    ).toEqual([
      { id: 'openai/gpt-6', name: 'openai/gpt-6', short: 'openai/gpt-6', efforts: ['low', 'high'] },
      { id: 'openai/broken', name: 'openai/broken', short: 'openai/broken', efforts: [] },
      {
        id: 'anthropic/claude',
        name: 'anthropic/claude',
        short: 'anthropic/claude',
        efforts: ['minimal', 'xhigh'],
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
        models: [{ id: 'openai/gpt-5', name: 'openai/gpt-5', short: 'openai/gpt-5', efforts: [] }],
        efforts: [],
      },
    ])
  })
})
