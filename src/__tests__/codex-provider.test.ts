import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chat } from '../providers/codex.ts'

const originalSpawn = Bun.spawn

afterEach(() => {
  Bun.spawn = originalSpawn
})

function mockSpawn(calls: Array<{ cmd: string[]; env?: Record<string, string | undefined> }>) {
  Bun.spawn = ((cmd: string[], opts?: { env?: Record<string, string | undefined> }) => {
    calls.push({ cmd: cmd.slice(), env: opts?.env })
    const text = (s: string) =>
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(s))
          c.close()
        },
      })
    return { stdout: text('{"text":"ok"}\n'), stderr: text(''), exited: Promise.resolve(0) }
  }) as unknown as typeof Bun.spawn
}

describe('providers/codex — R.8.5.1', () => {
  it('lanza codex exec con CODEX_HOME aislado en el home del proyecto', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-codex-provider-'))
    try {
      const calls: Array<{ cmd: string[]; env?: Record<string, string | undefined> }> = []
      mockSpawn(calls)
      const res = await chat(
        { model: 'm', system: 's', messages: [{ role: 'user', content: 'q' }] },
        { projectRoot: root },
      )
      const home = join(root, '.orchestos', 'agent-home', 'codex')
      expect(res.text).toBe('ok')
      expect(calls).toHaveLength(1)
      expect(calls[0]!.env?.CODEX_HOME).toBe(home)
      expect(existsSync(join(home, 'AGENTS.md'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
