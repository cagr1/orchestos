import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { diagnoseTask } from '../../agents/diagnose.ts'
import { parsePlan } from '../../agents/planner.ts'
import { loadOrcheConfig } from '../../config/load.ts'
import type { AgentChoice } from '../../config/schema.ts'
import { getProject } from '../../db/projects.ts'
import { getRunSteps } from '../../db/run-steps.ts'
import { suggestContext } from '../../graph/suggest.ts'
import { autoRoute } from '../../router/auto-route.ts'
import { classifyTask } from '../../router/classify.ts'
import {
  resolveAgentSelection,
  resolveCascadeTier,
  resolveProjectAgentRule,
} from '../../router/engine-cascade.ts'
import { detectInstalledClis, KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { withGitLock } from '../../run/git-lock.ts'
import { git } from '../../run/sandbox.ts'
import { isKnownSkillId } from '../../skills/catalog.ts'
import { loadConstitution } from '../../spec/constitution.ts'
import { scaffoldTasksYaml } from '../../tasks/init.ts'
import { loadTasks, saveTasks } from '../../tasks/loader.ts'
import { CLI_EFFORT_LEVELS } from '../../tasks/schema.ts'
import { errorResponse, jsonResponse, validateTaskId } from '../http.ts'
import type { DiagnoseRow, SplitPlanResponse, TaskRow } from '../types.ts'

async function handleApiSystemExecutorModes(root = process.cwd()): Promise<Response> {
  let localDetected = false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 800)
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    clearTimeout(timer)
    localDetected = res.ok
  } catch {}

  // CC.D1 (2026-08-17) — `executor_mode`/valores `cli-*` renombrados a `agent`
  // (`claude`/`opencode`/`codex`, sin el prefijo `cli-` redundante).
  const detectedClis = detectInstalledClis()
  const cliById = new Map(detectedClis.map((cli) => [cli.id, cli]))
  const modes: { id: AgentChoice; label: string; detected: boolean; path: string | null; readBoundary?: string }[] = [
    { id: 'local', label: 'Local (Ollama)', detected: localDetected, path: null },
    {
      id: 'claude',
      label: cliById.get('claude')?.label ?? 'Claude Code',
      detected: cliById.get('claude')?.installed ?? false,
      path: cliById.get('claude')?.path ?? null,
      readBoundary: KNOWN_CLIS.find((cli) => cli.id === 'claude')?.readBoundary.kind,
    },
    {
      id: 'opencode',
      label: cliById.get('opencode')?.label ?? 'opencode',
      detected: cliById.get('opencode')?.installed ?? false,
      path: cliById.get('opencode')?.path ?? null,
      readBoundary: KNOWN_CLIS.find((cli) => cli.id === 'opencode')?.readBoundary.kind,
    },
    {
      id: 'codex',
      label: cliById.get('codex')?.label ?? 'Codex',
      detected: cliById.get('codex')?.installed ?? false,
      path: cliById.get('codex')?.path ?? null,
      readBoundary: KNOWN_CLIS.find((cli) => cli.id === 'codex')?.readBoundary.kind,
    },
    { id: 'api', label: 'OpenRouter API', detected: true, path: null },
  ]

  return jsonResponse({ modes, selected: loadOrcheConfig(root).agent ?? null })
}

/** Shared by /api/tasks and /api/run/graph/status — both need the live tasks.yaml view. */
function loadTaskRows(root: string): TaskRow[] {
  if (!existsSync(join(root, 'tasks.yaml'))) return []
  try {
    const file = loadTasks(root)
    return file.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      status: t.status,
      skill: t.skill ?? null,
      executor: t.executor,
      retryCount: t.retry_count,
      qaVerdict: t.qa_verdict ?? null,
      runId: t.run_id ?? null,
      engine: t.engine ?? null,
      hasSplitPlan: existsSync(join(root, `${t.id}.plan.yaml`)),
    }))
  } catch {
    return []
  }
}

