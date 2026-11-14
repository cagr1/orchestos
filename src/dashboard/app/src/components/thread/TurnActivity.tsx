import { FilePen, FileText, Globe, Search, Terminal, Wrench, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import {
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import type { TimelineStep } from '../../api/chat'
import { buildTurnActivity, summarizeTools, toolCategory, toolLabel } from './activity'
import { ThreadMarkdown } from './ThreadMarkdown'
import { formatDuration } from './thinking'

interface TurnActivityProps {
  steps: TimelineStep[]
  live?: { elapsed: string }
  /** La respuesta que se escribe en vivo: va tras la actividad y antes de la línea de estado. */
  children?: ReactNode
}

const toolIcons = {
  commands: Terminal,
  edits: FilePen,
  reads: FileText,
  searches: Search,
  web: Globe,
  other: Wrench,
}

function Reasoning({
  text,
  durationMs,
  active,
  elapsed,
}: {
  text: string
  durationMs: number
  active: boolean
  elapsed?: string
}) {
  const [open, setOpen] = useState(active)
  useEffect(() => setOpen(active), [active])
  return (
    <ThinkingSteps open={open} onOpenChange={setOpen} className="-mx-3 w-full">
      <ThinkingStepsHeader>
        <span className={active ? 'shimmer-text text-app-accent' : 'text-app-muted'}>
          {active
            ? 'Thinking…'
            : durationMs > 0
              ? `Thought for ${formatDuration(durationMs)}`
              : 'Thought'}
        </span>
        {active && <span className="ml-2 tabular-nums text-app-muted">{elapsed}</span>}
      </ThinkingStepsHeader>
      <ThinkingStepsContent className="whitespace-pre-wrap break-words text-app-muted">
        {text}
      </ThinkingStepsContent>
    </ThinkingSteps>
  )
}

function ToolRow({ step }: { step: TimelineStep }) {
  const Icon = toolIcons[toolCategory(step.tool)]
  const target = toolLabel(step)
  const failed = step.ok === false || (step.exitCode !== null && step.exitCode !== 0)
  const row = (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-app-muted">
      <Icon className="h-3.5 w-3.5 shrink-0 text-app-accent" />
      <span className="min-w-0 flex-1 truncate font-mono" title={target}>
        {target}
      </span>
      {(step.durationMs ?? 0) >= 1000 && (
        <span className="shrink-0 tabular-nums">{formatDuration(step.durationMs)}</span>
      )}
      {failed && (
        <span
          className="flex shrink-0 items-center text-app-error"
          title="Failed"
          role="img"
          aria-label="Failed"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </span>
  )
  return step.output ? (
    <details className="min-w-0 py-1">
      <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {row}
      </summary>
      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words bg-app-surface p-2 font-mono text-xs leading-5 text-app-muted">
        {step.output}
      </pre>
    </details>
  ) : (
    <div className="py-1">{row}</div>
  )
}

function LiveStep({ step, elapsed }: { step?: TimelineStep; elapsed: string }) {
  const category = toolCategory(step?.tool ?? null)
  const verb = {
    commands: 'Running',
    edits: 'Editing',
    reads: 'Reading',
    searches: 'Searching',
    web: 'Fetching',
    other: 'Using',
  }[category]
  const target = step ? toolLabel(step) : 'tool'
  const running = step?.type === 'tool_use' && step.ok === null
  return (
    <div className="flex min-w-0 items-center gap-2 py-1.5 text-sm text-app-muted">
      <span className="shimmer-text min-w-0 truncate text-app-accent">
        {running ? (
          <>
            {verb} <code>{target}</code>…
          </>
        ) : step?.type === 'text' ? (
          'Writing…'
        ) : (
          'Thinking…'
        )}
      </span>
      <span className="shrink-0 tabular-nums">{elapsed}</span>
    </div>
  )
}

export function TurnActivity({ steps, live, children }: TurnActivityProps) {
  const segments = buildTurnActivity(steps, { pending: Boolean(live) })
  const lastStep = [...steps]
    .sort((a, b) => a.seq - b.seq)
    .filter((step) => step.type !== 'notice' && step.type !== 'step_finish')
    .at(-1)
  const activeReasoning = Boolean(live && lastStep?.type === 'reasoning')
  return (
    <div
      className="space-y-1"
      data-turn-activity=""
      {...(live
        ? { 'data-thread-working': '', role: 'status', 'aria-live': 'polite' as const }
        : {})}
    >
      {segments.map((segment, index) => {
        const active = Boolean(live && index === segments.length - 1)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments only append while a turn grows, preserving disclosure state.
          <div key={`${index}-${segment.kind}`}>
            {segment.kind === 'reasoning' && (
              <Reasoning {...segment} active={active && activeReasoning} elapsed={live?.elapsed} />
            )}
            {segment.kind === 'text' && <ThreadMarkdown text={segment.text} streaming={false} />}
            {segment.kind === 'tools' && (
              <ThinkingSteps
                defaultOpen={false}
                className="-mx-3 w-full"
                data-thread-tools=""
                data-tool-count={segment.items.length}
                data-tool-failed={segment.summary.failed}
              >
                <ThinkingStepsHeader>
                  <span className="text-app-muted">{summarizeTools(segment.summary)}</span>
                  {(segment.summary.added > 0 || segment.summary.removed > 0) && (
                    <span className="ml-2 font-mono">
                      <span className="text-emerald-400 [[data-diff-palette=colorblind]_&]:text-sky-400">
                        +{segment.summary.added}
                      </span>{' '}
                      <span className="text-rose-400 [[data-diff-palette=colorblind]_&]:text-orange-400">
                        −{segment.summary.removed}
                      </span>
                    </span>
                  )}
                </ThinkingStepsHeader>
                <ThinkingStepsContent>
                  {segment.items.map((step) => (
                    <ToolRow key={step.seq} step={step} />
                  ))}
                </ThinkingStepsContent>
              </ThinkingSteps>
            )}
          </div>
        )
      })}
      {children}
      {live && !activeReasoning && <LiveStep step={lastStep} elapsed={live.elapsed} />}
    </div>
  )
}
