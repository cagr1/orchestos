import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig, RoleUnassignedError, resolveRole } from '../config/load.ts'
import { handleApiConfigGet, handleApiConfigSet } from '../dashboard/handlers/config.ts'

const cwd = process.cwd()
afterEach(() => process.chdir(cwd))
const request = (body: unknown) =>
  new Request('http://localhost/api/config', { method: 'PUT', body: JSON.stringify(body) })
const temp = () => mkdtempSync(join(tmpdir(), 'model-roles-'))

describe('model roles config', () => {
  it('migrates legacy API model values in memory', () => {
    const root = temp()
    try {
      writeFileSync(
        join(root, 'orchestos.config.yaml'),
        'models:\n  planner: { provider: openrouter, model: p }\n  executor_heavy: { provider: openrouter, model: e }\n  qa: { provider: openrouter, model: q }\n',
      )
      const roles = loadOrcheConfig(root).roles
      expect(roles).toEqual({
        orchestrator: { agent: 'api', model: 'p', provider: 'openrouter' },
        executor: { agent: 'api', model: 'e', provider: 'openrouter' },
        reviewer: { agent: 'api', model: 'q', provider: 'openrouter' },
      })
      expect(roles.auxiliary).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('has no role defaults and gives the exact unassigned error', () => {
    const root = temp()
    try {
      const cfg = loadOrcheConfig(root)
      expect(cfg.roles).toEqual({})
      expect(() => resolveRole(cfg, 'executor')).toThrow(new RoleUnassignedError('executor'))
      try {
        resolveRole(cfg, 'executor')
      } catch (error) {
        expect((error as Error).message).toBe(
          "Rol 'executor' sin asignar: elígelo en Settings → Model routing",
        )
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('explicit role wins; invalid explicit role does not fall back to legacy', () => {
    const root = temp()
    try {
      writeFileSync(
        join(root, 'orchestos.config.yaml'),
        'models:\n  executor_heavy: { provider: openrouter, model: legacy }\n  qa: { provider: openrouter, model: legacy-qa }\nroles:\n  executor: { agent: codex, model: gpt-6-luna, effort: medium }\n  reviewer: { agent: foo, model: bad }\n',
      )
      const roles = loadOrcheConfig(root).roles
      expect(roles.executor).toEqual({ agent: 'codex', model: 'gpt-6-luna', effort: 'medium' })
      expect(roles.reviewer).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('explicit null leaves a legacy role unassigned without warning', () => {
    const root = temp()
    const error = spyOn(console, 'error').mockImplementation(() => {})
    try {
      writeFileSync(
        join(root, 'orchestos.config.yaml'),
        'models:\n  qa: { provider: openrouter, model: legacy-qa }\nroles:\n  reviewer: null\n',
      )
      expect(loadOrcheConfig(root).roles.reviewer).toBeUndefined()
      expect(error).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('PUT/GET persists role assignments without changing models or unrelated YAML; null deletes and invalid is atomic', async () => {
    const root = temp()
    const original =
      'custom: keep\nmodels:\n  default: { provider: openrouter, model: old }\n  executor_heavy: { provider: openrouter, model: legacy }\nagent: codex\n'
    try {
      writeFileSync(join(root, 'orchestos.config.yaml'), original)
      process.chdir(root)
      expect(
        (
          await handleApiConfigSet(
            request({
              roleAssignments: {
                executor: { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' },
              },
            }),
          )
        ).status,
      ).toBe(200)
      const read = (await (await handleApiConfigGet(root)).json()) as {
        roleAssignments: Record<string, unknown>
      }
      expect(read.roleAssignments.executor).toEqual({
        agent: 'codex',
        model: 'gpt-6-luna',
        effort: 'medium',
      })
      const yaml = readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')
      expect(yaml).toContain('custom: keep')
      expect(yaml).toContain('default: { provider: openrouter, model: old }')
      expect(yaml).toContain('agent: codex')
      expect(
        (await handleApiConfigSet(request({ roleAssignments: { executor: null } }))).status,
      ).toBe(200)
      expect(loadOrcheConfig(root).roles.executor).toBeUndefined()
      const bytes = readFileSync(join(root, 'orchestos.config.yaml'))
      expect(
        (
          await handleApiConfigSet(
            request({ roleAssignments: { executor: { agent: 'bad', model: 'x' } } }),
          )
        ).status,
      ).toBe(400)
      expect(readFileSync(join(root, 'orchestos.config.yaml'))).toEqual(bytes)
    } finally {
      process.chdir(cwd)
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('warns when reviewer and executor use the same agent and model', async () => {
    const root = temp()
    try {
      writeFileSync(
        join(root, 'orchestos.config.yaml'),
        'roles:\n  executor: { agent: codex, model: m }\n  reviewer: { agent: codex, model: m }\n',
      )
      const data = (await (await handleApiConfigGet(root)).json()) as { roleWarnings: string[] }
      expect(data.roleWarnings).toContain('reviewer-same-as-executor')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
