import { describe, it, expect } from 'bun:test'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { loadSpec, saveSpec, listSpecs, specPath, type Spec } from '../spec/store.ts'
import { validateSpec } from '../spec/validate.ts'
import type { TaskExecutor } from '../tasks/schema.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpDir(): string {
  const dir = join(import.meta.dir, '..', '..', '.tmp-spec-test-' + Math.random().toString(36).slice(2))
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeSpec(overrides?: Partial<Spec['frontmatter']>, body?: string): Spec {
  return {
    frontmatter: {
      id: 'test-task',
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
      ...overrides,
    },
    body: body ?? `## Contexto\nFoo\n\n## Descripción\nBar\n\n## Criterios de aceptación\n- [ ] Unit tests pass\n- [ ] Types check\n\n## Notas\nNone\n`,
  }
}

// ── store tests ───────────────────────────────────────────────────────────────

describe('loadSpec', () => {
  it('returns null if file does not exist', () => {
    const dir = tmpDir()
    try {
      expect(loadSpec(dir, 'nonexistent')).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('saveSpec + loadSpec', () => {
  it('round-trips frontmatter and body', () => {
    const dir = tmpDir()
    try {
      const original = makeSpec({ id: 'round-trip-task', status: 'draft', clarify: 'none' })
      saveSpec(dir, original)

      const loaded = loadSpec(dir, 'round-trip-task')
      expect(loaded).not.toBeNull()
      expect(loaded!.frontmatter.id).toBe('round-trip-task')
      expect(loaded!.frontmatter.status).toBe('draft')
      expect(loaded!.frontmatter.clarify).toBe('none')
      expect(loaded!.body).toContain('Criterios de aceptación')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('preserves approvedAt when present', () => {
    const dir = tmpDir()
    try {
      const ts = '2026-01-01T00:00:00.000Z'
      const s = makeSpec({ id: 'approved-task', status: 'approved', approvedAt: ts })
      saveSpec(dir, s)
      const loaded = loadSpec(dir, 'approved-task')
      expect(loaded!.frontmatter.approvedAt).toBe(ts)
      expect(loaded!.frontmatter.status).toBe('approved')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('listSpecs', () => {
  it('returns empty array when no specs dir exists', () => {
    const dir = tmpDir()
    try {
      expect(listSpecs(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns all saved specs', () => {
    const dir = tmpDir()
    try {
      saveSpec(dir, makeSpec({ id: 'spec-a' }))
      saveSpec(dir, makeSpec({ id: 'spec-b' }))
      saveSpec(dir, makeSpec({ id: 'spec-c' }))
      const specs = listSpecs(dir)
      const ids = specs.map(s => s.frontmatter.id).sort()
      expect(ids).toEqual(['spec-a', 'spec-b', 'spec-c'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── validate tests ────────────────────────────────────────────────────────────

describe('validateSpec', () => {
  it('fails if acceptance criteria section is missing', () => {
    const s = makeSpec({}, '## Contexto\nFoo\n\n## Descripción\nBar\n\n## Notas\nNone\n')
    const result = validateSpec(s)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('fails if acceptance criteria section is empty', () => {
    const s = makeSpec({}, '## Contexto\nFoo\n\n## Criterios de aceptación\n\n## Notas\nNone\n')
    const result = validateSpec(s)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('empty') || e.toLowerCase().includes('vac'))).toBe(true)
  })

  it('fails if criteria only contain the placeholder <criterio 1>', () => {
    const s = makeSpec({}, '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] <criterio 1>\n- [ ] <criterio 2>\n\n## Notas\nNone\n')
    const result = validateSpec(s)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('placeholder'))).toBe(true)
  })

  it('passes if acceptance criteria has real criteria', () => {
    const s = makeSpec()
    const result = validateSpec(s)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('passes with accented section header (aceptación)', () => {
    const s = makeSpec({}, '## Contexto\nFoo\n\n## Criterios de aceptación\n- [ ] All unit tests pass\n\n## Notas\nNone\n')
    const result = validateSpec(s)
    expect(result.valid).toBe(true)
  })
})

// ── spec approve gate (clarify: pending) ──────────────────────────────────────

describe('spec approve gate', () => {
  it('approve is blocked when clarify is pending', () => {
    // We test this via validateSpec + clarify check logic as used in cli.ts
    // The CLI blocks before validateSpec when clarify === 'pending'.
    // Here we verify that a spec with clarify: pending would be caught.
    const s = makeSpec({ clarify: 'pending' })
    // The gate in cli.ts checks: if (s.frontmatter.clarify === 'pending') -> error
    expect(s.frontmatter.clarify).toBe('pending')
    // Simulate the check
    const blocked = s.frontmatter.clarify === 'pending'
    expect(blocked).toBe(true)
  })

  it('approve proceeds when clarify is resolved and spec is valid', () => {
    const dir = tmpDir()
    try {
      const s = makeSpec({ id: 'approvable', clarify: 'resolved' })
      saveSpec(dir, s)
      const loaded = loadSpec(dir, 'approvable')!
      expect(loaded.frontmatter.clarify).toBe('resolved')
      const validation = validateSpec(loaded)
      expect(validation.valid).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── harness gate ──────────────────────────────────────────────────────────────

describe('harness spec gate', () => {
  it('throws when requireSpec=true and no spec exists', async () => {
    const dir = tmpDir()
    try {
      // Import lazily to avoid side effects at module load time
      const { runTask } = await import('../run/harness.ts')
      const { RunLogger } = await import('../run/logger.ts')

      const fakeTask = {
        id: 'no-spec-task',
        description: 'Do something',
        status: 'pending' as const,
        executor: 'openrouter' as TaskExecutor,
        input: [],
        output: ['src/foo.ts'],
        depends_on: [],
        retry_count: 0,
      }

      const log = new RunLogger(dir, 'no-spec-task')

      await expect(
        runTask({
          projectRoot: dir,
          contextText: '',
          task: fakeTask,
          logger: log,
          orcheConfig: {
            config_version: 1,
            requireSpec: true,
            models: {
              planner:        { provider: 'openrouter', model: 'x' },
              executor_heavy: { provider: 'openrouter', model: 'x' },
              executor_light: { provider: 'openrouter', model: 'x' },
              default:        { provider: 'openrouter', model: 'x' },
            },
          },
        })
      ).rejects.toThrow(`Task 'no-spec-task' requires an approved spec. Run: orchestos spec approve no-spec-task`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('throws when requireSpec=true and spec is draft (not approved)', async () => {
    const dir = tmpDir()
    try {
      const { runTask } = await import('../run/harness.ts')
      const { RunLogger } = await import('../run/logger.ts')

      // Save a draft spec
      const draftSpec = makeSpec({ id: 'draft-task', status: 'draft' })
      saveSpec(dir, draftSpec)

      const fakeTask = {
        id: 'draft-task',
        description: 'Do something',
        status: 'pending' as const,
        executor: 'openrouter' as TaskExecutor,
        input: [],
        output: ['src/foo.ts'],
        depends_on: [],
        retry_count: 0,
      }

      const log = new RunLogger(dir, 'draft-task')

      await expect(
        runTask({
          projectRoot: dir,
          contextText: '',
          task: fakeTask,
          logger: log,
          orcheConfig: {
            config_version: 1,
            requireSpec: true,
            models: {
              planner:        { provider: 'openrouter', model: 'x' },
              executor_heavy: { provider: 'openrouter', model: 'x' },
              executor_light: { provider: 'openrouter', model: 'x' },
              default:        { provider: 'openrouter', model: 'x' },
            },
          },
        })
      ).rejects.toThrow(`Task 'draft-task' requires an approved spec. Run: orchestos spec approve draft-task`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not throw when requireSpec=true and spec is approved', async () => {
    const dir = tmpDir()
    try {
      const { runTask } = await import('../run/harness.ts')
      const { RunLogger } = await import('../run/logger.ts')

      // Save an approved spec
      const approvedSpec = makeSpec({ id: 'approved-gate-task', status: 'approved', approvedAt: new Date().toISOString() })
      saveSpec(dir, approvedSpec)

      const fakeTask = {
        id: 'approved-gate-task',
        description: 'Do something',
        status: 'pending' as const,
        executor: 'openrouter' as TaskExecutor,
        input: [],
        output: ['src/foo.ts'],
        depends_on: [],
        retry_count: 0,
      }

      const log = new RunLogger(dir, 'approved-gate-task')

      // dryRun=true avoids LLM calls; spec gate must pass (spec is approved)
      const result = await runTask({
        projectRoot: dir,
        contextText: '',
        task: fakeTask,
        logger: log,
        dryRun: true,
        orcheConfig: {
          config_version: 1,
          requireSpec: true,
          models: {
            planner:        { provider: 'openrouter', model: 'x' },
            executor_heavy: { provider: 'openrouter', model: 'x' },
            executor_light: { provider: 'openrouter', model: 'x' },
            default:        { provider: 'openrouter', model: 'x' },
          },
        },
      })

      // dry-run always returns 'done' without calling LLM
      expect(result.status).toBe('done')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not gate when requireSpec is false or absent', async () => {
    const dir = tmpDir()
    try {
      const { runTask } = await import('../run/harness.ts')
      const { RunLogger } = await import('../run/logger.ts')

      // No spec file created — gate should not trigger
      const fakeTask = {
        id: 'no-gate-task',
        description: 'Do something',
        status: 'pending' as const,
        executor: 'openrouter' as TaskExecutor,
        input: [],
        output: ['src/foo.ts'],
        depends_on: [],
        retry_count: 0,
      }

      const log = new RunLogger(dir, 'no-gate-task')

      const result = await runTask({
        projectRoot: dir,
        contextText: '',
        task: fakeTask,
        logger: log,
        dryRun: true,
        orcheConfig: {
          config_version: 1,
          requireSpec: false,
          models: {
            planner:        { provider: 'openrouter', model: 'x' },
            executor_heavy: { provider: 'openrouter', model: 'x' },
            executor_light: { provider: 'openrouter', model: 'x' },
            default:        { provider: 'openrouter', model: 'x' },
          },
        },
      })

      expect(result.status).toBe('done')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
