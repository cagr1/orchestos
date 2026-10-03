import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig } from '../../config/load.ts'
import { handleApiOrchestrationGet, handleApiOrchestrationSet } from '../handlers/orchestration.ts'
import { handleApiTasksApproveSplit } from '../handlers/tasks.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function root() {
  const value = mkdtempSync(join(tmpdir(), 'orch-api-'))
  roots.push(value)
  return value
}

test('GET/PUT orchestration muestra estado, exige límites al activar y persiste por proyecto', async () => {
  const projectRoot = root()
  expect(handleApiOrchestrationGet(projectRoot, 'project-fixture').status).toBe(200)
  const invalid = await handleApiOrchestrationSet(
    new Request('http://localhost/api/orchestration', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'content-type': 'application/json' },
    }),
    projectRoot,
  )
  expect(invalid.status).toBe(400)
  const saved = await handleApiOrchestrationSet(
    new Request('http://localhost/api/orchestration', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, maxConcurrent: 2, maxTotal: 5 }),
      headers: { 'content-type': 'application/json' },
    }),
    projectRoot,
  )
  expect(saved.status).toBe(200)
  expect(loadOrcheConfig(projectRoot).orchestration).toEqual({
    enabled: true,
    maxConcurrent: 2,
    maxTotal: 5,
  })
})

test('approve-split apagado devuelve 409 antes de cualquier spawn', () => {
  const response = handleApiTasksApproveSplit(
    new URL('http://localhost/api/tasks/task-1/approve-split'),
    root(),
  )
  expect(response.status).toBe(409)
})
