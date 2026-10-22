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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { isClaudeStatuslineWired } from '../../scripts/claude-statusline-wiring.js'

// `STARTUP_GUARD_ROOT`/`STARTUP_GUARD_HOME` solo existen para que el test pueda
// apuntar a fixtures en tmpdir sin tocar el repo real ni `~/.claude.json`. Sin
// esas variables el comportamiento en producción es el de siempre (rutas reales).
const ROOT =
  process.env.STARTUP_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HOME = process.env.STARTUP_GUARD_HOME || homedir()

const PLUGIN_ALLOWLIST = new Set(['security-guidance@claude-plugins-official'])
const TOKEN_WEIGHT_LIMIT = 9_000
// Calibrado 2026-10-22 contra `/context`: 26.309 chars → 11,9k tokens.
const CHARS_PER_TOKEN = 2.2

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
    return bytes / CHARS_PER_TOKEN
  } catch {
    return 0
  }
}

function accountSkillDescriptions() {
  const roots = [resolve(HOME, '.claude/skills'), resolve(HOME, '.claude/plugins/synced')]
  const skills = []
  const visit = (directory, depth) => {
    if (depth > 5) return
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        visit(path, depth + 1)
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        try {
          const content = readFileSync(path, 'utf8')
          const lines = content.split(/\r?\n/)
          if (lines[0]?.trim() !== '---') continue
          const closing = lines.indexOf('---', 1)
          if (closing < 0) continue
          const description = lines
            .slice(1, closing)
            .find((line) => line.startsWith('description:'))
            ?.slice('description:'.length)
            .trim()
          if (description) {
            const unquoted = description.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2')
            skills.push({ name: basename(dirname(path)), chars: unquoted.length })
          }
        } catch {
          // Una skill ilegible no debe impedir el arranque.
        }
      }
    }
  }
  for (const root of roots) visit(root, 0)
  return skills
}

function checkConnectorDrift(findings) {
  // Límite conocido: `claude.ai Claude Docs` puede cargar aunque figure en
  // disabledMcpServers; detectar conectores activos requiere `claude mcp list` (red).
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
  const skills = accountSkillDescriptions()
  const skillTokens = skills.reduce((sum, skill) => sum + skill.chars / CHARS_PER_TOKEN, 0)
  const breakdown = [
    ['~/.claude/CLAUDE.md', fileTokens(USER_CLAUDE_MD_PATH)],
    ['CLAUDE.md', fileTokens(REPO_CLAUDE_MD_PATH)],
    ['MEMORY.md', fileTokens(MEMORY_MD_PATH)],
    [`skills de cuenta (${skills.length})`, skillTokens],
  ]
  const total = breakdown.reduce((sum, [, tokens]) => sum + tokens, 0)
  if (total > TOKEN_WEIGHT_LIMIT) {
    const parts = breakdown.map(([label, tokens]) => `${label}=${Math.round(tokens)}`).join(', ')
    findings.push(`arranque pesado: ${Math.round(total)} tokens est. (${parts})`)
    if (skills.length > 0) {
      findings.push(`skills de cuenta: ${skills.slice(0, 15).map((skill) => skill.name).join(', ')}`)
    }
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
  if (!isClaudeStatuslineWired(readJson(USER_SETTINGS_PATH), HOME, existsSync)) {
    findings.push('statusLine de Claude no pasa por OrchestOS')
  }
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
