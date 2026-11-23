import { useEffect, useState } from 'react'
import { getProjectGit, initializeProjectGit, type ProjectGitStatus } from '../../api/project'

export function ProjectGitNotice({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ProjectGitStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [excluded, setExcluded] = useState<string[]>([])
  useEffect(() => {
    let active = true
    setStatus(null)
    setError(null)
    setExcluded([])
    void getProjectGit(projectId)
      .then((value) => {
        if (active) setStatus(value)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      active = false
    }
  }, [projectId])
  const initialize = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await initializeProjectGit(projectId)
      setExcluded(result.excluded)
      setStatus(await getProjectGit(projectId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <ProjectGitNoticeContent
      status={status}
      error={error}
      busy={busy}
      excluded={excluded}
      initialize={() => void initialize()}
    />
  )
}

export function ProjectGitNoticeContent({
  status,
  error,
  busy,
  initialize,
  excluded = [],
}: {
  status: ProjectGitStatus | null
  error: string | null
  busy: boolean
  initialize: () => void
  excluded?: string[]
}) {
  return (
    <div className="px-3 text-sm text-app-muted">
      {status && (!status.isGitRepo || !status.hasCommits) && (
        <div className="flex items-center gap-2">
          <span>This folder is not a git repository. Agents need git to run tasks.</span>
          <button
            type="button"
            disabled={busy}
            onClick={initialize}
            className="underline disabled:opacity-50"
          >
            Initialize git
          </button>
        </div>
      )}
      {error && <div role="alert">{error}</div>}
      {excluded.length > 0 && (
        <div>Git initialized. Not committed (may contain secrets): {excluded.join(', ')}</div>
      )}
    </div>
  )
}
