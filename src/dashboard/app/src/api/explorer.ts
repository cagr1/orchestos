import type { FileNode } from '../types/orchestos'

interface ExplorerEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  ignored: boolean
  size?: number
}
interface ExplorerTreeResponse {
  path: string
  entries: ExplorerEntry[]
}
interface ExplorerFileResponse {
  path: string
  content: string
  tooLarge: boolean
  binary: boolean
  mtimeMs: number
  sizeBytes: number
}

async function request<T>(path: string, projectId: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId }, signal })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function getExplorerTree(
  path = '',
  projectId: string,
  signal?: AbortSignal,
): Promise<FileNode[]> {
  const data = await request<ExplorerTreeResponse>(
    `/api/explorer/tree?path=${encodeURIComponent(path)}`,
    projectId,
    signal,
  )
  return data.entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.type === 'dir',
    ignored: entry.ignored,
    size: entry.size == null ? undefined : formatBytes(entry.size),
  }))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function getExplorerFile(
  path: string,
  projectId: string,
): Promise<FileNode & ExplorerFileResponse> {
  const data = await request<ExplorerFileResponse>(
    `/api/explorer/file?path=${encodeURIComponent(path)}`,
    projectId,
  )
  return {
    name: path.split('/').pop() || path,
    path: data.path,
    isDir: false,
    content: data.content,
    mtimeMs: data.mtimeMs,
    binary: data.binary,
    tooLarge: data.tooLarge,
    sizeBytes: data.sizeBytes,
  }
}

export async function saveExplorerFile(
  path: string,
  content: string,
  expectedMtimeMs: number,
  projectId: string,
): Promise<
  | { conflict: false; path: string; mtimeMs: number }
  | { conflict: true; mtimeMs: number; content: string }
> {
  const response = await fetch('/api/explorer/file', {
    method: 'PUT',
    headers: { 'x-orchestos-project-id': projectId, 'content-type': 'application/json' },
    body: JSON.stringify({ path, content, expectedMtimeMs }),
  })
  const data = await response.json()
  if (response.status === 409)
    return { conflict: true, mtimeMs: data.mtimeMs, content: data.content }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return { conflict: false, path: data.path, mtimeMs: data.mtimeMs }
}

/** Same name search as Files, loading nested folders through its project-scoped tree API. */
export async function findExplorerFiles(
  query: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<FileNode[]> {
  const files: FileNode[] = []
  const folders = ['']
  const needle = query.toLowerCase()
  while (folders.length && files.length < 20) {
    signal?.throwIfAborted()
    const nodes = await getExplorerTree(folders.shift()!, projectId, signal)
    for (const node of nodes) {
      if (node.isDir) folders.push(node.path)
      else if (node.name.toLowerCase().includes(needle)) files.push(node)
      if (files.length === 20) break
    }
  }
  return files
}

export async function searchExplorerContents(
  query: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<FileNode[]> {
  const data = await request<{ paths: string[] }>(
    `/api/explorer/search?q=${encodeURIComponent(query)}`,
    projectId,
    signal,
  )
  return data.paths.map((path) => ({ name: path, path, isDir: false }))
}
