import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { addInstinct } from '../../api/projectTabs'

export function RememberDialog({
  projectId,
  sessionId,
  messageId,
  content,
  onClose,
}: {
  projectId: string
  sessionId: string
  messageId: string
  content: string
  onClose: () => void
}) {
  const id = useId()
  const panel = useRef<HTMLFormElement>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const [trigger, setTrigger] = useState('')
  const [action, setAction] = useState(content.slice(0, 500))
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    firstField.current?.focus()
    return () => previous?.focus()
  }, [])
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Modal keyboard navigation follows ConfirmDialog.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (!saving) onClose()
        }
        if (event.key === 'Tab') {
          const controls = panel.current?.querySelectorAll<HTMLElement>(
            'input:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
          )
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
      <form
        ref={panel}
        className="w-full max-w-sm rounded-card bg-app-surface border border-app p-5 shadow-2xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (saving || !trigger.trim() || !action.trim()) return
          setSaving(true)
          setError(null)
          void addInstinct(projectId, trigger.trim(), action.trim(), {
            why: why.trim(),
            evidence: { ref: `${sessionId}:${messageId}` },
          })
            .then(onClose)
            .catch((failure: unknown) =>
              setError(failure instanceof Error ? failure.message : String(failure)),
            )
            .finally(() => setSaving(false))
        }}
      >
        <h2 id={`${id}-title`} className="text-sm font-semibold text-app">
          Remember
        </h2>
        <label className="block text-xs text-app-muted" htmlFor={`${id}-when`}>
          When
          <input
            ref={firstField}
            id={`${id}-when`}
            required
            maxLength={500}
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
            className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
          />
        </label>
        <label className="block text-xs text-app-muted" htmlFor={`${id}-do`}>
          Do
          <textarea
            id={`${id}-do`}
            required
            maxLength={500}
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
          />
        </label>
        <label className="block text-xs text-app-muted" htmlFor={`${id}-why`}>
          Why
          <textarea
            id={`${id}-why`}
            maxLength={1000}
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-app-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-app">
          <Button type="button" variant="ghost" size="compact" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="compact"
            disabled={saving || !trigger.trim() || !action.trim()}
          >
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
