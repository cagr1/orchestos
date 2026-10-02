import { createHash } from 'crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { parse, stringify } from 'yaml'
import { isProcessAlive, withFileLock } from '../run/file-lock.ts'
import { type Task, type TasksFile, validateTasksFile } from './schema.ts'

const TASKS_FILE = 'tasks.yaml'

export function tasksPath(root: string): string {
  return join(root, TASKS_FILE)
}

export function tasksExist(root: string): boolean {
  return existsSync(tasksPath(root))
}

export function loadTasks(root: string): TasksFile {
  const path = tasksPath(root)
  if (!existsSync(path))
    throw new Error(`tasks.yaml not found in ${root}. Run: orchestos task init <path>`)
  const raw = parse(readFileSync(path, 'utf-8'))
  return validateTasksFile(raw)
}

export function saveTasks(root: string, file: TasksFile, expectedHash?: string): void {
  const path = tasksPath(root)

  // Validate the complete document before checking locks or touching disk.
  // Callers may have mutated a loaded task, so the TypeScript type alone is
  // not sufficient to protect the on-disk contract.
  validateTasksFile(file)

  const content = stringify(
    { version: 1, project: file.project, tasks: file.tasks },
    { lineWidth: 120 },
  )
  withTasksLock(root, () => {
    if (expectedHash && existsSync(path)) {
      const currentHash = hashFile(path)
      if (currentHash !== expectedHash) {
        throw new Error(
          `tasks.yaml conflict: file changed since last read (expected ${expectedHash}, got ${currentHash}). Re-run the command.`,
        )
      }
    }
    writeTasksAtomic(path, content)
  })
}

export function writeTasksAtomic(path: string, content: string): void {
  const temporary = join(
    dirname(path),
    `.tasks.yaml.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`,
  )
  let fd: number | undefined
  try {
    fd = openSync(temporary, 'wx')
    writeFileSync(fd, content, 'utf-8')
    fsyncSync(fd)
    closeSync(fd)
    fd = undefined
    renameSync(temporary, path)
  } catch (error) {
    if (fd !== undefined) closeSync(fd)
    try {
      unlinkSync(temporary)
    } catch {
      /* no temporary file to clean */
    }
    throw error
  }
}

export function withTasksLock<T>(root: string, fn: () => T): T {
  return withFileLock(
    join(root, '.orchestos', 'tasks.lock'),
    () => {
      const directory = dirname(tasksPath(root))
      for (const name of readdirSync(directory)) {
        const match = /^\.tasks\.yaml\.tmp-(\d+)-/.exec(name)
        if (match && !isProcessAlive(Number(match[1]))) {
          try {
            unlinkSync(join(directory, name))
          } catch {
            /* Another cleanup or atomic rename already removed it. */
          }
        }
      }
      return fn()
    },
    {
      waitTimeoutMs: 10_000,
      staleMs: 30_000,
    },
  )
}

export function mutateTasks<T>(root: string, fn: (file: TasksFile) => T): T {
  return withTasksLock(root, () => {
    const path = tasksPath(root)
    const original = readFileSync(path, 'utf-8')
    const file = loadTasks(root)
    const result = fn(file)
    validateTasksFile(file)
    const content = stringify(
      { version: 1, project: file.project, tasks: file.tasks },
      { lineWidth: 120 },
    )
    if (content !== original) writeTasksAtomic(path, content)
    return result
  })
}

export function hashFile(path: string): string {
  return createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 12)
}

export function updateTaskStatus(root: string, taskId: string, patch: Partial<Task>): void {
  mutateTasks(root, (file) => {
    const task = file.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task "${taskId}" not found in tasks.yaml`)
    Object.assign(task, patch)
  })
}
