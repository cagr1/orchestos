/**
 * PLAN.md Mes 22 Bloque A.3 — wiring de capToolOutput()/capCheckOutput() en
 * los 4 tools del executor agéntico. Los tests unitarios del módulo viven en
 * tool-output-cap.test.ts (A.1/A.2); acá probamos que el cap REALMENTE se
 * inyecta en read_file y run_check, no que la función esté bien escrita.
 *
 * Estrategia: mockear globalThis.fetch capturando el body de cada request.
 * El 2do fetch lleva en `messages[]` el tool-result del 1er tool-call — si el
 * cap está cableado, ese tool-result contiene el marcador. Sin cap, sería el
 * contenido crudo (decenas de miles de chars).
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Task } from '../tasks/schema.ts'
import { estimateTokens } from '../context/compress.ts'
import { contextWindowFor } from '../router/model-catalog.ts'

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-a3-cap-'))
}

function toolCallResponse(calls: Array<{ name: string; args: unknown }>, promptTokens = 10, completionTokens = 5): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: null,
        tool_calls: calls.map((c, i) => ({
          id: `call_${i}`,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      },
    }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function textResponse(text: string, promptTokens = 10, completionTokens = 5): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installCapturingMockFetch(handlers: Array<() => Response>): { bodies: string[] } {
  const bodies: string[] = []
  let i = 0
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    bodies.push(typeof init?.body === 'string' ? init.body : '')
    const handler = handlers[i++]
    if (!handler) throw new Error(`mock fetch: no handler for call #${i}`)
    return handler()
  }) as unknown as typeof fetch
  return { bodies }
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a3-cap-test',
    description: 'A.3 cap wiring test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function buildCtx(dir: string, task: Task) {
  const { createRunContext } = await import('../run/middleware.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const { getProvider } = await import('../providers/index.ts')
  const log = new RunLogger(dir, task.id)
  const ctx = createRunContext({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
  })
  ctx.model = 'openai/gpt-4o-mini'
  ctx.providerName = 'openrouter'
  ctx.provider = getProvider('openrouter')
  ctx.effectiveRoot = dir
  ctx.prompt = { system: '', userContent: `Task: ${task.description}` }
  return ctx
}

function findToolResult(messages: any[], toolCallId: string): any {
  return messages.find((m: any) => m.role === 'tool' && m.tool_call_id === toolCallId)
}

describe('A.3 — cap wiring in agenticEngine tools', () => {
  it('read_file caps the output the model sees when the file is large', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const big = 'A'.repeat(30_000)
    const dir = tmpDir()
    try {
      writeFileSync(join(dir, 'big.txt'), big)
      const { bodies } = installCapturingMockFetch([
        () => toolCallResponse([{ name: 'read_file', args: { path: 'big.txt' } }]),
        () => textResponse('done'),
      ])
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ input: ['big.txt'] }))
      await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 5 })

      // El 2do fetch lleva el tool-result del 1er tool-call.
      const secondBody = JSON.parse(bodies[1]!)
      const messages = secondBody.messages
      expect(messages.length).toBeGreaterThanOrEqual(3)
      const assistant = messages.find((m: any) => m.role === 'assistant' && Array.isArray(m.tool_calls))
      const toolCallId = assistant.tool_calls[0].id
      const toolMsg = findToolResult(messages, toolCallId)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).toContain('[...truncado:')
      expect(toolMsg.content.length).toBeLessThan(big.length + 200)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('read_file leaves small files untouched (no marker)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const dir = tmpDir()
    try {
      writeFileSync(join(dir, 'small.txt'), 'just a tiny file')
      const { bodies } = installCapturingMockFetch([
        () => toolCallResponse([{ name: 'read_file', args: { path: 'small.txt' } }]),
        () => textResponse('done'),
      ])
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ input: ['small.txt'] }))
      await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 5 })

      const secondBody = JSON.parse(bodies[1]!)
      const assistant = secondBody.messages.find((m: any) => m.role === 'assistant' && Array.isArray(m.tool_calls))
      const toolMsg = findToolResult(secondBody.messages, assistant.tool_calls[0].id)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).not.toContain('[...truncado:')
      expect(toolMsg.content).toContain('just a tiny file')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('run_check still works for a normal check (capCheckOutput is no-op under checks.ts OUTPUT_LIMIT=2K)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    // A.3 nuance: runChecks() ya trunca cada stream a 2000 chars (checks.ts:7)
    // con tail() que conserva la cola — el output TOTAL combinado de un check
    // (stdout ≤2K + stderr ≤2K + header ~30) cabe holgadamente bajo el cap
    // de 25K del executor. capCheckOutput queda inyectado como defensa en
    // profundidad (por si OUTPUT_LIMIT sube o el modelo combina outputs), pero
    // en la práctica no dispara aquí. Este test verifica que el wiring NO
    // rompe el camino normal de un check.
    const cmd = `node -e "process.stdout.write('hi'); process.stderr.write('warn')"`
    const dir = tmpDir()
    try {
      const { bodies } = installCapturingMockFetch([
        () => toolCallResponse([{ name: 'run_check', args: { cmd } }]),
        () => textResponse('done'),
      ])
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ checks: [{ cmd }] }))
      await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 5 })

      const secondBody = JSON.parse(bodies[1]!)
      const assistant = secondBody.messages.find((m: any) => m.role === 'assistant' && Array.isArray(m.tool_calls))
      const toolMsg = findToolResult(secondBody.messages, assistant.tool_calls[0].id)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).toContain('hi')
      expect(toolMsg.content).toContain('warn')
      // Bajo el cap → no debe aparecer el marcador
      expect(toolMsg.content).not.toContain('[...truncado:')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('list_dir caps the output when a directory has many entries', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const dir = tmpDir()
    try {
      // Cada entry pesa ~16 chars (entry_000XXX.txt\n) → 1800 entries ≈ 28800 chars
      // (>25K default). RunLogger también crea runs/ → +5 chars. Suficiente.
      const N = 1800
      for (let i = 0; i < N; i++) writeFileSync(join(dir, `entry_${String(i).padStart(6, '0')}.txt`), 'x')
      const { bodies } = installCapturingMockFetch([
        () => toolCallResponse([{ name: 'list_dir', args: { path: '.' } }]),
        () => textResponse('done'),
      ])
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask())
      await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 5 })

      const secondBody = JSON.parse(bodies[1]!)
      const assistant = secondBody.messages.find((m: any) => m.role === 'assistant' && Array.isArray(m.tool_calls))
      const toolMsg = findToolResult(secondBody.messages, assistant.tool_calls[0].id)
      expect(toolMsg).toBeDefined()
      expect(toolMsg.content).toContain('[...truncado:')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

/**
 * A.4 — 🔍 GATE (PLAN.md Mes 22 Bloque A). No basta con "el output está
 * acotado" (eso es A.3); el gate prueba el VÍNCULO CAUSAL de #32: sin el cap,
 * el tool-result de un read_file gigante infla `messages[]` por encima de la
 * ventana del modelo (la condición exacta que dispara `pending` / overflow de
 * contexto); con el cap, el contexto acumulado que ve la ronda siguiente cabe
 * holgadamente. Se mide con las MISMAS funciones que usa el motor real para
 * decidir el presupuesto (`estimateTokens`, `contextWindowFor`), no con
 * umbrales inventados — la evidencia es el request real capturado, no un [x].
 */
