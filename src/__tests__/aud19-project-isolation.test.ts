import { expect, test } from 'bun:test'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Every case owns its database, two registered roots and identical task IDs.
async function isolated(body: string): Promise<void> {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'aud19-')))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
      import assert from 'node:assert/strict'
      import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
      import { join, resolve } from 'node:path'
      import { db } from './src/db/sqlite.ts'
      import { runMigrations, applyMigrationSteps } from './src/db/migrate.ts'
      import { getProject } from './src/db/projects.ts'
      import { insertRun, listRunsByTaskId, getRun } from './src/db/runs.ts'
      import { insertRunStep, getRunSteps, clearRunSteps } from './src/db/run-steps.ts'
      import { resetTestData } from './src/db/reset.ts'
      import { insertInstinct, approveInstinct, listApplicable, getInstinct } from './src/instincts/store.ts'
      import { createChatSession, getChatSession, listChatMessages } from './src/db/chat-sessions.ts'
      import { beginTurn } from './src/db/chat-turns.ts'
      runMigrations()
      const rootA = join(process.env.ORCHESTOS_HOME, 'a'), rootB = join(process.env.ORCHESTOS_HOME, 'b')
      const taskId = 'same-task'
      const tasks = 'version: 1\\nproject: fixture\\ntasks:\\n  - id: same-task\\n    description: fixture\\n    engine: codex\\n    executor_model: test\\n    input: []\\n    output: [out.txt]\\n    depends_on: []\\n    status: failed\\n    retry_count: 1\\n'
      for (const [id, root] of [['aud19-a', rootA], ['aud19-b', rootB]]) {
        mkdirSync(root)
        writeFileSync(join(root, 'tasks.yaml'), tasks)
        writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\\n  executor: { agent: codex, model: test }\\n  reviewer: { agent: codex, model: test }\\n  orchestrator: { agent: api, provider: openrouter, model: fixture/chat }\\n')
        db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [id, root, '{}', '# Fixture', new Date().toISOString()])
      }
      const run = (projectId, prompt = projectId) => insertRun({
        project_id: projectId, prompt: prompt || 'general', task_class: 'implement', model: 'test', provider: 'test',
        skill_id: null, task_id: taskId, allowed_outputs: null, files_attempted: null, files_authorized: null,
        files_blocked: null, snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null,
        status: 'done', input_tokens: 1, output_tokens: 1, usd_cost: 1, elapsed_ms: 1, result: 'done',
      })
      const serverCli = resolve('src/cli.ts')
      process.chdir(rootA)
      const {route} = await import(resolve(serverCli, '../dashboard/server.ts'))
      const request = (path, method = 'GET', body, projectId = 'aud19-a') => route(new Request('http://localhost:50852' + path, {
        method, headers: { ...(projectId ? {'x-orchestos-project-id': projectId} : {}), 'content-type': 'application/json' },
        ...(body ? {body: JSON.stringify(body)} : {}),
      }), 50852)
      ${body}
      db.close()
    `,
      ],
      {
        env: {
          ...process.env,
          ORCHESTOS_HOME: home,
          ORCHESTOS_CLAUDE_USAGE_LIVE: '0',
          OPENROUTER_API_KEY: 'fixture-key',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [code, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(code, `${out}\n${err}`).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

test('AUD.19 reset only deletes its project and detaches run foreign keys', () =>
  isolated(`
  const a = run('aud19-a'), b = run('aud19-b'), general = run(null)
  const instinct = (projectId) => insertInstinct({ projectId, trigger: taskId, action: 'act', confidence: 0.6, source: 'auto', verified: false })
  const ia = instinct('aud19-a'), ib = instinct('aud19-b'), ig = instinct(null)
  const session = createChatSession({ projectId: 'aud19-a', agent: 'api' })
  const {turn} = beginTurn({sessionId: session.id, projectId: 'aud19-a', requestKey: 'reset', inputFingerprint: 'reset', owner: 'test'})
  db.run('UPDATE chat_turns SET run_id = ? WHERE id = ?', [a, turn.id])
  db.run('INSERT INTO eval_trials (run_id,eval_task_id,trial_index,batch_id,config_json,passed,created_at) VALUES (?,?,?,?,?,?,?)', [a,taskId,0,'batch','{}',1,new Date().toISOString()])
  const summary = resetTestData(rootA, 'aud19-a')
  assert.equal(getRun(b)?.id, b)
  assert.equal(getRun(general)?.id, general)
  assert.equal(getRun(a), null)
  assert.equal(getInstinct(ia.id), null)
  assert.ok(getInstinct(ib.id)); assert.ok(getInstinct(ig.id))
  assert.equal(db.query('SELECT run_id FROM chat_turns WHERE id = ?').get(turn.id).run_id, null)
  assert.equal(db.query('SELECT COUNT(*) AS n FROM eval_trials WHERE run_id = ?').get(a).n, 0)
  assert.deepEqual(summary, {runsDeleted: 1, instinctsDeleted: 1, tasksReset: 1})
  assert.equal(readFileSync(join(rootB, 'tasks.yaml'), 'utf8'), tasks)
  assert.throws(() => resetTestData(rootA, null), /project required/)
