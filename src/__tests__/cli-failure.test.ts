import { expect, test } from 'bun:test'
import {
  classifyCliFailure,
  claudeFailureKind,
  cliFailureNotice,
} from '../run/executors/cli-failure.ts'
import { claudeEventToStep } from '../run/executors/step-event.ts'

test.each([
  ['429 Too many requests', 'rate-limit'],
  ['rate_limit', 'rate-limit'],
  ['usage limit reached', 'quota'],
  ['insufficient_quota 429', 'quota'],
  ["You've hit your 5-hour limit · resets 3:50pm (America/Guayaquil)", 'quota'],
  ["You've hit your weekly limit", 'quota'],
  ['You have reached your 7-day rate_limit', 'rate-limit'],
  ['401 Unauthorized', 'auth'],
  ['403', 'auth'],
  ['Please log in', 'auth'],
  ['not logged in', 'auth'],
  ['sign in', 'auth'],
  ['login required', 'auth'],
  ['login helper exited', 'process-exit'],
  ['ENOTFOUND example.test', 'network'],
  ['ECONNRESET', 'network'],
  ['Unable to connect. Is the computer able to access the url?', 'network'],
  ['stream disconnected', 'network'],
  ['503', 'overloaded'],
  ['Ollama error 404: model "uso18-modelo-inexistente" not found', 'invalid-model'],
  ['529 overloaded', 'overloaded'],
  ['model not found', 'invalid-model'],
  ['unsupported model', 'invalid-model'],
  ['Codex timed out after 120000ms', 'timeout'],
  ['Codex timed out after 120429ms', 'timeout'],
  ['took 1403 ms then process exited', 'process-exit'],
  ['took 1503 ms then process exited', 'process-exit'],
  ['took 1529 ms then process exited', 'process-exit'],
  ['took 1401 ms then process exited', 'process-exit'],
  ['app-server exited (1)', 'process-exit'],
  ['original strange failure', 'unknown'],
] as const)('classifies %s as %s', (text, kind) => expect(classifyCliFailure(text)).toBe(kind))

test('unknown failure preserves the original text', () => {
  expect(cliFailureNotice('opaque raw failure', 'Codex CLI')).toEqual({
    kind: 'unknown',
    message: 'opaque raw failure',
    detail: 'opaque raw failure',
  })
})

test('Claude result quota overrides rate_limit while retaining provider reset time', () => {
  const detail = "You've hit your 5-hour limit · resets 3:50pm (America/Guayaquil)"
  const kind = claudeFailureKind('rate_limit', detail)
  expect(kind).toBe('quota')
  expect(cliFailureNotice(detail, 'Claude Code CLI', 'sonnet', kind)).toEqual({
    kind: 'quota',
    message: 'Claude Code CLI usage limit reached.',
    detail,
  })
  expect(claudeFailureKind('rate_limit', '429 Too many requests')).toBe('rate-limit')
  expect(claudeFailureKind('authentication_failed', 'opaque failure')).toBe('auth')
})

test('Claude retry fixture retains attempt, cause and no-response duration', () => {
  const retry = JSON.parse(
    '{"type":"system","subtype":"api_retry","attempt":2,"max_retries":5,"retry_delay_ms":1000,"error_status":429,"error":"rate_limit","no_response":{"waited_ms":12000,"retry_wait_ms":1000}}',
  )
  const notice = claudeEventToStep(retry)[0]?.notice
  expect(notice?.kind).toBe('retrying')
  expect(notice?.message).toContain('2/5: rate_limit')
  expect(notice?.message).toContain('12 s')
  expect(JSON.parse(notice!.detail!)).toEqual(retry)
})

test('Claude assistant API error fixture maps code directly', () => {
  const fixture = JSON.parse(
    '{"type":"assistant","error":"model_not_found","api_error_status":"404","is_api_error_message":true,"message":{"model":"<synthetic>"}}',
  )
  expect(claudeEventToStep(fixture)[0]?.notice?.kind).toBe('invalid-model')
  expect(claudeEventToStep(fixture).some((step) => step.type === 'text')).toBe(false)
  expect(claudeFailureKind('authentication_failed')).toBe('auth')
  expect(claudeFailureKind('billing_error')).toBe('quota')
  expect(claudeFailureKind('overloaded')).toBe('overloaded')
  expect(claudeFailureKind('invalid_request')).toBe('unknown')
})

test('invalid models include the update and Model routing hint', () => {
  for (const model of ['gpt-6.1-sol', undefined]) {
    const notice = cliFailureNotice('model_not_found', 'Codex CLI', model)
    expect(notice.kind).toBe('invalid-model')
    expect(notice.message).toContain('update the CLI or pick another model in Model routing')
    if (model) expect(notice.message).toContain(model)
  }
})
