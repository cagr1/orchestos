import { join } from 'path'
import { archiveSpec, deleteArchivedSpec } from '../../spec/archive.ts'
import { lintSpec } from '../../spec/lint.ts'
import { listSpecs, loadSpec, saveSpec } from '../../spec/store.ts'
import { validateSpec } from '../../spec/validate.ts'
import { errorResponse, jsonResponse, validateTaskId } from '../http.ts'
import type { SpecLintStatus, SpecRow } from '../types.ts'

async function handleApiSpecsDraft(req: Request, root: string): Promise<Response> {
  let body: { taskId: string; description: string; design?: boolean }
  try {
    body = (await req.json()) as { taskId: string; description: string; design?: boolean }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  const taskId = validateTaskId(body.taskId ?? '')
  if (!taskId || !body.description?.trim()) {
    return errorResponse(
      'taskId (alphanumeric/hyphen/dot, max 64) and description are required',
      400,
    )
  }
  // AA (IDEAS #6) — el modal "Nueva Spec" del dashboard no pasa por `spec create`
  // (ver comentario en cli.ts): el flag va acá para que ESTE sea el único punto
  // donde marcar la tarea como compleja desde ese flujo de un solo paso.
  const args = [
    process.execPath,
    'run',
    join(root, 'src/cli.ts'),
    'spec',
    'draft',
    '--description',
    body.description.trim(),
  ]
  if (body.design === true) args.push('--design')
  args.push('--', taskId)
  Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  return jsonResponse({ ok: true, taskId })
}

function handleApiSpecs(root: string): Response {
  try {
    const specs = listSpecs(root, true)
    const rows: SpecRow[] = specs.map((s) => {
      const caps = s.frontmatter.capabilities
      const lint = lintSpec(s)
      const lintStatus: SpecLintStatus = lint.findings.length === 0 ? 'pass' : 'fail'
      return {
        id: s.frontmatter.id,
        status: s.frontmatter.status,
        clarify: s.frontmatter.clarify,
        lintStatus,
        lintFindings: lint.freeFormCount,
        deltaIssues: lint.deltaIssuesCount,
        hasCapabilities:
          !!caps && (caps.added.length > 0 || caps.modified.length > 0 || caps.removed.length > 0),
        createdAt: s.frontmatter.createdAt,
        ...(s.frontmatter.design ? { design: s.frontmatter.design } : {}),
      }
    })
    return jsonResponse(rows)
  } catch {
    return jsonResponse([] as SpecRow[])
  }
}

async function handleApiSpecsCreate(req: Request, root: string): Promise<Response> {
  const id = new URL(req.url).pathname.split('/').pop() ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const existing = loadSpec(root, taskId)
  if (existing) return errorResponse(`Spec ya existe para "${taskId}"`, 409)
  // AA.4 (IDEAS #6) — body opcional: sin body o `{}`, comportamiento idéntico al de
  // siempre (spec simple). Mismo criterio de "ausente = sin cambio" que el CLI.
  let design = false
  try {
    const body = (await req.json()) as { design?: boolean }
    design = body?.design === true
  } catch {
    /* sin body o JSON inválido — spec simple, no es un error */
  }
  const designSection = design ? `## Design\n<placeholder>\n\n` : ''
  saveSpec(root, {
    frontmatter: {
      id: taskId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
      ...(design ? { design: 'pending' as const } : {}),
    },
    body: `## Contexto\n<placeholder>\n\n## Descripción\n<placeholder>\n\n${designSection}## Criterios de aceptación\n- [ ] <criterio 1>\n- [ ] <criterio 2>\n\n## Notas\n<placeholder>\n`,
  })
  return jsonResponse({ ok: true, taskId })
}

function handleApiSpecsApprove(req: Request, root: string): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const s = loadSpec(root, taskId)
  if (!s) return errorResponse(`No existe spec para "${taskId}"`, 404)
  // AA.2/AA.4 (IDEAS #6) — mismo orden que el CLI: design antes que clarify.
  if (s.frontmatter.design === 'pending')
    return errorResponse(`No se puede aprobar "${taskId}" — design está pending`, 422)
  if (s.frontmatter.clarify === 'pending')
    return errorResponse(`No se puede aprobar "${taskId}" — clarify está pending`, 422)
  const validation = validateSpec(s)
  if (!validation.valid)
    return errorResponse(`Validación fallida: ${validation.errors.join('; ')}`, 422)
  s.frontmatter.status = 'approved'
  s.frontmatter.approvedAt = new Date().toISOString()
  saveSpec(root, s)
  return jsonResponse({ ok: true, taskId })
}

// AA.4 (IDEAS #6) — mismo contrato que handleApiSpecsApprove: id desde la URL
// (.../[id]/approve-design), 404/422 según corresponda.
function handleApiSpecsApproveDesign(req: Request, root: string): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const s = loadSpec(root, taskId)
  if (!s) return errorResponse(`No existe spec para "${taskId}"`, 404)
  if (s.frontmatter.design === undefined)
    return errorResponse(`"${taskId}" no fue marcada como compleja — nada que aprobar`, 422)
  if (s.frontmatter.design === 'approved')
    return errorResponse(`El design de "${taskId}" ya está aprobado`, 422)
  s.frontmatter.design = 'approved'
  s.frontmatter.designApprovedAt = new Date().toISOString()
  saveSpec(root, s)
  return jsonResponse({ ok: true, taskId })
}

function handleApiSpecsLint(req: Request, root: string): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const s = loadSpec(root, taskId)
  if (!s) return errorResponse(`No existe spec para "${taskId}"`, 404)
  const result = lintSpec(s)
  return jsonResponse(result)
}

function handleApiSpecsArchive(req: Request, root: string): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  try {
    const result = archiveSpec(root, taskId)
    return jsonResponse({ ok: true, archivedPath: result.archivedPath })
  } catch (e: any) {
    return errorResponse(e.message, 422)
  }
}

// I.8 (Mes 18) — Specs solo tenía archive (soft). A propósito solo borra
// specs YA archivadas (deleteArchivedSpec busca en .orchestos/specs/archive/,
// nunca toca drafts/approved activos).
function handleApiSpecsDelete(req: Request, root: string): Response {
  const id = new URL(req.url).pathname.split('/').pop() ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const ok = deleteArchivedSpec(root, taskId)
  if (!ok) return errorResponse(`No hay spec archivada para "${taskId}"`, 404)
  return jsonResponse({ ok: true, taskId })
}

// v0.12 Bloque A — borrado en lote de specs ARCHIVADAS (mismo alcance que
// handleApiSpecsDelete — deleteArchivedSpec nunca toca drafts/approved activos).
async function handleApiSpecsBulkDelete(req: Request, root: string): Promise<Response> {
  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0)
    return errorResponse('ids must be a non-empty array', 400)
  const ids = body.ids.filter((id): id is string => typeof id === 'string')
  let deleted = 0
  for (const id of ids) {
    const taskId = validateTaskId(id)
    if (taskId && deleteArchivedSpec(root, taskId)) deleted++
  }
  return jsonResponse({ ok: true, deleted })
}

export {
  handleApiSpecs,
  handleApiSpecsApprove,
  handleApiSpecsApproveDesign,
  handleApiSpecsArchive,
  handleApiSpecsBulkDelete,
  handleApiSpecsCreate,
  handleApiSpecsDelete,
  handleApiSpecsDraft,
  handleApiSpecsLint,
}
