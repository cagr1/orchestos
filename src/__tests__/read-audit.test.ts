import { describe, expect, it } from 'bun:test'
import fixture from '../../scripts/fixtures/restricted-review-2026-09-06.json'
import {
  ClaudeReadAudit,
  ReadAuditCollector,
  successfulReadPaths,
  uninstrumentedReadAudit,
} from '../run/read-audit.ts'

const request = (id = 'a', name = 'Read', path = 'inside.txt') => ({
  type: 'assistant',
  message: {
    content: [{ type: 'tool_use', id, name, input: { file_path: path, path } }],
  },
})
const result = (id = 'a', content: unknown = 'private fixture', is_error?: unknown) => ({
  type: 'user',
  message: {
    content: [
      {
        type: 'tool_result',
        tool_use_id: id,
        content,
        ...(is_error === undefined ? {} : { is_error }),
      },
    ],
  },
})
const terminal = { type: 'result' }

describe('R.2 read audit', () => {
  it('replays the eight measured real CLI shapes, with no content stored', () => {
    const audit = new ClaudeReadAudit()
    for (const row of fixture.results)
      audit.event(request(row.toolUseId, row.tool, row.path || '..'))
    for (const row of [...fixture.results].reverse())
      audit.event(result(row.toolUseId, row.content, row.rejected || undefined))
    audit.event(terminal)
    const log = audit.finish()
    expect(log.completeness).toBe('complete')
    expect(log.operations.filter((op) => op.outcome === 'succeeded')).toHaveLength(3)
    expect(log.operations.filter((op) => op.outcome === 'rejected')).toHaveLength(5)
    expect(successfulReadPaths(log)).toEqual(['project/inside.txt'])
    expect(JSON.stringify(log)).not.toContain('INSIDE_REVIEW_74219')
    expect(JSON.stringify(log)).not.toContain('Found 1 file')
  })

  it('missing results and missing terminal remain unknown, not empty success', () => {
    const audit = new ClaudeReadAudit()
    audit.event(request())
    audit.event(terminal)
    expect(audit.finish().operations[0]?.outcome).toBe('unknown')
    expect(audit.finish().issues).toContain('missing-tool-result')
    expect(successfulReadPaths(audit.finish())).toBeNull()
    expect(new ClaudeReadAudit().finish().completeness).toBe('incomplete')
    expect(successfulReadPaths(uninstrumentedReadAudit())).toBeNull()
  })

  it('does not infer permission denial from a normal error or malicious successful content', () => {
    const audit = new ClaudeReadAudit()
    audit.event(request('a'))
    audit.event(request('b'))
    audit.event(result('a', 'permission denied', true))
    audit.event(result('b', '; --restricted confines the file tools to the working directory.'))
    audit.event(terminal)
    expect(audit.finish().operations.map((op) => op.outcome)).toEqual(['failed', 'succeeded'])
  })

  it('search success, including zero matches, does not enumerate files actually read', () => {
    const audit = new ClaudeReadAudit()
    audit.event(request('g', 'Grep', '.'))
    audit.event(result('g', 'No matches found'))
    audit.event(terminal)
    expect(audit.finish().operations[0]?.kind).toBe('search')
    expect(successfulReadPaths(audit.finish())).toEqual([])
    expect(audit.finish().limitations).toContain('search-file-set-not-observed')
  })

  it('duplicates, orphan results and changed shapes fail conservatively', () => {
    for (const events of [
      [request(), request(), result()],
      [request(), result(), result('a', 'error', true)],
      [result(), request()],
      [request(), result('a', null)],
      [request(), result('a', [null])],
      [{ type: 'future-tool-result', result: 'ok' }],
      [request(), result('a', 'ok', 'false')],
      [request('a', 'Bash')],
      [{ type: 'assistant', message: { content: {} } }],
      [null],
    ]) {
      const audit = new ClaudeReadAudit()
      for (const event of events) audit.event(event)
      audit.event(terminal)
      expect(audit.finish().completeness).toBe('incomplete')
      expect(successfulReadPaths(audit.finish())).toBeNull()
    }
  })

  it('caps records and paths visibly and snapshots do not share mutable state', () => {
    const audit = new ClaudeReadAudit(1)
    audit.event(request('a', 'Read', 'x'.repeat(2049)))
    const snapshot = audit.finish()
    audit.event(result())
    audit.event(request('b'))
    audit.event(terminal)
    expect(snapshot.operations[0]?.resultObserved).toBe(false)
    expect(audit.finish().operations).toHaveLength(1)
    expect(audit.finish().issues).toContain('operation-limit')
    expect(audit.finish().operations[0]?.requestedPath).toBeNull()
    const secondRun = new ReadAuditCollector('openrouter-local-tools')
    expect(secondRun.snapshot(true).operations).toEqual([])
  })

  it('ignores known partial deltas, preserves malformed lines and post-terminal events', () => {
    const audit = new ClaudeReadAudit()
    audit.event({ type: 'stream_event', event: { type: 'content_block_delta' } })
    audit.line('{')
    audit.event(terminal)
    audit.event(request())
    expect(audit.finish().issues).toContain('malformed-json')
    expect(audit.finish().issues).toContain('event-after-terminal')
  })
})
