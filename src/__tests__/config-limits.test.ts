import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig } from '../config/load.ts'
import { handleApiConfigSet } from '../dashboard/handlers/config.ts'
import { runToolLoop } from '../providers/tool-call.ts'
import { customCliValidationError } from '../run/executors/cli-registry.ts'

const roots: string[] = []
const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY
function fixture(yaml?: string) {
  const root = mkdtempSync(join(tmpdir(), 'aud12-'))
  roots.push(root)
  if (yaml !== undefined) writeFileSync(join(root, 'orchestos.config.yaml'), yaml)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

describe('AUD.12 config limits', () => {
  for (const value of ['.inf', '1e12', '0', '2.5', '-1']) {
    it(`YAML maxIterations ${value} falls back and warns`, () => {
      const warning = spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(
          loadOrcheConfig(fixture(`agentic:\n  maxIterations: ${value}\n`)).agentic?.maxIterations,
        ).toBeUndefined()
        expect(warning.mock.calls.flat().join(' ')).toContain('agentic.maxIterations')
      } finally {
        warning.mockRestore()
      }
    })
  }
  for (const value of ['2147483648', '-5', '1.5', '.nan']) {
    it(`YAML timeoutMs ${value} falls back and warns`, () => {
      const warning = spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(
          loadOrcheConfig(fixture(`external:\n  timeoutMs: ${value}\n`)).external?.timeoutMs,
        ).toBeUndefined()
        expect(warning.mock.calls.flat().join(' ')).toContain('external.timeoutMs')
      } finally {
        warning.mockRestore()
      }
    })
  }
  it('ignores unknown role agent with a warning', () => {
    const warning = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        loadOrcheConfig(fixture('roles:\n  executor: {agent: foo, model: test}\n')).roles.executor,
      ).toBeUndefined()
      expect(warning.mock.calls.flat().join(' ')).toContain('roles.executor')
    } finally {
      warning.mockRestore()
    }
  })
  for (const agent of ['claude', 'codex', 'opencode', 'api']) {
    it(`keeps supported role agent ${agent} and arbitrary effort`, () => {
      expect(
        loadOrcheConfig(
          fixture(`roles:\n  executor: {agent: ${agent}, model: test, effort: custom}\n`),
        ).roles.executor,
      ).toEqual({ agent, model: 'test', effort: 'custom' })
    })
  }
  for (const [field, values, range] of [
    ['agenticMaxIterations', [0, 101, 2.5, -1, '5', null], '1 y 100'],
    ['externalTimeoutMinutes', [0, 1441, 1e9, 1.5, -1, '20', null], '1 y 1440'],
  ] as const) {
    for (const value of values) {
      it(`PUT ${field} ${value} rejects without writing`, async () => {
        const root = fixture('# preserved\n')
        const response = await handleApiConfigSet(
          new Request('http://localhost/api/config', {
            method: 'PUT',
            body: JSON.stringify({ [field]: value }),
          }),
          root,
        )
        expect(response.status).toBe(400)
        expect(await response.text()).toContain(range)
        expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).toBe('# preserved\n')
      })
    }
  }
  for (const existing of [false, true]) {
    for (const [iterations, minutes] of [
      [1, 1],
      [100, 1440],
    ]) {
      it(`PUT boundaries ${iterations}/${minutes} persist (existing=${existing})`, async () => {
        const root = fixture(existing ? '# retained\nconfig_version: 1\n' : undefined)
        const response = await handleApiConfigSet(
          new Request('http://localhost/api/config', {
            method: 'PUT',
            body: JSON.stringify({
              agenticMaxIterations: iterations,
              externalTimeoutMinutes: minutes,
            }),
          }),
          root,
        )
        expect(response.status).toBe(200)
        const cfg = loadOrcheConfig(root)
        expect(cfg.agentic?.maxIterations).toBe(iterations)
        expect(cfg.external?.timeoutMs).toBe(minutes! * 60000)
      })
    }
  }
  for (const timeoutMs of [2 ** 31, -5, 1.5, Number.NaN, 59999, 86400001]) {
    it(`custom CLI rejects timeout ${timeoutMs}`, () => {
      expect(
        customCliValidationError({
          id: 'custom',
          label: 'Custom',
          command: 'custom',
          args: [],
          timeoutMs,
        }),
      ).toBe('.timeoutMs debe ser un entero entre 60000 y 86400000')
    })
  }
  for (const maxTurns of [0, -1, 2.5, 101, 1e12, Infinity, Number.NaN, 1, 100]) {
    it(`tool loop bounds maxTurns ${maxTurns}`, async () => {
      process.env.OPENROUTER_API_KEY = ['test', 'key'].join('-')
      let calls = 0
      globalThis.fetch = (async () => {
        calls++
        return new Response(
          JSON.stringify({
            choices: [
              {
                message:
                  calls <= 101
                    ? {
                        content: '',
                        tool_calls: [
                          {
                            id: `call-${calls}`,
                            type: 'function',
                            function: { name: 'fetch_url', arguments: '{}' },
                          },
                        ],
                      }
                    : { content: 'done' },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        )
      }) as unknown as typeof fetch
      await runToolLoop('openrouter', 'test', {
        system: 'test',
        messages: [{ role: 'user', content: 'test' }],
        tools: [],
        executeTool: async () => 'ok',
        maxTurns,
      })
      expect(calls).toBe(maxTurns === 1 ? 2 : maxTurns === 100 ? 101 : 4)
    })
  }
})
