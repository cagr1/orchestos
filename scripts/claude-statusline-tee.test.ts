import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

function runTee(payload: string, next?: string) {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-statusline-'))
  homes.push(home)
  const input = join(home, 'input.json')
  writeFileSync(input, payload)
  const script = join(process.cwd(), 'scripts/claude-statusline-tee.sh')
  const result = Bun.spawnSync(['sh', '-c', 'cat "$1" | "$2"', 'sh', input, script], {
    env: { ...process.env, ORCHESTOS_HOME: home, ORCHESTOS_STATUSLINE_NEXT: next ?? '' },
  })
  return { home, result }
}

describe('claude-statusline-tee', () => {
  test('persists rate limits and forwards the payload unchanged', () => {
    const payload = JSON.stringify({ rate_limits: { seven_day: { used_percentage: 18 } } })
    const next = join(tmpdir(), `orchestos-statusline-next-${Date.now()}.sh`)
    writeFileSync(next, '#!/bin/sh\ncat\n', { mode: 0o755 })
    try {
      const { home, result } = runTee(payload, next)
      expect(result.exitCode).toBe(0)
      expect(result.stdout.toString()).toBe(payload)
      expect(readFileSync(join(home, 'claude-statusline.json'), 'utf8')).toBe(payload)
    } finally {
      rmSync(next, { force: true })
    }
  })

  test('does not persist payloads without rate limits', () => {
    const { home, result } = runTee(JSON.stringify({ model: 'claude' }))
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe('')
    expect(() => readFileSync(join(home, 'claude-statusline.json'))).toThrow()
  })
})
