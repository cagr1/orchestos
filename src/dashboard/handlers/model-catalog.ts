import { ROLE_AGENTS, type RoleAgent } from '../../config/schema.ts'
import { readCliModelCatalogsCached } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'
import { type ChatModelsFetch, readOpenRouterChatModels } from './chat.ts'

export interface CatalogAgent {
  id: RoleAgent
  installed: boolean
  models: { id: string; name: string; efforts?: string[] }[]
  efforts: string[]
  error?: string
}

export async function handleApiModelCatalog(deps?: {
  readCli?: typeof readCliModelCatalogsCached
  fetchFn?: ChatModelsFetch
}): Promise<Response> {
  const reader = deps?.readCli ?? readCliModelCatalogsCached
  let cli: Awaited<ReturnType<typeof readCliModelCatalogsCached>> = []
  try {
    cli = await reader()
  } catch {
    cli = []
  }
  const agents: CatalogAgent[] = ROLE_AGENTS.map((id) => {
    if (id === 'api') return { id, installed: true, models: [], efforts: [] }
    const entry = cli.find((catalog) => catalog.id === id)
    return {
      id,
      installed: Boolean(entry),
      models:
        entry?.models.map(({ id: modelId, name, efforts }) => ({ id: modelId, name, efforts })) ??
        [],
      efforts: entry?.efforts ?? [],
    }
  })
  try {
    const models = await readOpenRouterChatModels(deps?.fetchFn)
    agents[3]!.models = (models as { id: string; name: string }[]).map(({ id, name }) => ({
      id,
      name,
    }))
  } catch (error) {
    agents[3]!.error = error instanceof Error ? error.message : String(error)
  }
  return jsonResponse({ agents })
}
