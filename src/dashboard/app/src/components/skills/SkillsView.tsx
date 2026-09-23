import {
  Boxes,
  Check,
  CheckCircle2,
  Code2,
  Cpu,
  ExternalLink,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { SkillItem } from '../../types/orchestos'

interface SkillsViewProps {
  skills: SkillItem[]
  onCompileSkill: (skillId: string) => Promise<{ paths: string[] }>
}

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
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-xs text-zinc-100 tracking-wide uppercase">
              Skills Engine (36 Languages)
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills, verifiers, language..."
              className="pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-56"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 py-1 px-2.5 focus:outline-none"
          >
            <option value="all">All Languages</option>
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Language-Aware Verifiers and Test Harnesses</span>
            <span className="font-mono">orchestos skill build</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-100">{skill.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{skill.language}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                      skill.status === 'compiled'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : skill.status === 'source'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {skill.status}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                  {skill.description}
                </p>

                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 flex items-center justify-between">
                  <span className="text-zinc-500 truncate max-w-xs">$ {skill.verifierCommand}</span>
                  <span className="text-[10px] text-zinc-400">{skill.usageRuns} runs</span>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[10px] text-zinc-500 font-mono">ID: {skill.id}</span>
                  <button
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
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                  >
                    Recompile
                  </button>
                </div>
                {compileResults[skill.id] && (
                  <div className="text-[11px] text-indigo-200" role="status">
                    {compileResults[skill.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