`))

test('AUD.19 steps, polling and session console isolate identical task IDs', () =>
  isolated(`
  insertRunStep(taskId, {type:'text', label:'alpha'}, 'aud19-a')
  insertRunStep(taskId, {type:'text', label:'beta'}, 'aud19-b')
  insertRunStep(taskId, {type:'text', label:'general'}, null)
  insertRunStep(taskId, {type:'text', label:'alpha-two'}, 'aud19-a')
  assert.deepEqual(getRunSteps(taskId, 0, 'aud19-a').map(s => [s.label,s.seq]), [['alpha',1],['alpha-two',2]])
  assert.deepEqual(getRunSteps(taskId, 1, 'aud19-a').map(s => s.label), ['alpha-two'])
  assert.deepEqual(getRunSteps(taskId, 0, null).map(s => s.label), ['general'])
  const response = await request('/api/tasks/' + taskId + '/steps')
  assert.deepEqual((await response.json()).steps.map(s => s.label), ['alpha','alpha-two'])
  const session = createChatSession({projectId:'aud19-a',agent:'api'})
  const {turn} = beginTurn({sessionId:session.id,projectId:'aud19-a',requestKey:'steps',inputFingerprint:'steps',owner:'test'})
  db.run('UPDATE chat_turns SET task_id = ? WHERE id = ?', [taskId,turn.id])
  const consoleResponse = await request('/api/chat/sessions/' + session.id + '/console')
  const consoleBody = JSON.stringify(await consoleResponse.json())
  assert.ok(consoleBody.includes('alpha')); assert.ok(!consoleBody.includes('beta'))
  clearRunSteps(taskId, 'aud19-a')
  assert.equal(getRunSteps(taskId, 0, 'aud19-a').length, 0)
  assert.equal(getRunSteps(taskId, 0, 'aud19-b')[0].label, 'beta')
  assert.equal(getRunSteps(taskId, 0, null)[0].label, 'general')
`))

test('AUD.19 migration preserves old steps as unowned', () =>
  isolated(`
  db.exec('DROP INDEX IF EXISTS idx_run_steps_project_task_seq')
  if (db.query('PRAGMA table_info(run_steps)').all().some(c => c.name === 'project_id'))
    db.exec('ALTER TABLE run_steps DROP COLUMN project_id')
  db.run('DELETE FROM schema_migrations WHERE version = 39')
  db.run('INSERT INTO run_steps (task_id,seq,type,label,created_at) VALUES (?,?,?,?,?)', [taskId,1,'text','legacy',new Date().toISOString()])
  applyMigrationSteps()
  assert.equal(db.query('SELECT * FROM run_steps WHERE task_id = ?').get(taskId).project_id, null)
  assert.equal(db.query("SELECT name FROM sqlite_master WHERE name = 'idx_run_steps_project_task_seq'").get().name, 'idx_run_steps_project_task_seq')
  assert.equal(getRunSteps(taskId, 0, null)[0].label, 'legacy')
  assert.equal(getRunSteps(taskId, 0, 'aud19-a').length, 0)
`))

test('AUD.19 task runs and compressed context only include the requested project', () =>
  isolated(`
  const a = run('aud19-a', 'alpha-only'), b = run('aud19-b', 'beta-only'), general = run(null)
  assert.deepEqual(listRunsByTaskId(taskId, 'aud19-a').map(r => r.id), [a])
  assert.deepEqual(listRunsByTaskId(taskId, 'aud19-b').map(r => r.id), [b])
  assert.deepEqual(listRunsByTaskId(taskId, null).map(r => r.id), [general])
  const {buildContextMd} = await import('./src/context/compress.ts')
  const context = buildContextMd(rootA).content
  assert.ok(context.includes('alpha-only')); assert.ok(!context.includes('beta-only'))
