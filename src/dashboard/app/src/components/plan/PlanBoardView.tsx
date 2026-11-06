import {
  Check,
  FileCode,
  FileText,
  Filter,
  HelpCircle,
  Kanban,
  List,
  Play,
  Repeat,
  Search,
  Shield,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getPlanDoc, type PlanDocResponse } from '../../api/planDoc'
import type { TaskItem, TaskStatus } from '../../types/orchestos'
import { SettingsPrimaryAction } from '../settings/primitives'

interface PlanBoardViewProps {
  tasks: TaskItem[]
  projectId: string
  onRunTask: (taskId: string) => void
  onExplainTask: (taskId: string) => void | Promise<Record<string, unknown> | void>
}

function TaskQaBadge({ task }: { task: TaskItem }) {
  if (task.status === 'done' && !task.runId)
    return <span className="text-app-warning">Sin verificar</span>
  if (task.qaVerdict === 'skipped') return <span className="text-app-muted">Sin QA</span>
  if (task.qaVerdict === 'pass') return <span className="text-app-success">QA pass</span>
  if (task.qaVerdict === 'fail') return <span className="text-app-error">QA fail</span>
  return <span className="text-app-muted">—</span>
}

function formatExplainValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map((item) => formatExplainValue(item)).join(', ')
  }
  if (typeof value === 'object') {
    const fields = Object.entries(value)
      .map(([field, fieldValue]) => `${field}: ${formatExplainValue(fieldValue, field)}`)
      .join(', ')
    return fields || '—'
  }
  return String(value)
}