/**
 * v0.12 / Bloque D.1.a — GET /api/tasks ahora devuelve un wrapper
 * `{ exists, tasks, error? }` en vez de un array pelado, para que el frontend
 * pueda distinguir 3 estados que antes colapsaban a "lista vacía":
 *   - `exists:false` → el archivo no existe (D.1.a — antes era indistinguible)
 *   - `exists:true, tasks:[]` → archivo existe pero está vacío
 *   - `exists:true, tasks:[...], error?` → archivo existe pero está malformado
 *     (el `error` viene del loader; las `tasks` se devuelven como [] en ese caso)
 * Es un breaking change para los 2 consumidores internos (app.js:343 y
 * tasks.html:52) — ambos se actualizan en este mismo bloque.
 *
 * NOTA: usamos `loadTasks()` directamente en vez de `loadTaskRows()` (que
 * traga el error internamente) — necesitamos exponer el error de parseo al
 * frontend para que pueda mostrar el mensaje real en vez de un "no hay
 * tareas" engañoso. `loadTaskRows()` se sigue usando en otros sitios (graph
 * runner) que sí quieren tragarse el error.
 */
function handleApiTasks(root: string): Response {
  const tasksYamlPath = join(root, 'tasks.yaml')
  if (!existsSync(tasksYamlPath)) {
    return jsonResponse({ exists: false, tasks: [] })
  }
  try {
    const file = loadTasks(root)
    const rows: TaskRow[] = file.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      status: t.status,
      skill: t.skill ?? null,
      executor: t.executor,
      retryCount: t.retry_count,
      qaVerdict: t.qa_verdict ?? null,
      runId: t.run_id ?? null,
      engine: t.engine ?? null,
      hasSplitPlan: existsSync(join(root, `${t.id}.plan.yaml`)),
    }))
    return jsonResponse({ exists: true, tasks: rows })
  } catch (e: any) {
    return jsonResponse({ exists: true, tasks: [], error: e.message })
  }
}

/**
 * v0.12 / Bloque D.1.a — POST /api/tasks/init
 * Crea el primer `tasks.yaml` con 2 tareas starter basadas en el stack
 * detectado. Devuelve 409 si el archivo ya existe (no se sobreescribe), 500
 * en cualquier otro fallo. La lógica de scaffold vive en `src/tasks/init.ts`
 * para que el CLI `orchestos task init` y este endpoint compartan el mismo
 * código.
 */
async function handleApiTasksInit(root: string): Promise<Response> {
  try {
    const result = await scaffoldTasksYaml(root)
    return jsonResponse({
      ok: true,
      path: result.path,
      project: result.project,
      framework: result.framework,
      runtime: result.runtime,
      taskIds: result.taskIds,
    })
  } catch (e: any) {
    if (/already exists/i.test(e.message)) {
      return errorResponse(e.message, 409)
    }
    return errorResponse(e.message, 500)
  }
}

function descToTaskId(desc: string): string {
  return (
    desc
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-') || 'task'
  )
}

