/**
 * H.4 (hallazgo colateral) — handleApiConfigGet() no debe tirar 500 cuando
 * tasks.yaml tiene una tarea malformada. Mismo patrón de aislamiento que
 * config-set-executor-mode.test.ts: process.chdir() a un dir temporal,
 * SIEMPRE restaurado en finally, para no tocar el tasks.yaml/config real
 * del repo durante la suite.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { handleApiConfigGet } from '../dashboard/handlers/config.ts'

const originalCwd = process.cwd()
afterEach(() => process.chdir(originalCwd))

describe('handleApiConfigGet — resiliencia ante tasks.yaml malformado', () => {
  it('tasks.yaml con una tarea con output:[] inválido → 200, pendingRouting vacío (no 500)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-h4-cfggetres-'))
    try {
      process.chdir(dir)
      writeFileSync(
        join(dir, 'tasks.yaml'),
        `
project: test
tasks:
  - id: broken-task
    description: tarea malformada a propósito
    output: []
    executor: anthropic
    status: pending
    retry_count: 0
`,
        'utf-8',
      )

      const res = await handleApiConfigGet()
      expect(res.status).toBe(200)
      const data = (await res.json()) as { pendingRouting: unknown[] }
      expect(data.pendingRouting).toEqual([])
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('tasks.yaml válido con una tarea pending → pendingRouting la incluye normalmente', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-h4-cfggetres-ok-'))
    try {
      process.chdir(dir)
      writeFileSync(
        join(dir, 'tasks.yaml'),
        `
project: test
tasks:
  - id: valid-task
    description: tarea válida
    output: [out.txt]
    executor: openrouter
    status: pending
    retry_count: 0
`,
        'utf-8',
      )

      const res = await handleApiConfigGet()
      expect(res.status).toBe(200)
      const data = (await res.json()) as { pendingRouting: Array<{ id: string }> }
      expect(data.pendingRouting.map((r) => r.id)).toEqual(['valid-task'])
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
