/**
 * src/run/harness.ts
 *
 * Ejecuta una tarea individual. Recibe contexto ya preparado por cli.ts y
 * devuelve un TaskResult sin lanzar - cualquier excepcion queda en status: 'failed'.
 *
 * Flujo: enrichment chain (S31) → LLM call → parse → enforceContract →
 *        checks (deterministic) → QA → revert (si fail) → insertRun → TaskResult
 *
 * El enrichment chain reemplazó el pipeline inline previo. Cada paso es
 * un MiddlewareFn independiente en src/run/middlewares/.
 *
 * Si checks fallan: revert + return retry SIN llamar al LLM de QA (ahorra tokens).
 *
 * cli.ts es responsable de: cargar la tarea, verificar dependencias, marcar
 * 'running', abrir el logger, llamar runTask y mapear TaskResult a updateTaskStatus.
 */


import { classifyTask } from '../router/classify.ts'
import { resolveModel } from '../router/models.ts'
import { calcCost } from '../router/pricing.ts'
import { getProvider, type ProviderClient } from '../providers/index.ts'
import { autoRoute } from '../router/auto-route.ts'
import type { OrcheConfig } from '../config/schema.ts'
import { loadConstitution, buildConstitutionBlock } from '../spec/constitution.ts'
import { enforceContract, snapshotHashes, normalizeRelPath, type LLMFileResponse } from './contract.ts'
import { singleShotEngine, ExecutorParseError } from './executors/single-shot.ts'
import { agenticEngine } from './executors/agentic.ts'
import { externalEngine } from './executors/external.ts'
import type { ExecutorEngine, ExecutorOutcome } from './executors/types.ts'
import { supportsToolCalling } from '../providers/tool-call.ts'
import { runQA, snapshotContents, restoreContents, computeFileDiffs, MAX_RETRIES } from './qa.ts'
import { RunLogger } from './logger.ts'
import { insertRun } from '../db/runs.ts'
import { costBreakdownToJson } from './transcript-parser.ts'
import { buildPrompt } from './prompt.ts'
import { runChecks, defaultChecksFor, type CheckResult } from './checks.ts'
import { createWorktree, mergeWorktreeBack } from './sandbox.ts'
import { resolveSandboxMode, type SandboxMode } from './sandbox-policy.ts'
import { loadSpec } from '../spec/store.ts'
import { checkContextHealth, shouldCheck, type RunState } from '../hooks/context-monitor.ts'
import { ensureCatalogLoaded, contextWindowFor, knownMaxOutputTokensFor } from '../router/model-catalog.ts'
import { estimateTokens } from '../context/compress.ts'
import { createRunContext, createChain, type RunContext } from './middleware.ts'
import { contextInject, skillRoute, memoryFetch, toolPolicy, instinctApply } from './middlewares/index.ts'
import type { Task } from '../tasks/schema.ts'
import type { Worktree } from './sandbox.ts'
import type { ContextWarning } from '../hooks/context-monitor.ts'
import { generatePlan } from '../agents/planner.ts'
import type { SubTask } from '../agents/sub-agent.ts'
import { stringify as yamlStringify } from 'yaml'
import { writeFileSync } from 'fs'
import { join } from 'path'

// -- public types --------------------------------------------------------------

export interface HarnessOpts {
  /** Ruta absoluta al proyecto objetivo */
  projectRoot: string
  /** Contenido de AGENTS.md + context.json renderizado como texto (de loadContext) */
  contextText: string
  /** Tarea ya validada, con dependencias verificadas */
  task: Task
  /** Proyecto guardado en SQLite, requerido para sugerir contexto desde el grafo */
  projectId?: string
  /** Logger ya abierto para esta tarea */
  logger: RunLogger
  /** Si true, construye el prompt pero no llama al LLM ni escribe archivos */
  dryRun?: boolean
  /** Sobrescribe el modelo inferido por el router (highest priority) */
  modelOverride?: string
  /** Config loaded from orchestos.config.yaml — used by autoRoute */
  orcheConfig?: OrcheConfig
  /** True if an orchestos.config.yaml file was actually found (vs defaults) */
  orcheConfigFound?: boolean
  /** If true, the caller already asked for clarification and got user input appended to the task */
  constitutionRules?: number | null
  /** Sandbox mode resolved by sandbox-policy */
  sandboxMode?: SandboxMode
  /** Base branch to use when creating worktree */
  sandboxBranch?: string | null
  /** If true, keep worktree on failure for debugging */
  keepWorktree?: boolean
  /**
   * Monotonically increasing call count across the caller's session — used by
   * the context-monitor debounce (S23.0.2).  0 or undefined → always check.
   * In sub-agent executor, pass the sub-task index so health is checked every
   * 5th invocation instead of every single one.
   */
  monitorCallCount?: number
}