function inferExecutorFromModel(modelId: string | undefined): string {
  if (!modelId) return 'openrouter'
  if (/^ollama\//.test(modelId)) return 'ollama'
  if (/^claude-/.test(modelId)) return 'anthropic'
  if (/^(gpt-|o1-|o3-|text-)/.test(modelId)) return 'openai'
  return 'openrouter'
}

// O.2 — la implementación vive en skills/catalog.ts (la necesita también el
// camino de sub-tareas del planner). Acá se re-exporta, misma API.

export interface CreateTaskParams {
  id?: string
  description: string
  output?: string[]
  executor?: string
  executor_model?: string
  engine?: string
  cli_effort?: string
  skill?: string
}

// D.7 (Mes 22) — extraído de handleApiTasksCreate para que el auto-flow del
// chat (creates tasks sin pasar por una Request HTTP) reuse exactamente la
// misma lógica (dedupe de id, commit del sandbox, etc.) en vez de duplicarla.
function createTaskRecord(
  root: string,
  params: CreateTaskParams,
): { id: string } | { error: string; status: number } {
  if (!params.description?.trim()) return { error: 'description is required', status: 400 }
  const description = params.description.trim()
  const id = params.id?.trim() || descToTaskId(description)
  const output = Array.isArray(params.output) ? params.output : []
  const executorModel = params.executor_model?.trim() || undefined
  const executor = params.executor || inferExecutorFromModel(executorModel)
  const engineRaw = params.engine?.trim()
  let engine: 'single-shot' | 'agentic' | 'external' | 'opencode' | 'codex' | undefined
  if (
    engineRaw === 'single-shot' ||
    engineRaw === 'agentic' ||
    engineRaw === 'external' ||
    engineRaw === 'opencode' ||
    engineRaw === 'codex'
  )
    engine = engineRaw
  else if (engineRaw && engineRaw.length > 0)
    return {
      error: `unknown engine '${engineRaw}' — allowed: single-shot, agentic, external, opencode, codex`,
      status: 400,
    }
  const cliEffortRaw = params.cli_effort?.trim()
  const effortLevels = engine
    ? CLI_EFFORT_LEVELS[engine as keyof typeof CLI_EFFORT_LEVELS]
    : undefined
  if (cliEffortRaw && (!effortLevels || !(effortLevels as readonly string[]).includes(cliEffortRaw)))
    return {
      error: effortLevels
        ? `unknown cli_effort '${cliEffortRaw}' for engine '${engine}' — allowed: ${effortLevels.join(', ')}`
        : `cli_effort requires an engine with declared levels — allowed engines: ${Object.keys(CLI_EFFORT_LEVELS).join(', ')}`,
      status: 400,
    }
  const cliEffort = cliEffortRaw || undefined
  if (!existsSync(join(root, 'tasks.yaml')))
    return { error: 'tasks.yaml not found — run: orchestos task init', status: 404 }
  try {
    const file = loadTasks(root)
    let finalId = id
    if (file.tasks.find((t: any) => t.id === finalId)) {
      finalId = `${finalId}-${Date.now().toString(36)}`
    }
    const newTask: Record<string, unknown> = {
      id: finalId,
      description,
      output: output.map((f: string) => f.trim()).filter(Boolean),
      executor: executor || 'openrouter',
      status: 'pending',
      retry_count: 0,
    }
    if (executorModel) newTask.executor_model = executorModel
    if (engine) newTask.engine = engine
    if (cliEffort) newTask.cli_effort = cliEffort
    const skill = params.skill?.trim()
    if (skill && isKnownSkillId(skill)) newTask.skill = skill
    ;(file.tasks as any[]).push(newTask)
    saveTasks(root, file)
    // D.5 (Mes 22) — el sandbox de worktree exige un working tree limpio
    // (sandbox-policy.ts:29). saveTasks() deja tasks.yaml modificado, así que
    // crear una tarea desde el dashboard y correrla enseguida fallaba SIEMPRE
    // con "Uncommitted changes" — el propio flujo se auto-bloqueaba. Auto-commit
    // best-effort de solo tasks.yaml (mismo archivo que se acaba de tocar); si
    // el usuario tenía OTROS archivos sucios, esos siguen bloqueando el run
    // como corresponde — esto no oculta desprolijidad ajena a la creación.
    // E.5 — bajo el mismo lock que mergeWorktreeBack: sin esto, este commit
    // directo a master podía intercalarse con el checkout+merge de un
    // worktree en vuelo (IDEAS #48, reproducido en vivo 3+ veces).
    withGitLock(root, () => {
      git(['add', 'tasks.yaml'], root)
      git(['commit', '-m', `chore(tasks): add ${finalId} (dashboard)`], root)
    })
    return { id: finalId }
  } catch (e: any) {
    return { error: e.message, status: 500 }
  }
}

// CC.5 (2026-08-18) — bug real encontrado al ejecutar el gate multi-proyecto:
// `join(root, 'src/cli.ts')` asumía que `src/cli.ts` vive DENTRO del proyecto
// seleccionado. Eso solo era cierto porque OrchestOS históricamente se corría
// dogfooding sobre sí mismo (root === instalación de OrchestOS). Con CC.3
// (selección real de proyecto), `root` pasa a ser el proyecto del usuario —
// que casi nunca tiene `src/cli.ts` — y el spawn fallaba con "Module not
// found" en CUALQUIER proyecto que no fuera este mismo repo. Verificado en
// vivo: `task run` quedaba `pending` para siempre, sin error visible en la
// API, solo en el log del proceso del dashboard.
// Fix: resolver la instalación de OrchestOS desde la ubicación real de este
// archivo (`import.meta.url`), independiente de qué proyecto se está
// orquestando, y pasar `root` como el `[path]` posicional que `task run`
// y `task run --expand` ya aceptan (cli.ts:966) en vez de cwd implícito.
const ORCHESTOS_CLI_PATH = join(fileURLToPath(new URL('../../cli.ts', import.meta.url)))

// D.7 — mismo motivo de extracción: reusable por el auto-flow del chat.
function spawnTaskRun(root: string, id: string, model?: string): void {
  // E.5 — mismo lock que arriba.
  withGitLock(root, () => {
    git(['add', 'tasks.yaml'], root)
    git(['commit', '-m', `chore(tasks): run ${id} (dashboard)`], root)
  })
  const args = [process.execPath, 'run', ORCHESTOS_CLI_PATH, 'task', 'run', root, '--id', id]
  if (model) args.push('--model', model)
  Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
}

async function handleApiTasksCreate(req: Request, root: string): Promise<Response> {
  let body: CreateTaskParams
  try {
    body = (await req.json()) as CreateTaskParams
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  // I.3 (Mes 30) — mismo principio que D.7 en el chat (chat.ts): si quien crea
  // la tarea no fijó NI engine NI executor_model, se resuelve declarativamente
  // (reglas de proyecto → agent de config → cascada E.16) en vez de caer en
  // silencio al default interno del harness ('single-shot', tasks/schema.ts).
  // Acotado a "ninguno de los dos vino explícito" a propósito: el draft de
  // Tasks (screens-core.js) SIEMPRE manda un executor_model (el que muestra el
  // selector, aunque el usuario no lo haya tocado) — pisarlo con un engine
  // resuelto distinto dejaría engine y executor_model contradiciéndose. Ese
  // caso (pre-llenar el selector del draft con la regla) queda documentado
  // como gap explícito en PLAN.md, no resuelto acá.
  let params: CreateTaskParams = body
  if (!body.engine && !body.executor_model) {
    const cfg = loadOrcheConfig(root)
    const rule = resolveProjectAgentRule(cfg.taskAgentRules, {
      output: body.output ?? [],
      skill: body.skill,
    })
    const preferredAgent = rule?.agent ?? cfg.agent
    if (preferredAgent) {
      const cascade = await resolveCascadeTier()
      const resolved = resolveAgentSelection(preferredAgent, cascade)
      params = {
        ...body,
        executor_model: resolved.executor_model,
        engine: resolved.engine,
        cli_effort: body.cli_effort ?? rule?.cli_effort,
      }
    }
  }
  const result = createTaskRecord(root, params)
  if ('error' in result) return errorResponse(result.error, result.status)
  return jsonResponse({ ok: true, id: result.id })
}

async function handleApiTasksRun(req: Request, url: URL, root: string): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  let body: { model?: string; clarification?: string } = {}
  try {
    body = (await req.json()) as { model?: string; clarification?: string }
  } catch {
    /* body opcional */
  }
  const model = body.model?.trim() || undefined
  const clarification = body.clarification?.trim() || undefined
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)
  if (clarification) {
    task.description = `${task.description}\n\nUser clarification: ${clarification}`
  }
  if (task.status !== 'pending') {
    task.status = 'pending'
  }
  saveTasks(root, file)
  spawnTaskRun(root, id, model)
  return jsonResponse({ ok: true, id })
}

