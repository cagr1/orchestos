import { Settings } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCliModels } from '../../api/chat'
import { getExecutorModes } from '../../api/settings'
import {
  buildLaunchOptions,
  filterLaunchOptions,
  type LaunchOption,
  nextLaunchIndex,
} from './agent-launcher'
import { ProviderLogo } from './ProviderLogos'

export function useLaunchOptions(open: boolean, lastAgent?: string) {
  const [options, setOptions] = useState<LaunchOption[]>([])
  useEffect(() => {
    if (!open) return
    let disposed = false
    setOptions([])
    void Promise.all([getExecutorModes(), getCliModels()])
      .then(([executors, catalogs]) => {
        if (!disposed) setOptions(buildLaunchOptions(executors.modes, catalogs, lastAgent))
      })
      .catch(() => {})
    return () => {
      disposed = true
    }
  }, [open, lastAgent])
  return options
}

export function AgentLaunchOption({
  option,
  active,
  id,
  onChoose,
}: {
  option: LaunchOption
  active: boolean
  id: string
  onChoose: (option: LaunchOption) => void
}) {
  const disabled = option.state !== 'ready'
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-label={option.label}
      aria-selected={active}
      aria-disabled={disabled}
      tabIndex={-1}
      onClick={() => {
        if (!disabled) onChoose(option)
      }}
      className={`flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-xs text-app ${disabled ? 'opacity-50' : 'hover:bg-app-hover'} ${active ? 'bg-app-elevated' : ''}`}
    >
      <ProviderLogo id={option.id} size={16} />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      <span className="shrink-0 text-app-muted">
        {option.state === 'not-installed'
          ? 'Not installed'
          : option.state === 'setup-required'
            ? 'Setup required'
            : option.shortcut}
      </span>
    </button>
  )
}

export function AgentLauncher({
  anchor,
  lastAgent,
  onChoose,
  onClose,
  onOpenSettings,
}: {
  anchor: { left: number; top: number }
  lastAgent?: string
  onChoose: (option: LaunchOption) => void
  onClose: () => void
  onOpenSettings: () => void
}) {
  const options = useLaunchOptions(true, lastAgent)
  const [query, setQuery] = useState('')
  const filtered = filterLaunchOptions(options, query)
  const [selected, setSelected] = useState(-1)
  const listId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState(anchor)
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    setSelected(nextLaunchIndex(filterLaunchOptions(options, query), -1, 1))
  }, [options, query])
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const positionDialog = () => {
      const rect = dialog.getBoundingClientRect()
      setPosition({
        left: Math.max(4, Math.min(anchor.left, window.innerWidth - rect.width - 4)),
        top: Math.max(4, Math.min(anchor.top, window.innerHeight - rect.height - 4)),
      })
    }
    positionDialog()
    const observer = new ResizeObserver(positionDialog)
    observer.observe(dialog)
    return () => observer.disconnect()
  }, [anchor])
  useEffect(() => {
    if (selected >= 0)
      document.getElementById(`${listId}-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [listId, selected])
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', outside)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  return createPortal(
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: El diálogo captura Escape y la navegación del combobox; un dialog nativo cambiaría su comportamiento no modal.
    <div
      role="dialog"
      aria-label="Launch agent"
      ref={dialogRef}
      style={position}
      className="fixed z-50 flex max-h-[calc(100dvh-8px)] w-[280px] max-w-[calc(100vw-8px)] flex-col rounded-card border border-app bg-app-surface p-2 text-app shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          openerRef.current?.focus()
        } else if (event.target === inputRef.current) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setSelected((current) =>
              nextLaunchIndex(filtered, current, event.key === 'ArrowDown' ? 1 : -1),
            )
          } else if (event.key === 'Enter') {
            event.preventDefault()
            const option = filtered[selected]
            if (option?.state === 'ready') onChoose(option)
          }
        }
      }}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-label="Search agents"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={selected >= 0 ? `${listId}-${selected}` : undefined}
        placeholder="Search agents…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full shrink-0 rounded-control bg-app-elevated px-2 py-2 text-xs text-app outline-none placeholder:text-app-muted focus:ring-1 focus:ring-app-accent"
      />
      <div
        role="listbox"
        aria-label="Agents"
        id={listId}
        className="my-1 min-h-0 max-h-64 overflow-y-auto"
      >
        {filtered.map((option, index) => (
          <AgentLaunchOption
            key={option.id}
            id={`${listId}-${index}`}
            option={option}
            active={selected === index}
            onChoose={onChoose}
          />
        ))}
      </div>
      <div className="shrink-0 border-t border-app pt-1">
        <button
          type="button"
          onClick={() => {
            onClose()
            onOpenSettings()
          }}
          className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-xs text-app-muted hover:bg-app-hover hover:text-app"
        >
          <Settings size={14} />
          Agent settings…
        </button>
      </div>
    </div>,
    document.body,
  )
}
