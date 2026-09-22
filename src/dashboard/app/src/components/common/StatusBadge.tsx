import type React from 'react'

export type StandardStatus =
  | 'done'
  | 'completed'
  | 'ready'
  | 'passed'
  | 'verified'
  | 'running'
  | 'active'
  | 'in_progress'
  | 'pending'
  | 'queued'
  | 'todo'
  | 'optional'
  | 'idle'
  | 'blocked'
  | 'held'
  | 'paused'
  | 'failed'
  | 'error'
  | 'rejected'
  | 'draft'
  | 'spec'
  | 'approved'

interface StatusBadgeProps {
  status: StandardStatus | string
  label?: string
  showDot?: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  className = '',
}) => {
  const norm = (status || '').toLowerCase().trim()

  let dotColor = 'bg-zinc-400'
  let badgeClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60'
  let defaultLabel = norm.toUpperCase()
  let isPulsing = false

  if (
    norm === 'done' ||
    norm === 'completed' ||
    norm === 'ready' ||
    norm === 'passed' ||
    norm === 'verified'
  ) {
    dotColor = 'bg-emerald-400'
    badgeClasses = 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
    defaultLabel = norm === 'ready' ? 'READY' : norm === 'passed' ? 'PASS' : 'DONE'
  } else if (norm === 'running' || norm === 'active' || norm === 'in_progress') {
    dotColor = 'bg-sky-400'
    badgeClasses = 'bg-sky-950/40 text-sky-400 border-sky-800/40'
    defaultLabel = 'RUNNING'
    isPulsing = true
  } else if (norm === 'blocked' || norm === 'held' || norm === 'paused') {
    dotColor = 'bg-amber-400'
    badgeClasses = 'bg-amber-950/40 text-amber-400 border-amber-800/40'
    defaultLabel = norm === 'held' ? 'HELD' : 'BLOCKED'
  } else if (norm === 'failed' || norm === 'error' || norm === 'rejected') {
    dotColor = 'bg-rose-400'
    badgeClasses = 'bg-rose-950/40 text-rose-400 border-rose-800/40'
    defaultLabel = norm === 'rejected' ? 'REJECTED' : 'FAIL'
  } else if (norm === 'draft' || norm === 'spec') {
    dotColor = 'bg-indigo-400'
    badgeClasses = 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
    defaultLabel = 'DRAFT'
  } else if (norm === 'approved') {
    dotColor = 'bg-emerald-400'
    badgeClasses = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
    defaultLabel = 'APPROVED'
  } else if (norm === 'optional') {
    dotColor = 'bg-zinc-500'
    badgeClasses = 'bg-zinc-900/60 text-zinc-400 border-zinc-800/60'
    defaultLabel = 'OPTIONAL'
  } else if (norm === 'idle' || norm === 'pending' || norm === 'queued' || norm === 'todo') {
    dotColor = 'bg-zinc-400'
    badgeClasses = 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
    defaultLabel = norm === 'idle' ? 'IDLE' : 'PENDING'
  }

  const displayText = label || defaultLabel

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill border text-xs font-mono font-medium tracking-wide uppercase select-none ${badgeClasses} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          {isPulsing && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
        </span>
      )}
      <span>{displayText}</span>
    </span>
  )
}
