import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  FileCode,
  Sparkles,
  Plus,
  Search,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { SpecItem } from '../../types/orchestos';

interface SpecsViewProps {
  specs: SpecItem[];
  onApproveSpec: (specId: string) => void;
  onDraftSpec: (taskId: string) => void;
  onLintSpec: (specId: string) => void;
}

export const SpecsView: React.FC<SpecsViewProps> = ({
  specs,
  onApproveSpec,
  onDraftSpec,
  onLintSpec,
}) => {
  const [selectedSpec, setSelectedSpec] = useState<SpecItem>(specs[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSpecs = specs.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.taskId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950 select-none">
      {/* Left List */}
      <div className="w-80 border-r border-zinc-800/80 bg-zinc-950/70 flex flex-col flex-shrink-0">
        <div className="p-3.5 border-b border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-xs text-zinc-100 tracking-wide uppercase">
                Spec-Driven Gates
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              requireSpec: true
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search specs or tasks..."
              className="w-full pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredSpecs.map((spec) => {
            const isSelected = spec.id === selectedSpec.id;
            return (
              <button
                key={spec.id}
                onClick={() => setSelectedSpec(spec)}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'bg-zinc-900 border-blue-500/50 shadow-md shadow-blue-950/20'
                    : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] font-semibold text-blue-400">
                    {spec.id}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      spec.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : spec.status === 'draft'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {spec.status}
                  </span>
                </div>

                <div className="text-xs font-medium text-zinc-200 line-clamp-1 mb-1.5">
                  {spec.title}
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Task: {spec.taskId}</span>
                  <span
                    className={
                      spec.lintStatus === 'pass'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }
                  >
                    Lint: {spec.lintStatus} ({spec.lintFindings})
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content / Spec Detail */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {/* Spec Top Header */}
        <div className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {selectedSpec.title}
              </h2>
              <div className="text-[11px] text-zinc-400 font-mono">
                .orchestos/specs/{selectedSpec.id}.md · Task: {selectedSpec.taskId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onLintSpec(selectedSpec.id)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition-colors"
            >
              Lint WHEN/THEN
            </button>
            {selectedSpec.status !== 'approved' && (
              <button
                onClick={() => onApproveSpec(selectedSpec.id)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                Approve Gate
              </button>
            )}
          </div>
        </div>

        {/* Spec Clauses & Acceptance Criteria */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
          {/* Status Ribbon */}
          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-zinc-300">Gate Condition:</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                  selectedSpec.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {selectedSpec.status === 'approved' ? 'UNLOCKED' : 'LOCKED (AWAITING APPROVAL)'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
              <span>Lint Findings: {selectedSpec.lintFindings}</span>
              <span>Delta Header Issues: {selectedSpec.deltaIssues}</span>
            </div>
          </div>

          {/* Criteria Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-wider">
              WHEN / THEN Acceptance Contract Assertions
            </h3>

            {selectedSpec.criteria.map((c, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-blue-400 uppercase text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 mt-0.5">
                    WHEN
                  </span>
                  <p className="text-zinc-200 flex-1">{c.when}</p>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-zinc-800/60">
                  <span className="font-mono font-bold text-emerald-400 uppercase text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 mt-0.5">
                    THEN
                  </span>
                  <p className="text-zinc-300 flex-1">{c.then}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Spec CLI snippet */}
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 space-y-1">
            <div className="text-zinc-500"># CLI equivalents:</div>
            <div>$ orchestos spec show {selectedSpec.taskId}</div>
            <div>$ orchestos spec approve {selectedSpec.taskId}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
