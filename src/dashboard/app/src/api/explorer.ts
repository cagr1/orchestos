import type { FileNode } from '../types/orchestos'

interface ExplorerEntry {
  name: string
  path: string
  type: 'dir' | 'file'
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
}

async function request<T>(path: string, projectId: string): Promise<T> {
  const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId } })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function getExplorerTree(path = '', projectId: string): Promise<FileNode[]> {
  const data = await request<ExplorerTreeResponse>(
    `/api/explorer/tree?path=${encodeURIComponent(path)}`,
    projectId,
  )
  return data.entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.type === 'dir',
    size: entry.size == null ? undefined : formatBytes(entry.size),
  }))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function getExplorerFile(path: string, projectId: string): Promise<FileNode> {
  const data = await request<ExplorerFileResponse>(
    `/api/explorer/file?path=${encodeURIComponent(path)}`,
    projectId,
  )
  return {
    name: path.split('/').pop() || path,
    path: data.path,
    isDir: false,
    content: data.content,
  }
}
