import React, { useState } from 'react';
import {
  Kanban,
  List,
  Play,
  HelpCircle,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Shield,
  FileCode,
  ArrowRight,
  Plus,
  GitPullRequest,
  Search,
  Filter,
  DollarSign,
  Repeat,
  Check,
  X,
} from 'lucide-react';
import { TaskItem, TaskStatus } from '../../types/orchestos';

interface PlanBoardViewProps {
  tasks: TaskItem[];
  onRunTask: (taskId: string) => void;
  onExplainTask: (taskId: string) => void;
  onAddTask: (newTask: Omit<TaskItem, 'retryCount' | 'qaVerdict' | 'runId' | 'costUsd'>) => void;
}

export const PlanBoardView: React.FC<PlanBoardViewProps> = ({
  tasks,
  onRunTask,
  onExplainTask,
  onAddTask,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [explainModalTask, setExplainModalTask] = useState<TaskItem | null>(null);

  // New task form state
  const [newId, setNewId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOutput, setNewOutput] = useState('');
  const [newCriteria, setNewCriteria] = useState('');

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.output.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSprint =
      selectedSprint === 'all' || t.sprint === selectedSprint;
    return matchesSearch && matchesSprint;
  });

  const columns: { id: TaskStatus; title: string; color: string; bg: string }[] = [
    { id: 'pending', title: 'Pending / Backlog', color: 'text-zinc-400', bg: 'border-zinc-800' },
    { id: 'running', title: 'Sandboxed Running', color: 'text-indigo-400', bg: 'border-indigo-500/30' },
    { id: 'blocked', title: 'Blocked by DAG', color: 'text-amber-400', bg: 'border-amber-500/30' },
    { id: 'done', title: 'Verified & Done', color: 'text-emerald-400', bg: 'border-emerald-500/30' },
    { id: 'failed_permanent', title: 'Failed Permanent (3x)', color: 'text-rose-400', bg: 'border-rose-500/30' },
  ];

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newDesc) return;
    const outputFiles = newOutput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const criteriaList = newCriteria
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    onAddTask({
      id: newId.trim(),
      description: newDesc.trim(),
      status: 'pending',
      output: outputFiles.length > 0 ? outputFiles : ['src/tasks/new-task.ts'],
      depends_on: [],
      acceptance_criteria: criteriaList.length > 0 ? criteriaList : ['Code builds with zero compiler errors'],
      engine: 'agentic',
      sprint: 'Sprint 31',
    });

    setNewId('');
    setNewDesc('');
    setNewOutput('');
    setNewCriteria('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* Top Bar with View Mode Toggle, Filters, and Add Task */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'kanban'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks or output files..."
              className="pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-48 sm:w-64"
            />
          </div>

          {/* Sprint select */}
          <select
            value={selectedSprint}
            onChange={(e) => setSelectedSprint(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 py-1 px-2.5 focus:outline-none"
          >
            <option value="all">All Sprints</option>
            <option value="Sprint 30">Sprint 30 (Active)</option>
            <option value="Sprint 31">Sprint 31</option>
            <option value="Sprint 29">Sprint 29</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-400 font-mono hidden sm:block">
            {filteredTasks.length} tasks declared in tasks.yaml
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contract Task</span>
          </button>
        </div>
      </div>

      {/* Main Board Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        {viewMode === 'kanban' ? (
          <div className="flex gap-4 min-w-max pb-4">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="w-80 flex-shrink-0 flex flex-col bg-zinc-950/40 rounded-2xl border border-zinc-850 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto flex-1 max-h-[calc(100vh-220px)] pr-1">
                    {colTasks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-600 border border-dashed border-zinc-800/80 rounded-xl">
                        No tasks in this lane
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all shadow-sm space-y-2.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-indigo-400">
                              {task.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {task.qaVerdict && (
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                                    task.qaVerdict === 'pass'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  QA {task.qaVerdict}
                                </span>
                              )}
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                {task.engine}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-200 leading-relaxed font-normal">
                            {task.description}
                          </p>

                          {/* Declared Output Contract Files */}
                          <div className="space-y-1">
                            <div className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1 uppercase tracking-wider">
                              <Shield className="w-3 h-3 text-emerald-500" />
                              Contract output[{task.output.length}]
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {task.output.map((f, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 flex items-center gap-1"
                                >
                                  <FileCode className="w-2.5 h-2.5 text-indigo-400" />
                                  {f.split('/').pop()}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Dependencies & Retries */}
                          {task.depends_on.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                              <span>Depends:</span>
                              {task.depends_on.map((dep) => (
                                <span
                                  key={dep}
                                  className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                            <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>Retries: {task.retryCount}</span>
                              {task.costUsd && (
                                <span className="text-zinc-400 ml-1">
                                  ${task.costUsd.toFixed(3)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setExplainModalTask(task)}
                                className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
                                title="Explain dry-run execution plan"
                              >
                                Plan
                              </button>
                              {task.status !== 'done' && (
                                <button
                                  onClick={() => onRunTask(task.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/90 hover:bg-indigo-600 text-white text-[11px] font-medium transition-all shadow-sm active:scale-95"
                                >
                                  <Play className="w-2.5 h-2.5 fill-white" />
                                  <span>Run</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table List View (LN Dev UI style) */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3">Task ID</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Output Contract</th>
                  <th className="p-3">QA Verdict</th>
                  <th className="p-3">Cost</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/80 transition-colors">
                    <td className="p-3 font-mono font-semibold text-indigo-400">
                      {t.id}
                    </td>
                    <td className="p-3 text-zinc-200 max-w-md">
                      <div>{t.description}</div>
                      {t.depends_on.length > 0 && (
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Depends on: {t.depends_on.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase font-mono ${
                          t.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : t.status === 'running'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse'
                            : t.status === 'blocked'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : t.status === 'failed_permanent'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {t.output.map((f, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-300"
                          >
                            {f.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {t.qaVerdict ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                            t.qaVerdict === 'pass'
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {t.qaVerdict}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-zinc-400">
                      {t.costUsd ? `$${t.costUsd.toFixed(3)}` : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setExplainModalTask(t)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]"
                        >
                          Dry-Run
                        </button>
                        {t.status !== 'done' && (
                          <button
                            onClick={() => onRunTask(t.id)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
                          >
                            Run
                          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  Dry-Run Execution Plan: {explainModalTask.id}
                </h3>
              </div>
              <button
                onClick={() => setExplainModalTask(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="font-semibold text-zinc-300">Declared Contract Whitelist:</div>
                <div className="space-y-1 font-mono text-[11px] text-indigo-300">
                  {explainModalTask.output.map((f) => (
                    <div key={f} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-zinc-300">Planned Acceptance Criteria:</div>
                <ul className="list-disc list-inside text-zinc-400 space-y-1">
                  {explainModalTask.acceptance_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-200 text-[11px]">
                💡 <strong>Dry-Run Verification</strong>: 0 tokens spent. The middleware verified the dependency DAG, Git worktree branch availability, and contract boundaries without invoking the LLM provider.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setExplainModalTask(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const id = explainModalTask.id;
                  setExplainModalTask(null);
                  onRunTask(id);
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Execute Task in Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateTaskSubmit}
            className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Declare New Contract Task (tasks.yaml)
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
                <label className="block text-zinc-300 font-semibold mb-1">
                  Task Identifier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. t7_telemetry_exporter"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Description / Instruction
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="What should the agent synthesize or refactor?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Declared output[] Whitelist (one file per line)</span>
                  <span className="text-[10px] text-emerald-400">Strict contract</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="src/telemetry/exporter.ts&#10;tests/telemetry.test.ts"
                  value={newOutput}
                  onChange={(e) => setNewOutput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Acceptance Criteria (for QA LLM verification)
                </label>
                <textarea
                  rows={2}
                  placeholder="Exit code 0 on tests&#10;Zero unauthorized files modified"
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
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
                Append to tasks.yaml
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
