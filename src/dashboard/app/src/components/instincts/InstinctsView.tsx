import { Brain, Plus, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { GraduationPreview } from '../../api/projectTabs'
import type { InstinctItem } from '../../types/orchestos'
import { SettingsPrimaryAction } from '../settings/primitives'

function relativeInjectionDate(date: string): string {
  const seconds = Math.round((Date.parse(date) - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return format.format(seconds, 'second')
  if (Math.abs(seconds) < 3600) return format.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86400) return format.format(Math.round(seconds / 3600), 'hour')
  return format.format(Math.round(seconds / 86400), 'day')
}

interface InstinctsViewProps {
  instincts: InstinctItem[]
  onApproveInstinct: (id: string) => void
  onRejectInstinct: (id: string) => void
  onSetInstinctStatus?: (id: string, status: 'active' | 'retired') => Promise<void>
  onPreviewGraduation?: (id: string) => Promise<GraduationPreview>
  onGraduateInstinct?: (id: string) => Promise<GraduationPreview>
  onUpdateInstinct?: (
    id: string,
    fields: { trigger: string; action: string; why: string },
  ) => Promise<void>
  onAddInstinct: (trigger: string, action: string) => void | Promise<void>
}

export const InstinctsView: React.FC<InstinctsViewProps> = ({
  instincts,
  onApproveInstinct,
  onRejectInstinct,
  onSetInstinctStatus,
  onPreviewGraduation,
  onGraduateInstinct,
  onAddInstinct,
  onUpdateInstinct,
}) => {
  const lifecycleAction = async (action: () => Promise<void>) => {
    if (lifecycleSaving) return
    setLifecycleSaving(true)
    setLifecycleError(null)
    try {
      await action()
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : String(error))
    } finally {
      setLifecycleSaving(false)
    }
  }
  const [tab, setTab] = useState<'all' | 'review'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newAction, setNewAction] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<{
    id: string
    trigger: string
    action: string
    why: string
  } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  // Lifecycle state goes after the original hooks: aud25-ui.test.ts drives the add form by hook index.
  const [graduation, setGraduation] = useState<(GraduationPreview & { id: string }) | null>(null)
  const [lifecycleError, setLifecycleError] = useState<string | null>(null)
  const [lifecycleSaving, setLifecycleSaving] = useState(false)
  const saveEdit = async () => {
    if (!editing || !onUpdateInstinct || editSaving) return
    setEditSaving(true)
    setEditError(null)
    try {
      await onUpdateInstinct(editing.id, {
        trigger: editing.trigger.trim(),
        action: editing.action.trim(),
        why: editing.why.trim(),
      })
      setEditing(null)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error))
    } finally {
      setEditSaving(false)
    }
  }

  const unverified = instincts.filter((i) => !i.verified || i.status === 'review')

  const displayedInstincts = tab === 'review' ? unverified : instincts

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTrigger || !newAction) return
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await onAddInstinct(newTrigger.trim(), newAction.trim())
      setNewTrigger('')
      setNewAction('')
      setShowAddModal(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
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

      {lifecycleError && (
        <p role="alert" className="text-xs text-app-error">
          {lifecycleError}
        </p>
      )}
      {/* Instincts Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto space-y-3">
          {displayedInstincts.length === 0 ? (
            <div className="py-12 text-center text-xs text-app-muted">
              No instincts in this category.
            </div>
          ) : (
            displayedInstincts.map((instinct) => (
              <div
                key={instinct.id}
                className={`p-4 rounded-card bg-app-elevated space-y-3 ${instinct.status === 'retired' ? 'opacity-50' : ''}`}
              >
                {instinct.status === 'review' && (
                  <span className="text-[11px] text-app-muted">Unused for 60 days</span>
                )}
                {instinct.status === 'retired' && (
                  <span className="text-[11px] text-app-muted">Retired</span>
                )}
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
                {editing?.id === instinct.id ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void saveEdit()
                    }}
                  >
                    {(['trigger', 'action', 'why'] as const).map((field) => (
                      <label key={field} className="block text-xs text-app-muted">
                        {field === 'trigger'
                          ? 'Trigger'
                          : field === 'action'
                            ? 'Learned Action'
                            : 'Why'}
                        <textarea
                          required={field !== 'why'}
                          maxLength={field === 'why' ? 1000 : 500}
                          value={editing[field]}
                          onChange={(event) =>
                            setEditing({ ...editing, [field]: event.target.value })
                          }
                          className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
                        />
                      </label>
                    ))}
                    {editError && (
                      <p role="alert" className="text-xs text-app-error">
                        {editError}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        size="compact"
                        disabled={editSaving || !editing.trigger.trim() || !editing.action.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        variant="ghost"
                        disabled={editSaving}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
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
                    {instinct.why && (
                      <div className="flex items-start gap-3">
                        <span className="w-28 shrink-0 text-[11px] font-semibold text-app-muted">
                          Why
                        </span>
                        <span className="text-[13px] text-app">{instinct.why}</span>
                      </div>
                    )}
                  </div>
                )}
                {instinct.evidence && (
                  <p className="text-[11px] text-app-muted">
                    {Object.entries(instinct.evidence)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </p>
                )}

                {/* Footer and Controls */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-app-muted">
                    Injected {instinct.injectedCount ?? 0} times
                    {instinct.lastInjectedAt && (
                      <> · {relativeInjectionDate(instinct.lastInjectedAt)}</>
                    )}
                  </span>

                  {instinct.status !== 'retired' && (
                    <div className="flex items-center gap-2">
                      {instinct.status === 'review' && onSetInstinctStatus && (
                        <>
                          <Button
                            size="compact"
                            disabled={lifecycleSaving}
                            onClick={() =>
                              void lifecycleAction(async () => {
                                await onSetInstinctStatus(instinct.id, 'active')
                              })
                            }
                          >
                            Keep
                          </Button>
                          <Button
                            size="compact"
                            variant="ghost"
                            disabled={lifecycleSaving}
                            onClick={() =>
                              void lifecycleAction(async () => {
                                await onSetInstinctStatus(instinct.id, 'retired')
                              })
                            }
                          >
                            Retire
                          </Button>
                        </>
                      )}
                      {instinct.verified &&
                        instinct.status === 'active' &&
                        instinct.projectId != null &&
                        onPreviewGraduation && (
                          <Button
                            size="compact"
                            disabled={lifecycleSaving}
                            onClick={() =>
                              void lifecycleAction(async () => {
                                const preview = await onPreviewGraduation(instinct.id)
                                setGraduation({ ...preview, id: instinct.id })
                              })
                            }
                          >
                            Add to AGENTS.md
                          </Button>
                        )}
                      {onUpdateInstinct && editing?.id !== instinct.id && (
                        <Button
                          size="compact"
                          variant="ghost"
                          onClick={() => {
                            setEditing({
                              id: instinct.id,
                              trigger: instinct.trigger,
                              action: instinct.action,
                              why: instinct.why ?? '',
                            })
                            setEditError(null)
                          }}
                        >
                          Edit
                        </Button>
                      )}
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
                      ) : instinct.status === 'active' ? (
                        <div className="flex items-center gap-1 text-[11px] text-app-muted">
                          <span>Active in middleware chain</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {graduation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add to AGENTS.md"
            className="w-full max-w-lg bg-app-surface rounded-card p-5 space-y-4"
          >
            <h3 className="font-bold text-sm text-app">Add to AGENTS.md</h3>
            <p className="text-xs text-app-muted break-all">{graduation.path}</p>
            {graduation.created && <p className="text-xs text-app-muted">Creates AGENTS.md</p>}
            <pre className="p-3 rounded-card bg-app-elevated text-xs text-app-success whitespace-pre-wrap">
              {graduation.added.map((line) => `+ ${line}`).join('\n')}
            </pre>
            {lifecycleError && (
              <p role="alert" className="text-xs text-app-error">
                {lifecycleError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                size="compact"
                variant="ghost"
                disabled={lifecycleSaving}
                onClick={() => {
                  setGraduation(null)
                  setLifecycleError(null)
                }}
              >
                Cancel
              </Button>
              <Button
                size="compact"
                disabled={lifecycleSaving || !onGraduateInstinct}
                onClick={() =>
                  void lifecycleAction(async () => {
                    if (!onGraduateInstinct) return
                    await onGraduateInstinct(graduation.id)
                    setGraduation(null)
                  })
                }
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Add Manual Instinct Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-lg bg-app-surface border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] rounded-card p-5 space-y-4"
          >
            {saveError && (
              <p role="alert" className="text-xs text-app-error">
                {saveError}
              </p>
            )}
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
                <label htmlFor="instinct-trigger" className="block text-app font-semibold mb-1">
                  Trigger Pattern
                </label>
                <input
                  id="instinct-trigger"
                  type="text"
                  required
                  placeholder="e.g. LLM generates test file without async await"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="w-full bg-app-elevated rounded-control p-2 text-app text-xs focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="instinct-action" className="block text-app font-semibold mb-1">
                  Learned Action / Behavior to Enforce
                </label>
                <textarea
                  id="instinct-action"
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
                <Button type="submit" disabled={saving} size="compact">
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
