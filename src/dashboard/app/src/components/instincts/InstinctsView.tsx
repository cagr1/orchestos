import { Brain, Plus, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { InstinctItem } from '../../types/orchestos'
import { SettingsPrimaryAction } from '../settings/primitives'

interface InstinctsViewProps {
  instincts: InstinctItem[]
  onApproveInstinct: (id: string) => void
  onRejectInstinct: (id: string) => void
  onAddInstinct: (trigger: string, action: string) => void
}

export const InstinctsView: React.FC<InstinctsViewProps> = ({
  instincts,
  onApproveInstinct,
  onRejectInstinct,
  onAddInstinct,
}) => {
  const [tab, setTab] = useState<'all' | 'review'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newAction, setNewAction] = useState('')

  const unverified = instincts.filter((i) => !i.verified)

  const displayedInstincts = tab === 'review' ? unverified : instincts

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTrigger || !newAction) return
    onAddInstinct(newTrigger.trim(), newAction.trim())
    setNewTrigger('')
    setNewAction('')
    setShowAddModal(false)
  }

  const tabButton = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-control px-3 py-1 text-xs font-medium transition-colors ${
      active ? 'bg-app-elevated text-app' : 'text-app-muted hover:text-app'
    }`

  return (
    <div
      data-instincts-view
      className="flex min-h-full flex-1 flex-col overflow-hidden select-none"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-0.5 rounded-control bg-app-bg p-0.5">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={tabButton(tab === 'all')}
            >
              Active Instincts ({instincts.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('review')}
              className={tabButton(tab === 'review')}
            >
              <span>Review Proposals</span>
              {unverified.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-app-warning" />
              )}
            </button>
          </div>

          <span className="hidden text-xs text-app-muted md:inline">
            Behavioral rules for agent runs
          </span>
        </div>

        <SettingsPrimaryAction>
          <Button size="compact" leadingIcon={Plus} onClick={() => setShowAddModal(true)}>
            Add Manual Instinct
          </Button>
        </SettingsPrimaryAction>
      </div>

      {/* Instincts Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto space-y-3">
          {displayedInstincts.length === 0 ? (
            <div className="py-12 text-center text-xs text-app-muted">
              No instincts in this category.
            </div>
          ) : (
            displayedInstincts.map((instinct) => (
              <div key={instinct.id} className="p-4 rounded-card bg-app-elevated space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <Brain className="w-4 h-4 shrink-0 text-app-muted" />
                    <span
                      title={instinct.id}
                      className="max-w-[10rem] truncate font-mono font-semibold text-app"
                    >
                      {instinct.id}
                    </span>
                    <span className="text-[11px] text-app-muted">
                      {instinct.source}
                      {instinct.projectId == null && (
                        <>
                          {' · '}
                          <span>Sin proyecto (histórico)</span>
                        </>
                      )}
                    </span>
                    {instinct.verified ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-app-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-app-success" /> verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] text-app-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-app-warning" /> pending review
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-app-muted">Confidence</div>
                      <div className="text-xs font-semibold tabular-nums text-app">
                        {(instinct.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-app-bg">
                      <div
                        className="h-full rounded-full bg-app-accent"
                        style={{ width: `${instinct.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Trigger & Action */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-semibold text-app-muted">
                      Trigger
                    </span>
                    <span className="text-[13px] text-app">{instinct.trigger}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-semibold text-app-muted">
                      Learned Action
                    </span>
                    <span className="text-[13px] text-app">{instinct.action}</span>
                  </div>
                </div>

                {/* Footer and Controls */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-app-muted">
                    Injected into {instinct.usagesCount} agent prompts
                  </span>

                  {!instinct.verified ? (
                    <div className="flex items-center gap-2">
                      <SettingsPrimaryAction>
                        <Button
                          size="compact"
                          leadingIcon={ThumbsUp}
                          onClick={() => onApproveInstinct(instinct.id)}
                        >
                          Approve (+0.10)
                        </Button>
                      </SettingsPrimaryAction>
                      <Button
                        variant="ghost"
                        size="compact"
                        leadingIcon={ThumbsDown}
                        className="text-app-error"
                        onClick={() => onRejectInstinct(instinct.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-app-muted">
                      <span>Active in middleware chain</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Manual Instinct Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-lg bg-app-surface border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] rounded-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] pb-3">
              <h3 className="font-bold text-sm text-app flex items-center gap-2">
                <Brain className="w-4 h-4 text-app-muted" />
                Add Manual Agent Instinct
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-app-muted hover:text-app"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-app font-semibold mb-1">Trigger Pattern</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LLM generates test file without async await"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-app font-semibold mb-1">
                  Learned Action / Behavior to Enforce
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Automatically import describe and it from 'bun:test' and structure test cases with explicit timeouts"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-card bg-app-elevated text-app-muted text-[11px]">
                Manual instincts start with confidence <strong>1.00</strong> and apply to new runs.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]">
              <Button
                variant="ghost"
                size="compact"
                type="button"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <SettingsPrimaryAction>
                <Button type="submit" size="compact">
                  Register Instinct
                </Button>
              </SettingsPrimaryAction>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
