export interface SessionTabs {
  ids: string[]
  activeId: string | null
}

export const emptySessionTabs = (): SessionTabs => ({ ids: [], activeId: null })
export const SESSION_TABS_KEY = 'orchestos-dev-session-tabs'

export function openSessionTab(state: SessionTabs, id: string): SessionTabs {
  return { ids: state.ids.includes(id) ? state.ids : [...state.ids, id], activeId: id }
}

export function closeSessionTab(state: SessionTabs, id: string): SessionTabs {
  const index = state.ids.indexOf(id)
  const ids = state.ids.filter((item) => item !== id)
  return {
    ids,
    activeId: state.activeId === id ? (ids[index] ?? ids[index - 1] ?? null) : state.activeId,
  }
}

export function restoreSessionTabs(value: unknown, available: string[]): SessionTabs {
  if (!value || typeof value !== 'object') return emptySessionTabs()
  const saved = value as Partial<SessionTabs>
  const ids = Array.isArray(saved.ids)
    ? [
        ...new Set(
          saved.ids.filter((id): id is string => typeof id === 'string' && available.includes(id)),
        ),
      ]
    : []
  return {
    ids,
    activeId:
      saved.activeId === null ? null : (ids.find((id) => id === saved.activeId) ?? ids[0] ?? null),
  }
}

export function readSessionTabs(): Record<string, SessionTabs> {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_TABS_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).map(([project, state]) => {
        const ids = (state as Partial<SessionTabs> | null)?.ids
        return [project, restoreSessionTabs(state, Array.isArray(ids) ? ids : [])]
      }),
    )
  } catch {
    return {}
  }
}
