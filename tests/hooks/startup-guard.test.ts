import { spawnSync } from 'child_process'
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

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

function runHook(home: string, root: string) {
  return spawnSync('node', [HOOK_PATH], {
    encoding: 'utf8',
    env: {
      ...process.env,
      STARTUP_GUARD_HOME: home,
      STARTUP_GUARD_ROOT: root,
    },
  })
}

describe('startup-guard hook', () => {
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
    expect(result.stdout).toContain('plugin fuera de allowlist: frontend-design@claude-plugins-official')
  })
})
