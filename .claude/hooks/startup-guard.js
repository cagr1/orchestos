#!/usr/bin/env node
import { execFile, execFileSync } from 'node:child_process'
/**
 * Hook `SessionStart`: detecta config derivada (conectores de cuenta no
 * declarados, env de skills bundled apagado, plugins habilitados fuera de la
 * allowlist) y arranque pesado (CLAUDE.md + MEMORY.md por encima del umbral).
 *
 * Spec: docs/specs/CTX-GUARD.md. Regla dura: si no hay hallazgos, no imprime
 * nada — un aviso que siempre aparece es el mismo mal que este hook cura.
 * Nunca bloquea la sesión: sale 0 siempre, silencio ante cualquier error.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// `STARTUP_GUARD_ROOT`/`STARTUP_GUARD_HOME` solo existen para que el test pueda
// apuntar a fixtures en tmpdir sin tocar el repo real ni `~/.claude.json`. Sin
// esas variables el comportamiento en producción es el de siempre (rutas reales).
const ROOT =
  process.env.STARTUP_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HOME = process.env.STARTUP_GUARD_HOME || homedir()

const PLUGIN_ALLOWLIST = new Set(['security-guidance@claude-plugins-official'])
const TOKEN_WEIGHT_LIMIT = 9_000

const CLAUDE_JSON_PATH = resolve(HOME, '.claude.json')
const USER_SETTINGS_PATH = resolve(HOME, '.claude/settings.json')
const REPO_SETTINGS_PATH = resolve(ROOT, '.claude/settings.json')
const USER_CLAUDE_MD_PATH = resolve(HOME, '.claude/CLAUDE.md')
const REPO_CLAUDE_MD_PATH = resolve(ROOT, 'CLAUDE.md')
const MEMORY_MD_PATH = resolve(
  HOME,
  '.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos/memory/MEMORY.md',
)
const ACTION_WORKFLOWS = ['CI', 'Mutation Shards', 'Secret Check', 'UI gate']
const ACTION_WORKFLOW_FILES = new Map([
  ['CI', 'ci.yml'],
  ['Mutation Shards', 'mutation-nightly.yml'],
  ['Secret Check', 'security-secrets.yml'],
  ['UI gate', 'ui-gate.yml'],
])
const execFileAsync = promisify(execFile)

export function parseGitHubRemote(remote) {
  const match = remote.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/,
  )
  return match?.[1] ?? null
}

function readJson(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function fileTokens(path) {
  try {
    const bytes = readFileSync(path, 'utf8').length
    return bytes / 4
  } catch {
    return 0
  }
}

function checkConnectorDrift(findings) {
  const claudeJson = readJson(CLAUDE_JSON_PATH)
  const repoSettings = readJson(REPO_SETTINGS_PATH)
  if (!claudeJson || !repoSettings) return

  const everConnected = Array.isArray(claudeJson.claudeAiMcpEverConnected)
    ? claudeJson.claudeAiMcpEverConnected
    : []
  const disabled = new Set(
    Array.isArray(repoSettings.disabledMcpServers) ? repoSettings.disabledMcpServers : [],
  )

  for (const name of everConnected) {
    if (typeof name === 'string' && !disabled.has(name)) {
      findings.push(`conector no declarado: ${name}`)
    }
  }
}

function checkEnvDrift(findings) {
  const repoSettings = readJson(REPO_SETTINGS_PATH)
  if (!repoSettings) return

  const env = repoSettings.env && typeof repoSettings.env === 'object' ? repoSettings.env : {}
  if (env.CLAUDE_CODE_DISABLE_BUNDLED_SKILLS !== '1') {
    findings.push('env sin CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1')
  }
}

function checkPluginDrift(findings) {
  const userSettings = readJson(USER_SETTINGS_PATH)
  if (!userSettings) return

  const enabledPlugins =
    userSettings.enabledPlugins && typeof userSettings.enabledPlugins === 'object'
      ? userSettings.enabledPlugins
      : {}

  for (const [name, value] of Object.entries(enabledPlugins)) {
    if (value === true && !PLUGIN_ALLOWLIST.has(name)) {
      findings.push(`plugin fuera de allowlist: ${name}`)
    }
  }
}

function checkStartupWeight(findings) {
  const breakdown = [
    ['~/.claude/CLAUDE.md', fileTokens(USER_CLAUDE_MD_PATH)],
    ['CLAUDE.md', fileTokens(REPO_CLAUDE_MD_PATH)],
    ['MEMORY.md', fileTokens(MEMORY_MD_PATH)],
  ]
  const total = breakdown.reduce((sum, [, tokens]) => sum + tokens, 0)
  if (total > TOKEN_WEIGHT_LIMIT) {
    const parts = breakdown.map(([label, tokens]) => `${label}=${Math.round(tokens)}`).join(', ')
    findings.push(`arranque pesado: ${Math.round(total)} tokens est. (${parts})`)
  }
}

async function checkActions(findings) {
  let runs
  try {
    const jsonPath = process.env.STARTUP_GUARD_GH_JSON
    if (jsonPath) {
      runs = JSON.parse(readFileSync(jsonPath, 'utf8'))
      if (!Array.isArray(runs)) return
    } else {
      const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
        encoding: 'utf8',
        timeout: 1000,
      }).trim()
      const repository = parseGitHubRemote(remote)
      if (!repository) return
      const results = await Promise.allSettled(
        [...ACTION_WORKFLOW_FILES].map(async ([_workflowName, file]) => {
          const { stdout } = await execFileAsync(
            'gh',
            [
              'api',
              `repos/${repository}/actions/workflows/${file}/runs?per_page=1&status=completed`,
              '--jq',
              '.workflow_runs[0]',
            ],
            { encoding: 'utf8', timeout: 3000 },
          )
          const run = JSON.parse(stdout)
          if (!run || typeof run !== 'object') return null
          return {
            workflowName: run.name,
            databaseId: run.id,
            headSha: run.head_sha,
            createdAt: run.created_at,
            conclusion: run.conclusion,
            status: run.status,
          }
        }),
      )
      runs = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      )
    }
  } catch {
    return
  }

  for (const workflow of ACTION_WORKFLOWS) {
    const latest = runs
      .filter((run) => run?.workflowName === workflow && run?.status === 'completed')
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
    if (latest && latest.conclusion !== 'success') {
      const sha = String(latest.headSha ?? 'unknown').slice(0, 7)
      findings.push(
        `Actions: ${workflow} ${latest.conclusion ?? 'unknown'} (${sha}, ${latest.createdAt ?? 'fecha desconocida'}) — revisar antes de trabajar: gh run view ${latest.databaseId}`,
      )
    }
  }
}

async function main() {
  const findings = []
  checkConnectorDrift(findings)
  checkEnvDrift(findings)
  checkPluginDrift(findings)
  checkStartupWeight(findings)
  const configFindings = findings.length
  await checkActions(findings)

  if (findings.length === 0) return

  const lines = ['[startup-guard] hallazgos al arrancar:']
  for (const finding of findings.slice(0, 6)) {
    lines.push(`- ${finding}`)
  }
  if (configFindings > 0) {
    lines.push('Arreglo: revisar docs/specs/CTX-GUARD.md y .claude/settings.json.')
  }
  console.log(lines.slice(0, 8).join('\n'))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch {
    // Fallar abierto: el guard nunca puede romper el arranque de una sesión.
  }
}
