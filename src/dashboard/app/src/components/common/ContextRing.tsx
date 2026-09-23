import type React from 'react'
import { useState } from 'react'

export interface ContextRingProps {
  percent?: number | null // e.g. 64 or 23; null/undefined means no data -> no ring
  model?: string
  usedTokens?: string // e.g. "128k"
  maxTokens?: string // e.g. "200k"
  className?: string
}

export const ContextRing: React.FC<ContextRingProps> = ({
  percent,
  model,
  usedTokens,
  maxTokens,
  className = '',
}) => {
  const [showPopover, setShowPopover] = useState(false)

  // No data -> no ring (never a fake number)
  if (percent === undefined || percent === null || Number.isNaN(percent)) {
    return null
  }

  const clamped = Math.min(100, Math.max(0, percent))
  const r = 7
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  let strokeColor = 'var(--app-accent, #6366f1)'
  let textColorClass = 'text-app-accent'
  if (clamped >= 80) {
    strokeColor = '#f43f5e'
    textColorClass = 'text-rose-500'
  } else if (clamped >= 60) {
    strokeColor = '#f59e0b'
    textColorClass = 'text-amber-400'
  }

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 cursor-default select-none ${className}`}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      onFocus={() => setShowPopover(true)}
      onBlur={() => setShowPopover(false)}
      tabIndex={0}
      aria-label={`Context window usage: ${clamped}%`}
      title={`${model ?? 'Context window'} · ${Math.round(clamped)}%`}
    >
      {/* 18px circular gauge */}
      <svg
        className="w-[18px] h-[18px] -rotate-90 flex-shrink-0"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-app-muted/20"
        />
        {/* Fill */}
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>

      {/* No number under 50%, a short mono 62% from 50% */}
      {clamped >= 50 && (
        <span className={`font-mono text-[11px] font-medium leading-none ${textColorClass}`}>
          {Math.round(clamped)}%
        </span>
      )}

      {/* Hover / Focus Popover */}
      {showPopover && (
        <div
          role="tooltip"
          className="absolute right-0 top-full mt-2 w-56 p-2.5 rounded-control bg-app-surface border border-app shadow-xl text-app z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="truncate">{model}</span>
            <span className="font-mono text-[11px]">{Math.round(clamped)}%</span>
          </div>

          <div className="text-[11px] font-mono text-app-muted leading-relaxed">
            {usedTokens && maxTokens ? `${usedTokens} / ${maxTokens} tokens` : 'Context usage'}
          </div>

          {clamped >= 80 && (
            <div className="mt-2 pt-1.5 border-t border-app/60 text-[11px] font-medium text-amber-400">
              Start a new session or compact
            </div>
          )}
        </div>
      )}
    </div>
  )
}
