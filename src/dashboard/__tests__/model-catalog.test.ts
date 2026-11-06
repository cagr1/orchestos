import { beforeEach, describe, expect, it } from 'bun:test'
import { clearChatModelsCache } from '../handlers/chat.ts'
import { handleApiModelCatalog } from '../handlers/model-catalog.ts'

describe('GET /api/models/catalog handler', () => {
  beforeEach(() => clearChatModelsCache())

  it('returns ordered CLI and API catalogs, keeping missing CLIs and API errors non-fatal', async () => {
    const response = await handleApiModelCatalog({
      readCli: async () => [
        {
          id: 'codex',
          models: [{ id: 'gpt-6-luna', name: 'Luna', short: 'Luna' }],
          efforts: ['medium'],
        },
      ],
      fetchFn: async () => {
        throw new Error('offline')
      },
    })
    expect(response.status).toBe(200)
    const { agents } = (await response.json()) as {
      agents: {
        id: string
        installed: boolean
        models: unknown[]
        efforts: string[]
        error?: string
      }[]
    }
    expect(agents.map((agent) => agent.id)).toEqual(['claude', 'codex', 'opencode', 'api'])
    expect(agents[0]).toMatchObject({ installed: false, models: [] })
    expect(agents[1]).toMatchObject({
      installed: true,
      models: [{ id: 'gpt-6-luna', name: 'Luna' }],
      efforts: ['medium'],
    })
    expect(agents[3]).toMatchObject({
      installed: true,
      models: [],
      efforts: [],
      error: 'Unable to load chat models',
    })
  })
})
