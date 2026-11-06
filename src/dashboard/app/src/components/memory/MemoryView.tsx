import { Database, GitMerge, Search, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { SettingsPrimaryAction } from '@/components/settings/primitives'
import { Button } from '@/components/ui/button'
import type { MemoryItem } from '../../types/orchestos'
import { EmptyState } from '../common/ViewStateFeedback'

const LINE = 'border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]'

interface MemoryViewProps {
  memories: MemoryItem[]
  onResolveConflict: (id: string, resolvedContent: string) => void
}

export const MemoryView: React.FC<MemoryViewProps> = ({ memories, onResolveConflict }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [resolvingItem, setResolvingItem] = useState<MemoryItem | null>(null)
  const [resolvedText, setResolvedText] = useState('')

  const conflicts = memories.filter((m) => m.hasConflict)

  const filteredMemories = memories.filter(
    (m) =>
      m.topicKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.scope.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const startResolution = (item: MemoryItem) => {
    setResolvingItem(item)
    setResolvedText(item.content)
  }

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingItem || !resolvedText) return
    onResolveConflict(
      resolvingItem.conflictDetails?.conflictId ?? resolvingItem.id,
      resolvedText.trim(),
    )
    setResolvingItem(null)
  }

  return (
    <div data-view="memory" className="flex min-h-full flex-1 flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div data-view-header="memory" className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-app-muted" />
            <span className="text-[13px] font-semibold text-app">Semantic Memory Matrix</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topicKey or content..."
              className="h-7 w-56 rounded-control bg-app-elevated pl-8 pr-3 text-xs text-app placeholder:text-app-muted focus:outline-none"
            />
          </div>
        </div>

        <span className="flex items-center gap-1.5 text-xs text-app-muted tabular-nums">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              conflicts.length > 0 ? 'bg-app-warning' : 'bg-app-success'
            }`}
          />
          {conflicts.length > 0
            ? `${conflicts.length} Conflict Flagged`
            : 'All Memories Consistent'}
        </span>
      </div>

      {/* Main Content */}
      <div data-view-content="memory" className="flex-1 overflow-y-auto px-6 pb-6">
        <div>
          {conflicts.length > 0 && (
            <div className={`mb-4 space-y-2 border-b pb-3 ${LINE}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-app">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-warning" />
                  <span>Memory Contradiction Detected Across Sub-Agent Runs</span>
                </div>
                <span className="font-mono text-[11px] text-app-muted">
                  orchestos memory conflicts
                </span>
              </div>

              <p className="max-w-prose text-xs leading-relaxed text-app-muted">
                Two independent agent runs recorded divergent guidelines for the topicKey{' '}
                <code className="font-mono text-app">"{conflicts[0].topicKey}"</code>. Auto-merges
                are paused until you reconcile the authoritative rule.
              </p>

              <Button
                variant="secondary"
                size="compact"
                leadingIcon={GitMerge}
                onClick={() => startResolution(conflicts[0])}
              >
                Open Synthesis & Resolution Wizard
              </Button>
            </div>
          )}

          <div className="px-3 pb-2 text-[11px] font-semibold text-app-muted">
            <span>Stored Semantic Units ({filteredMemories.length})</span>
          </div>

          {filteredMemories.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No memory yet"
              description="Memories appear here when agents record them."
            />
          ) : (
            filteredMemories.map((mem) => (
              <div key={mem.id} className={`space-y-1 border-b px-3 py-2.5 text-xs ${LINE}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {mem.hasConflict && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-warning" />
                    )}
                    <span className="truncate font-mono text-[11px] text-app-muted">
                      {mem.topicKey}
                    </span>
                    <span className="shrink-0 text-[11px] text-app-muted">
                      {mem.scope === 'global' ? 'Global' : mem.scope}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-app-muted">
                    ID: {mem.id}
                  </span>
                </div>

                <p className="text-[13px] leading-relaxed text-app">{mem.content}</p>

                {mem.hasConflict && mem.conflictDetails && (
                  <div className="space-y-0.5 pt-1 text-[11px]">
                    <div className="font-semibold text-app-muted">
                      Conflicting Divergence (from {mem.conflictDetails.detectedFromRun}):
                    </div>
                    <div className="font-mono text-app-muted">
                      "{mem.conflictDetails.conflictingContent}"
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {resolvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleResolveSubmit}
            className="w-full max-w-xl space-y-4 rounded-card bg-app-elevated p-5 shadow-2xl"
          >
            <div className={`flex items-center justify-between border-b pb-3 ${LINE}`}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-app">
                <GitMerge className="h-4 w-4 text-app-muted" />
                Resolve Memory Contradiction: {resolvingItem.topicKey}
              </h3>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="text-app-muted hover:text-app"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-app-muted">Current Rule:</div>
                  <p className="text-[11px] text-app">{resolvingItem.content}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-warning" />
                    Divergent Observation:
                  </div>
                  <p className="text-[11px] text-app">
                    {resolvingItem.conflictDetails?.conflictingContent}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-app">
                  Synthesized Authoritative Standard
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolvedText}
                  onChange={(e) => setResolvedText(e.target.value)}
                  className="w-full rounded-control bg-app-bg p-2.5 font-mono text-xs text-app focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => setResolvingItem(null)}
              >
                Cancel
              </Button>
              <SettingsPrimaryAction>
                <Button type="submit" size="compact">
                  Commit Authoritative Resolution
                </Button>
              </SettingsPrimaryAction>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
