import React, { useState } from 'react';
import {
  Terminal,
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  Archive,
  Square,
  Cpu,
  FolderGit2,
} from 'lucide-react';
import { AgentItem, ProjectItem } from '../../types/orchestos';
import { StatusBadge } from '../common/StatusBadge';
import { ProviderLogo } from '../common/ProviderLogos';

interface OrchestDevWorkspaceProps {
  activeProject: ProjectItem;
  activeAgent?: AgentItem | null;
  onCloseAgent?: (agentId: string) => void;
  onRunCommand?: (cmd: string) => void;
}

export const OrchestDevWorkspace: React.FC<OrchestDevWorkspaceProps> = ({
  activeProject,
  activeAgent,
  onCloseAgent,
  onRunCommand,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [agentLogs, setAgentLogs] = useState<string[]>([
    '[sandbox] Initializing isolated git worktree at refs/orchestos/sandbox-t3...',
    '[ast] Parsed dependency graph: 142 source files, 0 circular dependencies.',
    '[contract] Enforcing declared output slice: ["src/run/contract-check.ts", "tasks/tasks.yaml"]',
    '[tool] read_file("tasks/tasks.yaml")',
    '[tool] check_spec("t3_contract_enforce")',
    '[runner] Running vitest run test/contract.test.ts --silent...',
    '[runner] ✓ test/contract.test.ts (4 tests passed, 0 failures)',
    '[qa] Dual QA verdict evaluated: PASS',
  ]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    const cmd = commandInput.trim();
    setAgentLogs((prev) => [...prev, `$ ${cmd}`, `[exec] Command executed successfully with exit code 0`]);
    if (onRunCommand) onRunCommand(cmd);
    setCommandInput('');
  };

  // When no agent is active in Dev mode: Centered, subtle OrchestOS logo
  if (!activeAgent) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-app-bg text-app select-none overflow-hidden">
        <div className="flex flex-col items-center max-w-sm text-center space-y-4 opacity-70 hover:opacity-100 transition-opacity">
          {/* Subtle Logo */}
          <div className="w-16 h-16 rounded-card bg-app-surface border border-app flex items-center justify-center text-app-accent shadow-lg">
            <span className="text-2xl font-black tracking-tighter">O</span>
            <span className="text-xl font-black text-app">S</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-app tracking-tight">
              OrchestOS Dev
            </h1>
            <p className="text-xs text-app-muted leading-relaxed">
              No active agent session open.
              <br />
              Select an agent from the sidebar or click <strong className="text-app-accent">+</strong> on a project to launch a CLI.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // When an agent is active: Live Agent Workspace Console
  return (
    <main className="flex-1 flex flex-col bg-app-bg text-app overflow-hidden">
      {/* Agent Header */}
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
              <span>{activeProject.name}</span>
              <span>·</span>
              <span>{activeAgent.model}</span>
              <span>·</span>
              <span>Duration: {activeAgent.duration}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
      </div>

      {/* Terminal & Execution Console */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden font-mono text-xs">
        <div className="flex-1 rounded-card border border-app bg-app-surface flex flex-col overflow-hidden shadow-inner">
          {/* Console Bar */}
          <div className="px-3 py-1.5 border-b border-app bg-app-elevated flex items-center justify-between text-xs text-app-muted flex-shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-app-accent" />
              <span className="font-medium text-app">Agent Execution Stream</span>
              <span className="text-app-muted">({activeAgent.id})</span>
            </div>
            <span className="text-xs text-emerald-400 font-mono">AST Gate Active</span>
          </div>

          {/* Logs */}
          <div className="flex-1 p-3 overflow-y-auto space-y-1 font-mono text-xs text-app bg-app-bg select-text">
            {agentLogs.map((log, idx) => {
              const isError = log.includes('error') || log.includes('fail');
              const isSuccess = log.includes('passed') || log.includes('✓') || log.includes('PASS');
              const isCommand = log.startsWith('$');

              return (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    isError
                      ? 'text-rose-400'
                      : isSuccess
                      ? 'text-emerald-400'
                      : isCommand
                      ? 'text-app-accent font-semibold'
                      : 'text-app-muted'
                  }`}
                >
                  {log}
                </div>
              );
            })}
          </div>

          {/* Interactive Command Input */}
          <form
            onSubmit={handleSendCommand}
            className="p-2 border-t border-app bg-app-surface flex items-center gap-2 flex-shrink-0"
          >
            <span className="text-app-accent font-mono pl-2 text-xs">$</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Send command or instruction to agent subshell..."
              className="flex-1 bg-transparent border-none text-xs text-app font-mono placeholder:text-app-muted focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!commandInput.trim()}
              className="p-1.5 rounded-control bg-app-accent text-zinc-950 disabled:opacity-40 hover:opacity-90 transition-opacity"
              title="Execute"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};
