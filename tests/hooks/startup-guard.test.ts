import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseGitHubRemote } from '../../.claude/hooks/startup-guard.js'

const HOOK_PATH = resolve(import.meta.dir, '../../.claude/hooks/startup-guard.js')

const dirs: string[] = []

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true })
    } catch {}
  }
})

const CONNECTED = ['claude.ai Figma', 'claude.ai Vercel']
const DISABLED = ['claude.ai Figma', 'claude.ai Vercel']

function makeFixtures(opts: {
  disabledMcpServers?: string[]
  envDisableBundledSkills?: string
  enabledPlugins?: Record<string, boolean>
  claudeJson?: string
  repoSettings?: string
}) {
  const home = mkdtempSync(join(tmpdir(), 'startup-guard-home-'))
  const root = mkdtempSync(join(tmpdir(), 'startup-guard-root-'))
  dirs.push(home, root)

  mkdirSync(join(home, '.claude'), { recursive: true })
  mkdirSync(join(root, '.claude'), { recursive: true })

  writeFileSync(
    join(home, '.claude.json'),
    opts.claudeJson ?? JSON.stringify({ claudeAiMcpEverConnected: CONNECTED }),
  )

  writeFileSync(
    join(home, '.claude/settings.json'),
    JSON.stringify({
      enabledPlugins: opts.enabledPlugins ?? { 'security-guidance@claude-plugins-official': true },
    }),
  )

  writeFileSync(join(home, '.claude/CLAUDE.md'), 'x'.repeat(100))

  const repoSettings = {
    disabledMcpServers: opts.disabledMcpServers ?? DISABLED,
    env: {
      CLAUDE_CODE_DISABLE_BUNDLED_SKILLS: opts.envDisableBundledSkills ?? '1',
    },
  }
  writeFileSync(
    join(root, '.claude/settings.json'),
    opts.repoSettings ?? JSON.stringify(repoSettings),
  )
  writeFileSync(join(root, 'CLAUDE.md'), 'x'.repeat(100))

  return { home, root }
}

const ACTION_FIXTURE: Array<{
  workflowName: string
  conclusion: string | null
  status: string
  databaseId: number
  headSha: string
  createdAt: string
}> = [
  {
    workflowName: 'CI',
    conclusion: 'success',
    status: 'completed',
    databaseId: 1,
    headSha: 'abcdef123456',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    workflowName: 'Mutation Shards',
    conclusion: 'success',
    status: 'completed',
    databaseId: 2,
    headSha: 'abcdef123456',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    workflowName: 'Secret Check',
    conclusion: 'success',
    status: 'completed',
    databaseId: 3,
    headSha: 'abcdef123456',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    workflowName: 'UI gate',
    conclusion: 'success',
    status: 'completed',
    databaseId: 4,
    headSha: 'abcdef123456',
    createdAt: '2026-10-01T00:00:00Z',
  },
]
function actionRun(index: number) {
  const run = ACTION_FIXTURE[index]
  if (!run) throw new Error(`fixture Actions ausente: ${index}`)
  return run
}

const CI_RUN = actionRun(0)
const MUTATION_RUN = actionRun(1)

function runHook(home: string, root: string, actions = ACTION_FIXTURE) {
  const actionsPath = join(root, 'gh-runs.json')
  writeFileSync(actionsPath, JSON.stringify(actions))
  return spawnSync('node', [HOOK_PATH], {
    encoding: 'utf8',
    env: {
      ...process.env,
      STARTUP_GUARD_HOME: home,
      STARTUP_GUARD_ROOT: root,
      STARTUP_GUARD_GH_JSON: actionsPath,
    },
  })
}

describe('startup-guard hook', () => {
  it('parsea remotos GitHub HTTPS y SSH', () => {
    expect(parseGitHubRemote('https://github.com/acme/orchestos.git')).toBe('acme/orchestos')
    expect(parseGitHubRemote('git@github.com:acme/orchestos.git')).toBe('acme/orchestos')
    expect(parseGitHubRemote('https://example.com/acme/orchestos.git')).toBeNull()
  })

  it('config correcta: stdout vacío, exit 0', () => {
    const { home, root } = makeFixtures({})
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('')
  })

  it('conector ausente de disabledMcpServers produce hallazgo', () => {
    const { home, root } = makeFixtures({ disabledMcpServers: ['claude.ai Figma'] })
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('conector no declarado: claude.ai Vercel')
  })

  it('env sin CLAUDE_CODE_DISABLE_BUNDLED_SKILLS produce hallazgo', () => {
    const { home, root } = makeFixtures({ envDisableBundledSkills: '0' })
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('env sin CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1')
  })

  it('JSON corrupto: stdout vacío, exit 0', () => {
    const { home, root } = makeFixtures({ claudeJson: '{ not valid json' })
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('')
  })

  it('plugin habilitado fuera de la allowlist produce hallazgo', () => {
    const { home, root } = makeFixtures({
      enabledPlugins: {
        'security-guidance@claude-plugins-official': true,
        'frontend-design@claude-plugins-official': true,
      },
    })
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'plugin fuera de allowlist: frontend-design@claude-plugins-official',
    )
  })

  it('Actions con todos los workflows en success no añade salida', () => {
    const { home, root } = makeFixtures({})
    const result = runHook(home, root)
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('Actions:')
  })

  it('usa el CI completed más reciente aunque el anterior fuera success', () => {
    const { home, root } = makeFixtures({})
    const result = runHook(home, root, [
      ...ACTION_FIXTURE,
      {
        ...CI_RUN,
        conclusion: 'failure',
        databaseId: 11,
        headSha: '1234567890',
        createdAt: '2026-10-02T00:00:00Z',
      },
    ])
    expect(result.stdout).toContain('Actions: CI failure (1234567, 2026-10-02T00:00:00Z)')
    expect(result.stdout).toContain('gh run view 11')
  })

  it('Mutation Shards cancelled produce hallazgo', () => {
    const { home, root } = makeFixtures({})
    const result = runHook(home, root, [
      ...ACTION_FIXTURE.filter((run) => run.workflowName !== 'Mutation Shards'),
      { ...MUTATION_RUN, conclusion: 'cancelled', databaseId: 12 },
    ])
    expect(result.stdout).toContain('Actions: Mutation Shards cancelled')
  })

  it('ignora workflows que solo están in_progress', () => {
    const { home, root } = makeFixtures({})
    const result = runHook(home, root, [
      ...ACTION_FIXTURE.filter((run) => run.workflowName !== 'CI'),
      { ...CI_RUN, status: 'in_progress', conclusion: null },
    ])
    expect(result.stdout).not.toContain('Actions: CI')
  })

  it('JSON de Actions inválido no añade hallazgo ni error', () => {
    const { home, root } = makeFixtures({})
    const actionsPath = join(root, 'invalid.json')
    writeFileSync(actionsPath, '{ invalid')
    const result = spawnSync('node', [HOOK_PATH], {
      encoding: 'utf8',
      env: {
        ...process.env,
        STARTUP_GUARD_HOME: home,
        STARTUP_GUARD_ROOT: root,
        STARTUP_GUARD_GH_JSON: actionsPath,
      },
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).not.toContain('Actions:')
  })
})
