import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

const GATE_ROLES = ['orchestrator', 'executor', 'reviewer', 'auxiliary']

export function cleanOldUiGateDirs(tmpdir, now, maxAgeMs) {
  let cleaned = 0
  let entries
  try {
    entries = readdirSync(tmpdir, { withFileTypes: true })
  } catch {
    return cleaned
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('ui-gate-')) continue
    const dir = join(tmpdir, entry.name)
    try {
      if (now - statSync(dir).mtimeMs <= maxAgeMs) continue
      rmSync(dir, { recursive: true, force: true })
      cleaned++
    } catch {}
  }
  return cleaned
}

export function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

export function describeFlowError(error) {
  const message = stripAnsi(error instanceof Error ? error.message : String(error))
  const lines = message.split(/\r?\n/)
  const firstLine = lines.find((line) => line.trim()) ?? ''
  const waitingLines = lines
    .map((line) => line.trim().replace(/^-\s*/, ''))
    .filter((line) => line.startsWith('waiting for '))
  const lastWaiting = waitingLines.at(-1)
  return lastWaiting ? `${firstLine} [${lastWaiting}]` : firstLine
}

export function writeGateRoles(projectRoot) {
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = existsSync(configPath) ? (yamlParse(readFileSync(configPath, 'utf8')) ?? {}) : {}
  config.roles = Object.fromEntries(
    GATE_ROLES.map((role) => [role, { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' }]),
  )
  writeFileSync(configPath, yamlStringify(config))
}

export function lintFlowSource(source) {
  if (/window\.(?:OrchestOS|state)\b/.test(source)) {
    return 'navega por window'
  }

  if (/page\.evaluate\([\s\S]{0,500}(?:location|history)/.test(source)) {
    return 'navega por window'
  }

  // R.8.6 — `step(nombre, true, …)` no puede fallar: inflaría el N/N. Diagnóstico va en `note`.
  if (/\bstep\(\s*(?:`[^`]*`|'[^']*'|"[^"]*")\s*,\s*true\b/.test(source)) {
    return 'step con condición literal true (usar note o una aserción real)'
  }

  return null
}

export function formatResult(result) {
  const passed = result.steps.filter((step) => step.ok).length
  if (result.pass) return `PASS ${result.flujo} ${passed}/${result.steps.length}`

  const failed = result.steps.find((step) => !step.ok)
  const step = failed?.nombre ?? 'flow'
  const detail = failed?.detalle ?? result.errores[0] ?? 'unknown error'
  return `FAIL ${result.flujo}: ${step}: ${detail}`
}

export function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(-600)
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${error.status ?? 'n/a'}): ${detail || 'sin salida'}`,
    )
  }
}

export async function waitTurnSettled(api, projectId, sessionId, knownTurnIds, timeout) {
  const deadline = Date.now() + timeout
  let turn
  do {
    const response = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/timeline`, {
      headers: { 'x-orchestos-project-id': projectId },
    })
    if (response.status !== 200) throw new Error(`Chat timeline returned HTTP ${response.status}`)
    const newTurns = response.data?.turns?.filter((item) => !knownTurnIds.has(item.id)) ?? []
    turn = newTurns.find((item) => item.settled != null) ?? newTurns.at(-1)
    if (turn?.settled != null) return { turnId: turn.id, settled: turn.settled }
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await delay(Math.min(1_000, remaining))
  } while (Date.now() <= deadline)
  throw new Error(
    `Timed out waiting for chat turn to settle: newTurn=${Boolean(turn)} turnId=${turn?.id ?? 'none'} status=${turn?.status ?? 'missing'}`,
  )
}

export async function waitLaunchSettled(api, projectId, taskId, previousLaunchId, timeout) {
  const deadline = Date.now() + timeout
  let task
  do {
    const response = await api('/api/tasks', {
      headers: { 'x-orchestos-project-id': projectId },
    })
    if (response.status !== 200) throw new Error(`Task list returned HTTP ${response.status}`)
    task = response.data?.tasks?.find((item) => item.id === taskId)
    if (task?.launch && task.launch.id !== previousLaunchId && task.launch.settled != null)
      return task.launch
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await delay(Math.min(1_000, remaining))
  } while (Date.now() <= deadline)
  throw new Error(
    `Timed out waiting for task launch to settle: newLaunch=${Boolean(task?.launch && task.launch.id !== previousLaunchId)} launchId=${task?.launch?.id ?? 'none'} status=${task?.status ?? 'missing'} settled=${JSON.stringify(task?.launch?.settled ?? null)}`,
  )
}