export const PlanBoardView: React.FC<PlanBoardViewProps> = ({
  tasks,
  projectId,
  onRunTask,
  onExplainTask,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'plan-doc'>('kanban')
  const [planDoc, setPlanDoc] = useState<PlanDocResponse | null>(null)
  const [planDocLoading, setPlanDocLoading] = useState(false)
  const [planDocError, setPlanDocError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSprint, setSelectedSprint] = useState<string>('all')
  const [explainModalTask, setExplainModalTask] = useState<TaskItem | null>(null)
  const [explainResult, setExplainResult] = useState<Record<string, unknown> | null>(null)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)

  useEffect(() => {
    if (viewMode !== 'plan-doc') return
    let disposed = false
    setPlanDocLoading(true)
    setPlanDocError(null)
    getPlanDoc(projectId)
      .then((result) => {
        if (!disposed) setPlanDoc(result)
      })
      .catch((error: unknown) => {
        if (!disposed) setPlanDocError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (!disposed) setPlanDocLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [projectId, viewMode])

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.output.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesSprint = selectedSprint === 'all' || t.sprint === selectedSprint
    return matchesSearch && matchesSprint
  })

  const columns: { id: TaskStatus; title: string; dot: string }[] = [
    { id: 'pending', title: 'Pending / Backlog', dot: 'bg-app-muted' },
    { id: 'running', title: 'Sandboxed Running', dot: 'bg-app-accent' },
    { id: 'blocked', title: 'Blocked by DAG', dot: 'bg-app-warning' },
    { id: 'done', title: 'Verified & Done', dot: 'bg-app-success' },
    { id: 'failed_permanent', title: 'Failed Permanent (3x)', dot: 'bg-app-error' },
  ]

  const statusDot: Record<string, string> = {
    pending: 'bg-app-muted',
    running: 'bg-app-accent',
    blocked: 'bg-app-warning',
    done: 'bg-app-success',
    failed_permanent: 'bg-app-error',
  }

  const modeButton = (mode: 'kanban' | 'table' | 'plan-doc') =>
    `inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-medium transition-colors ${
      viewMode === mode ? 'bg-app-elevated text-app' : 'text-app-muted hover:text-app'
    }`

  const lineClass = 'border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]'

  return (
    <div data-plan-view className="flex min-h-full flex-1 flex-col overflow-hidden select-none">
      {/* Top Bar with View Mode Toggle and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-0.5 rounded-control bg-app-bg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={modeButton('kanban')}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('plan-doc')}
              className={modeButton('plan-doc')}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PLAN.md</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={modeButton('table')}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks or output files..."
              className="h-7 w-48 rounded-control bg-app-elevated pl-8 pr-3 text-xs text-app placeholder:text-app-muted focus:outline-none sm:w-64"
            />
          </div>

          {/* Sprint select */}
          <select
            value={selectedSprint}
            onChange={(e) => setSelectedSprint(e.target.value)}
            className="h-7 rounded-control bg-app-elevated px-2.5 text-xs text-app focus:outline-none"
          >
            <option value="all">All Sprints</option>
            <option value="Sprint 30">Sprint 30 (Active)</option>
            <option value="Sprint 31">Sprint 31</option>
            <option value="Sprint 29">Sprint 29</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-xs text-app-muted sm:block">{filteredTasks.length} tasks</div>
        </div>
      </div>

      {/* Main Board Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-6 pb-4">
        {viewMode === 'plan-doc' ? (
          <div className="mx-auto w-full max-w-4xl space-y-4 pb-4">
            {planDocLoading ? (
              <div className="text-sm text-app-muted">Loading PLAN.md…</div>
            ) : planDocError ? (
              <div className="text-sm text-app-error">{planDocError}</div>
            ) : !planDoc?.exists ? (
              <div className="text-sm text-app-muted">No PLAN.md in this project</div>
            ) : (
              planDoc.sections.map((section) => (
                <section
                  key={`${section.level}-${section.title}`}
                  className="rounded-card bg-app-elevated p-4 space-y-3"
                >
                  <h2 className="text-sm font-semibold text-app">{section.title}</h2>
                  {section.text && (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-app-muted">
                      {section.text}
                    </p>
                  )}
                  {section.items.length > 0 && (
                    <div className="space-y-2">
                      {section.items.map((item, index) => (
                        <label
                          key={`${item.text}-${index}`}
                          className="flex items-start gap-2 text-xs text-app"
                          style={{ marginLeft: `${item.depth * 1.25}rem` }}
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            disabled
                            readOnly
                            className="mt-0.5 accent-[color:var(--app-accent)]"
                          />
                          <span>{item.text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-4 min-w-max pb-4">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              return (
                <div key={col.id} className="w-80 flex-shrink-0 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} />
                    <span className="text-[12.5px] font-semibold text-app">{col.title}</span>
                    <span className="text-[11px] tabular-nums text-app-muted">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto flex-1 max-h-[calc(100vh-220px)] pr-1">
                    {colTasks.length === 0 ? (
                      <div className="px-1 py-2 text-xs text-app-muted">No tasks in this lane</div>
                    ) : (
                      colTasks.map((task) => (
                        <div key={task.id} className="p-3 rounded-card bg-app-elevated space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              title={task.id}
                              className="min-w-0 truncate font-mono text-[11px] text-app-muted"
                            >
                              {task.id}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                              {(task.qaVerdict || (task.status === 'done' && !task.runId)) && (
                                <TaskQaBadge task={task} />
                              )}
                              <span className="text-app-muted">{task.engine}</span>
                            </div>
                          </div>

                          <p className="line-clamp-3 text-[13px] text-app">{task.description}</p>

                          {/* Declared Output Contract Files */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[11px] text-app-muted">
                              <Shield className="w-3 h-3" />
                              Contract output[{task.output.length}]
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {task.output.map((f, i) => (
                                <span
                                  key={i}
                                  className="flex items-center gap-1 font-mono text-[11px] text-app-muted"
                                >
                                  <FileCode className="w-2.5 h-2.5" />
                                  {f.split('/').pop()}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Dependencies & Retries */}
                          {task.depends_on.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-app-muted">
                              <span>Depends:</span>
                              {task.depends_on.map((dep) => (
                                <span key={dep} className="font-mono">
                                  {dep}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-[11px] text-app-muted">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>Retries: {task.retryCount}</span>
                              {task.costUsd && (
                                <span className="ml-1 tabular-nums">
                                  ${task.costUsd.toFixed(3)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="compact"
                                onClick={() => setExplainModalTask(task)}
                                title="Explain dry-run execution plan"
                              >
                                Plan
                              </Button>
                              {task.status !== 'done' && (
                                <SettingsPrimaryAction>
                                  <Button
                                    size="compact"
                                    leadingIcon={Play}
                                    onClick={() => onRunTask(task.id)}
                                  >
                                    Run
                                  </Button>
                                </SettingsPrimaryAction>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table List View */
          <div className="overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`h-10 border-b ${lineClass} text-[11px] font-medium text-app-muted`}>
                  <th className="px-3 font-medium whitespace-nowrap">Task ID</th>
                  <th className="px-3 font-medium whitespace-nowrap">Description</th>
                  <th className="px-3 font-medium whitespace-nowrap">Status</th>
                  <th className="px-3 font-medium whitespace-nowrap">Output Contract</th>
                  <th className="px-3 font-medium whitespace-nowrap">QA Verdict</th>
                  <th className="px-3 font-medium whitespace-nowrap">Cost</th>
                  <th className="px-3 text-right font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    className={`h-10 whitespace-nowrap border-b ${lineClass} hover:bg-app-elevated`}
                  >
                    <td className="max-w-[10rem] px-3">
                      <div title={t.id} className="truncate font-mono text-[11px] text-app-muted">
                        {t.id}
                      </div>
                    </td>
                    <td className="max-w-md px-3">
                      <div title={t.description} className="truncate text-[13px] text-app">
                        {t.description}
                      </div>
                      {t.depends_on.length > 0 && (
                        <div className="truncate text-[11px] text-app-muted">
                          Depends on: {t.depends_on.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-app-muted">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusDot[t.status] ?? 'bg-app-muted'}`}
                        />
                        {t.status}
                      </span>
                    </td>
                    <td className="max-w-xs px-3">
                      <div className="truncate font-mono text-[11px] text-app-muted">
                        {t.output.map((f) => f.split('/').pop()).join(', ')}
                      </div>
                    </td>
                    <td className="px-3">
                      <TaskQaBadge task={t} />
                    </td>
                    <td className="px-3 tabular-nums text-app-muted">
                      {t.costUsd ? `$${t.costUsd.toFixed(3)}` : '—'}
                    </td>
                    <td className="px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="compact"
                          onClick={async () => {
                            setExplainModalTask(t)
                            setExplainResult(null)
                            setExplainError(null)
                            setExplaining(true)
                            try {
                              const result = await onExplainTask(t.id)
                              setExplainResult(result && typeof result === 'object' ? result : null)
                            } catch (error) {
                              setExplainError(
                                error instanceof Error ? error.message : String(error),
                              )
                            } finally {
                              setExplaining(false)
                            }
                          }}
                        >
                          Dry-Run
                        </Button>
                        {t.status !== 'done' && (
                          <SettingsPrimaryAction>
                            <Button size="compact" onClick={() => onRunTask(t.id)}>
                              Run
                            </Button>
                          </SettingsPrimaryAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dry-Run Explain Modal */}
      {explainModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl bg-app-surface border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] rounded-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-app-muted" />
                <h3 className="font-bold text-sm text-app">
                  Dry-Run Execution Plan: {explainModalTask.id}
                </h3>
              </div>
              <button
                onClick={() => setExplainModalTask(null)}
                className="text-app-muted hover:text-app p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-card bg-app-elevated space-y-2">
                <div className="font-semibold text-app">Declared Contract Whitelist:</div>
                <div className="space-y-1 font-mono text-[11px] text-app-muted">
                  {explainModalTask.output.map((f) => (
                    <div key={f} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-app-success" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-app">Planned Acceptance Criteria:</div>
                <ul className="list-disc list-inside text-app-muted space-y-1">
                  {explainModalTask.acceptance_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-card bg-app-elevated text-app-muted text-[11px]">
                {explaining ? (
                  'Loading explain result…'
                ) : explainError ? (
                  `Explain failed: ${explainError}`
                ) : explainResult ? (
                  <div className="space-y-1.5">
                    <div className="font-semibold text-app">Dry-Run Verification</div>
                    <div>0 tokens spent</div>
                    {Object.entries(explainResult).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-semibold text-app">
                          {key === 'id'
                            ? 'Task ID'
                            : key
                                .replace(/[A-Z]/g, (letter) => ` ${letter}`)
                                .replace(/^./, (letter) => letter.toUpperCase())}
                          :
                        </span>{' '}
                        <span>{formatExplainValue(value, key)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  'No explain result returned.'
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]">
              <Button variant="ghost" size="compact" onClick={() => setExplainModalTask(null)}>
                Close
              </Button>
              <SettingsPrimaryAction>
                <Button
                  size="compact"
                  onClick={() => {
                    const id = explainModalTask.id
                    setExplainModalTask(null)
                    onRunTask(id)
                  }}
                >
                  Execute Task in Sandbox
                </Button>
              </SettingsPrimaryAction>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
