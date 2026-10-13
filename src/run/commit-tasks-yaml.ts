import { loadTasks } from '../tasks/loader.ts'
import { withGitLock } from './git-lock.ts'
import { git } from './sandbox.ts'

/**
 * Commitea SOLO `tasks.yaml` (ruta explícita: no se lleva lo que el usuario tenga en el
 * índice). Best-effort y silencioso si el directorio no es un repo, el archivo no cambió
 * o está ignorado. Identidad: la del repo, nunca se fija aquí.
 */
export function commitTasksYaml(root: string, message: string): void {
  try {
    if (git(['rev-parse', '--is-inside-work-tree'], root).exitCode !== 0) return
    if (git(['check-ignore', '-q', '--', 'tasks.yaml'], root).exitCode === 0) return
    withGitLock(root, () => {
      if (git(['status', '--porcelain', '--', 'tasks.yaml'], root).stdout === '') return
      if (git(['add', '--', 'tasks.yaml'], root).exitCode !== 0) return
      git(['commit', '-m', message, '--', 'tasks.yaml'], root)
    })
  } catch {
    /* best-effort */
  }
}

/** Commitea el estado final que el run dejó en `tasks.yaml`; `running` nunca se commitea. */
export function commitFinalTaskState(root: string, taskId: string): void {
  try {
    const task = loadTasks(root).tasks.find((candidate) => candidate.id === taskId)
    if (!task || task.status === 'running') return
    commitTasksYaml(root, `chore(tasks): ${taskId} ${task.status}`)
  } catch {
    /* best-effort */
  }
}

/**
 * ERP.4.13 — commitea SOLO las rutas dadas (`git add -- <files>` + `git commit -- <files>`), bajo
 * el candado de git. Identidad y hooks: los del repo del usuario. No es best-effort: devuelve el
 * resultado para que el llamador decida.
 */
export function commitPaths(
  root: string,
  files: string[],
  message: string,
): { ok: boolean; stderr: string } {
  try {
    return withGitLock(root, () => {
      const add = git(['add', '--', ...files], root)
      if (add.exitCode !== 0) return { ok: false, stderr: add.stderr }
      const commit = git(['commit', '-m', message, '--', ...files], root)
      return { ok: commit.exitCode === 0, stderr: commit.stderr || commit.stdout }
    })
  } catch (error) {
    return { ok: false, stderr: error instanceof Error ? error.message : String(error) }
  }
}
