import type { FileNode, ProjectItem } from '../types/orchestos'

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'orchestos',
    name: 'orchestos',
    branch: 'master',
    isPrimary: true,
    filesCount: 142,
    agents: [
      {
        id: 'ag_handoff',
        name: 'Handoff y resolución de gates',
        model: 'gpt-5.6-terra',
        duration: '1h',
        status: 'active',
        shellCommandsCount: 3,
        filesCount: 4,
        lastLog: 'Listed 1 directory, ran 3 shell commands. Injected UI.8 gates into tasks.yaml.',
        branch: 'refs/orchestos/sandbox-t3',
      },
      {
        id: 'ag_fast_qa',
        name: 'Dual QA Worktree Verifier',
        model: 'claude-3-7-sonnet',
        duration: '17m',
        status: 'completed',
        shellCommandsCount: 2,
        filesCount: 2,
        lastLog: 'Deterministic check passed: tsc --noEmit (0 errors in 48 files).',
        branch: 'refs/orchestos/sandbox-qa',
      },
    ],
  },
  {
    id: 'memories_md',
    name: 'MemoriesMD',
    branch: 'main',
    isPrimary: true,
    filesCount: 86,
    agents: [
      {
        id: 'ag_mem1',
        name: 'Recursos de diseño frontend',
        model: 'gpt-5.6-luna',
        duration: '2d',
        status: 'idle',
        shellCommandsCount: 5,
        filesCount: 8,
        lastLog: 'Synchronized design tokens into theme.json',
        branch: 'main',
      },
    ],
  },
  {
    id: 'sala_despecho',
    name: 'SalaDespecho',
    branch: 'main',
    isPrimary: false,
    filesCount: 64,
    agents: [
      {
        id: 'ag_sala1',
        name: 'Verificación de funciones core',
        model: 'deepseek-v3',
        duration: '3d',
        status: 'idle',
        shellCommandsCount: 1,
        filesCount: 1,
        lastLog: 'Checked invariant rules on auth endpoints',
        branch: 'main',
      },
    ],
  },
]

