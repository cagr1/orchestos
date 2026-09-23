import { describe, expect, test } from 'bun:test'
import { getProjectContext } from './project'

describe('getProjectContext', () => {
  test('joins the three project endpoints and labels missing files', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      const path = String(input)
      if (path.endsWith('/constitution'))
        return new Response(JSON.stringify({ content: 'preview', exists: false }))
      if (path.endsWith('/context'))
        return new Response(JSON.stringify({ content: '', exists: false }))
      return new Response(
        JSON.stringify({
          files: 4,
          edges: 3,
          languages: [{ language: 'ts', files: 4 }],
          staleFiles: ['src/removed.ts'],
          gitBranch: 'main',
          isCleanWorktree: true,
          indexedAt: '2026-09-23T00:00:00Z',
        }),
      )
    }) as typeof fetch
    try {
      await expect(getProjectContext('project-1')).resolves.toEqual({
        constitution: 'CONSTITUTION.md does not exist in this project.',
        contextDoc: 'CONTEXT.md does not exist in this project.',
        codeGraphNodes: 4,
        edges: 3,
        languages: [{ language: 'ts', files: 4 }],
        staleFiles: ['src/removed.ts'],
        gitBranch: 'main',
        isCleanWorktree: true,
        indexedAt: '2026-09-23T00:00:00Z',
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
