import { getProject } from '../../db/projects.ts'
import type { TaskLaunchSettled } from '../../db/task-launches.ts'
import { getTaskRunWatch, listTaskRunWatch, type TaskRunWatchRow } from '../../db/task-run-watch.ts'
import { DIRTY_TREE_REASON_PREFIX } from '../../run/sandbox-policy.ts'
import { loadTasks, updateTaskStatus } from '../../tasks/loader.ts'
import { settleTaskRun } from './task-report.ts'

export const INTERRUPTED_REASON = 'Interrupted: the task runner stopped before the task finished.'

/** "Vivo" = el PID existe Y su línea de comando es `task run … --id <taskId>`. */
export type RunnerProbe = (pid: number, taskId: string) => boolean

export const psRunnerProbe: RunnerProbe = (pid, taskId) => {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  try {
    const command = processCommandLine(pid)
    if (command === null) return false
    return command.includes('task run') && commandIsRunnerOf(command, taskId)
  } catch {
    return false
  }
}

/** WIN.9: `ps -o` no existe en Windows; allí la línea de comando sale de Win32_Process. */
function processCommandLine(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null
  const argv =
    process.platform === 'win32'
      ? [
          'powershell.exe',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ]
      : ['ps', '-o', 'command=', '-p', String(pid)]
  // Tope: la sonda corre síncrona en el servidor; PowerShell/CIM colgado no debe congelarlo.
  const proc = Bun.spawnSync(argv, { timeout: 5_000 })
  return proc.exitCode === 0 ? proc.stdout.toString() : null
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

/** El estado durable solo es terminal cuando el runner del lanzamiento ya salió. */
export function taskRunSettled(
  task: { status: string; retry_reason?: string | null } | null,
  runnerAlive: boolean,
): TaskLaunchSettled {
  if (!task) return { outcome: 'interrupted', reason: 'Task or project removed' }
  if (runnerAlive) return null
  const reason = task.retry_reason ?? null
  switch (task.status) {
    case 'done':
      return { outcome: 'completed', reason: null }
    case 'failed':
    case 'failed_permanent':
      return { outcome: 'failed', reason }
    case 'blocked':
      return { outcome: 'blocked', reason }
    case 'pending':
      if (reason) return { outcome: 'blocked', reason }
      return { outcome: 'interrupted', reason: INTERRUPTED_REASON }
    case 'running':
      return { outcome: 'interrupted', reason: INTERRUPTED_REASON }
    default:
      return null
  }
}

function reconcileRow(
  row: TaskRunWatchRow,
  probe: RunnerProbe,
): 'settled' | 'watching' | 'dropped' {
  const current = getTaskRunWatch(row.root, row.task_id)
  if (!current || current.pid !== row.pid || current.created_at !== row.created_at) return 'dropped'
  if (!getProject(row.root)) {
    settleTaskRun(row, { outcome: 'interrupted', reason: 'Task or project removed' }, null)
    return 'dropped'
  }
  let task: ReturnType<typeof loadTasks>['tasks'][number] | undefined
  try {
    task = loadTasks(row.root).tasks.find((item) => item.id === row.task_id)
  } catch {
    return 'watching'
  }
  if (!task) {
    settleTaskRun(row, { outcome: 'interrupted', reason: 'Task or project removed' }, null)
    return 'dropped'
  }
  const alive = probe(row.pid, row.task_id)
  const result = taskRunSettled(task, false)
  if (!result) return 'watching'
  if (row.launch_id && alive) return 'watching'
  const terminal =
    task.status === 'done' ||
    task.status === 'failed' ||
    task.status === 'failed_permanent' ||
    task.status === 'blocked' ||
    // ERP.4.13: bloqueada por árbol sucio sin intento — ya terminó aunque siga `pending`
    (task.status === 'pending' && Boolean(task.retry_reason?.startsWith(DIRTY_TREE_REASON_PREFIX)))
  if (terminal) {
    settleTaskRun(row, result)
    return 'settled'
  }
  // `pending` justo tras lanzar (el runner aún no pasó a running) con runner vivo
  // se vigila; `pending` con runner muerto es un reintento programado.
  if (alive) return 'watching'
  if (task.status === 'running') {
    updateTaskStatus(row.root, row.task_id, {
      status: 'failed',
      retry_reason: INTERRUPTED_REASON,
    })
  }
  settleTaskRun(row, result)
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
