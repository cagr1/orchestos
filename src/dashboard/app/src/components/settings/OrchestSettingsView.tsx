import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  DollarSign,
  ExternalLink,
  FileCheck,
  FolderClosed,
  Globe,
  Kanban,
  Key,
  Layers,
  Minus,
  Palette,
  Plus,
  Search,
  Server,
  Settings as SettingsIcon,
  ShieldAlert,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'
import type {
  ConfigResponse,
  ExecutorModesResponse,
  HealthResponse,
  LocalProviderResponse,
  SetupResponse,
  UsageResponse,
} from '../../api/settings'
import {
  getConfig,
  getExecutorModes,
  getHealth,
  getLocalProvider,
  getSettings,
  getSetup,
  getUsage,
  mapSettingsKeys,
  mapUsageByModel,
  resetSystem,
  saveApiKey,
  saveConfig,
  saveSettings,
} from '../../api/settings'
import type {
  InstinctItem,
  MemoryItem,
  ProjectContext,
  ProjectItem,
  RunItem,
  SkillItem,
  SpecItem,
  TaskItem,
} from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'
import { StatusBadge } from '../common/StatusBadge'
import { EmptyState } from '../common/ViewStateFeedback'
import { ContextView } from '../context/ContextView'
import { InstinctsView } from '../instincts/InstinctsView'
import { MemoryView } from '../memory/MemoryView'
import { PlanBoardView } from '../plan/PlanBoardView'
import { RunsEvidenceView } from '../runs/RunsEvidenceView'
import { SkillsView } from '../skills/SkillsView'
import { SpecsView } from '../specs/SpecsView'

export type SettingsSection =
  | 'general'
  | 'health'
  | 'api_models'
  | 'model_routing'
  | 'executor'
  | 'usage'
  | 'danger_zone'
  | 'language'
  | string // For individual project IDs like "project_<id>"

export type ProjectSubTab =
  | 'tasks'
  | 'runs'
  | 'graph'
  | 'memory'
  | 'specs'
  | 'skills'
  | 'instincts'
  | 'plan'

interface OrchestSettingsViewProps {
  onBackToApp: () => void
  projects: ProjectItem[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  currentTheme: string
  onSelectTheme: (theme: string) => void
  language: 'en' | 'es'
  onSelectLanguage: (lang: 'en' | 'es') => void
  initialSection?: SettingsSection
  initialProjectTab?: ProjectSubTab
  tasks: TaskItem[]
  taskError?: string | null
  runs: RunItem[]
  specs: SpecItem[]
  memories: MemoryItem[]
  skills: SkillItem[]
  instincts: InstinctItem[]
  projectContext?: ProjectContext
  onApproveSpec?: (id: string) => void
  onDraftSpec?: (id: string) => void
  onLintSpec?: (id: string) => void
  onForgetMemory?: (id: string) => void
  onRecordMemory?: (content: string, type: 'semantic' | 'procedural' | 'episodic') => void
  onResolveConflict?: (id: string, resolvedContent: string) => void
  onToggleSkill?: (id: string) => void
  onCompileSkill?: (skillId: string) => Promise<{ paths: string[] }>
  onTeachInstinct?: (when: string, then: string) => void
  onApproveInstinct?: (id: string) => void
  onRejectInstinct?: (id: string) => void
  onAddInstinct?: (trigger: string, action: string) => void
  onRunTask?: (taskId: string) => void
  onExplainTask?: (taskId: string) => void | Promise<Record<string, unknown> | void>
  onAddTask?: () => void
  onRefreshGraph?: () => void
  graphRefreshing?: boolean
  onRunNextTask?: () => void
  canRunNextTask?: boolean
  onOpenChat?: () => void
  onPurgeProjectData?: (projectId: string) => void
  onResetOrchestos?: () => void
  onAddProject?: () => void
  projectTabsLoading?: boolean
  projectTabsError?: string | null
}

export const OrchestSettingsView: React.FC<OrchestSettingsViewProps> = ({
  onBackToApp,
  projects,
  activeProjectId,
  onSelectProject,
  currentTheme,
  onSelectTheme,
  language,
  onSelectLanguage,
  initialSection = 'general',
  initialProjectTab = 'tasks',
  tasks,
  taskError,
  runs,
  specs,
  memories,
  skills,
  instincts,
  projectContext,
  onApproveSpec,
  onDraftSpec,
  onLintSpec,
  onForgetMemory,
  onRecordMemory,
  onResolveConflict,
  onToggleSkill,
  onCompileSkill,
  onTeachInstinct,
  onApproveInstinct,
  onRejectInstinct,
  onAddInstinct,
  onRunTask,
  onExplainTask,
  onAddTask,
  onRefreshGraph,
  graphRefreshing = false,
  onRunNextTask,
  canRunNextTask = false,
  onOpenChat,
  onPurgeProjectData,
  onResetOrchestos,
  onAddProject,
  projectTabsLoading = false,
  projectTabsError = null,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectSubTab>(initialProjectTab)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeProjectId || projects[0]?.id || 'orchestos',
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Confirmation Modals
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [keyAssistantModal, setKeyAssistantModal] = useState<
    'openrouter' | 'anthropic' | 'openai' | null
  >(null)
  const [assistantKeyInput, setAssistantKeyInput] = useState('')

  // Feedback notifications
  const [savedBanner, setSavedBanner] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2400)
  }

  const showSaveSuccess = (sectionName: string) => {
    setSavedBanner(sectionName)
    showToast(language === 'es' ? `Guardado: ${sectionName}` : `Saved ${sectionName}`)
    setTimeout(() => setSavedBanner(null), 2500)
  }

  // API Keys state
  const [apiKeys, setApiKeys] = useState({
    openrouter: { set: false, masked: '', newKey: '' },
    anthropic: { set: false, masked: '', newKey: '' },
    openai: { set: false, masked: '', newKey: '' },
    ollama: { set: false, masked: '' },
  })
  const [setup, setSetup] = useState<SetupResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [localProvider, setLocalProvider] = useState<LocalProviderResponse | null>(null)
  const [executorModes, setExecutorModes] = useState<ExecutorModesResponse | null>(null)
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  type RoutingAgent = {
    id: string
    installed: boolean
    models: { id: string; name: string }[]
    efforts: string[]
    error?: string
  }
  type RoutingRule = {
    match: { output?: string[]; skill?: string }
    agent: string
    cli_effort?: string
  }
  const [routingCatalog, setRoutingCatalog] = useState<RoutingAgent[]>([])
  const [routingRoles, setRoutingRoles] = useState<
    Record<string, { agent: string; model: string; effort?: string } | null>
  >({})
  const [taskAgentRules, setTaskAgentRules] = useState<RoutingRule[]>([])
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [ollamaHost, setOllamaHost] = useState('')

  // Model Routing state
  const [isTaskModelTableOpen, setIsTaskModelTableOpen] = useState(false)

  // Searchable combobox open state
  const [activeComboboxRole, setActiveComboboxRole] = useState<string | null>(null)
  const [comboboxSearch, setComboboxSearch] = useState('')

  // Default agent & executor state (Orca Agents pattern)
  const [defaultAgent, setDefaultAgent] = useState<string>('Auto')
  const [apiMode, setApiMode] = useState<'single-shot' | 'agentic'>('single-shot')
  const [maxIterations, setMaxIterations] = useState<number>(15)
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(20)

  // Daily activity hover inspector
  const [hoveredActivityDay, setHoveredActivityDay] = useState<{
    dateStr: string
    runs: number
  } | null>(null)
  const activityScrollRef = React.useRef<HTMLDivElement>(null)

