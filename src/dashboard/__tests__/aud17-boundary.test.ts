import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { db } from '../../db/sqlite.ts'
import { getSkillPath } from '../../skills/registry.ts'
import { handleApiChat } from '../handlers/chat.ts'
import {
  handleApiInstinctsBulkDelete,
  handleApiInstinctsCreate,
  handleApiInstinctsPropose,
  handleApiInstinctsSetConfidence,
} from '../handlers/instincts.ts'
import { __resetDepsForTests, __setDepsForTests, handleApiRunGraph } from '../handlers/run-graph.ts'
import { handleApiSettingsPost } from '../handlers/setup.ts'
import { handleApiSkillsDelete } from '../handlers/skills.ts'
import {
  handleApiSpecsBulkDelete,
  handleApiSpecsCreate,
  handleApiSpecsDraft,
} from '../handlers/specs.ts'
import { handleApiSystemReset } from '../handlers/system.ts'
import {
  handleApiTasksBulkDelete,
  handleApiTasksCommitRun,
  handleApiTasksCreate,
  handleApiTasksRun,
} from '../handlers/tasks.ts'
import { envFilePath, writeEnv } from '../settings-store.ts'

let root: string
const originalHome = process.env.ORCHESTOS_HOME
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aud17-body-'))
  process.env.ORCHESTOS_HOME = root
})
afterEach(() => {
  __resetDepsForTests()
  db.run('DELETE FROM task_run_watch WHERE root = ?', [root])
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
  rmSync(root, { recursive: true, force: true })
})

function request(body: unknown, path = '/api/test'): Request {
  return new Request(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body) })
}
async function rejected(response: Promise<Response>) {
  const res = await response
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBeString()
}

for (const body of [
  { OPENROUTER_API_KEY: 'a\nANTHROPIC_API_KEY=b' },
  { OPENROUTER_API_KEY: 'a\rb' },
  { OPENROUTER_API_KEY: 5 },
  null,
]) {
  test(`settings rejects ${JSON.stringify(body)} without changing .env`, async () => {
    writeEnv({ OLLAMA_HOST: 'original' })
    const before = readFileSync(envFilePath(), 'utf8')
    const res = await handleApiSettingsPost(request(body))
    expect(res.status).toBe(400)
    const error = (await res.json()).error
    expect(error).toBeString()
    if (typeof body?.OPENROUTER_API_KEY === 'string') {
      expect(error).toBe('OPENROUTER_API_KEY must be a single line')
    }
    expect(readFileSync(envFilePath(), 'utf8')).toBe(before)
  })
}
test('settings keeps valid writes, masking, deletion and ignored keys', async () => {
  const value = ['fixture', 'valid'].join('-')
  expect(
    (await handleApiSettingsPost(request({ OPENROUTER_API_KEY: value, UNKNOWN: 5 }))).status,
  ).toBe(200)
  expect(readFileSync(envFilePath(), 'utf8')).toBe(`OPENROUTER_API_KEY=${value}\n`)
  expect((await handleApiSettingsPost(request({ OPENROUTER_API_KEY: '••masked' }))).status).toBe(
    200,
  )
  expect(readFileSync(envFilePath(), 'utf8')).toBe(`OPENROUTER_API_KEY=${value}\n`)
  expect((await handleApiSettingsPost(request({ OPENROUTER_API_KEY: '' }))).status).toBe(200)
  expect(readFileSync(envFilePath(), 'utf8')).toBe('\n')
})
const invalidEnvRecords: Record<string, string>[] = [
  { K: 'a\nb' },
  { K: 'a\rb' },
  { 'K\nBAD': 'v' },
  { 'K\rBAD': 'v' },
]
for (const data of invalidEnvRecords) {
  test(`writeEnv refuses line breaks ${JSON.stringify(data)}`, () => {
    writeEnv({ K: 'before' })
    expect(() => writeEnv(data)).toThrow('must be a single line')
    expect(readFileSync(envFilePath(), 'utf8')).toBe('K=before\n')
  })
}

