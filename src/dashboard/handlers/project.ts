import { resolve, join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { chat as openrouterChat } from '../../providers/openrouter.ts'
import { loadContext } from '../../context/load.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { jsonResponse, errorResponse } from '../http.ts'
import { listSkillFiles, listProSkillFiles, loadSkill } from '../../skills/registry.ts'
import { buildProfile } from '../../detect/profile.ts'
import { generateAgentsMd } from '../../generators/agents-md.ts'
import { generateContextJson } from '../../generators/context-json.ts'
import { getProject, upsertProject } from '../../db/projects.ts'
import { indexProject } from '../../graph/index.ts'
import { scaffoldConstitutionMd } from '../../spec/constitution.ts'
import { generateSummaryPdf } from '../../generators/summary-pdf.ts'
import { listRuns } from '../../db/runs.ts'

// v0.12 D.1.b — equivalente de `orchestos constitution init` para el dashboard.
// Si CONSTITUTION.md NO existe en disco, devolvemos el scaffold ALLOWED/FORBIDDEN/
// REQUIRE_CONFIRMATION (mismo contenido que `scaffoldConstitutionMd()` en CLI) con
// `exists:false` para que la UI muestre un banner "Preview — not saved yet" y sepa
// que el primer PUT (autosave al editar) es el que materializa el archivo. Cierra
// el gap "editor arranca vacío → no-dev escribe cualquier cosa y rompe el formato".
function handleApiProjectConstitutionGet(): Response {
  const root = resolve('.')
  const path = join(root, 'CONSTITUTION.md')
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf-8') : scaffoldConstitutionMd()
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

// Bloque D (Mes 18, ex-IDEAS #21) — lista de skills instaladas (main + pro) con
// su `when_to_use`/`description`, usada tanto para el prompt del clasificador
// como para validar los candidatos que devuelva el LLM (nunca confiar en un id
// inventado). Ver docs/semantic-skill-selection-design.md.
interface SkillCandidateInfo {
  id: string
  name: string
  description: string
  whenToUse: string[]
}

function listAllSkillCandidates(): SkillCandidateInfo[] {
  const files = [...listSkillFiles(), ...listProSkillFiles()]
  const out: SkillCandidateInfo[] = []
  for (const f of files) {
    try {
      const s = loadSkill(f)
      out.push({ id: s.id, name: s.name, description: s.description, whenToUse: s.when_to_use ?? [] })
    } catch {}
  }
  return out
}

// E.8 (Mes 18, paridad CLI↔Dashboard) — equivalente de `orchestos detect [path]`:
// dry-run, regenera AGENTS.md + context.json sobre el proyecto actual sin tocar la DB.
async function handleApiProjectDetect(): Promise<Response> {
  const root = resolve('.')
  const t0 = performance.now()
  const profile = await buildProfile(root)
  const agentsMd = generateAgentsMd(profile)
  const contextJson = generateContextJson(profile)
  writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
  writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')
  const elapsedMs = Math.round(performance.now() - t0)
  return jsonResponse({
    ok: true,
    name: profile.manifest.name,
    runtime: profile.manifest.runtime,
    framework: profile.manifest.framework,
    elapsedMs,
  })
}

// E.8 — equivalente de `orchestos index [path]`: indexa el proyecto actual en el
// code graph (S21). Crea el registro de proyecto en DB si aún no existe (mismo
// fallback que `ensureProject()` en cli.ts).
async function handleApiProjectIndex(): Promise<Response> {
  const root = resolve('.')
  let project = getProject(root)
  if (!project) {
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    upsertProject(root, profile, agentsMd)
    project = getProject(root)
    if (!project) return errorResponse('Failed to save project context', 500)
  }
  const t0 = performance.now()
  const result = await indexProject(root, project.id)
  const elapsedMs = Math.round(performance.now() - t0)
  return jsonResponse({ ok: true, files: result.files, edges: result.edges, embeddings: result.embeddings, elapsedMs })
}

export interface NaturalDraft {
  id: string
  description: string
  output: string[]
  executor: string
  skillCandidates: string[]
  skillOptions: { id: string; name: string; description: string }[]
}

// D.7 (Mes 22) — extraído de handleApiNatural para que el auto-flow del chat
// (handlers/chat.ts) pueda pedir el mismo draft por lenguaje natural sin pasar
// por una Request/Response HTTP. handleApiNatural queda como wrapper delgado.
async function buildNaturalDraft(input: string): Promise<NaturalDraft> {
  const root = resolve('.')
  const projectCtx = loadContext(root)
  let tasksSummary = ''
  try {
    const file = loadTasks(root)
    tasksSummary = (file.tasks as any[]).slice(0, 15)
      .map((t: any) => `- ${t.id}: ${t.description}`)
      .join('\n')
  } catch {}

  const skillCandidateInfos = listAllSkillCandidates()
  const skillsSummary = skillCandidateInfos
    .map(s => `- ${s.id}: ${s.description}${s.whenToUse.length ? ' — Use when: ' + s.whenToUse.join('; ') : ''}`)
    .join('\n')

  const systemPrompt = `Eres un asistente que convierte instrucciones en lenguaje natural en definiciones de tareas para el orquestador OrchestOS.

Dado lo que el usuario quiere hacer, devuelve ÚNICAMENTE un objeto JSON con exactamente estas claves:
- "id": slug kebab-case de 3-5 palabras que describe la tarea (sin números al final, sin caracteres especiales)
- "description": descripción clara de la tarea en 1-2 frases
- "output": array de rutas de archivos que probablemente se crearán o modificarán (puede estar vacío si no es claro)
- "executor": uno de "openrouter" (por defecto), "anthropic" (tareas complejas de código), "openai" (embeddings/análisis)
- "skill_candidates": array de ids de skill de la lista de abajo que apliquen a esta tarea (puede estar vacío si ninguna aplica). Nunca inventes un id que no esté en la lista.

${projectCtx ? `Contexto del proyecto:\n${projectCtx}\n` : ''}
${tasksSummary ? `Tareas existentes (para evitar duplicados):\n${tasksSummary}\n` : ''}
${skillsSummary ? `Skills instaladas disponibles:\n${skillsSummary}\n` : ''}

Responde SOLO con el JSON, sin texto adicional ni bloques de código.`

  const resp = await openrouterChat({
    model: 'anthropic/claude-haiku-4-5',
    system: systemPrompt,
    messages: [{ role: 'user', content: input }],
  })
  const raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const draft = JSON.parse(raw) as { id: string; description: string; output: string[]; executor: string; skill_candidates?: unknown }
  draft.id = (draft.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'nueva-tarea'
  if (!Array.isArray(draft.output)) draft.output = []
  if (!['openrouter', 'anthropic', 'openai'].includes(draft.executor)) draft.executor = 'openrouter'

  // Fail-safe: solo se aceptan ids que existen de verdad — un id inventado
  // por el LLM se descarta como si no hubiera dicho nada (mismo espíritu
  // que needsClarify/el clasificador de intención del Mes 18).
  const validIds = new Set(skillCandidateInfos.map(s => s.id))
  const rawCandidates = Array.isArray(draft.skill_candidates) ? draft.skill_candidates : []
  const skillCandidates = rawCandidates.filter((id): id is string => typeof id === 'string' && validIds.has(id))
  const skillOptions = skillCandidateInfos.filter(s => skillCandidates.includes(s.id))
    .map(s => ({ id: s.id, name: s.name, description: s.description }))

  return {
    id: draft.id,
    description: draft.description,
    output: draft.output,
    executor: draft.executor,
    skillCandidates,
    skillOptions,
  }
}

async function handleApiNatural(req: Request): Promise<Response> {
  let body: { input: string }
  try { body = (await req.json()) as { input: string } } catch { return errorResponse('Invalid JSON', 400) }
  const input = body.input?.trim()
  if (!input) return errorResponse('input is required', 400)
  try {
    return jsonResponse(await buildNaturalDraft(input))
  } catch (e: any) {
    return errorResponse(`LLM draft failed: ${e.message}`, 502)
  }
}

// v0.12 D.1.c — equivalente de `orchestos summary [path]` para el dashboard.
// Mismo flujo que el CLI: buildProfile → generateAgentsMd → upsertProject
// (persiste el proyecto en DB, igual que el CLI; no es destructivo sobre
// archivos en disco, solo refresca el registro de DB) → listRuns(10) →
// generateSummaryPdf. Se escribe a un tmp file (no al project root) para
// evitar dejar un PDF en el working dir que el usuario no pidió persistir
// — el CLI escribe al root por diseño (es un comando explícito de export);
// el dashboard solo sirve el binario para descarga inmediata.
async function handleApiProjectSummary(): Promise<Response> {
  const root = resolve('.')
  const t0 = performance.now()
  const profile = await buildProfile(root)
  const agentsMd = generateAgentsMd(profile)
  upsertProject(root, profile, agentsMd)
  const recentRuns = listRuns(10)

  const tmpPath = join(tmpdir(), `orchestos-summary-${process.pid}-${Date.now()}.pdf`)
  try {
    await generateSummaryPdf(profile, agentsMd, tmpPath, recentRuns)
    const buf = readFileSync(tmpPath)
    const elapsedMs = Math.round(performance.now() - t0)
    // filename seguro: igual que la convención del CLI (`<project>-summary.pdf`),
    // pero escapando comillas por si el nombre trae caracteres raros.
    const safeName = (profile.manifest.name || 'project').replace(/[^\w.-]/g, '_')
    const filename = `${safeName}-summary.pdf`
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buf.length),
        'Content-Disposition': `attachment; filename="${filename}"`,
        // útil para observabilidad sin tener que parsear logs
        'X-Elapsed-Ms': String(elapsedMs),
        'X-Project': safeName,
      },
    })
  } catch (e: any) {
    return errorResponse(`Failed to generate summary: ${e.message}`, 500)
  } finally {
    // cleanup siempre — incluso si el response falló, no queremos leaks en /tmp
    try { unlinkSync(tmpPath) } catch { /* tmp file puede no existir si write falló */ }
  }
}

export { handleApiProjectConstitutionGet, handleApiProjectConstitutionPut, handleApiProjectContextGet, handleApiProjectContextRegenerate, handleApiProjectDetect, handleApiProjectIndex, handleApiProjectSummary, handleApiNatural, listAllSkillCandidates, buildNaturalDraft }
