import { db } from '../db/sqlite.ts'
import { getProject } from '../db/projects.ts'
import { listRuns } from '../db/runs.ts'

export interface ContextMdResult {
  content: string
  tokenEstimate: number
  agentsMdTokens: number
}

export function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

export function buildContextMd(projectPath: string): ContextMdResult | null {
  const project = getProject(projectPath)
  if (!project) return null

  const agentsMd = project.agents_md
  const agentsTokens = estimateTokens(agentsMd)
  const lines: string[] = []

  // -- header --
  const name = projectPath.split('/').filter(Boolean).pop() ?? 'project'
  lines.push(`# CONTEXT.md — ${name}`)
  lines.push('')

  // -- AGENTS.md compressed: extract first line and key module names --
  const agentsLines = agentsMd.split('\n').filter(l => l.trim())
  const titleLine = agentsLines.find(l => l.startsWith('# ')) ?? ''
  lines.push('## Project')
  lines.push(titleLine.replace(/^#+\s*/, '') || name)
  lines.push('')

  // -- tech stack (first 3 LangStat-like lines) --
  const stackMatches = agentsMd.match(/-\s*\*\*[^*]+\*\*:\s*[^\n]+/g)
  if (stackMatches) {
    lines.push('### Stack')
    for (const s of stackMatches.slice(0, 5)) {
      lines.push(s)
    }
    lines.push('')
  }

  // -- hot files from code graph (top 20 by edge count) --
  const hotFiles = db.query<{ path: string; edge_count: number }, string>(
    `SELECT f.path, COUNT(e.id) AS edge_count
     FROM files f
     LEFT JOIN code_edges e ON e.from_file_id = f.id OR e.to_file_id = f.id
     WHERE f.project_id = ?
     GROUP BY f.id
     ORDER BY edge_count DESC
     LIMIT 20`,
  ).all(project.id)

  if (hotFiles.length > 0) {
    lines.push('### Hot files')
    for (const f of hotFiles) {
      lines.push(`- ${f.path} (${f.edge_count} edges)`)
    }
    lines.push('')
  }

  // -- recent runs (last 5) --
  const recentRuns = listRuns(5)
  if (recentRuns.length > 0) {
    lines.push('### Recent runs')
    for (const r of recentRuns) {
      const ts = r.created_at.slice(0, 19).replace('T', ' ')
      lines.push(`- ${ts} ${r.task_class.padEnd(12)} ${r.prompt.slice(0, 60)} [${r.status}]`)
    }
    lines.push('')
  }

  const content = lines.join('\n')
  return {
    content,
    tokenEstimate: estimateTokens(content),
    agentsMdTokens: agentsTokens,
  }
}
