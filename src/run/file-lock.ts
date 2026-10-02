import { randomUUID } from 'crypto'
import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'fs'
import { dirname } from 'path'

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
  const start = Date.now()

  while (true) {
    try {
      const fd = openSync(path, 'wx')
      try {
        writeSync(fd, token)
      } finally {
        closeSync(fd)
      }
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
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
