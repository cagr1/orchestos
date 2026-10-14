import { Minus, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useId } from 'react'
import { PageHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

export function SettingsPage({
  title,
  description,
  status,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div data-ff data-settings-page className="flex-1 overflow-y-auto px-6 py-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      >
        <PageHeader title={title} description={description} actions={status} />
        {children}
        {actions ? <div className="flex justify-end">{actions}</div> : null}
      </motion.div>
    </div>
  )
}

export function SettingsGroup({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h2 className="px-1 text-xs font-medium text-app-muted">{title}</h2> : null}
      <div
        data-settings-group
        className="[&>*+*]:border-t [&>*+*]:[border-top-color:color-mix(in_srgb,var(--app-border)_50%,transparent)] overflow-hidden rounded-card border border-app/40 bg-app-surface"
      >
        {children}
      </div>
    </section>
  )
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      data-settings-row
      className="flex min-h-[52px] items-center justify-between gap-4 px-4 py-2"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-app">{label}</div>
        {description ? <div className="text-xs text-app-muted">{description}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center">{children}</div> : null}
    </div>
  )
}

export function SettingsSegmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  ariaLabel: string
}) {
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-control bg-app-bg p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative isolate rounded-control px-3 py-1 text-xs font-medium outline-none transition-colors',
              'focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
              active ? 'text-app' : 'text-app-muted hover:text-app',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-control bg-app-elevated"
                transition={reduce ? { duration: 0 } : spring.moderate}
              />
            ) : null}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsStepper({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  unit,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  ariaLabel: string
}) {
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n))
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-compact"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus />
      </Button>
      <span className="min-w-[56px] text-center text-[13px] tabular-nums text-app">
        {value}
        {unit ? <span className="ml-1 text-xs text-app-muted">{unit}</span> : null}
      </span>
      <Button
        variant="ghost"
        size="icon-compact"
        aria-label={`Increase ${ariaLabel}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus />
      </Button>
    </div>
  )
}

export function SettingsPrimaryAction({ children }: { children: ReactNode }) {
  return (
    <span data-settings-primary className="inline-flex [--foreground:var(--app-accent)]">
      {children}
    </span>
  )
}
