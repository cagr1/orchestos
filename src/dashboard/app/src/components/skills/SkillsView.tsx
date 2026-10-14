import { Cpu, Search } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { SkillItem } from '../../types/orchestos'
import { EmptyState } from '../common/ViewStateFeedback'

interface SkillsViewProps {
  skills: SkillItem[]
  onCompileSkill: (skillId: string) => Promise<{ paths: string[] }>
}

const ROW_BORDER = 'border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]'

export const SkillsView: React.FC<SkillsViewProps> = ({ skills, onCompileSkill }) => {
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
                    {skill.origin === 'library' ? 'Biblioteca' : 'Proyecto'}
                  </span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-app-muted">
                    {skill.usageRuns} runs
                  </span>
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
