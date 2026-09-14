#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const PROJECT_ROOT = resolve(new URL('.', import.meta.url).pathname, '../..')
const STATE_ROOT =
  process.env.SUBAGENT_BUDGET_ROOT || resolve(PROJECT_ROOT, '.orchestos/subagent-budget')
const MAX_AGENTS = 2
const RESERVATION_TTL_MS = 60_000
const LOCK_TTL_MS = 5_000
const LOCK_WAIT_MS = 100

function parseInput(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function eventName(input) {
  return input?.hook_event_name || input?.event || input?.type || ''
}

function sessionPath(sessionId) {
  const safeId = createHash('sha256').update(sessionId).digest('hex')
  return join(STATE_ROOT, `${safeId}.json`)
}

function lockPath(statePath) {
  return `${statePath}.lock`
}

function waitForLock(path) {
  const started = Date.now()
  mkdirSync(STATE_ROOT, { recursive: true })
  while (Date.now() - started <= LOCK_WAIT_MS) {
    try {
      const fd = openSync(path, 'wx')
      writeFileSync(fd, String(Date.now()))
      return fd
    } catch (error) {
      if (error?.code !== 'EEXIST') return null
      try {
        if (Date.now() - statSync(path).mtimeMs > LOCK_TTL_MS) unlinkSync(path)
      } catch {
        // The lock can disappear between stat and unlink.
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5)
  }
  return null
}

function releaseLock(path, fd) {
  try {
    closeSync(fd)
  } catch {
    /* already closed */
  }
  try {
    unlinkSync(path)
  } catch {
    /* another process recovered a stale lock */
  }
}

function readState(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (!value || !Array.isArray(value.reservations) || !Array.isArray(value.active)) return null
    return value
  } catch (error) {
    if (error?.code === 'ENOENT') return { reservations: [], active: [] }
    return null
  }
}

function writeState(path, state) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(state))
  renameSync(temporary, path)
}

function withState(sessionId, mutate) {
  const path = sessionPath(sessionId)
  const lock = lockPath(path)
  const fd = waitForLock(lock)
  if (fd === null) return { ok: false }
  try {
    const state = readState(path)
    if (state === null) return { ok: false }
    const result = mutate(state)
    if (result.write) writeState(path, result.state)
    return { ok: true, value: result.value }
  } catch {
    return { ok: false }
  } finally {
    releaseLock(lock, fd)
  }
}

function prune(state, now = Date.now()) {
  state.reservations = state.reservations.filter(
    (reservation) => now - reservation.createdAt < RESERVATION_TTL_MS,
  )
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

function handlePreToolUse(input) {
  if (!input || typeof input.session_id !== 'string' || input.session_id.length === 0) {
    deny('No se pudo comprobar el presupuesto de subagentes; se deniega esta delegación.')
    return
  }
  const result = withState(input.session_id, (state) => {
    prune(state)
    const used = state.active.length + state.reservations.length
    if (used >= MAX_AGENTS) return { state, value: false, write: true }
    state.reservations.push({
      reservationId:
        typeof input.tool_use_id === 'string' && input.tool_use_id
          ? input.tool_use_id
          : `${randomUUID()}-${Date.now()}`,
      createdAt: Date.now(),
    })
    return { state, value: true, write: true }
  })
  if (!result.ok) {
    deny('No se pudo comprobar el presupuesto de subagentes; se deniega esta delegación.')
    return
  }
  if (result.value === false)
    deny('Máximo 2 subagentes activos. Espera a que termine uno; usa Luna y contexto mínimo.')
}

function handleStart(input) {
  if (typeof input?.session_id !== 'string' || typeof input?.agent_id !== 'string') return
  withState(input.session_id, (state) => {
    prune(state)
    const reservation = state.reservations.shift()
    if (reservation) state.active.push({ agentId: input.agent_id })
    return { state, value: null, write: Boolean(reservation) }
  })
}

function handleStop(input) {
  if (typeof input?.session_id !== 'string' || typeof input?.agent_id !== 'string') return
  withState(input.session_id, (state) => {
    state.active = state.active.filter((agent) => agent.agentId !== input.agent_id)
    return { state, value: null, write: true }
  })
}

function handleSessionStart(input) {
  if (typeof input?.session_id !== 'string') return
  const path = sessionPath(input.session_id)
  try {
    unlinkSync(path)
  } catch {
    /* no state is normal for a new session */
  }
}

const input = parseInput(readFileSync(0, 'utf8'))
const event = eventName(input)
if (event === 'PreToolUse' && (input.tool_name === 'Agent' || input.tool_name === 'agent'))
  handlePreToolUse(input)
else if (event === 'SubagentStart') handleStart(input)
else if (event === 'SubagentStop') handleStop(input)
else if (event === 'SessionStart') handleSessionStart(input)
