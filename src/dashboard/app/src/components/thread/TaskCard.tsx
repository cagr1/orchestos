import { Check, Copy, RotateCw, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ThinkingStep,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { cn } from '@/lib/utils'
import { ThreadMarkdown } from './ThreadMarkdown'
import {
  type TaskCardData,
  type TaskCardReport,
  type TaskCardState,
  taskDetail,
  taskName,
} from './taskCards'

const LABEL: Record<TaskCardState, string> = {
  held: 'Ready to run',
  running: 'Running',
  failed: 'Failed',
  blocked: 'Uncommitted changes',
  pending: 'Pending',
  done: 'Done',
}

const DOT: Record<TaskCardState, string> = {
  held: 'bg-app-warning',
  running: 'bg-app-muted',
  failed: 'bg-app-error',
  blocked: 'bg-app-warning',
  pending: 'bg-app-muted',
  done: 'bg-app-success',
}

const TEXT: Record<TaskCardState, string> = {
  held: 'text-app-warning',
  running: 'text-app',
  failed: 'text-app-error',
  blocked: 'text-app-warning',
  pending: 'text-app-muted',
  done: 'text-app-success',
}

function attemptLine(report?: TaskCardReport): string | null {
  if (!report) return null
  const parts = [
    report.attempt !== undefined
      ? `Attempt ${report.attempt}${report.maxAttempts ? `/${report.maxAttempts}` : ''}`
      : null,
    report.model ?? null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function earlierLine(report: TaskCardReport): string {
  const detail = report.summary ?? report.content.split('\n').find((line) => line.startsWith('> '))
  return [LABEL[report.state], attemptLine(report), detail?.replace(/^>\s*/, '')]
    .filter(Boolean)
    .join(' · ')
}

/** Reportes viejos sin `summary`: la cita del reporte, sin el titular que repite el id. */
function reportText(report: TaskCardReport, taskId: string): string {
  const quote = report.content
    .split('\n')
    .filter((line) => line.startsWith('>'))
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
  return (
    quote || report.content.replace(new RegExp(`^[✓✗]\\s*Task\\s*\`?${taskId}\`?\\s*`), '').trim()
  )
}

interface TaskCardProps {
  card: TaskCardData
  error?: string
  busy?: boolean
  onApprove?: () => void
  onReject?: () => void
  onRetry?: () => void
  onCommit?: (files: string[]) => void
}

export function TaskCard({
  card,
  error,
  busy,
  onApprove,
  onReject,
  onRetry,
  onCommit,
}: TaskCardProps) {
  const [copied, setCopied] = useState(false)
  const reduced = useReducedMotion()
  const last = card.reports.at(-1)
  const earlier = card.reports.slice(0, -1)
  const name = taskName(card.description)
  const detail = taskDetail(card.description)
  const attempt = attemptLine(last)
  const dirtyFiles = card.state === 'blocked' ? (last?.dirtyFiles ?? []) : []

  const copyId = async () => {
    await navigator.clipboard.writeText(card.taskId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-task-id={card.taskId}
      data-task-state={card.state}
      className="mt-3 flex flex-col gap-2 whitespace-normal rounded-card border border-app bg-app-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <span data-task-name className="text-sm font-semibold text-app">
          {name}
        </span>
        <Button
          variant="ghost"
          size="compact"
          aria-label="Copy task id"
          title={card.taskId}
          leadingIcon={copied ? Check : Copy}
          onClick={() => void copyId()}
        >
          {null}
        </Button>
      </div>
      {detail && <p className="line-clamp-3 text-xs text-app-muted">{detail}</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', DOT[card.state])} />
        <span
          data-task-state-label
          className={cn(
            'font-medium',
            TEXT[card.state],
            card.state === 'running' && 'shimmer-text',
          )}
        >
          {LABEL[card.state]}
        </span>
        {attempt && <span className="text-app-muted">{attempt}</span>}
      </div>
      <motion.div
        key={card.state}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.15 }}
        className="flex flex-col gap-2"
      >
        {last &&
          (last.summary ? (
            <p className="text-xs text-app-muted">{last.summary}</p>
          ) : (
            <div className="text-xs text-app-muted">
              <ThreadMarkdown text={reportText(last, card.taskId)} streaming={false} />
            </div>
          ))}
        {dirtyFiles.length > 0 && (
          <div className="font-mono text-xs text-app-muted">
            {dirtyFiles.map((file) => (
              <div key={file}>{file}</div>
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="text-xs text-app-error">
            {error}
          </div>
        )}
        {card.state === 'held' && (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" leadingIcon={Check} onClick={onApprove}>
              Approve & Run
            </Button>
            <Button variant="secondary" leadingIcon={X} onClick={onReject}>
              Reject
            </Button>
          </div>
        )}
        {card.state === 'blocked' && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              leadingIcon={Check}
              disabled={busy}
              onClick={() => onCommit?.(dirtyFiles)}
            >
              Commit & Run
            </Button>
          </div>
        )}
        {(card.state === 'failed' || card.state === 'pending') && (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" leadingIcon={RotateCw} disabled={busy} onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </motion.div>
      {earlier.length > 0 && (
        <ThinkingSteps defaultOpen={false} className="-mx-3" data-task-earlier>
          <ThinkingStepsHeader>
            {earlier.length} earlier {earlier.length === 1 ? 'attempt' : 'attempts'}
          </ThinkingStepsHeader>
          <ThinkingStepsContent className="[&_span]:whitespace-pre-wrap [&_span]:break-words [&_span]:font-normal [&_span]:text-muted-foreground">
            {earlier.map((report, idx) => (
              <ThinkingStep
                key={report.messageId}
                label={earlierLine(report)}
                status="complete"
                showIcon={false}
                isLast={idx === earlier.length - 1}
              />
            ))}
          </ThinkingStepsContent>
        </ThinkingSteps>
      )}
    </div>
  )
}
