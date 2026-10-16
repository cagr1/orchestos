import {
  ThinkingStep,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { cn } from '@/lib/utils'
import type { ToolExecution } from '../../types/orchestos'
import { formatDuration } from './thinking'

interface ThreadToolsProps {
  tools: ToolExecution[]
  defaultOpen?: boolean
}

export function toolTarget(args: ToolExecution['args']): string {
  const value = args?.target ?? args?.command
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

export function ThreadTools({ tools, defaultOpen = false }: ThreadToolsProps) {
  const failed = tools.filter((tool) => tool.status === 'failed').length
  const timed = tools.filter((tool) => typeof tool.durationMs === 'number')
  const total = timed.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0)

  return (
    <ThinkingSteps
      defaultOpen={defaultOpen}
      className="-mx-3 w-full"
      data-thread-tools=""
      data-tool-count={tools.length}
      data-tool-failed={failed}
    >
      <ThinkingStepsHeader>
        <span>{tools.length === 1 ? '1 tool' : `${tools.length} tools`}</span>
        {timed.length > 0 && (
          <span className="tabular-nums text-muted-foreground"> · {formatDuration(total)}</span>
        )}
        {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
      </ThinkingStepsHeader>
      <ThinkingStepsContent className="[&_span]:font-mono">
        {tools.map((tool, idx) => {
          const target = toolTarget(tool.args)
          return (
            <ThinkingStep
              // biome-ignore lint/suspicious/noArrayIndexKey: lista fija de llamadas ya emitidas.
              key={idx}
              label={tool.name}
              icon={
                tool.status === 'running' ? undefined : tool.status === 'failed' ? 'x' : 'check'
              }
              status={tool.status === 'running' ? 'active' : 'complete'}
              isLast={idx === tools.length - 1}
            >
              <div
                data-tool-step=""
                data-tool-status={tool.status}
                className="flex min-w-0 flex-col gap-1"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span
                    title={target || undefined}
                    className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                  >
                    {target}
                  </span>
                  {tool.status === 'failed' && (
                    <span className="shrink-0 text-xs text-destructive">failed</span>
                  )}
                  {typeof tool.durationMs === 'number' && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDuration(tool.durationMs)}
                    </span>
                  )}
                </div>
                {tool.result && (
                  <span
                    className={cn(
                      'line-clamp-4 whitespace-pre-wrap break-words text-[11px] text-muted-foreground',
                    )}
                  >
                    {tool.result}
                  </span>
                )}
              </div>
            </ThinkingStep>
          )
        })}
      </ThinkingStepsContent>
    </ThinkingSteps>
  )
}
