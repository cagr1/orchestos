#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STATE_PATH = resolve(ROOT, '.orchestos/context-budget.json')
const HOOK_TIMEOUT_MS = 4_500

function main(inputText) {
  const input = parseJson(inputText)
  const transcriptPath = typeof input?.transcript_path === 'string' ? input.transcript_path : null
  const sessionId = typeof input?.session_id === 'string' ? input.session_id : null
  if (
    !transcriptPath ||
    !sessionId ||
    (!transcriptPath.startsWith('opencode-session:') && !existsSync(transcriptPath))
  )
    return

  warnOnTurns(transcriptPath, sessionId)

  const budget = runBudget(transcriptPath)
  if (!budget) return

  if (budget.level !== 'warn' && budget.level !== 'critical') return

  // BUG-H.7.3-a (hallado por el gate 🔍 del 2026-09-03): `printWarning` estaba
  // fuera de este guard y por eso avisaba en CADA turno desde el 60%, dejando a
  // `critical` sin comportamiento propio y gastando contexto por turno — el mal
  // exacto que este hook existe para evitar (AGENTS.md § Ciclo de un ítem). `warn`
  // avisa una sola vez por sesión; solo `critical`
  // repite en cada turno.
  const firstTimeThisSession = readState()?.sessionId !== sessionId
  if (firstTimeThisSession && !writeHandoff(transcriptPath, sessionId)) return
  if (firstTimeThisSession || budget.level === 'critical') printWarning(budget)
}

function warnOnTurns(transcriptPath, sessionId) {
  if (transcriptPath.startsWith('opencode-session:')) return
  const state = readState()
  if (state?.turnWarnings?.[sessionId] === true) return
  const turns = new Set()
  try {
    for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
      const entry = parseJson(line)
      if (
        entry?.type === 'assistant' &&
        typeof entry.message?.id === 'string' &&
        Array.isArray(entry.message.content) &&
        entry.message.content.some((block) => block?.type === 'tool_use')
      )
        turns.add(entry.message.id)
    }
    if (turns.size < 80) return
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ ...state, turnWarnings: { ...state?.turnWarnings, [sessionId]: true } }),
    )
    console.log(
      '80 turnos del cerebro en esta sesión: sugiero /cut (GOV.4). Cada turno relee todo el contexto.',
    )
  } catch {
    // Un transcript incompleto o inaccesible no impide el aviso de tokens.
  }
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function runBudget(transcriptPath) {
  const result = runBunJson(['context:budget', '--', '--transcript', transcriptPath])
  return result && isBudget(result) ? result : null
}

function isBudget(value) {
  return (
    typeof value.used === 'number' &&
    typeof value.window === 'number' &&
    typeof value.pct === 'number' &&
    // `model` es opcional: no todo CLI lo publica en su transcript. `source`
    // (el id del adaptador de H.7.2b) sí es obligatorio.
    (typeof value.model === 'string' || value.model === null) &&
    typeof value.source === 'string' &&
    (value.level === 'ok' || value.level === 'warn' || value.level === 'critical')
  )
}

function writeHandoff(transcriptPath, sessionId) {
  if (!runBunCommand(['agent:handoff', '--', '--transcript', transcriptPath])) return false
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ ...readState(), sessionId, firedAt: new Date().toISOString() }),
    )
    return true
  } catch {
    return false
  }
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function runBunCommand(args) {
  const result = spawnSync('bun', ['run', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: HOOK_TIMEOUT_MS,
    windowsHide: true,
  })
  return !result.error && result.status === 0
}

function runBunJson(args) {
  const result = spawnSync('bun', ['run', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: HOOK_TIMEOUT_MS,
    windowsHide: true,
  })
  if (result.error || result.status !== 0) return null
  return parseJson(result.stdout)
}

function printWarning(budget) {
  const pct = `${Math.round(budget.pct * 10) / 10}%`
  // H.7.2b — el modelo puede no venir (un CLI que no lo publica en su
  // transcript); el `source` del adaptador siempre viene, y es lo que dice de
  // qué CLI habla el número.
  const model = (budget.model || budget.source || 'desconocido').replace(/\s+/g, ' ').trim()
  const handoff = existsSync(resolve(ROOT, '.orchestos/handoff.md')) ? ' Handoff actualizado.' : ''
  const used = budget.used.toLocaleString('en-US')
  const window = budget.window.toLocaleString('en-US')
  console.log(
    `Contexto ${budget.level === 'critical' ? 'crítico' : 'alto'}: ${used} tokens, ${pct} de la ventana de ${model} (${window}).${handoff}`,
  )
  console.log(
    'Sugiere /cut (cierra el ítem, deja NEXT.md, commitea y sube); después el usuario hace /clear.',
  )
}

main(readFileSync(0, 'utf8'))