export interface TaskResult {
  status: 'done' | 'retry' | 'failed' | 'blocked' | 'pending' | 'split_proposed'
  /** ID del run insertado en SQLite (vacio si dryRun o fallo antes de insertar) */
  runId: string
  qaVerdict?: 'pass' | 'fail'
  qaReason?: string
  /** Razon del fallo o retry - para pasarla a updateTaskStatus como retry_reason */
  retryReason?: string
  filesWritten: string[]
  filesBlocked: string[]
  cost: { inputTokens: number; outputTokens: number; usd: number }
  elapsedMs: number
  /** S27.4 — context-monitor warnings fired during this run */
  contextWarnings: ContextWarning[]
  /** Mes 20 B.2 — auto-split: plan propuesto cuando shouldSplit=true */
  planYamlPath?: string
  plan?: SubTask[]
}

// -- Mes 20 B.1 — estimador de tamaño (función pura, testeable sin LLM) ------

/** Tokens promedio estimados por archivo de output (conservador: ~150 líneas TS). */
export const SPLIT_AVG_TOKENS_PER_FILE = 2048
/**
 * Si el output estimado supera esta fracción del presupuesto real por llamada,
 * la tarea se divide en sub-tareas antes de correr.
 */
export const SPLIT_THRESHOLD = 0.7

/**
 * Decide si una tarea excede el presupuesto de output de una sola llamada LLM.
 * Usa el `maxTokens` ya clampeado por `providerMaxOutput` (no `availableForOutput`
 * crudo) para evitar falsos negativos con modelos de tope bajo (ej. gpt-4o-mini).
 *
 * Exclusiones:
 *  - engine 'external': el executor es `claude -p`, no la API directa.
 *  - sin archivos de output (tareas topic_key-only): no hay nada que estimar.
 */
export function shouldSplit(task: Task, maxTokens: number): boolean {
  if (!task.output || task.output.length === 0) return false
  if (task.engine === 'external') return false
  return task.output.length * SPLIT_AVG_TOKENS_PER_FILE > maxTokens * SPLIT_THRESHOLD
}

// -- QA judge resolution (F2) ---------------------------------------------------

/** Cheap default judge model per executor provider — must differ from the executor to avoid correlated errors. */
export const QA_JUDGE_DEFAULTS: Record<string, { provider: string; model: string }> = {
  anthropic:  { provider: 'anthropic',  model: 'claude-haiku-4-5' },
  openai:     { provider: 'openai',     model: 'gpt-4o-mini' },
  openrouter: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
}

/**
 * Resolves which model/provider judges QA for this run.
 * (1) explicit orcheConfig.models.qa wins, even if it equals the executor model.
 * (2) otherwise pick QA_JUDGE_DEFAULTS by executor provider, distinct from ctx.model.
 * (3) if the chosen default collides with ctx.model (only possible for the openrouter
 *     default), fall back to anthropic/claude-haiku-4-5 called via openrouter.
 */
export function resolveQAJudge(
  executorProviderName: string,
  executorModel: string,
  orcheConfig: OrcheConfig | undefined,
  log: RunLogger,
): { provider: ProviderClient; model: string } {
  if (orcheConfig?.models.qa) {
    const explicit = orcheConfig.models.qa
    if (explicit.provider === executorProviderName && explicit.model === executorModel) {
      log.info('qa judge equals executor model — correlated errors risk')
    }
    return { provider: getProvider(explicit.provider), model: explicit.model }
  }

  const def = QA_JUDGE_DEFAULTS[executorProviderName] ?? QA_JUDGE_DEFAULTS.openrouter!
  if (def.provider === executorProviderName && def.model === executorModel) {
    // collision — only reachable via the openrouter default today
    return { provider: getProvider('openrouter'), model: 'anthropic/claude-haiku-4-5' }
  }
  return { provider: getProvider(def.provider), model: def.model }
}

