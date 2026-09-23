export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'failed_permanent' | 'blocked'

export type QaVerdict = 'pass' | 'fail' | null

export type ExecutionEngine = 'single-shot' | 'agentic' | 'external' | 'opencode' | 'codex'

export interface TaskItem {
  id: string
  title?: string
  description: string
  status: TaskStatus
  output: string[] // contract writeable files
  outputSlice?: string[]
  assignedAgent?: string
  depends_on: string[]
  acceptance_criteria: string[]
  retryCount: number
  retryReason?: string | null
  qaVerdict?: QaVerdict
  runId?: string | null
  engine: ExecutionEngine
  costUsd?: number | null
  specId?: string
  sprint?: string
}

export interface FileDiffEntry {
  path?: string
  filePath?: string
  status: 'added' | 'modified'
  diff?: string
  patch?: string
  additions?: number
  deletions?: number
}

export interface CostBreakdownEntry {
  label: string
  model: string
  effort?: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface ContextWarningEntry {
  code: string
  severity: 'warning' | 'critical' | 'notice'
  message: string
}

export interface DeterministicCheck {
  name: string
  command?: string
  passed: boolean
  durationMs?: number
  output?: string
  exitCode?: number
}

export interface QaEvaluationItem {
  criterion: string
  passed: boolean
  rationale: string
}

export interface RunItem {
  id: string
  taskId: string
  taskDescription: string
  status: 'done' | 'blocked' | 'failed'
  qaVerdict: QaVerdict
  model: string
  agentModel?: string
  provider: string
  inputTokens: number
  outputTokens: number
  tokensUsed?: number
  costUsd: number
  elapsedMs: number
  duration?: string
  engine: ExecutionEngine
  iterations: number
  deterministicChecks: DeterministicCheck[]
  qaEvaluation: QaEvaluationItem[]
  filesAttempted: string[]
  filesAuthorized: string[]
  filesBlocked: string[]
  fileDiffs: FileDiffEntry[]
  outputSlice?: string[]
  costBreakdown: CostBreakdownEntry[]
  contextWarnings: ContextWarningEntry[]
  createdAt: string
  diagnose?: {
    pattern: string
    confidence: 'high' | 'medium' | 'low'
    suggestion: string
  }
}

export interface SpecCriteria {
  when: string
  then: string
}

export interface SpecItem {
  id: string
  taskId: string
  title: string
  status: 'draft' | 'approved' | 'archived'
  clarify: 'pending' | 'resolved' | 'none'
  lintStatus: 'pass' | 'fail' | 'unknown'
  lintFindings: number
  deltaIssues: number
  criteria: SpecCriteria[]
  createdAt: string
  rawMarkdown?: string
}

export interface InstinctItem {
  id: string
  trigger: string
  action: string
  confidence: number
  source: 'manual' | 'auto'
  verified: boolean
  usagesCount: number
  createdAt?: string
}

export interface MemoryItem {
  id: string
  topicKey: string
  scope: 'session' | 'project' | 'global'
  content: string
  updatedAt: string
  hasConflict?: boolean
  conflictDetails?: {
    conflictingContent: string
    detectedFromRun: string
  }
}

export interface SkillItem {
  id: string
  name: string
  language: string
  verifierCommand: string
  status: 'compiled' | 'source' | 'remote'
  usageRuns: number
  description: string
}

export interface ToolExecution {
  name: string
  args: Record<string, any>
  result?: string
  status: 'running' | 'success' | 'failed'
  durationMs?: number
}

export interface ProjectContext {
  constitution: string
  contextDoc: string
  codeGraphNodes: number
  edges: number
  languages: Array<{ language: string; files: number }>
  staleFiles: string[]
  isCleanWorktree: boolean | null
  gitBranch: string | null
  indexedAt: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  reasoning?: string[]
  toolCalls?: ToolExecution[]
  attachments?: ChatAttachment[]
  model?: string
  effort?: string
  taskContract?: {
    output: string[]
    status: 'verified' | 'violation'
    blockedFiles?: string[]
  }
  taskHeld?: boolean
  heldTask?: {
    taskId: string
    taskDescription: string
    actionRequired: string
    estimatedImpact?: string
  }
  proposedTask?: {
    id: string
    description: string
    output: string[]
  }
}

export type AppMode = 'chat' | 'dev' | 'settings'

export type NavigationTab =
  | 'threads'
  | 'plan'
  | 'runs'
  | 'specs'
  | 'instincts'
  | 'memory'
  | 'skills'
  | 'context'

export type DevSubTab =
  | 'tasks'
  | 'runs'
  | 'graph'
  | 'memory'
  | 'specs'
  | 'skills'
  | 'instincts'
  | 'settings'

export interface ChatAttachment {
  id: string
  name: string
  size: string
  type: 'file' | 'pdf' | 'folder' | 'image'
}

export interface AgentSession {
  id: string
  name: string
  agent?: string
  model: string
  effort?: string
  duration: string
  status: 'active' | 'completed' | 'idle'
  shellCommandsCount: number
  filesCount: number
  lastLog?: string
  branch?: string
}

export type AgentItem = AgentSession

export interface ProjectItem {
  id: string
  name: string
  branch?: string
  isPrimary?: boolean
  agents: AgentSession[]
  path?: string
  filesCount: number
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
  content?: string
  size?: string
}

export interface ChatThread {
  id: string
  title: string
  agent: string
  mode: 'orchestrator' | 'coder' | 'qa_validator' | 'diagnostician'
  status: 'active' | 'completed' | 'waiting_approval'
  createdAt: string
  updatedAt: string
  tokenCount: number
  costUsd: number
  messages: ChatMessage[]
  projectId?: string | null
}

export interface ProviderCliStatus {
  id: 'claude' | 'codex' | 'opencode' | 'deepseek' | 'gemini' | 'kimi'
  label: string
  binary: string
  available: boolean
  contextUsed: number
  contextWindow: number
  rateLimitPct: number
}

export interface SessionCliStatus {
  id: string
  label: string
  binary: string
  icon: string
  installed: boolean
  available: boolean
  observedAt: string | null
  context: {
    used: number
    window: number
    pct: number
    level: 'ok' | 'warn' | 'critical'
    model: string | null
  } | null
  rateLimits: {
    windows: Array<{
      id: string
      usedPct: number
      remainingPct?: number
      windowMinutes: number | null
      resetsAt: number | null
    }>
  } | null
}

export interface SessionStatus {
  available: boolean
  clis: SessionCliStatus[]
}
