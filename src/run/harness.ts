/**
 * src/run/harness.ts
 *
 * Ejecuta una tarea individual. Recibe contexto ya preparado por cli.ts y
 * devuelve un TaskResult sin lanzar — cualquier excepción queda en status: 'failed'.
 *
 * Flujo: classify → resolveModel → buildPrompt → chat → parse →
 *        enforceContract → write → QA → revert (si fail) → insertRun → TaskResult
 *
 * cli.ts es responsable de: cargar la tarea, verificar dependencias, marcar
 * 'running', abrir el logger, llamar runTask y mapear TaskResult a updateTaskStatus.
 */

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { classifyTask } from '../router/classify.ts'
import { resolveModel } from '../router/models.ts'
import { calcCost } from '../router/pricing.ts'
import { chat } from '../providers/openrouter.ts'
import { parseLLMResponse, enforceContract, snapshotHashes } from './contract.ts'
import { runQA, snapshotContents, restoreContents, MAX_RETRIES } from './qa.ts'
import { RunLogger } from './logger.ts'
import { insertRun } from '../db/runs.ts'
import { loadSkill, getSkillPath } from '../skills/registry.ts'
import type { Task } from '../tasks/schema.ts'

// ── public types ──────────────────────────────────────────────────────────────

export interface HarnessOpts {
  /** Ruta absoluta al proyecto objetivo */
  projectRoot: string
  /** Contenido de AGENTS.md + context.json renderizado como texto (de loadContext) */
  contextText: string
  /** Tarea ya validada, con dependencias verificadas */
  task: Task
  /** Logger ya abierto para esta tarea */
  logger: RunLogger
  /** Si true, construye el prompt pero no llama al LLM ni escribe archivos */
  dryRun?: boolean
  /** Sobrescribe el modelo inferido por el router */
  modelOverride?: string
}

