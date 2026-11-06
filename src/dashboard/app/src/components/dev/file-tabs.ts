import type { SessionTabs } from './session-tabs'
export function openFileTab(state: SessionTabs, path: string, pin = false): SessionTabs {
  return openPathTab(state, { kind: 'file', path, pin })
}

export interface OpenPathRequest {
  kind: 'file' | 'diff'
  path: string
  pin: boolean
}

export function openPathTab(state: SessionTabs, { kind, path, pin }: OpenPathRequest): SessionTabs {
  const id = `${kind}:${path}`
  if (state.tabs.some((tab) => tab.id === id))
    return {
      tabs: state.tabs.map((tab) =>
        tab.id === id && (tab.type === 'file' || tab.type === 'diff')
          ? { ...tab, pinned: tab.pinned || pin }
          : tab,
      ),
      activeId: id,
    }
  const tabs = [...state.tabs]
  const preview = tabs.findIndex(
    (tab) => (tab.type === 'file' || tab.type === 'diff') && !tab.pinned,
  )
  const tab = { type: kind, id, path, pinned: pin }
  if (!pin && preview >= 0) tabs[preview] = tab
  else tabs.push(tab)
  return { tabs, activeId: id }
}
