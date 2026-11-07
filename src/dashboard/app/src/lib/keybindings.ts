/** Global commands shared by App, the palette and Settings. Input keys stay local. */
type KeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
}

function command<const Id extends string>(
  id: Id,
  title: string,
  keys: string[],
  when: 'App' | 'Settings' | 'Dev' | 'Turn running',
  code: string,
) {
  return {
    id,
    title,
    get keys() {
      return keys.map((key) => (key === 'Cmd/Ctrl' ? (isMacPlatform() ? '⌘' : 'Ctrl') : key))
    },
    when,
    match(event: KeyEvent): boolean {
      const primary = keys.includes('Cmd/Ctrl')
      const control = keys.includes('Ctrl')
      const alt = keys.includes('Alt')
      if (event.shiftKey || !!event.altKey !== alt) return false
      if (!!event.metaKey !== (primary && isMacPlatform())) return false
      if (!!event.ctrlKey !== (control || (primary && !isMacPlatform()))) return false
      return alt || id === 'new-terminal'
        ? event.code === code
        : event.key.toLowerCase() ===
            (id === 'stop-turn' ? 'escape' : keys[keys.length - 1].toLowerCase())
    },
  }
}

export const KEYBINDINGS = [
  command('command-palette', 'Command palette', ['Cmd/Ctrl', 'K'], 'App', 'KeyK'),
  command('settings-search', 'Search settings', ['Cmd/Ctrl', 'K'], 'Settings', 'KeyK'),
  command('go-to-file', 'Go to file', ['Cmd/Ctrl', 'P'], 'App', 'KeyP'),
  command('open-settings', 'Open settings', ['Cmd/Ctrl', ','], 'App', 'Comma'),
  command('mode-chat', 'Switch to Chat', ['Alt', '1'], 'App', 'Digit1'),
  command('mode-dev', 'Switch to Dev', ['Alt', '2'], 'App', 'Digit2'),
  command('new-chat', 'New chat', ['Alt', 'N'], 'App', 'KeyN'),
  command('toggle-sidebar', 'Toggle sidebar', ['Cmd/Ctrl', 'B'], 'App', 'KeyB'),
  command('toggle-right-panel', 'Toggle right panel', ['Cmd/Ctrl', 'Alt', 'B'], 'App', 'KeyB'),
  command('new-terminal', 'New terminal', ['Ctrl', '`'], 'Dev', 'Backquote'),
  command('close-tab', 'Close tab', ['Alt', 'W'], 'Dev', 'KeyW'),
  command('next-tab', 'Next tab', ['Alt', ']'], 'Dev', 'BracketRight'),
  command('previous-tab', 'Previous tab', ['Alt', '['], 'Dev', 'BracketLeft'),
  command('stop-turn', 'Stop', ['Esc'], 'Turn running', 'Escape'),
] as const

export type CommandId = (typeof KEYBINDINGS)[number]['id']

export function reachesAppFromTerminal(
  binding: (typeof KEYBINDINGS)[number],
  event: KeyEvent,
): boolean {
  return binding.id === 'new-terminal' || event.metaKey
}

export function matchesKeybinding(event: KeyEvent, id: CommandId, _ignoreCase = false): boolean {
  return KEYBINDINGS.find((entry) => entry.id === id)!.match(event)
}
