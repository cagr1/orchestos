import { resolve } from 'path'
import { getProject } from '../../db/projects.ts'
import { suggestContext } from '../../graph/suggest.ts'
import { inferEmbeddingProvider } from '../../providers/embeddings.ts'
import { jsonResponse, errorResponse } from '../http.ts'

// E.10 (Mes 18, paridad CLI↔Dashboard) — equivalente de `orchestos context suggest <task>`
// (S24). Igual que la CLI: intenta un embedding real, y si no hay proveedor
// disponible cae en silencio al matching por keyword (suggestContext ya soporta
// ambos caminos — no hace falta que embeddings funcionen end-to-end para que
// esto sea útil, mismo comportamiento gracioso que la CLI).
export async function handleApiContextSuggest(url: URL): Promise<Response> {
  const taskText = url.searchParams.get('task')?.trim()
  if (!taskText) return errorResponse('task query param is required', 400)
  const topN = Math.max(1, parseInt(url.searchParams.get('top') ?? '10', 10) || 10)

  const root = resolve('.')
  const project = getProject(root)
  if (!project) {
    return errorResponse('Project not indexed yet — run "Index code graph" first', 404)
  }

  let taskEmbedding: number[] | undefined
  let embeddingAvailable = true
  try {
    const ep = inferEmbeddingProvider('openai')
    const { embeddings } = await ep.embed([taskText])
    taskEmbedding = embeddings[0]
  } catch {
    embeddingAvailable = false
  }

  const results = suggestContext(project.id, taskText, { topN, taskEmbedding })
  return jsonResponse({ results, embeddingAvailable })
}
