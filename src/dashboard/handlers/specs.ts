import { resolve, join } from 'path'
import { listSpecs } from '../../spec/store.ts'
import { lintSpec } from '../../spec/lint.ts'
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

export { handleApiSpecsDraft, handleApiSpecs }
