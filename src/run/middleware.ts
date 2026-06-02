/**
 * src/run/middleware.ts  — S31.1
 *
 * Middleware chain para la fase de enrichment del harness.
 *
 * Scope: pasos de preparación previos al LLM call (classify → memory → skill →
 * constitution → context → prompt). La fase de ejecución (LLM call, parse,
 * contract, checks, QA, revert, insertRun) permanece orquestada por harness.ts
 * porque su lógica de error y revert es una máquina de estados, no pasos
 * independientes.
 *
 * Orden canónico → ENRICHMENT_MIDDLEWARE_ORDER.
 * Cada middleware llama next() para continuar o retorna sin llamarlo para
 * cortocircuitar (patrón: spec-gate lanza, sandbox-setup en dry-run salta).
 */

import type { Task } from '../tasks/schema.ts'
import type { TaskClass } from '../router/classify.ts'
import type { ProviderClient } from '../providers/index.ts'
import type { Worktree } from './sandbox.ts'
import type { ContextWarning } from '../hooks/context-monitor.ts'
import type { BuiltPrompt } from './prompt.ts'
import type { HarnessOpts } from './harness.ts'

// -- core types ----------------------------------------------------------------

export type MiddlewareFn<TCtx> = (ctx: TCtx, next: () => Promise<void>) => Promise<void>

export interface MiddlewareChain<TCtx> {
  use(fn: MiddlewareFn<TCtx>): MiddlewareChain<TCtx>
  run(ctx: TCtx): Promise<void>
}

export function createChain<TCtx>(): MiddlewareChain<TCtx> {
  const fns: MiddlewareFn<TCtx>[] = []
  return {
    use(fn) { fns.push(fn); return this },
    run(ctx)  { return compose(fns, ctx, 0) },
  }
}

function compose<TCtx>(fns: MiddlewareFn<TCtx>[], ctx: TCtx, index: number): Promise<void> {
  if (index >= fns.length) return Promise.resolve()
  const fn = fns[index]!
  return fn(ctx, () => compose(fns, ctx, index + 1))
}

// -- run context ---------------------------------------------------------------

/**
 * Bolsa mutable que fluye por el middleware chain de enrichment.
 * El harness lee los campos resueltos para construir el LLM call.
 *
 * Invariante: todos los campos deben estar poblados al salir del chain.
 * Cada middleware es responsable de rellenar sus campos; si falla, debe
 * lanzar para que el harness capture el error en su catch-all.
 */
export interface RunContext {
  // --- input inmutable ---
  opts: HarnessOpts

  // --- classify-route ---
  taskClass: TaskClass
  model: string
  providerName: string
  provider: ProviderClient

  // --- memory-fetch ---
  /** Copia enriquecida de la tarea con input sugerido por embeddings/BM25 */
  task: Task
  embedHits: number

  // --- skill-route ---
  /** Instrucciones compiladas de la skill activa; '' si no hay skill */
  skillInstructions: string

  // --- tool-policy ---
  /** Lista de tool ids permitidos por la skill; [] significa sin restricción */
  allowedTools: string[]

  // --- constitution-load ---
  constitutionBlock: string
  constitutionRules: number | null

  // --- context-source ---
  /** Contenido de CONTEXT.md (si existe) o AGENTS.md */
  effectiveContext: string
  /** 'CONTEXT.md' | 'AGENTS.md' — para logging y registro en runs */
  contextSource: string
  contextTokens: number

  // --- sandbox-setup ---
  /** Ruta efectiva al proyecto (worktree path o projectRoot) */
  effectiveRoot: string
  worktree: Worktree | null

  // --- instinct-apply (S33) ---
  /** Bloque de instincts verificados inyectado en el system prompt; '' hasta S33 */
  instinctBlock: string

  // --- prompt-build ---
  prompt: BuiltPrompt

  // --- acumulado durante la ejecución (lo escribe context-monitor, lo lee harness) ---
  contextWarnings: ContextWarning[]
}

// -- canonical middleware order ------------------------------------------------

/**
 * Orden canónico de la cadena de enrichment.
 * harness.ts construye el chain en este orden usando las implementaciones de
 * src/run/middlewares/*.ts (S31.2–S31.5).
 *
 *  spec-gate        — lanza si requireSpec y el spec no está aprobado
 *  sandbox-setup    — crea el worktree, fija effectiveRoot
 *  classify-route   — resuelve taskClass, model y provider
 *  memory-fetch     — suggestContext + embeddings → enriquece task.input
 *  skill-route      — carga skill YAML → skillInstructions
 *  tool-policy      — extrae allowed_tools de la skill
 *  constitution-load— carga CONSTITUTION.md → constitutionBlock
 *  context-source   — elige CONTEXT.md vs AGENTS.md → effectiveContext
 *  instinct-apply   — (S33) inyecta instincts verificados → instinctBlock
 *  prompt-build     — ensambla system + userContent desde todos los campos ctx
 */
export const ENRICHMENT_MIDDLEWARE_ORDER = [
  'spec-gate',
  'sandbox-setup',
  'classify-route',
  'memory-fetch',
  'skill-route',
  'tool-policy',
  'constitution-load',
  'context-source',
  'instinct-apply',
  'prompt-build',
] as const

export type EnrichmentMiddlewareName = (typeof ENRICHMENT_MIDDLEWARE_ORDER)[number]

// -- context factory -----------------------------------------------------------

/**
 * Crea un RunContext con valores por defecto seguros.
 * El harness pasa HarnessOpts y el chain rellena el resto.
 */
export function createRunContext(opts: HarnessOpts): RunContext {
  return {
    opts,
    taskClass:        'implement' as TaskClass,
    model:            '',
    providerName:     '',
    provider:         null as unknown as ProviderClient,
    task:             opts.task,
    embedHits:        0,
    skillInstructions:'',
    allowedTools:     [],
    constitutionBlock:'',
    constitutionRules:null,
    effectiveContext: opts.contextText,
    contextSource:    'AGENTS.md',
    contextTokens:    Math.round(opts.contextText.length / 4),
    effectiveRoot:    opts.projectRoot,
    worktree:         null,
    instinctBlock:    '',
    prompt:           { system: '', userContent: '' },
    contextWarnings:  [],
  }
}
