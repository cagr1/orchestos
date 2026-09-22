import { AlertCircle, type LucideIcon, Plus, RefreshCw } from 'lucide-react'
import type React from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-card border border-app bg-app-surface/50 max-w-md mx-auto my-8 ${className}`}
    >
      <div className="w-10 h-10 rounded-pill bg-app-elevated border border-app flex items-center justify-center text-app-accent mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-app mb-1">{title}</h3>
      <p className="text-xs text-app-muted max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent text-zinc-950 font-semibold text-xs hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  )
}

interface SkeletonViewProps {
  rows?: number
  type?: 'table' | 'cards' | 'list'
}

export const SkeletonView: React.FC<SkeletonViewProps> = ({ rows = 4, type = 'list' }) => {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="h-5 w-48 bg-app-elevated rounded-control mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 rounded-card bg-app-surface border border-app space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-1/3 bg-app-elevated rounded-control" />
            <div className="h-3 w-16 bg-app-elevated rounded-pill" />
          </div>
          <div className="h-3 w-3/4 bg-app-elevated/60 rounded-control" />
        </div>
      ))}
    </div>
  )
}

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center rounded-card border border-rose-800/40 bg-rose-950/20 max-w-md mx-auto my-6 text-xs">
      <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
      <div className="font-semibold text-rose-300 mb-1">Encountered an execution error</div>
      <p className="text-app-muted mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:bg-app-surface transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  )
}
