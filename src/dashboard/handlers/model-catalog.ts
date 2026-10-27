import type { RoleAgent } from '../../config/schema.ts'
import { roleAgentIds } from '../../run/executors/chat-adapters.ts'
import { whichCli } from '../../run/executors/cli-discovery.ts'
import { configuredClis } from '../../run/executors/cli-registry.ts'
import { taskEngineForCli } from '../../run/executors/task-engines.ts'
import { readCliModelCatalogsCached } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'
import { type ChatModelsFetch, readOpenRouterChatModels } from './chat.ts'

interface CatalogAgent {
  id: RoleAgent
  installed: boolean
  generic?: boolean
  label?: string
  /** `false` = sin ejecutor de tareas: no se ofrece al rol Ejecutor. */
  taskEngine: boolean
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
  const agents: CatalogAgent[] = roleAgentIds().map((id) => {
    if (id === 'api') return { id, installed: true, taskEngine: true, models: [], efforts: [] }
    const entry = cli.find((catalog) => catalog.id === id)
    return {
      id,
      installed: Boolean(entry),
      taskEngine: taskEngineForCli(id) !== undefined,
      models:
        entry?.models.map(({ id: modelId, name, efforts }) => ({ id: modelId, name, efforts })) ??
        [],
      efforts: entry?.efforts ?? [],
    }
  })
  agents.push(
    ...configuredClis().map((cli) => ({
      id: cli.id,
      label: cli.label,
      generic: true,
      installed: whichCli(cli.command) !== null,
      taskEngine: true,
      models: [
        { id: 'default', name: 'Default del CLI' },
        ...(cli.modelArgs
          ? (cli.models ?? []).filter((id) => id !== 'default').map((id) => ({ id, name: id }))
          : []),
      ],
      efforts: [],
    })),
  )
  try {
    const models = await readOpenRouterChatModels(deps?.fetchFn)
    const apiAgent = agents.find((agent) => agent.id === 'api')
    if (apiAgent)
      apiAgent.models = (models as { id: string; name: string }[]).map(({ id, name }) => ({
        id,
        name,
      }))
  } catch (error) {
    const apiAgent = agents.find((agent) => agent.id === 'api')
    if (apiAgent) apiAgent.error = error instanceof Error ? error.message : String(error)
  }
  return jsonResponse({ agents })
}
