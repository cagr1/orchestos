export type DevTab =
  | { type: 'session'; id: string }
  | { type: 'file'; id: string; path: string; pinned: boolean }
  | { type: 'new'; id: string }
export interface SessionTabs {
  tabs: DevTab[]
  activeId: string | null
}
export const SESSION_TABS_KEY = 'orchestos-dev-tabs'
export const emptySessionTabs = (): SessionTabs => ({ tabs: [], activeId: null })
export function openSessionTab(state: SessionTabs, id: string): SessionTabs {
  return {
    tabs: state.tabs.some((tab) => tab.id === id)
      ? state.tabs
      : [...state.tabs, { type: 'session', id }],
    activeId: id,
  }
}
export function openNewTab(state: SessionTabs, id = `new:${crypto.randomUUID()}`): SessionTabs {
  return { tabs: [...state.tabs, { type: 'new', id }], activeId: id }
}
export function convertNewTab(state: SessionTabs, newId: string | null, id: string): SessionTabs {
  if (!state.tabs.some((tab) => tab.type === 'new' && tab.id === newId))
    return openSessionTab(state, id)
  return {
    tabs: state.tabs.map((tab) => (tab.id === newId ? { type: 'session', id } : tab)),
    activeId: state.activeId === newId ? id : state.activeId,
  }
}
export function closeSessionTab(state: SessionTabs, id: string): SessionTabs {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  const tabs = state.tabs.filter((tab) => tab.id !== id)
  return {
    tabs,
    activeId:
      state.activeId === id ? (tabs[index]?.id ?? tabs[index - 1]?.id ?? null) : state.activeId,
  }
}
export function persistedDevTabs(state: SessionTabs): SessionTabs {
  const tabs = state.tabs.filter((tab) => tab.type !== 'file' || tab.pinned)
  return {
    tabs,
    activeId: tabs.find((tab) => tab.id === state.activeId)?.id ?? tabs[0]?.id ?? null,
  }
}
export function restoreSessionTabs(
  value: unknown,
  available: string[],
  lastId?: string,
  paths?: string[],
): SessionTabs {
  const saved = value && typeof value === 'object' ? (value as Partial<SessionTabs>) : null
  const tabs: DevTab[] = []
  for (const tab of Array.isArray(saved?.tabs) ? saved.tabs : []) {
    if (!tab || typeof tab.id !== 'string' || tabs.some((item) => item.id === tab.id)) continue
    if (tab.type === 'session' && available.includes(tab.id))
      tabs.push({ type: 'session', id: tab.id })
    else if (tab.type === 'new') tabs.push({ type: 'new', id: tab.id })
    else if (
      tab.type === 'file' &&
      typeof tab.path === 'string' &&
      tab.path &&
      (!paths || paths.includes(tab.path))
    )
      tabs.push({
        type: 'file',
        id: `file:${tab.path}`,
        path: tab.path,
        pinned: tab.pinned === true,
      })
  }
  if (!tabs.length) {
    const id = available.includes(lastId ?? '') ? lastId! : available[0]
    return id ? openSessionTab(emptySessionTabs(), id) : openNewTab(emptySessionTabs())
  }
  return { tabs, activeId: tabs.find((tab) => tab.id === saved?.activeId)?.id ?? tabs[0].id }
}
export function readSessionTabs(): Record<string, SessionTabs> {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_TABS_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const sessions = JSON.parse(localStorage.getItem('orchestos-dev-session-tabs') || '{}')
    const files = JSON.parse(localStorage.getItem('orchestos-dev-file-tabs') || '{}')
    for (const project of new Set([...Object.keys(sessions), ...Object.keys(files)])) {
      if (value[project]) continue
      const ids = Array.isArray(sessions[project]?.ids)
        ? sessions[project].ids.filter((id: unknown) => typeof id === 'string')
        : []
      const pinned = Array.isArray(files[project]?.tabs)
        ? files[project].tabs.filter(
            (tab: { pinned?: boolean; path?: unknown } | null) =>
              tab?.pinned && typeof tab.path === 'string',
          )
        : []
      value[project] = {
        tabs: [
          ...ids.map((id: string) => ({ type: 'session', id })),
          ...pinned.map((tab: { path: string }) => ({
            type: 'file',
            id: `file:${tab.path}`,
            path: tab.path,
            pinned: true,
          })),
        ],
        activeId:
          sessions[project]?.activeId ??
          (files[project]?.activePath ? `file:${files[project].activePath}` : null),
      }
    }
    return Object.fromEntries(
      Object.entries(value).flatMap(([id, raw]) => {
        const state = raw as Partial<SessionTabs> | null
        if (!Array.isArray(state?.tabs)) return []
        if (!state.tabs.length) return [[id, emptySessionTabs()]]
        const available = state.tabs.filter((tab) => tab?.type === 'session').map((tab) => tab.id)
        return [[id, restoreSessionTabs(state, available)]]
      }),
    )
  } catch {
    return {}
  }
}
