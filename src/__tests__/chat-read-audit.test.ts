import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuditedProjectReader } from '../dashboard/handlers/chat.ts'
import { createToolRouter, READ_FILE_TOOL, runToolLoop } from '../providers/tool-call.ts'
import { parseReadAudit, ReadAuditCollector, successfulReadPaths } from '../run/read-audit.ts'

describe('R.2 local reader observations', () => {
  it('covers fixed readers, failures, refusals and error-looking successful content', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-read-audit-'))
    try {
      const root = join(home, 'project')
      mkdirSync(root)
      writeFileSync(join(root, 'PLAN.md'), '[read_file: path refused]')
      writeFileSync(join(root, 'tasks.yaml'), 'version: 1')
      writeFileSync(join(home, 'outside.txt'), 'PRIVATE_OUTSIDE_FIXTURE')
      symlinkSync(join(home, 'outside.txt'), join(root, 'link.txt'))
      const audit = new ReadAuditCollector('openrouter-local-tools')
      const read = createAuditedProjectReader(root, audit)
      expect(await read('read_plan', {}, 'plan')).toBe('[read_file: path refused]')
      await read('read_tasks', {}, 'tasks')
      await read('read_ideas', {}, 'ideas')
      await read('read_file', { path: '../outside.txt' }, 'escape')
      await read('read_file', { path: 'link.txt' }, 'symlink')
      await read('read_file', { path: 'tasks.yaml' }, 'file')
      const log = audit.snapshot(true)
      expect(log.operations.map((op) => op.outcome)).toEqual([
        'succeeded',
        'succeeded',
        'failed',
        'rejected',
        'rejected',
        'succeeded',
      ])
      expect(log.completeness).toBe('complete')
      expect(successfulReadPaths(log)).toEqual(['PLAN.md', 'tasks.yaml'])
      expect(JSON.stringify(log)).not.toContain('PRIVATE_OUTSIDE_FIXTURE')
      expect(parseReadAudit(JSON.stringify(log))).toEqual(log)
      expect(parseReadAudit(null).completeness).toBe('unknown')
      expect(parseReadAudit('{').completeness).toBe('unknown')
      expect(parseReadAudit(JSON.stringify({ ...log, version: 99 })).completeness).toBe('unknown')
      expect(
        parseReadAudit(
          JSON.stringify({ ...log, operations: [{ ...log.operations[0], resultObserved: false }] }),
        ).completeness,
      ).toBe('unknown')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('preserves provider call IDs through the real loop and router; concurrent logs are separate', async () => {
    const originalFetch = globalThis.fetch
    const key = process.env.OPENROUTER_API_KEY
    const home = mkdtempSync(join(tmpdir(), 'orchestos-read-loop-'))
    try {
      writeFileSync(join(home, 'inside.txt'), 'SYNTHETIC_READ')
      process.env.OPENROUTER_API_KEY = 'test-fixture'
      globalThis.fetch = (async (_url, options) => {
        const body = JSON.parse(String(options?.body))
        const toolReply = body.messages.some((message: { role: string }) => message.role === 'tool')
        return Response.json({
          choices: [
            {
              message: toolReply
                ? { content: 'done' }
                : {
                    content: null,
                    tool_calls: [
                      {
                        id: 'provider-call-42',
                        type: 'function',
                        function: {
                          name: 'read_file',
                          arguments: JSON.stringify({ path: 'inside.txt' }),
                        },
                      },
                    ],
                  },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        })
      }) as typeof fetch
      const audits = await Promise.all(
        [1, 2].map(async () => {
          const audit = new ReadAuditCollector('openrouter-local-tools')
          await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
            system: 'fixture',
            messages: [{ role: 'user', content: 'read' }],
            tools: [READ_FILE_TOOL],
            executeTool: createToolRouter({ read_file: createAuditedProjectReader(home, audit) }),
          })
          return audit.snapshot(true)
        }),
      )
      for (const log of audits) {
        expect(log.operations).toHaveLength(1)
        expect(log.operations[0]?.callId).toBe('provider-call-42')
        expect(log.operations[0]?.outcome).toBe('succeeded')
      }
      expect(audits[0]).not.toBe(audits[1])
    } finally {
      globalThis.fetch = originalFetch
      if (key === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = key
      rmSync(home, { recursive: true, force: true })
    }
  })
})
