import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { stringify as yamlStringify } from 'yaml'
import { writeGateRoles } from '../lib.mjs'

function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(-600)
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${error.status ?? 'n/a'}): ${detail || 'sin salida'}`,
    )
  }
}

function snapshot(databasePath, sessionId, taskId) {
  const source = `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    const messages = db.query("SELECT role, content, task_id FROM chat_messages WHERE session_id = ? AND task_id = ? ORDER BY id").all(${JSON.stringify(sessionId)}, ${JSON.stringify(taskId)})
    const watch = db.query('SELECT pid, session_id FROM task_run_watch WHERE task_id = ?').get(${JSON.stringify(taskId)})
    const runs = db.query('SELECT COUNT(*) AS count FROM runs WHERE task_id = ?').get(${JSON.stringify(taskId)}).count
    console.log(JSON.stringify({ messages, watch: watch ?? null, runs }))
    db.close()
  `
  return JSON.parse(execFileSync('bun', ['-e', source], { encoding: 'utf8' }))
}

const reports = (snap) =>
  snap.messages.filter((m) => m.role === 'assistant' && /^(✓|✗|⟳) Task /.test(m.content))

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function until(fn, timeoutMs, everyMs = 500) {
  const deadline = Date.now() + timeoutMs
  let last
  while (Date.now() < deadline) {
    last = await fn()
    if (last) return last
    await delay(everyMs)
  }
  return last
}

export default async function restartMidRun({
  page,
  api,
  step,
  shot,
  visible,
  cleanup,
  databasePath,
  restartDashboard,
}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-r84-'))
  writeFileSync(join(projectRoot, 'README.md'), '# R.8.4 restart mid run\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', '-A'], projectRoot)
  const commit = (message) =>
    run(
      'git',
      [
        '-c',
        'user.name=ui-gate',
        '-c',
        'user.email=ui-gate@example.invalid',
        'commit',
        '-qm',
        message,
      ],
      projectRoot,
    )
  commit('fixture')

  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeGateRoles(projectRoot)
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'task', 'init'], projectRoot)
  const task = (id, file) => ({
    id,
    description: `Create the file ${file} containing exactly one line: REINICIO`,
    executor_model: 'openai/gpt-6-luna',
    engine: 'codex',
    cli_effort: 'medium',
    input: [],
    output: [file],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
  })
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    yamlStringify(
      {
        version: 1,
        project: 'r84-restart',
        tasks: [
          task('gate-restart-a', 'a.txt'),
          task('gate-restart-b', 'b.txt'),
          task('gate-restart-c', 'c.txt'),
        ],
      },
      { lineWidth: 120 },
    ),
  )
  run('git', ['add', '-A'], projectRoot)
  commit('task fixture')

  const projectList = await api('/api/projects')
  const project = (projectList.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })
  const headers = { 'x-orchestos-project-id': project.id }
  const taskStatus = async (taskId) => {
    const response = await api('/api/tasks', { headers })
    return (response.data?.tasks ?? []).find((item) => item.id === taskId)
  }

  const showChat = async (title, taskId, expected) => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
    const sessionButton = page.getByText(title, { exact: true }).first()
    if (await visible(sessionButton, 15_000)) await sessionButton.click()
    const found = await until(
      async () => {
        const taskCard = page.locator(`[data-task-id="${taskId}"]`)
        if ((await taskCard.count().catch(() => 0)) === 0) return false
        const text = await taskCard
          .first()
          .innerText()
          .catch(() => '')
        return expected.test(text)
      },
      30_000,
      1_000,
    )
    return Boolean(found)
  }

  const scenario = async ({ label, taskId, title, killRunner, keepDashboard = false }) => {
    const created = await api('/api/chat/sessions', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, agent: 'codex', title }),
    })
    const sessionId = created.data?.id ?? created.id
    if (!sessionId) {
      await step(`${label}: chat session created`, false, JSON.stringify(created.data))
      return false
    }
    const launched = await api(`/api/tasks/${encodeURIComponent(taskId)}/run`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    await step(
      `${label}: run requested from the chat session`,
      launched.ok,
      `HTTP ${launched.status}`,
    )
    if (!launched.ok) return false

    const running = await until(
      async () => (await taskStatus(taskId))?.status === 'running',
      120_000,
    )
    const before = snapshot(databasePath, sessionId, taskId)
    const runnerPid = before.watch?.pid ?? 0
    await step(
      `${label}: task is running with a watched runner before the restart`,
      Boolean(running) && runnerPid > 0 && alive(runnerPid),
      JSON.stringify({ status: (await taskStatus(taskId))?.status, watch: before.watch }),
    )
    if (!running || !(runnerPid > 0)) return false
    await step(
      `${label}: no report exists before the restart`,
      reports(before).length === 0,
      JSON.stringify(before.messages.map((m) => m.content.slice(0, 60))),
    )
    const retryCountBefore = (await taskStatus(taskId))?.retryCount ?? 0

    let aliveWhileStopped = null
    const killNow = async () => {
      if (killRunner) {
        process.kill(runnerPid, 'SIGKILL')
        await until(async () => !alive(runnerPid), 5_000, 50)
      }
      aliveWhileStopped = alive(runnerPid)
    }
    if (keepDashboard) {
      await killNow()
      await step(
        `${label}: runner was killed while the dashboard stayed up`,
        aliveWhileStopped === false,
        `pid=${runnerPid} alive=${aliveWhileStopped}`,
      )
      return {
        sessionId,
        runnerPid,
        runsBefore: before.runs,
        retryCountBefore,
      }
    }
    await restartDashboard(killNow)
    await step(
      killRunner
        ? `${label}: runner was dead while the dashboard was stopped`
        : `${label}: runner was still alive while the dashboard was stopped`,
      aliveWhileStopped === !killRunner,
      `pid=${runnerPid} alive=${aliveWhileStopped}`,
    )
    return {
      sessionId,
      runnerPid,
      runsBefore: before.runs,
      retryCountBefore,
    }
  }

  // Dashboard recargado: re-seleccionar proyecto en la UI.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), 'project in Dev sidebar')
  if (!(await projectButton.isVisible())) return
  await page.getByRole('button', { name: 'Chat', exact: true }).click()

  // Caso A — el runner sobrevive al reinicio.
  const a = await scenario({
    label: 'A',
    taskId: 'gate-restart-a',
    title: 'r84-runner-survives',
    killRunner: false,
  })
  if (a) {
    const ended = await until(
      async () => {
        const current = await taskStatus('gate-restart-a')
        if (!current) return null
        if (['done', 'failed', 'failed_permanent', 'blocked'].includes(current.status))
          return current
        if (current.status === 'pending' && current.retryCount > a.retryCountBefore) return current
        return null
      },
      10 * 60_000,
      2_000,
    )
    await step(
      'A: surviving runner ended its run by itself after the restart',
      Boolean(ended) && snapshot(databasePath, a.sessionId, 'gate-restart-a').runs > a.runsBefore,
      JSON.stringify({
        status: ended?.status,
        retryCount: ended?.retryCount,
        retryReason: ended?.retryReason,
        runsBefore: a.runsBefore,
        runsAfter: snapshot(databasePath, a.sessionId, 'gate-restart-a').runs,
      }),
    )
    const settled = await until(
      () => {
        const snap = snapshot(databasePath, a.sessionId, 'gate-restart-a')
        return reports(snap).length > 0 ? snap : null
      },
      30_000,
      1_000,
    )
    const snap = snapshot(databasePath, a.sessionId, 'gate-restart-a')
    await step(
      'A: exactly one report for that taskId, matching the final status',
      Boolean(settled) &&
        reports(snap).length === 1 &&
        new RegExp(
          `^${ended?.status === 'done' ? '✓' : ended?.status === 'pending' ? '⟳' : '✗'} Task ` +
            `\\x60gate-restart-a\\x60 ${ended?.status}`,
        ).test(reports(snap)[0]?.content ?? ''),
      JSON.stringify(reports(snap).map((m) => m.content.slice(0, 80))),
    )
    await step(
      'A: watch row removed after settling',
      snap.watch === null,
      JSON.stringify(snap.watch),
    )
    await step(
      'A: chat shows the report after reloading the page',
      await showChat(
        'r84-runner-survives',
        'gate-restart-a',
        ended?.status === 'done'
          ? /done/i
          : ended?.status === 'pending'
            ? /pending/i
            : new RegExp(ended?.status ?? 'never'),
      ),
      'report visible in the session',
    )
    await shot('restart-mid-run-a-chat')
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(projectRoot), exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Runs', exact: true }).click()
    await step(
      'A: Runs lists the run of that task',
      await visible(page.locator('tr').filter({ hasText: 'gate-restart-a' }), 15_000),
      'row gate-restart-a in Runs',
    )
    await page.getByRole('button', { name: 'Back to app', exact: true }).click()
    await page.getByRole('button', { name: 'Chat', exact: true }).click()
  }

  // Caso B — el runner muere junto con el dashboard.
  const b = await scenario({
    label: 'B',
    taskId: 'gate-restart-b',
    title: 'r84-runner-dies',
    killRunner: true,
  })
  if (b) {
    const failed = await until(
      async () => {
        const current = await taskStatus('gate-restart-b')
        return current?.status === 'failed' ? current : null
      },
      60_000,
      1_000,
    )
    await step(
      'B: task marked failed with the interruption reason',
      failed?.status === 'failed' && /Interrupted/.test(failed?.retryReason ?? ''),
      JSON.stringify({ status: failed?.status, retryReason: failed?.retryReason }),
    )
    const settled = await until(
      () => {
        const snap = snapshot(databasePath, b.sessionId, 'gate-restart-b')
        return reports(snap).length > 0 ? snap : null
      },
      30_000,
      1_000,
    )
    await delay(3_000)
    const snap = snapshot(databasePath, b.sessionId, 'gate-restart-b')
    await step(
      'B: exactly one report for that taskId, with the interruption text',
      Boolean(settled) &&
        reports(snap).length === 1 &&
        /Interrupted/.test(reports(snap)[0].content),
      JSON.stringify(reports(snap).map((m) => m.content.slice(0, 120))),
    )
    await step(
      'B: no second run was launched',
      snap.runs === b.runsBefore && (await taskStatus('gate-restart-b'))?.status === 'failed',
      JSON.stringify({ runsBefore: b.runsBefore, runsAfter: snap.runs }),
    )
    await step(
      'B: watch row removed after settling',
      snap.watch === null,
      JSON.stringify(snap.watch),
    )
    await step(
      'B: chat shows the interruption report after reloading the page',
      await showChat('r84-runner-dies', 'gate-restart-b', /Interrupted/),
      'interruption report visible in the session',
    )
    await shot('restart-mid-run-b-chat')
  }

  // Caso C — el runner muere con el dashboard vivo (sin reinicio).
  const c = await scenario({
    label: 'C',
    taskId: 'gate-restart-c',
    title: 'r84-runner-killed-alive-dashboard',
    killRunner: true,
    keepDashboard: true,
  })
  if (c) {
    const failed = await until(
      async () => {
        const current = await taskStatus('gate-restart-c')
        return current?.status === 'failed' ? current : null
      },
      60_000,
      1_000,
    )
    await step(
      'C: task marked failed with the interruption reason',
      failed?.status === 'failed' && /Interrupted/.test(failed?.retryReason ?? ''),
      JSON.stringify({ status: failed?.status, retryReason: failed?.retryReason }),
    )
    const settled = await until(
      () => {
        const snap = snapshot(databasePath, c.sessionId, 'gate-restart-c')
        return reports(snap).length > 0 ? snap : null
      },
      30_000,
      1_000,
    )
    await delay(3_000)
    const snap = snapshot(databasePath, c.sessionId, 'gate-restart-c')
    await step(
      'C: exactly one report for that taskId, with the interruption text',
      Boolean(settled) &&
        reports(snap).length === 1 &&
        /Interrupted/.test(reports(snap)[0].content),
      JSON.stringify(reports(snap).map((m) => m.content.slice(0, 120))),
    )
    await step(
      'C: no second run was launched',
      snap.runs === c.runsBefore && (await taskStatus('gate-restart-c'))?.status === 'failed',
      JSON.stringify({ runsBefore: c.runsBefore, runsAfter: snap.runs }),
    )
    await step(
      'C: watch row removed after settling',
      snap.watch === null,
      JSON.stringify(snap.watch),
    )
    await step(
      'C: chat shows the interruption report after reloading the page',
      await showChat('r84-runner-killed-alive-dashboard', 'gate-restart-c', /Interrupted/),
      'interruption report visible in the session',
    )
    await shot('restart-mid-run-c-chat')
  }
}
