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
import { realpathSync } from 'node:fs'
import { _resetCliCapabilityCache } from '../run/executors/cli-registry.ts'
import {
  buildClaudeChatArgs,
  CLAUDE_CHAT_BOUNDARY_FLAGS,
  ExecutorExternalError,
  runClaudeChat,
} from '../run/executors/external.ts'
import { claudeEventToReadPaths } from '../run/executors/step-event.ts'

const originalWhich = Bun.which
const originalSpawnSync = Bun.spawnSync
beforeEach(() => {
  _resetCliCapabilityCache()
  ;(Bun as any).which = (_bin: string) => process.execPath
  ;(Bun as any).spawnSync = () => ({ exitCode: 0, stdout: Buffer.from('  --restricted  mode') })
})
afterEach(() => {
  Bun.which = originalWhich
  Bun.spawn = originalSpawn
  Bun.spawnSync = originalSpawnSync
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
  it('rechaza el binario viejo antes del spawn de conversación', async () => {
    ;(Bun as any).spawnSync = () => ({ exitCode: 0, stdout: Buffer.from('  --settings') })
    overrideBunSpawn(makeMockProc(''))
    await expect(runClaudeChat('/tmp/p', 'sys', 'msg', 5000)).rejects.toThrow('--restricted')
    expect(spawnCalls).toHaveLength(0)
  })

  it('ejecuta la ruta canónica comprobada aunque PATH cambie durante la sonda', async () => {
    let checked = ''
    ;(Bun as any).spawnSync = (cmd: string[]) => {
      checked = cmd[0]!
      ;(Bun as any).which = () => '/otro/claude'
      return { exitCode: 0, stdout: Buffer.from('  --restricted  mode') }
    }
    overrideBunSpawn(makeMockProc(streamOf(resultEvent({}))))
    await runClaudeChat('/tmp/p', 'sys', 'msg', 5000)
    expect(checked).toBe(realpathSync(process.execPath))
    expect(spawnCalls[0]!.cmd[0]).toBe(checked)
  })
  it('construye --settings apuntando al archivo aislado del proyecto', () => {
    const args = buildClaudeChatArgs(
      'system',
      undefined,
      undefined,
      '/repo/.orchestos/agent-home/claude/settings.json',
    )
    const idx = args.indexOf('--settings')
    expect(idx).toBeGreaterThan(-1)
    expect(args[idx + 1]).toBe('/repo/.orchestos/agent-home/claude/settings.json')
    const addDir = args.indexOf('--add-dir')
    expect(args[addDir + 1]).toBe(process.cwd())
  })

  it('nunca pide permisos de escritura — --tools es solo lectura', async () => {
    const stdout = streamOf(
      assistantText('hola'),
      resultEvent({ total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 5 } }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    await runClaudeChat('/tmp/some-project', 'system prompt', 'hola', 5000)

    expect(spawnCalls).toHaveLength(1)
    // H.9.2 (reabierto 2026-09-06) — antes se afirmaba sobre `--allowedTools`,
    // que NO limita las herramientas disponibles sino las auto-aprobadas: con
    // ese flag el modelo igual usó `Bash` (`cat`) y leyó un archivo externo
    // (sonda 2, PLAN.md § R.2-bis). El flag que sí limita es `--tools`.
    const idx = spawnCalls[0]!.cmd.indexOf('--tools')
    expect(idx).toBeGreaterThan(-1)
    expect(spawnCalls[0]!.cmd).not.toContain('--allowedTools')
    const tools = spawnCalls[0]!.cmd[idx + 1]
    expect(tools).toBe('Read,Glob,Grep')
    expect(tools).not.toContain('Edit')
    expect(tools).not.toContain('Write')
    expect(tools).not.toContain('Bash')
  })

  // H.9.2 — la frontera de lectura ES este par de flags. Si alguien los quita
  // "porque no parecen hacer nada", el chat de proyecto vuelve a leer cualquier
  // archivo del filesystem en silencio — que es exactamente cómo se cerró este
  // ítem roto la primera vez. Este test existe para que ese cambio no compile
  // limpio: la regla se hace cumplir mecánicamente, no por prosa en un comentario.
  it('el spawn del chat SIEMPRE lleva los flags que constituyen la frontera', async () => {
    overrideBunSpawn(
      makeMockProc(streamOf(assistantText('ok'), resultEvent({ total_cost_usd: 0, usage: {} }))),
    )
    await runClaudeChat('/tmp/some-project', 'system prompt', 'hola', 5000)

    for (const flag of CLAUDE_CHAT_BOUNDARY_FLAGS) {
      expect(spawnCalls[0]!.cmd).toContain(flag)
    }
    // Y no debe quedar ningún `permissions.deny` implícito reintroducido por
    // costumbre: la frontera es el flag, no un patrón de permisos (sondas 1/4/7).
    expect(spawnCalls[0]!.cmd.join(' ')).not.toContain('Read(//')
  })

  it('corre en el proyecto real (cwd), sin exigir worktree', async () => {
    const stdout = streamOf(
      assistantText('ok'),
      resultEvent({ total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 } }),
    )
    overrideBunSpawn(makeMockProc(stdout))

    await runClaudeChat('/tmp/real-project-root', 'sys', 'msg', 5000)

    expect(spawnCalls[0]!.cwd).toBe('/tmp/real-project-root')
    const addDir = spawnCalls[0]!.cmd.indexOf('--add-dir')
    expect(spawnCalls[0]!.cmd[addDir + 1]).toBe('/tmp/real-project-root')
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

  it('solo proyecta lecturas exitosas correlacionadas; una solicitud no basta', async () => {
    const readEvent = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'a',
            name: 'Read',
            input: { file_path: '/tmp/project/README.md' },
          },
          {
            type: 'tool_use',
            id: 'b',
            name: 'Read',
            input: { file_path: '/tmp/project/README.md' },
          },
          { type: 'tool_use', id: 'c', name: 'Grep', input: { pattern: 'vault' } },
        ],
      },
    }
    expect(claudeEventToReadPaths(readEvent)).toEqual([
      '/tmp/project/README.md',
      '/tmp/project/README.md',
    ])

    overrideBunSpawn(
      makeMockProc(
        streamOf(
          readEvent,
          {
            type: 'user',
            message: {
              content: [
                { type: 'tool_result', tool_use_id: 'c', content: 'Found 1 file' },
                {
                  type: 'tool_result',
                  tool_use_id: 'b',
                  is_error: true,
                  content: 'File not found',
                },
                { type: 'tool_result', tool_use_id: 'a', content: 'fixture' },
              ],
            },
          },
          assistantText('ok'),
          resultEvent({ total_cost_usd: 0, usage: {} }),
        ),
      ),
    )
    const result = await runClaudeChat('/tmp/project', 'sys', 'msg', 5000)
    expect(result.filesRead).toEqual(['/tmp/project/README.md'])
    expect(result.readAudit.operations.map((op) => op.outcome)).toEqual([
      'succeeded',
      'failed',
      'succeeded',
    ])
  })

  it('procesa el último evento sin newline y conserva corrupción como incompletitud', async () => {
    overrideBunSpawn(makeMockProc(JSON.stringify(resultEvent({ usage: {} }))))
    expect((await runClaudeChat('/tmp/project', 'sys', 'msg', 5000)).readAudit.completeness).toBe(
      'complete',
    )
    overrideBunSpawn(makeMockProc('broken\n' + JSON.stringify(resultEvent({ usage: {} }))))
    const partial = await runClaudeChat('/tmp/project', 'sys', 'msg', 5000)
    expect(partial.filesRead).toBeNull()
    expect(partial.readAudit.issues).toContain('malformed-json')
  })

  it('adjunta la auditoría incompleta al error sin evento terminal', async () => {
    overrideBunSpawn(
      makeMockProc(
        streamOf({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'pending', name: 'Read', input: { file_path: 'inside.txt' } },
            ],
          },
        }),
      ),
    )
    let caught: ExecutorExternalError | undefined
    try {
      await runClaudeChat('/tmp/project', 'sys', 'msg', 5000)
    } catch (error) {
      caught = error as ExecutorExternalError
    }
    expect(caught?.readAudit?.completeness).toBe('incomplete')
    expect(caught?.readAudit?.operations[0]?.outcome).toBe('unknown')
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
