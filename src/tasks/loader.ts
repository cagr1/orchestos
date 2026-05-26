import { parse, stringify } from 'yaml'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { validateTasksFile, type TasksFile, type Task } from './schema.ts'

const TASKS_FILE = 'tasks.yaml'

export function tasksPath(root: string): string {
  return join(root, TASKS_FILE)
}

export function tasksExist(root: string): boolean {
  return existsSync(tasksPath(root))
}

export function loadTasks(root: string): TasksFile {
  const path = tasksPath(root)
  if (!existsSync(path)) throw new Error(`tasks.yaml not found in ${root}. Run: orchestos task init <path>`)
  const raw = parse(readFileSync(path, 'utf-8'))
  return validateTasksFile(raw)
}

export function saveTasks(root: string, file: TasksFile, expectedHash?: string): void {
  const path = tasksPath(root)

  // optimistic lock — if expectedHash provided, verify file hasn't changed
  if (expectedHash && existsSync(path)) {
    const currentHash = hashFile(path)
    if (currentHash !== expectedHash) {
      throw new Error(`tasks.yaml conflict: file changed since last read (expected ${expectedHash}, got ${currentHash}). Re-run the command.`)
    }
  }

  const content = stringify({ version: 1, project: file.project, tasks: file.tasks }, { lineWidth: 120 })
  writeFileSync(path, content, 'utf-8')
}

export function hashFile(path: string): string {
  return createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 12)
}

export function updateTaskStatus(root: string, taskId: string, patch: Partial<Task>): void {
  const path = tasksPath(root)
  const hash = existsSync(path) ? hashFile(path) : undefined
  const file = loadTasks(root)
  const task = file.tasks.find(t => t.id === taskId)
  if (!task) throw new Error(`Task "${taskId}" not found in tasks.yaml`)
  Object.assign(task, patch)
  saveTasks(root, file, hash)
}