// -- main ----------------------------------------------------------------------

export async function runTask(opts: HarnessOpts): Promise<TaskResult> {
  const { projectRoot, task: t, projectId: _projectId, logger: log, dryRun, modelOverride, orcheConfig, orcheConfigFound, sandboxMode, sandboxBranch, keepWorktree, monitorCallCount } = opts
  const t0 = performance.now()

  let worktree: Worktree | null = null
  let effectiveRoot = projectRoot

  try {
    // -- spec gate ---------------------------------------------------------------
    // Antes vivía fuera de este try: un throw acá (o en resolveSandboxMode/
    // createWorktree más abajo) tumbaba el proceso de `task run --id` entero sin
    // pasar por el catch-all de abajo — la tarea quedaba en `status: running` para
    // siempre, sin fila en `runs`, sin diagnóstico (solo "START" en el log). Bug
    // real encontrado dogfooding el flujo chat→tarea con un working tree sucio
    // (resolveSandboxMode lanza "Uncommitted changes..." en ese caso).
    if (orcheConfig?.requireSpec) {
      const spec = loadSpec(projectRoot, t.id)
      if (!spec || spec.frontmatter.status !== 'approved') {
        throw new Error(`Task '${t.id}' requires an approved spec. Run: orchestos spec approve ${t.id}`)
      }
    }

    // resolve sandbox (if not already resolved by caller, do it here)
    const policy = sandboxMode
      ? { mode: sandboxMode, branch: sandboxBranch ?? null, warnings: [] as string[] }
      : resolveSandboxMode(projectRoot)
    for (const w of policy.warnings) log.info(w)

    if (policy.mode === 'worktree' && policy.branch && t.id) {
      worktree = createWorktree(t.id, policy.branch, projectRoot)
      effectiveRoot = worktree.path
      log.info(`sandbox: worktree created at ${worktree.path} (branch: ${worktree.branch})`)
    } else if (policy.mode === 'worktree') {
      log.info('sandbox: worktree mode selected but no branch/task id — falling back to cwd')
    }

    // -- enrichment chain (S31) ------------------------------------------------
    const ctx = createRunContext(opts)
    ctx.effectiveRoot = effectiveRoot
    ctx.worktree = worktree

    // classify-route (inline — not yet a middleware)
    ctx.taskClass = classifyTask(t.description)
    const route = orcheConfig ? autoRoute(t, orcheConfig, orcheConfigFound ?? false) : null
    ctx.model = modelOverride ?? route?.model ?? resolveModel(ctx.taskClass)
    ctx.providerName = route?.provider ?? t.executor
    ctx.provider = getProvider(ctx.providerName)

    const chain = createChain<RunContext>()
    chain
      .use(memoryFetch)
      .use(skillRoute)
      .use(toolPolicy)
      .use(contextInject)
      .use(instinctApply)

    await chain.run(ctx)

    // constitution-load (inline — not yet a middleware)
    const constitution = loadConstitution(projectRoot)
    ctx.constitutionBlock = buildConstitutionBlock(constitution)
    ctx.constitutionRules = constitution?.ruleCount ?? null
    if (constitution) log.info(`constitution: loaded (${constitution.ruleCount} rules)`)

    // build prompt
    const previousFailure = ctx.task.retry_count > 0 ? ctx.task.retry_reason : undefined
    const { system, userContent } = buildPrompt(
      ctx.task,
      ctx.effectiveContext,
      projectRoot,
      ctx.constitutionBlock,
      ctx.skillInstructions,
      ctx.instinctBlock,
      previousFailure,
    )
    ctx.prompt = { system, userContent }

    // -- dry run ---------------------------------------------------------------
    if (dryRun) {
      const routeInfo = route ? ` [config: ${route.role}]` : ' [legacy router]'
      console.log(`[harness] dry-run - provider: ${ctx.providerName}, model: ${ctx.model}${routeInfo}, system: ${system.length} chars`)
      return { status: 'done', runId: '', filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: Math.round(performance.now() - t0), contextWarnings: [] }
    }

    // -- snapshot before -------------------------------------------------------
    const before = snapshotHashes(ctx.effectiveRoot, ctx.task.output)
    const beforeContent = snapshotContents(ctx.effectiveRoot, ctx.task.output)

    // -- context budget pre-flight (BEFORE calling the LLM) --------------------
    // Decisión 2026-06-30: dejamos de perseguir `max_tokens` — el catálogo de
    // OpenRouter publica `top_provider.max_completion_tokens` como 0/ausente para
    // muchos modelos (ej. deepseek-v4-flash), así que esa ruta caía silenciosamente
    // al default hardcodeado de cada provider (8192) sin avisar — eso fue lo que
    // truncó crear-web-local-comercial a mitad de generación. El dato que sí publica
    // el catálogo de forma confiable es `contextLength` (ventana de contexto real).
    // Lo usamos como única fuente de verdad: max_tokens se DERIVA de
    // (contexto disponible − prompt estimado), nunca de un número adivinado o
    // catalogado por separado. Si ni siquiera entra el prompt con margen razonable
    // para generar algo, la tarea queda `pending` automáticamente — no se intenta
    // ni se gasta una llamada que sabemos de antemano que no va a entrar.
    await ensureCatalogLoaded()
    const promptTokens = estimateTokens(system) + estimateTokens(userContent)
    const contextWindow = contextWindowFor(ctx.model)
    const MIN_OUTPUT_BUDGET = 2048
    // estimateTokens es una aproximación (chars/4), no la tokenización real del
    // proveedor — sin margen, prompts cerca del límite exacto de contextWindow
    // devuelven 400 "maximum context length exceeded" (visto en vivo: estimado
    // 556, real ~46 tokens más, overflow contra ventana de 1048576).
    // Mes 22/E.4 (2026-07-16): 1024 no alcanza cuando el engine agéntico usa
    // tool-calling — los schemas de las tools NO están contados en `promptTokens`
    // (estimateTokens solo ve system+userContent, nunca la lista de tools que
    // runToolLoop adjunta al request real). Reproducido en vivo: prompt
    // estimado ~2001, real 2733 texto + 611 de tool schemas = 3344 → overflow
    // de 400 en un modelo de ventana 1M. Esto NO es el clamp-al-catálogo
    // prohibido por [[feedback-context-no-max-tokens]] (E.1) — sigue siendo
    // 100% derivado de `contextWindow − prompt`, solo con un margen realista
    // para la fuente de error conocida (tool schemas + drift de estimación).
    const SAFETY_MARGIN = 8192
    const availableForOutput = contextWindow - promptTokens - SAFETY_MARGIN
    if (availableForOutput < MIN_OUTPUT_BUDGET) {
      const reason = `context insuficiente: prompt ~${promptTokens} tokens deja sólo ~${Math.max(availableForOutput, 0)} tokens de margen en una ventana de ${contextWindow} (modelo ${ctx.model}) — se necesitan al menos ${MIN_OUTPUT_BUDGET}`
      log.info(`context budget: ${reason} — dejando pending sin llamar al LLM`)
      return { status: 'pending', runId: '', retryReason: reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: Math.round(performance.now() - t0), contextWarnings: ctx.contextWarnings }
    }
    // Base = `contextWindow − prompt` (decisión de Carlos 2026-06-30, "no reabrir":
    // max_tokens NUNCA sale de un tope de catálogo poco confiable; ver
    // feedback-context-no-max-tokens). El único uso legítimo del tope de catálogo
    // es un clamp de SEGURIDAD hacia abajo cuando el proveedor SÍ publica un límite
    // real menor que la ventana (gpt-4o-mini: ventana 128K pero salida real 16384 →
    // sin clamp pedía ~122K y devolvía 400). `knownMaxOutputTokensFor` devuelve 0
    // cuando el catálogo NO lo publica (ej. deepseek-v4-flash) — en ese caso NO se
    // clampa: presupuesto completo de la ventana. Mes 22/E.1: el bug era que la
    // versión anterior usaba `maxOutputTokensFor` (que colapsa 0→8192), topando
    // TODA salida a 8192 y truncando páginas premium a mitad de generación —
    // regresión de la decisión de arriba reintroducida por G.5.
    const providerRealCap = knownMaxOutputTokensFor(ctx.model)
    const maxTokens = providerRealCap > 0 ? Math.min(availableForOutput, providerRealCap) : availableForOutput

    // -- Mes 20 B.2 — auto-split gate ------------------------------------------
    // Si el output estimado supera el 70% del presupuesto real, el LLM se va a
    // cortar a mitad. En vez de intentarlo y fallar, generamos un plan de
    // sub-tareas (reutilizando el generador de function-calling existente) y
    // devolvemos 'split_proposed' para que el caller (CLI o dashboard) pida
    // aprobación antes de gastar.
    if (shouldSplit(ctx.task, maxTokens)) {
      const estimated = ctx.task.output.length * SPLIT_AVG_TOKENS_PER_FILE
      log.info(`auto-split: output estimado ~${estimated} tokens supera ${Math.round(SPLIT_THRESHOLD * 100)}% de maxTokens=${maxTokens} — generando plan de sub-tareas`)

      let subTasks: SubTask[] = []
      try {
        subTasks = await generatePlan(ctx.task.description, ctx.task.id, {
          provider: ctx.providerName,
          model:    ctx.model,
        })
      } catch (e: any) {
        log.info(`auto-split: generatePlan falló (${e.message}) — continuando como single-shot`)
        // fallback: dejar que engine.run() intente la tarea directamente
      }

      if (subTasks.length > 0) {
        // Serializar el plan al formato YAML que createPlan() ya puede consumir
        const planObj = {
          version: 1,
          parent_task_id: ctx.task.id,
          sub_tasks: subTasks.map(st => ({
            id:            st.id,
            description:   st.description,
            acceptance:    st.acceptance,
            depends_on:    st.depends_on,
            allowed_tools: st.allowed_tools,
            ...(st.output    ? { output:    st.output }    : {}),
            ...(st.topic_key ? { topic_key: st.topic_key } : {}),
            ...(st.input     ? { input:     st.input }     : {}),
          })),
        }
        const planYaml = yamlStringify(planObj)
        const planYamlPath = join(projectRoot, `${ctx.task.id}.plan.yaml`)
        writeFileSync(planYamlPath, planYaml, 'utf-8')
        log.info(`auto-split: plan escrito en ${planYamlPath} (${subTasks.length} sub-tareas)`)

        return {
          status: 'split_proposed',
          runId: '',
          planYamlPath,
          plan: subTasks,
          filesWritten: [],
          filesBlocked: [],
          cost: { inputTokens: 0, outputTokens: 0, usd: 0 },
          elapsedMs: Math.round(performance.now() - t0),
          contextWarnings: ctx.contextWarnings,
        }
      }
      // si generatePlan falló → seguir con el engine normal (ya logueado arriba)
    }

    // -- executor engine selection (G.3 / B.2) ---------------------------------
    // Default absoluto 'single-shot' — cero cambio de comportamiento para todo
    // lo existente, agentic y external son opt-in explícitos (por tarea o por
    // config de proyecto). Si se pide agentic pero el modelo no soporta
    // tool-calling, cae a single-shot con aviso — mismo patrón "log y
    // proceder" que la colisión juez==ejecutor de F2.2, no bloquea la tarea.
    // 'external' no consulta tool-calling (el ejecutor es `claude -p`, no la
    // API LLM directa — irrelevant).
    const requestedEngine = ctx.task.engine ?? orcheConfig?.executorEngine ?? 'single-shot'
    let engine: ExecutorEngine = singleShotEngine
    if (requestedEngine === 'agentic') engine = agenticEngine
    else if (requestedEngine === 'external') engine = externalEngine
    if (requestedEngine === 'agentic' && !supportsToolCalling(ctx.providerName, ctx.model)) {
      log.info(`agentic engine requested but ${ctx.providerName}/${ctx.model} does not support tool-calling — falling back to single-shot`)
      engine = singleShotEngine
    }
    const maxIterations = orcheConfig?.agentic?.maxIterations ?? 15
    const externalTimeoutMs = orcheConfig?.external?.timeoutMs

    // -- executor engine run (G.2/G.3) ------------------------------------------
    // single-shot extraído a executors/single-shot.ts — mismo comportamiento,
    // mismo mensaje de error, mismo cálculo de costo. El harness distingue "la
    // llamada al proveedor falló" (costo 0, sin respuesta) de "el proveedor
    // respondió pero el parseo falló" (ya gastó tokens reales) porque F3 exige
    // una fila de evidencia distinta para cada caso — ver comentario en
    // single-shot.ts. El engine agéntico (executors/agentic.ts) nunca lanza
    // ExecutorParseError (no hay paso de parseo — write_file ya entrega
    // FileChange[] directo), así que ese path solo aplica a single-shot.
    let llmResponse: { inputTokens: number; outputTokens: number }
    let cost: number
    let parsed: LLMFileResponse
    let elapsed: number
    // G.4 — persistir cost_breakdown_json en cada fila para que el detalle del run
    // exponga engine + iteraciones. Se setea solo en el success path del try; los
    // dos throws de abajo (parse/LLM call catch) no producen outcome, no hay
    // costByIteration que persistir. Los 4 paths de fallo de abajo (contract,
    // missing, check, QA) sí tienen `outcome` y por eso ya pasan breakdownJson.
    let outcome: ExecutorOutcome | null = null
    try {
      const runOutcome: ExecutorOutcome = await engine.run(ctx, { maxTokens, maxIterations, timeoutMs: externalTimeoutMs })
      outcome = runOutcome
      llmResponse = { inputTokens: runOutcome.inputTokens, outputTokens: runOutcome.outputTokens }
      cost = runOutcome.usd
      parsed = { files: runOutcome.files }
      elapsed = Math.round(performance.now() - t0)
    } catch (e: any) {
      if (e instanceof ExecutorParseError) {
        elapsed = Math.round(performance.now() - t0)
        log.error(`parse error: ${e.message}`)
        const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: null, files_authorized: null, files_blocked: null, snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'failed', input_tokens: e.inputTokens, output_tokens: e.outputTokens, usd_cost: e.usd, elapsed_ms: elapsed, result: e.message })
        return { status: 'failed', runId, retryReason: `parse error: ${e.message}`, filesWritten: [], filesBlocked: [], cost: { inputTokens: e.inputTokens, outputTokens: e.outputTokens, usd: e.usd }, elapsedMs: elapsed, contextWarnings: ctx.contextWarnings }
      }
      // ExecutorLLMCallError (o cualquier otro throw inesperado del engine) — la
      // llamada al proveedor nunca respondió, costo y tokens en cero.
      const elapsedLLM = Math.round(performance.now() - t0)
      log.error(`LLM call failed: ${e.message}`)
      const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: null, files_authorized: null, files_blocked: null, snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'failed', input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: elapsedLLM, result: e.message })
      return { status: 'failed', runId, retryReason: e.message, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: elapsedLLM, contextWarnings: ctx.contextWarnings }
    }
    const breakdownJson = outcome ? costBreakdownToJson(outcome.costByIteration) : null

    // -- contract enforcement --------------------------------------------------
    let contractResult: ReturnType<typeof enforceContract>
    try {
      contractResult = enforceContract(ctx.effectiveRoot, parsed, ctx.task.output)
    } catch (e: any) {
      const attempted = parsed.files.map(f => f.path)
      const blocked = attempted.filter(p => !ctx.task.output.includes(p))
      log.contractViolation(blocked)
      const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(attempted), files_authorized: JSON.stringify(attempted.filter(p => ctx.task.output.includes(p))), files_blocked: JSON.stringify(blocked), snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, cost_breakdown_json: breakdownJson, status: 'blocked', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsed, result: e.message })
      return { status: 'failed', runId, retryReason: `contract violation: ${blocked.join(', ')}`, filesWritten: [], filesBlocked: blocked, cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost }, elapsedMs: elapsed, contextWarnings: ctx.contextWarnings }
    }

    const after = snapshotHashes(ctx.effectiveRoot, ctx.task.output)

    // -- missing declared outputs (BEFORE QA — no tokens spent) ----------------
    // Bug real (2026-06-30, crear-web-local-comercial): enforceContract sólo escribe
    // los archivos que el LLM efectivamente incluyó en su respuesta — si truncó antes
    // de llegar a css/js/README (ej. max_tokens insuficiente), esos paths declarados
    // en `output` simplemente nunca se escriben y nadie lo detecta determinísticamente.
    // El QA-LLM no es confiable para esto: vio la lista de outputs declarados en el
    // prompt y alucinó que estaban "incluidos" sin verificar contra los archivos reales.
    const missingOutputs = ctx.task.output.map(normalizeRelPath).filter(p => !contractResult.written.some(f => f.path === p))
    if (missingOutputs.length > 0) {
      if (!keepWorktree && worktree) {
        mergeWorktreeBack(worktree, 'discard')
        worktree = null
      } else if (!worktree) {
        restoreContents(ctx.effectiveRoot, beforeContent)
      }
      const reason = `missing declared output(s): ${missingOutputs.join(', ')}`
      const elapsedMissing = Math.round(performance.now() - t0)
      const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: reason, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, cost_breakdown_json: breakdownJson, status: 'failed', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsedMissing, result: `${reason} — reverted ${contractResult.written.length} file(s)` })
      log.qaFail(reason, ctx.task.retry_count + 1, MAX_RETRIES)
      const missingExhausted = ctx.task.retry_count + 1 >= MAX_RETRIES
      return {
        status: missingExhausted ? 'failed' : 'retry',
        runId, qaVerdict: 'fail', qaReason: reason, retryReason: reason,
        filesWritten: [], filesBlocked: [],
        cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost },
        elapsedMs: elapsedMissing, contextWarnings: ctx.contextWarnings,
      }
    }

    // -- context-monitor (S27) — post-write, pre-QA --------------------------
    if (shouldCheck(monitorCallCount ?? 0)) {
      // Carga el catálogo real de OpenRouter (cacheado en disco, TTL 24h) para
      // que la ventana de contexto sea la que el proveedor publica, no una
      // adivinanza por nombre. Cae a la tabla de familias si está offline.
      await ensureCatalogLoaded()
      const monitorState: RunState = {
        promptTokens: llmResponse.inputTokens,
        modelContextWindow: contextWindowFor(ctx.model),
        cumulativeCostUsd: cost,
        recentToolCalls: [],   // harness is single-shot; no tool loop
        filesModified: contractResult.written.length,
      }
      for (const w of checkContextHealth(monitorState)) {
        ctx.contextWarnings.push(w)
        log.info(`[context-monitor] ${w.severity.toUpperCase()} ${w.code}: ${w.message}`)
      }
    }

    // -- deterministic checks (BEFORE QA — no tokens spent if check fails) -----
    // D3 finding: a task with no explicit `checks:` only got the LLM QA judge,
    // which approved code that didn't even compile. defaultChecksFor() fills in
    // tsc/bun test for code-output tasks that don't declare their own checks —
    // explicit `checks:` always takes precedence over the defaults.
    const effectiveChecks = ctx.task.checks && ctx.task.checks.length > 0
      ? ctx.task.checks
      : defaultChecksFor(ctx.task.output, ctx.effectiveRoot)
    let checksResults: CheckResult[] = []
    if (effectiveChecks.length > 0) {
      checksResults = await runChecks(effectiveChecks, ctx.effectiveRoot, log)
      const firstFail = checksResults.find(r => r.exitCode !== (effectiveChecks.find(c => c.cmd === r.cmd)?.expect_exit ?? 0) || r.timedOut)
      if (firstFail) {
        if (!keepWorktree && worktree) {
          mergeWorktreeBack(worktree, 'discard')
          worktree = null
        } else if (!worktree) {
          restoreContents(ctx.effectiveRoot, beforeContent)
        }
        const reason = firstFail.timedOut
          ? `check timed out: ${firstFail.cmd}`
          : `check failed: ${firstFail.cmd} exit ${firstFail.exitCode}`
        const elapsedCheck = Math.round(performance.now() - t0)
        const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: reason, checks_json: JSON.stringify(checksResults), constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, cost_breakdown_json: breakdownJson, status: 'failed', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsedCheck, result: `check fail — reverted ${contractResult.written.length} file(s)` })
        log.qaFail(reason, ctx.task.retry_count + 1, MAX_RETRIES)
        // D3 follow-up: this unconditionally returned 'retry' regardless of how many
        // times the task had already failed — a persistently failing check (e.g. tsc
        // never passing) looped past MAX_RETRIES indefinitely (observed: "retry 14/3"),
        // only stopped by the circuit breaker's wall-clock/cost cap, not by exhaustion.
        // Same exhaustion check as the QA-fail path below: cap at MAX_RETRIES so the
        // graph runner can mark it failed_permanent and block the branch like normal.
        const checksExhausted = ctx.task.retry_count + 1 >= MAX_RETRIES
        return {
          status: checksExhausted ? 'failed' : 'retry',
          runId, qaVerdict: 'fail', qaReason: reason, retryReason: reason,
          filesWritten: [], filesBlocked: [],
          cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost },
          elapsedMs: elapsedCheck, contextWarnings: ctx.contextWarnings,
        }
      }
    }

    // -- QA stage (LLM) --------------------------------------------------------
    const qaJudge = resolveQAJudge(ctx.providerName, ctx.model, orcheConfig, log)
    let qa: Awaited<ReturnType<typeof runQA>>
    try {
      qa = await runQA({ description: ctx.task.description, output: ctx.task.output, written: contractResult.written, model: qaJudge.model, acceptance_criteria: ctx.task.acceptance_criteria, provider: qaJudge.provider })
    } catch (e: any) {
      qa = { verdict: 'fail' as const, reason: `QA call error: ${e.message}`, inputTokens: 0, outputTokens: 0, model: qaJudge.model }
    }

    const qaCost = calcCost(qa.model, qa.inputTokens, qa.outputTokens)
    const totalCost = cost + qaCost
    const totalElapsed = Math.round(performance.now() - t0)
    const totalTokens = { inputTokens: llmResponse.inputTokens + qa.inputTokens, outputTokens: llmResponse.outputTokens + qa.outputTokens }

    if (qa.verdict === 'fail') {
      if (!keepWorktree && worktree) {
        mergeWorktreeBack(worktree, 'discard')
        worktree = null
      } else if (!worktree) {
        restoreContents(ctx.effectiveRoot, beforeContent)
      }
      const retryCount = ctx.task.retry_count + 1
      const newStatus = retryCount >= MAX_RETRIES ? 'failed_permanent' : 'pending'

      const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: qa.reason, qa_model: qa.model, checks_json: checksResults.length ? JSON.stringify(checksResults) : null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, cost_breakdown_json: breakdownJson, status: 'failed', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `QA fail - reverted ${contractResult.written.length} file(s)` })

      if (newStatus === 'failed_permanent') {
        log.failedPermanent(qa.reason)
        return { status: 'failed', runId, qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed, contextWarnings: ctx.contextWarnings }
      }
      log.qaFail(qa.reason, retryCount, MAX_RETRIES)
      return { status: 'retry', runId, qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed, contextWarnings: ctx.contextWarnings }
    }

    // -- success: merge worktree back (if applicable) --------------------------
    if (worktree) {
      const mergedBranch = worktree.branch
      mergeWorktreeBack(worktree, 'commit', `orchestos(${ctx.task.id}): ${ctx.task.description.slice(0, 72)}`)
      worktree = null
      log.info(`sandbox: merged ${mergedBranch} into ${sandboxBranch ?? ''}`)
    }

    // v0.12/C.2 — visor de diff (docs/diff-review-design.md): solo en el camino de éxito,
    // los caminos de fallo revierten el contenido (restoreContents) así que "lo que cambió"
    // no sobrevive y no tiene valor de revisión.
    const fileDiffs = computeFileDiffs(beforeContent, contractResult.written)

    const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'pass', qa_reason: qa.reason, qa_model: qa.model, checks_json: checksResults.length ? JSON.stringify(checksResults) : null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, cost_breakdown_json: breakdownJson, file_diffs: fileDiffs.length ? JSON.stringify(fileDiffs) : null, status: 'done', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `${contractResult.written.length} file(s) written` })

    log.qaPass(qa.reason)
    log.done()

    return {
      status: 'done',
      runId,
      qaVerdict: 'pass',
      qaReason: qa.reason,
      filesWritten: contractResult.written.map(f => f.path),
      filesBlocked: contractResult.filesBlocked,
      cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost },
      elapsedMs: totalElapsed,
      contextWarnings: ctx.contextWarnings,
    }

  } catch (e: any) {
    // S9.4 - catch-all: cualquier excepcion no prevista -> status failed, nunca lanza
    const elapsed = Math.round(performance.now() - t0)
    log.error(`unexpected error: ${e.message}`)
    return { status: 'failed', runId: '', retryReason: `unexpected: ${e.message}`, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: elapsed, contextWarnings: [] }
  } finally {
    // cleanup worktree if still alive (not merged, not discarded)
    if (worktree && !keepWorktree) {
      try { mergeWorktreeBack(worktree, 'discard') } catch {}
    }
  }
}
