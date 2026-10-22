import {
  Activity,
  Bot,
  Clock,
  Cpu,
  FileOutput,
  GitBranch,
  type LucideIcon,
  Repeat,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { spring } from '@/lib/springs'
import type { TaskItem } from '../../types/orchestos'
import { statusLabel } from '../common/StatusBadge'

export const TASK_STATUS_DOT: Record<string, string> = {
  done: 'bg-app-success',
  failed: 'bg-app-error',
  failed_permanent: 'bg-app-error',
  running: 'bg-app-accent',
  blocked: 'bg-app-warning',
  pending: 'bg-app-muted',
}

/** Título de la fila y del detalle: `title` o la primera línea de la descripción (80 caracteres). */
export function taskTitle(task: Pick<TaskItem, 'title' | 'description'>): string {
  if (task.title) return task.title
  return (task.description ?? '').split('\n')[0]?.slice(0, 80) ?? ''
}

function Property({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex w-28 shrink-0 items-center gap-2 text-[12.5px] text-app-muted">
        <Icon size={14} className="shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1 break-words text-[13px] text-app">{children}</div>
    </div>
  )
}

export function TaskDetailPanel({
  task,
  maxAttempts,
  onClose,
}: {
  task: TaskItem
  maxAttempts: number
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = taskTitle(task)
  const lastRun = task.lastRunAt ? new Date(task.lastRunAt) : null
  const showDescription = task.description.trim() !== '' && task.description !== title
  const criteria = task.acceptance_criteria ?? []

  return (
    <motion.aside
      data-ff
      data-task-detail
      data-task-id={task.id}
      initial={reduceMotion ? { opacity: 0 } : { x: 48, opacity: 0 }}
      animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
      transition={spring.moderate}
      className="fixed bottom-7 right-0 top-11 z-30 flex w-[min(620px,55vw)] flex-col overflow-y-auto border-l border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface shadow-[-18px_0_40px_-24px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <span className="truncate font-mono text-[11px] text-app-muted">{task.id}</span>
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="Close task detail"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="space-y-5 px-5 pb-6 pt-2">
        <h2 className="text-xl font-semibold text-app">{title}</h2>
        <div>
          <Property icon={Activity} label="Status">
            <span className="inline-flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[task.status] ?? 'bg-app-muted'}`}
              />
              {statusLabel(task.status)}
            </span>
          </Property>
          <Property icon={Bot} label="Agent">
            {task.assignedAgent || 'unassigned'}
          </Property>
          <Property icon={Cpu} label="Engine">
            {task.engine}
          </Property>
          {task.skill ? (
            <Property icon={Sparkles} label="Skill">
              {task.skill}
            </Property>
          ) : null}
          <Property icon={GitBranch} label="Depends on">
            {task.depends_on.length > 0 ? (
              <span className="font-mono text-xs">{task.depends_on.join(', ')}</span>
            ) : (
              'None'
            )}
          </Property>
          {task.outputSlice ? (
            <Property icon={FileOutput} label="Outputs">
              <span className="font-mono text-xs">[{task.outputSlice.join(', ')}]</span>
            </Property>
          ) : null}
          {task.runId ? (
            <Property icon={Tag} label="Run">
              <span className="font-mono text-xs">{task.runId}</span>
            </Property>
          ) : null}
          {lastRun ? (
            <Property icon={Clock} label="Last run">
              {lastRun.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
            </Property>
          ) : null}
          {(task.retryCount ?? 0) > 0 ? (
            <Property icon={Repeat} label="Attempts">
              {task.retryCount}/{maxAttempts}
            </Property>
          ) : null}
        </div>
        {['failed', 'failed_permanent', 'pending'].includes(task.status) && task.retryReason ? (
          <p className="whitespace-pre-wrap font-mono text-xs text-app-error">
            {(task.retryCount ?? 0) > 0
              ? `Attempt ${task.retryCount}/${maxAttempts} failed: `
              : 'Failed: '}
            {task.retryReason}
          </p>
        ) : ['failed', 'failed_permanent'].includes(task.status) ? (
          <p className="text-xs text-app-warning">No hay registro de por qué falló</p>
        ) : null}
        {showDescription ? (
          <section>
            <h3 className="mb-1 text-[12.5px] text-app-muted">Description</h3>
            <p className="whitespace-pre-wrap text-[13px] text-app">{task.description}</p>
          </section>
        ) : null}
        {criteria.length > 0 ? (
          <section>
            <h3 className="mb-1 text-[12.5px] text-app-muted">Acceptance criteria</h3>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-app">
              {criteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </motion.aside>
  )
}
