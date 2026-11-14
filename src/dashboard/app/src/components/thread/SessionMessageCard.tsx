import { useState } from 'react'
import { type ChatMessageRow, decideSessionMessage, type InboundSessionMessage } from '@/api/chat'
import { Button } from '@/components/ui/button'

export function SessionMessageCard({
  message,
}: {
  message: NonNullable<ChatMessageRow['sessionMessage']>
}) {
  const [decision, setDecision] = useState<'approved' | 'discarded' | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = message.status === 'pending' ? (decision ?? message.status) : message.status
  async function decide(action: 'approve' | 'discard') {
    setBusy(true)
    setError(null)
    try {
      setDecision((await decideSessionMessage(message.id, action)).status)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      data-session-message-card={message.id}
      className="mt-3 rounded-card border border-app bg-app-surface p-4 space-y-2 text-sm"
    >
      <div className="font-medium text-app">Message to «{message.toTitle}»</div>
      <p className="whitespace-pre-wrap break-words text-app-muted">
        {expanded ? message.content : message.content.slice(0, 300)}
      </p>
      {!expanded && message.content.length > 300 && (
        <Button variant="ghost" size="compact" onClick={() => setExpanded(true)}>
          Show more
        </Button>
      )}
      {status === 'pending' ? (
        <div className="flex gap-2">
          <Button size="compact" disabled={busy} onClick={() => void decide('approve')}>
            Approve
          </Button>
          <Button
            size="compact"
            variant="ghost"
            disabled={busy}
            onClick={() => void decide('discard')}
          >
            Discard
          </Button>
        </div>
      ) : (
        <div className="text-xs text-app-muted">{status === 'approved' ? 'Sent' : 'Discarded'}</div>
      )}
      {error && (
        <div role="alert" className="text-xs text-app-error">
          {error}
        </div>
      )}
    </div>
  )
}

export function InboundSessionMessageBlock({ message }: { message: InboundSessionMessage }) {
  return (
    <div
      data-inbound-session-message={message.id}
      className="mt-3 rounded-card border border-app bg-app-surface p-4 space-y-2 text-sm"
    >
      <div className="font-medium text-app">Message from «{message.fromTitle}»</div>
      <p className="whitespace-pre-wrap break-words text-app-muted">{message.content}</p>
    </div>
  )
}
