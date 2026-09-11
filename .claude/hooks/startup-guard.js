#!/usr/bin/env node
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

// `STARTUP_GUARD_ROOT`/`STARTUP_GUARD_HOME` solo existen para que el test pueda
// apuntar a fixtures en tmpdir sin tocar el repo real ni `~/.claude.json`. Sin
// esas variables el comportamiento en producción es el de siempre (rutas reales).
const ROOT = process.env.STARTUP_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')
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

function main() {
  const findings = []
  checkConnectorDrift(findings)
  checkEnvDrift(findings)
  checkPluginDrift(findings)
  checkStartupWeight(findings)

  if (findings.length === 0) return

  const lines = ['[startup-guard] arranque pesado o config derivada:']
  for (const finding of findings.slice(0, 6)) {
    lines.push(`- ${finding}`)
  }
  lines.push('Arreglo: revisar docs/specs/CTX-GUARD.md y .claude/settings.json.')
  console.log(lines.slice(0, 8).join('\n'))
}

try {
  main()
} catch {
  // Fallar abierto: el guard nunca puede romper el arranque de una sesión.
}
