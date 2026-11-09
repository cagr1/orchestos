import { ArrowRight, Play, Search, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import {
  type CommandId,
  effectiveChord,
  KEYBINDINGS,
  matchesKeybinding,
  useKeybindings,
} from '@/lib/keybindings'
import type { NavigationTab } from '../../types/orchestos'

interface CommandPaletteProps {
  isOpen: boolean
  isSettings: boolean
  onClose: () => void
  onCommand: (id: CommandId) => void
  onSelectTab: (tab: NavigationTab) => void
  onRunNextTask: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  isSettings,
  onClose,
  onCommand,
  onSelectTab,
  onRunNextTask,
}) => {
  useKeybindings()
  const [query, setQuery] = useState('')

  if (!isOpen) return null

  const navigation: { id: NavigationTab; title: string }[] = [
    { id: 'threads', title: 'Chat' },
    { id: 'plan', title: 'Plan' },
    { id: 'runs', title: 'Runs' },
    { id: 'specs', title: 'Specs' },
    { id: 'instincts', title: 'Instincts' },
    { id: 'memory', title: 'Memory' },
    { id: 'skills', title: 'Skills' },
    { id: 'context', title: 'Graph' },
  ]
  const actions = [
    ...KEYBINDINGS.filter(
      (binding) =>
        effectiveChord(binding.id) !== null &&
        binding.id !== 'command-palette' &&
        (binding.id !== 'settings-search' || isSettings),
    ).map((binding) => ({
      id: binding.id,
      title: binding.title,
      keys: binding.keys,
      category: binding.when,
      icon: ArrowRight,
      run: () => {
        onClose()
        onCommand(binding.id)
      },
    })),
    ...navigation.map((view) => ({
      id: `tab_${view.id}`,
      title: `Go to ${view.title}`,
      keys: [] as string[],
      category: 'Navigation',
      icon: ArrowRight,
      run: () => {
        onSelectTab(view.id)
        onClose()
      },
    })),
    {
      id: 'action_run_task',
      title: 'Run next task',
      keys: [] as string[],
      category: 'Actions',
      icon: Play,
      run: () => {
        onRunNextTask()
        onClose()
      },
    },
  ]

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Captura Escape y el atajo de cierre de la paleta; dialog nativo cambiaría el comportamiento modal.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={(event) => {
        if (event.key === 'Escape' || matchesKeybinding(event.nativeEvent, 'command-palette')) {
          event.preventDefault()
          onClose()
        }
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-app bg-app-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-app p-3">
          <Search className="h-4 w-4 text-app-muted" />
          <input
            // biome-ignore lint/a11y/noAutofocus: El buscador o diálogo recién abierto debe enfocar su campo inicial.
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm text-app placeholder:text-app-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-app-muted hover:bg-app-elevated hover:text-app"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-app-muted">No matches</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={item.run}
                  className="group flex w-full items-center rounded-lg p-2.5 text-left text-xs text-app transition-colors hover:bg-app-elevated"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-md bg-app-elevated p-1.5 text-app-muted">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium">{item.title}</div>
                    </div>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1">
                    {item.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-app bg-app-elevated px-1.5 py-0.5 font-mono text-xs"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center border-t border-app p-2 text-[11px] text-app-muted">
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}
