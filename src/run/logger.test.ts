import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RunLogger } from './logger.ts'

const roots: string[] = []

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-run-logger-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('RunLogger.write', () => {
  test('recreates a removed runs directory and writes the event', () => {
    const root = tempDir()
    const logger = new RunLogger(root, 't1')
    rmSync(join(root, 'runs'), { recursive: true })

    expect(() => logger.info('after cleanup')).not.toThrow()

    const files = readdirSync(join(root, 'runs'))
    expect(files).toHaveLength(1)
    const logFile = files[0]
    if (!logFile) throw new Error('expected a run log file')
    expect(readFileSync(join(root, 'runs', logFile), 'utf8')).toContain('INFO   after cleanup')
  })

  test('does not throw and warns only once when the path cannot be written', () => {
    const root = tempDir()
    const logger = new RunLogger(root, 't1')
    rmSync(join(root, 'runs'), { recursive: true })
    writeFileSync(join(root, 'runs'), 'regular file')
    const stderrWrite = spyOn(process.stderr, 'write').mockImplementation(() => true)

    expect(() => logger.info('first failure')).not.toThrow()
    expect(() => logger.info('second failure')).not.toThrow()

    expect(stderrWrite).toHaveBeenCalledTimes(1)
    expect(String(stderrWrite.mock.calls[0]?.[0])).toContain('[run-logger] no se pudo escribir')
    expect(existsSync(join(root, 'runs'))).toBe(true)
    stderrWrite.mockRestore()
  })
})
