import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { diagnoseTask } from '../../agents/diagnose.ts'
import { loadTasks, saveTasks } from '../../tasks/loader.ts'
import type { TaskRow, DiagnoseRow } from '../types.ts'
import { jsonResponse, errorResponse, validateTaskId } from '../http.ts'

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
    }))
  } catch {
    return []
  }
}

function handleApiTasks(): Response {
  return jsonResponse(loadTaskRows(resolve('.')))
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

async function handleApiTasksCreate(req: Request): Promise<Response> {
  let body: { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string; engine?: string }
  try { body = (await req.json()) as { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string; engine?: string } } catch { return errorResponse('Invalid JSON', 400) }
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
  let body: { model?: string } = {}
  try { body = (await req.json()) as { model?: string } } catch { /* body opcional */ }
  const model = body.model?.trim() || undefined
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)
  if (task.status !== 'pending') {
    task.status = 'pending'
    saveTasks(root, file)
  }
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

export { handleApiTasks, handleApiTasksCreate, handleApiTasksRun, handleApiTasksDelete, handleApiTasksDiagnose, loadTaskRows }
