import { describe, expect, test } from 'bun:test'
import {
  formatClaudeModelIds,
  parseClaudeHelp,
  parseCodexModelsCache,
  parseOpencodeModels,
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
      { id: 'openai/gpt-5', name: 'openai/gpt-5', short: 'openai/gpt-5' },
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
})
