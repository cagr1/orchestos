import {
  AlertTriangle,
  CheckCircle2,
  Code,
  FileText,
  FolderGit2,
  GitBranch,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { ProjectContext } from '../../types/orchestos'

interface ContextViewProps {
  context: ProjectContext
  onRefreshGraph: () => void
}

export const ContextView: React.FC<ContextViewProps> = ({ context, onRefreshGraph }) => {
  const [activeTab, setActiveTab] = useState<'constitution' | 'context' | 'graph'>('constitution')

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('constitution')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'constitution'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CONSTITUTION.md
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'context'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CONTEXT.md
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'graph'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Code Graph ({context.codeGraphNodes} files)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />0 stale references detected
          </span>
          <button
            onClick={onRefreshGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Rebuild Code Graph
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {activeTab === 'constitution' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-sm text-white">
                    Agent Constitution (Immutable Rules)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Last verified: Today</span>
              </div>
              <pre className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {context.constitution}
              </pre>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm text-white">Project Architecture Context</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Branch: {context.gitBranch}
                </span>
              </div>
              <pre className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {context.contextDoc}
              </pre>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">Dependency Topology & Code Graph</h3>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Analyzed by ast-grep & tree-sitter for zero-token context routing.
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {context.codeGraphNodes} source units
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-300">Git Cleanliness</div>
                  <div className="text-emerald-400 font-mono">
                    {context.isCleanWorktree ? 'Clean tree (no unstaged edits)' : 'Dirty worktree'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-300">Language Distribution</div>
                  <div className="text-zinc-400 font-mono">
                    TypeScript (82%), Rust (12%), Shell (6%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
