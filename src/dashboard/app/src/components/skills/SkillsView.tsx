import { Cpu, Search } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TaskClass } from '../../../../../router/classify'
import type { SkillItem } from '../../types/orchestos'
import { EmptyState } from '../common/ViewStateFeedback'

interface SkillsViewProps {
  skills: SkillItem[]
  onAddLibrarySkill?: (url: string) => Promise<{ warnings: string[] }>
  onEnableLibrarySkill?: (id: string, enabled: boolean) => Promise<void>
  onSetLibrarySkillPhases?: (id: string, phases: TaskClass[]) => Promise<void>
  onCompileSkill: (skillId: string) => Promise<{ paths: string[] }>
}

const PHASES = [
  ['plan', 'Plan'],
  ['implement', 'Build'],
  ['fix', 'Fix'],
  ['review', 'Review'],
  ['doc', 'Docs'],
] as const

const ROW_BORDER = 'border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]'

export const SkillsView: React.FC<SkillsViewProps> = ({
  skills,
  onCompileSkill,
  onAddLibrarySkill,
  onEnableLibrarySkill,
  onSetLibrarySkillPhases,
}) => {
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [pendingEnabled, setPendingEnabled] = useState<Record<string, boolean>>({})
  const [pendingPhases, setPendingPhases] = useState<Record<string, TaskClass[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [compileResults, setCompileResults] = useState<Record<string, string>>({})

  const supportedLanguages = [
    'TypeScript',
    'Rust',
    'Python',
    'Go',
    'Elixir',
    'C++',
    'Java',
    'Kotlin',
    'Swift',
    'PHP',
    'Ruby',
    'C#',
    'Shell / Docker',
  ]

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.language.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLang = selectedLanguage === 'all' || s.language === selectedLanguage
    return matchesSearch && matchesLang
  })

  return (
    <div data-view="skills" className="flex min-h-full flex-1 flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div
        data-view-header="skills"
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-app-muted" />
            <span className="text-[13px] font-semibold text-app">Skills Engine (36 Languages)</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills, verifiers, language..."
              className="h-7 w-56 rounded-control bg-app-elevated pl-8 pr-3 text-xs text-app placeholder:text-app-muted focus:outline-none"
            />
          </div>
        </div>

        <Button
          size="compact"
          onClick={() => {
            setError('')
            setShowAdd(true)
          }}
          disabled={!onAddLibrarySkill}
        >
          Add skill
        </Button>
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="h-7 rounded-control bg-app-elevated px-2.5 text-xs text-app focus:outline-none"
        >
          <option value="all">All Languages</option>
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {error && !showAdd && (
        <p role="alert" className="px-6 text-xs text-app-error">
          {error}
        </p>
      )}
      {warnings.map((warning) => (
        <p key={warning} role="status" className="px-6 text-xs text-app-muted">
          {warning}
        </p>
      ))}
      {showAdd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add skill"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <form
            className="w-full max-w-md space-y-4 rounded-card border border-app bg-app-surface p-5 text-xs shadow-2xl"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!onAddLibrarySkill) return
              setSaving(true)
              setError('')
              try {
                const result = await onAddLibrarySkill(url)
                setWarnings(result.warnings)
                setUrl('')
                setShowAdd(false)
              } catch (error) {
                setError(error instanceof Error ? error.message : String(error))
              } finally {
                setSaving(false)
              }
            }}
          >
            <h2 className="text-sm font-semibold text-app">Add skill</h2>
            <label className="block space-y-2 text-app-muted">
              <span>GitHub URL of a SKILL.md or folder</span>
              <input
                required
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="h-8 w-full rounded-control border border-app bg-app-elevated px-3 text-xs text-app focus:outline-none"
              />
            </label>
            {error && (
              <p role="alert" className="text-app-error">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-app pt-2">
              <Button
                type="button"
                variant="ghost"
                size="compact"
                disabled={saving}
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="compact" disabled={saving}>
                Add
              </Button>
            </div>
          </form>
        </div>
      )}
      {/* Skills list */}
      <div data-view-content="skills" className="flex-1 overflow-y-auto px-6 pb-6">
        <div>
          <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold text-app-muted">
            <span>Language-Aware Verifiers and Test Harnesses</span>
            <span className="font-mono font-normal">orchestos skill build</span>
          </div>

          {filteredSkills.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No skills yet"
              description="Skills appear here when the project or the library provides one."
            />
          ) : (
            filteredSkills.map((skill) => (
              <div key={skill.id} data-skill-row className={`border-b px-3 py-2.5 ${ROW_BORDER}`}>
                <div className="flex items-center gap-3">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      skill.status === 'compiled'
                        ? 'bg-app-success'
                        : skill.status === 'source'
                          ? 'bg-app-warning'
                          : 'bg-app-muted'
                    }`}
                  />
                  <span className="min-w-0 truncate text-[13px] font-medium text-app">
                    {skill.name}
                  </span>
                  <span className="shrink-0 text-xs text-app-muted">{skill.language}</span>
                  <span className="shrink-0 text-xs text-app-muted">{skill.status}</span>
                  <span className="shrink-0 text-xs text-app-muted">
                    {skill.origin === 'user-library'
                      ? 'Library'
                      : skill.origin === 'built-in'
                        ? 'Built-in'
                        : 'Project'}
                  </span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-app-muted">
                    {skill.usageRuns} runs
                  </span>
                  {skill.origin === 'user-library' && (
                    <label className="flex items-center gap-2 text-xs text-app-muted">
                      Use in this project
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Use in this project ${skill.name}`}
                        aria-checked={pendingEnabled[skill.id] ?? !!skill.enabled}
                        checked={pendingEnabled[skill.id] ?? !!skill.enabled}
                        disabled={saving || !onEnableLibrarySkill}
                        className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-app-elevated transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-app-muted after:transition-transform checked:bg-app-accent checked:after:translate-x-4 checked:after:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                        onChange={async (event) => {
                          const enabled = event.target.checked
                          setPendingEnabled((previous) => ({ ...previous, [skill.id]: enabled }))
                          setSaving(true)
                          setError('')
                          try {
                            await onEnableLibrarySkill?.(skill.id, enabled)
                          } catch (error) {
                            setError(error instanceof Error ? error.message : String(error))
                          } finally {
                            setPendingEnabled((previous) => {
                              const next = { ...previous }
                              delete next[skill.id]
                              return next
                            })
                            setSaving(false)
                          }
                        }}
                      />
                    </label>
                  )}
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={async () => {
                      try {
                        const result = await onCompileSkill(skill.id)
                        setCompileResults((previous) => ({
                          ...previous,
                          [skill.id]: result.paths.length
                            ? `Build succeeded: ${result.paths.join(', ')}`
                            : 'Build succeeded: no generated paths',
                        }))
                      } catch (error) {
                        setCompileResults((previous) => ({
                          ...previous,
                          [skill.id]: `Build failed: ${error instanceof Error ? error.message : String(error)}`,
                        }))
                      }
                    }}
                  >
                    Recompile
                  </Button>
                </div>
                {skill.origin === 'user-library' && (
                  <div className="mt-2 flex items-center gap-2 pl-[18px] text-xs text-app-muted">
                    <span>Applies in</span>
                    {PHASES.map(([phase, label]) => {
                      const phases = pendingPhases[skill.id] ?? skill.phases ?? []
                      const pressed = phases.includes(phase)
                      return (
                        <button
                          key={phase}
                          type="button"
                          aria-pressed={pressed}
                          disabled={saving || !onSetLibrarySkillPhases}
                          className={`inline-flex h-7 shrink-0 items-center gap-2 rounded-control px-2 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                            pressed
                              ? 'bg-app-elevated text-app'
                              : 'text-app-muted hover:bg-app-elevated hover:text-app'
                          }`}
                          onClick={async () => {
                            const nextPhases = pressed
                              ? phases.filter((value) => value !== phase)
                              : [...phases, phase]
                            setPendingPhases((previous) => ({
                              ...previous,
                              [skill.id]: nextPhases,
                            }))
                            setSaving(true)
                            setError('')
                            try {
                              await onSetLibrarySkillPhases?.(skill.id, nextPhases)
                            } catch (error) {
                              setError(error instanceof Error ? error.message : String(error))
                            } finally {
                              setPendingPhases((previous) => {
                                const next = { ...previous }
                                delete next[skill.id]
                                return next
                              })
                              setSaving(false)
                            }
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="mt-1 max-w-prose pl-[18px] text-xs leading-relaxed text-app-muted">
                  {skill.description}
                </p>
                <div className="mt-1 flex items-center gap-3 pl-[18px] font-mono text-[11px] text-app-muted">
                  <span className="truncate">$ {skill.verifierCommand}</span>
                  <span className="shrink-0">ID: {skill.id}</span>
                </div>
                {compileResults[skill.id] && (
                  <div
                    className={`mt-1 pl-[18px] text-[11px] ${
                      compileResults[skill.id].startsWith('Build failed:')
                        ? 'text-app-error'
                        : 'text-app-success'
                    }`}
                    role="status"
                  >
                    {compileResults[skill.id]}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
