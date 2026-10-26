/** Global shortcuts shared by their handlers and Settings. Local input keys stay local. */
export const KEYBINDINGS = [
  { id: 'command-palette', command: 'Toggle command palette', keys: ['Cmd/Ctrl', 'K'], when: 'App' },
  { id: 'settings-search', command: 'Search settings', keys: ['Cmd/Ctrl', 'K'], when: 'Settings' },
] as const

export function matchesKeybinding(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'key'>,
  id: (typeof KEYBINDINGS)[number]['id'],
  ignoreCase = false,
): boolean {
  const binding = KEYBINDINGS.find((entry) => entry.id === id)!
  const key = binding.keys[1].toLowerCase()
  return (event.metaKey || event.ctrlKey) && (ignoreCase ? event.key.toLowerCase() : event.key) === key
}
