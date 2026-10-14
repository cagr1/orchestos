import {
  ThinkingStep,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { cn } from '@/lib/utils'

interface ThreadThinkingProps {
  active: boolean
  label: string
  elapsed?: string
  steps: string[]
}

export function ThreadThinking({ active, label, elapsed, steps }: ThreadThinkingProps) {
  const workingProps = active
    ? { 'data-thread-working': '', role: 'status', 'aria-live': 'polite' as const }
    : {}
  const title = (
    <>
      <span className={cn(active && 'shimmer-text')}>{label}</span>
      {elapsed && <span className="ml-2 tabular-nums text-muted-foreground"> {elapsed}</span>}
    </>
  )

  if (steps.length === 0) {
    return (
      <div {...workingProps} className="w-full px-0 py-1.5 text-sm text-foreground">
        {title}
      </div>
    )
  }

  return (
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
  )
}
