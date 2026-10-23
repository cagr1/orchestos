import { Check, Copy, RotateCw, Undo2, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import {
  type ApprovalDecision,
  getRun,
  type PendingApproval,
  resolveRunApproval,
  revertRun,
} from '@/api/runs'
import { Button } from '@/components/ui/button'
import {
  ThinkingStep,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { cn } from '@/lib/utils'
import type { FileDiffEntry, RunItem } from '@/types/orchestos'
import { createApprovalAnswers } from './approvalAnswers'
import { ThreadMarkdown } from './ThreadMarkdown'
import {
  approvalBlocks,
  approvalModeNotice,
  type TaskCardData,
  type TaskCardReport,
  type TaskCardState,
  taskDetail,
  taskName,
  taskWorktreeRelativePath,
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

function TaskDiff({ diff }: { diff: FileDiffEntry }) {
  return (
    <div className="rounded-card border border-app bg-app-surface overflow-hidden text-xs">
      <div className="px-3 py-2 bg-app-elevated border-b border-app flex items-center justify-between font-mono">
        <span className="text-app font-medium">{diff.filePath || diff.path}</span>
        {diff.additions !== undefined || diff.deletions !== undefined ? (
          <span className="text-emerald-400">
            +{diff.additions ?? 0} -{diff.deletions ?? 0}
          </span>
        ) : null}
      </div>
      <pre className="p-3 bg-app-bg font-mono text-xs text-app overflow-x-auto leading-relaxed">
        {diff.patch || diff.diff}
      </pre>
    </div>
  )
}

interface TaskCardProps {
  activeRunId?: string | null
  approvals?: PendingApproval[]
  card: TaskCardData
  error?: string
  busy?: boolean
  onApprove?: () => void
  onReject?: () => void
  onRetry?: () => void
  onCommit?: (files: string[]) => void
  projectId?: string | null
}

export function TaskCard({
  card,
  activeRunId,
  approvals = [],
  error,
  busy,
  onApprove,
  onReject,
  onRetry,
  onCommit,
  projectId,
}: TaskCardProps) {
  const [, refreshApprovalAnswers] = useState(0)
  const approvalAnswers = useMemo(
    () =>
      createApprovalAnswers(
        async (id, decision) => {
          if (!activeRunId || !projectId) throw new Error('Missing approval run or project')
          await resolveRunApproval(activeRunId, projectId, id, decision)
        },
        () => refreshApprovalAnswers((version) => version + 1),
      ),
    [activeRunId, projectId],
  )
  const approvalIds = JSON.stringify(
    card.state === 'running' ? approvals.map((request) => request.approvalId).sort() : [],
  )
  useEffect(() => {
    approvalAnswers.sync(JSON.parse(approvalIds) as string[])
  }, [approvalAnswers, approvalIds])
  const [copied, setCopied] = useState(false)
  const reduced = useReducedMotion()
  const last = card.reports.at(-1)
  const earlier = card.reports.slice(0, -1)
  const name = taskName(card.description)
  const detail = taskDetail(card.description)
  const attempt = attemptLine(last)
  const dirtyFiles = card.state === 'blocked' ? (last?.dirtyFiles ?? []) : []
  const [run, setRun] = useState<RunItem | null>(null)
  const [undoConfirm, setUndoConfirm] = useState(false)
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoError, setUndoError] = useState('')
  const [undoFiles, setUndoFiles] = useState<string[]>([])
  const runId = card.state === 'done' ? last?.runId : null

  useEffect(() => {
    if (!runId || !projectId) return
    let current = true
    void getRun(runId, projectId)
      .then((result) => {
        if (current) setRun(result)
      })
      .catch((cause: unknown) => {
        if (current) setUndoError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      current = false
    }
  }, [runId, projectId])

  const answerApproval = async (approvalId: string, decision: ApprovalDecision) => {
    if (!activeRunId || !projectId) return
    await approvalAnswers.submit(approvalId, decision)
  }

  const undo = async () => {
    if (!runId || !projectId) return
    setUndoBusy(true)
    setUndoError('')
    setUndoFiles([])
    try {
      const result = await revertRun(runId, projectId)
      setRun((current) => (current ? { ...current, revertedSha: result.revertedSha } : current))
      setUndoConfirm(false)
    } catch (cause) {
      const error = cause as Error & {
        status?: number
        dirtyFiles?: string[]
        conflictFiles?: string[]
        residualFiles?: string[]
      }
      setUndoError(error.message)
      setUndoFiles(
        error.residualFiles?.length
          ? error.residualFiles
          : error.status === 409
            ? (error.dirtyFiles ?? error.conflictFiles ?? [])
            : [],
      )
    } finally {
      setUndoBusy(false)
    }
  }

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
      {approvalModeNotice(last) && (
        <p className="text-xs text-app-muted">{approvalModeNotice(last)}</p>
      )}
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
        {runId && run && run.fileDiffs.length > 0 && (
          <details data-task-diff>
            <summary className="cursor-pointer text-xs text-app-muted">
              {run.fileDiffs.length} {run.fileDiffs.length === 1 ? 'file' : 'files'} +
              {run.fileDiffs.reduce((sum, diff) => sum + (diff.additions ?? 0), 0)} −
              {run.fileDiffs.reduce((sum, diff) => sum + (diff.deletions ?? 0), 0)} · View diff
            </summary>
            <div className="mt-2 space-y-3">
              {run.fileDiffs.map((diff) => (
                <TaskDiff key={diff.filePath || diff.path} diff={diff} />
              ))}
            </div>
          </details>
        )}
        {run?.revertedSha ? (
          <span data-task-undone className="text-xs text-app-muted">
            Undone · {run.revertedSha.slice(0, 7)}
          </span>
        ) : run?.commitSha ? (
          <div data-task-undo className="flex items-center gap-2 pt-1">
            {undoConfirm ? (
              <>
                <Button
                  variant="secondary"
                  leadingIcon={Undo2}
                  disabled={undoBusy}
                  onClick={() => void undo()}
                >
                  {undoBusy ? 'Undoing…' : 'Confirm undo'}
                </Button>
                <Button variant="ghost" disabled={undoBusy} onClick={() => setUndoConfirm(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" leadingIcon={Undo2} onClick={() => setUndoConfirm(true)}>
                Undo
              </Button>
            )}
          </div>
        ) : null}
        {undoError && (
          <div role="alert" className="text-xs text-app-error">
            {undoError}
          </div>
        )}
        {undoFiles.length > 0 && (
          <div className="font-mono text-xs text-app-muted">
            {undoFiles.map((file) => (
              <div key={file}>{file}</div>
            ))}
          </div>
        )}
        {card.state === 'running' &&
          activeRunId &&
          approvalBlocks(approvals).map((request) => (
            <div key={request.approvalId} data-task-approval className="flex flex-col gap-2">
              <span className="text-xs font-medium text-app">{request.label}</span>
              {request.kind === 'command' ? (
                <>
                  <pre className="p-3 bg-app-bg font-mono text-xs text-app overflow-x-auto leading-relaxed">
                    {request.detail.command}
                  </pre>
                  {request.detail.cwd && (
                    <div className="font-mono text-xs text-app-muted">{request.detail.cwd}</div>
                  )}
                </>
              ) : (
                <>
                  {request.files.length > 0 &&
                    (!request.detail.diff || request.files.length > 1) && (
                      <div className="font-mono text-xs text-app-muted">
                        {request.files.map((file) => (
                          <div key={file}>{taskWorktreeRelativePath(file)}</div>
                        ))}
                      </div>
                    )}
                  {request.detail.diff && (
                    <TaskDiff
                      diff={{
                        status: 'modified',
                        filePath:
                          request.files.length > 1
                            ? `${request.files.length} files`
                            : taskWorktreeRelativePath(request.files[0] ?? ''),
                        patch: request.detail.diff,
                      }}
                    />
                  )}
                </>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  leadingIcon={Check}
                  disabled={approvalAnswers.disabled(request.approvalId)}
                  onClick={() => void answerApproval(request.approvalId, 'approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={X}
                  disabled={approvalAnswers.disabled(request.approvalId)}
                  onClick={() => void answerApproval(request.approvalId, 'reject')}
                >
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  disabled={approvalAnswers.disabled(request.approvalId)}
                  onClick={() => void answerApproval(request.approvalId, 'approve-always')}
                >
                  Always approve in this task
                </Button>
              </div>
            </div>
          ))}
        {approvalAnswers.error && (
          <div role="alert" className="text-xs text-app-error">
            {approvalAnswers.error}
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
