import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface DiscardChangesModalProps {
  isOpen: boolean
  fileName: string
  onClose: () => void
  onConfirm: () => void
}

export function DiscardChangesModal({
  isOpen,
  fileName,
  onClose,
  onConfirm,
}: DiscardChangesModalProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const buttons = cancel.current
          ?.closest('[role="dialog"]')
          ?.querySelectorAll<HTMLButtonElement>('button')
        if (!buttons?.length) return
        const first = buttons[0]!
        const last = buttons[buttons.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [isOpen, onClose])
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-card bg-app-surface border border-rose-800/50 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-app pb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <h2 id="discard-changes-title">Discard</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-muted hover:text-app rounded-control"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-app-muted leading-relaxed">
          Discard unsaved changes to <strong className="text-app font-semibold">{fileName}</strong>?
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-app">
          <button
            type="button"
            ref={cancel}
            onClick={onClose}
            className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        </div>
      </div>
    </div>
  )
}
