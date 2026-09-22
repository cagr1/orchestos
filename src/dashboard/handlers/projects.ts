import { realpathSync, statSync } from 'node:fs'
import { deleteProject, getProjectById, listProjects } from '../../db/projects.ts'
import { deleteChatSessionsForProject } from '../../db/chat-sessions.ts'
import { ensureProject } from '../../projects/ensure.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type { ProjectRow } from '../types.ts'

export function handleApiProjects(): Response {
  const rows: ProjectRow[] = listProjects().map((project) => ({
    id: project.id,
    path: project.path,
    stackProfile: project.stack_profile,
    lastUpdated: project.last_updated,
  }))
  return jsonResponse(rows)
}

export function handleApiProjectDelete(url: URL): Response {
  const id = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
  if (!id || id.length > 128) return errorResponse('Invalid project id', 400)
  if (!getProjectById(id)) return errorResponse('Project not found', 404)
  deleteChatSessionsForProject(id)
  return deleteProject(id)
    ? jsonResponse({ ok: true })
    : errorResponse('Project not found', 404)
}

type ChooseProjectFolder = () => Promise<string | null>
type PlatformProbe = () => NodeJS.Platform

function publicProjectRow(project: {
  id: string
  path: string
  stack_profile: string
  last_updated: string
}): ProjectRow {
  return {
    id: project.id,
    path: project.path,
    stackProfile: project.stack_profile,
    lastUpdated: project.last_updated,
  }
}

/**
 * The native selector is the trust boundary: Bun.spawn receives fixed argv and
 * never shell mode or any path supplied by the browser.
 */
export async function nativeChooseProjectFolder(): Promise<string | null> {
  const proc = Bun.spawn(
    [
      'osascript',
      '-e',
      'tell application "Finder" to activate\nPOSIX path of (choose folder with prompt "Choose a project folder")',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if (exitCode !== 0) {
    if (/user canceled/i.test(stderr)) return null
    throw new Error(`Native folder selection failed: ${stderr.trim() || `exit ${exitCode}`}`)
  }
  const root = stdout.trim()
  if (!root) throw new Error('Native folder selector returned no path')
  return root
}

export async function handleApiProjectChoose(
  chooseProjectFolder: ChooseProjectFolder = nativeChooseProjectFolder,
  platform: PlatformProbe = () => process.platform,
): Promise<Response> {
  if (platform() !== 'darwin') {
    return errorResponse('Native folder selection is only available on macOS', 501)
  }

  try {
    const selected = await chooseProjectFolder()
    if (selected === null) return jsonResponse({ cancelled: true })

    const root = realpathSync(selected)
    if (!statSync(root).isDirectory()) throw new Error('Selected path is not a directory')
    return jsonResponse(publicProjectRow(await ensureProject(root)))
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500)
  }
}
