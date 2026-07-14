import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { diagnoseTask } from '../../agents/diagnose.ts'
import { loadTasks, saveTasks } from '../../tasks/loader.ts'
import { scaffoldTasksYaml } from '../../tasks/init.ts'
import type { TaskRow, DiagnoseRow, SplitPlanResponse } from '../types.ts'
import { jsonResponse, errorResponse, validateTaskId } from '../http.ts'
import { listSkillFiles, listProSkillFiles, loadSkill } from '../../skills/registry.ts'
import { classifyTask } from '../../router/classify.ts'
import { autoRoute } from '../../router/auto-route.ts'
import { loadOrcheConfig } from '../../config/load.ts'
import { loadConstitution } from '../../spec/constitution.ts'
import { getProject } from '../../db/projects.ts'
import { suggestContext } from '../../graph/suggest.ts'
import { parsePlan } from '../../agents/planner.ts'

/** Shared by /api/tasks and /api/run/graph/status — both need the live tasks.yaml view. */
function loadTaskRows(root: string): TaskRow[] {
  if (!existsSync(join(root, 'tasks.yaml'))) return []
  try {
    const file = loadTasks(root)
    return file.tasks.map(t => ({
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
function handleApiTasks(): Response {
  const root = resolve('.')
  const tasksYamlPath = join(root, 'tasks.yaml')
  if (!existsSync(tasksYamlPath)) {
    return jsonResponse({ exists: false, tasks: [] })
  }
  try {
    const file = loadTasks(root)
    const rows: TaskRow[] = file.tasks.map(t => ({
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
async function handleApiTasksInit(): Promise<Response> {
  const root = resolve('.')
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
  return desc.trim().toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim().split(/\s+/).slice(0, 5).join('-') || 'task'
}

function inferExecutorFromModel(modelId: string | undefined): string {
  if (!modelId) return 'openrouter'
  if (/^ollama\//.test(modelId)) return 'ollama'
  if (/^claude-/.test(modelId)) return 'anthropic'
  if (/^(gpt-|o1-|o3-|text-)/.test(modelId)) return 'openai'
  return 'openrouter'
}

/** Bloque D (Mes 18, ex-IDEAS #21) — un `skill` inventado o mal escrito se ignora
 * en silencio en vez de romper la creación de la tarea; solo importa que exista. */
function isKnownSkillId(id: string): boolean {
  for (const f of [...listSkillFiles(), ...listProSkillFiles()]) {
    try { if (loadSkill(f).id === id) return true } catch {}
  }
  return false
}

async function handleApiTasksCreate(req: Request): Promise<Response> {
  let body: { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string; engine?: string; skill?: string }
  try { body = (await req.json()) as { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string; engine?: string; skill?: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (!body.description?.trim()) {
    return errorResponse('description is required', 400)
  }
  const description = body.description.trim()
  const id = body.id?.trim() || descToTaskId(description)
  const output = Array.isArray(body.output) ? body.output : []
  const executorModel = body.executor_model?.trim() || undefined
  const executor = body.executor || inferExecutorFromModel(executorModel)
  // G.4 / B.2 — engine opcional; validateTask() de tasks/schema.ts re-valida al re-leer
  // el YAML, así que si llega un valor inválido caemos al mensaje "unknown engine"
  // via el guard siguiente (mismo set que validateEngine en schema.ts:86-92).
  const engineRaw = body.engine?.trim()
  let engine: 'single-shot' | 'agentic' | 'external' | undefined
  if (engineRaw === 'single-shot' || engineRaw === 'agentic' || engineRaw === 'external') engine = engineRaw
  else if (engineRaw && engineRaw.length > 0) return errorResponse(`unknown engine '${engineRaw}' — allowed: single-shot, agentic, external`, 400)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) {
    return errorResponse('tasks.yaml not found — run: orchestos task init', 404)
  }
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
    const skill = body.skill?.trim()
    if (skill && isKnownSkillId(skill)) newTask.skill = skill
    ;(file.tasks as any[]).push(newTask)
    saveTasks(root, file)
    return jsonResponse({ ok: true, id: finalId })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

async function handleApiTasksRun(req: Request, url: URL): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  let body: { model?: string; clarification?: string } = {}
  try { body = (await req.json()) as { model?: string; clarification?: string } } catch { /* body opcional */ }
  const model = body.model?.trim() || undefined
  const clarification = body.clarification?.trim() || undefined
  const root = resolve('.')
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
  const args = [process.execPath, 'run', join(root, 'src/cli.ts'), 'task', 'run', '--id', id]
  if (model) args.push('--model', model)
  Bun.spawn(args, {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  return jsonResponse({ ok: true, id })
}

function handleApiTasksDelete(url: URL): Response {
  const id = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  if (!id) return errorResponse('Missing task id', 400)
  const root = resolve('.')
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
async function handleApiTasksBulkDelete(req: Request): Promise<Response> {
  let body: { ids?: unknown }
  try { body = (await req.json()) as { ids?: unknown } } catch { return errorResponse('Invalid JSON', 400) }
  if (!Array.isArray(body.ids) || body.ids.length === 0) return errorResponse('ids must be a non-empty array', 400)
  const ids = new Set(body.ids.filter((id): id is string => typeof id === 'string'))
  const root = resolve('.')
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

function handleApiTasksExplain(url: URL): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
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
  const modelDisplay = route ? `${providerName}/${model} [${route.role}]` : `${model} (${taskClass})`

  const project = getProject(root)
  const suggestions = project ? suggestContext(project.id, task.description, { topN: 5 }) : []
  const implicitInput = task.input.length === 0 ? suggestions.map((s: any) => s.path) : []
  const inputSource = task.input.length > 0 ? 'explicit' : implicitInput.length > 0 ? 'graph' : 'none'

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
    constitution: cst ? { ruleCount: cst.ruleCount, forbidden: cst.forbidden.length, requireConfirmation: cst.require_confirmation.length, allowed: cst.allowed.length } : null,
  })
}

async function handleApiTasksDiagnose(url: URL): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
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
function handleApiTasksSplitPlan(url: URL): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
  const planPath = join(root, `${id}.plan.yaml`)
  if (!existsSync(planPath)) return errorResponse('No split plan found for this task', 404)

  let yaml: string
  try { yaml = readFileSync(planPath, 'utf-8') } catch { return errorResponse('Cannot read plan file', 500) }

  let plan: ReturnType<typeof parsePlan>
  try { plan = parsePlan(yaml) } catch (e: any) { return errorResponse(`Invalid plan YAML: ${e.message}`, 422) }

  const resp: SplitPlanResponse = {
    parentTaskId: id,
    planYamlPath: planPath,
    subTasks: plan.sub_tasks.map(st => ({
      id:            st.id,
      description:   st.description,
      acceptance:    st.acceptance,
      depends_on:    st.depends_on,
      allowed_tools: st.allowed_tools,
      ...(st.output    ? { output:    st.output }    : {}),
      ...(st.topic_key ? { topic_key: st.topic_key } : {}),
    })),
  }
  return jsonResponse(resp)
}

// Mes 20 B.3 — POST /api/tasks/:id/approve-split
function handleApiTasksApproveSplit(url: URL): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const planPath = join(root, `${id}.plan.yaml`)
  if (!existsSync(planPath)) return errorResponse('No split plan found — run the task first to generate a plan', 404)

  // Reset task to pending so the CLI doesn't skip it
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)
  task.status = 'pending'
  saveTasks(root, file)

  // Spawn CLI with --expand — it detects the existing .plan.yaml and runs it directly
  const args = [process.execPath, 'run', join(root, 'src/cli.ts'), 'task', 'run', '--expand', id]
  Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit' })

  return jsonResponse({ ok: true, id, message: `Split plan for "${id}" approved — executing ${planPath}` })
}

export { handleApiTasks, handleApiTasksInit, handleApiTasksCreate, handleApiTasksRun, handleApiTasksDelete, handleApiTasksBulkDelete, handleApiTasksDiagnose, handleApiTasksExplain, handleApiTasksSplitPlan, handleApiTasksApproveSplit, loadTaskRows, isKnownSkillId }