  // Single source of truth for usage telemetry (KPIs & table in sync)
  const modelUsageRows = usage
    ? mapUsageByModel(usage).map((row) => ({ ...row, tokens: row.tokens.toLocaleString() }))
    : []
  const usageGroups = React.useMemo(() => {
    const normalized = modelUsageRows.flatMap((row) => {
      const raw = row.model.replace(/^(anthropic|openai|google|xai|mistral)\//, '')
      const cliMatch = `${row.provider ?? ''} ${raw}`.match(
        /(claude|codex|opencode)\s*(?:code)?\s*cli/i,
      )
      const cli =
        cliMatch?.[1]?.toLowerCase() ??
        (['claude', 'codex', 'opencode'].includes(row.provider ?? '') ? row.provider : null)
      const model = raw
        .replace(/\s+via\s+(?:Claude|Codex|OpenCode) CLI/i, '')
        .replace(/\s*\(effort: [^)]+\)/i, '')
        .replace(/\s*\([^)]*model[^)]*\)/i, '')
        .trim()
      if (/^unknown$/i.test(model)) return []
      return [{ ...row, model: model || 'default', provider: cli ?? row.provider }]
    })
    const grouped = new Map<string, (typeof normalized)[number]>()
    for (const row of normalized) {
      const key = `${row.provider ?? ''}\u0000${row.model}`
      const current = grouped.get(key)
      if (current) {
        current.runs += row.runs
        current.tokens = (
          Number(current.tokens.replaceAll(',', '')) + Number(row.tokens.replaceAll(',', ''))
        ).toLocaleString()
        current.spend += row.spend
      } else grouped.set(key, { ...row })
    }
    const rows = [...grouped.values()]
    const cli = rows.filter((row) => ['claude', 'codex', 'opencode'].includes(row.provider ?? ''))
    const api = rows.filter((row) => !cli.includes(row))
    return [
      { id: 'cli', label: 'CLI', rows: cli },
      { id: 'api', label: 'API', rows: api },
    ].filter((group) => group.rows.length > 0)
  }, [modelUsageRows])
  const totalRunsUsage = usage?.totalRuns ?? 0
  const totalSpendUsage = usage?.totalUsd ?? 0
  const avgCostUsage = totalRunsUsage ? (totalSpendUsage / totalRunsUsage).toFixed(3) : '0.000'

  React.useEffect(() => {
    let disposed = false
    setSettingsLoading(true)
    Promise.all([
      getSettings(),
      getSetup(),
      getHealth(),
      getLocalProvider(),
      getExecutorModes(),
      getUsage(),
      getConfig(activeProjectId),
      fetch('/api/models/catalog').then((response) => response.json()),
    ])
      .then(
        ([
          settings,
          nextSetup,
          nextHealth,
          nextLocal,
          nextModes,
          nextUsage,
          nextConfig,
          nextCatalog,
        ]) => {
          if (disposed) return
          const keys = mapSettingsKeys(settings)
          setApiKeys({
            openrouter: { ...keys.openrouter, newKey: '' },
            anthropic: { ...keys.anthropic, newKey: '' },
            openai: { ...keys.openai, newKey: '' },
            ollama: keys.ollama,
          })
          setOllamaHost(keys.ollama.masked)
          setSetup(nextSetup)
          setHealth(nextHealth)
          setLocalProvider(nextLocal)
          setExecutorModes(nextModes)
          setUsage(nextUsage)
          setConfig(nextConfig)
          setRoutingCatalog(nextCatalog.agents ?? [])
          const routed = nextConfig as ConfigResponse & {
            roleAssignments?: Record<
              string,
              { agent: string; model: string; effort?: string } | null
            >
            taskAgentRules?: RoutingRule[]
          }
          setRoutingRoles(routed.roleAssignments ?? {})
          setTaskAgentRules(routed.taskAgentRules ?? [])
          setDefaultAgent(
            nextConfig.agent === 'api'
              ? 'API'
              : nextConfig.agent
                ? nextConfig.agent[0].toUpperCase() + nextConfig.agent.slice(1)
                : 'Auto',
          )
          setApiMode(nextConfig.apiMode)
          setMaxIterations(nextConfig.agenticMaxIterations)
          setTimeoutMinutes(nextConfig.externalTimeoutMinutes)
          setSettingsError(null)
        },
      )
      .catch((error: unknown) => {
        if (!disposed)
          setSettingsError(error instanceof Error ? error.message : 'Settings could not be loaded')
      })
      .finally(() => {
        if (!disposed) setSettingsLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [activeProjectId])

  const refreshSettings = async () => {
    const [settings, nextConfig] = await Promise.all([getSettings(), getConfig(activeProjectId)])
    const keys = mapSettingsKeys(settings)
    setApiKeys((current) => ({
      openrouter: { ...keys.openrouter, newKey: current.openrouter.newKey },
      anthropic: { ...keys.anthropic, newKey: current.anthropic.newKey },
      openai: { ...keys.openai, newKey: current.openai.newKey },
      ollama: keys.ollama,
    }))
    setOllamaHost(keys.ollama.masked)
    setConfig(nextConfig)
  }

  const handleSaveKey = async (provider: 'openrouter' | 'anthropic' | 'openai') => {
    const key = apiKeys[provider].newKey.trim()
    if (!key) return
    try {
      await saveApiKey(provider, key)
      await refreshSettings()
      setApiKeys((current) => ({ ...current, [provider]: { ...current[provider], newKey: '' } }))
      showSaveSuccess('API keys')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save API key')
    }
  }

  const handleSaveAssistantKey = async () => {
    if (!keyAssistantModal || !assistantKeyInput.trim()) return
    try {
      await saveApiKey(keyAssistantModal, assistantKeyInput.trim())
      await refreshSettings()
      setKeyAssistantModal(null)
      setAssistantKeyInput('')
      showSaveSuccess(language === 'es' ? 'clave API' : 'API key')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save API key')
    }
  }

  const handleSaveOllama = async () => {
    try {
      await saveSettings({ OLLAMA_HOST: ollamaHost.trim() })
      await refreshSettings()
      setLocalProvider(await getLocalProvider())
      showSaveSuccess(language === 'es' ? 'configuración de Ollama' : 'Ollama settings')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save Ollama settings')
    }
  }

  const handleSaveRouting = async () => {
    try {
      await saveConfig({ roleAssignments: routingRoles, taskAgentRules }, activeProjectId)
      const updated = (await getConfig(activeProjectId)) as ConfigResponse & {
        roleWarnings?: string[]
        roleAssignments?: Record<string, { agent: string; model: string; effort?: string } | null>
        taskAgentRules?: RoutingRule[]
      }
      setConfig(updated)
      setRoutingRoles(updated.roleAssignments ?? {})
      setTaskAgentRules(updated.taskAgentRules ?? [])
      showSaveSuccess('Model routing')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save model routing')
    }
  }

  const handleSaveExecutor = async () => {
    try {
      const agent = defaultAgent === 'Auto' ? null : defaultAgent.toLowerCase()
      await saveConfig(
        {
          agent,
          apiMode,
          agenticMaxIterations: maxIterations,
          externalTimeoutMinutes: timeoutMinutes,
        },
        activeProjectId,
      )
      showSaveSuccess('Executor')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save executor settings')
    }
  }

  // Daily activity cells with uniform style and date tooltips
  const dailyActivityCells = React.useMemo(() => {
    const cells: Array<{
      id: number
      dateStr: string
      runs: number
      intensity: 0 | 1 | 2 | 3 | 4
      tooltip: string
    }> = []
    const now = new Date()
    for (let i = 370; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateKey = d.toISOString().slice(0, 10)
      const runs = (usage?.byDayModel ?? [])
        .filter((row) => row.date === dateKey)
        .reduce((total, row) => total + row.runs, 0)
      const intensity: 0 | 1 | 2 | 3 | 4 =
        runs === 0 ? 0 : runs < 2 ? 1 : runs < 5 ? 2 : runs < 10 ? 3 : 4
      const dateStr = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const tooltip =
        runs === 0
          ? language === 'es'
            ? `Sin actividad el ${dateStr}`
            : `No activity on ${dateStr}`
          : language === 'es'
            ? `${runs} ${runs === 1 ? 'ejecución' : 'ejecuciones'} el ${dateStr}`
            : `${runs} ${runs === 1 ? 'run' : 'runs'} on ${dateStr}`

      cells.push({
        id: i,
        dateStr,
        runs,
        intensity,
        tooltip,
      })
    }
    return cells
  }, [language, usage])

  React.useEffect(() => {
    if (activeSection !== 'usage') return
    const element = activityScrollRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [activeSection, dailyActivityCells.length])

  const AGENTS_LIST = [
    {
      id: 'Auto',
      name: 'Auto',
      isCli: false,
      installed: true,
      icon: <Sparkles className="w-5 h-5 text-sky-400" />,
    },
    {
      id: 'Claude',
      name: 'Claude',
      isCli: true,
      installed: true,
      icon: <ProviderLogo id="claude" className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'Codex',
      name: 'Codex',
      isCli: true,
      installed: true,
      icon: <ProviderLogo id="codex" className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'OpenCode',
      name: 'OpenCode',
      isCli: true,
      installed: false,
      icon: <Terminal className="w-5 h-5 text-zinc-400" />,
    },
    {
      id: 'Local',
      name: 'Local',
      isCli: false,
      installed: true,
      icon: <Server className="w-5 h-5 text-purple-400" />,
    },
    {
      id: 'API',
      name: 'API',
      isCli: false,
      installed: true,
      icon: <Globe className="w-5 h-5 text-blue-400" />,
    },
  ]

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0]

  const themeOptions = [
    {
      id: 'orchestos',
      name: 'OrchestOS',
      desc:
        language === 'es'
          ? 'Fondo marino profundo (#080c14) con acentos celestes'
          : 'Default deep navy canvas (#080c14) with sky accents',
      bgHex: '#080c14',
      surfaceHex: '#0f172a',
      accentHex: '#38bdf8',
    },
    {
      id: 'graphite',
      name: 'Graphite',
      desc:
        language === 'es'
          ? 'Pizarra oscura suave con perfiles en gris frío'
          : 'Subtle slate studio dark with cool gray contours',
      bgHex: '#18181b',
      surfaceHex: '#27272a',
      accentHex: '#a1a1aa',
    },
    {
      id: 'carbon',
      name: 'Carbon',
      desc:
        language === 'es'
          ? 'Tono negro carbón puro (#09090b) de alto contraste'
          : 'Minimalist pitch-black tone (#09090b) with high contrast',
      bgHex: '#09090b',
      surfaceHex: '#18181b',
      accentHex: '#f4f4f5',
    },
    {
      id: 'light',
      name: 'Light',
      desc:
        language === 'es'
          ? 'Diseño diurno limpio y de alta legibilidad'
          : 'Clean crisp daylight theme with high contrast typography',
      bgHex: '#f8fafc',
      surfaceHex: '#ffffff',
      accentHex: '#0284c7',
    },
  ]

  const isProjectSection = activeSection.startsWith('project_')

  // Handle clicking a specific project navigation item
  const handleNavToProject = (projId: string) => {
    setSelectedProjectId(projId)
    onSelectProject(projId)
    setActiveSection(`project_${projId}`)
  }

  return (
    <div className="flex-1 flex h-full bg-app-bg text-app overflow-hidden select-none">
      {/* Settings Navigation Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-app bg-app-surface/50 flex flex-col justify-between overflow-y-auto">
        <div className="p-3.5 space-y-4">
          {/* Back to App button */}
          <button
            type="button"
            onClick={onBackToApp}
            className="flex items-center gap-2 text-xs font-semibold text-app-muted hover:text-app transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent group-hover:-translate-x-0.5 transition-transform" />
            <span>{language === 'es' ? 'Volver a la app' : 'Back to app'}</span>
          </button>

          {/* Search settings input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'es' ? 'Buscar configuración...' : 'Search settings...'}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted font-mono"
            />
          </div>

          {/* Settings Groups matching the real application structure */}
          <div className="space-y-4 pt-1 text-xs">
            {/* GROUP 1: WORKSPACE */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-app-muted tracking-wider uppercase px-2 mb-1">
                WORKSPACE
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('general')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'general'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-sky-400" />
                <span>General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('health')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'health'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Health</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </button>
            </div>

            {/* GROUP 2: CONFIGURE */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-app-muted tracking-wider uppercase px-2 mb-1">
                CONFIGURE
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('api_models')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'api_models'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>API & Models</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('model_routing')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'model_routing'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Model routing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('executor')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'executor'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-teal-400" />
                <span>Executor</span>
              </button>
            </div>

            {/* GROUP 3: OBSERVE */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-app-muted tracking-wider uppercase px-2 mb-1">
                OBSERVE
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('usage')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'usage'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Usage</span>
              </button>
            </div>

            {/* GROUP 4: PROTECT */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-app-muted tracking-wider uppercase px-2 mb-1">
                PROTECT
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('danger_zone')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'danger_zone'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Danger zone</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('language')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-control text-left transition-colors ${
                  activeSection === 'language'
                    ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                    : 'text-app-muted hover:text-app hover:bg-app-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Language</span>
                </div>
                <span className="text-[10px] font-mono text-app-muted uppercase">{language}</span>
              </button>
            </div>

            {/* GROUP 5: PROJECTS (Individual item per project) */}
            <div className="space-y-0.5 pt-1">
              <div className="text-[10px] font-bold text-app-muted tracking-wider uppercase px-2 mb-1 flex items-center justify-between">
                <span>PROJECTS</span>
                {onAddProject && (
                  <button
                    type="button"
                    onClick={onAddProject}
                    className="text-app-muted hover:text-app p-0.5"
                    title="Add project"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-app-muted font-mono">
                  No projects registered
                </div>
              ) : (
                projects.map((p) => {
                  const isCurrent = activeSection === `project_${p.id}`
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleNavToProject(p.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-control text-left transition-colors truncate ${
                        isCurrent
                          ? 'bg-app-elevated text-app font-semibold border border-app shadow-xs'
                          : 'text-app-muted hover:text-app hover:bg-app-surface'
                      }`}
                    >
                      <FolderClosed className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Settings Content Area */}
      <main className="relative flex-1 flex flex-col overflow-hidden bg-app-bg text-app">
        {/* Save confirmation banner */}
        {savedBanner && (
          <div className="bg-emerald-950/60 border-b border-emerald-800/60 px-4 py-2 flex items-center gap-2 text-xs text-emerald-300 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved {savedBanner} configuration successfully.</span>
          </div>
        )}
        {settingsLoading && !settingsError && (
          <div className="absolute inset-x-0 top-0 z-10 pointer-events-none px-4 py-2 text-xs text-app-muted font-mono">
            Loading live settings…
          </div>
        )}
        {settingsError && (
          <div className="px-4 py-2 border-b border-rose-800/60 bg-rose-950/30 text-xs text-rose-300">
            {settingsError}
          </div>
        )}

        {/* SECTION: GENERAL — APPEARANCE */}
        {activeSection === 'general' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Appearance</h1>
              <p className="text-xs text-app-muted mt-1">
                {language === 'es'
                  ? 'Personaliza la paleta visual y el tema del sistema.'
                  : 'Customize system appearance and color themes.'}
              </p>
            </div>

            {/* 4 Theme cards with color swatches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themeOptions.map((th) => {
                const isSelected = currentTheme === th.id
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => onSelectTheme(th.id)}
                    className={`text-left p-3.5 rounded-card border transition-all ${
                      isSelected
                        ? 'bg-app-elevated border-app-accent text-app shadow-xs'
                        : 'bg-app-surface border-app text-app-muted hover:text-app hover:border-app'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-app">{th.name}</span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-app-accent bg-app-bg px-1.5 py-0.5 rounded-pill border border-app-accent/40">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-app-muted mb-3">{th.desc}</p>

                    {/* Color Swatch Preview */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-control bg-app-bg border border-app">
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-700/60 flex-shrink-0"
                        style={{ backgroundColor: th.bgHex }}
                        title="Canvas Background"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-700/60 flex-shrink-0"
                        style={{ backgroundColor: th.surfaceHex }}
                        title="Surface"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-700/60 flex-shrink-0"
                        style={{ backgroundColor: th.accentHex }}
                        title="Accent"
                      />
                      <span className="text-[10px] font-mono text-app-muted ml-auto">
                        {th.bgHex}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION: HEALTH */}
        {activeSection === 'health' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Project Health</h1>
              <p className="text-xs text-app-muted mt-1">
                Runtime readiness, blocked task contracts, and review queues.
              </p>
            </div>

            <div className="space-y-3">
              {/* Row 1: System prerequisites */}
              <div className="rounded-card border border-app bg-app-surface p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-app flex items-center gap-2">
                    {health ? (
                      <CheckCircle2
                        className={`w-4 h-4 ${health.system.ready ? 'text-emerald-400' : 'text-amber-400'}`}
                      />
                    ) : (
                      <span
                        className="w-4 h-4 rounded-full border border-app-muted border-t-app-accent animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {health
                        ? health.system.ready
                          ? 'All prerequisites met'
                          : 'Setup needs attention'
                        : 'Checking prerequisites…'}
                    </span>
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    {health
                      ? `${health.system.items.filter((item) => item.ok).length}/${health.system.items.length} system checks passing in ${setup?.cwd || health.system.cwd}.`
                      : settingsError || 'Checking system checks…'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showSaveSuccess('Health Diagnostics')}
                  className="px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:border-app-accent text-xs font-semibold"
                >
                  View
                </button>
              </div>

              {/* Row 2: Blocked tasks */}
              <div className="rounded-card border border-app bg-app-surface p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-app">Blocked tasks</div>
                  <div className="text-xs text-app-muted mt-0.5">
                    {health?.blockedTasks.length ?? 0} contract violations currently halting
                    worktrees.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('tasks')
                  }}
                  className="px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:border-app-accent text-xs font-semibold"
                >
                  View
                </button>
              </div>

              {/* Row 3: Pending review */}
              <div className="rounded-card border border-app bg-app-surface p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-app">Pending review</div>
                  <div className="text-xs text-app-muted mt-0.5">
                    {health
                      ? `${health.pendingApproval.draftSpecs} draft specs and ${health.pendingApproval.unverifiedInstincts} instincts awaiting approval.`
                      : 'Loading approval queue...'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('specs')
                  }}
                  className="px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:border-app-accent text-xs font-semibold"
                >
                  View
                </button>
              </div>

              {/* Row 4: 7 days cost */}
              <div className="rounded-card border border-app bg-app-surface p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-app">Last 7 days cost</div>
                  <div className="text-xs text-app-muted mt-0.5">
                    ${health?.costLast7d.toFixed(2) ?? '0.00'} spent across the last 7 days.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('usage')}
                  className="px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:border-app-accent text-xs font-semibold"
                >
                  View
                </button>
              </div>

              {/* Row 5: Recent learnings */}
              <div className="rounded-card border border-app bg-app-surface p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-app">Recent learnings</div>
                  <div className="text-xs text-app-muted mt-0.5">
                    {health?.recentLearnings.length ?? 0} recent verified learnings.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('instincts')
                  }}
                  className="px-3 py-1.5 rounded-control bg-app-elevated border border-app text-app hover:border-app-accent text-xs font-semibold"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: API & MODELS */}
        {activeSection === 'api_models' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">API Keys & Models</h1>
              <p className="text-xs text-app-muted mt-1">
                Configure gateway credentials and local inference endpoints.
              </p>
            </div>

            <div className="space-y-3">
              {/* OpenRouter Row */}
              <div className="rounded-card border border-app bg-app-surface p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProviderLogo id="gemini" className="w-4 h-4 text-app-accent" />
                    <span className="font-semibold text-app">OpenRouter API</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-pill border ${
                        apiKeys.openrouter.set
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {apiKeys.openrouter.set ? 'Set' : 'Not set'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeyAssistantModal('openrouter')}
                    className="px-3 py-1 rounded-control bg-app-elevated border border-app text-xs text-app font-medium hover:border-app-accent"
                  >
                    Save key
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-app-muted">
                    {apiKeys.openrouter.masked}
                  </span>
                  <input
                    type="password"
                    placeholder="Replace with new key..."
                    value={apiKeys.openrouter.newKey}
                    onChange={(e) =>
                      setApiKeys((prev) => ({
                        ...prev,
                        openrouter: { ...prev.openrouter, newKey: e.target.value },
                      }))
                    }
                    className="flex-1 max-w-xs px-2.5 py-1 bg-app-bg border border-app rounded-control font-mono text-xs text-app"
                  />
                </div>
              </div>

              {/* Anthropic Row */}
              <div className="rounded-card border border-app bg-app-surface p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProviderLogo id="claude" className="w-4 h-4" />
                    <span className="font-semibold text-app">Anthropic API</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-pill border ${
                        apiKeys.anthropic.set
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {apiKeys.anthropic.set ? 'Set' : 'Not set'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeyAssistantModal('anthropic')}
                    className="px-3 py-1 rounded-control bg-app-elevated border border-app text-xs text-app font-medium hover:border-app-accent"
                  >
                    Save key
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-app-muted">
                    {apiKeys.anthropic.masked}
                  </span>
                  <input
                    type="password"
                    placeholder="Replace with new key..."
                    value={apiKeys.anthropic.newKey}
                    onChange={(e) =>
                      setApiKeys((prev) => ({
                        ...prev,
                        anthropic: { ...prev.anthropic, newKey: e.target.value },
                      }))
                    }
                    className="flex-1 max-w-xs px-2.5 py-1 bg-app-bg border border-app rounded-control font-mono text-xs text-app"
                  />
                </div>
              </div>

              {/* OpenAI Row */}
              <div className="rounded-card border border-app bg-app-surface p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProviderLogo id="codex" className="w-4 h-4" />
                    <span className="font-semibold text-app">OpenAI API</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-pill border ${
                        apiKeys.openai.set
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {apiKeys.openai.set ? 'Set' : 'Not set'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeyAssistantModal('openai')}
                    className="px-3 py-1 rounded-control bg-app-elevated border border-app text-xs text-app font-medium hover:border-app-accent"
                  >
                    Save key
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-app-muted">{apiKeys.openai.masked}</span>
                  <input
                    type="password"
                    placeholder="Replace with new key..."
                    value={apiKeys.openai.newKey}
                    onChange={(e) =>
                      setApiKeys((prev) => ({
                        ...prev,
                        openai: { ...prev.openai, newKey: e.target.value },
                      }))
                    }
                    className="flex-1 max-w-xs px-2.5 py-1 bg-app-bg border border-app rounded-control font-mono text-xs text-app"
                  />
                </div>
              </div>

              {/* Local provider status */}
              <div className="rounded-card border border-app bg-app-surface p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-app">Ollama Local</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-pill border ${localProvider?.available ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                    >
                      {localProvider?.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div className="text-xs text-app-muted">
                    {localProvider?.models.length
                      ? `${localProvider.models.length} local model${localProvider.models.length === 1 ? '' : 's'} detected.`
                      : 'Ollama is not responding.'}
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-app bg-app-surface p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-app">Ollama URL</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveOllama()}
                    className="px-3 py-1 rounded-control bg-app-elevated border border-app text-xs text-app font-medium hover:border-app-accent"
                  >
                    Save URL
                  </button>
                </div>
                <input
                  type="url"
                  value={ollamaHost}
                  placeholder="http://localhost:11434"
                  onChange={(e) => setOllamaHost(e.target.value)}
                  className="w-full max-w-sm px-2.5 py-1 bg-app-bg border border-app rounded-control font-mono text-xs text-app"
                />
              </div>

              {/* Footnote + Save */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-app-muted">
                <p className="font-mono text-xs">
                  Leave a field blank to keep its current value. Stored in ~/.orchestos/.env
                </p>
                <span className="text-[10px] text-app-muted">
                  Keys are validated and saved per provider.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: MODEL ROUTING */}
        {activeSection === 'model_routing' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-app tracking-tight">Model routing config</h1>
                <p className="text-xs text-app-muted mt-1">
                  Assign specialist models to system orchestration roles.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-app-muted font-mono">
                  Source: {config?.source ? 'orchestos.config.yaml' : 'defaults'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(
                [
                  ['orchestrator', 'Orchestrator', 'Chat, drafts and task splitting'],
                  ['executor', 'Executor', 'Runs tasks'],
                  ['reviewer', 'Reviewer', 'QA, adversarial and refuter (read-only)'],
                  ['auxiliary', 'Auxiliary', 'Diagnose and memory judge (read-only)'],
                ] as const
              ).map(([key, label, desc]) => {
                const assignment = routingRoles[key] ?? null
                const agent = routingCatalog.find((entry) => entry.id === assignment?.agent)
                const selectedModels = agent?.models ?? []
                const selectedName = assignment?.model
                  ? (selectedModels.find((model) => model.id === assignment.model)?.name ??
                    assignment.model)
                  : undefined
                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-card border border-app bg-app-surface space-y-2 relative"
                  >
                    <div>
                      <div className="font-semibold text-app">{label}</div>
                      <div className="text-xs text-app-muted">{desc}</div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`${label} agent`}
                        aria-expanded={activeComboboxRole === `${key}-agent`}
                        onClick={() =>
                          setActiveComboboxRole(
                            activeComboboxRole === `${key}-agent` ? null : `${key}-agent`,
                          )
                        }
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app font-mono text-left"
                      >
                        <span>
                          {assignment?.agent
                            ? (AGENTS_LIST.find(
                                (entry) => entry.id.toLowerCase() === assignment.agent,
                              )?.name ?? assignment.agent)
                            : 'Unassigned'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                      </button>
                      {activeComboboxRole === `${key}-agent` && (
                        <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40 max-h-56 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setRoutingRoles((current) => ({ ...current, [key]: null }))
                              setActiveComboboxRole(null)
                            }}
                            className="block w-full text-left px-2.5 py-1.5 text-app"
                          >
                            Unassigned
                          </button>
                          {routingCatalog.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              disabled={!entry.installed}
                              onClick={() => {
                                setRoutingRoles((current) => ({
                                  ...current,
                                  [key]: { agent: entry.id, model: '' },
                                }))
                                setActiveComboboxRole(null)
                              }}
                              className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated disabled:opacity-50"
                            >
                              {entry.id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        disabled={!agent}
                        onClick={() => {
                          setActiveComboboxRole(activeComboboxRole === key ? null : key)
                          setComboboxSearch('')
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left disabled:opacity-50"
                      >
                        <span className="truncate">{selectedName || 'Select model'}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                      </button>
                      {activeComboboxRole === key && (
                        <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl p-2 z-40 max-h-56 overflow-y-auto">
                          <input
                            value={comboboxSearch}
                            onChange={(event) => setComboboxSearch(event.target.value)}
                            placeholder="Filter models..."
                            className="w-full px-2 py-1 bg-app-bg border border-app rounded-control text-xs text-app"
                          />
                          {assignment?.model &&
                            !selectedModels.some((model) => model.id === assignment.model) && (
                              <button
                                type="button"
                                className="block w-full text-left p-1.5 text-app"
                                onClick={() => setActiveComboboxRole(null)}
                              >
                                {assignment.model}
                              </button>
                            )}
                          {selectedModels
                            .filter((model) =>
                              `${model.name} ${model.id}`
                                .toLowerCase()
                                .includes(comboboxSearch.toLowerCase()),
                            )
                            .map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                className="block w-full text-left p-1.5 hover:bg-app-elevated text-app"
                                onClick={() => {
                                  setRoutingRoles((current) => ({
                                    ...current,
                                    [key]: assignment ? { ...assignment, model: model.id } : null,
                                  }))
                                  setActiveComboboxRole(null)
                                }}
                              >
                                {model.name}
                                <span className="ml-2 text-app-muted font-mono">{model.id}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {agent?.efforts.length ? (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`${label} effort`}
                          aria-expanded={activeComboboxRole === `${key}-effort`}
                          onClick={() =>
                            setActiveComboboxRole(
                              activeComboboxRole === `${key}-effort` ? null : `${key}-effort`,
                            )
                          }
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app font-mono text-left"
                        >
                          <span>{assignment?.effort ?? 'Default effort'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                        </button>
                        {activeComboboxRole === `${key}-effort` && (
                          <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40">
                            {['', ...agent.efforts].map((effort) => (
                              <button
                                key={effort || 'default'}
                                type="button"
                                onClick={() => {
                                  setRoutingRoles((current) => ({
                                    ...current,
                                    [key]: assignment
                                      ? { ...assignment, effort: effort || undefined }
                                      : null,
                                  }))
                                  setActiveComboboxRole(null)
                                }}
                                className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated"
                              >
                                {effort || 'Default effort'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {agent?.error && <div className="text-app-muted">{agent.error}</div>}
                    {key === 'reviewer' &&
                      (
                        config as (ConfigResponse & { roleWarnings?: string[] }) | null
                      )?.roleWarnings?.includes('reviewer-same-as-executor') && (
                        <div className="text-app-muted">
                          Same agent and model as Executor: errors may correlate.
                        </div>
                      )}
                  </div>
                )
              })}
            </div>
            <div className="rounded-card border border-app bg-app-surface text-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsTaskModelTableOpen(!isTaskModelTableOpen)}
                className="w-full p-3 flex items-center justify-between text-left font-semibold text-app hover:bg-app-elevated/40"
              >
                <span>Task rules ({taskAgentRules.length})</span>
                <ChevronDown
                  className={`w-4 h-4 text-app-muted transition-transform ${isTaskModelTableOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isTaskModelTableOpen && (
                <div className="p-3 border-t border-app space-y-2">
                  <p className="text-app-muted">The first matching rule wins.</p>
                  {taskAgentRules.map((rule, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <input
                        aria-label="output globs"
                        placeholder="output globs"
                        value={rule.match.output?.join(', ') ?? ''}
                        onChange={(event) =>
                          setTaskAgentRules((items) =>
                            items.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    match: {
                                      ...item.match,
                                      output: event.target.value
                                        .split(',')
                                        .map((v) => v.trim())
                                        .filter(Boolean),
                                    },
                                  }
                                : item,
                            ),
                          )
                        }
                        className="px-2 py-1.5 rounded-control bg-app-bg border border-app text-app"
                      />
                      <input
                        aria-label="skill"
                        placeholder="skill"
                        value={rule.match.skill ?? ''}
                        onChange={(event) =>
                          setTaskAgentRules((items) =>
                            items.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    match: {
                                      ...item.match,
                                      skill: event.target.value || undefined,
                                    },
                                  }
                                : item,
                            ),
                          )
                        }
                        className="px-2 py-1.5 rounded-control bg-app-bg border border-app text-app"
                      />
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="rule agent"
                          aria-expanded={activeComboboxRole === `rule-agent-${index}`}
                          onClick={() =>
                            setActiveComboboxRole(
                              activeComboboxRole === `rule-agent-${index}`
                                ? null
                                : `rule-agent-${index}`,
                            )
                          }
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app font-mono text-left"
                        >
                          <span>
                            {AGENTS_LIST.find((entry) => entry.id.toLowerCase() === rule.agent)
                              ?.name ?? rule.agent}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                        </button>
                        {activeComboboxRole === `rule-agent-${index}` && (
                          <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40 max-h-56 overflow-y-auto">
                            {['local', ...routingCatalog.map((entry) => entry.id)].map(
                              (agentId) => {
                                const catalogAgent = routingCatalog.find(
                                  (entry) => entry.id === agentId,
                                )
                                return (
                                  <button
                                    key={agentId}
                                    type="button"
                                    disabled={!!catalogAgent && !catalogAgent.installed}
                                    onClick={() => {
                                      setTaskAgentRules((items) =>
                                        items.map((item, i) =>
                                          i === index ? { ...item, agent: agentId } : item,
                                        ),
                                      )
                                      setActiveComboboxRole(null)
                                    }}
                                    className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated disabled:opacity-50"
                                  >
                                    {AGENTS_LIST.find((entry) => entry.id.toLowerCase() === agentId)
                                      ?.name ?? agentId}
                                  </button>
                                )
                              },
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <div className="relative min-w-0 flex-1">
                          <button
                            type="button"
                            aria-label="rule effort"
                            aria-expanded={activeComboboxRole === `rule-effort-${index}`}
                            onClick={() =>
                              setActiveComboboxRole(
                                activeComboboxRole === `rule-effort-${index}`
                                  ? null
                                  : `rule-effort-${index}`,
                              )
                            }
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app font-mono text-left"
                          >
                            <span>{rule.cli_effort ?? 'Default effort'}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                          </button>
                          {activeComboboxRole === `rule-effort-${index}` && (
                            <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40">
                              {[
                                '',
                                ...(routingCatalog.find((entry) => entry.id === rule.agent)
                                  ?.efforts ?? []),
                              ].map((effort) => (
                                <button
                                  key={effort || 'default'}
                                  type="button"
                                  onClick={() => {
                                    setTaskAgentRules((items) =>
                                      items.map((item, i) =>
                                        i === index
                                          ? { ...item, cli_effort: effort || undefined }
                                          : item,
                                      ),
                                    )
                                    setActiveComboboxRole(null)
                                  }}
                                  className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated"
                                >
                                  {effort || 'Default effort'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="Delete rule"
                          onClick={() =>
                            setTaskAgentRules((items) => items.filter((_, i) => i !== index))
                          }
                          className="p-1.5 text-app-muted hover:text-app"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setTaskAgentRules((items) => [
                        ...items,
                        {
                          match: {},
                          agent: routingCatalog.find((entry) => entry.installed)?.id ?? 'codex',
                        },
                      ])
                    }
                    className="px-2 py-1.5 rounded-control border border-app text-app"
                  >
                    Add rule
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => void handleSaveRouting()}
                className="px-4 py-1.5 rounded-control bg-app-accent text-zinc-950 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* SECTION: EXECUTOR / DEFAULT AGENT */}
        {activeSection === 'executor' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Default agent</h1>
              <p className="text-xs text-app-muted mt-1">
                Which agent runs the tasks OrchestOS creates. A task can override it with its own
                engine.
              </p>
            </div>

            {/* Group of large agent chips */}
            <div className="p-4 rounded-card border border-app bg-app-surface space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {AGENTS_LIST.map((agent) => {
                  const isSelected = defaultAgent === agent.name
                  const detected = executorModes?.modes.find(
                    (mode) => mode.id === agent.id.toLowerCase(),
                  )?.detected
                  const canUse = detected ?? agent.installed
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      disabled={!canUse}
                      onClick={() => {
                        setDefaultAgent(agent.name)
                        showToast(`Default agent: ${agent.name}`)
                      }}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-card border text-center transition-all min-h-[96px] ${
                        isSelected
                          ? 'bg-app-elevated border-app-accent shadow-xs text-app ring-1 ring-app-accent/40'
                          : canUse
                            ? 'bg-app-bg border-app text-app hover:border-app-accent/60 hover:bg-app-elevated/40 cursor-pointer'
                            : 'bg-app-bg/40 border-app/40 text-app-muted cursor-not-allowed opacity-45'
                      }`}
                    >
                      {/* Check badge when chosen */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-app-accent flex items-center justify-center text-zinc-950 shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      <div className="mb-2 flex items-center justify-center h-6">{agent.icon}</div>
                      <div className="text-xs font-semibold leading-tight text-app">
                        {agent.name}
                      </div>

                      {!canUse && (
                        <div className="text-[10px] text-zinc-500 font-mono mt-1 leading-none">
                          Not installed
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Conditional adjustment rows depending on chosen agent */}
            {/* If CLI (Claude, Codex, OpenCode): Timeout */}
            {['Claude', 'Codex', 'OpenCode'].includes(defaultAgent) && (
              <div className="rounded-card border border-app bg-app-surface divide-y divide-app">
                <div className="p-4 flex items-center justify-between text-xs gap-4">
                  <div>
                    <div className="font-semibold text-app">Timeout</div>
                    <div className="text-xs text-app-muted mt-0.5">
                      Stop the CLI if it runs longer than this
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = Math.max(1, timeoutMinutes - 5)
                        setTimeoutMinutes(nextVal)
                        showToast(`Timeout: ${nextVal} min`)
                      }}
                      className="w-7 h-7 rounded-control bg-app-elevated border border-app hover:border-app-accent flex items-center justify-center text-app transition-colors"
                      title="Decrease timeout"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 px-3 py-1 bg-app-bg border border-app rounded-control min-w-[70px] justify-center">
                      <span className="text-app font-semibold">{timeoutMinutes}</span>
                      <span className="text-app-muted text-[11px]">min</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = timeoutMinutes + 5
                        setTimeoutMinutes(nextVal)
                        showToast(`Timeout: ${nextVal} min`)
                      }}
                      className="w-7 h-7 rounded-control bg-app-elevated border border-app hover:border-app-accent flex items-center justify-center text-app transition-colors"
                      title="Increase timeout"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If API: Mode (Single-shot | Agentic) and Max iterations if Agentic */}
            {defaultAgent === 'API' && (
              <div className="rounded-card border border-app bg-app-surface divide-y divide-app">
                <div className="p-4 flex items-center justify-between text-xs gap-4">
                  <div>
                    <div className="font-semibold text-app">Mode</div>
                    <div className="text-xs text-app-muted mt-0.5">
                      Choose single-shot execution or agentic loop
                    </div>
                  </div>
                  <div className="flex items-center p-0.5 bg-app-bg border border-app rounded-control flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setApiMode('single-shot')
                        showToast('Mode: Single-shot')
                      }}
                      className={`px-3 py-1 rounded-xs text-xs font-medium transition-colors ${
                        apiMode === 'single-shot'
                          ? 'bg-app-elevated text-app font-semibold shadow-xs border border-app'
                          : 'text-app-muted hover:text-app'
                      }`}
                    >
                      Single-shot
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApiMode('agentic')
                        showToast('Mode: Agentic')
                      }}
                      className={`px-3 py-1 rounded-xs text-xs font-medium transition-colors ${
                        apiMode === 'agentic'
                          ? 'bg-app-elevated text-app font-semibold shadow-xs border border-app'
                          : 'text-app-muted hover:text-app'
                      }`}
                    >
                      Agentic
                    </button>
                  </div>
                </div>

                {apiMode === 'agentic' && (
                  <div className="p-4 flex items-center justify-between text-xs gap-4">
                    <div>
                      <div className="font-semibold text-app">Max iterations</div>
                      <div className="text-xs text-app-muted mt-0.5">
                        Stop recursive tool calls after this threshold
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-xs flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, maxIterations - 1)
                          setMaxIterations(nextVal)
                          showToast(`Max iterations: ${nextVal}`)
                        }}
                        className="w-7 h-7 rounded-control bg-app-elevated border border-app hover:border-app-accent flex items-center justify-center text-app transition-colors"
                        title="Decrease iterations"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center px-3 py-1 bg-app-bg border border-app rounded-control min-w-[50px] justify-center">
                        <span className="text-app font-semibold">{maxIterations}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = maxIterations + 1
                          setMaxIterations(nextVal)
                          showToast(`Max iterations: ${nextVal}`)
                        }}
                        className="w-7 h-7 rounded-control bg-app-elevated border border-app hover:border-app-accent flex items-center justify-center text-app transition-colors"
                        title="Increase iterations"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => void handleSaveExecutor()}
                className="px-4 py-1.5 rounded-control bg-app-accent text-zinc-950 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Save executor
              </button>
            </div>
          </div>
        )}

        {/* SECTION: USAGE */}
        {activeSection === 'usage' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Usage & Spend</h1>
              <p className="text-xs text-app-muted mt-1">
                Telemetry quotas, token costs, and daily executor activity.
              </p>
            </div>

            {/* 3 KPI cards at the top (exact same numbers computed from table data) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-card border border-app bg-app-surface space-y-1">
                <div className="text-xs font-mono text-app-muted uppercase">Total Spend</div>
                <div className="text-xl font-bold text-app font-mono">
                  ${totalSpendUsage.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-400">
                  {usage ? `${usage.byDayModel.length} telemetry rows` : 'Loading telemetry'}
                </div>
              </div>

              <div className="p-3.5 rounded-card border border-app bg-app-surface space-y-1">
                <div className="text-xs font-mono text-app-muted uppercase">Total Runs</div>
                <div className="text-xl font-bold text-app font-mono">{totalRunsUsage}</div>
                <div className="text-[10px] text-sky-400">
                  {modelUsageRows.length} models observed
                </div>
              </div>

              <div className="p-3.5 rounded-card border border-app bg-app-surface space-y-1">
                <div className="text-xs font-mono text-app-muted uppercase">Avg. Cost / Run</div>
                <div className="text-xl font-bold text-app font-mono">${avgCostUsage}</div>
                <div className="text-[10px] text-zinc-400">
                  {modelUsageRows[0]?.model
                    ? `Top model: ${modelUsageRows[0].model}`
                    : 'No model activity yet'}
                </div>
              </div>
            </div>

            {/* Daily Activity Heatmap */}
            <div className="p-4 rounded-card border border-app bg-app-surface space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-app">Daily activity</span>
                  {hoveredActivityDay && (
                    <span className="text-[11px] font-mono text-emerald-400">
                      {hoveredActivityDay.runs === 0
                        ? language === 'es'
                          ? `Sin actividad · ${hoveredActivityDay.dateStr}`
                          : `No activity · ${hoveredActivityDay.dateStr}`
                        : `${hoveredActivityDay.runs} ${hoveredActivityDay.runs === 1 ? 'run' : 'runs'} · ${hoveredActivityDay.dateStr}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-app-muted">
                  <span>less</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${currentTheme === 'light' ? 'bg-zinc-200' : 'bg-zinc-800/40'}`}
                  />
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${currentTheme === 'light' ? 'bg-emerald-200' : 'bg-emerald-950/90'}`}
                  />
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${currentTheme === 'light' ? 'bg-emerald-400' : 'bg-emerald-800'}`}
                  />
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${currentTheme === 'light' ? 'bg-emerald-600' : 'bg-emerald-600'}`}
                  />
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${currentTheme === 'light' ? 'bg-emerald-800' : 'bg-emerald-400'}`}
                  />
                  <span>more</span>
                </div>
              </div>

              {/* Heatmap grid */}
              <div ref={activityScrollRef} className="overflow-x-auto pb-1">
                <div className="flex gap-[3px] min-w-max mb-1 text-[10px] text-app-muted">
                  {Array.from({ length: 53 }, (_, week) => {
                    const first = dailyActivityCells[week * 7]
                    const previous = dailyActivityCells[(week - 1) * 7]
                    const month = first ? new Date(first.dateStr) : null
                    const previousMonth = previous ? new Date(previous.dateStr).getMonth() : -1
                    return (
                      <span key={`month-${week}`} className="w-[11px] shrink-0">
                        {month && month.getMonth() !== previousMonth
                          ? month.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
                              month: 'short',
                            })
                          : ''}
                      </span>
                    )
                  })}
                </div>
                <div className="flex gap-[3px] min-w-max">
                  {Array.from({ length: 53 }, (_, week) => (
                    <div key={`week-${week}`} className="flex w-[11px] shrink-0 flex-col gap-[3px]">
                      {dailyActivityCells.slice(week * 7, week * 7 + 7).map((cell) => {
                        const isLight = currentTheme === 'light'
                        const bgClass =
                          cell.intensity === 0
                            ? isLight
                              ? 'bg-zinc-200 hover:bg-zinc-300'
                              : 'bg-zinc-800/40 hover:bg-zinc-700/60'
                            : cell.intensity === 1
                              ? isLight
                                ? 'bg-emerald-200 hover:bg-emerald-300'
                                : 'bg-emerald-950/90 hover:bg-emerald-900'
                              : cell.intensity === 2
                                ? isLight
                                  ? 'bg-emerald-400 hover:bg-emerald-500'
                                  : 'bg-emerald-800 hover:bg-emerald-700'
                                : cell.intensity === 3
                                  ? isLight
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500'
                                  : isLight
                                    ? 'bg-emerald-800 hover:bg-emerald-900'
                                    : 'bg-emerald-400 hover:bg-emerald-300'

                        return (
                          <div
                            key={cell.id}
                            className={`w-[11px] h-[11px] rounded-[2px] transition-colors cursor-pointer ${bgClass}`}
                            title={cell.tooltip}
                            onMouseEnter={() =>
                              setHoveredActivityDay({ dateStr: cell.dateStr, runs: cell.runs })
                            }
                            onMouseLeave={() => setHoveredActivityDay(null)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spend by Model Table */}
            <div className="rounded-card border border-app bg-app-surface overflow-hidden text-xs">
              <div className="p-3 border-b border-app font-semibold text-app flex items-center justify-between">
                <span>Spend by model</span>
                <span className="text-[11px] font-mono text-app-muted">
                  {totalRunsUsage} total runs · ${totalSpendUsage.toFixed(2)}
                </span>
              </div>

              <table className="w-full text-left font-mono">
                <thead className="bg-app-elevated/60 text-app-muted border-b border-app text-xs">
                  <tr>
                    <th className="p-2.5 font-medium">Model</th>
                    <th className="p-2.5 font-medium">Runs</th>
                    <th className="p-2.5 font-medium">Tokens</th>
                    <th className="p-2.5 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app">
                  {usageGroups.map((group) => (
                    <React.Fragment key={group.id}>
                      <tr className="bg-app-elevated/30">
                        <th
                          colSpan={4}
                          className="p-2 text-left text-[10px] uppercase tracking-wider text-app-muted"
                        >
                          {group.label}
                        </th>
                      </tr>
                      {group.rows.map((row) => {
                        const model = row.model.replace(
                          /^(anthropic|openai|google|xai|mistral)\//,
                          '',
                        )
                        const displayModel = model
                        const logo =
                          group.id === 'cli'
                            ? row.provider === 'claude' || /Claude/i.test(row.model)
                              ? 'claude'
                              : row.provider === 'codex' || /Codex/i.test(row.model)
                                ? 'chatgpt'
                                : 'opencode'
                            : 'api'
                        return (
                          <tr
                            key={`${group.id}-${row.model}`}
                            className="hover:bg-app-elevated/20 transition-colors"
                          >
                            <td className="p-2.5 text-app">
                              <span className="inline-flex items-center gap-2">
                                <ProviderLogo id={logo} size={14} />
                                <span>{displayModel}</span>
                              </span>
                            </td>
                            <td className="p-2.5 text-app-muted">{row.runs}</td>
                            <td className="p-2.5 text-app-muted">{row.tokens}</td>
                            <td className="p-2.5 text-app font-semibold">
                              ${row.spend.toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION: DANGER ZONE (GLOBAL RESET) */}
        {activeSection === 'danger_zone' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Danger Zone</h1>
              <p className="text-xs text-app-muted mt-1">
                Destructive operations and system reset triggers.
              </p>
            </div>

            <div className="p-5 rounded-card border border-rose-800 bg-rose-950/20 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Reset OrchestOS</span>
              </div>
              <p className="text-app-muted leading-relaxed">
                Deletes all runs and unverified instincts, and resets every task in tasks.yaml back
                to pending. Does NOT touch config, skills, CONSTITUTION.md/CONTEXT.md, or memory.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
                >
                  Reset OrchestOS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: LANGUAGE */}
        {activeSection === 'language' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-app tracking-tight">Language / Idioma</h1>
              <p className="text-xs text-app-muted mt-1">
                {language === 'es'
                  ? 'Cambia toda la interfaz al instante.'
                  : 'Change application interface language instantly.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(['en', 'es'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelectLanguage(option)}
                  className={`p-4 rounded-card border text-left transition-all ${language === option ? 'bg-app-elevated border-app-accent text-app shadow-xs' : 'bg-app-surface border-app text-app-muted hover:text-app'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-app">
                      {option === 'en' ? 'English' : 'Español'}
                    </span>
                    {language === option && <Check className="w-4 h-4 text-app-accent" />}
                  </div>
                  <p className="text-xs text-app-muted">
                    {option === 'en'
                      ? 'English language interface'
                      : 'Interfaz completa en idioma español'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: SPECIFIC PROJECT PAGE */}
        {isProjectSection && selectedProject && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Project Header (Removed project switcher on the right as requested) */}
            <div className="p-4 border-b border-app bg-app-surface/40 flex-shrink-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-control bg-app-elevated border border-app flex items-center justify-center text-app-accent flex-shrink-0">
                  <FolderClosed className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-app tracking-tight">
                      {selectedProject.name}
                    </h1>
                    {selectedProject.branch && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-pill bg-app-surface border border-app text-app-muted">
                        {selectedProject.branch}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-app-muted mt-0.5">
                    {selectedProject.path}
                  </div>
                </div>
              </div>

              {/* Sub-tabs: Tasks | Runs | Graph | Memory | Specs | Skills | Instincts | Plan */}
              <div className="flex items-center gap-1 overflow-x-auto pt-1">
                {(
                  [
                    { id: 'tasks', label: 'Tasks', icon: Kanban },
                    { id: 'runs', label: 'Runs', icon: Activity },
                    { id: 'graph', label: 'Graph', icon: Layers },
                    { id: 'memory', label: 'Memory', icon: Brain },
                    { id: 'specs', label: 'Specs', icon: FileCheck },
                    { id: 'skills', label: 'Skills', icon: Sparkles },
                    { id: 'instincts', label: 'Instincts', icon: Zap },
                    { id: 'plan', label: 'Plan', icon: Kanban },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeProjectTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveProjectTab(tab.id)}
                      className={`app-tab-btn ${
                        isActive ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sub-tab view contents */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              {(projectTabsLoading || projectTabsError) && (
                <div
                  className={`px-4 py-2 text-xs ${projectTabsError ? 'text-rose-300 bg-rose-950/20' : 'text-app-muted'}`}
                >
                  {projectTabsError ?? 'Loading project data…'}
                </div>
              )}
              {/* TAB: Tasks */}
              {activeProjectTab === 'tasks' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-app">Project Task Contracts</h2>
                      <p className="text-xs text-app-muted">
                        Declared DAG tasks in <code>tasks.yaml</code> with output file boundaries.
                      </p>
                    </div>
                    {onRunNextTask && (
                      <button
                        type="button"
                        onClick={onRunNextTask}
                        disabled={!canRunNextTask}
                        aria-disabled={!canRunNextTask}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent text-zinc-950 font-semibold text-xs hover:opacity-90 transition-opacity"
                      >
                        <span>Run Next Task</span>
                      </button>
                    )}
                  </div>

                  {tasks.length === 0 ? (
                    <EmptyState
                      icon={Kanban}
                      title={taskError ? 'Tasks unavailable' : 'No Tasks Defined'}
                      description={
                        taskError ||
                        'Create a task contract in tasks.yaml or use Chat mode to draft a spec.'
                      }
                      actionLabel="Create First Task"
                      onAction={onOpenChat || (() => {})}
                    />
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-card border border-app bg-app-surface p-3 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-app">{task.id}</span>
                              <span className="text-app-muted">·</span>
                              <span className="text-app font-medium">
                                {task.title || task.description}
                              </span>
                            </div>
                            <StatusBadge status={task.status} />
                          </div>
                          <p className="text-xs text-app-muted">{task.description}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs text-app-muted">
                            <div>
                              Agent:{' '}
                              <span className="text-app">{task.assignedAgent || 'claude'}</span>
                            </div>
                            {task.outputSlice && (
                              <div>
                                Outputs:{' '}
                                <span className="text-app-accent">
                                  [{task.outputSlice.join(', ')}]
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Runs */}
              {activeProjectTab === 'runs' && <RunsEvidenceView runs={runs} />}

              {/* TAB: Graph */}
              {activeProjectTab === 'graph' &&
                (projectContext ? (
                  <ContextView
                    context={projectContext}
                    onRefreshGraph={onRefreshGraph || (() => {})}
                    isRefreshing={graphRefreshing}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-app-muted">
                    Loading project graph…
                  </div>
                ))}

              {/* TAB: Memory */}
              {activeProjectTab === 'memory' && (
                <MemoryView
                  memories={memories}
                  onResolveConflict={onResolveConflict || (() => {})}
                />
              )}

              {/* TAB: Specs */}
              {activeProjectTab === 'specs' && (
                <SpecsView
                  specs={specs}
                  onApproveSpec={onApproveSpec || (() => {})}
                  onDraftSpec={onDraftSpec || (() => {})}
                  onLintSpec={onLintSpec || (() => {})}
                />
              )}

              {/* TAB: Skills */}
              {activeProjectTab === 'skills' && (
                <SkillsView
                  skills={skills}
                  onCompileSkill={onCompileSkill || (async () => ({ paths: [] }))}
                />
              )}

              {/* TAB: Instincts */}
              {activeProjectTab === 'instincts' && (
                <InstinctsView
                  instincts={instincts}
                  onApproveInstinct={onApproveInstinct || (() => {})}
                  onRejectInstinct={onRejectInstinct || (() => {})}
                  onAddInstinct={onAddInstinct || (() => {})}
                />
              )}

              {/* TAB: Plan */}
              {activeProjectTab === 'plan' && (
                <PlanBoardView
                  tasks={tasks}
                  projectId={selectedProject?.id ?? activeProjectId}
                  onRunTask={onRunTask || (() => {})}
                  onExplainTask={onExplainTask || (() => {})}
                  onAddTask={onAddTask || (() => {})}
                />
              )}

              {/* DANGER ZONE AT THE BOTTOM OF THE PROJECT SETTINGS */}
              <div className="p-4 mt-8 border-t border-rose-900/40 bg-rose-950/10">
                <div className="rounded-card border border-rose-800/50 bg-rose-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Zona de peligro (Danger Zone)</span>
                  </div>
                  <p className="text-xs text-app-muted leading-relaxed">
                    Borra permanentemente los datos de este proyecto guardados en SQLite. No borra
                    la carpeta del proyecto.
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPurgeConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Borrar definitivamente los datos del proyecto</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog for Purging Project Data */}
      {showPurgeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card bg-app-surface border border-rose-800 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Data Purge</span>
            </div>
            <p className="text-app-muted leading-relaxed">
              This deletes the project's SQLite data. It does not delete the project folder.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-app">
              <button
                type="button"
                onClick={() => setShowPurgeConfirm(false)}
                className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onPurgeProjectData) onPurgeProjectData(selectedProject.id)
                  setShowPurgeConfirm(false)
                }}
                className="px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Yes, Purge Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Global OrchestOS Reset */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card bg-app-surface border border-rose-800 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>Confirm Reset OrchestOS</span>
            </div>
            <p className="text-app-muted leading-relaxed">
              Deletes all runs and unverified instincts, and resets every task in tasks.yaml back to
              pending. Does NOT touch config, skills, CONSTITUTION.md/CONTEXT.md, or memory.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-app">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void resetSystem()
                    .then(() => {
                      onResetOrchestos?.()
                      setShowResetConfirm(false)
                      showSaveSuccess('OrchestOS reset completed')
                    })
                    .catch((error: unknown) =>
                      showToast(error instanceof Error ? error.message : 'Reset failed'),
                    )
                }}
                className="px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {keyAssistantModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card bg-app-surface border border-app p-5 shadow-2xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-app">Configure {keyAssistantModal} key</h3>
            <p className="text-app-muted text-xs leading-relaxed">
              Enter your secret token. It is stored in your local OrchestOS environment.
            </p>
            <input
              type="password"
              value={assistantKeyInput}
              onChange={(e) => setAssistantKeyInput(e.target.value)}
              placeholder={`Paste ${keyAssistantModal} secret key...`}
              className="w-full p-2 rounded-control bg-app-bg border border-app text-app font-mono text-xs focus:border-app-accent focus:outline-hidden"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-app">
              <button
                type="button"
                onClick={() => {
                  setKeyAssistantModal(null)
                  setAssistantKeyInput('')
                }}
                className="px-3 py-1.5 rounded-control text-app-muted hover:text-app"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAssistantKey()}
                className="px-4 py-1.5 rounded-control bg-app-accent text-zinc-950 font-bold"
              >
                Save key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Toast Feedback (e.g. "Default agent: Codex") */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-control bg-zinc-900/95 border border-zinc-700/80 text-zinc-100 shadow-2xl font-mono text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
