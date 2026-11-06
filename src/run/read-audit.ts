/** R.2: evidence about explicit tools, never a filesystem-wide access log. */
export type ReadOutcome = 'succeeded' | 'rejected' | 'failed' | 'unknown'
export interface ReadOperation {
  callId: string
  tool: string
  kind: 'read' | 'search' | 'list'
  requestedPath: string | null
  outcome: ReadOutcome
  resultObserved: boolean
}
export interface ReadAudit {
  version: 1
  source: 'claude-stream' | 'openrouter-local-tools' | 'uninstrumented'
  coverage: 'explicit-tools-only' | 'none'
  completeness: 'complete' | 'incomplete' | 'unknown'
  tools: string[]
  limitations: string[]
  issues: string[]
  operations: ReadOperation[]
}

export function uninstrumentedReadAudit(): ReadAudit {
  return {
    version: 1,
    source: 'uninstrumented',
    coverage: 'none',
    completeness: 'unknown',
    tools: [],
    limitations: ['transport-not-instrumented', 'implicit-reads-not-observed'],
    issues: [],
    operations: [],
  }
}

/** Old/corrupt/unsupported records never acquire a fabricated clean history. */
export function parseReadAudit(raw: string | null | undefined): ReadAudit {
  if (!raw) return uninstrumentedReadAudit()
  try {
    const audit = JSON.parse(raw) as ReadAudit
    const strings = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    if (
      audit?.version === 1 &&
      ['claude-stream', 'openrouter-local-tools', 'uninstrumented'].includes(audit.source) &&
      ['explicit-tools-only', 'none'].includes(audit.coverage) &&
      ['complete', 'incomplete', 'unknown'].includes(audit.completeness) &&
      strings(audit.tools) &&
      strings(audit.limitations) &&
      strings(audit.issues) &&
      Array.isArray(audit.operations) &&
      audit.operations.length <= 512 &&
      audit.operations.every(
        (op) =>
          op &&
          typeof op.callId === 'string' &&
          op.callId.length > 0 &&
          op.callId.length <= 256 &&
          typeof op.tool === 'string' &&
          ['read', 'search', 'list'].includes(op.kind) &&
          ['succeeded', 'rejected', 'failed', 'unknown'].includes(op.outcome) &&
          typeof op.resultObserved === 'boolean' &&
          (op.resultObserved || op.outcome === 'unknown') &&
          (op.requestedPath === null ||
            (typeof op.requestedPath === 'string' && op.requestedPath.length <= 2048)),
      ) &&
      new Set(audit.operations.map((op) => op.callId)).size === audit.operations.length &&
      (audit.completeness !== 'complete' ||
        (audit.coverage !== 'none' &&
          audit.source !== 'uninstrumented' &&
          !audit.issues.length &&
          audit.operations.every((op) => op.resultObserved && op.outcome !== 'unknown')))
    ) {
      return audit
    }
  } catch {
    /* unknown below */
  }
  return { ...uninstrumentedReadAudit(), issues: ['invalid-persisted-audit'] }
}

/** Compatibility projection, not exhaustive: searches never become file reads. */
export function successfulReadPaths(audit: ReadAudit): string[] | null {
  if (audit.completeness !== 'complete' || audit.coverage === 'none') return null
  return [
    ...new Set(
      audit.operations
        .filter(
          (op) =>
            op.kind === 'read' &&
            op.outcome === 'succeeded' &&
            op.resultObserved &&
            op.requestedPath !== null,
        )
        .flatMap((op) => (op.requestedPath === null ? [] : [op.requestedPath])),
    ),
  ]
}

const toolKinds = {
  Read: 'read',
  Grep: 'search',
  Glob: 'list',
  read_file: 'read',
  read_plan: 'read',
  read_tasks: 'read',
  read_ideas: 'read',
} as const
export type AuditedReadTool = keyof typeof toolKinds

export class ReadAuditCollector {
  private calls = new Map<string, ReadOperation>()
  private ambiguous = new Set<string>()
  private issues = new Set<string>()
  constructor(
    private source: 'claude-stream' | 'openrouter-local-tools',
    private limit = 512,
  ) {}

  issue(code: string): void {
    this.issues.add(code)
  }

