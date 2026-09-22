import { Archive, Play, Terminal } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { type ConsoleLine, execCommand, getConsole } from '../../api/chat'
import type { AgentItem, ProjectItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'
import { StatusBadge } from '../common/StatusBadge'

interface OrchestDevWorkspaceProps {
  activeProject?: ProjectItem
  activeAgent?: AgentItem | null
  onCloseAgent?: (agentId: string) => void
}

export const OrchestDevWorkspace: React.FC<OrchestDevWorkspaceProps> = ({
  activeProject,
  activeAgent,
  onCloseAgent,
}) => {
  const [commandInput, setCommandInput] = useState('')
  const [agentLogs, setAgentLogs] = useState<ConsoleLine[]>([])
  const [pending, setPending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const loadConsole = async () => {
    if (!activeAgent) return
    try {
      const response = await getConsole(activeAgent.id)
      setAgentLogs(response.lines)
      setPending(response.pending)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the agent console.')
    }
  }

  useEffect(() => {
    setAgentLogs([])
    setLoadError(null)
    if (!activeAgent) return
    void loadConsole()
  }, [activeAgent?.id])

  useEffect(() => {
    if (!activeAgent || !pending) return
    const timer = window.setInterval(() => {
      void loadConsole()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [activeAgent?.id, pending])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [agentLogs.length])

  const handleSendCommand = async (event: React.FormEvent) => {
    event.preventDefault()
    const cmd = commandInput.trim()
    if (!cmd || !activeAgent) return
    setCommandInput('')
    setPending(true)
    try {
      await execCommand(activeAgent.id, cmd)
      await loadConsole()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to execute the command.')
      setPending(false)
    }
  }

  if (!activeAgent) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-app-bg text-app select-none overflow-hidden">
        <div className="flex flex-col items-center max-w-sm text-center space-y-4 opacity-70 hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-card bg-app-surface border border-app flex items-center justify-center text-app-accent shadow-lg">
            <span className="text-2xl font-black tracking-tighter">O</span>
            <span className="text-xl font-black text-app">S</span>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-app tracking-tight">
              {activeProject?.name || 'Workspace'} Dev
            </h1>
            <p className="text-xs text-app-muted leading-relaxed">
              No active agent session open.
              <br />
              Select an agent from the sidebar or click{' '}
              <strong className="text-app-accent">+</strong> on a project to launch a CLI.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col bg-app-bg text-app overflow-hidden">
      <div className="h-12 border-b border-app bg-app-surface/60 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-control bg-app-elevated border border-app flex items-center justify-center flex-shrink-0">
            <ProviderLogo id={activeAgent.model || 'claude'} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-app truncate max-w-md">
                {activeAgent.name}
              </span>
              <StatusBadge status={activeAgent.status} />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-app-muted">
              <span>{activeProject?.name || 'Workspace'}</span>
              <span>·</span>
              <span>{activeAgent.model}</span>
              <span>·</span>
              <span>Duration: {activeAgent.duration}</span>
            </div>
          </div>
        </div>
        {onCloseAgent && (
          <button
            type="button"
            onClick={() => onCloseAgent(activeAgent.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-app-elevated border border-app text-xs text-app-muted hover:text-app transition-colors"
            title="Archive agent session to History"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archive Session</span>
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col p-4 overflow-hidden font-mono text-xs">
        <div className="flex-1 rounded-card border border-app bg-app-surface flex flex-col overflow-hidden shadow-inner">
          <div className="px-3 py-1.5 border-b border-app bg-app-elevated flex items-center justify-between text-xs text-app-muted flex-shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-app-accent" />
              <span className="font-medium text-app">Agent Execution Stream</span>
              <span className="text-app-muted">({activeAgent.id})</span>
            </div>
          </div>
          <div
            className="flex-1 p-3 overflow-y-auto space-y-1 font-mono text-xs text-app bg-app-bg select-text"
            aria-live="polite"
          >
            {agentLogs.map((line, index) => (
              <div
                key={`${line.at}-${index}`}
                className={`leading-relaxed ${line.kind === 'error' ? 'text-rose-400' : line.kind === 'output' ? 'text-emerald-400' : line.kind === 'command' ? 'text-app-accent font-semibold' : 'text-app-muted'}`}
              >
                {line.text}
              </div>
            ))}
            {loadError && <div className="leading-relaxed text-rose-400">{loadError}</div>}
            <div ref={logEndRef} />
          </div>
          <form
            onSubmit={handleSendCommand}
            className="p-2 border-t border-app bg-app-surface flex items-center gap-2 flex-shrink-0"
          >
            <span className="text-app-accent font-mono pl-2 text-xs">$</span>
            <input
              type="text"
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              placeholder="Send command or instruction to agent subshell..."
              className="flex-1 bg-transparent border-none text-xs text-app font-mono placeholder:text-app-muted focus:outline-hidden"
              aria-label="Command"
            />
            <button
              type="submit"
              disabled={!commandInput.trim() || pending}
              className="p-1.5 rounded-control bg-app-accent text-zinc-950 disabled:opacity-40 hover:opacity-90 transition-opacity"
              title="Execute"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