/**
 * G.3.3 — polling incremental de pasos en vivo (chat → cards de tool-call).
 * `?since=<seq>` devuelve solo lo nuevo desde el último seq visto por el
 * cliente; sin el param, devuelve todo lo que haya (retomar una pestaña).
 */
async function handleApiTasksSteps(url: URL): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const since = Number(url.searchParams.get('since') ?? '0') || 0
  const steps = getRunSteps(id, since)
  return jsonResponse({ steps })
}

function handleApiTasksDelete(url: URL, root: string): Response {
  const id = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  if (!id) return errorResponse('Missing task id', 400)
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  try {
    const file = loadTasks(root)
    const before = file.tasks.length
    ;(file as any).tasks = file.tasks.filter((t: any) => t.id !== id)
    if (file.tasks.length === before) return errorResponse('Task not found', 404)
    saveTasks(root, file)
    return jsonResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// v0.12 Bloque A — borrado en lote sobre tasks.yaml. A diferencia de runs/
// instincts/memory (SQLite, un DELETE por id sin costo), tasks.yaml es un
// archivo — se filtra una sola vez y se guarda una sola vez, en vez de N
// llamadas a saveTasks() (N reescrituras completas del YAML).
async function handleApiTasksBulkDelete(req: Request, root: string): Promise<Response> {
  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0)
    return errorResponse('ids must be a non-empty array', 400)
  const ids = new Set(body.ids.filter((id): id is string => typeof id === 'string'))
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  try {
    const file = loadTasks(root)
    const before = file.tasks.length
    ;(file as any).tasks = file.tasks.filter((t: any) => !ids.has(t.id))
    const deleted = before - file.tasks.length
    if (deleted > 0) saveTasks(root, file)
    return jsonResponse({ ok: true, deleted })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiTasksExplain(url: URL, root: string): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)

  const taskClass = classifyTask(task.description)
  const cfg = loadOrcheConfig(root)
  const cfgFound = existsSync(join(root, 'orchestos.config.yaml'))
  const route = autoRoute(task, cfg, cfgFound)
  const model = route?.model ?? taskClass
  const providerName = route?.provider ?? task.executor
  const modelDisplay = route
    ? `${providerName}/${model} [${route.role}]`
    : `${model} (${taskClass})`

  const project = getProject(root)
  const suggestions = project ? suggestContext(project.id, task.description, { topN: 5 }) : []
  const implicitInput = task.input.length === 0 ? suggestions.map((s: any) => s.path) : []
  const inputSource =
    task.input.length > 0 ? 'explicit' : implicitInput.length > 0 ? 'graph' : 'none'

  const cst = loadConstitution(root)

  return jsonResponse({
    id: task.id,
    description: task.description,
    status: task.status,
    executor: providerName,
    model: modelDisplay,
    outputs: task.output,
    inputSource,
    inputFiles: task.input.length > 0 ? task.input : implicitInput,
    graphSuggestions: suggestions.map((s: any) => ({ path: s.path, score: s.score })),
    checks: task.checks ?? [],
    acceptanceCriteria: task.acceptance_criteria ?? [],
    constitution: cst
      ? {
          ruleCount: cst.ruleCount,
          forbidden: cst.forbidden.length,
          requireConfirmation: cst.require_confirmation.length,
          allowed: cst.allowed.length,
        }
      : null,
  })
}

async function handleApiTasksDiagnose(url: URL, root: string): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  try {
    const result = await diagnoseTask(id, root)
    const row: DiagnoseRow = {
      taskId: result.taskId,
      pattern: result.pattern,
      confidence: result.confidence,
      suggestion: result.suggestion,
      details: result.details,
      lastErrorResult: result.lastErrorResult,
    }
    return jsonResponse(row)
  } catch (e: any) {
    return errorResponse(e.message, 404)
  }
}

