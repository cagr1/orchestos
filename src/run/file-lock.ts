import { randomUUID } from 'node:crypto'
import {
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

interface FileLockOptions {
  waitTimeoutMs?: number
  staleMs?: number
  pollIntervalMs?: number
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function ownerIsAlive(path: string): boolean | null {
  try {
    const value = readFileSync(path, 'utf8').trim()
    const pid = Number(value.split(':', 1)[0])
    if (!Number.isInteger(pid) || pid <= 0) return null
    return isProcessAlive(pid)
  } catch {
    return null
  }
}

export function withFileLock<T>(path: string, fn: () => T, options: FileLockOptions = {}): T {
  const waitTimeoutMs = options.waitTimeoutMs ?? 30_000
  const staleMs = options.staleMs ?? 60_000
  const pollIntervalMs = options.pollIntervalMs ?? 50
  mkdirSync(dirname(path), { recursive: true })
  const token = `${process.pid}:${randomUUID()}`
  const tempPrefix = `${basename(path)}.`
  for (const name of readdirSync(dirname(path))) {
    if (!name.startsWith(tempPrefix) || !name.endsWith('.tmp')) continue
    const pid = Number(name.slice(tempPrefix.length).split('.', 1)[0])
    if (isProcessAlive(pid)) continue
    try {
      unlinkSync(join(dirname(path), name))
    } catch {
      /* Another process removed the orphaned temporary. */
    }
  }
  const start = Date.now()

  while (true) {
    const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    writeFileSync(tempPath, token)
    try {
      try {
        linkSync(tempPath, path)
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    } finally {
      try {
        unlinkSync(tempPath)
      } catch {
        /* Temporary was already removed. */
      }
    }
    try {
      const age = Date.now() - statSync(path).mtimeMs
      const owner = ownerIsAlive(path)
      if (age > pollIntervalMs && owner === false) {
        try {
          unlinkSync(path)
        } catch {
          /* another process recovered it */
        }
        continue
      }
      if (age > staleMs && owner === null) {
        try {
          unlinkSync(path)
        } catch {
          /* another process recovered it */
        }
        continue
      }
    } catch {
      /* Lock disappeared while inspecting it; retry acquisition. */
    }
    if (Date.now() - start > waitTimeoutMs)
      throw new Error(`file-lock: timeout waiting for ${path}`)
    Bun.sleepSync(pollIntervalMs)
  }

  try {
    return fn()
  } finally {
    try {
      if (readFileSync(path, 'utf8') === token) unlinkSync(path)
    } catch {
      /* Lock was already released or recovered by another process. */
    }
  }
}
