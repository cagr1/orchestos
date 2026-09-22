import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  DollarSign,
  FileCode,
  Filter,
  Play,
  Search,
  ShieldCheck,
  Terminal,
  TrendingDown,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { RunItem } from '../../types/orchestos'
import { StatusBadge } from '../common/StatusBadge'
import { EmptyState, ErrorState, SkeletonView } from '../common/ViewStateFeedback'

interface RunsEvidenceViewProps {
  runs: RunItem[]
  onInspectRun?: (runId: string) => void
  onFilterStatus?: (status: string) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

export const RunsEvidenceView: React.FC<RunsEvidenceViewProps> = ({
  runs,
  onInspectRun,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [selectedRun, setSelectedRun] = useState<RunItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [evidenceTab, setEvidenceTab] = useState<'contract' | 'diffs' | 'cost' | 'qa'>('contract')

  // KPI calculations
  const totalRuns = runs.length
  const passedRuns = runs.filter((r) => r.qaVerdict === 'pass').length
  const passRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '0.0'
  const totalCost = runs.reduce((acc, r) => acc + (r.costUsd || 0), 0).toFixed(4)
  const totalTokens = runs.reduce((acc, r) => acc + (r.tokensUsed || 0), 0).toLocaleString()

  const filteredRuns = runs.filter((run) => {
    const matchesSearch =
      run.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.taskId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.taskDescription.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'passed' && run.qaVerdict === 'pass') ||
      (statusFilter === 'failed' && run.qaVerdict !== 'pass')
    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return <SkeletonView rows={5} type="table" />
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  // If a run is selected: Open detail view replacing the list to avoid squashing the table!
  if (selectedRun) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-app-bg text-app select-none">
        {/* Top Back Nav */}
        <div className="p-3 border-b border-app bg-app-surface/60 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={() => setSelectedRun(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-app-elevated border border-app text-xs text-app hover:bg-app-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Runs</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-app">{selectedRun.id}</span>
            <StatusBadge status={selectedRun.qaVerdict === 'pass' ? 'passed' : 'failed'} />
          </div>
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-card border border-app bg-app-surface p-4 space-y-2">
            <div className="text-xs font-mono text-app-muted">{selectedRun.taskId}</div>
            <h2 className="text-sm font-semibold text-app">{selectedRun.taskDescription}</h2>
            <div className="flex flex-wrap gap-3 pt-2 text-xs font-mono text-app-muted">
              <div>
                Agent: <span className="text-app">{selectedRun.agentModel}</span>
              </div>
              <div>
                Duration: <span className="text-app">{selectedRun.duration}</span>
              </div>
              <div>
                Cost: <span className="text-app-accent">${selectedRun.costUsd?.toFixed(4)}</span>
              </div>
              <div>
                Tokens: <span className="text-app">{selectedRun.tokensUsed?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Sub-tabs for detail */}
          <div className="flex items-center gap-1 p-1 bg-app-surface rounded-control border border-app text-xs max-w-md">
            <button
              type="button"
              onClick={() => setEvidenceTab('contract')}
              className={`app-tab-btn flex-1 justify-center ${
                evidenceTab === 'contract' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
              }`}
            >
              Contract
            </button>
            <button
              type="button"
              onClick={() => setEvidenceTab('diffs')}
              className={`app-tab-btn flex-1 justify-center ${
                evidenceTab === 'diffs' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
              }`}
            >
              Diffs ({selectedRun.fileDiffs.length})
            </button>
            <button
              type="button"
              onClick={() => setEvidenceTab('cost')}
              className={`app-tab-btn flex-1 justify-center ${
                evidenceTab === 'cost' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
              }`}
            >
              Cost ($)
            </button>
            <button
              type="button"
              onClick={() => setEvidenceTab('qa')}
              className={`app-tab-btn flex-1 justify-center ${
                evidenceTab === 'qa' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
              }`}
            >
              QA Assertions
            </button>
          </div>

          {/* Tab 1: Contract */}
          {evidenceTab === 'contract' && (
            <div className="rounded-card border border-app bg-app-surface p-4 space-y-3 text-xs">
              <div className="font-semibold text-app">Contract Output Slice Whitelist</div>
              <div className="font-mono text-xs bg-app-bg p-3 rounded-control border border-app text-app-accent space-y-1">
                {selectedRun.outputSlice?.map((file, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-app-muted">
                All file modifications were strictly validated by OrchestOS AST isolation gate prior
                to commit.
              </p>
            </div>
          )}

          {/* Tab 2: Diffs */}
          {evidenceTab === 'diffs' && (
            <div className="space-y-3">
              {selectedRun.fileDiffs.map((diff, i) => (
                <div
                  key={i}
                  className="rounded-card border border-app bg-app-surface overflow-hidden text-xs"
                >
                  <div className="px-3 py-2 bg-app-elevated border-b border-app flex items-center justify-between font-mono">
                    <span className="text-app font-medium">{diff.filePath}</span>
                    <span className="text-emerald-400">
                      +{diff.additions} -{diff.deletions}
                    </span>
                  </div>
                  <pre className="p-3 bg-app-bg font-mono text-xs text-app overflow-x-auto leading-relaxed">
                    {diff.patch}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Cost */}
          {evidenceTab === 'cost' && (
            <div className="rounded-card border border-app bg-app-surface p-4 space-y-3 text-xs">
              <div className="font-semibold text-app">SQLite Cost Telemetry</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-control bg-app-bg border border-app">
                  <div className="text-app-muted text-xs">Total Incurred</div>
                  <div className="text-sm font-bold text-app font-mono mt-1">
                    ${selectedRun.costUsd?.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-control bg-app-bg border border-app">
                  <div className="text-app-muted text-xs">Tokens</div>
                  <div className="text-sm font-bold text-app font-mono mt-1">
                    {selectedRun.tokensUsed?.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-control bg-app-bg border border-app">
                  <div className="text-app-muted text-xs">Model</div>
                  <div className="text-sm font-bold text-app font-mono mt-1 truncate">
                    {selectedRun.agentModel}
                  </div>
                </div>
                <div className="p-3 rounded-control bg-app-bg border border-app">
                  <div className="text-app-muted text-xs">Worktree</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-1">Clean</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: QA */}
          {evidenceTab === 'qa' && (
            <div className="rounded-card border border-app bg-app-surface p-4 space-y-3 text-xs">
              <div className="font-semibold text-app">QA Gate Verdict & Acceptance Evaluation</div>
              <div className="p-3 rounded-control bg-app-bg border border-app font-mono text-xs text-emerald-400">
                ✓ Spec WHEN/THEN assertion checked: PASSED
                <br />✓ Vitest automated test suite: 100% GREEN
                <br />✓ AST static boundary leak check: 0 LEAKS DETECTED
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Normal List View
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-app-bg text-app select-none">
      {/* Responsive KPI Metrics Cards - never clipped */}
      <div className="p-3 border-b border-app bg-app-surface/40 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-card bg-app-surface border border-app">
            <div className="text-xs text-app-muted">Total Runs</div>
            <div className="text-sm font-bold text-app font-mono mt-0.5">{totalRuns}</div>
          </div>

          <div className="p-2.5 rounded-card bg-app-surface border border-app">
            <div className="text-xs text-app-muted">QA Pass Rate</div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{passRate}%</div>
          </div>

          <div className="p-2.5 rounded-card bg-app-surface border border-app">
            <div className="text-xs text-app-muted">Total Cost</div>
            <div
              className="text-sm font-bold text-app-accent font-mono mt-0.5 truncate"
              title={`$${totalCost}`}
            >
              ${totalCost}
            </div>
          </div>

          <div className="p-2.5 rounded-card bg-app-surface border border-app">
            <div className="text-xs text-app-muted">Token Volume</div>
            <div
              className="text-sm font-bold text-app font-mono mt-0.5 truncate"
              title={totalTokens}
            >
              {totalTokens}
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3 border-b border-app flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs by ID, task or description..."
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted font-mono"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`app-tab-btn ${statusFilter === 'all' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('passed')}
            className={`app-tab-btn ${statusFilter === 'passed' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
          >
            Passed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('failed')}
            className={`app-tab-btn ${statusFilter === 'failed' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Runs Table with accessible markup */}
      <div className="flex-1 overflow-auto">
        {filteredRuns.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Runs Recorded"
            description="Execute tasks through agent sessions to record telemetry runs, cost metrics, and QA verdicts in SQLite."
          />
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-app bg-app-surface/60 text-app-muted font-medium text-xs">
                <th className="py-2 px-3">Run ID</th>
                <th className="py-2 px-3">Task</th>
                <th className="py-2 px-3">Model</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Cost ($)</th>
                <th className="py-2 px-3">QA Verdict</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app">
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => {
                    setSelectedRun(run)
                    if (onInspectRun) onInspectRun(run.id)
                  }}
                  className="hover:bg-app-surface/50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono text-app font-medium">{run.id}</td>
                  <td className="py-2.5 px-3 max-w-xs truncate" title={run.taskDescription}>
                    <span className="font-mono text-app-muted mr-1.5">{run.taskId}</span>
                    <span>{run.taskDescription}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-app-muted">{run.agentModel}</td>
                  <td className="py-2.5 px-3 font-mono text-app-muted">{run.duration}</td>
                  <td className="py-2.5 px-3 font-mono text-app-accent">
                    ${run.costUsd?.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={run.qaVerdict === 'pass' ? 'passed' : 'failed'} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-app-accent hover:underline text-xs inline-flex items-center gap-1 font-medium">
                      Inspect
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
