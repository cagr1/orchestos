import { useEffect, useRef, useState } from 'react'
import { type ProjectSettingsPatch, patchProject, projectBranches } from '../../api/projects'
import type { ProjectItem } from '../../types/orchestos'
import { PROJECT_ICONS, ProjectIcon } from '../common/ProjectIcon'
import { SettingsGroup, SettingsRow } from './primitives'

export function ProjectGeneralSettings({
  project,
  onUpdated,
}: {
  project: ProjectItem
  onUpdated: (project: ProjectItem) => void
}) {
  const [name, setName] = useState(project.displayName ?? '')
  const [icon, setIcon] = useState(project.icon ?? 'FolderClosed')
  const [baseBranch, setBaseBranch] = useState(project.baseBranch ?? '')
  const [script, setScript] = useState(project.setupScript ?? '')
  const [branches, setBranches] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queue = useRef(Promise.resolve())
  const basename =
    project.path
      ?.replace(/[\\/]$/, '')
      .split(/[\\/]/)
      .pop() ?? project.name
  useEffect(() => {
    let disposed = false
    // Abortar al desmontar: una purga en curso borra el proyecto y la respuesta tardía sería un 404.
    const controller = new AbortController()
    projectBranches(project.id, controller.signal)
      .then((rows) => {
        if (!disposed) setBranches(rows)
      })
      .catch((error) => {
        if (!disposed) setErrors((prev) => ({ ...prev, branches: error.message }))
      })
    return () => {
      disposed = true
      controller.abort()
    }
  }, [project.id])
  const save = (field: keyof ProjectSettingsPatch, value: string | null) => {
    queue.current = queue.current.then(async () => {
      try {
        const updated = await patchProject(project.id, { [field]: value })
        onUpdated(updated)
        setErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [field]: error instanceof Error ? error.message : String(error),
        }))
      }
    })
  }
  const anchor = (field: string) => `project_${project.id}_${field}`
  const control = 'rounded-control border border-app bg-app-bg px-2 py-1.5 text-[13px] text-app'
  return (
    <div data-project-general className="px-6 py-4 space-y-3">
      <SettingsGroup>
        <SettingsRow label="Name" data-settings-anchor={anchor('name')}>
          <input
            aria-label="Name"
            placeholder={basename}
            className={control}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => save('displayName', name)}
          />
        </SettingsRow>
        <SettingsRow label="Icon" data-settings-anchor={anchor('icon')}>
          <div className="grid grid-cols-7 gap-1">
            {PROJECT_ICONS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={icon === key}
                className={`rounded-control p-2 ${icon === key ? 'bg-app-elevated text-app-accent' : 'text-app-muted hover:bg-app-elevated'}`}
                onClick={() => {
                  setIcon(key)
                  save('icon', key === 'FolderClosed' ? null : key)
                }}
              >
                <ProjectIcon name={key} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Base branch" data-settings-anchor={anchor('branch')}>
          <select
            aria-label="Base branch"
            className={control}
            value={baseBranch}
            onChange={(event) => {
              setBaseBranch(event.target.value)
              save('baseBranch', event.target.value || null)
            }}
          >
            <option value="">Current branch</option>
            {[...new Set([...branches, ...(baseBranch ? [baseBranch] : [])])].map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </SettingsRow>
        <div className="px-4 py-3 space-y-2" data-settings-anchor={anchor('script')}>
          <label htmlFor={`project-script-${project.id}`} className="block text-[13px] font-medium">
            Setup script
          </label>
          <p className="text-xs text-app-muted">
            Runs in the new worktree folder after creation and linking node_modules.
          </p>
          <textarea
            id={`project-script-${project.id}`}
            className={`${control} w-full font-mono min-h-28`}
            value={script}
            onChange={(event) => setScript(event.target.value)}
            onBlur={() => save('setupScript', script)}
          />
        </div>
      </SettingsGroup>
      {Object.entries(errors).map(([field, message]) => (
        <p key={field} role="alert" className="text-xs text-app-error">
          {message}
        </p>
      ))}
    </div>
  )
}
