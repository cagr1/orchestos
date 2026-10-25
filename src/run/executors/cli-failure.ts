export type CliNoticeKind =
  | 'retrying'
  | 'quota'
  | 'rate-limit'
  | 'auth'
  | 'network'
  | 'overloaded'
  | 'invalid-model'
  | 'no-response'
  | 'process-exit'
  | 'timeout'
  | 'unknown'

export interface CliNotice {
  kind: CliNoticeKind
  message: string
  detail?: string
}

export function classifyCliFailure(text: string): CliNoticeKind {
  if (/quota|usage.?limit|out of usage|billing|credits|insufficient_quota/i.test(text))
    return 'quota'
  if (/\b429\b|rate.?limit/i.test(text)) return 'rate-limit'
  if (
    /\b401\b|\b403\b|unauthorized|authentication|not logged in|please log in|sign in|login required/i.test(
      text,
    )
  )
    return 'auth'
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|stream disconnected|network|fetch failed/i.test(text))
    return 'network'
  if (/\b503\b|\b529\b|overloaded|server_error/i.test(text)) return 'overloaded'
  if (
    /model.?not.?found|unsupported model|invalid model|model.*(?:not available|does not exist|may not exist)/i.test(
      text,
    )
  )
    return 'invalid-model'
  if (/timed out|timeout/i.test(text)) return 'timeout'
  if (/exited|process.exit|no result event/i.test(text)) return 'process-exit'
  return 'unknown'
}

const claudeKinds: Record<string, CliNoticeKind> = {
  authentication_failed: 'auth',
  billing_error: 'quota',
  model_not_found: 'invalid-model',
  overloaded: 'overloaded',
  rate_limit: 'rate-limit',
  server_error: 'overloaded',
  invalid_request: 'unknown',
  max_output_tokens: 'unknown',
}

export function claudeFailureKind(error: string): CliNoticeKind {
  return claudeKinds[error] ?? 'unknown'
}

export class CliFailure extends Error {
  constructor(readonly notice: CliNotice) {
    super(notice.detail ?? notice.message)
  }
}

export function cliFailureNotice(
  text: string,
  cli: string,
  model?: string,
  kind = classifyCliFailure(text),
): CliNotice {
  const messages: Record<CliNoticeKind, string> = {
    retrying: `${cli} is retrying the request.`,
    quota: `${cli} usage limit reached.`,
    'rate-limit': `${cli} request rate limit reached.`,
    auth: `${cli} authentication failed — sign in again.`,
    network: `${cli} could not reach the model — network connection failed.`,
    overloaded: `${cli} model provider is overloaded.`,
    'invalid-model': model
      ? `Model '${model}' is not available for ${cli}.`
      : `The selected model is not available for ${cli}.`,
    'no-response': `No response from ${model || cli} yet.`,
    'process-exit': `${cli} process exited before completing the response.`,
    timeout: `${cli} timed out waiting for ${model || 'the model'}.`,
    unknown: text,
  }
  return { kind, message: messages[kind], detail: text }
}