const url = new URL('http://localhost/api/tasks/t1/run')
const invalidHandlers: [string, () => Promise<Response>][] = [
  ['tasks create', () => handleApiTasksCreate(request({ description: 5 }), root)],
  ['tasks run', () => handleApiTasksRun(request({ model: 5 }), url, root)],
  ['tasks commit-run', () => handleApiTasksCommitRun(request({ files: 'x' }), url, root)],
  ['tasks bulk', () => handleApiTasksBulkDelete(request({ ids: 'x' }), root)],
  ['instinct create', () => handleApiInstinctsCreate(request({ trigger: [], action: 'x' }))],
  ['instinct propose', () => handleApiInstinctsPropose(request({ trigger: 'x', action: 5 }))],
  [
    'instinct confidence',
    () => handleApiInstinctsSetConfidence(request({ confidence: null }), url),
  ],
  ['instinct bulk', () => handleApiInstinctsBulkDelete(request({ ids: 'x' }))],
  ['spec draft', () => handleApiSpecsDraft(request({ taskId: {}, description: 'x' }), root)],
  ['spec create', () => handleApiSpecsCreate(request({ design: 'yes' }, '/api/specs/t1'), root)],
  ['spec bulk', () => handleApiSpecsBulkDelete(request({ ids: 'x' }), root)],
  ['chat', () => handleApiChat(request({ message: 5 }))],
  [
    'graph null',
    () => {
      __setDepsForTests({ tasksExist: () => true })
      return handleApiRunGraph(request(null), root)
    },
  ],
  [
    'graph field',
    () => {
      __setDepsForTests({ tasksExist: () => true })
      return handleApiRunGraph(request({ maxCost: '5' }), root)
    },
  ],
  ['system null', () => handleApiSystemReset(request(null), root, 'aud17-fixture')],
  ['system field', () => handleApiSystemReset(request({ confirm: 'yes' }), root, 'aud17-fixture')],
  [
    'skills null',
    () => {
      const path = getSkillPath('aud17-fixture', root)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, 'fixture')
      return handleApiSkillsDelete(
        request(null),
        new URL('http://localhost/api/skills/aud17-fixture'),
        root,
      )
    },
  ],
  [
    'skills field',
    () => {
      const path = getSkillPath('aud17-fixture', root)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, 'fixture')
      return handleApiSkillsDelete(
        request({ confirm: 1 }),
        new URL('http://localhost/api/skills/aud17-fixture'),
        root,
      )
    },
  ],
]
for (const [name, invoke] of invalidHandlers)
  test(`${name} rejects invalid types`, () => rejected(invoke()))
for (const confidence of ['', '0.5', -1, 2]) {
  test(`confidence rejects ${JSON.stringify(confidence)}`, () =>
    rejected(handleApiInstinctsSetConfidence(request({ confidence }), url)))
}
for (const body of [null, [], 'x']) {
  test(`chat keeps non-object message for ${JSON.stringify(body)}`, async () => {
    const res = await handleApiChat(request(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'JSON body must be an object' })
  })
}
for (const body of [undefined, '{broken']) {
  test(`tasks run still accepts optional body ${body}`, async () => {
    writeFileSync(
      join(root, 'tasks.yaml'),
      'version: 1\nproject: aud17\ntasks:\n  - id: t1\n    description: fixture\n    output: [out.txt]\n',
    )
    writeFileSync(
      join(root, 'orchestos.config.yaml'),
      'roles:\n  executor: { agent: codex, model: fixture-model }\n  reviewer: { agent: codex, model: fixture-model }\n',
    )
    const spawn = spyOn(Bun, 'spawn').mockReturnValue({
      pid: 2147483647,
      exited: new Promise(() => {}),
    } as ReturnType<typeof Bun.spawn>)
    try {
      const res = await handleApiTasksRun(new Request(url, { method: 'POST', body }), url, root)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, id: 't1' })
      expect(spawn).toHaveBeenCalledTimes(1)
    } finally {
      spawn.mockRestore()
    }
  })
}

test('spec create rejects malformed JSON while an absent body remains optional', async () => {
  const res = await handleApiSpecsCreate(
    new Request('http://localhost/api/specs/t1', { method: 'POST', body: '{broken' }),
    root,
  )
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: 'Invalid JSON' })
  expect(
    (
      await handleApiSpecsCreate(
        new Request('http://localhost/api/specs/t1', { method: 'POST' }),
        root,
      )
    ).status,
  ).toBe(200)
})
