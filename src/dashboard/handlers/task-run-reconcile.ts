import { getProject } from '../../db/projects.ts'
import {
  deleteTaskRunWatch,
  getTaskRunWatch,
  listTaskRunWatch,
  type TaskRunWatchRow,
} from '../../db/task-run-watch.ts'
import { DIRTY_TREE_REASON_PREFIX } from '../../run/sandbox-policy.ts'
import { loadTasks, updateTaskStatus } from '../../tasks/loader.ts'
import { settleTaskRun } from './task-report.ts'

export const INTERRUPTED_REASON = 'Interrupted: the task runner stopped before the task finished.'

/** "Vivo" = el PID existe Y su línea de comando es `task run … --id <taskId>`. */
export type RunnerProbe = (pid: number, taskId: string) => boolean

const psRunnerProbe: RunnerProbe = (pid, taskId) => {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  try {
    const proc = Bun.spawnSync(['ps', '-o', 'command=', '-p', String(pid)])
    if (proc.exitCode !== 0) return false
    const command = proc.stdout.toString()
    return command.includes('task run') && commandIsRunnerOf(command, taskId)
  } catch {
    return false
  }
}

export function commandIsRunnerOf(command: string, taskId: string): boolean {
  const marker = `--id ${taskId}`
  const index = command.indexOf(marker)
  if (index < 0) return false
  const next = command[index + marker.length]
  return next === undefined || /\s/.test(next)
}

interface ReconcileOptions {
  probe?: RunnerProbe
  pollMs?: number
  /** Inyectable para tests: por defecto un `setInterval` con `unref`. */
  schedule?: (fn: () => void, ms: number) => { stop(): void }
}

const defaultSchedule: NonNullable<ReconcileOptions['schedule']> = (fn, ms) => {
  const timer = setInterval(fn, ms)
  timer.unref?.()
  return { stop: () => clearInterval(timer) }
}

function reconcileRow(
  row: TaskRunWatchRow,
  probe: RunnerProbe,
): 'settled' | 'watching' | 'dropped' {
  const current = getTaskRunWatch(row.root, row.task_id)
  if (!current || current.pid !== row.pid || current.created_at !== row.created_at) return 'dropped'
  if (!getProject(row.root)) {
    deleteTaskRunWatch(row)
    return 'dropped'
  }
  let task: ReturnType<typeof loadTasks>['tasks'][number] | undefined
  try {
    task = loadTasks(row.root).tasks.find((item) => item.id === row.task_id)
  } catch {
    task = undefined
  }
  if (!task) {
    deleteTaskRunWatch(row)
    return 'dropped'
  }
  const terminal =
    task.status === 'done' ||
    task.status === 'failed' ||
    task.status === 'failed_permanent' ||
    task.status === 'blocked' ||
    // ERP.4.13: bloqueada por árbol sucio sin intento — ya terminó aunque siga `pending`
    (task.status === 'pending' && Boolean(task.retry_reason?.startsWith(DIRTY_TREE_REASON_PREFIX)))
  if (terminal) {
    settleTaskRun(row)
    return 'settled'
  }
  // `pending` justo tras lanzar (el runner aún no pasó a running) con runner vivo
  // se vigila; `pending` con runner muerto es un reintento programado.
  const alive = probe(row.pid, row.task_id)
  if (alive) return 'watching'
  if (task.status === 'running') {
    updateTaskStatus(row.root, row.task_id, {
      status: 'failed',
      retry_reason: INTERRUPTED_REASON,
    })
  }
  settleTaskRun(row)
  return 'settled'
}

const runnerGone: RunnerProbe = () => false

/** El runner de esta sesión ya salió: cierra la fila por el mismo camino que el reconcile. */
export function settleExitedTaskRun(row: TaskRunWatchRow): void {
  reconcileRow(row, runnerGone)
}

/**
 * R.8.4 — al arrancar, cierra los reportes que el reinicio dejó huérfanos.
 * Nunca relanza un run. Errores por fila aislados.
 */
export function reconcileTaskRuns(options: ReconcileOptions = {}): { stop(): void } {
  const probe = options.probe ?? psRunnerProbe
  const schedule = options.schedule ?? defaultSchedule
  const pollMs = options.pollMs ?? 2000
  let poller: { stop(): void } | null = null
  // Solo las filas heredadas del arranque: los runs de esta sesión los cierra su propio `exited`.
  let inherited: Set<string> | null = null
  const keyOf = (row: TaskRunWatchRow) => `${row.root}\0${row.task_id}`
  const stop = () => {
    poller?.stop()
    poller = null
  }

  const pass = () => {
    let watching = 0
    let rows: TaskRunWatchRow[] = []
    try {
      rows = listTaskRunWatch()
    } catch (error) {
      console.error('Could not list task_run_watch', error)
    }
    if (inherited === null) inherited = new Set(rows.map(keyOf))
    else rows = rows.filter((row) => inherited?.has(keyOf(row)))
    for (const row of rows) {
      try {
        if (reconcileRow(row, probe) === 'watching') watching += 1
      } catch (error) {
        console.error(`Could not reconcile task run ${row.task_id}`, error)
      }
    }
    if (watching === 0) stop()
    else if (!poller) poller = schedule(pass, pollMs)
  }

  pass()
  return { stop }
}
