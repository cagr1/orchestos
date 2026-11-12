import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('AUD.22: two processes recovering the same dead owner never overlap (50 rounds)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aud22-lock-'))
  const lock = join(dir, 'lock')
  const events = join(dir, 'events')
  const worker = join(dir, 'worker.ts')
  const modulePath = join(import.meta.dir, '../run/file-lock.ts')
  writeFileSync(
    worker,
    `
    const fs = require('node:fs')
    const lock = process.argv[2], events = process.argv[3], index = process.argv[4]
    const read = fs.readFileSync
    let observed = false
    fs.readFileSync = (...args) => {
      const value = read(...args)
      if (args[0] === lock && String(value) === '2147483647:dead' && !observed) {
        observed = true
        fs.writeFileSync(events + '.ready.' + index, '')
        const deadline = Date.now() + 5000
        while (![0, 1].every(i => fs.existsSync(events + '.ready.' + i))) {
          if (Date.now() > deadline) throw new Error('recovery barrier timed out')
          Bun.sleepSync(1)
        }
        if (index === '1') Bun.sleepSync(20)
      }
      return value
    }
    const { withFileLock } = await import(${JSON.stringify(modulePath)})
    withFileLock(lock, () => {
      fs.appendFileSync(events, 'enter\\n')
      Bun.sleepSync(50)
      fs.appendFileSync(events, 'exit\\n')
    }, { pollIntervalMs: 1 })
  `,
  )

  try {
    for (let i = 0; i < 50; i++) {
      writeFileSync(lock, '2147483647:dead')
      utimesSync(lock, new Date(0), new Date(0))
      writeFileSync(events, '')
      for (const index of [0, 1]) rmSync(`${events}.ready.${index}`, { force: true })
      const children = [0, 1].map((index) =>
        Bun.spawn([process.execPath, worker, lock, events, String(index)], {
          stdout: 'ignore',
          stderr: 'pipe',
        }),
      )
      expect(await Promise.all(children.map((child) => child.exited))).toEqual([0, 0])
      expect(readFileSync(events, 'utf8')).toBe('enter\nexit\nenter\nexit\n')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 20000)