// Mes 20 B.3 — GET /api/tasks/:id/split-plan
function handleApiTasksSplitPlan(url: URL, root: string): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const planPath = join(root, `${id}.plan.yaml`)
  if (!existsSync(planPath)) return errorResponse('No split plan found for this task', 404)

  let yaml: string
  try {
    yaml = readFileSync(planPath, 'utf-8')
  } catch {
    return errorResponse('Cannot read plan file', 500)
  }

  let plan: ReturnType<typeof parsePlan>
  try {
    plan = parsePlan(yaml)
  } catch (e: any) {
    return errorResponse(`Invalid plan YAML: ${e.message}`, 422)
  }

  const resp: SplitPlanResponse = {
    parentTaskId: id,
    planYamlPath: planPath,
    subTasks: plan.sub_tasks.map((st) => ({
      id: st.id,
      description: st.description,
      acceptance: st.acceptance,
      depends_on: st.depends_on,
      allowed_tools: st.allowed_tools,
      ...(st.output ? { output: st.output } : {}),
      ...(st.topic_key ? { topic_key: st.topic_key } : {}),
    })),
  }
  return jsonResponse(resp)
}

// Mes 20 B.3 — POST /api/tasks/:id/approve-split
function handleApiTasksApproveSplit(url: URL, root: string): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const planPath = join(root, `${id}.plan.yaml`)
  if (!existsSync(planPath))
    return errorResponse('No split plan found — run the task first to generate a plan', 404)

  // Reset task to pending so the CLI doesn't skip it
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)
  task.status = 'pending'
  saveTasks(root, file)

  // Spawn CLI with --expand — it detects the existing .plan.yaml and runs it directly.
  // CC.5 — mismo fix que spawnTaskRun: ORCHESTOS_CLI_PATH en vez de join(root, ...).
  const args = [process.execPath, 'run', ORCHESTOS_CLI_PATH, 'task', 'run', root, '--expand', id]
  Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit' })

  return jsonResponse({
    ok: true,
    id,
    message: `Split plan for "${id}" approved — executing ${planPath}`,
  })
}

export {
  createTaskRecord,
  handleApiSystemExecutorModes,
  handleApiTasks,
  handleApiTasksApproveSplit,
  handleApiTasksBulkDelete,
  handleApiTasksCreate,
  handleApiTasksDelete,
  handleApiTasksDiagnose,
  handleApiTasksExplain,
  handleApiTasksInit,
  handleApiTasksRun,
  handleApiTasksSplitPlan,
  handleApiTasksSteps,
  isKnownSkillId,
  loadTaskRows,
  spawnTaskRun,
}