export const ORCHESTOS_FILE_TREE: FileNode[] = [
  {
    name: 'context',
    path: 'context',
    isDir: true,
    children: [
      {
        name: 'CONSTITUTION.md',
        path: 'context/CONSTITUTION.md',
        isDir: false,
        size: '1.2 KB',
        content: `# CONSTITUTION.md - Immutable Rules for OrchestOS Sub-Agents
1. NEVER modify files outside the declared tasks.yaml output[] slice.
2. ALWAYS execute tests within the ephemeral git worktree branch.
3. NEVER emit placeholder comments ("// TODO: implement this"). Write production code.
4. If tsc or test verifiers fail, automatically revert the worktree.
5. Record every token and sub-agent invocation in the SQLite evidence log.`,
      },
      {
        name: 'CONTEXT.md',
        path: 'context/CONTEXT.md',
        isDir: false,
        size: '3.4 KB',
        content: `# CONTEXT.md - OrchestOS Architecture
- Framework: Vite + React 19 + Tailwind CSS
- Runtime: Bun / Node.js
- Persistence: SQLite telemetry database
- Supported Providers: Claude, Gemini 2.5 Pro, Codex, DeepSeek, OpenCode
- Specs: WHEN/THEN Gherkin acceptance criteria
- Memory: Semantic vector embeddings cache with automated contradiction detection`,
      },
      {
        name: 'graph-rules.json',
        path: 'context/graph-rules.json',
        isDir: false,
        size: '840 B',
        content: JSON.stringify(
          {
            maxParallelWorktrees: 4,
            enforceAstBoundaries: true,
            denyUnapprovedDeletions: true,
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    name: 'dashboard',
    path: 'dashboard',
    isDir: true,
    children: [
      {
        name: 'server.ts',
        path: 'dashboard/server.ts',
        isDir: false,
        size: '2.8 KB',
        content: `import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "0.12.0" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("OrchestOS dashboard server running");
});`,
      },
      {
        name: 'ui.tsx',
        path: 'dashboard/ui.tsx',
        isDir: false,
        size: '4.1 KB',
        content: `// React Islands architecture for OrchestOS UI`,
      },
    ],
  },
  {
    name: 'db',
    path: 'db',
    isDir: true,
    children: [
      {
        name: 'sqlite-telemetry.ts',
        path: 'db/sqlite-telemetry.ts',
        isDir: false,
        size: '5.2 KB',
        content: `// Telemetry storage for runs, costs, and token consumption`,
      },
      {
        name: 'schema.sql',
        path: 'db/schema.sql',
        isDir: false,
        size: '1.9 KB',
        content: `CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  cost_usd REAL,
  qa_verdict TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
      },
    ],
  },
  {
    name: 'detect',
    path: 'detect',
    isDir: true,
    children: [
      { name: 'boundary-check.ts', path: 'detect/boundary-check.ts', isDir: false, size: '2.1 KB' },
      { name: 'file-leaks.ts', path: 'detect/file-leaks.ts', isDir: false, size: '1.8 KB' },
    ],
  },
  {
    name: 'evals',
    path: 'evals',
    isDir: true,
    children: [
      { name: 'qa-evaluator.ts', path: 'evals/qa-evaluator.ts', isDir: false, size: '3.9 KB' },
    ],
  },
  {
    name: 'generators',
    path: 'generators',
    isDir: true,
    children: [
      { name: 'code-gen.ts', path: 'generators/code-gen.ts', isDir: false, size: '4.5 KB' },
    ],
  },
  {
    name: 'graph',
    path: 'graph',
    isDir: true,
    children: [
      { name: 'ast-dependency.ts', path: 'graph/ast-dependency.ts', isDir: false, size: '3.1 KB' },
    ],
  },
  {
    name: 'hooks',
    path: 'hooks',
    isDir: true,
    children: [
      { name: 'git-pre-commit.ts', path: 'hooks/git-pre-commit.ts', isDir: false, size: '1.5 KB' },
    ],
  },
  {
    name: 'instincts',
    path: 'instincts',
    isDir: true,
    children: [
      {
        name: 'learned-patterns.json',
        path: 'instincts/learned-patterns.json',
        isDir: false,
        size: '2.4 KB',
      },
    ],
  },
  {
    name: 'memory',
    path: 'memory',
    isDir: true,
    children: [
      { name: 'vector-store.ts', path: 'memory/vector-store.ts', isDir: false, size: '4.8 KB' },
      { name: 'conflicts.ts', path: 'memory/conflicts.ts', isDir: false, size: '2.9 KB' },
    ],
  },
  {
    name: 'providers',
    path: 'providers',
    isDir: true,
    children: [
      { name: 'claude.ts', path: 'providers/claude.ts', isDir: false, size: '3.2 KB' },
      { name: 'gemini.ts', path: 'providers/gemini.ts', isDir: false, size: '3.1 KB' },
      { name: 'openai.ts', path: 'providers/openai.ts', isDir: false, size: '2.8 KB' },
      { name: 'deepseek.ts', path: 'providers/deepseek.ts', isDir: false, size: '2.4 KB' },
    ],
  },
  {
    name: 'tasks',
    path: 'tasks',
    isDir: true,
    children: [
      {
        name: 'tasks.yaml',
        path: 'tasks/tasks.yaml',
        isDir: false,
        size: '1.8 KB',
        content: `version: "0.12"
sprint: "Sprint 30"
tasks:
  - id: t1_sandbox_worktree
    status: done
    output:
      - src/sandbox/worktree.ts
      - src/sandbox/isolation.ts
    depends_on: []
    engine: agentic
  - id: t2_contract_checker
    status: done
    output:
      - src/run/contract-check.ts
    depends_on: [t1_sandbox_worktree]
    engine: agentic`,
      },
    ],
  },
  {
    name: 'cli.ts',
    path: 'cli.ts',
    isDir: false,
    size: '6.7 KB',
    content: `#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('orchestos')
  .description('Autonomous Agent Orchestration Engine with Git Worktree & Dual QA Isolation')
  .version('0.12.0');

program.parse();`,
  },
  {
    name: 'index.ts',
    path: 'index.ts',
    isDir: false,
    size: '1.1 KB',
    content: `export * from './dashboard/server';
export * from './evals/qa-evaluator';
export * from './tasks/tasks';`,
  },
  {
    name: 'AGENTS.md',
    path: 'AGENTS.md',
    isDir: false,
    size: '2.5 KB',
    content: `# AGENTS.md - Multi-Agent Coordination Protocol
- **Primary Orchestrator**: Coordinates tasks, maintains tasks.yaml DAG
- **Code Synthesizer**: Implements only authorized output[] files
- **QA Validator**: Independent LLM verifier enforcing acceptance criteria
- **Diagnostician**: Analyzes failures and generates learned instincts`,
  },
  {
    name: '.gitignore',
    path: '.gitignore',
    isDir: false,
    size: '180 B',
    content: `node_modules/
dist/
.worktrees/
*.sqlite
.DS_Store`,
  },
]
