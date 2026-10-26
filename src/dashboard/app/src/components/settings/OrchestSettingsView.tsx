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
  DollarSign,
  FileCheck,
  FolderClosed,
  Globe,
  Kanban,
  Key,
  Keyboard,
  Layers,
  Palette,
  Pencil,
  Plus,
  Search,
  Server,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react'
import { AnimatePresence, animate, motion } from 'motion/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PageHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { spring } from '@/lib/springs'
import type {
  ConfigResponse,
  CustomCliEntry,
  ExecutorModesResponse,
  HealthResponse,
  LocalProviderResponse,
  SetupResponse,
  UsageResponse,
} from '../../api/settings'
import {
  cliArgumentLines,
  getClis,
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
  saveClis,
  saveConfig,
  saveSettings,
} from '../../api/settings'
import { isTaskRunnable } from '../../api/tasks'
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
import { statusLabel } from '../common/StatusBadge'
import { EmptyState } from '../common/ViewStateFeedback'
import { ContextView } from '../context/ContextView'
import { InstinctsView } from '../instincts/InstinctsView'
import { ListHeader, ListRow } from '../layout/page'
import { MemoryView } from '../memory/MemoryView'
import { PlanBoardView } from '../plan/PlanBoardView'
import { RunsEvidenceView } from '../runs/RunsEvidenceView'
import { SkillsView } from '../skills/SkillsView'
import { SpecsView } from '../specs/SpecsView'
import { TASK_STATUS_DOT, TaskDetailPanel, taskTitle } from '../tasks/TaskDetailPanel'
import {
  SettingsGroup,
  SettingsPage,
  SettingsPrimaryAction,
  SettingsRow,
  SettingsSegmented,
  SettingsStepper,
} from './primitives'

type CliDraft = CustomCliEntry & {
  savedId?: string
  argsText: string
  modelArgsText: string
  modelsText: string
}
const cliDraft = (cli: CustomCliEntry): CliDraft => ({
  ...cli,
  savedId: cli.id || undefined,
  argsText: cli.args.join('\n'),
  modelArgsText: (cli.modelArgs ?? []).join('\n'),
  modelsText: (cli.models ?? []).join(', '),
})
const cliConfig = ({
  argsText,
  savedId: _savedId,
  modelArgsText,
  modelsText,
  installed: _installed,
  ...cli
}: CliDraft) => ({
  ...cli,
  args: cliArgumentLines(argsText),
  ...(modelArgsText ? { modelArgs: cliArgumentLines(modelArgsText) } : { modelArgs: undefined }),
  ...(modelsText
    ? {
        models: modelsText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }
    : { models: undefined }),
})

/** Espejo de `MAX_RETRIES` en `src/run/qa.ts`. */
const TASK_MAX_ATTEMPTS = 3

/** Hora del último run: hoy `HH:MM`, otro día `MMM D`. */
function formatRunTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay
    ? new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
        date,
      )
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}

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

type SettingsSearchEntry = {
  id: string
  section: SettingsSection
  label: { en: string; es: string }
  keywords: string[]
}

const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  {
    id: 'executor-clis',
    section: 'executor',
    label: { en: 'Custom CLIs', es: 'CLIs propios' },
    keywords: ['cli', 'custom', 'terminal', 'gemini', 'aider'],
  },
  {
    id: 'theme-orchestos',
    section: 'general',
    label: { en: 'OrchestOS', es: 'OrchestOS' },
    keywords: [
      'orchestos theme',
      'tema orchestos',
      'general',
      'appearance',
      'theme',
      'tema',
      'apariencia',
    ],
  },
  {
    id: 'theme-graphite',
    section: 'general',
    label: { en: 'Graphite', es: 'Graphite' },
    keywords: [
      'graphite theme',
      'tema graphite',
      'general',
      'appearance',
      'theme',
      'tema',
      'apariencia',
    ],
  },
  {
    id: 'theme-carbon',
    section: 'general',
    label: { en: 'Carbon', es: 'Carbon' },
    keywords: [
      'carbon theme',
      'tema carbon',
      'general',
      'appearance',
      'theme',
      'tema',
      'apariencia',
    ],
  },
  {
    id: 'theme-light',
    section: 'general',
    label: { en: 'Light', es: 'Light' },
    keywords: ['light theme', 'tema light', 'general', 'appearance', 'theme', 'tema', 'apariencia'],
  },
  {
    id: 'health',
    section: 'health',
    label: { en: 'Project health', es: 'Salud del proyecto' },
    keywords: [
      'health',
      'project health',
      'salud del proyecto',
      'system',
      'readiness',
      'diagnostics',
    ],
  },
  {
    id: 'api-openrouter',
    section: 'api_models',
    label: { en: 'OpenRouter API', es: 'OpenRouter API' },
    keywords: ['api', 'models', 'keys', 'claves', 'proveedor'],
  },
  {
    id: 'api-anthropic',
    section: 'api_models',
    label: { en: 'Anthropic API', es: 'Anthropic API' },
    keywords: ['api', 'models', 'keys', 'claves', 'proveedor'],
  },
  {
    id: 'api-openai',
    section: 'api_models',
    label: { en: 'OpenAI API', es: 'OpenAI API' },
    keywords: ['api', 'models', 'keys', 'claves', 'proveedor'],
  },
  {
    id: 'api-ollama',
    section: 'api_models',
    label: { en: 'Ollama Local', es: 'Ollama Local' },
    keywords: ['api', 'models', 'keys', 'claves', 'proveedor'],
  },
  {
    id: 'api-ollama-url',
    section: 'api_models',
    label: { en: 'Ollama URL', es: 'Ollama URL' },
    keywords: ['api', 'models', 'keys', 'claves', 'proveedor'],
  },
  {
    id: 'routing-orchestrator',
    section: 'model_routing',
    label: { en: 'Orchestrator', es: 'Orchestrator' },
    keywords: ['orchestrator', 'orquestador', 'model', 'routing', 'roles', 'modelos'],
  },
  {
    id: 'routing-executor',
    section: 'model_routing',
    label: { en: 'Executor', es: 'Executor' },
    keywords: ['executor', 'executor', 'model', 'routing', 'roles', 'modelos'],
  },
  {
    id: 'routing-reviewer',
    section: 'model_routing',
    label: { en: 'Reviewer', es: 'Reviewer' },
    keywords: ['reviewer', 'revisor', 'model', 'routing', 'roles', 'modelos'],
  },
  {
    id: 'routing-auxiliary',
    section: 'model_routing',
    label: { en: 'Auxiliary', es: 'Auxiliary' },
    keywords: ['auxiliary', 'auxiliar', 'model', 'routing', 'roles', 'modelos'],
  },
  {
    id: 'routing-rules',
    section: 'model_routing',
    label: { en: 'Task rules', es: 'Task rules' },
    keywords: ['task routing rules', 'reglas por tarea', 'model', 'routing', 'output', 'skill'],
  },
  {
    id: 'permissions',
    section: 'model_routing',
    label: { en: 'Agent permissions', es: 'Agent permissions' },
    keywords: ['agent permissions', 'permisos de agentes', 'manual', 'yolo', 'approval'],
  },
  {
    id: 'executor-timeout',
    section: 'executor',
    label: { en: 'Timeout', es: 'Timeout' },
    keywords: ['executor', 'execution', 'ejecutor', 'timeout', 'tiempo límite'],
  },
  {
    id: 'executor-mode',
    section: 'executor',
    label: { en: 'Mode', es: 'Mode' },
    keywords: ['executor', 'execution', 'ejecutor'],
  },
  {
    id: 'executor-iterations',
    section: 'executor',
    label: { en: 'Max iterations', es: 'Max iterations' },
    keywords: ['max iterations', 'máximo de iteraciones', 'executor', 'execution', 'ejecutor'],
  },
  {
    id: 'usage-spend',
    section: 'usage',
    label: { en: 'Total Spend', es: 'Total Spend' },
    keywords: ['total spend', 'gasto total', 'usage', 'spend', 'telemetry', 'consumo', 'costo'],
  },
  {
    id: 'usage-runs',
    section: 'usage',
    label: { en: 'Total Runs', es: 'Total Runs' },
    keywords: [
      'total runs',
      'ejecuciones totales',
      'usage',
      'spend',
      'telemetry',
      'consumo',
      'costo',
    ],
  },
  {
    id: 'usage-average',
    section: 'usage',
    label: { en: 'Avg. Cost / Run', es: 'Avg. Cost / Run' },
    keywords: [
      'avg. cost / run',
      'avg. cost / run',
      'usage',
      'spend',
      'telemetry',
      'consumo',
      'costo',
    ],
  },
  {
    id: 'usage-activity',
    section: 'usage',
    label: { en: 'Daily activity', es: 'Daily activity' },
    keywords: [
      'daily activity',
      'actividad diaria',
      'usage',
      'spend',
      'telemetry',
      'consumo',
      'costo',
    ],
  },
  {
    id: 'usage-models',
    section: 'usage',
    label: { en: 'Spend by model', es: 'Spend by model' },
    keywords: [
      'spend by model',
      'gasto por modelo',
      'usage',
      'spend',
      'telemetry',
      'consumo',
      'costo',
    ],
  },
  {
    id: 'reset',
    section: 'danger_zone',
    label: { en: 'Reset OrchestOS', es: 'Reset OrchestOS' },
    keywords: [
      'reset orchestos',
      'restablecer orchestos',
      'danger',
      'zone',
      'delete',
      'peligro',
      'borrar',
    ],
  },
  {
    id: 'language-en',
    section: 'language',
    label: { en: 'English', es: 'English' },
    keywords: ['language', 'idioma'],
  },
  {
    id: 'language-es',
    section: 'language',
    label: { en: 'Español', es: 'Español' },
    keywords: ['language', 'idioma'],
  },
]

const normalizeSettingsSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

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
  onRunNextTask?: () => void
  canRunNextTask?: boolean
  taskRunBusy?: boolean
  onOpenChat?: () => void
  onPurgeProjectData?: (projectId: string) => void | Promise<void>
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
  onRunNextTask,
  canRunNextTask = false,
  taskRunBusy = false,
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchIndex, setSearchIndex] = useState(0)
  const [searchDestination, setSearchDestination] = useState<SettingsSearchEntry | null>(null)
  const [highlightTarget, setHighlightTarget] = useState<HTMLElement | null>(null)
  const [highlightFading, setHighlightFading] = useState(false)
  const sidebarSearchRef = useRef<HTMLInputElement>(null)
  const paletteInputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const restoringSearchFocus = useRef(false)
  const settingsRootRef = useRef<HTMLDivElement>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Confirmation Modals
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editingKeyProvider, setEditingKeyProvider] = useState<
    'openrouter' | 'anthropic' | 'openai' | null
  >(null)

  const focusKeyInput = useCallback((input: HTMLInputElement | null) => input?.focus(), [])

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{
    message: string
    tone: 'success' | 'error'
  } | null>(null)
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage({ message, tone })
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2400)
  }

  const showSaveSuccess = (sectionName: string) => {
    showToast(language === 'es' ? `Guardado: ${sectionName}` : `Saved ${sectionName}`)
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
    taskEngine?: boolean
    generic?: boolean
    label?: string
    models: {
      id: string
      name: string
      efforts?: string[]
      group?: string
      vendor?: string
      default?: boolean
    }[]
    efforts: string[]
    error?: string
  }
  const ruleSequence = useRef(0)
  type RoutingRule = {
    localId?: number
    match: { output?: string[]; skill?: string }
    agent: string
    model?: string
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
  const [activeModelIndex, setActiveModelIndex] = useState(0)
  const comboboxSearchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (
      activeComboboxRole &&
      !activeComboboxRole.endsWith('-agent') &&
      !activeComboboxRole.endsWith('-effort')
    ) {
      comboboxSearchRef.current?.focus()
    }
  }, [activeComboboxRole])

  // Default agent & executor state (Orca Agents pattern)
  const [apiMode, setApiMode] = useState<'single-shot' | 'agentic'>('single-shot')
  const [maxIterations, setMaxIterations] = useState<number>(15)
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(20)

  const [customClis, setCustomClis] = useState<CliDraft[]>([])
  const [editingCli, setEditingCli] = useState<number | null>(null)
  const [cliError, setCliError] = useState<string | null>(null)
  const updateCli = (index: number, patch: Partial<CliDraft>) => {
    setCustomClis((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    setCliError(null)
  }

  type SettingsBaseline = {
    customClis: CliDraft[]
    routingRoles: typeof routingRoles
    taskAgentRules: RoutingRule[]
    apiMode: typeof apiMode
    maxIterations: number
    timeoutMinutes: number
  }
  const [baseline, setBaseline] = useState<SettingsBaseline | null>(null)
  const [savingChanges, setSavingChanges] = useState(false)
  const textEditing = useRef(false)
  const [, commitText] = useState(0)
  const reduceActivityMotion = usePrefersReducedMotion()
  const validRule = (rule: RoutingRule) =>
    Boolean(
      (rule.match.output?.length || rule.match.skill?.trim()) && rule.agent && rule.model?.trim(),
    )
  const validCli = (cli: CliDraft, index: number) =>
    /^[a-z0-9][a-z0-9-]*$/.test(cli.id) &&
    Boolean(cli.label.trim() && cli.command.trim()) &&
    !executorModes?.modes.some(
      (mode) =>
        mode.id === cli.id &&
        mode.id !== 'local' &&
        mode.id !== 'api' &&
        !('generic' in mode && mode.generic),
    ) &&
    !customClis.some((other, i) => i !== index && other.id === cli.id)

  const healthLabel = health
    ? health.system.ready
      ? 'All prerequisites met'
      : 'Setup needs attention'
    : 'Checking prerequisites…'
  const searchResults = [
    ...SETTINGS_SEARCH_INDEX,
    ...projects.map((project) => ({
      id: `project_${project.id}`,
      section: `project_${project.id}`,
      label: { en: project.name, es: project.name },
      keywords: ['project', 'proyecto'],
    })),
  ]
    .map((entry) =>
      entry.id === 'health'
        ? {
            ...entry,
            label: { en: healthLabel, es: healthLabel },
          }
        : entry,
    )
    .filter((entry) => entry.id !== 'executor-iterations' || apiMode === 'agentic')
    .filter((entry) =>
      normalizeSettingsSearch(`${entry.label[language]} ${entry.keywords.join(' ')}`).includes(
        normalizeSettingsSearch(searchQuery),
      ),
    )
    .sort(
      (a, b) =>
        Number(b.section === normalizeSettingsSearch(searchQuery)) -
        Number(a.section === normalizeSettingsSearch(searchQuery)),
    )

  const openSettingsSearch = useCallback(() => {
    setSearchQuery('')
    setSearchIndex(0)
    setPaletteOpen(true)
  }, [])
  const closeSettingsSearch = useCallback(() => {
    setPaletteOpen(false)
    restoringSearchFocus.current = true
  }, [])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSettingsSearch()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [openSettingsSearch])

  useEffect(() => {
    if (paletteOpen) paletteInputRef.current?.focus()
    else if (restoringSearchFocus.current) {
      sidebarSearchRef.current?.focus()
      restoringSearchFocus.current = false
    }
  }, [paletteOpen])

  useEffect(() => {
    paletteRef.current
      ?.querySelector(`[data-settings-result-index="${searchIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [searchIndex])

  useEffect(() => {
    if (!searchDestination) return
    const target = settingsRootRef.current?.querySelector<HTMLElement>(
      `[data-settings-anchor="${searchDestination.id}"]`,
    )
    if (!target) return
    target.scrollIntoView({
      behavior: reduceActivityMotion ? 'instant' : 'smooth',
      block: 'center',
    })
    const previousPosition = target.style.position
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
    setHighlightTarget(target)
    setHighlightFading(false)
    const fadeTimer = window.setTimeout(() => setHighlightFading(true), spring.slow.duration * 2000)
    const timer = window.setTimeout(() => {
      setHighlightTarget(null)
      setSearchDestination(null)
    }, spring.slow.duration * 4000)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(fadeTimer)
      target.style.position = previousPosition
    }
  }, [searchDestination, reduceActivityMotion])

  const chooseSettingsResult = (entry: SettingsSearchEntry) => {
    setHighlightTarget(null)
    if (entry.section.startsWith('project_')) {
      const id = entry.section.slice('project_'.length)
      setSelectedProjectId(id)
      onSelectProject(id)
    }
    setActiveSection(entry.section)
    setSearchDestination({ ...entry })
    closeSettingsSearch()
  }

  const activityTooltipRef = useRef<HTMLDivElement>(null)
  const activityTotalRef = useRef(0)
  const [activityTotal, setActivityTotal] = useState(0)
  // One tooltip persists while moving between cells.
  const [hoveredActivityDay, setHoveredActivityDay] = useState<{
    tooltip: string
    visible: boolean
    x: number
    y: number
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
      const key = `${row.source ?? 'orchestos'}\u0000${row.provider ?? ''}\u0000${row.model}`
      const current = grouped.get(key)
      if (current) {
        current.runs += row.runs
        current.tokens = (
          Number(current.tokens.replaceAll(',', '')) + Number(row.tokens.replaceAll(',', ''))
        ).toLocaleString()
        current.spend =
          current.spend === null || row.spend === null ? null : current.spend + row.spend
      } else grouped.set(key, { ...row })
    }
    const rows = [...grouped.values()]
    const cliTabs = rows.filter((row) => row.source === 'cli')
    const orchestosRows = rows.filter((row) => row.source !== 'cli')
    const cli = orchestosRows.filter((row) =>
      ['claude', 'codex', 'opencode'].includes(row.provider ?? ''),
    )
    const api = orchestosRows.filter((row) => !cli.includes(row))
    return [
      { id: 'cli', label: 'CLI', rows: cli },
      { id: 'api', label: 'API', rows: api },
      { id: 'cli-tabs', label: 'CLI tabs', rows: cliTabs },
    ].filter((group) => group.rows.length > 0)
  }, [modelUsageRows])
  const totalRunsUsage = usage?.totalRuns ?? 0
  const totalSpendUsage = usage?.totalUsd ?? 0
  const avgCostUsage = totalRunsUsage ? (totalSpendUsage / totalRunsUsage).toFixed(3) : '0.000'
  // A config request for a project being purged must never reach the server after the
  // purge: the effect's in-flight request is aborted on confirm and the id is excluded.
  const purgingProjectId = React.useRef<string | null>(null)
  const configRequest = React.useRef<AbortController | null>(null)
  const configProjectId =
    activeProjectId !== purgingProjectId.current &&
    projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : undefined

  React.useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    configRequest.current = controller
    setSettingsLoading(true)
    Promise.all([
      getSettings(),
      getSetup(),
      getHealth(),
      getLocalProvider(),
      getExecutorModes(),
      getUsage(),
      getConfig(configProjectId, controller.signal),
      fetch('/api/models/catalog').then((response) => response.json()),
      getClis(),
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
          nextClis,
        ]) => {
          if (disposed) return
          const keys = mapSettingsKeys(settings)
          setApiKeys((current) => ({
            openrouter: { ...keys.openrouter, newKey: current.openrouter.newKey },
            anthropic: { ...keys.anthropic, newKey: current.anthropic.newKey },
            openai: { ...keys.openai, newKey: current.openai.newKey },
            ollama: keys.ollama,
          }))
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
          const nextRules = (routed.taskAgentRules ?? []).map((rule) => ({
            ...rule,
            localId: ruleSequence.current++,
          }))
          setCustomClis(nextClis.clis.map(cliDraft))
          setEditingCli(null)
          setCliError(null)
          setBaseline({
            customClis: nextClis.clis.map(cliDraft),
            routingRoles: routed.roleAssignments ?? {},
            taskAgentRules: nextRules,
            apiMode: nextConfig.apiMode,
            maxIterations: nextConfig.agenticMaxIterations,
            timeoutMinutes: nextConfig.externalTimeoutMinutes,
          })
          setRoutingRoles(routed.roleAssignments ?? {})
          setTaskAgentRules(nextRules)
          setApiMode(nextConfig.apiMode)
          setMaxIterations(nextConfig.agenticMaxIterations)
          setTimeoutMinutes(nextConfig.externalTimeoutMinutes)
          setSettingsError(null)
        },
      )
      .catch((error: unknown) => {
        if (!disposed && !controller.signal.aborted)
          setSettingsError(error instanceof Error ? error.message : 'Settings could not be loaded')
      })
      .finally(() => {
        if (!disposed) setSettingsLoading(false)
      })
    return () => {
      disposed = true
      controller.abort()
    }
  }, [activeProjectId, projects])

  const refreshSettings = async () => {
    const [settings, nextConfig] = await Promise.all([getSettings(), getConfig(configProjectId)])
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
      setEditingKeyProvider((current) => (current === provider ? null : current))
      showSaveSuccess('API keys')
    } catch (error) {
      cancelKeyEdit(provider)
      showToast(error instanceof Error ? error.message : 'Could not save API key', 'error')
    }
  }

  const cancelKeyEdit = (provider: 'openrouter' | 'anthropic' | 'openai') => {
    setApiKeys((current) => ({ ...current, [provider]: { ...current[provider], newKey: '' } }))
    setEditingKeyProvider(null)
  }

  const handleSaveOllama = async () => {
    try {
      await saveSettings({ OLLAMA_HOST: ollamaHost.trim() })
      await refreshSettings()
      setLocalProvider(await getLocalProvider())
      showSaveSuccess(language === 'es' ? 'configuración de Ollama' : 'Ollama settings')
    } catch (error) {
      setOllamaHost(apiKeys.ollama.masked)
      showToast(error instanceof Error ? error.message : 'Could not save Ollama settings', 'error')
    }
  }

  const handleSaveRouting = async (rules: RoutingRule[]) => {
    try {
      await saveConfig(
        {
          roleAssignments: routingRoles,
          taskAgentRules: rules.map(({ localId: _localId, ...rule }) => rule),
        },
        activeProjectId,
      )
      const updated = (await getConfig(configProjectId)) as ConfigResponse & {
        roleWarnings?: string[]
        roleAssignments?: Record<string, { agent: string; model: string; effort?: string } | null>
        taskAgentRules?: RoutingRule[]
      }
      setConfig(updated)
      setBaseline(
        (current) =>
          current && {
            ...current,
            routingRoles: updated.roleAssignments ?? {},
            taskAgentRules: rules,
          },
      )
      return true
    } catch (error) {
      setRoutingRoles(baseline?.routingRoles ?? {})
      setTaskAgentRules(baseline?.taskAgentRules ?? [])
      showToast(error instanceof Error ? error.message : 'Could not save model routing', 'error')
      return false
    }
  }

  const handleSavePermissionMode = async (permissionMode: 'yolo' | 'manual') => {
    try {
      await saveConfig({ permissionMode }, activeProjectId)
      setConfig((await getConfig(configProjectId)) as ConfigResponse)
      showToast(permissionMode === 'manual' ? 'Permissions: Manual' : 'Permissions: Yolo')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save permissions', 'error')
    }
  }

  const handleSaveExecutor = async () => {
    try {
      await saveConfig(
        {
          apiMode,
          agenticMaxIterations: maxIterations,
          externalTimeoutMinutes: timeoutMinutes,
        },
        activeProjectId,
      )
      setBaseline((current) => current && { ...current, apiMode, maxIterations, timeoutMinutes })
      return true
    } catch (error) {
      if (baseline) {
        setApiMode(baseline.apiMode)
        setMaxIterations(baseline.maxIterations)
        setTimeoutMinutes(baseline.timeoutMinutes)
      }
      showToast(
        error instanceof Error ? error.message : 'Could not save executor settings',
        'error',
      )
      return false
    }
  }

  const handleSaveClis = async (clis: CliDraft[]) => {
    try {
      await saveClis(clis.map(cliConfig), activeProjectId)
      const updated = (await getClis()).clis.map(cliDraft)
      setCustomClis((items) =>
        items.map((item) => ({
          ...item,
          savedId: updated.some((saved) => saved.id === item.id) ? item.id : item.savedId,
          installed: updated.find((saved) => saved.id === item.id)?.installed ?? false,
        })),
      )
      setBaseline((current) => current && { ...current, customClis: updated })
      setCliError(null)
      const catalog = await fetch('/api/models/catalog').then((response) => response.json())
      setRoutingCatalog(catalog.agents ?? [])
      return true
    } catch (error) {
      setCustomClis(baseline?.customClis ?? [])
      const message = error instanceof Error ? error.message : 'Could not save CLIs'
      setCliError(message)
      showToast(message, 'error')
      return false
    }
  }

  // Serialize saves. Text remains local until blur/Enter; invalid drafts never reach the API.
  useEffect(() => {
    if (!baseline || settingsLoading || savingChanges || textEditing.current) return
    const timer = window.setTimeout(() => {
      const rules = taskAgentRules.flatMap((rule) => {
        const saved = baseline.taskAgentRules.find((item) => item.localId === rule.localId)
        return validRule(rule) ? [rule] : saved ? [saved] : []
      })
      const clis = customClis.flatMap((cli, index) => {
        const saved = baseline.customClis.find((item) => item.id === cli.savedId)
        return validCli(cli, index) ? [cli] : saved ? [saved] : []
      })
      const routingChanged =
        JSON.stringify([routingRoles, rules]) !==
        JSON.stringify([baseline.routingRoles, baseline.taskAgentRules])
      const executorChanged =
        apiMode !== baseline.apiMode ||
        maxIterations !== baseline.maxIterations ||
        timeoutMinutes !== baseline.timeoutMinutes
      const clisChanged =
        JSON.stringify(clis.map(cliConfig)) !== JSON.stringify(baseline.customClis.map(cliConfig))
      if (!routingChanged && !executorChanged && !clisChanged) return
      setSavingChanges(true)
      void (async () => {
        try {
          if (routingChanged) await handleSaveRouting(rules)
          else if (executorChanged) await handleSaveExecutor()
          else if (clisChanged) await handleSaveClis(clis)
        } finally {
          setSavingChanges(false)
        }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  })

  useEffect(() => {
    // Navigating away discards incomplete local entries without a prompt.
    if (activeSection !== 'model_routing') {
      setTaskAgentRules((items) =>
        items.flatMap((rule) => {
          if (validRule(rule)) return [rule]
          const saved = baseline?.taskAgentRules.find((item) => item.localId === rule.localId)
          return saved ? [saved] : []
        }),
      )
    }
    if (activeSection !== 'executor') {
      setCustomClis((items) =>
        items.flatMap((cli, index) => {
          if (validCli(cli, index)) return [cli]
          const saved = baseline?.customClis.find((item) => item.id === cli.savedId)
          return saved ? [saved] : []
        }),
      )
      setEditingCli(null)
    }
  }, [activeSection])

  // Daily activity cells with uniform style and date tooltips
  const dailyActivityCells = React.useMemo(() => {
    const cells: Array<{
      id: number
      dateKey: string
      dateStr: string
      runs: number
      intensity: 0 | 1 | 2 | 3 | 4
      tooltip: string
    }> = []
    const now = new Date()
    for (let i = 370; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
        dateKey,
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

  const dailyActivityTotal = dailyActivityCells.reduce((total, cell) => total + cell.runs, 0)

  React.useEffect(() => {
    if (activeSection !== 'usage') return
    if (reduceActivityMotion) {
      activityTotalRef.current = dailyActivityTotal
      setActivityTotal(dailyActivityTotal)
      return
    }
    const controls = animate(activityTotalRef.current, dailyActivityTotal, {
      ...spring.slow,
      onUpdate: (value) => {
        activityTotalRef.current = value
        setActivityTotal(Math.round(value))
      },
    })
    return () => controls.stop()
  }, [activeSection, dailyActivityTotal, reduceActivityMotion])

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

  const navHighlight = (
    <motion.span
      data-settings-nav-active
      aria-hidden
      layoutId="settings-nav-active"
      transition={reduceActivityMotion ? { duration: 0 } : spring.moderate}
      className="pointer-events-none absolute inset-0 -z-10 rounded-control bg-app-surface"
    />
  )

  return (
    <div
      ref={settingsRootRef}
      data-settings-saving={savingChanges || undefined}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          textEditing.current = true
      }}
      onBlurCapture={() => {
        textEditing.current = false
        commitText((version) => version + 1)
      }}
      onKeyDownCapture={(event) => {
        if (
          event.key === 'Enter' &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement) &&
          !event.target.closest('[role=dialog]') &&
          !event.shiftKey
        ) {
          event.preventDefault()
          event.target.blur()
        }
      }}
      className="flex-1 flex h-full text-app overflow-hidden select-none"
    >
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            data-settings-search-backdrop
            className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/60 p-6"
            initial={reduceActivityMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceActivityMotion ? { duration: 0 } : spring.slow}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeSettingsSearch()
            }}
          >
            <div
              ref={paletteRef}
              role="dialog"
              aria-modal="true"
              aria-label={language === 'es' ? 'Buscar configuración' : 'Search settings'}
              className="relative isolate w-full max-w-xl"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeSettingsSearch()
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setSearchIndex((current) =>
                    searchResults.length
                      ? (current + (event.key === 'ArrowDown' ? 1 : -1) + searchResults.length) %
                        searchResults.length
                      : 0,
                  )
                }
                if (event.key === 'Enter' && searchResults[searchIndex]) {
                  event.preventDefault()
                  chooseSettingsResult(searchResults[searchIndex])
                }
                if (event.key === 'Tab') {
                  event.preventDefault()
                  paletteInputRef.current?.focus()
                }
              }}
            >
              <motion.div
                aria-hidden
                data-settings-search-surface
                layoutId={reduceActivityMotion ? undefined : 'settings-search-surface'}
                transition={reduceActivityMotion ? { duration: 0 } : spring.slow}
                style={{ borderRadius: 16 }}
                className="pointer-events-none absolute inset-0 -z-10 border border-app bg-app-surface shadow-2xl"
              />
              <motion.div
                initial={reduceActivityMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={
                  reduceActivityMotion
                    ? { duration: 0 }
                    : { ...spring.fast, delay: spring.slow.duration }
                }
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <Search aria-hidden className="h-4 w-4 text-app-muted" />
                  <input
                    ref={paletteInputRef}
                    type="text"
                    role="combobox"
                    aria-label={language === 'es' ? 'Buscar configuración' : 'Search settings'}
                    aria-expanded="true"
                    aria-controls="settings-search-results"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      searchResults[searchIndex] ? `settings-result-${searchIndex}` : undefined
                    }
                    placeholder={
                      language === 'es' ? 'Buscar configuración...' : 'Search settings...'
                    }
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      setSearchIndex(0)
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm text-app outline-none placeholder:text-app-muted"
                  />
                </div>
                <div
                  id="settings-search-results"
                  role="listbox"
                  aria-label={language === 'es' ? 'Resultados' : 'Results'}
                  className="max-h-[50vh] overflow-y-auto p-2"
                >
                  {searchResults.map((entry, index) => (
                    <div
                      key={entry.id}
                      id={`settings-result-${index}`}
                      role="option"
                      aria-selected={searchIndex === index}
                      data-settings-result={entry.id}
                      data-settings-result-index={index}
                      className="relative isolate cursor-pointer rounded-control px-3 py-2 text-sm text-app"
                      onMouseEnter={() => setSearchIndex(index)}
                      onClick={() => chooseSettingsResult(entry)}
                    >
                      {searchIndex === index && (
                        <motion.span
                          aria-hidden
                          layoutId="settings-search-selected"
                          transition={reduceActivityMotion ? { duration: 0 } : spring.moderate}
                          className="pointer-events-none absolute inset-0 -z-10 rounded-control bg-app-elevated"
                        />
                      )}
                      {entry.label[language]}
                    </div>
                  ))}
                  {searchResults.length === 0 && (
                    <p className="px-3 py-2 text-sm text-app-muted">
                      {language === 'es' ? 'Sin resultados' : 'No results'}
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {highlightTarget &&
        createPortal(
          <motion.span
            key={searchDestination?.id}
            aria-hidden
            data-settings-highlight
            initial={reduceActivityMotion ? false : { opacity: 0 }}
            animate={{ opacity: reduceActivityMotion || !highlightFading ? 1 : 0 }}
            transition={reduceActivityMotion ? { duration: 0 } : spring.slow}
            className="pointer-events-none absolute inset-0 z-10 rounded-control bg-app-accent/10"
          />,
          highlightTarget,
        )}

      {/* Settings Navigation Sidebar */}
      <aside
        data-ff
        className="w-64 flex-shrink-0 bg-app-bg flex flex-col justify-between overflow-y-auto"
      >
        <div className="p-3.5 space-y-4">
          {/* Back to App button */}
          <button
            type="button"
            onClick={onBackToApp}
            className="flex h-7 items-center gap-2 rounded-control px-2 text-[12.5px] font-medium text-app-muted transition-colors hover:bg-app-surface hover:text-app"
          >
            <ArrowLeft className="w-4 h-4 text-app-muted" />
            <span>{language === 'es' ? 'Volver a la app' : 'Back to app'}</span>
          </button>

          {/* Shared surface grows from this input into the command palette. */}
          <div className="h-7">
            {!paletteOpen && (
              <div className="relative isolate">
                <motion.div
                  aria-hidden
                  layoutId={reduceActivityMotion ? undefined : 'settings-search-surface'}
                  transition={reduceActivityMotion ? { duration: 0 } : spring.slow}
                  style={{ borderRadius: 6 }}
                  className="pointer-events-none absolute inset-0 -z-10 bg-app-surface"
                />
                <motion.div
                  initial={reduceActivityMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={
                    reduceActivityMotion
                      ? { duration: 0 }
                      : { ...spring.fast, delay: spring.slow.duration }
                  }
                >
                  <Search className="pointer-events-none w-4 h-4 text-app-muted absolute left-2 top-1.5" />
                  <input
                    ref={sidebarSearchRef}
                    type="text"
                    readOnly
                    value=""
                    onFocus={() => {
                      if (!restoringSearchFocus.current) openSettingsSearch()
                    }}
                    onClick={openSettingsSearch}
                    placeholder={
                      language === 'es' ? 'Buscar configuración...' : 'Search settings...'
                    }
                    aria-label={language === 'es' ? 'Buscar configuración' : 'Search settings'}
                    className="h-7 w-full rounded-control bg-transparent pl-8 pr-2.5 text-[12.5px] text-app outline-none placeholder:text-app-muted"
                  />
                </motion.div>
              </div>
            )}
          </div>

          {/* Settings Groups matching the real application structure */}
          <div className="space-y-4 pt-1 text-[12.5px]">
            {[
              {
                label: 'App',
                entries: [
                  { id: 'general', label: 'General', icon: SettingsIcon },
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                  { id: 'keybindings', label: 'Keybindings', icon: Keyboard },
                  { id: 'language', label: 'Language', icon: Globe },
                ],
              },
              {
                label: 'Agents',
                entries: [
                  { id: 'providers', label: 'Providers', icon: Bot },
                  { id: 'model_routing', label: 'Model routing', icon: Cpu },
                  { id: 'executor', label: 'Executor', icon: Server },
                  { id: 'api_models', label: 'API keys', icon: Key },
                ],
              },
              {
                label: 'Observe',
                entries: [
                  { id: 'health', label: 'Health', icon: Activity },
                  { id: 'usage', label: 'Usage', icon: DollarSign },
                ],
              },
              {
                label: 'Protect',
                entries: [{ id: 'danger_zone', label: 'Danger zone', icon: ShieldAlert }],
              },
            ].map((group) => (
              <div key={group.label} className="space-y-0.5">
                <div className="text-[11px] font-semibold text-app-muted px-2 mb-1">
                  {group.label}
                </div>
                {group.entries.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSection(id)}
                    aria-current={activeSection === id ? 'page' : undefined}
                    className={`relative isolate w-full flex h-7 items-center gap-2 px-2 rounded-control text-left text-[12.5px] font-medium transition-colors ${
                      activeSection === id
                        ? 'text-app [&_svg]:text-app'
                        : 'text-app-muted hover:text-app hover:bg-app-surface'
                    }`}
                  >
                    {activeSection === id && navHighlight}
                    <Icon className="w-4 h-4 text-app-muted" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ))}

            {/* GROUP 5: PROJECTS (Individual item per project) */}
            <div className="space-y-0.5 pt-1">
              <div className="text-[11px] font-semibold text-app-muted px-2 mb-1 flex items-center justify-between">
                <span>Projects</span>
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
                <div className="px-2 py-2 text-[12.5px] text-app-muted">No projects registered</div>
              ) : (
                projects.map((p) => {
                  const isCurrent = activeSection === `project_${p.id}`
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleNavToProject(p.id)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`relative isolate w-full flex h-7 items-center gap-2 px-2 rounded-control text-left text-[12.5px] font-medium transition-colors truncate ${
                        isCurrent
                          ? 'text-app [&_svg]:text-app'
                          : 'text-app-muted hover:text-app hover:bg-app-surface'
                      }`}
                    >
                      {isCurrent && navHighlight}
                      <FolderClosed className="w-4 h-4 text-app-muted flex-shrink-0" />
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
      <main className="relative flex-1 flex flex-col overflow-hidden rounded-tl-[10px] bg-app-surface text-app">
        {settingsLoading && !settingsError && (
          <div className="pointer-events-none absolute right-4 top-3 z-10 text-xs text-app-muted">
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
          <SettingsPage title="General">
            {/* 4 Theme cards with color swatches */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {themeOptions.map((th) => {
                const isSelected = currentTheme === th.id
                return (
                  <Card
                    key={th.id}
                    data-settings-anchor={`theme-${th.id}`}
                    label={th.name}
                    selected={isSelected}
                    onClick={() => onSelectTheme(th.id)}
                    className="rounded-card bg-app-surface"
                  >
                    <CardHeader>
                      <CardTitle>{th.name}</CardTitle>
                      {isSelected ? (
                        <CardAction>
                          <Check className="h-4 w-4 text-app-accent" aria-label="Active" />
                        </CardAction>
                      ) : null}
                      <CardDescription>{th.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Color Swatch Preview */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border border-app"
                          style={{ backgroundColor: th.bgHex }}
                          title="Canvas Background"
                        />
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border border-app"
                          style={{ backgroundColor: th.surfaceHex }}
                          title="Surface"
                        />
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border border-app"
                          style={{ backgroundColor: th.accentHex }}
                          title="Accent"
                        />
                        <span className="ml-auto font-mono text-[10px] text-app-muted">
                          {th.bgHex}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </SettingsPage>
        )}

        {['appearance', 'keybindings', 'providers'].includes(activeSection) && (
          <SettingsPage
            title={
              { appearance: 'Appearance', keybindings: 'Keybindings', providers: 'Providers' }[
                activeSection
              ]
            }
          >
            {null}
          </SettingsPage>
        )}

        {/* SECTION: HEALTH */}
        {activeSection === 'health' && (
          <SettingsPage title="Project Health">
            <SettingsGroup>
              <SettingsRow
                data-settings-anchor="health"
                label={
                  <span className="flex items-center gap-2">
                    {health ? (
                      <CheckCircle2
                        className={`h-4 w-4 ${health.system.ready ? 'text-app-success' : 'text-app-warning'}`}
                      />
                    ) : (
                      <span
                        className="h-4 w-4 animate-spin rounded-full border border-app-muted border-t-app-accent"
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
                  </span>
                }
                description={
                  health
                    ? `${health.system.items.filter((item) => item.ok).length}/${health.system.items.length} system checks passing in ${setup?.cwd || health.system.cwd}.`
                    : settingsError || 'Checking system checks…'
                }
              ></SettingsRow>
              <SettingsRow
                label="Blocked tasks"
                description={`${health?.blockedTasks.length ?? 0} contract violations currently halting worktrees.`}
              >
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('tasks')
                  }}
                >
                  View
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Pending review"
                description={
                  health
                    ? `${health.pendingApproval.draftSpecs} draft specs and ${health.pendingApproval.unverifiedInstincts} instincts awaiting approval.`
                    : 'Loading approval queue...'
                }
              >
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('specs')
                  }}
                >
                  View
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Last 7 days cost"
                description={`$${health?.costLast7d.toFixed(2) ?? '0.00'} spent across the last 7 days.`}
              >
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => setActiveSection('usage')}
                >
                  View
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Recent learnings"
                description={`${health?.recentLearnings.length ?? 0} recent verified learnings.`}
              >
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => {
                    if (projects[0]) handleNavToProject(projects[0].id)
                    setActiveProjectTab('instincts')
                  }}
                >
                  View
                </Button>
              </SettingsRow>
            </SettingsGroup>
          </SettingsPage>
        )}

        {/* SECTION: API & MODELS */}
        {activeSection === 'api_models' && (
          <SettingsPage title="API Keys & Models">
            <SettingsGroup>
              {(['openrouter', 'anthropic', 'openai'] as const).map((provider) => {
                const key = apiKeys[provider]
                const editing = editingKeyProvider === provider
                const label = {
                  openrouter: 'OpenRouter API',
                  anthropic: 'Anthropic API',
                  openai: 'OpenAI API',
                }[provider]
                return (
                  <div
                    key={provider}
                    data-api-key-row={provider}
                    data-settings-anchor={`api-${provider}`}
                    className="space-y-2 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ProviderLogo
                          id={
                            { openrouter: 'gemini', anthropic: 'claude', openai: 'codex' }[provider]
                          }
                          className={`h-4 w-4 ${provider === 'openrouter' ? 'text-app-accent' : ''}`}
                        />
                        <span className="text-[13px] font-medium text-app">{label}</span>
                        <span
                          className={`min-w-10 text-[10px] ${key.set ? 'text-app-success' : 'text-app-muted'}`}
                        >
                          {key.set ? 'Set' : 'Not set'}
                        </span>
                      </div>
                      <AnimatePresence initial={false} mode="wait">
                        <motion.div
                          key={editing ? 'form' : 'button'}
                          initial={reduceActivityMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduceActivityMotion ? undefined : { height: 0, opacity: 0 }}
                          transition={reduceActivityMotion ? { duration: 0 } : spring.moderate}
                          className="overflow-hidden"
                        >
                          {editing ? (
                            <form
                              data-api-key-form
                              className="flex flex-wrap items-center gap-2"
                              onSubmit={(event) => {
                                event.preventDefault()
                                void handleSaveKey(provider)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelKeyEdit(provider)
                                }
                              }}
                            >
                              <input
                                ref={focusKeyInput}
                                onBlur={(event) => {
                                  if (
                                    !(event.relatedTarget instanceof HTMLElement) ||
                                    !event.relatedTarget.closest('[data-cancel-key]')
                                  )
                                    void handleSaveKey(provider)
                                }}
                                type="password"
                                aria-label={`${label} key`}
                                autoComplete="off"
                                placeholder="Paste secret key..."
                                value={key.newKey}
                                onChange={(event) =>
                                  setApiKeys((current) => ({
                                    ...current,
                                    [provider]: {
                                      ...current[provider],
                                      newKey: event.target.value,
                                    },
                                  }))
                                }
                                className="min-w-0 flex-1 rounded-control border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-bg px-2.5 py-1 font-mono text-xs text-app"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="compact"
                                data-cancel-key
                                onClick={() => cancelKeyEdit(provider)}
                              >
                                Cancel
                              </Button>
                            </form>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="compact"
                              onClick={() => {
                                if (editingKeyProvider) cancelKeyEdit(editingKeyProvider)
                                setEditingKeyProvider(provider)
                              }}
                            >
                              {key.set ? 'Replace key' : 'Save key'}
                            </Button>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    {key.masked && (
                      <motion.span
                        key={key.masked}
                        data-api-key-masked
                        initial={reduceActivityMotion ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={reduceActivityMotion ? { duration: 0 } : spring.moderate}
                        className="block font-mono text-xs text-app-muted"
                      >
                        {key.masked}
                      </motion.span>
                    )}
                  </div>
                )
              })}
              <SettingsRow
                data-settings-anchor="api-ollama"
                label={
                  <span className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-app-muted" />
                    <span>Ollama Local</span>
                    <span
                      className={`text-[10px] ${localProvider?.available ? 'text-app-success' : 'text-app-muted'}`}
                    >
                      {localProvider?.available ? 'Available' : 'Unavailable'}
                    </span>
                  </span>
                }
                description={
                  localProvider?.models.length
                    ? `${localProvider.models.length} local model${localProvider.models.length === 1 ? '' : 's'} detected.`
                    : 'Ollama is not responding.'
                }
              />
              <div data-settings-anchor="api-ollama-url" className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-app-muted" />
                    <span className="text-[13px] font-medium text-app">Ollama URL</span>
                  </div>
                </div>
                <input
                  type="url"
                  onBlur={() => {
                    if (ollamaHost !== apiKeys.ollama.masked) void handleSaveOllama()
                  }}
                  value={ollamaHost}
                  placeholder="http://localhost:11434"
                  onChange={(e) => setOllamaHost(e.target.value)}
                  className="w-full max-w-sm rounded-control border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-bg px-2.5 py-1 font-mono text-xs text-app"
                />
              </div>
            </SettingsGroup>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-app-muted">
              <p className="max-w-prose text-xs">
                Leave a field blank to keep its current value. Stored in ~/.orchestos/.env
              </p>
              <span className="text-[10px] text-app-muted">
                Keys are validated and saved per provider.
              </span>
            </div>
          </SettingsPage>
        )}

        {/* SECTION: MODEL ROUTING */}
        {activeSection === 'model_routing' && (
          <SettingsPage
            title="Model routing config"
            status={
              <span className="text-xs text-app-muted">
                Source: {config?.source ? 'orchestos.config.yaml' : 'defaults'}
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-2">
              {(
                [
                  ['orchestrator', 'Orchestrator', 'Chat, drafts and task splitting'],
                  ['executor', 'Executor', 'Runs tasks'],
                  ['reviewer', 'Reviewer', 'QA (read-only)'],
                  ['auxiliary', 'Auxiliary', 'Diagnose and memory judge (read-only)'],
                ] as const
              ).map(([key, label, desc]) => {
                const assignment = routingRoles[key] ?? null
                const agent = routingCatalog.find((entry) => entry.id === assignment?.agent)
                const selectedModels = agent?.models ?? []
                const matchingModels = selectedModels.filter((model) =>
                  `${model.name} ${model.vendor ?? ''} ${model.id}`
                    .toLowerCase()
                    .includes(comboboxSearch.toLowerCase()),
                )
                const selectedModel = selectedModels.find((model) => model.id === assignment?.model)
                const modelEfforts = selectedModel?.efforts?.length
                  ? selectedModel.efforts
                  : agent?.id === 'api'
                    ? agent.efforts
                    : []
                const selectedName = assignment?.model
                  ? (selectedModels.find((model) => model.id === assignment.model)?.name ??
                    assignment.model)
                  : undefined
                return (
                  <div
                    key={key}
                    data-role-card
                    data-settings-anchor={`routing-${key}`}
                    className="relative space-y-2 rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface p-3.5"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-app">{label}</div>
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
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left"
                      >
                        <span>
                          {assignment?.agent
                            ? (agent?.label ??
                              AGENTS_LIST.find(
                                (entry) => entry.id.toLowerCase() === assignment.agent,
                              )?.name ??
                              assignment.agent)
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
                          {routingCatalog
                            .filter((entry) => key !== 'orchestrator' || entry.id !== 'opencode')
                            .filter((entry) => key === 'executor' || !entry.generic)
                            .filter((entry) => key !== 'executor' || entry.taskEngine !== false)
                            .map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                disabled={
                                  !entry.installed || (!entry.generic && !entry.models.length)
                                }
                                onClick={() => {
                                  setRoutingRoles((current) => ({
                                    ...current,
                                    [key]: {
                                      agent: entry.id,
                                      model:
                                        entry.models.find((model) => model.default)?.id ??
                                        entry.models[0]?.id ??
                                        (entry.generic ? 'default' : ''),
                                    },
                                  }))
                                  setActiveComboboxRole(null)
                                }}
                                className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated disabled:opacity-50"
                              >
                                {entry.label ?? entry.id}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`${label} model`}
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
                        <div
                          role="dialog"
                          aria-label={`${label} model selector`}
                          className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl p-2 z-40 max-h-[55vh] overflow-y-auto"
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setActiveComboboxRole(null)
                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                              event.preventDefault()
                              setActiveModelIndex((index) =>
                                matchingModels.length
                                  ? (index +
                                      (event.key === 'ArrowDown' ? 1 : -1) +
                                      matchingModels.length) %
                                    matchingModels.length
                                  : 0,
                              )
                            }
                            if (event.key === 'Enter' && matchingModels[activeModelIndex]) {
                              const model = matchingModels[activeModelIndex]
                              setRoutingRoles((current) => ({
                                ...current,
                                [key]: assignment
                                  ? { ...assignment, model: model.id, effort: undefined }
                                  : null,
                              }))
                              setActiveComboboxRole(null)
                            }
                          }}
                        >
                          <input
                            ref={comboboxSearchRef}
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
                          {matchingModels.length === 0 && (
                            <div className="px-2 py-2 text-app-muted">No models match</div>
                          )}
                          {matchingModels.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              title={model.id}
                              className="block w-full text-left p-1.5 hover:bg-app-elevated text-app"
                              onClick={() => {
                                setRoutingRoles((current) => ({
                                  ...current,
                                  [key]: assignment
                                    ? { ...assignment, model: model.id, effort: undefined }
                                    : null,
                                }))
                                setActiveComboboxRole(null)
                              }}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate">{model.name}</span>
                                {model.vendor && (
                                  <span className="text-app-muted text-[10px]">{model.vendor}</span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {modelEfforts.length ? (
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
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left"
                        >
                          <span>{assignment?.effort ?? 'Default effort'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                        </button>
                        {activeComboboxRole === `${key}-effort` && (
                          <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40">
                            {['', ...modelEfforts].map((effort) => (
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
            <div
              data-settings-anchor="routing-rules"
              className="overflow-hidden rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface text-xs"
            >
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
                <div className="space-y-2 border-t border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] p-3">
                  <p className="text-app-muted">The first matching rule wins.</p>
                  {taskAgentRules.map((rule, index) => (
                    <div
                      key={rule.localId}
                      data-routing-rule
                      data-draft={!validRule(rule) || undefined}
                      className={`grid grid-cols-1 sm:grid-cols-5 gap-2 items-center ${!validRule(rule) ? 'rounded-control border border-dashed border-app p-2' : ''}`}
                    >
                      {!validRule(rule) && (
                        <span className="text-xs text-app-muted sm:col-span-5">
                          {language === 'es' ? 'Borrador' : 'Draft'}
                        </span>
                      )}
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
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left"
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
                                          i === index
                                            ? {
                                                ...item,
                                                agent: agentId,
                                                model: undefined,
                                                cli_effort: undefined,
                                              }
                                            : item,
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
                      <div className="relative min-w-0">
                        <button
                          type="button"
                          aria-label="rule model"
                          aria-expanded={activeComboboxRole === `rule-model-${index}`}
                          onClick={() =>
                            setActiveComboboxRole(
                              activeComboboxRole === `rule-model-${index}`
                                ? null
                                : `rule-model-${index}`,
                            )
                          }
                          className="w-full min-w-0 flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left"
                        >
                          <span className="truncate">
                            {rule.model
                              ? (routingCatalog
                                  .find((entry) => entry.id === rule.agent)
                                  ?.models.find((model) => model.id === rule.model)?.name ??
                                rule.model)
                              : rule.agent === routingRoles.executor?.agent
                                ? 'Executor model'
                                : 'Model required'}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                        </button>
                        {activeComboboxRole === `rule-model-${index}` && (
                          <div className="absolute left-0 top-full mt-1 w-full rounded-card bg-app-surface border border-app shadow-2xl z-40 max-h-56 overflow-y-auto">
                            {[
                              {
                                id: '',
                                name:
                                  rule.agent === routingRoles.executor?.agent
                                    ? 'Executor model'
                                    : 'Model required',
                              },
                              ...(routingCatalog.find((entry) => entry.id === rule.agent)?.models ??
                                []),
                            ].map((model) => (
                              <button
                                key={model.id || 'executor-default'}
                                type="button"
                                onClick={() => {
                                  setTaskAgentRules((items) =>
                                    items.map((item, i) =>
                                      i === index
                                        ? { ...item, model: model.id || undefined }
                                        : item,
                                    ),
                                  )
                                  setActiveComboboxRole(null)
                                }}
                                className="block w-full text-left px-2.5 py-1.5 text-app hover:bg-app-elevated"
                              >
                                {model.name}
                              </button>
                            ))}
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
                            className="w-full min-w-0 flex items-center justify-between px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app text-left"
                          >
                            <span className="truncate">{rule.cli_effort ?? 'Default effort'}</span>
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
                          localId: ruleSequence.current++,
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
            <SettingsGroup>
              <SettingsRow
                data-settings-anchor="permissions"
                label="Agent permissions"
                description="Yolo runs tasks the chat creates right away. Manual waits for your approval in the chat before each task runs."
              >
                <div data-permission-mode-control>
                  <SettingsSegmented
                    ariaLabel="Agent permissions"
                    value={config?.permissionMode ?? 'yolo'}
                    options={[
                      { value: 'yolo', label: 'Yolo' },
                      { value: 'manual', label: 'Manual' },
                    ]}
                    onChange={(permissionMode) => void handleSavePermissionMode(permissionMode)}
                  />
                </div>
              </SettingsRow>
            </SettingsGroup>
          </SettingsPage>
        )}

        {/* SECTION: EXECUTOR */}
        {activeSection === 'executor' && (
          <SettingsPage title="Executor">
            <SettingsGroup>
              <SettingsRow
                data-settings-anchor="executor-timeout"
                label="Timeout"
                description="Stop the CLI if it runs longer than this"
              >
                <SettingsStepper
                  ariaLabel="timeout"
                  value={timeoutMinutes}
                  min={1}
                  step={5}
                  unit="min"
                  onChange={(nextVal) => {
                    setTimeoutMinutes(nextVal)
                  }}
                />
              </SettingsRow>
              <SettingsRow
                data-settings-anchor="executor-mode"
                label="Mode"
                description="Choose single-shot execution or agentic loop"
              >
                <SettingsSegmented
                  ariaLabel="Mode"
                  value={apiMode}
                  options={[
                    { value: 'single-shot', label: 'Single-shot' },
                    { value: 'agentic', label: 'Agentic' },
                  ]}
                  onChange={(mode) => {
                    setApiMode(mode)
                  }}
                />
              </SettingsRow>
              {apiMode === 'agentic' && (
                <SettingsRow
                  data-settings-anchor="executor-iterations"
                  label="Max iterations"
                  description="Stop recursive tool calls after this threshold"
                >
                  <SettingsStepper
                    ariaLabel="iterations"
                    value={maxIterations}
                    min={1}
                    onChange={(nextVal) => {
                      setMaxIterations(nextVal)
                    }}
                  />
                </SettingsRow>
              )}
            </SettingsGroup>
            <SettingsGroup title={language === 'es' ? 'CLIs propios' : 'Custom CLIs'}>
              <div data-settings-anchor="executor-clis">
                {customClis.map((cli, index) => (
                  <React.Fragment key={index}>
                    <SettingsRow
                      label={cli.label || 'Nuevo CLI'}
                      description={<span className="font-mono">{cli.command}</span>}
                    >
                      <span className="text-xs text-app-muted">
                        {cli.installed ? '● Instalado' : '○ No instalado'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-compact"
                        aria-label={`Editar ${cli.label}`}
                        disabled={settingsLoading || !baseline}
                        onClick={() => setEditingCli(editingCli === index ? null : index)}
                      >
                        <Pencil />
                      </Button>
                      <button
                        type="button"
                        aria-label={`Quitar ${cli.label}`}
                        disabled={settingsLoading || !baseline}
                        className="p-1.5 text-app-muted hover:text-app"
                        onClick={() => {
                          setCustomClis((items) => items.filter((_, i) => i !== index))
                          setEditingCli(null)
                          setCliError(null)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </SettingsRow>
                    {editingCli === index && (
                      <div className="flex flex-col gap-3 p-4" data-cli-form>
                        {(
                          [
                            ['label', 'Nombre'],
                            ['id', 'ID'],
                            ['command', 'Comando'],
                            ['argsText', 'Argumentos'],
                            ['modelArgsText', 'Args de modelo'],
                            ['modelsText', 'Modelos'],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field} className="flex flex-col gap-2 text-xs text-app-muted">
                            {label}
                            {field === 'argsText' || field === 'modelArgsText' ? (
                              <textarea
                                aria-label={label}
                                value={cli[field]}
                                rows={4}
                                className="w-full px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app"
                                onChange={(event) =>
                                  updateCli(index, { [field]: event.target.value })
                                }
                              />
                            ) : (
                              <input
                                aria-label={label}
                                value={cli[field]}
                                disabled={
                                  field === 'id' &&
                                  baseline?.customClis.some((saved) => saved.id === cli.id)
                                }
                                className="w-full px-2.5 py-1.5 rounded-control bg-app-bg border border-app text-xs text-app"
                                onChange={(event) => {
                                  const value = event.target.value
                                  updateCli(index, {
                                    [field]: value,
                                    ...(field === 'label' &&
                                    !baseline?.customClis.some((saved) => saved.id === cli.id)
                                      ? {
                                          id: value
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]+/g, '-')
                                            .replace(/^-|-$/g, ''),
                                        }
                                      : {}),
                                  })
                                }}
                              />
                            )}
                            {field === 'argsText' && (
                              <span>
                                Usa {'{prompt}'} donde va la tarea; sin {'{prompt}'} se envía por
                                stdin.
                              </span>
                            )}
                            {field === 'modelArgsText' && <span>Opcional, uno por línea.</span>}
                            {field === 'modelsText' && <span>Opcional, separados por coma.</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                ))}
                {cliError && (
                  <p role="alert" className="px-4 py-2 text-xs text-app-muted">
                    {cliError}
                  </p>
                )}
                <div className="p-4">
                  <Button
                    variant="ghost"
                    leadingIcon={Plus}
                    disabled={settingsLoading || !baseline}
                    onClick={() => {
                      setEditingCli(customClis.length)
                      setCustomClis((items) => [
                        ...items,
                        cliDraft({ id: '', label: '', command: '', args: [], installed: false }),
                      ])
                      setCliError(null)
                    }}
                  >
                    Agregar CLI
                  </Button>
                </div>
              </div>
            </SettingsGroup>
          </SettingsPage>
        )}

        {/* SECTION: USAGE */}
        {activeSection === 'usage' && (
          <SettingsPage title="Usage & Spend">
            {/* 3 KPI cards at the top (exact same numbers computed from table data) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                data-settings-anchor="usage-spend"
                className="space-y-1 rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface p-3.5"
              >
                <div className="text-xs uppercase text-app-muted">Total Spend</div>
                <div className="text-xl font-bold tabular-nums text-app font-mono">
                  ${totalSpendUsage.toFixed(2)}
                </div>
                <div className="text-[10px] text-app-success">
                  {usage
                    ? `OrchestOS $${(usage.totals?.orchestos.usd ?? totalSpendUsage).toFixed(2)} · CLI tabs $${(usage.totals?.cli.usd ?? 0).toFixed(2)}`
                    : 'Loading telemetry'}
                </div>
              </div>

              <div
                data-settings-anchor="usage-runs"
                className="space-y-1 rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface p-3.5"
              >
                <div className="text-xs uppercase text-app-muted">Total Runs</div>
                <div className="text-xl font-bold tabular-nums text-app font-mono">
                  {totalRunsUsage}
                </div>
                <div className="text-[10px] text-app-muted">
                  {modelUsageRows.length} models observed
                </div>
              </div>

              <div
                data-settings-anchor="usage-average"
                className="space-y-1 rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface p-3.5"
              >
                <div className="text-xs uppercase text-app-muted">Avg. Cost / Run</div>
                <div className="text-xl font-bold tabular-nums text-app font-mono">
                  ${avgCostUsage}
                </div>
                <div className="text-[10px] text-app-muted">
                  {modelUsageRows[0]?.model
                    ? `Top model: ${modelUsageRows[0].model}`
                    : 'No model activity yet'}
                </div>
              </div>
            </div>

            {/* Daily Activity Heatmap */}
            <div
              data-settings-anchor="usage-activity"
              className="space-y-3 rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface p-4"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-app">Daily activity</span>
                  <span data-heatmap-total className="text-[11px] tabular-nums text-app-success">
                    {reduceActivityMotion ? dailyActivityTotal : activityTotal}{' '}
                    {language === 'es' ? 'ejecuciones' : 'runs'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-app-muted">
                  <span>less</span>
                  <span className="h-2.5 w-2.5 rounded-xs bg-app-elevated" />
                  <span className="h-2.5 w-2.5 rounded-xs bg-app-success/20" />
                  <span className="h-2.5 w-2.5 rounded-xs bg-app-success/45" />
                  <span className="h-2.5 w-2.5 rounded-xs bg-app-success/70" />
                  <span className="h-2.5 w-2.5 rounded-xs bg-app-success" />
                  <span>more</span>
                </div>
              </div>

              {/* Heatmap grid */}
              <div ref={activityTooltipRef} className="relative">
                <motion.div
                  data-heatmap-tooltip
                  role="tooltip"
                  initial={false}
                  animate={{
                    opacity: hoveredActivityDay?.visible ? 1 : 0,
                    x: hoveredActivityDay?.x ?? 0,
                    y: hoveredActivityDay?.y ?? 0,
                  }}
                  transition={
                    reduceActivityMotion
                      ? { duration: 0 }
                      : {
                          x: spring.moderate,
                          y: spring.moderate,
                          opacity: hoveredActivityDay?.visible ? spring.fast : spring.fast.exit,
                        }
                  }
                  className="pointer-events-none absolute left-0 top-0 z-10 -translate-y-full whitespace-nowrap rounded-card border border-app bg-app-elevated px-2 py-1 text-[11px] text-app shadow-sm"
                >
                  {hoveredActivityDay?.tooltip}
                </motion.div>
                <div
                  ref={activityScrollRef}
                  className="overflow-x-auto pb-1"
                  onScroll={() =>
                    setHoveredActivityDay((previous) =>
                      previous ? { ...previous, visible: false } : null,
                    )
                  }
                >
                  <div className="grid grid-cols-[repeat(53,minmax(8px,1fr))] gap-[3px] mb-1 text-[10px] text-app-muted">
                    {Array.from({ length: 53 }, (_, week) => {
                      const first = dailyActivityCells[week * 7]
                      const previous = dailyActivityCells[(week - 1) * 7]
                      const [year, monthNumber, day] = (first?.dateKey ?? '').split('-').map(Number)
                      const month = first ? new Date(year, monthNumber - 1, day) : null
                      const previousMonth = previous ? Number(previous.dateKey.slice(5, 7)) - 1 : -1
                      return (
                        <span key={`month-${week}`} className="min-w-0">
                          {month && month.getMonth() !== previousMonth
                            ? month.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
                                month: 'short',
                              })
                            : ''}
                        </span>
                      )
                    })}
                  </div>
                  <div
                    key={`${dailyActivityTotal}-${dailyActivityCells.at(-1)?.dateKey}`}
                    data-heatmap-grid
                    className="grid grid-cols-[repeat(53,minmax(8px,1fr))] gap-[3px]"
                    onMouseLeave={() =>
                      setHoveredActivityDay((previous) =>
                        previous ? { ...previous, visible: false } : null,
                      )
                    }
                  >
                    {Array.from({ length: 53 }, (_, week) => (
                      <div key={`week-${week}`} className="flex min-w-0 flex-col gap-[3px]">
                        {dailyActivityCells.slice(week * 7, week * 7 + 7).map((cell) => {
                          const bgClass =
                            cell.intensity === 0
                              ? 'bg-app-elevated hover:bg-app-elevated/70'
                              : cell.intensity === 1
                                ? 'bg-app-success/20 hover:bg-app-success/30'
                                : cell.intensity === 2
                                  ? 'bg-app-success/45 hover:bg-app-success/55'
                                  : cell.intensity === 3
                                    ? 'bg-app-success/70 hover:bg-app-success/80'
                                    : 'bg-app-success hover:bg-app-success/90'

                          return (
                            <motion.div
                              key={cell.id}
                              data-heatmap-cell
                              data-date={cell.dateKey}
                              initial={reduceActivityMotion ? false : { opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={
                                reduceActivityMotion
                                  ? { duration: 0 }
                                  : {
                                      ...spring.fast,
                                      delay: (week / 52) * spring.slow.duration * 2,
                                    }
                              }
                              className={`aspect-square w-full rounded-[2px] transition-colors cursor-pointer ${bgClass}`}
                              onMouseEnter={(event) => {
                                const root = activityTooltipRef.current?.getBoundingClientRect()
                                if (!root) return
                                const rect = event.currentTarget.getBoundingClientRect()
                                const tooltipWidth =
                                  activityTooltipRef.current
                                    ?.querySelector('[data-heatmap-tooltip]')
                                    ?.getBoundingClientRect().width ?? 0
                                setHoveredActivityDay({
                                  tooltip: cell.tooltip,
                                  visible: true,
                                  x: Math.max(
                                    0,
                                    Math.min(rect.left - root.left, root.width - tooltipWidth),
                                  ),
                                  y: rect.top - root.top - 4,
                                })
                              }}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Spend by Model Table */}
            <div
              data-settings-anchor="usage-models"
              className="overflow-hidden rounded-card border border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] bg-app-surface text-xs"
            >
              <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] p-3 font-semibold text-app">
                <span>Spend by model</span>
                <span className="text-[11px] tabular-nums text-app-muted">
                  {totalRunsUsage} total runs · ${totalSpendUsage.toFixed(2)}
                </span>
              </div>

              <table className="w-full text-left">
                <thead className="text-app-muted border-b border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] text-xs">
                  <tr>
                    <th className="p-2.5 font-medium">Model</th>
                    <th className="p-2.5 font-medium">Runs</th>
                    <th className="p-2.5 font-medium">Tokens</th>
                    <th className="p-2.5 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]">
                  {usageGroups.map((group) => (
                    <React.Fragment key={group.id}>
                      <tr>
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
                        const logo = /gpt/i.test(model)
                          ? model
                          : group.id === 'cli'
                            ? row.provider === 'claude' || /Claude/i.test(row.model)
                              ? 'claude'
                              : row.provider === 'codex' || /Codex/i.test(row.model)
                                ? 'chatgpt'
                                : 'opencode'
                            : 'api'
                        return (
                          <tr
                            key={`${group.id}-${row.model}`}
                            className="transition-colors hover:bg-app-elevated"
                          >
                            <td className="p-2.5 font-mono text-app">
                              <span className="inline-flex items-center gap-2">
                                <ProviderLogo id={logo} size={14} />
                                <span>{displayModel}</span>
                              </span>
                            </td>
                            <td className="p-2.5 tabular-nums text-app-muted">{row.runs}</td>
                            <td className="p-2.5 tabular-nums text-app-muted">{row.tokens}</td>
                            <td className="p-2.5 font-mono font-semibold tabular-nums text-app">
                              {row.spend === null ? '—' : `$${row.spend.toFixed(2)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </SettingsPage>
        )}

        {/* SECTION: DANGER ZONE (GLOBAL RESET) */}
        {activeSection === 'danger_zone' && (
          <SettingsPage title="Danger Zone">
            <SettingsGroup
              title={
                <span className="inline-flex items-center gap-2 text-app-error">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Reset OrchestOS</span>
                </span>
              }
            >
              <div data-settings-anchor="reset" className="space-y-3 p-4">
                <p className="max-w-prose text-xs leading-relaxed text-app-muted">
                  Deletes all runs and unverified instincts, and resets every task in tasks.yaml
                  back to pending. Does NOT touch config, skills, CONTEXT.md, or memory.
                </p>
                <Button
                  variant="ghost"
                  size="compact"
                  className="text-app-error"
                  onClick={() => setShowResetConfirm(true)}
                >
                  Reset OrchestOS
                </Button>
              </div>
            </SettingsGroup>
          </SettingsPage>
        )}

        {/* SECTION: LANGUAGE */}
        {activeSection === 'language' && (
          <SettingsPage title="Language / Idioma">
            <SettingsGroup>
              {(['en', 'es'] as const).map((option) => (
                <button
                  key={option}
                  data-settings-anchor={`language-${option}`}
                  type="button"
                  onClick={() => onSelectLanguage(option)}
                  className="block w-full text-left transition-colors hover:bg-app-elevated"
                >
                  <SettingsRow
                    label={option === 'en' ? 'English' : 'Español'}
                    description={
                      option === 'en'
                        ? 'English language interface'
                        : 'Interfaz completa en idioma español'
                    }
                  >
                    {language === option && <Check className="h-4 w-4 text-app-accent" />}
                  </SettingsRow>
                </button>
              ))}
            </SettingsGroup>
          </SettingsPage>
        )}

        {/* SECTION: SPECIFIC PROJECT PAGE */}
        {isProjectSection && selectedProject && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Project Header (Removed project switcher on the right as requested) */}
            <div
              className="px-6 pt-7 pb-3 flex-shrink-0 space-y-3"
              data-project-header
              data-settings-anchor={`project_${selectedProject.id}`}
            >
              <PageHeader
                title={selectedProject.name}
                meta={
                  selectedProject.branch ? (
                    <span className="font-mono">{selectedProject.branch}</span>
                  ) : undefined
                }
              />

              {/* Sub-tabs: Tasks | Runs | Graph | Memory | Specs | Skills | Instincts | Plan */}
              <div className="flex items-center gap-1 overflow-x-auto">
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
                      data-project-tab
                      onClick={() => setActiveProjectTab(tab.id)}
                      className={`inline-flex h-7 shrink-0 items-center gap-2 rounded-control px-2 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-app-elevated text-app'
                          : 'text-app-muted hover:bg-app-elevated hover:text-app'
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
              <div className="flex min-h-full shrink-0 flex-col">
                {(projectTabsLoading || projectTabsError) && (
                  <div
                    className={`px-4 py-2 text-xs ${projectTabsError ? 'text-app-error' : 'text-app-muted'}`}
                  >
                    {projectTabsError ?? 'Loading project data…'}
                  </div>
                )}
                {/* TAB: Tasks */}
                {activeProjectTab === 'tasks' && (
                  <div data-tasks-tab className="px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-app-muted">{tasks.length} tasks</span>
                      {onRunNextTask && (
                        <SettingsPrimaryAction>
                          <Button
                            variant="primary"
                            size="compact"
                            onClick={onRunNextTask}
                            disabled={!canRunNextTask}
                            aria-disabled={!canRunNextTask}
                          >
                            Run Next Task
                          </Button>
                        </SettingsPrimaryAction>
                      )}
                    </div>

                    {tasks.length === 0 ? (
                      <EmptyState
                        icon={Kanban}
                        title={taskError ? 'Tasks unavailable' : 'No Tasks Defined'}
                        description={
                          taskError ||
                          'Tasks appear here when the orchestrator creates them from Chat.'
                        }
                      />
                    ) : (
                      <div>
                        <ListHeader
                          columns={{ id: 'ID', title: 'Task', meta: 'Agent', status: 'Status' }}
                        />
                        {tasks.map((task) => {
                          const time = task.lastRunAt ? formatRunTime(task.lastRunAt) : ''
                          return (
                            <ListRow
                              key={task.id}
                              data-task-row=""
                              data-task-id={task.id}
                              selected={selectedTaskId === task.id}
                              onOpen={() => setSelectedTaskId(task.id)}
                              leading={
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${TASK_STATUS_DOT[task.status] ?? 'bg-app-muted'}`}
                                />
                              }
                              id={task.id}
                              title={taskTitle(task)}
                              meta={[task.assignedAgent || 'unassigned', time]
                                .filter(Boolean)
                                .join(' · ')}
                              trailing={
                                <>
                                  {onRunTask && isTaskRunnable(task, tasks) && (
                                    <Button
                                      variant="ghost"
                                      size="compact"
                                      onClick={() => onRunTask(task.id)}
                                      disabled={taskRunBusy}
                                      aria-disabled={taskRunBusy}
                                      aria-label={`Run ${task.id}`}
                                    >
                                      Run
                                    </Button>
                                  )}
                                  <span className="text-xs text-app-muted">
                                    {statusLabel(task.status)}
                                  </span>
                                </>
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                    {selectedTaskId && tasks.some((task) => task.id === selectedTaskId) && (
                      <TaskDetailPanel
                        task={tasks.find((task) => task.id === selectedTaskId) as TaskItem}
                        maxAttempts={TASK_MAX_ATTEMPTS}
                        onClose={() => setSelectedTaskId(null)}
                      />
                    )}
                  </div>
                )}

                {/* TAB: Runs */}
                {activeProjectTab === 'runs' && <RunsEvidenceView runs={runs} />}

                {/* TAB: Graph */}
                {activeProjectTab === 'graph' &&
                  (projectContext ? (
                    <ContextView context={projectContext} />
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
                  />
                )}
              </div>

              {/* DANGER ZONE AT THE BOTTOM OF THE PROJECT SETTINGS */}
              <div data-danger-zone className="px-6 pb-6 pt-4">
                <SettingsGroup
                  title={<span className="text-app-error">Zona de peligro (Danger Zone)</span>}
                >
                  <div className="space-y-3 p-4">
                    <p className="text-xs leading-relaxed text-app-muted">
                      Borra permanentemente los datos de este proyecto guardados en SQLite. No borra
                      la carpeta del proyecto.
                    </p>
                    <Button
                      variant="ghost"
                      size="compact"
                      leadingIcon={Trash2}
                      className="text-app-error"
                      onClick={() => setShowPurgeConfirm(true)}
                    >
                      Borrar definitivamente los datos del proyecto
                    </Button>
                  </div>
                </SettingsGroup>
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
                  const purgedId = selectedProject.id
                  purgingProjectId.current = purgedId
                  configRequest.current?.abort()
                  void Promise.resolve(onPurgeProjectData?.(purgedId)).finally(() => {
                    if (purgingProjectId.current === purgedId) purgingProjectId.current = null
                  })
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
              pending. Does NOT touch config, skills, CONTEXT.md, or memory.
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
                      showToast(error instanceof Error ? error.message : 'Reset failed', 'error'),
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

      {/* Dynamic Toast Feedback (e.g. "Default agent: Codex") */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-control bg-zinc-900/95 border border-zinc-700/80 text-zinc-100 shadow-2xl font-mono text-xs">
            <div
              className={`w-2 h-2 rounded-full ${toastMessage.tone === 'error' ? 'bg-app-error' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`}
            />
            <span className="font-semibold">{toastMessage.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
