import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
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

export function ListRow({
  leading,
  id,
  title,
  meta,
  trailing,
  onOpen,
  selected,
  ...rest
}: {
  leading?: ReactNode
  id?: string
  title: string
  meta?: ReactNode
  trailing?: ReactNode
  onOpen: () => void
  selected?: boolean
} & Record<`data-${string}`, string | undefined>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }
  return (
    <div
      {...rest}
      data-list-row
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        'flex h-10 cursor-pointer items-center gap-3 whitespace-nowrap border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] px-3 hover:bg-app-elevated',
        selected && 'bg-app-elevated',
      )}
    >
      {leading}
      {id ? (
        <span
          title={id}
          className="w-[7rem] shrink-0 truncate font-mono text-[11px] text-app-muted"
        >
          {id}
        </span>
      ) : null}
      <span title={title} className="min-w-0 flex-1 truncate text-[13px] text-app">
        {title}
      </span>
      {meta ? <span className="whitespace-nowrap text-xs text-app-muted">{meta}</span> : null}
      {trailing ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: contiene los controles de la fila; solo detiene la propagación
        <div
          className="flex shrink-0 items-center gap-2 whitespace-nowrap"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  )
}
