import { FileText, Search } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { SettingsPrimaryAction } from '@/components/settings/primitives'
import { Button } from '@/components/ui/button'
import type { SpecItem } from '../../types/orchestos'
import { EmptyState } from '../common/ViewStateFeedback'

interface SpecsViewProps {
  specs: SpecItem[]
  onApproveSpec: (specId: string) => void
  onDraftSpec: (taskId: string) => void
  onLintSpec: (specId: string) => void
}

const LINE = 'border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]'

const statusDot = (status: SpecItem['status']) =>
  status === 'approved' ? 'bg-app-success' : status === 'draft' ? 'bg-app-warning' : 'bg-app-muted'

export const SpecsView: React.FC<SpecsViewProps> = ({
  specs,
  onApproveSpec,
  onDraftSpec,
  onLintSpec,
}) => {
  const [selectedId, setSelectedId] = useState<string | undefined>(specs[0]?.id)
  const selectedSpec = specs.find((s) => s.id === selectedId) ?? specs[0]
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSpecs = specs.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.taskId.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div data-view="specs" className="flex min-h-full flex-1 overflow-hidden select-none">
      {/* Left List */}
      <div className={`flex w-80 shrink-0 flex-col border-r ${LINE}`}>
        <div className="space-y-2.5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-app">Spec-Driven Gates</span>
            <span className="font-mono text-[11px] text-app-muted">requireSpec: true</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search specs or tasks..."
              className="h-7 w-full rounded-control bg-app-elevated pl-8 pr-3 text-xs text-app placeholder:text-app-muted focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSpecs.map((spec) => {
            const isSelected = spec.id === selectedSpec?.id
            return (
              <button
                type="button"
                key={spec.id}
                onClick={() => setSelectedId(spec.id)}
                className={`block w-full border-b px-3.5 py-2.5 text-left transition-colors hover:bg-app-elevated ${LINE} ${
                  isSelected ? 'bg-app-elevated' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(spec.status)}`}
                    title={spec.status}
                  />
                  <span className="font-mono text-[11px] text-app-muted">{spec.id}</span>
                </div>

                <div className="mt-0.5 line-clamp-1 text-[13px] text-app">{spec.title}</div>

                <div className="mt-0.5 flex items-center justify-between text-[11px] text-app-muted">
                  <span>Task: {spec.taskId}</span>
                  <span
                    className={`tabular-nums ${spec.lintStatus === 'pass' ? '' : 'text-app-error'}`}
                  >
                    Lint: {spec.lintStatus} ({spec.lintFindings})
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Content / Spec Detail */}
      {selectedSpec ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div data-view-header="specs" className="flex h-14 items-center justify-between px-6">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-app">{selectedSpec.title}</h2>
              <div className="font-mono text-[11px] text-app-muted">
                .orchestos/specs/{selectedSpec.id}.md · Task: {selectedSpec.taskId}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="compact" onClick={() => onLintSpec(selectedSpec.id)}>
                Lint WHEN/THEN
              </Button>
              {selectedSpec.status !== 'approved' && (
                <SettingsPrimaryAction>
                  <Button size="compact" onClick={() => onApproveSpec(selectedSpec.id)}>
                    Approve Gate
                  </Button>
                </SettingsPrimaryAction>
              )}
            </div>
          </div>

          <div data-view-content="specs" className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            {/* Status */}
            <div className={`flex items-center justify-between border-b pb-3 text-xs ${LINE}`}>
              <div className="flex items-center gap-2">
                <span className="text-app-muted">Gate Condition:</span>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    selectedSpec.status === 'approved' ? 'bg-app-success' : 'bg-app-warning'
                  }`}
                />
                <span className="font-medium text-app">
                  {selectedSpec.status === 'approved' ? 'UNLOCKED' : 'LOCKED (AWAITING APPROVAL)'}
                </span>
              </div>
              <div className="flex items-center gap-4 tabular-nums text-app-muted">
                <span>Lint Findings: {selectedSpec.lintFindings}</span>
                <span>Delta Header Issues: {selectedSpec.deltaIssues}</span>
              </div>
            </div>

            {/* Criteria */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold text-app-muted">
                WHEN / THEN Acceptance Contract Assertions
              </h3>

              {selectedSpec.criteria.map((c, i) => (
                <div key={i} className={`space-y-2 border-b pb-3 text-xs ${LINE}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-10 shrink-0 font-mono text-[10px] text-app-muted">WHEN</span>
                    <p className="flex-1 text-app">{c.when}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-10 shrink-0 font-mono text-[10px] text-app-muted">THEN</span>
                    <p className="flex-1 text-app">{c.then}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CLI snippet */}
            <div className="space-y-1 rounded-card bg-app-elevated p-3 font-mono text-[11px] text-app-muted">
              <div># CLI equivalents:</div>
              <div>$ orchestos spec show {selectedSpec.taskId}</div>
              <div>$ orchestos spec approve {selectedSpec.taskId}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <EmptyState
            icon={FileText}
            title="No specs yet"
            description="Specs appear here when a task drafts one in .orchestos/specs/."
          />
        </div>
      )}
    </div>
  )
}