export interface TaskResult {
  status: 'done' | 'retry' | 'failed' | 'blocked'
  /** ID del run insertado en SQLite (vacío si dryRun o fallo antes de insertar) */
  runId: string
  qaVerdict?: 'pass' | 'fail'
  qaReason?: string
  /** Razón del fallo o retry — para pasarla a updateTaskStatus como retry_reason */
  retryReason?: string
  filesWritten: string[]
  filesBlocked: string[]
  cost: { inputTokens: number; outputTokens: number; usd: number }
  elapsedMs: number
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function runTask(opts: HarnessOpts): Promise<TaskResult> {
  const { projectRoot, contextText, task: t, logger: log, dryRun, modelOverride } = opts
  const t0 = performance.now()

  try {
    const taskClass = classifyTask(t.description)
    const model     = modelOverride ?? resolveModel(taskClass)

    // ── build prompt ──────────────────────────────────────────────────────────
    let skillGuidelines = ''
    if (t.skill) {
      try {
        const s = loadSkill(getSkillPath(t.skill))
        skillGuidelines = `\n## SKILL GUIDELINES: ${s.name}\n${s.instructions}\n`
      } catch { /* skill not found, continue without guidelines */ }
    }

    const system = [
      contextText || '# Project context\nNo AGENTS.md found.',
      skillGuidelines,
      `\n## OUTPUT CONTRACT`,
      `You may ONLY write to these files: ${t.output.join(', ')}`,
      `Respond with ONLY valid JSON — no markdown, no explanation:`,
      `{ "files": [{ "path": "relative/path", "content": "full file content" }] }`,
    ].join('\n')

    let userContent = `Task: ${t.description}\n`
    for (const f of t.input) {
      const full = join(projectRoot, f)
      if (existsSync(full)) {
        userContent += `\n### ${f}\n\`\`\`\n${readFileSync(full, 'utf-8')}\n\`\`\`\n`
      }
    }

    // ── dry run ───────────────────────────────────────────────────────────────
    if (dryRun) {
      console.log(`[harness] dry-run — model: ${model}, system: ${system.length} chars`)
      return { status: 'done', runId: '', filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: Math.round(performance.now() - t0) }
    }

    // ── snapshot before ───────────────────────────────────────────────────────
    const before        = snapshotHashes(projectRoot, t.output)
    const beforeContent = snapshotContents(projectRoot, t.output)

    // ── LLM call ──────────────────────────────────────────────────────────────
    let llmResponse: Awaited<ReturnType<typeof chat>>
    try {
      llmResponse = await chat({ model, system, messages: [{ role: 'user', content: userContent }] })
    } catch (e: any) {
      log.error(`LLM call failed: ${e.message}`)
      return { status: 'failed', runId: '', retryReason: e.message, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: Math.round(performance.now() - t0) }
    }

    const elapsed = Math.round(performance.now() - t0)
    const cost    = calcCost(model, llmResponse.inputTokens, llmResponse.outputTokens)

    // ── parse ─────────────────────────────────────────────────────────────────
    let parsed: ReturnType<typeof parseLLMResponse>
    try {
      parsed = parseLLMResponse(llmResponse.text)
    } catch (e: any) {
      log.error(`parse error: ${e.message}`)
      insertRun({ project_id: null, prompt: t.description, task_class: taskClass, model, provider: 'openrouter', skill_id: t.skill ?? null, task_id: t.id, allowed_outputs: JSON.stringify(t.output), files_attempted: null, files_authorized: null, files_blocked: null, snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, status: 'failed', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsed, result: e.message })
      return { status: 'failed', runId: '', retryReason: `parse error: ${e.message}`, filesWritten: [], filesBlocked: [], cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost }, elapsedMs: elapsed }
    }

    // ── contract enforcement ──────────────────────────────────────────────────
    let contractResult: ReturnType<typeof enforceContract>
    try {
      contractResult = enforceContract(projectRoot, parsed, t.output)
    } catch (e: any) {
      const attempted = parsed.files.map(f => f.path)
      const blocked   = attempted.filter(p => !t.output.includes(p))
      log.contractViolation(blocked)
      insertRun({ project_id: null, prompt: t.description, task_class: taskClass, model, provider: 'openrouter', skill_id: t.skill ?? null, task_id: t.id, allowed_outputs: JSON.stringify(t.output), files_attempted: JSON.stringify(attempted), files_authorized: JSON.stringify(attempted.filter(p => t.output.includes(p))), files_blocked: JSON.stringify(blocked), snapshot_before: JSON.stringify(before), snapshot_after: null, qa_verdict: null, qa_reason: null, status: 'blocked', input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens, usd_cost: cost, elapsed_ms: elapsed, result: e.message })
      return { status: 'failed', runId: '', retryReason: `contract violation: ${blocked.join(', ')}`, filesWritten: [], filesBlocked: blocked, cost: { inputTokens: llmResponse.inputTokens, outputTokens: llmResponse.outputTokens, usd: cost }, elapsedMs: elapsed }
    }

    const after = snapshotHashes(projectRoot, t.output)

    // ── QA stage ──────────────────────────────────────────────────────────────
    let qa: Awaited<ReturnType<typeof runQA>>
    try {
      qa = await runQA({ description: t.description, output: t.output, written: contractResult.written, model })
    } catch (e: any) {
      qa = { verdict: 'fail' as const, reason: `QA call error: ${e.message}`, inputTokens: 0, outputTokens: 0, model }
    }

    const qaCost       = calcCost(qa.model, qa.inputTokens, qa.outputTokens)
    const totalCost    = cost + qaCost
    const totalElapsed = Math.round(performance.now() - t0)
    const totalTokens  = { inputTokens: llmResponse.inputTokens + qa.inputTokens, outputTokens: llmResponse.outputTokens + qa.outputTokens }

    if (qa.verdict === 'fail') {
      restoreContents(projectRoot, beforeContent)
      const retryCount = t.retry_count + 1
      const newStatus  = retryCount >= MAX_RETRIES ? 'failed_permanent' : 'pending'

      insertRun({ project_id: null, prompt: t.description, task_class: taskClass, model, provider: 'openrouter', skill_id: t.skill ?? null, task_id: t.id, allowed_outputs: JSON.stringify(t.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'fail', qa_reason: qa.reason, status: 'failed', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `QA fail — reverted ${contractResult.written.length} file(s)` })

      if (newStatus === 'failed_permanent') {
        log.failedPermanent(qa.reason)
        return { status: 'failed', runId: '', qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed }
      }
      log.qaFail(qa.reason, retryCount, MAX_RETRIES)
      return { status: 'retry', runId: '', qaVerdict: 'fail', qaReason: qa.reason, retryReason: qa.reason, filesWritten: [], filesBlocked: [], cost: { inputTokens: totalTokens.inputTokens, outputTokens: totalTokens.outputTokens, usd: totalCost }, elapsedMs: totalElapsed }
    }

    // ── success ───────────────────────────────────────────────────────────────
    const runId = insertRun({ project_id: null, prompt: t.description, task_class: taskClass, model, provider: 'openrouter', skill_id: t.skill ?? null, task_id: t.id, allowed_outputs: JSON.stringify(t.output), files_attempted: JSON.stringify(contractResult.filesAttempted), files_authorized: JSON.stringify(contractResult.filesAuthorized), files_blocked: JSON.stringify(contractResult.filesBlocked), snapshot_before: JSON.stringify(before), snapshot_after: JSON.stringify(after), qa_verdict: 'pass', qa_reason: qa.reason, status: 'done', input_tokens: totalTokens.inputTokens, output_tokens: totalTokens.outputTokens, usd_cost: totalCost, elapsed_ms: totalElapsed, result: `${contractResult.written.length} file(s) written` })

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
    }

  } catch (e: any) {
    // S9.4 — catch-all: cualquier excepción no prevista → status failed, nunca lanza
    const elapsed = Math.round(performance.now() - t0)
    log.error(`unexpected error: ${e.message}`)
    return { status: 'failed', runId: '', retryReason: `unexpected: ${e.message}`, filesWritten: [], filesBlocked: [], cost: { inputTokens: 0, outputTokens: 0, usd: 0 }, elapsedMs: elapsed }
  }
}
