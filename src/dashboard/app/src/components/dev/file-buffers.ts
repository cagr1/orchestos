export interface FileBuffer {
  saved: string
  draft: string
  mtimeMs: number
}

const buffers = new Map<string, FileBuffer>()
const listeners = new Set<() => void>()
let revision = 0
const key = (projectId: string, path: string) => `${projectId}:${path}`

function emit() {
  revision++
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getSnapshot = () => revision
export const getBuffer = (projectId: string, path: string) => buffers.get(key(projectId, path))
export const isDirty = (projectId: string, path: string) => {
  const buffer = getBuffer(projectId, path)
  return !!buffer && buffer.saved !== buffer.draft
}

export function dirtyPaths(projectId: string): Set<string> {
  const prefix = `${projectId}:`
  return new Set(
    [...buffers].flatMap(([id, buffer]) =>
      id.startsWith(prefix) && buffer.saved !== buffer.draft ? [id.slice(prefix.length)] : [],
    ),
  )
}

export const hasDirtyBuffers = () =>
  [...buffers.values()].some((buffer) => buffer.saved !== buffer.draft)

export function setDraft(projectId: string, path: string, draft: string) {
  const buffer = getBuffer(projectId, path)
  if (!buffer || buffer.draft === draft) return
  buffers.set(key(projectId, path), { ...buffer, draft })
  emit()
}

export function markSaved(projectId: string, path: string, content: string, mtimeMs: number) {
  const buffer = getBuffer(projectId, path)
  if (!buffer) return
  // A save acknowledges its snapshot; typing while it was in flight stays dirty.
  buffers.set(key(projectId, path), { ...buffer, saved: content, mtimeMs })
  emit()
}

export function replaceFromDisk(projectId: string, path: string, content: string, mtimeMs: number) {
  buffers.set(key(projectId, path), { saved: content, draft: content, mtimeMs })
  emit()
}

export function drop(projectId: string, path: string) {
  if (buffers.delete(key(projectId, path))) emit()
}
