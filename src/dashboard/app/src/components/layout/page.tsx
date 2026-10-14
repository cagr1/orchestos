import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header data-page-header className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-app">{title}</h1>
          {meta ? <span className="truncate text-xs text-app-muted">{meta}</span> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center text-xs text-app-muted">{actions}</div>
        ) : null}
      </div>
      {description ? <p className="text-[13px] text-app-muted">{description}</p> : null}
    </header>
  )
}

const TONE: Record<'success' | 'error' | 'warning', string> = {
  success: 'text-app-success',
  error: 'text-app-error',
  warning: 'text-app-warning',
}

export interface StatStripItem {
  label: string
  value: string | number
  hint?: string
  tone?: 'success' | 'error' | 'warning'
}

export function StatStrip({ items }: { items: StatStripItem[] }) {
  return (
    <div
      data-stat-strip
      style={{ '--stat-cols': items.length } as CSSProperties}
      className="grid grid-cols-2 md:[grid-template-columns:repeat(var(--stat-cols),minmax(0,1fr))] overflow-hidden rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_40%,transparent)] [&>*+*]:border-l [&>*+*]:[border-left-color:color-mix(in_srgb,var(--app-border)_40%,transparent)]"
    >
      {items.map((item) => (
        <div key={item.label} data-stat-cell className="min-w-0 px-4 py-3.5">
          <div className="text-[12.5px] text-app-muted">{item.label}</div>
          <div
            title={String(item.value)}
            className="truncate text-[22px] font-semibold tabular-nums text-app"
          >
            {item.value}
          </div>
          {item.hint ? (
            <div className={cn('text-xs text-app-muted', item.tone && TONE[item.tone])}>
              {item.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
