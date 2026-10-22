import { Activity, AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Search } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { RunItem } from '../../types/orchestos'
import { StatusBadge } from '../common/StatusBadge'
import { EmptyState, ErrorState, SkeletonView } from '../common/ViewStateFeedback'
import { StatStrip } from '../layout/page'
import { SettingsSegmented } from '../settings/primitives'

interface RunsEvidenceViewProps {
  runs: RunItem[]
  onInspectRun?: (runId: string) => void
  onFilterStatus?: (status: string) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

function RunQaBadge({ run }: { run: RunItem }) {
  if (run.qaVerdict === 'skipped') {
    const count = run.deterministicChecks.length
    return count > 0 ? (
      <span className="text-app-muted">Sin QA · {count} checks</span>
    ) : (
      <span className="text-app-warning">Sin verificar</span>
    )
  }
  return (
    <StatusBadge
      status={run.qaVerdict === null ? 'idle' : run.qaVerdict === 'pass' ? 'passed' : 'failed'}
      label={run.qaVerdict === null ? '—' : `QA ${run.qaVerdict}`}
    />
  )
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
  const evaluatedRuns = runs.filter((r) => r.qaVerdict === 'pass' || r.qaVerdict === 'fail')
  const passedRuns = evaluatedRuns.filter((r) => r.qaVerdict === 'pass').length
  const passRate =
    evaluatedRuns.length > 0 ? `${((passedRuns / evaluatedRuns.length) * 100).toFixed(1)}%` : '—'
  const passRatio = evaluatedRuns.length > 0 ? passedRuns / evaluatedRuns.length : 0
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
      (statusFilter === 'failed' && run.qaVerdict === 'fail')
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
            <RunQaBadge run={selectedRun} />
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
              {(selectedRun.failureReason || selectedRun.executorReply) && (
                <div className="space-y-2">
                  {selectedRun.failureReason && (
                    <div className="text-amber-300">{selectedRun.failureReason}</div>
                  )}
                  {selectedRun.executorReply && (
                    <>
                      <div className="font-semibold text-app">
                        Lo que reporta el ejecutor (no verificado)
                      </div>
                      <pre className="p-3 bg-app-bg font-mono text-xs text-app overflow-x-auto leading-relaxed">
                        {selectedRun.executorReply}
                      </pre>
                    </>
                  )}
                </div>
              )}
              <div className="font-semibold text-app">Contract Output Slice Whitelist</div>
              <div className="font-mono text-xs bg-app-bg p-3 rounded-control border border-app text-app-accent space-y-1">
                {(selectedRun.outputSlice || []).map((file) => (
                  <div key={file} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{file}</span>
                  </div>
                ))}
                {selectedRun.filesBlocked.map((file) => (
                  <div key={file} className="flex items-center gap-2 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Blocked: {file}</span>
                  </div>
                ))}
                {selectedRun.outputSlice?.length === 0 && selectedRun.filesBlocked.length === 0 && (
                  <div className="text-app-muted">No contract outputs recorded</div>
                )}
              </div>
              <p className="text-xs text-app-muted">
                {selectedRun.filesAuthorized.length} authorized · {selectedRun.filesBlocked.length}{' '}
                blocked
              </p>
            </div>
          )}

          {/* Tab 2: Diffs */}
          {evidenceTab === 'diffs' && (
            <div className="space-y-3">
              {selectedRun.fileDiffs.length === 0 ? (
                <div className="rounded-card border border-app bg-app-surface p-4 text-xs text-app-muted">
                  No diffs recorded
                </div>
              ) : (
                selectedRun.fileDiffs.map((diff) => (
                  <div
                    key={diff.filePath || diff.path}
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
                ))
              )}
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
                  <div className="text-app-muted text-xs">Status</div>
                  <div className="text-sm font-bold text-app font-mono mt-1">
                    {selectedRun.status}
                  </div>
                </div>
              </div>
              {selectedRun.costBreakdown?.length > 0 && (
                <div className="space-y-2">
                  {selectedRun.costBreakdown.map((entry, index) => (
                    <div
                      key={`${entry.label}-${index}`}
                      data-testid="cost-breakdown-row"
                      className="p-3 rounded-control bg-app-bg border border-app flex flex-wrap items-center gap-3 font-mono"
                    >
                      <span className="text-app">
                        {entry.label === 'reviewer' ? 'Reviewer' : entry.label}
                      </span>
                      <span className="text-app-muted">{entry.model}</span>
                      <span className="text-app-muted">
                        {(entry.inputTokens + entry.outputTokens).toLocaleString()}
                      </span>
                      <span className="text-app">
                        {entry.label === 'reviewer' && entry.source === 'unknown'
                          ? '—'
                          : `$${entry.costUsd.toFixed(4)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: QA */}
          {evidenceTab === 'qa' && (
            <div className="rounded-card border border-app bg-app-surface p-4 space-y-3 text-xs">
              {selectedRun.deterministicChecks.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-app">Medido</div>
                  <div className="p-3 rounded-control bg-app-bg border border-app font-mono text-xs space-y-1">
                    {selectedRun.deterministicChecks.map((check) => (
                      <div
                        key={`${check.command}-${check.exitCode}`}
                        className={check.passed ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        {check.passed ? '✓' : '✗'} {check.command} (exit {check.exitCode})
                        {!check.passed && check.output && (
                          <pre className="p-3 bg-app-bg font-mono text-xs text-app overflow-x-auto leading-relaxed">
                            {check.output}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedRun.qaEvaluation
                .filter((item) => item.kind === 'skipped')
                .map((item) => (
                  <div key={item.criterion} className="text-app-muted">
                    {item.criterion}: {item.rationale}
                  </div>
                ))}
              {selectedRun.qaModel && selectedRun.qaVerdict !== 'skipped' && (
                <div className="space-y-2">
                  <div className="font-semibold text-app">
                    Opinión del juez ({selectedRun.qaModel})
                  </div>
                  <div className="p-3 rounded-control bg-app-bg border border-app font-mono text-xs space-y-1">
                    {selectedRun.qaEvaluation
                      .filter((item) => item.kind !== 'skipped')
                      .map((item) => (
                        <div
                          key={item.criterion}
                          className={item.passed ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          {item.passed ? '✓' : '✗'} {item.criterion}: {item.rationale}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {selectedRun.deterministicChecks.length === 0 &&
                (!selectedRun.qaModel || selectedRun.qaVerdict === 'skipped') && (
                  <div className="text-app-warning">Nada verificó este run</div>
                )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Normal List View
  return (
    <div className="flex-1 flex flex-col overflow-hidden text-app select-none px-6">
      <div className="flex-shrink-0 pt-4">
        <StatStrip
          items={[
            { label: 'Total Runs', value: totalRuns },
            {
              label: 'QA Pass Rate',
              value: passRate,
              hint:
                evaluatedRuns.length > 0
                  ? `${passedRuns}/${evaluatedRuns.length} evaluated`
                  : undefined,
              tone:
                evaluatedRuns.length === 0
                  ? undefined
                  : passRatio >= 0.8
                    ? 'success'
                    : passRatio < 0.5
                      ? 'error'
                      : undefined,
            },
            { label: 'Total Cost', value: `$${totalCost}` },
            { label: 'Token Volume', value: totalTokens },
          ]}
        />
      </div>

      {/* Filter / Search Bar */}
      <div className="py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-[7px]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs by ID, task or description..."
            className="w-full h-7 pl-8 pr-2.5 text-xs bg-app-elevated rounded-control focus:outline-hidden text-app placeholder:text-app-muted"
          />
        </div>

        <SettingsSegmented<'all' | 'passed' | 'failed'>
          ariaLabel="Run status filter"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'passed', label: 'Passed' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
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
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="text-app-muted font-medium text-xs">
                <th className="h-10 px-3 font-medium whitespace-nowrap">Run ID</th>
                <th className="h-10 px-3 font-medium whitespace-nowrap">Task</th>
                <th className="h-10 px-3 font-medium whitespace-nowrap">Model</th>
                <th className="h-10 px-3 font-medium whitespace-nowrap">Duration</th>
                <th className="h-10 px-3 font-medium whitespace-nowrap">Cost ($)</th>
                <th className="h-10 px-3 font-medium whitespace-nowrap">QA Verdict</th>
                <th className="h-10 px-3 font-medium text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => {
                    setSelectedRun(run)
                    if (onInspectRun) onInspectRun(run.id)
                  }}
                  className="group h-10 border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] hover:bg-app-elevated cursor-pointer transition-colors"
                >
                  <td
                    className="px-3 max-w-[10rem] truncate whitespace-nowrap font-mono text-app font-medium"
                    title={run.id}
                  >
                    {run.id}
                  </td>
                  <td
                    className="px-3 max-w-xs truncate whitespace-nowrap"
                    title={run.taskDescription}
                  >
                    <span className="font-mono text-app-muted mr-1.5">{run.taskId}</span>
                    <span>{run.taskDescription}</span>
                  </td>
                  <td className="px-3 font-mono text-app-muted whitespace-nowrap">
                    {run.agentModel}
                  </td>
                  <td className="px-3 tabular-nums text-app-muted whitespace-nowrap">
                    {run.duration}
                  </td>
                  <td className="px-3 tabular-nums text-app-muted whitespace-nowrap">
                    ${run.costUsd?.toFixed(4)}
                  </td>
                  <td className="px-3 whitespace-nowrap">
                    <RunQaBadge run={run} />
                  </td>
                  <td className="px-3 text-right whitespace-nowrap">
                    <span className="text-app-muted group-hover:text-app text-xs inline-flex items-center gap-1 font-medium">
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
