import { resolve, join } from 'path'
import { listSpecs, loadSpec, saveSpec } from '../../spec/store.ts'
import { lintSpec } from '../../spec/lint.ts'
import { validateSpec } from '../../spec/validate.ts'
import { archiveSpec, deleteArchivedSpec } from '../../spec/archive.ts'
import type { SpecRow, SpecLintStatus } from '../types.ts'
import { jsonResponse, errorResponse, validateTaskId } from '../http.ts'

async function handleApiSpecsDraft(req: Request): Promise<Response> {
  let body: { taskId: string; description: string }
  try { body = (await req.json()) as { taskId: string; description: string } } catch { return errorResponse('Invalid JSON', 400) }
  const taskId = validateTaskId(body.taskId ?? '')
  if (!taskId || !body.description?.trim()) {
    return errorResponse('taskId (alphanumeric/hyphen/dot, max 64) and description are required', 400)
  }
  const root = resolve('.')
  Bun.spawn(
    [process.execPath, 'run', join(root, 'src/cli.ts'), 'spec', 'draft',
     '--description', body.description.trim(), '--', taskId],
    { cwd: root, stdout: 'inherit', stderr: 'inherit' }
  )
  return jsonResponse({ ok: true, taskId })
}

function handleApiSpecs(): Response {
  const root = resolve('.')
  try {
    const specs = listSpecs(root, true)
    const rows: SpecRow[] = specs.map(s => {
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
        hasCapabilities: !!caps && (caps.added.length > 0 || caps.modified.length > 0 || caps.removed.length > 0),
        createdAt: s.frontmatter.createdAt,
      }
    })
    return jsonResponse(rows)
  } catch {
    return jsonResponse([] as SpecRow[])
  }
}

function handleApiSpecsCreate(req: Request): Response {
  const id = new URL(req.url).pathname.split('/').pop() ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const root = resolve('.')
  const existing = loadSpec(root, taskId)
  if (existing) return errorResponse(`Spec ya existe para "${taskId}"`, 409)
  saveSpec(root, {
    frontmatter: {
      id: taskId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
    },
    body: `## Contexto\n<placeholder>\n\n## Descripción\n<placeholder>\n\n## Criterios de aceptación\n- [ ] <criterio 1>\n- [ ] <criterio 2>\n\n## Notas\n<placeholder>\n`,
  })
  return jsonResponse({ ok: true, taskId })
}

function handleApiSpecsApprove(req: Request): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const root = resolve('.')
  const s = loadSpec(root, taskId)
  if (!s) return errorResponse(`No existe spec para "${taskId}"`, 404)
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

function handleApiSpecsLint(req: Request): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const root = resolve('.')
  const s = loadSpec(root, taskId)
  if (!s) return errorResponse(`No existe spec para "${taskId}"`, 404)
  const result = lintSpec(s)
  return jsonResponse(result)
}

function handleApiSpecsArchive(req: Request): Response {
  const id = new URL(req.url).pathname.split('/').at(-2) ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const root = resolve('.')
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
function handleApiSpecsDelete(req: Request): Response {
  const id = new URL(req.url).pathname.split('/').pop() ?? ''
  const taskId = validateTaskId(id)
  if (!taskId) return errorResponse('taskId inválido', 400)
  const root = resolve('.')
  const ok = deleteArchivedSpec(root, taskId)
  if (!ok) return errorResponse(`No hay spec archivada para "${taskId}"`, 404)
  return jsonResponse({ ok: true, taskId })
}

export { handleApiSpecsDraft, handleApiSpecs, handleApiSpecsCreate, handleApiSpecsApprove, handleApiSpecsLint, handleApiSpecsArchive, handleApiSpecsDelete }
