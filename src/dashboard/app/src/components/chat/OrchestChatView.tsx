import { Bot, Check, Copy, FileText, Loader2, User } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatAttachment, ChatThread, SessionStatus } from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { ContextRing } from '../common/ContextRing'
import { ProviderLogo } from '../common/ProviderLogos'

interface OrchestChatViewProps {
  thread?: ChatThread
  onSendMessage: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
  ) => void
  onApproveHeldTask?: (taskId: string) => void
  onRejectHeldTask?: (taskId: string) => void
  sessionStatus?: SessionStatus | null
  onSlashCommand?: (command: string, argument?: string) => void
}

export const OrchestChatView: React.FC<OrchestChatViewProps> = ({
  thread,
  onSendMessage,
  sessionStatus,
  onSlashCommand,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const messages = thread?.messages || []
  const cliId = (
    thread?.agent === 'claude' ||
    thread?.agent === 'codex' ||
    thread?.agent === 'opencode' ||
    thread?.agent === 'api'
      ? thread.agent
      : 'api'
  ) as CliId
  const cliName =
    cliId === 'api'
      ? 'ChatGPT'
      : cliId === 'claude'
        ? 'Claude'
        : cliId === 'codex'
          ? 'Codex'
          : cliId === 'opencode'
            ? 'OpenCode'
            : cliId === 'deepseek'
              ? 'DeepSeek'
              : 'Gemini'
  const context = sessionStatus?.clis.find((cli) => cli.id === cliId)?.context
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const lastModel = lastAssistant?.model
    ?.replace(/\s+via\s+.+$/i, '')
    .replace(/\s*\(effort: [^)]+\)/i, '')
  const lastEffort = lastAssistant?.model?.match(/\(effort: ([^)]+)\)/i)?.[1]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.some((message) => message.role === 'assistant')) setIsWorking(false)
  }, [messages])

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(id)
    window.setTimeout(
      () => setCopiedMessageId((current) => (current === id ? null : current)),
      1500,
    )
  }

  const handleSendFromComposer = (
    text: string,
    attachments?: ChatAttachment[],
    cli?: string,
    model?: string,
    effort?: string,
  ) => {
    setIsWorking(true)
    onSendMessage(text, attachments, cli, model, effort)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-app overflow-hidden relative select-none">
      {/* 40px Session Header (Shared format with Dev) */}
      <header className="h-10 border-b border-app bg-app-bg px-3.5 flex items-center justify-between flex-shrink-0 z-20">
        {/* Left: CLI Product Logo (tooltip = name) + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div title={cliName} className="flex-shrink-0 cursor-default">
            <ProviderLogo id={cliId} size={16} className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-app truncate max-w-sm">
            {thread?.title || 'Interactive Session'}
          </span>
        </div>

        {/* Context is rendered only when the selected session has real token telemetry. */}
        <div className="flex items-center flex-shrink-0">
          <ContextRing
            percent={context?.pct}
            model={context?.model ?? undefined}
            usedTokens={context ? `${context.used}` : undefined}
            maxTokens={context ? `${context.window}` : undefined}
          />
        </div>
      </header>

      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto pt-16 text-left space-y-2">
            <h1 className="text-lg font-bold text-app tracking-tight">Chat</h1>
            <p className="text-xs text-app-muted">
              Interactive session with {cliName}. Ask questions, run commands, or review
              architecture.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-5">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              if (isUser) {
                // Human avatar stays on the right, after the message bubble.
                return (
                  <div key={msg.id} className="flex items-end justify-end gap-2 group">
                    <div className="relative max-w-2xl px-4 py-2.5 rounded-card bg-app-surface text-app border border-app text-xs leading-relaxed shadow-2xs">
                      {msg.timestamp && (
                        <span className="absolute right-0 bottom-full mb-1 text-[10px] font-mono text-app-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {msg.timestamp}
                        </span>
                      )}

                      {/* Attachments if any */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-app-bg border border-app text-[11px] text-app font-mono"
                            >
                              <FileText className="w-3 h-3 text-app-accent" />
                              <span>{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>{msg.content}</div>
                      <button
                        type="button"
                        onClick={() => void copyMessage(msg.id, msg.content)}
                        className="absolute left-0 top-full mt-1 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-surface transition-colors"
                        title="Copy"
                        aria-label="Copy"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <User className="mb-2 h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
                  </div>
                )
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <Bot className="mt-4 h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
                  <div className="relative max-w-3xl rounded-card p-4 text-xs leading-relaxed bg-app-surface/60 text-app border border-app/60 shadow-2xs select-text w-full group">
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-app-bg [&>pre]:p-2.5 [&>pre]:rounded-control [&>pre]:border [&>pre]:border-app [&>pre]:font-mono [&>code]:bg-app-bg [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded-control [&>code]:border [&>code]:border-app [&>code]:font-mono [&>strong]:font-bold [&>strong]:text-app">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          input: ({ checked, type }) => {
                            if (type === 'checkbox') {
                              return (
                                <span className="inline-flex items-center justify-center w-3.5 h-3.5 mr-1.5 align-middle rounded-[3px] border border-app bg-app-elevated text-app-accent">
                                  {checked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : null}
                                </span>
                              )
                            }
                            return <input type={type} defaultChecked={checked} readOnly />
                          },
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyMessage(msg.id, msg.content)}
                      className="absolute right-2 top-2 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-elevated transition-colors"
                      title="Copy"
                      aria-label="Copy"
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
            {isWorking && (
              <div className="flex items-center gap-2 text-xs text-app-muted" aria-live="polite">
                <Loader2 className="w-3.5 h-3.5 text-app-accent animate-spin" />
                <span className="animate-pulse">…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Shared Composer (Nothing under composer: no status line) */}
      <div className="p-3 border-t border-app bg-app-bg flex-shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          <AgentComposer
            onSendMessage={handleSendFromComposer}
            defaultModel={lastModel}
            defaultEffort={lastEffort}
            defaultCli={cliId}
            lockedCli={cliId}
            onSlashCommand={onSlashCommand}
          />
        </div>
      </div>
    </div>
  )
}
