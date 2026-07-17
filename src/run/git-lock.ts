/**
 * src/run/git-lock.ts — Mes 22/E.5
 *
 * Mutex de archivo entre procesos para operaciones que mutan `master` en el
 * repo principal (checkout/commit/merge sobre `projectRoot`, no sobre un
 * worktree aislado). Necesario porque OrchestOS corre varios procesos Bun
 * separados a la vez (el server del dashboard + un subproceso `task run` por
 * cada tarea) — un mutex en memoria (una Promise/lock JS) no sirve entre
 * procesos de sistema operativo distintos, hace falta un lock real en disco.
 *
 * Causa raíz que esto cierra (IDEAS #48 / PLAN.md Bloque E.3): el auto-commit
 * de tasks.yaml (D.5/D.7, `git commit` directo sobre master en projectRoot) y
 * el merge-back de un worktree (`git checkout master; git merge ...`, también
 * sobre projectRoot) podían intercalarse — el segundo movía `master` mientras
 * el primero tenía a medio camino su checkout+merge, o viceversa. El síntoma
 * era `git merge ... failed after rebase` reproducido en vivo 3+ veces.
 */

import { mkdirSync, openSync, closeSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'

const LOCK_WAIT_TIMEOUT_MS = 30_000
const STALE_LOCK_MS = 60_000
const POLL_INTERVAL_MS = 50

function lockPath(projectRoot: string): string {
  return join(projectRoot, '.orchestos', 'git.lock')
}

/**
 * Ejecuta `fn` con exclusión mutua entre todos los procesos OrchestOS que
 * operan sobre `projectRoot` — crea el lockfile de forma atómica (`wx`, falla
 * si ya existe), reintenta con backoff fijo, y roba el lock si está más viejo
 * que `STALE_LOCK_MS` (un proceso dueño que murió sin liberar no debe dejar
 * al resto bloqueado para siempre).
 */
export function withGitLock<T>(projectRoot: string, fn: () => T): T {
  mkdirSync(join(projectRoot, '.orchestos'), { recursive: true })
  const path = lockPath(projectRoot)
  const start = Date.now()

  while (true) {
    try {
      closeSync(openSync(path, 'wx'))
      break
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e
      try {
        const age = Date.now() - statSync(path).mtimeMs
        if (age > STALE_LOCK_MS) {
          try { unlinkSync(path) } catch { /* otro proceso ya lo robó primero */ }
          continue
        }
      } catch { /* el lock desapareció entre el catch y el stat — reintentar arriba */ }
      if (Date.now() - start > LOCK_WAIT_TIMEOUT_MS) {
        throw new Error(`git-lock: timeout esperando ${path} — otro proceso OrchestOS lo tiene tomado`)
      }
      Bun.sleepSync(POLL_INTERVAL_MS)
    }
  }

  try {
    return fn()
  } finally {
    try { unlinkSync(path) } catch { /* ya liberado o robado por stale-lock */ }
  }
}
