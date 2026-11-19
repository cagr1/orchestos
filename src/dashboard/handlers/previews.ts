import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readBody, z } from '../../boundary/index.ts'
import { getProjectById } from '../../db/projects.ts'
import { localPreviewUrl } from '../../preview/local-url.ts'
import { previewDir, validPreviewShotName } from '../../preview/paths.ts'
import { errorResponse, jsonResponse } from '../http.ts'

export async function handleApiPreviewUrl(req: Request, projectId: string): Promise<Response> {
  const project = getProjectById(projectId)
  if (!project || project.removed_at) return errorResponse('Project not found', 404)
  const dir = previewDir(projectId)
  const path = join(dir, 'url')
  if (req.method === 'GET') {
    try {
      return jsonResponse({ url: localPreviewUrl(await readFile(path, 'utf8')) })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return jsonResponse({ url: null })
      throw error
    }
  }
  const body = await readBody(z.object({ url: z.string().nullable() }), req)
  if (!body.ok) return errorResponse('url must be a local URL or null', 400)
  const value = body.data.url
  const url = typeof value === 'string' ? localPreviewUrl(value) : null
  if (value !== null && !url) return errorResponse('url must be a local URL or null', 400)
  if (url) {
    await mkdir(dir, { recursive: true })
    await writeFile(path, `${url}\n`)
  } else await rm(path, { force: true })
  return jsonResponse({ url })
}

export async function handleApiPreviewShot(projectId: string, name: string): Promise<Response> {
  const project = getProjectById(projectId)
  if (!project || project.removed_at || !validPreviewShotName(name))
    return errorResponse('Preview not found', 404)
  try {
    const bytes = await readFile(join(previewDir(projectId), 'shots', name))
    return new Response(bytes, { headers: { 'Content-Type': 'image/png' } })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return errorResponse('Preview not found', 404)
    throw error
  }
}
