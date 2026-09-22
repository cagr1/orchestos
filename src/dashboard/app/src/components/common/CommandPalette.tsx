import {
  Activity,
  ArrowRight,
  Brain,
  Cpu,
  Database,
  FileCheck,
  FolderGit2,
  Kanban,
  MessageSquareCode,
  Play,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import type { NavigationTab } from '../../types/orchestos'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectTab: (tab: NavigationTab) => void
  onRunNextTask: () => void
  onSelectModel: (model: string) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onRunNextTask,
  onSelectModel,
}) => {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          // Open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const actions = [
    {
      id: 'tab_threads',
      title: 'Jump to AI Threads & Agent Traces',
      category: 'Navigation',
      icon: MessageSquareCode,
      run: () => {
        onSelectTab('threads')
        onClose()
      },
    },
    {
      id: 'tab_plan',
      title: 'Jump to Plan Board (tasks.yaml DAG)',
      category: 'Navigation',
      icon: Kanban,
      run: () => {
        onSelectTab('plan')
        onClose()
      },
    },
    {
      id: 'tab_runs',
      title: 'Jump to Runs & Evidence (SQLite Telemetry)',
      category: 'Navigation',
      icon: Activity,
      run: () => {
        onSelectTab('runs')
        onClose()
      },
    },
    {
      id: 'tab_specs',
      title: 'Jump to Spec-Driven Gates (WHEN/THEN)',
      category: 'Navigation',
      icon: FileCheck,
      run: () => {
        onSelectTab('specs')
        onClose()
      },
    },
    {
      id: 'tab_instincts',
      title: 'Jump to Learned Instincts',
      category: 'Navigation',
      icon: Brain,
      run: () => {
        onSelectTab('instincts')
        onClose()
      },
    },
    {
      id: 'tab_memory',
      title: 'Jump to Memory Matrix & Conflict Resolver',
      category: 'Navigation',
      icon: Database,
      run: () => {
        onSelectTab('memory')
        onClose()
      },
    },
    {
      id: 'tab_skills',
      title: 'Jump to Skills Engine (36 Languages)',
      category: 'Navigation',
      icon: Cpu,
      run: () => {
        onSelectTab('skills')
        onClose()
      },
    },
    {
      id: 'tab_context',
      title: 'Jump to Project Context & Rules',
      category: 'Navigation',
      icon: FolderGit2,
      run: () => {
        onSelectTab('context')
        onClose()
      },
    },
    {
      id: 'action_run_task',
      title: 'Execute next pending task in isolated sandbox worktree',
      category: 'Actions',
      icon: Play,
      run: () => {
        onRunNextTask()
        onClose()
      },
    },
    {
      id: 'model_claude',
      title: 'Switch active model to Claude 3.7 Sonnet',
      category: 'Model Provider',
      icon: Sparkles,
      run: () => {
        onSelectModel('claude-3-7-sonnet')
        onClose()
      },
    },
    {
      id: 'model_gemini',
      title: 'Switch active model to Gemini 2.5 Pro (1M Context)',
      category: 'Model Provider',
      icon: Sparkles,
      run: () => {
        onSelectModel('gemini-2.5-pro')
        onClose()
      },
    },
  ]

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700/70 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
        <div className="p-3 border-b border-zinc-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search screen, or execute task..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">No matching commands found.</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.run}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left hover:bg-zinc-800/80 text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700 text-zinc-300">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-200 group-hover:text-white">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-zinc-500">{item.category}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )
            })
          )}
        </div>

        <div className="p-2 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Navigate with ⌘K · Esc to close</span>
          <span className="font-mono">OrchestOS CLI v0.12</span>
        </div>
      </div>
    </div>
  )
}
