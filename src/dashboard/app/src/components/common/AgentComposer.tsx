import { ArrowUp, Check, ChevronDown, Paperclip, Terminal, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { type CliModelOption, getChatModels, getCliModels } from '../../api/chat'
import type { ChatAttachment } from '../../types/orchestos'
import { ProviderLogo } from './ProviderLogos'

export type CliId = 'api' | 'claude' | 'codex' | 'opencode' | 'deepseek' | 'gemini'

export interface CliConfig {
  id: CliId
  name: string
  defaultModel: string
  models: CliModelOption[]
  efforts: string[]
  error?: string
}

export const CLIS: CliConfig[] = [
  { id: 'api', name: 'ChatGPT', defaultModel: '', models: [], efforts: [] },
  { id: 'claude', name: 'Claude', defaultModel: '', models: [], efforts: [] },
  { id: 'codex', name: 'Codex', defaultModel: '', models: [], efforts: [] },
  { id: 'opencode', name: 'OpenCode', defaultModel: '', models: [], efforts: [] },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: '', models: [], efforts: [] },
  { id: 'gemini', name: 'Gemini', defaultModel: '', models: [], efforts: [] },
]

export type EffortLevel = string

export function selectionFromDefaults(
  defaultCli: CliId,
  defaultModel: string | undefined,
  defaultEffort: EffortLevel,
  lockedCli?: CliId,
) {
  return {
    cli: lockedCli ?? defaultCli,
    model: defaultModel ?? '',
    effort: defaultEffort,
  }
}

export async function sendComposerDraft(send: () => unknown): Promise<boolean> {
  try {
    return (await send()) !== false
  } catch {
    return false
  }
}

const SLASH_COMMANDS: Array<{ cmd: string; label: string }> = [
  { cmd: '/rename', label: 'Rename this conversation' },
  { cmd: '/usage', label: 'Open CLI usage' },
  { cmd: '/model', label: 'Choose model and effort' },
  { cmd: '/archive', label: 'Archive this conversation' },
]

export interface AgentComposerProps {
  onSendMessage: (
    content: string,
    attachments?: ChatAttachment[],
    cli?: string,
    model?: string,
    effort?: string,
    isShellCmd?: boolean,
  ) => unknown
  defaultCli?: CliId
  defaultModel?: string
  defaultEffort?: EffortLevel
  lockedCli?: CliId
  orchestratorAssigned?: boolean
  busy?: boolean
  onOpenRouting?: () => void
  onSlashCommand?: (command: string, argument?: string) => void
  className?: string
}