describe('A.4 — gate: el cap evita el overflow de contexto que dispara pending (#32)', () => {
  it('sin cap el read_file crudo excede la ventana; con cap la ronda siguiente cabe', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const model = 'openai/gpt-4o-mini'
    const contextWindow = contextWindowFor(model)

    // Archivo dimensionado para que su contenido CRUDO supere la ventana del
    // modelo — así el fallo de #32 (overflow → pending) es real, no hipotético.
    const rawChars = contextWindow * 4 + 50_000 // estimateTokens = chars/4
    const big = 'A'.repeat(rawChars)
    expect(estimateTokens(big)).toBeGreaterThan(contextWindow) // control: sin cap NO cabría

    const dir = tmpDir()
    try {
      writeFileSync(join(dir, 'huge.txt'), big)
      const { bodies } = installCapturingMockFetch([
        () => toolCallResponse([{ name: 'read_file', args: { path: 'huge.txt' } }]),
        () => textResponse('done'),
      ])
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ input: ['huge.txt'] }))
      await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 5 })

      // El 2do request es la ronda que, sin cap, habría llevado el archivo
      // entero en messages[] y reventado la ventana. Medimos el payload REAL.
      const secondBody = JSON.parse(bodies[1]!)
      const totalContextTokens = estimateTokens(JSON.stringify(secondBody.messages))
      expect(totalContextTokens).toBeLessThan(contextWindow) // con cap: SÍ cabe

      // Y cabe con margen de sobra para el output (el maxTokens de la corrida),
      // que es justo lo que #32 dice que se perdía: contextWindow−prompt < maxTokens.
      const toolMsg = findToolResult(
        secondBody.messages,
        secondBody.messages.find((m: any) => Array.isArray(m.tool_calls)).tool_calls[0].id,
      )
      expect(estimateTokens(toolMsg.content)).toBeLessThan(contextWindow / 4)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
