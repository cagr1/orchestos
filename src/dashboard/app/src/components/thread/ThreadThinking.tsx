import {
  ThinkingStep,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { cn } from '@/lib/utils'
import type { CliNotice } from '../../../../../run/executors/cli-failure'

interface ThreadThinkingProps {
  active: boolean
  label: string
  elapsed?: string
  steps: string[]
  notices?: CliNotice[]
}

export function ThreadThinking({
  active,
  label,
  elapsed,
  steps,
  notices = [],
}: ThreadThinkingProps) {
  const workingProps = active
    ? { 'data-thread-working': '', role: 'status', 'aria-live': 'polite' as const }
    : {}
  const visibleNotices = notices.filter((notice) => notice.kind !== 'no-response')
  const noticeLines = visibleNotices.map((notice, index) => (
    <div
      key={`${notice.kind}-${index}`}
      data-thread-notice={notice.kind}
      className="border-l-2 border-primary/60 pl-3 py-1 text-sm text-muted-foreground"
      role="status"
    >
      <span>{notice.message}</span>
      {notice.detail && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs">Details</summary>
          <pre className="whitespace-pre-wrap break-words text-xs">{notice.detail}</pre>
        </details>
      )}
    </div>
  ))
  const title = (
    <>
      <span className={cn(active && 'shimmer-text')}>{label}</span>
      {elapsed && <span className="ml-2 tabular-nums text-muted-foreground"> {elapsed}</span>}
    </>
  )

  if (steps.length === 0) {
    return (
      <div {...workingProps} className="w-full px-0 py-1.5 text-sm text-foreground">
        {active && title}
        {noticeLines}
      </div>
    )
  }

  return (
    <div>
      <ThinkingSteps defaultOpen={false} className="-mx-3 w-full" {...workingProps}>
        <ThinkingStepsHeader>{title}</ThinkingStepsHeader>
        <ThinkingStepsContent className="[&_span]:whitespace-pre-wrap [&_span]:break-words [&_span]:font-normal [&_span]:text-muted-foreground">
          {steps.map((text, idx) => (
            <ThinkingStep
              // biome-ignore lint/suspicious/noArrayIndexKey: lista fija de pasos ya emitidos.
              key={idx}
              label={text}
              status="complete"
              showIcon={false}
              isLast={idx === steps.length - 1}
            />
          ))}
        </ThinkingStepsContent>
      </ThinkingSteps>
      {noticeLines}
    </div>
  )
}
