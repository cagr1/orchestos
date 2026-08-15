/**
 * AA.3 (IDEAS #6) — draftSpec({ design: true }) debe pedirle al LLM una sección
 * "## Design" adicional (decisiones/alternativas, no relleno de Descripción);
 * sin el flag, cero cambio en el prompt existente. Mismo patrón de mock fetch
 * que qa-core.test.ts/harness-adversarial-qa.test.ts — un solo call capturado,
 * sin red real.
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { draftSpec } from '../draft.ts'

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-draft-design-'))
}

function installMockFetch(): { calls: Array<{ model: string; messages: Array<{ role: string; content: string }>; system?: string }> } {
  const calls: Array<{ model: string; messages: Array<{ role: string; content: string }>; system?: string }> = []
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push(body)
    return new Response(JSON.stringify({
      choices: [{ message: { content: '## Contexto\nFoo\n\n## Descripción\nBar\n\n## Criterios de aceptación\n- [ ] WHEN X THEN Y\n\n## Notas\nNone' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'mock/model',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return { calls }
}

describe('draftSpec — design section (AA.3)', () => {
  it('sin { design: true }: el prompt no menciona Design en absoluto', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const { calls } = installMockFetch()
    const dir = tmpDir()
    try {
      await draftSpec(dir, 'simple-task', 'A simple task')
      expect(calls).toHaveLength(1)
      // El body real de openrouter.chat() manda `messages` con el system prompt
      // como primer mensaje (ver providers/openrouter.ts) — buscamos en todo el body.
      const raw = JSON.stringify(calls[0])
      expect(raw).not.toContain('## Design')
      expect(raw).not.toContain('COMPLEJA')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('con { design: true }: el prompt pide la sección ## Design con decisiones/alternativas', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const { calls } = installMockFetch()
    const dir = tmpDir()
    try {
      await draftSpec(dir, 'complex-task', 'A complex task', { design: true })
      expect(calls).toHaveLength(1)
      const raw = JSON.stringify(calls[0])
      expect(raw).toContain('## Design')
      expect(raw).toContain('COMPLEJA')
      expect(raw).toContain('Alternativas consideradas')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
