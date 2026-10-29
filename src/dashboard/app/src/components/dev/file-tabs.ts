export interface FileTab {
  path: string
  pinned: boolean
}
export interface FileTabs {
  tabs: FileTab[]
  activePath: string | null
}
export const FILE_TABS_KEY = 'orchestos-dev-file-tabs'
export const emptyFileTabs = (): FileTabs => ({ tabs: [], activePath: null })

export function openFileTab(state: FileTabs, path: string, pin = false): FileTabs {
  const existing = state.tabs.find((tab) => tab.path === path)
  if (existing) {
    return {
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, pinned: tab.pinned || pin } : tab,
      ),
      activePath: path,
    }
  }
  const preview = state.tabs.findIndex((tab) => !tab.pinned)
  const tabs = [...state.tabs]
  if (!pin && preview >= 0) tabs[preview] = { path, pinned: false }
  else tabs.push({ path, pinned: pin })
  return { tabs, activePath: path }
}

export function closeFileTab(state: FileTabs, path: string): FileTabs {
  const index = state.tabs.findIndex((tab) => tab.path === path)
  const tabs = state.tabs.filter((tab) => tab.path !== path)
  return {
    tabs,
    activePath:
      state.activePath === path
        ? (tabs[index]?.path ?? tabs[index - 1]?.path ?? null)
        : state.activePath,
  }
}

export function persistedFileTabs(state: FileTabs): FileTabs {
  const tabs = state.tabs.filter((tab) => tab.pinned)
  return {
    tabs,
    activePath: tabs.find((tab) => tab.path === state.activePath)?.path ?? tabs[0]?.path ?? null,
  }
}

export function restoreFileTabs(value: unknown, available?: string[]): FileTabs {
  if (!value || typeof value !== 'object') return emptyFileTabs()
  const saved = value as Partial<FileTabs>
  const paths = Array.isArray(saved.tabs)
    ? [
        ...new Set(
          saved.tabs
            .filter(
              (tab) =>
                tab &&
                tab.pinned === true &&
                typeof tab.path === 'string' &&
                tab.path &&
                (!available || available.includes(tab.path)),
            )
            .map((tab) => tab.path),
        ),
      ]
    : []
  return {
    tabs: paths.map((path) => ({ path, pinned: true })),
    activePath: paths.find((path) => path === saved.activePath) ?? paths[0] ?? null,
  }
}

export function readFileTabs(): Record<string, FileTabs> {
  try {
    const value = JSON.parse(localStorage.getItem(FILE_TABS_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).map(([id, tabs]) => [id, restoreFileTabs(tabs)]),
    )
  } catch {
    return {}
  }
}
