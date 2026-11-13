import { useEffect, useId, useRef, useState } from 'react'

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  secondaryLabel,
  onSecondary,
}: {
  title: string
  body?: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (dontAskAgain: boolean) => void
  secondaryLabel?: string
  onSecondary?: (dontAskAgain: boolean) => void
}) {
  const id = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    return () => previous?.focus()
  }, [])
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Captura Enter, Escape y foco de los controles; dialog nativo cambiaría el comportamiento modal.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
        if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button')) {
          event.preventDefault()
          event.stopPropagation()
          onConfirm(dontAskAgain)
        }
        if (event.key === 'Tab') {
          const controls = panel.current?.querySelectorAll<HTMLElement>('input, button')
          if (!controls?.length) return
          const first = controls[0],
            last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }}
    >
      <div
        ref={panel}
        className="w-full max-w-sm rounded-card bg-app-surface border border-rose-800/50 p-5 shadow-2xl space-y-4"
      >
        <h2 id={id} className="text-sm font-semibold text-app">
          {title}
        </h2>
        {body && <p className="text-xs text-app-muted leading-relaxed">{body}</p>}
        <label className="flex items-center gap-2 text-xs text-app-muted">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(event) => setDontAskAgain(event.target.checked)}
          />
          Don't ask again
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-app">
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors text-xs"
          >
            Cancel
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={() => onSecondary(dontAskAgain)}
              className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors text-xs"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(dontAskAgain)}
            className="px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
