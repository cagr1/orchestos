import { describe, expect, test } from 'bun:test'
import { listSkills } from './projectTabs'

describe('project tabs API mapping', () => {
  test('uses the selected project and preserves real skill fields', async () => {
    const originalFetch = globalThis.fetch
    let seen: RequestInit | undefined
    globalThis.fetch = (async (_input, init) => {
      seen = init
      return new Response(
        JSON.stringify([
          {
            id: 'skill-a',
            name: 'A',
            description: 'real',
            language: 'TypeScript',
            verifierCommand: 'bun test',
            status: 'source',
            usageRuns: 4,
          },
        ]),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      await expect(listSkills('project-1')).resolves.toEqual([
        {
          id: 'skill-a',
          name: 'A',
          description: 'real',
          language: 'TypeScript',
          verifierCommand: 'bun test',
          status: 'source',
          usageRuns: 4,
        },
      ])
      expect(new Headers(seen?.headers).get('x-orchestos-project-id')).toBe('project-1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
