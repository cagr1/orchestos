import { afterEach, describe, expect, it, mock } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer } from '../server.ts'
import { installShutdownSignals } from '../shutdown-signals.ts'

const targets: EventEmitter[] = []
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  targets.length = 0
})

function setup(cleanup: () => unknown, graceMs?: number) {
  const target = new EventEmitter()
  targets.push(target)
  const exit = mock((_code: number) => {})
  const uninstall = installShutdownSignals(cleanup, { target: target as never, exit, graceMs })
  cleanups.push(uninstall)
  return { target, exit, uninstall }
}

describe('USO.38 — shutdown signals', () => {
  it('runs cleanup once and exits with the matching signal code', async () => {
    for (const [signal, code] of [
      ['SIGINT', 130],
      ['SIGTERM', 143],
    ] as const) {
      const cleanup = mock(() => {})
      const { target, exit } = setup(cleanup)
      target.emit(signal)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(exit).toHaveBeenCalledWith(code)
    }
  })

  it('forces exit when cleanup never resolves', async () => {
    const { target, exit } = setup(() => new Promise(() => {}), 20)
    target.emit('SIGINT')
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(exit).toHaveBeenCalledWith(130)
  })

  it('exits immediately on a second signal while cleanup is pending', async () => {
    const cleanup = mock(() => new Promise(() => {}))
    const { target, exit } = setup(cleanup)
    target.emit('SIGINT')
    target.emit('SIGINT')
    expect(exit).toHaveBeenCalledWith(130)
    await Promise.resolve()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('exits with the signal code when cleanup throws', async () => {
    const { target, exit } = setup(() => {
      throw new Error('cleanup failure')
    })
    const error = mock(() => {})
    const originalError = console.error
    console.error = error
    try {
      target.emit('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      console.error = originalError
    }
    expect(exit).toHaveBeenCalledWith(143)
    expect(error).toHaveBeenCalled()
  })

  it('uninstalls SIGINT and SIGTERM listeners', () => {
    const { target, uninstall } = setup(() => {})
    uninstall()
    expect(target.listenerCount('SIGINT')).toBe(0)
    expect(target.listenerCount('SIGTERM')).toBe(0)
  })

  it('startServer stop leaves no additional process signal listeners', () => {
    const home = mkdtempSync(join(tmpdir(), 'uso38-dashboard-'))
    const previousHome = process.env.ORCHESTOS_HOME
    const previousUsage = process.env.ORCHESTOS_CLAUDE_USAGE_LIVE
    process.env.ORCHESTOS_HOME = home
    process.env.ORCHESTOS_CLAUDE_USAGE_LIVE = '0'
    const before = {
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
    }
    try {
      const { server } = startServer(0)
      server.stop(true)
      expect(process.listenerCount('SIGINT')).toBe(before.SIGINT)
      expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM)
    } finally {
      if (previousHome === undefined) delete process.env.ORCHESTOS_HOME
      else process.env.ORCHESTOS_HOME = previousHome
      if (previousUsage === undefined) delete process.env.ORCHESTOS_CLAUDE_USAGE_LIVE
      else process.env.ORCHESTOS_CLAUDE_USAGE_LIVE = previousUsage
      rmSync(home, { recursive: true, force: true })
    }
  })
})
