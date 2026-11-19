import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('task completion rechecks only the latest cut, preserving its base, handoff and model', async () => {
  const home = mkdtempSync(join(tmpdir(), 'cut-recheck-'))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        String.raw`
      const assert = (await import('node:assert/strict')).default
      const { mock } = await import('bun:test')
      const { mkdirSync, writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, appendChatExchange, appendCutReport, appendTaskReport, listChatMessages, setClaudeChatSession } = await import('./src/db/chat-sessions.ts')
      const { upsertTaskRunWatch, getTaskRunWatch } = await import('./src/db/task-run-watch.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root)
      writeFileSync(join(root, 'tasks.yaml'), 'version: 1\nproject: fixture\ntasks: []\n')
      const initial = { baseHead: 'before-turn', dirty: ['NEXT.md'], dirtyTotal: 1, branch: 'main', upstream: 'origin/main', ahead: 2, behind: 0, lock: 'held', handoff: 'Original handoff' }
      let handoff = null
      let fail = false
      const checks = []
      mock.module('./src/dashboard/cut-check.ts', () => ({ cutCheck(root, cliSessionId, options) {
        if (fail) throw new Error('fixture check failure')
        checks.push({ root, cliSessionId, options })
        return { ...initial, baseHead: options.baseHead, dirty: [], dirtyTotal: 0, ahead: 0, lock: 'none', handoff }
      }}))
      const { recheckCutAfterTask } = await import('./src/dashboard/cut-recheck.ts')
      const { reportTaskOutcome, settleTaskRun } = await import('./src/dashboard/handlers/task-report.ts')
      function session(agent = 'claude') {
        const session = createChatSession({ agent, mode: 'code' })
        setClaudeChatSession(session.id, 'native-id', 'context', 0)
        appendChatExchange({ sessionId: session.id, userContent: '/cut', assistantContent: 'Wrap up', model: 'chosen-model' })
        return session.id
      }
      const id = session()
      recheckCutAfterTask(id, root)
      assert.equal(checks.length, 0, 'no report after the cut yet')
      appendCutReport(id, initial)
      recheckCutAfterTask(id, root)
      let messages = listChatMessages(id)
      assert.equal(messages.length, 4)
      assert.equal(messages.at(-1).cutReport.handoff, 'Original handoff')
      assert.equal(messages.at(-1).cutReport.ahead, 0)
      assert.deepEqual(checks.at(-1), { root, cliSessionId: 'native-id', options: { baseHead: 'before-turn', reply: '' } })
      handoff = 'next-md'
      recheckCutAfterTask(id, root)
      assert.equal(listChatMessages(id).at(-1).cutReport.handoff, 'next-md')
      appendChatExchange({ sessionId: id, userContent: 'Another request', assistantContent: 'OK' })
      const count = checks.length
      const length = listChatMessages(id).length
      recheckCutAfterTask(id, root)
      assert.equal(checks.length, count, 'a later user turn prevents rechecking')
      assert.equal(listChatMessages(id).length, length)
      appendChatExchange({ sessionId: id, userContent: '/cut', assistantContent: 'New cut' })
      recheckCutAfterTask(id, root)
      assert.equal(checks.length, count, 'an older cut report cannot serve a new cut')
      handoff = null
      const codexId = session('codex')
      appendCutReport(codexId, initial)
      reportTaskOutcome(root, codexId, 'closure-task')
      messages = listChatMessages(codexId)
      assert.equal(messages.at(-2).taskReport.outcome, 'missing')
      assert.equal(messages.at(-1).cutReport.handoff, 'Original handoff')
      assert.equal(messages.at(-1).model, 'chosen-model', 'a task report with null model must not erase the chosen model')
      assert.equal(checks.at(-1).cliSessionId, undefined, 'Codex never releases a Claude lock')
      const row = upsertTaskRunWatch({ root, task_id: 'closure-task', session_id: codexId, project_id: null, pid: process.pid })
      let appendCalls = 0
      const beforeSettle = checks.length
      settleTaskRun(row, (...args) => {
        appendCalls++
        assert.equal(checks.length, beforeSettle, 'append the task report before rechecking')
        return appendTaskReport(...args)
      })
      assert.equal(appendCalls, 1)
      assert.equal(checks.length, beforeSettle + 1, 'settleTaskRun rechecks the cut')
      assert.equal(getTaskRunWatch(root, row.task_id), null)
      messages = listChatMessages(codexId)
      assert.equal(messages.at(-2).taskReport.outcome, 'missing')
      assert.equal(messages.at(-1).cutReport.baseHead, 'before-turn')
      settleTaskRun(row)
      assert.equal(checks.length, beforeSettle + 1, 'settling twice must not add duplicate cards')
      const warning = console.warn
      const warnings = []
      console.warn = (...args) => warnings.push(args)
      fail = true
      try {
        assert.doesNotThrow(() => recheckCutAfterTask(codexId, root))
        assert.equal(warnings.length, 1)
        assert.match(String(warnings[0][1]), /fixture check failure/)
      } finally { console.warn = warning }
      assert.doesNotThrow(() => recheckCutAfterTask('missing-session', root))
      db.close()
      console.log('CMD.3 task recheck assertions passed')
      `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home, ORCHESTOS_HOME: home, ORCHESTOS_CLAUDE_USAGE_LIVE: '0' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(code, stderr + stdout).toBe(0)
    expect(stdout).toContain('CMD.3 task recheck assertions passed')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
