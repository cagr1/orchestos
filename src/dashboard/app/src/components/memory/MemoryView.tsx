import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  GitMerge,
  Layers,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { MemoryItem } from '../../types/orchestos'

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
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-xs text-zinc-100 tracking-wide uppercase">
              Semantic Memory Matrix
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topicKey or content..."
              className="pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-56"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conflicts.length > 0 ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              {conflicts.length} Conflict Flagged
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Memories Consistent
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Conflict Alert Banner if any */}
        {conflicts.length > 0 && (
          <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Memory Contradiction Detected Across Sub-Agent Runs</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                orchestos memory conflicts
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Two independent agent runs recorded divergent guidelines for the topicKey{' '}
              <code className="font-mono text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded">
                "{conflicts[0].topicKey}"
              </code>
              . Auto-merges are paused until you reconcile the authoritative rule.
            </p>

            <button
              onClick={() => startResolution(conflicts[0])}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all"
            >
              <GitMerge className="w-3.5 h-3.5" />
              Open Synthesis & Resolution Wizard
            </button>
          </div>
        )}

        {/* Memories Grid */}
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
            <span>Stored Semantic Units ({filteredMemories.length})</span>
            <span>SQLite Vector Embeddings: text-embedding-3-small</span>
          </div>

          <div className="grid gap-3">
            {filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                  mem.hasConflict
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400">{mem.topicKey}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {mem.scope}
                    </span>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-mono">ID: {mem.id}</span>
                </div>

                <p className="text-zinc-200 leading-relaxed font-normal">{mem.content}</p>

                {mem.hasConflict && mem.conflictDetails && (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-amber-800/40 space-y-1 text-[11px]">
                    <div className="font-semibold text-amber-400">
                      Conflicting Divergence (from {mem.conflictDetails.detectedFromRun}):
                    </div>
                    <div className="text-zinc-400 font-mono">
                      "{mem.conflictDetails.conflictingContent}"
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {resolvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleResolveSubmit}
            className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-amber-400" />
                Resolve Memory Contradiction: {resolvingItem.topicKey}
              </h3>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-indigo-400 text-[11px]">Current Rule:</div>
                  <p className="text-zinc-300 text-[11px]">{resolvingItem.content}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-amber-800/60 space-y-1">
                  <div className="font-semibold text-amber-400 text-[11px]">
                    Divergent Observation:
                  </div>
                  <p className="text-zinc-300 text-[11px]">
                    {resolvingItem.conflictDetails?.conflictingContent}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-zinc-200 font-semibold mb-1">
                  Synthesized Authoritative Standard
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolvedText}
                  onChange={(e) => setResolvedText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Commit Authoritative Resolution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
