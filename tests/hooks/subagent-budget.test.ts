import { describe, expect, it } from 'bun:test'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const HOOK = join(ROOT, '.claude/hooks/subagent-budget.js')

function fixture() {
  return mkdtempSync(join(tmpdir(), 'subagent-budget-'))
}

function run(root: string, payload: Record<string, unknown>, allow = '') {
  return spawnSync('node', [HOOK], {
    cwd: ROOT,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, SUBAGENT_BUDGET_ROOT: root, ORCHESTOS_ALLOW_CLAUDE_SUBAGENT: allow },
  })
}

function pre(root: string, session = 's', id?: string) {
  return run(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'Agent',
    tool_input: { subagent_type: 'web-fetch' },
    session_id: session,
    tool_use_id: id,
  })
}

function start(root: string, session = 's', agent = 'a') {
  return run(root, { hook_event_name: 'SubagentStart', session_id: session, agent_id: agent })
}

function stop(root: string, session = 's', agent = 'a') {
  return run(root, { hook_event_name: 'SubagentStop', session_id: session, agent_id: agent })
}

function decision(result: ReturnType<typeof run>) {
  return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null
}

describe('subagent budget hook', () => {
  it('allows the first two Agent reservations and denies the third exactly', () => {
    const root = fixture()
    try {
      expect(decision(pre(root))).toBeNull()
      expect(decision(pre(root))).toBeNull()
      expect(decision(pre(root))).toMatchObject({
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Máximo 2 subagentes activos. Espera a que termine uno; delega con contexto mínimo.',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('releases a slot on SubagentStop', () => {
    const root = fixture()
    try {
      pre(root)
      start(root, 's', 'a')
      pre(root)
      start(root, 's', 'b')
      expect(decision(pre(root))).not.toBeNull()
      expect(stop(root, 's', 'a').stdout).toBe('')
      expect(decision(pre(root))).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('isolates counters by session_id', () => {
    const root = fixture()
    try {
      pre(root, 'one')
      pre(root, 'one')
      expect(decision(pre(root, 'one'))).not.toBeNull()
      expect(decision(pre(root, 'two'))).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not count an expired reservation', () => {
    const root = fixture()
    try {
      pre(root)
      pre(root)
      const stateFile = readdirSync(root).find((name) => name.endsWith('.json'))
      if (!stateFile) throw new Error('state file was not created')
      const state = JSON.parse(readFileSync(join(root, stateFile), 'utf8'))
      state.reservations[0].createdAt = Date.now() - 61_000
      state.reservations[1].createdAt = Date.now() - 61_000
      writeFileSync(join(root, stateFile), JSON.stringify(state))
      expect(decision(pre(root))).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails closed only for an invalid Agent pre-tool payload', () => {
    const root = fixture()
    try {
      const result = run(root, { hook_event_name: 'PreToolUse', tool_name: 'Agent' })
      expect(result.status).toBe(0)
      expect(decision(result)?.permissionDecision).toBe('deny')
      expect(run(root, { hook_event_name: 'PreToolUse', tool_name: 'Bash' }).stdout).toBe('')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('silently accepts incomplete bookkeeping payloads', () => {
    const root = fixture()
    try {
      for (const event of ['SubagentStart', 'SubagentStop']) {
        const result = run(root, { hook_event_name: event })
        expect(result.status).toBe(0)
        expect(result.stdout).toBe('')
        expect(result.stderr).toBe('')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('serializes concurrent reservations without exceeding two', async () => {
    const root = fixture()
    try {
      const results = await Promise.all(
        Array.from(
          { length: 8 },
          () =>
            new Promise<ReturnType<typeof run>>((resolveResult) => {
              const child = spawn('node', [HOOK], {
                cwd: ROOT,
                env: {
                  ...process.env,
                  SUBAGENT_BUDGET_ROOT: root,
                  ORCHESTOS_ALLOW_CLAUDE_SUBAGENT: '',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
              })
              let stdout = ''
              child.stdout.on('data', (chunk) => {
                stdout += chunk
              })
              child.on('close', (status) =>
                resolveResult({ status, stdout, stderr: '' } as ReturnType<typeof run>),
              )
              child.stdin.end(
                JSON.stringify({
                  hook_event_name: 'PreToolUse',
                  tool_name: 'Agent',
                  tool_input: { subagent_type: 'web-fetch' },
                  session_id: 's',
                  tool_use_id: randomUUID(),
                }),
              )
            }),
        ),
      )
      expect(
        results.filter((result) => decision(result)?.permissionDecision === 'deny'),
      ).toHaveLength(6)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('GOV.4 Claude subagent types', () => {
  it('denies mapping types before reserving and permits the explicit escape', () => {
    const root = fixture()
    try {
      for (const subagent_type of ['Explore', 'general-purpose', 'Plan', 'fork', undefined]) {
        const payload = {
          hook_event_name: 'PreToolUse',
          tool_name: 'Agent',
          tool_input: { subagent_type },
          session_id: String(subagent_type),
        }
        expect(decision(run(root, payload))).toMatchObject({
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Mapear o leer código va a Codex: ~/.agent-method/bin/delegate leer "<pregunta>" (GOV.4). Subagentes de Claude solo para web-fetch o guías de Claude Code.',
        })
        expect(readdirSync(root)).toHaveLength(0)
        expect(decision(run(root, payload, '1'))).toBeNull()
        // Clear only the allowed reservation for the next case.
        run(root, { hook_event_name: 'SessionStart', session_id: String(subagent_type) })
      }
      expect(decision(pre(root))).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