`))

test('AUD.19 project PDF receives only project runs', () =>
  isolated(`
  const {spyOn} = await import('bun:test')
  const pdf = await import('./src/generators/summary-pdf.ts')
  const a = run('aud19-a'), b = run('aud19-b')
  let observed
  const spy = spyOn(pdf, 'generateSummaryPdf').mockImplementation(async (_profile, _agents, path, runs) => {
    observed = runs.map(r => r.id)
    writeFileSync(path, '%PDF-fixture')
  })
  try {
    const response = await request('/api/project/summary')
    assert.equal(response.status, 200)
    assert.deepEqual(observed, [a])
    assert.ok(!observed.includes(b))
  } finally { spy.mockRestore() }
`))

test('AUD.19 foreign session is rejected before task mutation or spawn', () =>
  isolated(`
  const session = createChatSession({projectId:'aud19-b',agent:'api'})
  const spawn = Bun.spawn
  let spawned = false
  Bun.spawn = () => { spawned = true; throw new Error('unexpected spawn') }
  try {
    const response = await request('/api/tasks/' + taskId + '/run', 'POST', {sessionId:session.id})
    assert.equal(response.status, 400)
    assert.equal(spawned, false)
    assert.equal(readFileSync(join(rootA,'tasks.yaml'),'utf8'), tasks)
    assert.equal(listChatMessages(session.id).length, 0)
  } finally { Bun.spawn = spawn }
`))

test('AUD.19 general session records success and failure with null project', () =>
  isolated(`
  const {handleApiChat} = await import('./src/dashboard/handlers/chat.ts')
  process.chdir(rootA)
  const session = createChatSession({agent:'api', mode:'chat'})
  // USO.10 — a general chat reads only the global config (~/.orchestos/config.yaml), never the cwd's.
  mkdirSync(join(process.env.ORCHESTOS_HOME, '.orchestos'), {recursive:true})
  writeFileSync(join(process.env.ORCHESTOS_HOME, '.orchestos', 'config.yaml'), 'roles:\\n  orchestrator: { agent: api, provider: openrouter, model: fixture/chat }\\n')
  globalThis.fetch = async () => new Response(JSON.stringify({choices:[{message:{content:'fixture answer'}}],usage:{prompt_tokens:1,completion_tokens:1}}))
  const success = await handleApiChat(new Request('http://localhost/api/chat?project=none', {method:'POST',body:JSON.stringify({sessionId:session.id,message:'fixture',requestKey:'success',model:'fixture/chat'})}))
  assert.equal(success.status, 200)
  await success.text()
  const {spyOn} = await import('bun:test')
  const adapters = await import('./src/run/executors/chat-adapters.ts')
  const catalogs = await import('./src/dashboard/chat-cli-models.ts')
  const {uninstrumentedReadAudit} = await import('./src/run/read-audit.ts')
  spyOn(catalogs,'readCliModelCatalogsCached').mockResolvedValue([])
  spyOn(adapters,'cliChatAdapterFor').mockReturnValue({
    chat:true, label:'fixture', validateModel:() => null,
    runTurn:async () => {throw new Error('fixture failed')},
    failure:(error) => ({message:error.message, record:{error:error.message, readAudit:uninstrumentedReadAudit()}}),
  })
  const failure = await handleApiChat(new Request('http://localhost/api/chat?project=none', {method:'POST',body:JSON.stringify({sessionId:session.id,message:'fixture failure',requestKey:'failure',model:'fixture/chat'})}))
  assert.equal(failure.status, 502)
  await failure.text()
  const rows = db.query("SELECT project_id,status FROM runs WHERE task_class = 'chat'").all()
  assert.equal(rows.length, 2)
  assert.ok(rows.every(r => r.project_id === null))
  assert.ok(rows.some(r => r.status === 'failed'))
`))

test('AUD.19 project=none rejects filesystem routes without touching server cwd', () =>
  isolated(`
  process.chdir(rootA)
  writeFileSync(join(rootA,'sentinel.txt'),'original')
  const response = await request('/api/explorer/file?project=none', 'PUT', {path:'sentinel.txt', content:'changed'}, null)
  assert.equal(response.status, 400)
  assert.match(await response.text(), /project required/)
  assert.equal(readFileSync(join(rootA,'sentinel.txt'),'utf8'),'original')
  const reset = await request('/api/system/reset?project=none', 'POST', {confirm:true}, null)
  assert.equal(reset.status,400)
  const tasksResponse = await request('/api/tasks?project=none','GET',undefined,null)
  assert.deepEqual(await tasksResponse.json(), {exists:false,tasks:[]})
  for (const path of ['/api/health','/api/settings','/api/setup','/api/system/executor-modes','/api/config'])
    assert.equal((await request(path + '?project=none','GET',undefined,null)).status, 200, path)
