import { resolve, join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { chat as openrouterChat } from '../../providers/openrouter.ts'
import { loadContext } from '../../context/load.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { jsonResponse, errorResponse } from '../http.ts'

function handleApiProjectConstitutionGet(): Response {
  const root = resolve('.')
  const path = join(root, 'CONSTITUTION.md')
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf-8') : ''
  return jsonResponse({ content, exists })
}

async function handleApiProjectConstitutionPut(req: Request): Promise<Response> {
  let body: { content: string }
  try { body = (await req.json()) as { content: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (typeof body.content !== 'string') return errorResponse('content must be a string', 400)
  const root = resolve('.')
  writeFileSync(join(root, 'CONSTITUTION.md'), body.content, 'utf-8')
  return jsonResponse({ ok: true })
}

function handleApiProjectContextGet(): Response {
  const root = resolve('.')
  const path = join(root, 'CONTEXT.md')
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf-8') : ''
  return jsonResponse({ content, exists })
}

function handleApiProjectContextRegenerate(): Response {
  const root = resolve('.')
  Bun.spawn([process.execPath, 'run', join(root, 'src/cli.ts'), 'context', 'compress'], {
    cwd: root, stdout: 'inherit', stderr: 'inherit',
  })
  return jsonResponse({ ok: true })
}

async function handleApiNatural(req: Request): Promise<Response> {
  let body: { input: string }
  try { body = (await req.json()) as { input: string } } catch { return errorResponse('Invalid JSON', 400) }
  const input = body.input?.trim()
  if (!input) return errorResponse('input is required', 400)

  const root = resolve('.')
  const projectCtx = loadContext(root)
  let tasksSummary = ''
  try {
    const file = loadTasks(root)
    tasksSummary = (file.tasks as any[]).slice(0, 15)
      .map((t: any) => `- ${t.id}: ${t.description}`)
      .join('\n')
  } catch {}

  const systemPrompt = `Eres un asistente que convierte instrucciones en lenguaje natural en definiciones de tareas para el orquestador OrchestOS.

Dado lo que el usuario quiere hacer, devuelve ÚNICAMENTE un objeto JSON con exactamente estas claves:
- "id": slug kebab-case de 3-5 palabras que describe la tarea (sin números al final, sin caracteres especiales)
- "description": descripción clara de la tarea en 1-2 frases
- "output": array de rutas de archivos que probablemente se crearán o modificarán (puede estar vacío si no es claro)
- "executor": uno de "openrouter" (por defecto), "anthropic" (tareas complejas de código), "openai" (embeddings/análisis)

${projectCtx ? `Contexto del proyecto:\n${projectCtx}\n` : ''}
${tasksSummary ? `Tareas existentes (para evitar duplicados):\n${tasksSummary}\n` : ''}

Responde SOLO con el JSON, sin texto adicional ni bloques de código.`

  try {
    const resp = await openrouterChat({
      model: 'anthropic/claude-haiku-4-5',
      system: systemPrompt,
      messages: [{ role: 'user', content: input }],
    })
    const raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const draft = JSON.parse(raw) as { id: string; description: string; output: string[]; executor: string }
    draft.id = (draft.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'nueva-tarea'
    if (!Array.isArray(draft.output)) draft.output = []
    if (!['openrouter', 'anthropic', 'openai'].includes(draft.executor)) draft.executor = 'openrouter'
    return jsonResponse(draft)
  } catch (e: any) {
    return errorResponse(`LLM draft failed: ${e.message}`, 502)
  }
}

export { handleApiProjectConstitutionGet, handleApiProjectConstitutionPut, handleApiProjectContextGet, handleApiProjectContextRegenerate, handleApiNatural }
