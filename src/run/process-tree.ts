import type { SpawnOptions, Subprocess } from 'bun'

interface TreeProcess {
  pid?: number
  kill(signal: NodeJS.Signals): unknown
}
const trees = new Set<TreeProcess>()

export function spawnTree<
  const In extends SpawnOptions.Writable = 'ignore',
  const Out extends SpawnOptions.Readable = 'pipe',
  const Err extends SpawnOptions.Readable = 'inherit',
>(argv: string[], opts: SpawnOptions.SpawnOptions<In, Out, Err>): Subprocess<In, Out, Err> {
  const proc = Bun.spawn(argv, { ...opts, detached: true })
  trees.add(proc)
  void proc.exited.then(() => trees.delete(proc))
  return proc
}

export function killTree(proc: TreeProcess, signal: NodeJS.Signals): void {
  try {
    if (proc.pid === undefined) {
      proc.kill(signal)
      return
    }
    process.kill(-proc.pid, signal)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    proc.kill(signal)
  }
}

export async function terminateTree(
  proc: TreeProcess & { exited: Promise<number> },
  graceMs = 2000,
): Promise<number> {
  let exited = false
  void proc.exited.then(() => {
    exited = true
  })
  killTree(proc, 'SIGTERM')
  // Vencido el plazo: líder vivo → SIGKILL a todo; líder muerto → solo al grupo (nietos que ignoraron SIGTERM).
  const pgid = proc.pid
  if (pgid !== undefined) terminatingGroups.add(pgid)
  const timer = setTimeout(() => {
    if (pgid !== undefined) terminatingGroups.delete(pgid)
    if (!exited) return killTree(proc, 'SIGKILL')
    if (pgid !== undefined) killGroup(pgid)
  }, graceMs)
  timer.unref()
  return proc.exited
}

/** SIGTERM enviado y SIGKILL pendiente: si el proceso sale antes del plazo, `exit` mata estos grupos. */
const terminatingGroups = new Set<number>()
function killGroup(pgid: number): void {
  try {
    process.kill(-pgid, 'SIGKILL')
  } catch {
    /* grupo ya vacío */
  }
}

export function killAllTrees(): void {
  for (const proc of trees) killTree(proc, 'SIGKILL')
  for (const pgid of terminatingGroups) killGroup(pgid)
  terminatingGroups.clear()
}
process.once('exit', killAllTrees)
