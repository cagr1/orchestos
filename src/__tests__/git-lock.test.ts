import { describe, it, expect } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { withGitLock } from '../run/git-lock.ts'

// Mes 22/E.5 — el lock existe para serializar procesos SEPARADOS (dashboard
// server + subprocesos `task run`), así que el caso de prueba real es
// mutex entre llamadas concurrentes, no solo "existe y funciona una vez".
describe('git-lock', () => {
  it('ejecuta la función y libera el lock (caso simple)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-lock-'))
    try {
      const result = withGitLock(dir, () => 42)
      expect(result).toBe(42)
      expect(existsSync(join(dir, '.orchestos', 'git.lock'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('serializa dos PROCESOS separados — nunca se solapan (el caso real: dashboard server + subproceso task run)', async () => {
    // Bun.sleepSync es bloqueante dentro de UN proceso — dos llamadas dentro
    // del mismo test correrían estrictamente en secuencia sin importar si el
    // lock funciona (JS de un solo hilo), lo que haría la aserción trivial.
    // El bug real (IDEAS #48) es entre dos PROCESOS del SO distintos, así que
    // el test tiene que serlo también: dos subprocesos Bun reales, cada uno
    // toma el lock, escribe enter/exit con timestamps a un archivo compartido,
    // y el padre verifica que los intervalos nunca se solapan.
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-lock-'))
    const resultsFile = join(dir, 'events.jsonl')
    const workerScript = join(dir, 'worker.ts')
    try {
      writeFileSync(workerScript, `
        import { withGitLock } from ${JSON.stringify(join(import.meta.dir, '..', 'run', 'git-lock.ts'))}
        import { appendFileSync } from 'fs'
        const label = process.argv[2]
        const resultsFile = process.argv[3]
        const dir = process.argv[4]
        withGitLock(dir, () => {
          appendFileSync(resultsFile, JSON.stringify({ label, kind: 'enter', t: Date.now() }) + '\\n')
          Bun.sleepSync(150)
          appendFileSync(resultsFile, JSON.stringify({ label, kind: 'exit', t: Date.now() }) + '\\n')
        })
      `)

      const spawnWorker = (label: string) => Bun.spawn(
        [process.execPath, 'run', workerScript, label, resultsFile, dir],
        { stdout: 'pipe', stderr: 'pipe' },
      )

      const procA = spawnWorker('A')
      const procB = spawnWorker('B')
      await Promise.all([procA.exited, procB.exited])

      const lines = require('fs').readFileSync(resultsFile, 'utf-8').trim().split('\n')
      const events = lines.map((l: string) => JSON.parse(l)) as { label: string; kind: string; t: number }[]
      expect(events.length).toBe(4) // A:enter, A:exit, B:enter, B:exit (en algún orden)

      const interval = (label: string) => {
        const enter = events.find(e => e.label === label && e.kind === 'enter')!.t
        const exit = events.find(e => e.label === label && e.kind === 'exit')!.t
        return { enter, exit }
      }
      const a = interval('A'), b = interval('B')
      // Sin mutex, ambos entrarían casi al mismo tiempo (spawneados juntos) y
      // sus ventanas [enter,exit] de 150ms se solaparían. Con el lock, uno
      // termina completamente antes de que el otro empiece.
      const noOverlap = a.exit <= b.enter || b.exit <= a.enter
      expect(noOverlap).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 10_000)

  it('un lock viejo (stale) se libera solo — no bloquea para siempre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-lock-'))
    try {
      const lockDir = join(dir, '.orchestos')
      const lockFile = join(lockDir, 'git.lock')
      require('fs').mkdirSync(lockDir, { recursive: true })
      writeFileSync(lockFile, '')
      // Retrocede el mtime más allá de STALE_LOCK_MS (60s) — simula un
      // proceso dueño que murió sin liberar el lock.
      const old = new Date(Date.now() - 120_000)
      require('fs').utimesSync(lockFile, old, old)

      const result = withGitLock(dir, () => 'recovered')
      expect(result).toBe('recovered')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
