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
  if (!transcriptPath || !sessionId || !existsSync(transcriptPath)) return

  const budget = runBudget(transcriptPath)
  if (!budget || (budget.level !== 'warn' && budget.level !== 'critical')) return

  if (readState()?.sessionId !== sessionId && !writeHandoff(transcriptPath, sessionId)) return
  printWarning(budget)
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
    typeof value.model === 'string' &&
    (value.level === 'warn' || value.level === 'critical')
  )
}

function writeHandoff(transcriptPath, sessionId) {
  if (!runBunCommand(['agent:handoff', '--', '--transcript', transcriptPath])) return false
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    writeFileSync(STATE_PATH, JSON.stringify({ sessionId, firedAt: new Date().toISOString() }))
    return true
  } catch {
    return false
  }
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    return typeof parsed?.sessionId === 'string' ? parsed : null
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
  const model = budget.model.replace(/\s+/g, ' ').trim()
  const handoff = existsSync(resolve(ROOT, '.orchestos/handoff.md')) ? ' Handoff actualizado.' : ''
  console.log(`Contexto ${budget.level === 'critical' ? 'crítico' : 'alto'}: ${pct} (${model}).`)
  console.log(`Ventana: ${budget.window.toLocaleString('en-US')} tokens.${handoff}`)
  console.log('Cierra este tab y abre uno nuevo para retomar con menos contexto.')
}

main(readFileSync(0, 'utf8'))
