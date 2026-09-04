/**
 * CC.1 (Mes 29, 2026-08-16) — `runClaudeChat()`, el camino de chat vía Claude
 * Code CLI para `executor_mode: cli-claude`. Reporte real de Carlos: elegir
 * "Claude" en Settings no cambiaba nada en el chat (seguía yendo por la API de
 * OpenRouter) — verificado en código que `handlers/chat.ts` nunca consultaba
 * `executor_mode` para la respuesta conversacional, solo para la tarea que el
 * chat auto-crea en segundo plano.
 *
 * Mismo patrón de mock que external-engine.test.ts (Bun.spawn/Bun.which
 * overrideados, sin depender del binario real ni de red).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { buildClaudeChatArgs, ExecutorExternalError, runClaudeChat } from '../run/executors/external.ts'

const originalWhich = Bun.which
beforeEach(() => {
  ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
})
afterEach(() => {
  Bun.which = originalWhich
  Bun.spawn = originalSpawn
})

const originalSpawn = Bun.spawn

interface MockProc {
  stdin: { write(_s: string): void; end(): void }
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill(_signal: string): void
}

function makeMockProc(stdoutText: string): MockProc {
  const encoder = new TextEncoder()
  const stdoutStream = new ReadableStream<Uint8Array>({
    start(controller) {
      queueMicrotask(() => {
        controller.enqueue(encoder.encode(stdoutText))
        controller.close()
      })
    },
  })
  const stderrStream = new ReadableStream<Uint8Array>({
    start(c) {
      c.close()
    },
  })
  let resolveExit!: (n: number) => void
  const exited = new Promise<number>((r) => {
    resolveExit = r
  })
  queueMicrotask(() => resolveExit(0))
  return {
    stdin: { write(_s) {}, end() {} },
    stdout: stdoutStream,
    stderr: stderrStream,
    exited,
    kill(_signal) {},
  }
}

interface MockSpawnCall {
  cmd: string[]
  cwd: string
}
let spawnCalls: MockSpawnCall[] = []

function overrideBunSpawn(proc: MockProc) {
  spawnCalls = []
  Bun.spawn = ((cmd: string[], opts?: { cwd?: string }) => {
    spawnCalls.push({ cmd: cmd.slice(), cwd: opts?.cwd ?? '' })
    return proc as unknown as ReturnType<typeof Bun.spawn>
  }) as typeof Bun.spawn
}

function streamOf(...events: object[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

const assistantText = (text: string) => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
})

const resultEvent = (fields: Record<string, unknown>) => ({ type: 'result', ...fields })

describe('runClaudeChat (CC.1)', () => {
  it('construye --settings apuntando al archivo aislado del proyecto', () => {
    const args = buildClaudeChatArgs('system', undefined, undefined, '/repo/.orchestos/agent-home/claude/settings.json')
    const idx = args.indexOf('--settings')
    expect(idx).toBeGreaterThan(-1)
    expect(args[idx + 1]).toBe('/repo/.orchestos/agent-home/claude/settings.json')
  })

  it('nunca pide permisos de escritura — --allowedTools es solo lectura', async () => {
    const stdout = streamOf(
      assistantText('hola'),
      resultEvent({ total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 5 } }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    await runClaudeChat('/tmp/some-project', 'system prompt', 'hola', 5000)

    expect(spawnCalls).toHaveLength(1)
    const idx = spawnCalls[0]!.cmd.indexOf('--allowedTools')
    expect(idx).toBeGreaterThan(-1)
    const tools = spawnCalls[0]!.cmd[idx + 1]
    expect(tools).toBe('Read,Glob,Grep')
    expect(tools).not.toContain('Edit')
    expect(tools).not.toContain('Write')
  })

  it('corre en el proyecto real (cwd), sin exigir worktree', async () => {
    const stdout = streamOf(
      assistantText('ok'),
      resultEvent({ total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 } }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    await runClaudeChat('/tmp/real-project-root', 'sys', 'msg', 5000)

    expect(spawnCalls[0]!.cwd).toBe('/tmp/real-project-root')
  })

  it('acumula el texto de los bloques assistant/text en orden', async () => {
    const stdout = streamOf(
      assistantText('Primera parte. '),
      assistantText('Segunda parte.'),
      resultEvent({ total_cost_usd: 0.002, usage: { input_tokens: 20, output_tokens: 8 } }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000)

    expect(result.text).toBe('Primera parte. Segunda parte.')
    expect(result.inputTokens).toBe(20)
    expect(result.outputTokens).toBe(8)
    expect(result.usd).toBe(0.002)
  })

  it('lanza ExecutorExternalError cuando el binario no está instalado', async () => {
    ;(Bun as any).which = (_bin: string) => null
    await expect(runClaudeChat('/tmp/p', 'sys', 'msg', 5000)).rejects.toThrow(ExecutorExternalError)
  })

  it('lanza ExecutorExternalError si el proceso nunca emite un evento result', async () => {
    overrideBunSpawn(makeMockProc(streamOf(assistantText('respuesta sin result'))))
    await expect(runClaudeChat('/tmp/p', 'sys', 'msg', 5000)).rejects.toThrow(ExecutorExternalError)
  })

  it('pasa el modelo cuando es de Anthropic (mismo mapper que el executor de tareas); sin modelUsage en el evento, cae al valor pedido', async () => {
    const stdout = streamOf(assistantText('x'), resultEvent({ total_cost_usd: 0, usage: {} }))
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000, 'anthropic/claude-sonnet-5')

    const idx = spawnCalls[0]!.cmd.indexOf('--model')
    expect(spawnCalls[0]!.cmd[idx + 1]).toBe('claude-sonnet-5')
    expect(result.model).toBe('anthropic/claude-sonnet-5')
  })

  // CC.D2 (2026-08-17) — hallazgo real de Carlos usando el picker de alias:
  // pedir "sonnet" (alias, resuelve a lo que sea la versión vigente) devolvía
  // el label "Sonnet" sin decir a qué versión concreta corrió — el request
  // nunca refleja la resolución real del CLI. `modelUsage` en el evento
  // `result` SÍ trae el nombre canónico real (verificado contra el binario en
  // vivo: `--model sonnet` → `modelUsage: { "claude-sonnet-5": {...} }`).
  it('con alias (ej. "sonnet"), el label usa el nombre canónico real de modelUsage, no el alias pedido', async () => {
    const stdout = streamOf(
      assistantText('x'),
      resultEvent({
        total_cost_usd: 0.009,
        usage: {},
        modelUsage: { 'claude-sonnet-5': { canonicalModel: 'claude-sonnet-5' } },
      }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000, 'anthropic/sonnet')

    const idx = spawnCalls[0]!.cmd.indexOf('--model')
    expect(spawnCalls[0]!.cmd[idx + 1]).toBe('sonnet')
    expect(result.model).toBe('claude-sonnet-5')
  })

  // CC.1b (2026-08-16) — hallazgo real de Carlos el mismo día del gate de CC.1:
  // la primera versión no pasaba effort al binario, ni lo devolvía en el label —
  // "muy genérico" (sic). Claude CLI acepta 5 niveles reales (claude --help),
  // no los 3 del selector pensado para el `reasoning` de OpenRouter.
  it('pasa el effort al CLI con --effort y lo devuelve en el resultado', async () => {
    const stdout = streamOf(assistantText('x'), resultEvent({ total_cost_usd: 0, usage: {} }))
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000, undefined, 'xhigh')

    const idx = spawnCalls[0]!.cmd.indexOf('--effort')
    expect(idx).toBeGreaterThan(-1)
    expect(spawnCalls[0]!.cmd[idx + 1]).toBe('xhigh')
    expect(result.effort).toBe('xhigh')
  })

  it('sin effort explícito, no manda --effort (el binario usa su propio default)', async () => {
    const stdout = streamOf(assistantText('x'), resultEvent({ total_cost_usd: 0, usage: {} }))
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000)

    expect(spawnCalls[0]!.cmd).not.toContain('--effort')
    expect(result.effort).toBeUndefined()
  })

  it('sin modelo de Anthropic, el label dice explícitamente "default del CLI" en vez de inventar un modelo', async () => {
    const stdout = streamOf(assistantText('x'), resultEvent({ total_cost_usd: 0, usage: {} }))
    overrideBunSpawn(makeMockProc(stdout))

    const result = await runClaudeChat('/tmp/p', 'sys', 'msg', 5000, 'deepseek/deepseek-v4-flash')

    expect(spawnCalls[0]!.cmd).not.toContain('--model')
    expect(result.model).toBe('claude (cli default model)')
  })
})