export const AgentComposer: React.FC<AgentComposerProps> = ({
  onSendMessage,
  defaultCli = 'claude',
  defaultModel,
  defaultEffort = 'high',
  lockedCli,
  orchestratorAssigned = true,
  busy = false,
  onOpenRouting,
  onSlashCommand,
  className = '',
}) => {
  const [availableClis, setAvailableClis] = useState<CliConfig[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [activeCli, setActiveCli] = useState<CliId>(lockedCli ?? defaultCli)
  const fallbackCli = CLIS.find((cli) => cli.id === (lockedCli ?? defaultCli)) ?? CLIS[0]
  const initialModel = defaultModel ?? ''
  const currentCliConfig =
    availableClis.find((c) => c.id === activeCli) ??
    (initialModel
      ? {
          ...fallbackCli,
          models: [{ id: initialModel, name: initialModel, short: initialModel }],
        }
      : fallbackCli)

  const [selectedModel, setSelectedModel] = useState<string>(
    initialModel || currentCliConfig.defaultModel || '',
  )
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel>(defaultEffort)

  useEffect(() => {
    const next = selectionFromDefaults(defaultCli, defaultModel, defaultEffort, lockedCli)
    setActiveCli(next.cli)
    setSelectedModel(next.model)
    setSelectedEffort(next.effort)
  }, [lockedCli, defaultCli, defaultModel, defaultEffort])

  const [inputText, setInputText] = useState('')
  const [isShellMode, setIsShellMode] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    void Promise.all([getChatModels().catch(() => []), getCliModels().catch(() => [])]).then(
      ([models, cliCatalogs]) => {
        if (disposed) return
        const detected = CLIS.filter((cli) => cliCatalogs.some((item) => item.id === cli.id)).map(
          (cli) => {
            const catalog = cliCatalogs.find((item) => item.id === cli.id)
            return catalog
              ? { ...cli, models: catalog.models, efforts: catalog.efforts, error: catalog.error }
              : cli
          },
        )
        const apiModels = models.map((model) => ({
          id: model.id,
          name: model.id,
          short: model.name || model.id,
        }))
        const next = apiModels.length
          ? [
              ...detected,
              {
                id: 'api' as const,
                name: 'ChatGPT',
                defaultModel: apiModels[0].name,
                models: apiModels,
                efforts: ['low', 'medium', 'high'],
              },
            ]
          : detected
        setAvailableClis(next)
        const sessionCli = lockedCli ?? defaultCli
        const sessionConfig = next.find((cli) => cli.id === sessionCli)
        if (sessionConfig?.models.length) {
          setSelectedModel((current) =>
            sessionConfig.models.some((model) => model.id === current)
              ? current
              : (sessionConfig.models[0]?.id ?? current),
          )
        }
        setActiveCli((current) => {
          if (lockedCli) return lockedCli
          return next.some((cli) => cli.id === current) ? current : next[0]?.id || 'api'
        })
        setIsLoadingModels(false)
      },
    )
    return () => {
      disposed = true
    }
  }, [lockedCli, defaultCli])

  // Sync model if CLI changes and model is not in list
  useEffect(() => {
    const valid = currentCliConfig.models.some((m) => m.id === selectedModel)
    if (!valid && currentCliConfig.models[0]) {
      setSelectedModel(currentCliConfig.models[0].id)
    }
  }, [currentCliConfig, selectedModel])

  useEffect(() => {
    if (currentCliConfig.efforts.length > 0 && !currentCliConfig.efforts.includes(selectedEffort)) {
      setSelectedEffort(currentCliConfig.efforts[0] ?? '')
    }
  }, [currentCliConfig, selectedEffort])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value

    // Check for ! shell prefix
    if (!isShellMode && val === '!') {
      setIsShellMode(true)
      setInputText('')
      setShowSlashMenu(false)
      return
    }

    if (val === '/') {
      setShowSlashMenu(true)
    } else if (!val.startsWith('/')) {
      setShowSlashMenu(false)
    }

    setInputText(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace' && isShellMode && inputText === '') {
      setIsShellMode(false)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false)
      setShowDropdown(false)
      if (isShellMode && inputText === '') {
        setIsShellMode(false)
      }
    }
  }

  const handleSend = async () => {
    if (busy || (!inputText.trim() && attachments.length === 0)) return
    if (!isShellMode && (isLoadingModels || currentCliConfig.models.length === 0)) return
    const content = inputText.trim()
    if (content.startsWith('/')) {
      const [command, ...argument] = content.split(/\s+/)
      if (SLASH_COMMANDS.some((item) => item.cmd === command)) {
        if (command === '/model') {
          setShowDropdown(true)
        } else {
          onSlashCommand?.(command, argument.join(' ') || undefined)
        }
        setInputText('')
        setShowSlashMenu(false)
        return
      }
    }

    const accepted = await sendComposerDraft(() =>
      onSendMessage(
        content,
        attachments.length > 0 ? attachments : undefined,
        activeCli,
        effectiveSelectedModel,
        selectedEffort,
        isShellMode,
      ),
    )
    if (!accepted) return

    setInputText('')
    setAttachments([])
    setShowSlashMenu(false)
    setIsShellMode(false)
  }

  const handleSelectSlashCommand = (cmd: string) => {
    if (cmd === '/model') {
      setShowDropdown(true)
      setShowSlashMenu(false)
      return
    }
    setInputText(`${cmd} `)
    setShowSlashMenu(false)
    textareaRef.current?.focus()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const newAttachments: ChatAttachment[] = files.map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.name.endsWith('.pdf') ? 'pdf' : 'file',
    }))
    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // Find short model label
  const effectiveSelectedModel = currentCliConfig.models.some((model) => model.id === selectedModel)
    ? selectedModel
    : (currentCliConfig.models[0]?.id ?? selectedModel)
  const currentModelObj = currentCliConfig.models.find((m) => m.id === effectiveSelectedModel)
  const shortModelLabel = currentModelObj
    ? currentModelObj.short
    : effectiveSelectedModel.split(' ')[0]
  const effortSteps = currentModelObj?.efforts?.length
    ? currentModelObj.efforts
    : currentCliConfig.efforts
  const modelsReady = !isLoadingModels && currentCliConfig.models.length > 0

  return (
    <div className={`relative w-full ${className}`}>
      {/* Slash command autocomplete menu */}
      {showSlashMenu && (
        <div className="absolute left-3 bottom-full mb-2 w-80 rounded-card bg-app-surface border border-app shadow-2xl p-1 text-xs space-y-0.5 z-40 animate-in fade-in duration-100">
          <div className="px-2 py-1 text-[10px] font-mono text-app-muted uppercase tracking-wider border-b border-app/60">
            Commands
          </div>
          {SLASH_COMMANDS.map((item) => (
            <button
              key={item.cmd}
              type="button"
              onClick={() => handleSelectSlashCommand(item.cmd)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control text-left hover:bg-app-elevated transition-colors group"
            >
              <span className="font-mono font-bold text-app-accent group-hover:text-app">
                {item.cmd}
              </span>
              <span className="text-xs text-app-muted truncate pl-2">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Model & Effort Unified Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-10 bottom-12 w-80 rounded-card bg-app-surface border border-app shadow-2xl p-3 z-50 animate-in fade-in duration-100 text-xs text-app select-none"
        >
          <div className="grid grid-cols-[1fr_110px] gap-3">
            {/* Left: Models */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-app-muted mb-1.5">
                Model
              </div>
              <div className="space-y-0.5">
                {currentCliConfig.models.map((m) => {
                  const isSelected = m.id === effectiveSelectedModel
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id)
                        setShowDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-control text-left transition-colors ${
                        isSelected
                          ? 'bg-app-elevated text-app font-medium border border-app'
                          : 'text-app-muted hover:text-app hover:bg-app-elevated/40'
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: 4-step vertical slider for Effort */}
            <div className="space-y-1 border-l border-app pl-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-app-muted mb-1.5">
                Effort
              </div>
              <div className="flex flex-col gap-1 relative py-1">
                {effortSteps.map((step) => {
                  const isActive = step === selectedEffort
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setSelectedEffort(step)}
                      className={`flex items-center gap-2 px-2 py-1 rounded-control text-xs transition-colors text-left ${
                        isActive
                          ? 'text-app font-semibold bg-app-elevated border border-app'
                          : 'text-app-muted hover:text-app hover:bg-app-elevated/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-app-accent' : 'bg-app-muted/40'
                        }`}
                      />
                      <span>{step[0]?.toUpperCase() + step.slice(1)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="rounded-card border border-app bg-app-surface focus-within:border-app-accent/80 transition-all flex flex-col p-2.5 shadow-xs">
        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-app-bg border border-app text-xs font-mono"
              >
                <span className="text-app truncate max-w-[140px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="text-app-muted hover:text-app"
                  aria-label="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Row with optional Shell Chip */}
        <div className="flex items-start gap-1.5">
          {isShellMode && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-control bg-app-bg border border-app text-[11px] font-mono text-amber-400 select-none flex-shrink-0 mt-0.5">
              <Terminal className="w-3 h-3" />
              <span>shell</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isShellMode
                ? 'Enter bash command to execute in sandbox…'
                : isLoadingModels
                  ? 'Loading models…'
                  : `Message ${currentCliConfig.name}…`
            }
            className="flex-1 bg-transparent border-none text-xs text-app placeholder:text-app-muted resize-none focus:outline-hidden leading-relaxed font-sans"
          />
        </div>

        {/* Bottom Bar inside Composer */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-app/50 text-xs">
          {/* Left: Attachment + CLI Selector + Model/Effort Dropdown */}
          <div className="flex items-center gap-2">
            {/* Attachment paperclip */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated/60 transition-colors"
              title="Attach files or documentation"
              aria-label="Attach file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            {/* Kept structurally for template fidelity; the session header owns CLI identity. */}
            {false && (
              <div className="flex items-center gap-1 p-0.5 rounded-control bg-app-bg border border-app/60">
                {availableClis.map((cli) => {
                  const isActive = cli.id === activeCli
                  return (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => {
                        setActiveCli(cli.id)
                      }}
                      className={`p-1 rounded-control transition-all ${
                        isActive
                          ? 'bg-app-elevated border border-app text-app shadow-2xs'
                          : 'text-app-muted hover:text-app hover:bg-app-elevated/40'
                      }`}
                      title={cli.name}
                      aria-label={cli.name}
                    >
                      <ProviderLogo id={cli.id} size={14} className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Model and effort merged into one compact dropdown Sonnet 3.7 · High ▾ */}
            <div className="flex flex-col items-start">
              <button
                type="button"
                onClick={() => modelsReady && setShowDropdown(!showDropdown)}
                disabled={!modelsReady}
                className="flex items-center gap-1 px-2 py-1 rounded-control bg-app-bg border border-app/60 hover:border-app text-app text-[11px] font-mono transition-colors disabled:cursor-not-allowed disabled:text-app-muted"
                title="Select model and reasoning effort"
              >
                <span>
                  {isLoadingModels ? 'Loading models…' : `${shortModelLabel} · ${selectedEffort}`}
                </span>
                <ChevronDown className="w-3 h-3 text-app-muted" />
              </button>
              {currentCliConfig.error && (
                <div className="mt-1 max-w-56 text-[10px] text-app-muted">
                  {currentCliConfig.error}
                </div>
              )}
            </div>
          </div>

          {/* Right: Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={
              (!inputText.trim() && attachments.length === 0) ||
              (!isShellMode && !modelsReady) ||
              !orchestratorAssigned ||
              busy
            }
            className={`p-1.5 rounded-control flex items-center justify-center transition-all ${
              inputText.trim() || attachments.length > 0
                ? 'bg-app-accent text-white hover:opacity-90 shadow-2xs'
                : 'text-app-muted/40 cursor-not-allowed'
            }`}
            title="Send message (Enter)"
            aria-label="Send message"
          >
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
        {!orchestratorAssigned && (
          <div
            className="flex items-center justify-between gap-3 pt-2 text-xs text-app-muted"
            role="status"
          >
            <span>Orchestrator unassigned. Choose an agent or assign one in Model routing.</span>
            <button
              type="button"
              onClick={onOpenRouting}
              className="text-app-accent hover:underline underline-offset-2"
            >
              Model routing
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
