import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  Plus,
  Repeat,
  Sliders,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { InstinctItem } from '../../types/orchestos'

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                tab === 'all'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active Instincts ({instincts.length})
            </button>
            <button
              onClick={() => setTab('review')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                tab === 'review'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Review Proposals</span>
              {unverified.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-400" />}
            </button>
          </div>

          <span className="text-xs text-zinc-500 font-mono hidden md:inline">
            Reinforcement Learning Engine (orchestos instinct)
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Manual Instinct</span>
        </button>
      </div>

      {/* Instincts Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {displayedInstincts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No instincts in this category.
            </div>
          ) : (
            displayedInstincts.map((instinct) => (
              <div
                key={instinct.id}
                className="p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/90 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <Brain className="w-4 h-4 text-pink-400" />
                    <span className="font-semibold text-zinc-200">{instinct.id}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        instinct.source === 'auto'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {instinct.source}
                    </span>
                    {instinct.verified ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> pending review
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 uppercase font-mono">
                        Confidence
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {(instinct.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${instinct.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Trigger & Action */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-start gap-2">
                    <span className="font-mono text-[10px] text-pink-400 uppercase font-bold px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/20 mt-0.5">
                      Trigger
                    </span>
                    <span className="text-zinc-200">{instinct.trigger}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-start gap-2">
                    <span className="font-mono text-[10px] text-indigo-400 uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 mt-0.5">
                      Learned Action
                    </span>
                    <span className="text-zinc-300">{instinct.action}</span>
                  </div>
                </div>

                {/* Footer and Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Injected into {instinct.usagesCount} agent prompts
                  </span>

                  {!instinct.verified ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onApproveInstinct(instinct.id)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Approve (+0.10)
                      </button>
                      <button
                        onClick={() => onRejectInstinct(instinct.id)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-medium border border-zinc-700 transition-all"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-pink-400" />
                Add Manual Agent Instinct
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Trigger Pattern</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LLM generates test file without async await"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Learned Action / Behavior to Enforce
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Automatically import describe and it from 'bun:test' and structure test cases with explicit timeouts"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-[11px]">
                Manual instincts start with an authoritative confidence score of{' '}
                <strong>1.00</strong> and are immediately compiled into the middleware context
                pipeline.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Register Instinct
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
