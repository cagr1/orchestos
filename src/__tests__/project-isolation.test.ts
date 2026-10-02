import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function runWithTemporaryHome(script: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-isolation-db-'))
  try {
    const proc = Bun.spawn(['bun', '-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, ORCHESTOS_HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    return JSON.parse(stdout) as Record<string, unknown>
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('project ownership', () => {
  it('resolves scope and keeps instincts project-local in a temporary database', async () => {
    const result = await runWithTemporaryHome(`
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { randomUUID } = await import('node:crypto')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { ownsRow, requestScope } = await import('./src/dashboard/ownership.ts')
      const instincts = await import('./src/instincts/store.ts')
      runMigrations()
      const aId = randomUUID(), bId = randomUUID()
      const rootA = join(process.env.ORCHESTOS_HOME, 'a')
      const rootB = join(process.env.ORCHESTOS_HOME, 'b')
      mkdirSync(rootA); mkdirSync(rootB)
      const now = new Date().toISOString()
      for (const [id, root] of [[aId, rootA], [bId, rootB]]) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, root, '{}', '', now],
      )
      const a = requestScope(new Request('http://localhost/api/runs', { headers: { 'x-orchestos-project-id': aId } }))
      const none = requestScope(new Request('http://localhost/api/runs?project=none'))
      const ia = instincts.insertInstinct({ trigger: 'same-trigger', action: 'A', confidence: 1, source: 'manual', verified: true, projectId: aId })
      const ib = instincts.insertInstinct({ trigger: 'same-trigger', action: 'B', confidence: 1, source: 'manual', verified: true, projectId: bId })
      const old = instincts.insertInstinct({ trigger: 'historical', action: 'old', confidence: 1, source: 'manual', verified: true })
      process.stdout.write(JSON.stringify({
        scopeProject: a.id, scopeNone: none.kind, ownsA: ownsRow(a, aId), rejectsB: !ownsRow(a, bId),
        visibleA: instincts.listInstincts({ projectId: aId }).map((row) => row.id).sort(),
        expectedVisibleA: [ia.id, old.id].sort(), applicableA: instincts.listApplicable(aId).map((row) => row.id),
        applicableB: instincts.listApplicable(bId).map((row) => row.id), applicableNone: instincts.listApplicable(null),
        expectedA: ia.id, expectedB: ib.id, historicalProject: old.project_id,
      }))
      db.close()
    `)
    expect(result.scopeProject).toBeDefined()
    expect(result.scopeNone).toBe('none')
    expect(result.ownsA).toBe(true)
    expect(result.rejectsB).toBe(true)
    expect(result.visibleA).toEqual(result.expectedVisibleA)
    expect(result.applicableA).toEqual([result.expectedA])
    expect(result.applicableB).toEqual([result.expectedB])
    expect(result.applicableNone).toEqual([])
    expect(result.historicalProject).toBeNull()
  })

  it('enforces route ownership for sessions and keeps archived history unscoped when requested', async () => {
    const result = await runWithTemporaryHome(`
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      const home = process.env.ORCHESTOS_HOME
      const rootA = join(home, 'project-a')
      const rootB = join(home, 'project-b')
      mkdirSync(rootA); mkdirSync(rootB)
      const now = new Date().toISOString()
      for (const [id, root] of [['iso-a', rootA], ['iso-b', rootB]]) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, root, '{}', '', now],
      )
      const a = sessions.createChatSession({ projectId: 'iso-a', agent: 'api', title: 'A sentinel' })
      const b = sessions.createChatSession({ projectId: 'iso-b', agent: 'api', title: 'B sentinel' })
      sessions.appendChatExchange({ sessionId: b.id, userContent: 'private B message', assistantContent: 'private B reply', model: 'test' })
      sessions.archiveChatSession(b.id)
      const req = (path, method = 'GET', body) => route(new Request('http://localhost:50852' + path, {
        method,
        headers: { 'x-orchestos-project-id': 'iso-a', ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }), 50852)
      const list = await req('/api/chat/sessions')
      const archivedAll = await route(new Request('http://localhost:50852/api/chat/sessions?archived=1'), 50852)
      const foreignReads = []
      foreignReads.push((await req('/api/chat/sessions/' + b.id + '/messages')).status)
      foreignReads.push((await req('/api/chat/sessions/' + b.id + '/timeline')).status)
      foreignReads.push((await req('/api/chat/sessions/' + b.id + '/console')).status)
      foreignReads.push((await req('/api/chat/sessions/' + b.id, 'PATCH', { title: 'changed' })).status)
      foreignReads.push((await req('/api/chat/sessions/' + b.id, 'DELETE')).status)
      foreignReads.push((await req('/api/chat/sessions/' + b.id + '/restore', 'POST', {})).status)
      const chatPost = await req('/api/chat', 'POST', { sessionId: b.id, message: 'should not persist' })
      const noProjectSteps = await route(new Request('http://localhost:50852/api/tasks/task-b/steps?project=none'), 50852)
      const bAfter = sessions.getChatSession(b.id)
      const bMessages = sessions.listChatMessages(b.id)
      const listRows = await list.json()
      const archivedRows = await archivedAll.json()
      process.stdout.write(JSON.stringify({
        listIds: listRows.map((row) => row.id), archivedIds: archivedRows.map((row) => row.id),
        foreignReads, chatPost: chatPost.status, noProjectSteps: noProjectSteps.status, bTitle: bAfter.title,
        bMessageCount: bMessages.length, expectedB: b.id, expectedA: a.id,
      }))
      db.close()
    `)
    expect(result.listIds).toContain(result.expectedA)
    expect(result.listIds).not.toContain(result.expectedB)
    expect(result.archivedIds).toContain(result.expectedB)
    expect(result.foreignReads).toEqual([404, 404, 404, 404, 404, 404])
    expect(result.chatPost).toBe(404)
    expect(result.noProjectSteps).toBe(404)
    expect(result.bTitle).toBe('B sentinel')
    expect(result.bMessageCount).toBe(2)
  })

  it('isolates project list endpoints and mixed bulk deletes through route()', async () => {
    const result = await runWithTemporaryHome(`
      const { mkdirSync, readdirSync, readFileSync, writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { insertRun } = await import('./src/db/runs.ts')
      const { upsertMemory, insertConflict } = await import('./src/db/memory.ts')
      const { insertInstinct } = await import('./src/instincts/store.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      const home = process.env.ORCHESTOS_HOME
      const rootA = join(home, 'project-a'), rootB = join(home, 'project-b')
      mkdirSync(join(rootA, 'skills'), { recursive: true }); mkdirSync(join(rootB, 'skills'), { recursive: true })
      const now = new Date().toISOString()
      for (const [id, root] of [['iso-a', rootA], ['iso-b', rootB]]) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, root, '{}', '', now],
      )
      const skillFile = readdirSync(join(process.cwd(), 'skills')).find((name) => name.endsWith('.yaml'))
      const sharedSkill = readFileSync(join(process.cwd(), 'skills', skillFile), 'utf8')
      writeFileSync(join(rootA, 'skills', skillFile), sharedSkill)
      writeFileSync(join(rootB, 'skills', 'only-b.yaml'), ['id: only-b', 'version: 1.0.0', 'name: B private', 'description: B private skill', 'instructions: private instructions', 'targets: [claude]', ''].join('\\n'))
      const run = (projectId, prompt, skillId = null) => insertRun({
        project_id: projectId, prompt, task_class: 'implement', model: 'test', provider: 'test', skill_id: skillId,
        task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null,
        snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null, status: 'done',
        input_tokens: 1, output_tokens: 1, usd_cost: 0, elapsed_ms: 1, result: null,
      })
      const runA = run('iso-a', 'run sentinel alpha', skillFile.replace(/\\.ya?ml$/, ''))
      const runB = run('iso-b', 'run sentinel beta', skillFile.replace(/\\.ya?ml$/, ''))
      const runNone = run(null, 'unowned sentinel')
      const memA = upsertMemory('iso-a', 'a-memory', 'alpha memory marker', 'project').id
      const memB = upsertMemory('iso-b', 'b-memory', 'bravo memory marker', 'project').id
      const global = upsertMemory('global-memory', 'global-memory', 'global memory marker', 'global').id
      const conflictA1 = upsertMemory('iso-a', 'a-conflict-1', 'alpha conflict memory one', 'project').id
      const conflictA2 = upsertMemory('iso-a', 'a-conflict-2', 'alpha conflict memory two', 'project').id
      const conflictB1 = upsertMemory('iso-b', 'b-conflict-1', 'bravo conflict memory one', 'project').id
      const conflictB2 = upsertMemory('iso-b', 'b-conflict-2', 'bravo conflict memory two', 'project').id
      const conflictA = insertConflict(conflictA1, conflictA2, 'different', 'medium')
      const conflictB = insertConflict(conflictB1, conflictB2, 'different', 'medium')
      const instinctA = insertInstinct({ trigger: 'A trigger', action: 'A action', confidence: 1, source: 'manual', verified: true, projectId: 'iso-a' })
      const instinctB = insertInstinct({ trigger: 'B trigger', action: 'B action', confidence: 1, source: 'manual', verified: true, projectId: 'iso-b' })
      const instinctOld = insertInstinct({ trigger: 'historical trigger', action: 'historical action', confidence: 1, source: 'manual', verified: true })
      const req = (path, method = 'GET', body, projectId = 'iso-a') => route(new Request('http://localhost:50852' + path, {
        method,
        headers: { ...(projectId ? { 'x-orchestos-project-id': projectId } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }), 50852)
      const [runsA, memoryA, searchB, conflicts, instincts, skills, runsNone, skillsB] = await Promise.all([
        req('/api/runs'), req('/api/memory'), req('/api/memory?q=bravo'), req('/api/memory/conflicts'),
        req('/api/instincts'), req('/api/skills'), req('/api/runs?project=none', 'GET', undefined, null), req('/api/skills', 'GET', undefined, 'iso-b'),
      ])
      const read = async (response) => response.json()
      const runRows = await read(runsA), memoryRows = await read(memoryA), searchRows = await read(searchB)
      const conflictRows = await read(conflicts), instinctRows = await read(instincts), skillRows = await read(skills), noneRows = await read(runsNone), skillRowsB = await read(skillsB)
      const idStatuses = [
        (await req('/api/runs/' + runB)).status,
        (await req('/api/runs/' + runB, 'DELETE')).status,
        (await req('/api/tasks/task-b/steps')).status,
        (await req('/api/memory/' + memB, 'DELETE')).status,
        (await req('/api/memory/conflicts/' + conflictB + '/resolve', 'POST', {})).status,
        (await req('/api/instincts/' + instinctB + '/approve', 'POST', {})).status,
        (await req('/api/instincts/' + instinctB + '/reject', 'POST', {})).status,
        (await req('/api/instincts/' + instinctB + '/confidence', 'POST', { confidence: 0.5 })).status,
        (await req('/api/instincts/' + instinctB, 'DELETE')).status,
      ]
      const bulkRuns = await req('/api/runs/bulk-delete', 'POST', { ids: [runA, runB] })
      const bulkMemory = await req('/api/memory/bulk-delete', 'POST', { ids: [memA, memB] })
      const bulkInstincts = await req('/api/instincts/bulk-delete', 'POST', { ids: [instinctA.id, instinctB.id] })
      const bSurvives = {
        run: !!db.query('SELECT id FROM runs WHERE id = ?').get(runB),
        memory: !!db.query('SELECT id FROM memory_entries WHERE id = ?').get(memB),
        instinct: !!db.query('SELECT id FROM instincts WHERE id = ?').get(instinctB.id),
      }
      process.stdout.write(JSON.stringify({
        runIds: runRows.map((r) => r.id), runB, runNoneIds: noneRows.map((r) => r.id), runNone,
        memoryIds: memoryRows.map((r) => r.id), memB, global, searchIds: searchRows.map((r) => r.id),
        conflictIds: conflictRows.map((r) => r.id), conflictA, conflictB,
        instinctIds: instinctRows.map((r) => r.id), instinctA: instinctA.id, instinctB: instinctB.id,
        historical: instinctRows.some((r) => r.id === instinctOld.id && r.projectId === null),
        skillOrigins: skillRows.filter((r) => r.id === skillFile.replace(/\\.ya?ml$/, '')).map((r) => r.origin),
        libraryOriginsB: skillRowsB.filter((r) => r.id === skillFile.replace(/\\.ya?ml$/, '')).map((r) => r.origin),
        sharedSkillUsageA: skillRows.find((r) => r.id === skillFile.replace(/\\.ya?ml$/, ''))?.usageRuns,
        bSkillIncluded: skillRows.some((r) => r.id === 'only-b'), bSkillIncludedInB: skillRowsB.some((r) => r.id === 'only-b'), runA, memA,
        idStatuses, bulkCounts: await Promise.all([bulkRuns.json(), bulkMemory.json(), bulkInstincts.json()]), bSurvives,
      }))
      db.close()
    `)
    expect(result.runIds).not.toContain(result.runB)
    expect(result.runNoneIds).toEqual([result.runNone])
    expect(result.memoryIds).not.toContain(result.memB)
    expect(result.memoryIds).toContain(result.global)
    expect(result.searchIds).not.toContain(result.memB)
    expect(result.conflictIds).toContain(result.conflictA)
    expect(result.conflictIds).not.toContain(result.conflictB)
    expect(result.instinctIds).toContain(result.instinctA)
    expect(result.instinctIds).not.toContain(result.instinctB)
    expect(result.historical).toBe(true)
    expect(result.skillOrigins).toEqual(['project'])
    expect(result.libraryOriginsB).toEqual(['library'])
    expect(result.sharedSkillUsageA).toBe(1)
    expect(result.bSkillIncluded).toBe(false)
    expect(result.bSkillIncludedInB).toBe(true)
    expect(result.idStatuses).toEqual([404, 404, 404, 404, 404, 404, 404, 404, 404])
    expect(result.bulkCounts).toEqual([
      { ok: true, deleted: 1 },
      { ok: true, deleted: 1 },
      { ok: true, deleted: 1 },
    ])
    expect(result.bSurvives).toEqual({ run: true, memory: true, instinct: true })
  })

  it('migrates historical instincts as unowned and permits duplicate triggers per project', async () => {
    const result = await runWithTemporaryHome(`
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations, applyMigrationSteps } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const instincts = await import('./src/instincts/store.ts')
      runMigrations()
      const home = process.env.ORCHESTOS_HOME
      const rootA = join(home, 'a'), rootB = join(home, 'b')
      mkdirSync(rootA); mkdirSync(rootB)
      const now = new Date().toISOString()
      for (const [id, root] of [['migration-a', rootA], ['migration-b', rootB]]) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, root, '{}', '', now],
      )
      db.exec('DROP INDEX idx_instincts_project_trigger; DROP INDEX idx_instincts_project; ALTER TABLE instincts DROP COLUMN project_id')
      db.run('DELETE FROM schema_migrations WHERE version = 18')
      db.run("INSERT INTO instincts (id, trigger, action, confidence, source, verified, created_at) VALUES ('legacy-instinct', 'same-trigger', 'legacy', 1, 'manual', 1, ?)", [now])
      applyMigrationSteps()
      const legacy = db.query('SELECT project_id FROM instincts WHERE id = ?').get('legacy-instinct')
      const a = instincts.insertInstinct({ trigger: 'same-trigger', action: 'A', confidence: 1, source: 'manual', verified: true, projectId: 'migration-a' })
      const b = instincts.insertInstinct({ trigger: 'same-trigger', action: 'B', confidence: 1, source: 'manual', verified: true, projectId: 'migration-b' })
      process.stdout.write(JSON.stringify({ legacyProject: legacy.project_id, projectIds: [a.project_id, b.project_id].sort() }))
      db.close()
    `)
    expect(result.legacyProject).toBeNull()
    expect(result.projectIds).toEqual(['migration-a', 'migration-b'])
  })
})
