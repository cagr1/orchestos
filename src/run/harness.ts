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
import { getProvider } from '../providers/index.ts'
import { autoRoute } from '../router/auto-route.ts'
import type { OrcheConfig } from '../config/schema.ts'
import { loadConstitution, buildConstitutionBlock } from '../spec/constitution.ts'
import { parseLLMResponse, enforceContract, snapshotHashes } from './contract.ts'
import { runQA, snapshotContents, restoreContents, MAX_RETRIES } from './qa.ts'
import { RunLogger } from './logger.ts'
import { insertRun } from '../db/runs.ts'
import { buildPrompt } from './prompt.ts'
import { runChecks, defaultChecksFor, type CheckResult } from './checks.ts'
import { createWorktree, mergeWorktreeBack } from './sandbox.ts'
import { resolveSandboxMode, type SandboxMode } from './sandbox-policy.ts'
import { loadSpec } from '../spec/store.ts'
import { checkContextHealth, shouldCheck, type RunState } from '../hooks/context-monitor.ts'
import { ensureCatalogLoaded, contextWindowFor } from '../router/model-catalog.ts'
import { createRunContext, createChain, type RunContext } from './middleware.ts'
import { contextInject, skillRoute, memoryFetch, toolPolicy, instinctApply } from './middlewares/index.ts'
import type { Task } from '../tasks/schema.ts'
import type { Worktree } from './sandbox.ts'
import type { ContextWarning } from '../hooks/context-monitor.ts'

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
  status: 'done' | 'retry' | 'failed' | 'blocked'
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
}

// -- main ----------------------------------------------------------------------

export async function runTask(opts: HarnessOpts): Promise<TaskResult> {
  const { projectRoot, task: t, projectId: _projectId, logger: log, dryRun, modelOverride, orcheConfig, orcheConfigFound, sandboxMode, sandboxBranch, keepWorktree, monitorCallCount } = opts
  const t0 = performance.now()

  // -- spec gate ---------------------------------------------------------------
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

  let worktree: Worktree | null = null
  let effectiveRoot = projectRoot

  if (policy.mode === 'worktree' && policy.branch && t.id) {
    worktree = createWorktree(t.id, policy.branch, projectRoot)
    effectiveRoot = worktree.path
    log.info(`sandbox: worktree created at ${worktree.path} (branch: ${worktree.branch})`)
  } else if (policy.mode === 'worktree') {
    log.info('sandbox: worktree mode selected but no branch/task id — falling back to cwd')
  }

  try {
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
    const { system, userContent } = buildPrompt(
      ctx.task,
      ctx.effectiveContext,
      projectRoot,
      ctx.constitutionBlock,
      ctx.skillInstructions,
      ctx.instinctBlock,
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

    // -- LLM call --------------------------------------------------------------
    let llmResponse: Awaited<ReturnType<typeof ctx.provider.chat>>
    try {
      llmResponse = await ctx.provider.chat({ model: ctx.model, system, messages: [{ role: 'user', content: userContent }] })
    } catch (e: any) {
      log.error(`LLM call failed: ${e.message}`)
      return { status: 'failed', runId: '', retryReason: e.message, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: Math.round(performance.now() - t0), contextWarnings: [] }
    }

    const elapsed = Math.round(performance.now() - t0)
    const cost = calcCost(ctx.model, llmResponse.inputTokens, llmResponse.outputTokens)

    // -- parse -----------------------------------------------------------------
    let parsed: ReturnType<typeof parseLLMResponse>
    try {
      parsed = parseLLMResponse(llmResponse.text)
    } catch (e: any) {
      log.error(`parse error: ${e.message}`)
      insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: null, files_authorized: null, files_blocked: null, snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'failed', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsed, result: e.message })
      return { status: 'failed', runId: '', retryReason: `parse error: ${e.message}`, filesWritten: [], filesBlocked: [], cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost }, elapsedMs: elapsed, contextWarnings: ctx.contextWarnings }
    }

    // -- contract enforcement --------------------------------------------------
    let contractResult: ReturnType<typeof enforceContract>
    try {
      contractResult = enforceContract(ctx.effectiveRoot, parsed, ctx.task.output)
    } catch (e: any) {
      const attempted = parsed.files.map(f => f.path)
      const blocked = attempted.filter(p => !ctx.task.output.includes(p))
      log.contractViolation(blocked)
      insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(attempted), files_authorized: JSON.stringify(attempted.filter(p => ctx.task.output.includes(p))), files_blocked: JSON.stringify(blocked), snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'blocked', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsed, result: e.message })
      return { status: 'failed', runId: '', retryReason: `contract violation: ${blocked.join(', ')}`, filesWritten: [], filesBlocked: blocked, cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost }, elapsedMs: elapsed, contextWarnings: ctx.contextWarnings }
    }

    const after = snapshotHashes(ctx.effectiveRoot, ctx.task.output)

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
        insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: reason, checks_json: JSON.stringify(checksResults), constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'failed', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsedCheck, result: `check fail — reverted ${contractResult.written.length} file(s)` })
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
          runId: '', qaVerdict: 'fail', qaReason: reason, retryReason: reason,
          filesWritten: [], filesBlocked: [],
          cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost },
          elapsedMs: elapsedCheck, contextWarnings: ctx.contextWarnings,
        }
      }
    }

    // -- QA stage (LLM) --------------------------------------------------------
    let qa: Awaited<ReturnType<typeof runQA>>
    try {
      qa = await runQA({ description: ctx.task.description, output: ctx.task.output, written: contractResult.written, model: ctx.model, acceptance_criteria: ctx.task.acceptance_criteria, provider: ctx.provider })
    } catch (e: any) {
      qa = { verdict: 'fail' as const, reason: `QA call error: ${e.message}`, inputTokens: 0, outputTokens: 0, model: ctx.model }
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

      insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: qa.reason, checks_json: checksResults.length ? JSON.stringify(checksResults) : null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'failed', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `QA fail - reverted ${contractResult.written.length} file(s)` })

      if (newStatus === 'failed_permanent') {
        log.failedPermanent(qa.reason)
        return { status: 'failed', runId: '', qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed, contextWarnings: ctx.contextWarnings }
      }
      log.qaFail(qa.reason, retryCount, MAX_RETRIES)
      return { status: 'retry', runId: '', qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed, contextWarnings: ctx.contextWarnings }
    }

    // -- success: merge worktree back (if applicable) --------------------------
    if (worktree) {
      const mergedBranch = worktree.branch
      mergeWorktreeBack(worktree, 'commit', `orchestos(${ctx.task.id}): ${ctx.task.description.slice(0, 72)}`)
      worktree = null
      log.info(`sandbox: merged ${mergedBranch} into ${sandboxBranch ?? ''}`)
    }

    const runId = insertRun({ project_id: null, prompt: ctx.task.description, task_class: ctx.taskClass, model: ctx.model, provider: ctx.provider.name, skill_id: ctx.task.skill ?? null, task_id: ctx.task.id, allowed_outputs: JSON.stringify(ctx.task.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'pass', qa_reason: qa.reason, checks_json: checksResults.length ? JSON.stringify(checksResults) : null, constitution_rules: ctx.constitutionRules, context_source: ctx.contextSource, context_tokens: ctx.contextTokens, embed_hits: ctx.embedHits, context_warnings_json: ctx.contextWarnings.length ? JSON.stringify(ctx.contextWarnings) : null, status: 'done', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `${contractResult.written.length} file(s) written` })

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