`))

test('AUD.19 skill build writes only to the requested root', () =>
  isolated(`
  const skill = 'id: aud19-skill\\nversion: 1.0.0\\nname: Fixture\\ndescription: fixture\\ninstructions: fixture\\ntargets: [claude]\\n'
  for (const root of [rootA,rootB]) { mkdirSync(join(root,'skills')); writeFileSync(join(root,'skills/aud19-skill.yaml'),skill) }
  process.chdir(rootA)
  const response = await request('/api/skills/aud19-skill/build','POST',{},'aud19-b')
  assert.equal(response.status,200)
  const body = await response.json()
  assert.deepEqual(body.paths,[join(rootB,'dist/skills/claude/aud19-skill.md')])
  assert.ok(existsSync(body.paths[0]))
  assert.ok(!existsSync(join(rootA,'dist/skills/claude/aud19-skill.md')))
`))

test('AUD.19 spec draft waits for server CLI and surfaces stderr in an external root', () =>
  isolated(`
  const spawn = Bun.spawn
  const calls = []
  let completed = false
  Bun.spawn = (args, opts) => {
    calls.push({args,opts})
    return { exited: new Promise(resolve => setTimeout(() => {completed=true;resolve(7)},20)), stderr: new Blob(['fixture draft failed']).stream() }
  }
  try {
    const response = await request('/api/specs/draft','POST',{taskId,description:'draft'},'aud19-b')
    assert.equal(response.status,500)
    assert.equal(completed,true)
    assert.match(await response.text(),/fixture draft failed/)
    assert.equal(calls[0].opts.cwd,rootB)
    assert.equal(calls[0].args[2],serverCli)
    assert.ok(!existsSync(join(rootB,'src/cli.ts')))
    assert.ok(!existsSync(join(rootB,'.orchestos/specs',taskId+'.md')))
  } finally { Bun.spawn = spawn }
`))

test('AUD.19 approving an auto instinct makes it applicable only in its project', () =>
  isolated(`
  const data = {trigger:taskId,action:'act',confidence:0.6,source:'auto',verified:false}
  const a = insertInstinct({...data,projectId:'aud19-a'}), b = insertInstinct({...data,projectId:'aud19-b'})
  assert.equal(listApplicable('aud19-a').length,0)
  assert.equal(approveInstinct(a.id),true)
  assert.deepEqual(listApplicable('aud19-a').map(i => i.id),[a.id])
  assert.equal(listApplicable('aud19-b').length,0)
  assert.equal(getInstinct(b.id).verified,false)
`))

test('AUD.19 chat QA reasons only come from the session project', () =>
  isolated(`
  const {handleApiChat} = await import('./src/dashboard/handlers/chat.ts')
  writeFileSync(join(rootA, 'tasks.yaml'), tasks.replace('retry_count: 1', 'retry_count: 1\\n    qa_verdict: fail'))
  const a = run('aud19-a'), b = run('aud19-b')
  db.run('UPDATE runs SET qa_reason = ?, created_at = ? WHERE id = ?', ['reason-A', '2026-11-10T00:00:00Z', a])
  db.run('UPDATE runs SET qa_reason = ?, created_at = ? WHERE id = ?', ['PRIVATE-REASON-B', '2026-11-11T00:00:00Z', b])
  const session = createChatSession({agent:'api', mode:'chat', projectId:'aud19-a'})
  let sent = ''
  globalThis.fetch = async (_url, init) => { sent += String(init?.body ?? ''); return new Response(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{prompt_tokens:1,completion_tokens:1}})) }
  const res = await handleApiChat(new Request('http://localhost/api/chat', {method:'POST',headers:{'x-orchestos-project-id':'aud19-a'},body:JSON.stringify({sessionId:session.id,message:'fixture',requestKey:'qa',model:'fixture/chat'})}))
  assert.equal(res.status, 200)
  await res.text()
  assert.ok(sent.includes('reason-A'), 'own QA reason reaches the prompt')
  assert.ok(!sent.includes('PRIVATE-REASON-B'), 'foreign QA reason leaked')
`))