  request(callId: string, tool: AuditedReadTool, path: unknown): void {
    if (!callId || callId.length > 256) {
      this.issue('invalid-call-id')
      return
    }
    const existing = this.calls.get(callId)
    if (existing) {
      this.issue('duplicate-call-id')
      this.ambiguous.add(callId)
      existing.outcome = 'unknown'
      return
    }
    if (this.calls.size >= this.limit) {
      this.issue('operation-limit')
      return
    }
    const validPath = typeof path === 'string' && path.length > 0 && path.length <= 2048
    if (!validPath) this.issue('invalid-or-oversized-path')
    this.calls.set(callId, {
      callId,
      tool,
      kind: toolKinds[tool],
      requestedPath: validPath ? path : null,
      outcome: 'unknown',
      resultObserved: false,
    })
  }

  result(callId: string, outcome: ReadOutcome): void {
    const op = this.calls.get(callId)
    if (!op) {
      this.issue('orphan-result')
      return
    }
    if (op.resultObserved) {
      this.issue('duplicate-result')
      this.ambiguous.add(callId)
    }
    op.resultObserved = true
    op.outcome = this.ambiguous.has(callId) ? 'unknown' : outcome
  }

  snapshot(ended: boolean): ReadAudit {
    const operations = [...this.calls.values()].map((op) => ({ ...op }))
    const issues = [...this.issues]
    if (!ended) issues.push('missing-terminal-event')
    if (operations.some((op) => !op.resultObserved)) issues.push('missing-tool-result')
    return {
      version: 1,
      source: this.source,
      coverage: 'explicit-tools-only',
      completeness:
        issues.length || operations.some((op) => op.outcome === 'unknown')
          ? 'incomplete'
          : 'complete',
      tools:
        this.source === 'claude-stream'
          ? ['Read', 'Grep', 'Glob']
          : ['read_file', 'read_plan', 'read_tasks', 'read_ideas'],
      limitations: ['implicit-reads-not-observed', 'search-file-set-not-observed'],
      issues,
      operations,
    }
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Shapes measured against Claude Code 2.1.263; absent is_error means success.
 * Error text is used only for the measured restricted denial, never retained.
 * Other tool errors remain failed (not presumed permission denials).
 */
export class ClaudeReadAudit extends ReadAuditCollector {
  private ended = false
  constructor(limit?: number) {
    super('claude-stream', limit)
  }

  line(line: string): void {
    try {
      this.event(JSON.parse(line))
    } catch {
      this.issue('malformed-json')
    }
  }

  event(raw: unknown): void {
    const evt = record(raw)
    if (!evt || typeof evt.type !== 'string') {
      this.issue('malformed-event')
      return
    }
    if (this.ended) this.issue('event-after-terminal')
    if (evt.type === 'result') {
      this.ended = true
      return
    }
    if (evt.type !== 'assistant' && evt.type !== 'user') {
      if (!['system', 'stream_event', 'rate_limit_event'].includes(evt.type))
        this.issue('unobserved-event-type')
      return
    }
    const content = record(evt.message)?.content
    if (!Array.isArray(content)) {
      this.issue('malformed-message')
      return
    }
    for (const rawBlock of content) {
      const block = record(rawBlock)
      if (!block) {
        this.issue('malformed-block')
        continue
      }
      if (
        (block.type === 'tool_use' && evt.type !== 'assistant') ||
        (block.type === 'tool_result' && evt.type !== 'user')
      )
        this.issue('unexpected-tool-role')
      if (evt.type === 'assistant' && block.type === 'tool_use') {
        if (!['Read', 'Grep', 'Glob'].includes(String(block.name))) {
          this.issue('unobserved-tool')
          continue
        }
        if (typeof block.id !== 'string') {
          this.issue('invalid-call-id')
          continue
        }
        const input = record(block.input)
        if (!input) this.issue('malformed-tool-input')
        this.request(
          block.id,
          block.name as AuditedReadTool,
          block.name === 'Read' ? input?.file_path : (input?.path ?? '.'),
        )
      }
      if (evt.type === 'user' && block.type === 'tool_result') {
        if (typeof block.tool_use_id !== 'string') {
          this.issue('invalid-result-id')
          continue
        }
        if (
          (block.is_error !== undefined && typeof block.is_error !== 'boolean') ||
          typeof block.content !== 'string'
        ) {
          this.issue('malformed-tool-result')
          this.result(block.tool_use_id, 'unknown')
          continue
        }
        const rejected =
          block.is_error === true &&
          typeof block.content === 'string' &&
          block.content.endsWith('; --restricted confines the file tools to the working directory.')
        this.result(
          block.tool_use_id,
          block.is_error === true ? (rejected ? 'rejected' : 'failed') : 'succeeded',
        )
      }
    }
  }

  finish(): ReadAudit {
    return this.snapshot(this.ended)
  }
}
