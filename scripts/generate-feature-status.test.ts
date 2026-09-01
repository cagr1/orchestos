import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateFeatureStatus } from './generate-feature-status.ts'

let dir: string | null = null

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

describe('generateFeatureStatus', () => {
  test('escribe .orchestos/feature-status.json derivado de PLAN.md', () => {
    dir = mkdtempSync(join(tmpdir(), 'plan-status-'))
    writeFileSync(
      join(dir, 'PLAN.md'),
      '## MES X\n\n### Bloque A\n\n- [ ] **A.1 — 🧠 Título de prueba.** cuerpo\n',
    )

    const outPath = generateFeatureStatus(dir)
    const parsed = JSON.parse(readFileSync(outPath, 'utf-8'))

    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].id).toBe('A.1')
    expect(parsed.items[0].status).toBe('open')
  })
})
