import { lstatSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { deleteProject, getProjectById, listProjects, purgeProject } from '../../db/projects.ts'
import { ensureProject } from '../../projects/ensure.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type { ProjectRow } from '../types.ts'

export function currentBranch(root: string): string | undefined {
  try {
    const result = Bun.spawnSync(['git', '-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    if (result.exitCode !== 0) return undefined
    const branch = new TextDecoder().decode(result.stdout).trim()
    return branch && branch !== 'HEAD' ? branch : undefined
  } catch {
    return undefined
  }
}

export function handleApiProjects(): Response {
  const rows: ProjectRow[] = listProjects().map((project) => ({
    id: project.id,
    path: project.path,
    stackProfile: project.stack_profile,
    lastUpdated: project.last_updated,
    branch: currentBranch(project.path),
  }))
  return jsonResponse(rows)
}

export function handleApiProjectDelete(url: URL): Response {
  const id = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
  if (!id || id.length > 128) return errorResponse('Invalid project id', 400)
  if (!getProjectById(id)) return errorResponse('Project not found', 404)
  return deleteProject(id) ? jsonResponse({ ok: true }) : errorResponse('Project not found', 404)
}

export function handleApiProjectPurge(url: URL): Response {
  const id = decodeURIComponent(url.pathname.slice('/api/projects/'.length, -'/purge'.length))
  if (!id || id.length > 128) return errorResponse('Invalid project id', 400)
  return purgeProject(id) ? jsonResponse({ ok: true }) : errorResponse('Project not found', 404)
}

type ChooseProjectFolder = () => Promise<string | null>
type PlatformProbe = () => NodeJS.Platform

function publicProjectRow(
  project: {
    id: string
    path: string
    stack_profile: string
    last_updated: string
  },
  branch: (root: string) => string | undefined = currentBranch,
): ProjectRow {
  return {
    id: project.id,
    path: project.path,
    stackProfile: project.stack_profile,
    lastUpdated: project.last_updated,
    branch: branch(project.path),
  }
}

/**
 * The native selector is the trust boundary: Bun.spawn receives fixed argv and
 * never shell mode or any path supplied by the browser.
 */
async function nativeChooseProjectFolder(): Promise<string | null> {
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

// The picker for a clone location does not register that parent as a project.
export async function handleApiProjectCloneLocation(
  choose: boolean,
  chooseFolder: ChooseProjectFolder = nativeChooseProjectFolder,
  platform: PlatformProbe = () => process.platform,
): Promise<Response> {
  if (!choose) return jsonResponse({ parentDir: homedir() })
  if (platform() !== 'darwin')
    return errorResponse('Native folder selection is only available on macOS', 501)
  try {
    const selected = await chooseFolder()
    if (selected === null) return jsonResponse({ cancelled: true })
    const parentDir = realpathSync(selected)
    if (!statSync(parentDir).isDirectory())
      return errorResponse('Clone location must be a directory', 400)
    return jsonResponse({ parentDir })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500)
  }
}

type CloneProject = (url: string, destination: string) => Promise<void>

async function nativeCloneProject(url: string, destination: string): Promise<void> {
  const proc = Bun.spawn(['git', 'clone', '--', url, destination], {
    stdout: 'ignore',
    stderr: 'pipe',
    stdin: 'ignore',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    proc.kill('SIGKILL')
  }, 45_000)
  // Drain the stream, but retain at most 2 KiB even if git emits enormous diagnostics.
  const stderr = (async () => {
    const reader = proc.stderr.getReader()
    let retained = new Uint8Array(0)
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = value.subarray(0, Math.max(0, 2048 - retained.length))
        const next = new Uint8Array(retained.length + chunk.length)
        next.set(retained)
        next.set(chunk, retained.length)
        retained = next
      }
    } finally {
      reader.releaseLock()
    }
    return new TextDecoder().decode(retained, { stream: true })
  })()
  try {
    const [code, message] = await Promise.all([proc.exited, stderr])
    if (timedOut) throw new Error('Git clone timed out')
    if (code !== 0) throw new Error(message.trim() || `Git clone failed (exit ${code})`)
  } finally {
    clearTimeout(timeout)
  }
}

export function cloneRepoName(url: string): string | null {
  if (!url || url.startsWith('-') || /[\s\0]/.test(url)) return null
  let path: string
  const scp = /^git@[^/:]+:([^?#]+\/[^/?#]+)$/.exec(url)
  if (scp) path = scp[1] ?? ''
  else {
    try {
      const parsed = new URL(url)
      const fileFixture =
        parsed.protocol === 'file:' && process.env.ORCHESTOS_TEST_PROJECT_CLONE_FILE === '1'
      if (!fileFixture && (!['https:', 'ssh:'].includes(parsed.protocol) || !parsed.hostname))
        return null
      if (parsed.search || parsed.hash) return null
      path = parsed.pathname
    } catch {
      return null
    }
  }
  try {
    const name = decodeURIComponent(path.split('/').pop() ?? '').replace(/\.git$/, '')
    return name && name !== '.' && name !== '..' && !/[/\\\0]/.test(name) ? name : null
  } catch {
    return null
  }
}

export async function handleApiProjectClone(
  req: Request,
  clone: CloneProject = nativeCloneProject,
  branch: (root: string) => string | undefined = currentBranch,
): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return errorResponse('Invalid clone request', 400)
  const { url, parentDir } = body as { url?: unknown; parentDir?: unknown }
  const name = typeof url === 'string' ? cloneRepoName(url) : null
  if (!name || typeof url !== 'string') return errorResponse('Invalid Git URL', 400)
  if (typeof parentDir !== 'string' || !parentDir.trim())
    return errorResponse('Clone location must be a directory', 400)
  let parent: string
  try {
    const expanded =
      parentDir === '~'
        ? homedir()
        : parentDir.startsWith('~/')
          ? join(homedir(), parentDir.slice(2))
          : parentDir
    parent = realpathSync(resolve(expanded))
    if (!statSync(parent).isDirectory())
      return errorResponse('Clone location must be a directory', 400)
  } catch {
    return errorResponse('Clone location must be an existing directory', 400)
  }
  const destination = join(parent, name)
  // mkdir is exclusive: a concurrent request cannot claim or delete this destination.
  try {
    mkdirSync(destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      return errorResponse('Destination folder already exists', 409)
    return errorResponse('Could not create destination folder', 500)
  }
  const created = lstatSync(destination)
  try {
    await clone(url, destination)
    return jsonResponse(publicProjectRow(await ensureProject(realpathSync(destination)), branch))
  } catch (error) {
    try {
      const current = lstatSync(destination)
      if (current.ino === created.ino && current.dev === created.dev && current.isDirectory())
        rmSync(destination, { recursive: true, force: true })
    } catch {
      /* The clone may already have removed its directory. */
    }
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(
      new TextDecoder().decode(Buffer.from(message).subarray(0, 2048), { stream: true }),
      500,
    )
  }
}
