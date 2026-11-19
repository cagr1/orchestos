import { Button } from '@/components/ui/button'
import type { CutReport } from '../../../../cut-check'

export function cutContinuation(handoff: string | null): string {
  return handoff === 'next-md'
    ? 'Continue. Start from NEXT.md.'
    : handoff
      ? `Continue from this handoff:\n\n${handoff}`
      : 'Continue.'
}

export function CutReportCard({
  report,
  onContinue,
  superseded = false,
}: {
  report: CutReport
  onContinue: () => void
  superseded?: boolean
}) {
  return (
    <div
      className={`mt-3 flex flex-col gap-2 whitespace-normal rounded-card border border-app bg-app-surface p-4${superseded ? ' opacity-50' : ''}`}
    >
      <span className="text-sm font-semibold text-app">
        {!report.checkFailed && report.dirtyTotal === 0 && report.ahead === 0
          ? 'Session wrapped up'
          : 'Wrap-up incomplete'}
      </span>
      <div className="text-xs text-app-muted">
        {report.dirtyTotal === 0 ? (
          'Working tree clean'
        ) : (
          <details>
            <summary>{report.dirtyTotal} uncommitted files</summary>
            <ul>
              {report.dirty.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <span className="text-xs text-app-muted">
        {!report.upstream
          ? 'No upstream branch'
          : report.ahead === 0
            ? `Pushed to ${report.upstream}`
            : `${report.ahead} commits not pushed`}
      </span>
      {report.lock !== 'none' && (
        <span className="text-xs text-app-muted">
          {report.lock === 'released'
            ? 'Writer lock released'
            : report.lock === 'held'
              ? 'Writer lock kept: uncommitted changes'
              : 'Writer lock held by another session'}
        </span>
      )}
      <span className="text-xs text-app-muted">
        {report.handoff === 'next-md'
          ? 'Handoff in NEXT.md'
          : report.handoff
            ? 'Handoff in the last reply'
            : 'No handoff found'}
      </span>
      {!superseded && (
        <Button variant="ghost" size="compact" onClick={onContinue}>
          Continue in new session
        </Button>
      )}
    </div>
  )
}
