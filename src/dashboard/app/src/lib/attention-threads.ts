import type { ChatThread } from '../types/orchestos'

/** Navigation changes the visible list, but attention still watches both scopes. */
export function mergeAttentionThreads(
  current: ChatThread[],
  loaded: ChatThread[],
  projectId: string | null,
): ChatThread[] {
  const threads = new Map(current.map((thread) => [thread.id, thread]))
  for (const thread of loaded) threads.set(thread.id, thread)
  return [...threads.values()].filter(
    (thread) => thread.projectId == null || thread.projectId === projectId,
  )
}
