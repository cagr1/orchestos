import { ROLE_AGENTS, type RoleAgent } from '../../config/schema.ts'
import { readCliModelCatalogs } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'
import { type ChatModelsFetch, readOpenRouterChatModels } from './chat.ts'

export interface CatalogAgent {
  id: RoleAgent
  installed: boolean
  models: { id: string; name: string }[]
  efforts: string[]
  error?: string
}

export async function handleApiModelCatalog(deps?: {
  readCli?: typeof readCliModelCatalogs
  fetchFn?: ChatModelsFetch
}): Promise<Response> {
  const reader = deps?.readCli ?? readCliModelCatalogs
  let cli: Awaited<ReturnType<typeof readCliModelCatalogs>> = []
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
      models: entry?.models.map(({ id: modelId, name }) => ({ id: modelId, name })) ?? [],
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
