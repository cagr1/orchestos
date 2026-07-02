import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// F1.3 (b): end-to-end wiring — el harness pasa el `retry_reason` de la tarea
// al provider, sin importar el resto del flujo. Mocks: globalThis.fetch (captura
// el body que el provider openrouter envía a su API), process.env.OPENROUTER_API_KEY
// (para que loadApiKey() no tire antes de fetch). Sandbox `cwd` explícito para
// evitar createWorktree (que requiere git).

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-harness-retry-'))
}

interface CapturedBody {
  model: string
  messages: Array<{ role: string; content: string }>
}

function mockFetchReturningEmpty() {
  let captured: CapturedBody | null = null
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body)) as CapturedBody
    // text vacío → parseLLMResponse va a tirar error, pero el body ya está capturado
    return new Response(JSON.stringify({
      choices: [{ message: { content: '' } }],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
      model: captured.model,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return () => captured
}

describe('runTask — F1.3 retry path forwards previous failure to provider', () => {
  it('includes the PREVIOUS ATTEMPT FAILED block in the user message when retry_count > 0', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const getBody = mockFetchReturningEmpty()

    const { runTask } = await import('../run/harness.ts')
    const { RunLogger } = await import('../run/logger.ts')

    const dir = tmpDir()
    try {
      const log = new RunLogger(dir, 'retry-test')
      const result = await runTask({
        projectRoot: dir,
        contextText: '',
        task: {
          id: 'retry-test',
          description: 'rewrite the file',
          executor: 'openrouter',
          input: [],
          output: ['out.txt'],
          depends_on: [],
          status: 'pending',
          retry_count: 1,
          retry_reason: 'previous run failed: missing output out.txt',
        },
        logger: log,
        sandboxMode: 'cwd',
      })

      const body = getBody()
      expect(body).not.toBeNull()
      // openrouter provider arma messages = [system, ...opts.messages] →
      // el userContent de buildPrompt queda en messages[1]
      const userMessage = body!.messages.find(m => m.role === 'user')?.content ?? ''
      expect(userMessage).toContain('## PREVIOUS ATTEMPT FAILED')
      expect(userMessage).toContain('previous run failed: missing output out.txt')
      expect(userMessage).toContain('Fix the cause described above. Do not repeat the same mistake.')

      // El bloque NO debe filtrarse al system
      const systemMessage = body!.messages.find(m => m.role === 'system')?.content ?? ''
      expect(systemMessage).not.toContain('PREVIOUS ATTEMPT FAILED')

      // el resultado del run puede ser failed (parse error sobre text vacío) —
      // eso es ortogonal al wiring que estamos probando
      expect(['failed', 'done']).toContain(result.status)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('omits the PREVIOUS ATTEMPT FAILED block when retry_count is 0', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const getBody = mockFetchReturningEmpty()

    const { runTask } = await import('../run/harness.ts')
    const { RunLogger } = await import('../run/logger.ts')

    const dir = tmpDir()
    try {
      const log = new RunLogger(dir, 'first-run')
      await runTask({
        projectRoot: dir,
        contextText: '',
        task: {
          id: 'first-run',
          description: 'rewrite the file',
          executor: 'openrouter',
          input: [],
          output: ['out.txt'],
          depends_on: [],
          status: 'pending',
          retry_count: 0,
        },
        logger: log,
        sandboxMode: 'cwd',
      })

      const body = getBody()
      expect(body).not.toBeNull()
      const userMessage = body!.messages.find(m => m.role === 'user')?.content ?? ''
      expect(userMessage).not.toContain('PREVIOUS ATTEMPT FAILED')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
