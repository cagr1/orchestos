import type { SessionTabs } from './session-tabs'
export function openFileTab(state: SessionTabs, path: string, pin = false): SessionTabs {
  const id = `file:${path}`
  if (state.tabs.some((tab) => tab.id === id))
    return {
      tabs: state.tabs.map((tab) =>
        tab.id === id && tab.type === 'file' ? { ...tab, pinned: tab.pinned || pin } : tab,
      ),
      activeId: id,
    }
  const tabs = [...state.tabs]
  const preview = tabs.findIndex((tab) => tab.type === 'file' && !tab.pinned)
  const tab = { type: 'file' as const, id, path, pinned: pin }
  if (!pin && preview >= 0) tabs[preview] = tab
  else tabs.push(tab)
  return { tabs, activeId: id }
}
