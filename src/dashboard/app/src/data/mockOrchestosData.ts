import {
  TaskItem,
  RunItem,
  SpecItem,
  InstinctItem,
  MemoryItem,
  SkillItem,
  ChatThread,
  ProviderCliStatus,
  ProjectContext,
} from '../types/orchestos.ts';

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't1_sandbox_worktree',
    description: 'Enforce git worktree isolation for LLM sandbox writes before QA evaluation',
    status: 'done',
    output: [
      'src/sandbox/worktree.ts',
      'src/sandbox/isolation.ts',
      'tests/sandbox.test.ts',
    ],
    depends_on: [],
    acceptance_criteria: [
      'All writes stay isolated on branch refs/orchestos/sandbox-*',
      'Non-zero exit code cleans up temp worktree without dirtying main branch',
      'Audit log records commit SHA and verified file tree',
    ],
    retryCount: 0,
    qaVerdict: 'pass',
    runId: 'run_88190a',
    engine: 'agentic',
    costUsd: 0.0412,
    specId: 'spec_sandbox_v1',
    sprint: 'Sprint 30',
  },
  {
    id: 't2_contract_checker',
    description: 'Block unauthorized writes outside declared tasks.yaml output[] slice',
    status: 'done',
    output: [
      'src/run/contract-check.ts',
      'src/run/violations-logger.ts',
    ],
    depends_on: ['t1_sandbox_worktree'],
    acceptance_criteria: [
      'Any write to an undeclared path raises ContractViolationError',
      'Zero byte modifications outside contract trigger immediate rollback',
      'SQLite records attempted, authorized, and blocked file lists',
    ],
    retryCount: 1,
    qaVerdict: 'pass',
    runId: 'run_7241cf',
    engine: 'agentic',
    costUsd: 0.0285,
    specId: 'spec_contract_v2',
    sprint: 'Sprint 30',
  },
  {
    id: 't3_qa_validator_v2',
    description: 'Implement dual-stage QA LLM evaluator with WHEN/THEN assertion verifier',
    status: 'running',
    output: [
      'src/qa/evaluator.ts',
      'src/qa/prompts/criteria-check.ts',
    ],
    depends_on: ['t2_contract_checker'],
    acceptance_criteria: [
      'Second LLM runs strictly on isolated worktree snapshot',
      'Deterministic test suite runs before any QA LLM tokens are billed',
      'Failing criterion returns actionable revert reason to diagnostic agent',
    ],
    retryCount: 0,
    qaVerdict: null,
    runId: 'run_99341b',
    engine: 'agentic',
    costUsd: 0.0162,
    specId: 'spec_qa_eval',
    sprint: 'Sprint 30',
  },
  {
    id: 't4_memory_conflict_resolver',
    description: 'Cross-agent semantic memory conflict detector with automated synthesis',
    status: 'pending',
    output: [
      'src/memory/conflict-detector.ts',
      'src/memory/synthesis-wizard.ts',
    ],
    depends_on: ['t1_sandbox_worktree'],
    acceptance_criteria: [
      'Cosine similarity > 0.82 with opposite polarity triggers conflict flag',
      'UI dashboard renders diff resolution drawer',
      'Approved resolution persists with higher confidence score',
    ],
    retryCount: 0,
    qaVerdict: null,
    runId: null,
    engine: 'single-shot',
    costUsd: null,
    sprint: 'Sprint 31',
  },
  {
    id: 't5_skills_compiler_go',
    description: 'Add Go 1.23 language-aware skill verifier and test harness scaffold',
    status: 'blocked',
    output: [
      'src/skills/languages/golang.ts',
      'skills/definitions/golang/verifier.yaml',
    ],
    depends_on: ['t3_qa_validator_v2'],
    acceptance_criteria: [
      'Scaffold generates go.mod with govulncheck verifier',
      'Builds against official 36 language matrix schema',
    ],
    retryCount: 2,
    qaVerdict: 'fail',
    runId: 'run_6612ea',
    engine: 'external',
    costUsd: 0.0341,
    sprint: 'Sprint 31',
  },
  {
    id: 't6_spec_delta_validator',
    description: 'Inspect WHEN/THEN spec delta headers during git pre-commit hook',
    status: 'failed_permanent',
    output: [
      'src/specs/delta-headers.ts',
      'src/specs/lint-engine.ts',
    ],
    depends_on: [],
    acceptance_criteria: [
      'Delta headers must match git diff affected symbols',
      'Reject specs missing explicit negative assertions',
    ],
    retryCount: 3,
    qaVerdict: 'fail',
    runId: 'run_5510ab',
    engine: 'agentic',
    costUsd: 0.0528,
    sprint: 'Sprint 29',
  },
];

export const INITIAL_RUNS: RunItem[] = [
  {
    id: 'run_99341b',
    taskId: 't3_qa_validator_v2',
    taskDescription: 'Implement dual-stage QA LLM evaluator with WHEN/THEN assertion verifier',
    status: 'done',
    qaVerdict: 'pass',
    model: 'claude-3-7-sonnet',
    provider: 'OpenRouter (Anthropic)',
    inputTokens: 18420,
    outputTokens: 3180,
    costUsd: 0.0712,
    elapsedMs: 4280,
    engine: 'agentic',
    iterations: 3,
    deterministicChecks: [
      { name: 'tsc --noEmit', command: 'bun run typecheck', passed: true, durationMs: 640 },
      { name: 'bun test tests/qa-eval.test.ts', command: 'bun test tests/qa-eval.test.ts', passed: true, durationMs: 1220 },
    ],
    qaEvaluation: [
      {
        criterion: 'Second LLM runs strictly on isolated worktree snapshot',
        passed: true,
        rationale: 'Verified worktree directory path ref is checked before QA prompt execution.',
      },
      {
        criterion: 'Deterministic test suite runs before any QA LLM tokens are billed',
        passed: true,
        rationale: 'Short-circuit check reverts dirty files if exit code is non-zero before evaluator dispatch.',
      },
    ],
    filesAttempted: [
      'src/qa/evaluator.ts',
      'src/qa/prompts/criteria-check.ts',
    ],
    filesAuthorized: [
      'src/qa/evaluator.ts',
      'src/qa/prompts/criteria-check.ts',
    ],
    filesBlocked: [],
    fileDiffs: [
      {
        path: 'src/qa/evaluator.ts',
        status: 'modified',
        diff: `@@ -14,6 +14,14 @@
 export async function evaluateWorktreeCriteria(
   worktreePath: string,
   criteria: AcceptanceCriterion[]
-): Promise<QAVerdict> {
-  return { passed: true, rationale: 'stub' };
+): Promise<QAVerdict> {
+  const snapshot = await createWorktreeSnapshot(worktreePath);
+  const prompt = buildCriteriaVerificationPrompt(snapshot, criteria);
+  const response = await dispatchModelCall({
+    model: 'anthropic/claude-3.7-sonnet',
+    prompt,
+    temperature: 0.1
+  });
+  return parseVerdictResponse(response);
 }`,
      },
    ],
    costBreakdown: [
      { label: 'Context Planning (Orchestrator)', model: 'claude-3-7-sonnet', inputTokens: 5200, outputTokens: 640, costUsd: 0.0182 },
      { label: 'Code Synthesizer (Agentic Round 1)', model: 'claude-3-7-sonnet', inputTokens: 8100, outputTokens: 1820, costUsd: 0.0384 },
      { label: 'QA Validator (Second LLM)', model: 'claude-3-7-sonnet', inputTokens: 5120, outputTokens: 720, costUsd: 0.0146 },
    ],
    contextWarnings: [
      { code: 'W_CONTEXT_WINDOW_80', severity: 'notice', message: 'Context window utilization reached 74% during second agentic loop.' },
    ],
    createdAt: '2026-09-21T13:42:10Z',
  },
  {
    id: 'run_7241cf',
    taskId: 't2_contract_checker',
    taskDescription: 'Block unauthorized writes outside declared tasks.yaml output[] slice',
    status: 'done',
    qaVerdict: 'pass',
    model: 'gemini-2.5-pro',
    provider: 'Google AI Studio',
    inputTokens: 14100,
    outputTokens: 2450,
    costUsd: 0.0285,
    elapsedMs: 2950,
    engine: 'agentic',
    iterations: 2,
    deterministicChecks: [
      { name: 'Contract Enforcement Test', command: 'bun test tests/contract.test.ts', passed: true, durationMs: 820 },
      { name: 'Zero-byte write integrity', command: 'bun run test:integrity', passed: true, durationMs: 410 },
    ],
    qaEvaluation: [
      {
        criterion: 'Any write to an undeclared path raises ContractViolationError',
        passed: true,
        rationale: 'Intercepted fs.writeFile and git checkout correctly aborts on extraneous paths.',
      },
    ],
    filesAttempted: [
      'src/run/contract-check.ts',
      'src/run/violations-logger.ts',
      'package.json', // Model attempted to modify package.json!
    ],
    filesAuthorized: [
      'src/run/contract-check.ts',
      'src/run/violations-logger.ts',
    ],
    filesBlocked: [
      'package.json', // BLOCKED by OrchestOS Contract Guard!
    ],
    fileDiffs: [
      {
        path: 'src/run/contract-check.ts',
        status: 'added',
        diff: `@@ -0,0 +1,24 @@
+export class ContractViolationError extends Error {
+  constructor(public readonly unauthorizedFiles: string[]) {
+    super(\`Unauthorized writes blocked by OrchestOS contract: \${unauthorizedFiles.join(', ')}\`);
+  }
+}`,
      },
    ],
    costBreakdown: [
      { label: 'Orchestrator Context', model: 'gemini-2.5-pro', inputTokens: 6200, outputTokens: 900, costUsd: 0.0102 },
      { label: 'Code Execution Engine', model: 'gemini-2.5-pro', inputTokens: 7900, outputTokens: 1550, costUsd: 0.0183 },
    ],
    contextWarnings: [
      { code: 'W_CONTRACT_FILE_BLOCKED', severity: 'warning', message: 'Model attempted write to package.json which was successfully blocked by contract.' },
    ],
    createdAt: '2026-09-21T13:15:22Z',
  },
  {
    id: 'run_5510ab',
    taskId: 't6_spec_delta_validator',
    taskDescription: 'Inspect WHEN/THEN spec delta headers during git pre-commit hook',
    status: 'failed',
    qaVerdict: 'fail',
    model: 'claude-3-7-sonnet',
    provider: 'OpenRouter (Anthropic)',
    inputTokens: 21800,
    outputTokens: 3800,
    costUsd: 0.0528,
    elapsedMs: 5120,
    engine: 'agentic',
    iterations: 3,
    deterministicChecks: [
      { name: 'Lint delta specs', command: 'bun run spec:lint', passed: false, durationMs: 910, output: 'SyntaxError: WHEN clause line 42 missing THEN complement' },
    ],
    qaEvaluation: [
      {
        criterion: 'Delta headers must match git diff affected symbols',
        passed: false,
        rationale: 'Pre-commit hook failed deterministic verification before QA LLM stage.',
      },
    ],
    filesAttempted: [
      'src/specs/delta-headers.ts',
    ],
    filesAuthorized: [
      'src/specs/delta-headers.ts',
    ],
    filesBlocked: [],
    fileDiffs: [],
    costBreakdown: [
      { label: 'Round 1 Spec Synth', model: 'claude-3-7-sonnet', inputTokens: 11000, outputTokens: 1900, costUsd: 0.0264 },
      { label: 'Round 2 Retry', model: 'claude-3-7-sonnet', inputTokens: 10800, outputTokens: 1900, costUsd: 0.0264 },
    ],
    contextWarnings: [
      { code: 'W_QA_FAIL_THRESHOLD', severity: 'critical', message: 'Task reached 3 consecutive QA failures. Marked as failed_permanent. Diagnostic run triggered.' },
    ],
    diagnose: {
      pattern: 'deterministic_check',
      confidence: 'high',
      suggestion: 'Relax regex parser in src/specs/delta-headers.ts to tolerate multiline WHEN conditions before matching THEN assertion.',
    },
    createdAt: '2026-09-21T11:40:02Z',
  },
];

export const INITIAL_SPECS: SpecItem[] = [
  {
    id: 'spec_sandbox_v1',
    taskId: 't1_sandbox_worktree',
    title: 'Git Worktree Isolation & Cleanup Specification',
    status: 'approved',
    clarify: 'resolved',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    criteria: [
      {
        when: 'A task begins execution in sandbox mode',
        then: 'A dedicated git worktree is spawned under .orchestos/worktrees/<task_id>',
      },
      {
        when: 'The deterministic test suite exits with code 0 and QA LLM marks pass',
        then: 'Changes are merged into working branch with contract verification SHA recorded',
      },
      {
        when: 'Any check fails or process is interrupted',
        then: 'Worktree is immediately destroyed and working tree remains pristine',
      },
    ],
    createdAt: '2026-09-20T09:12:00Z',
  },
  {
    id: 'spec_contract_v2',
    taskId: 't2_contract_checker',
    title: 'Strict File Write Contract Boundary Specification',
    status: 'approved',
    clarify: 'resolved',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    criteria: [
      {
        when: 'LLM outputs a file path outside tasks.yaml output[] whitelist',
        then: 'FS sandbox interceptor discards the write and increments blockedFiles counter',
      },
      {
        when: 'Task completes with zero contract violations',
        then: 'Task state transitions to QA evaluation phase',
      },
    ],
    createdAt: '2026-09-20T14:20:00Z',
  },
  {
    id: 'spec_qa_eval',
    taskId: 't3_qa_validator_v2',
    title: 'Dual-Stage Deterministic + QA LLM Evaluator',
    status: 'approved',
    clarify: 'none',
    lintStatus: 'pass',
    lintFindings: 0,
    deltaIssues: 0,
    criteria: [
      {
        when: 'Deterministic checks fail (exit != 0)',
        then: 'Abort before spending QA LLM tokens and revert sandbox',
      },
      {
        when: 'Deterministic checks pass',
        then: 'Dispatch independent QA model with isolated prompt context',
      },
    ],
    createdAt: '2026-09-21T08:00:00Z',
  },
  {
    id: 'spec_memory_resolver',
    taskId: 't4_memory_conflict_resolver',
    title: 'Cross-Agent Memory Conflict Detection & Resolution',
    status: 'draft',
    clarify: 'pending',
    lintStatus: 'fail',
    lintFindings: 2,
    deltaIssues: 1,
    criteria: [
      {
        when: 'Two agent sessions store conflicting rules for same topicKey',
        then: 'Flag conflict in SQLite memory table and pause automated merges',
      },
    ],
    createdAt: '2026-09-21T12:00:00Z',
  },
];

export const INITIAL_INSTINCTS: InstinctItem[] = [
  {
    id: 'inst_01',
    trigger: 'User specifies API contract without type declarations',
    action: 'Automatically scaffold types.ts with strict discriminated unions before synthesizing route handlers',
    confidence: 0.96,
    source: 'auto',
    verified: true,
    usagesCount: 84,
    createdAt: '2026-09-18T10:00:00Z',
  },
  {
    id: 'inst_02',
    trigger: 'Task requires writing to package.json or config file',
    action: 'Verify whether file is declared in output[] whitelist; if missing, request inline user contract expansion',
    confidence: 0.92,
    source: 'manual',
    verified: true,
    usagesCount: 42,
    createdAt: '2026-09-19T14:30:00Z',
  },
  {
    id: 'inst_03',
    trigger: 'Deterministic test fails with ModuleNotFound after new dependency',
    action: 'Inject package installation step into pre-check pipeline instead of modifying source imports',
    confidence: 0.74,
    source: 'auto',
    verified: false,
    usagesCount: 12,
    createdAt: '2026-09-21T09:15:00Z',
  },
  {
    id: 'inst_04',
    trigger: 'LLM prompt length exceeds 70% of model context window',
    action: 'Invoke context compressor on project files, reducing to CONTEXT.md summary before prompt dispatch',
    confidence: 0.88,
    source: 'manual',
    verified: true,
    usagesCount: 65,
    createdAt: '2026-09-20T11:00:00Z',
  },
];

export const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_01',
    topicKey: 'build_toolchain',
    scope: 'project',
    content: 'Always use Bun for local script execution and test runner (bun test), not npm test.',
    updatedAt: '2026-09-21T10:00:00Z',
  },
  {
    id: 'mem_02',
    topicKey: 'coding_contract',
    scope: 'global',
    content: 'Never emit direct filesystem writes without checking contract whitelist in tasks.yaml.',
    updatedAt: '2026-09-21T11:15:00Z',
  },
  {
    id: 'mem_03',
    topicKey: 'styling_system',
    scope: 'project',
    content: 'Project uses Tailwind CSS v4 with modern dark palette (#09090b zinc base) and Lucide React icons.',
    updatedAt: '2026-09-21T12:00:00Z',
    hasConflict: true,
    conflictDetails: {
      conflictingContent: 'Legacy island used vanilla CSS without Tailwind classes in src/dashboard/styles/ui.css',
      detectedFromRun: 'run_5510ab',
    },
  },
  {
    id: 'mem_04',
    topicKey: 'qa_gate_policy',
    scope: 'project',
    content: 'Three consecutive QA failures mark task as failed_permanent and invoke auto-diagnostician agent.',
    updatedAt: '2026-09-20T16:20:00Z',
  },
];

export const INITIAL_SKILLS: SkillItem[] = [
  {
    id: 'skill_typescript',
    name: 'TypeScript Strict Verifier',
    language: 'TypeScript',
    verifierCommand: 'tsc --noEmit --strict',
    status: 'compiled',
    usageRuns: 1420,
    description: 'Enforces ES2022 syntax, strict null checks, and isolatedModules validation.',
  },
  {
    id: 'skill_rust',
    name: 'Rust Cargo Clippy & Miri',
    language: 'Rust',
    verifierCommand: 'cargo clippy --all-targets -- -D warnings',
    status: 'compiled',
    usageRuns: 310,
    description: 'Zero-warning compiler gate with memory safety and ownership invariants verification.',
  },
  {
    id: 'skill_python',
    name: 'Python Pyright & Ruff',
    language: 'Python',
    verifierCommand: 'ruff check . && pyright',
    status: 'compiled',
    usageRuns: 520,
    description: 'Ultra-fast AST linting and type inference for agentic data pipelines.',
  },
  {
    id: 'skill_golang',
    name: 'Go Vet & Govulncheck',
    language: 'Go',
    verifierCommand: 'go vet ./... && govulncheck ./...',
    status: 'source',
    usageRuns: 78,
    description: 'Checks concurrency race conditions, shadow variables, and package vulnerabilities.',
  },
  {
    id: 'skill_docker_sandbox',
    name: 'Dockerized Ephemeral Sandbox',
    language: 'Shell / Docker',
    verifierCommand: 'docker run --rm -v $(pwd):/app:ro test-runner',
    status: 'remote',
    usageRuns: 195,
    description: 'Network-isolated runtime container for untrusted agent code execution.',
  },
];

export const INITIAL_PROVIDERS: ProviderCliStatus[] = [
  {
    id: 'claude',
    label: 'Claude 3.7 Sonnet',
    binary: 'claude-cli',
    available: true,
    contextUsed: 64200,
    contextWindow: 200000,
    rateLimitPct: 32,
  },
  {
    id: 'gemini',
    label: 'Gemini 2.5 Pro',
    binary: 'gemini-cli',
    available: true,
    contextUsed: 42000,
    contextWindow: 1000000,
    rateLimitPct: 18,
  },
  {
    id: 'codex',
    label: 'GPT-4o Codex',
    binary: 'openai-cli',
    available: true,
    contextUsed: 28400,
    contextWindow: 128000,
    rateLimitPct: 45,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek V3 / R1',
    binary: 'deepseek-cli',
    available: true,
    contextUsed: 51200,
    contextWindow: 128000,
    rateLimitPct: 22,
  },
  {
    id: 'opencode',
    label: 'Local Ollama / Qwen 2.5 Coder',
    binary: 'ollama',
    available: true,
    contextUsed: 16000,
    contextWindow: 32768,
    rateLimitPct: 0,
  },
];

export const INITIAL_THREADS: ChatThread[] = [
  {
    id: 'th_orchestrator_main',
    title: 'Audit and Sandbox Dual QA Pipeline',
    agent: 'OrchestOS Core',
    mode: 'orchestrator',
    status: 'active',
    createdAt: '2026-09-21T13:30:00Z',
    updatedAt: '2026-09-21T13:45:00Z',
    tokenCount: 24800,
    costUsd: 0.0824,
    messages: [
      {
        id: 'msg_01',
        role: 'user',
        content: 'I need to run the next task in queue: t3_qa_validator_v2. Show me the contract whitelist and execute with Claude 3.7 Sonnet.',
        timestamp: '13:30:12',
      },
      {
        id: 'msg_02',
        role: 'assistant',
        content: 'Inspecting `tasks.yaml` contract for task **t3_qa_validator_v2**:\n\n- **Target Contract**: `src/qa/evaluator.ts`, `src/qa/prompts/criteria-check.ts`\n- **Dependencies**: `t2_contract_checker` (PASSED)\n- **Sandbox Strategy**: Ephemeral git worktree isolation at `.orchestos/worktrees/t3`\n\nI will now execute the middleware chain, inject relevant instincts, and synthesize the criteria evaluation module.',
        timestamp: '13:30:15',
        reasoning: [
          'Reading tasks.yaml and validating dependency DAG',
          'Querying vector memory for topicKey "qa_gate_policy"',
          'Loading instincts inst_01 and inst_04 into prompt context',
          'Spawning git worktree sandbox branch refs/orchestos/sandbox-t3',
        ],
        toolCalls: [
          {
            name: 'orchestos.worktree.spawn',
            args: { taskId: 't3_qa_validator_v2', branch: 'refs/orchestos/sandbox-t3' },
            result: 'Worktree created at /tmp/orchestos-worktree-t3 (commit 88190a)',
            status: 'success',
            durationMs: 140,
          },
          {
            name: 'orchestos.contract.verify_whitelist',
            args: { declaredOutput: ['src/qa/evaluator.ts', 'src/qa/prompts/criteria-check.ts'] },
            result: '2 files authorized. Contract barrier active.',
            status: 'success',
            durationMs: 45,
          },
          {
            name: 'orchestos.runner.dispatch',
            args: { model: 'claude-3-7-sonnet', engine: 'agentic', rounds: 3 },
            result: 'Code generated successfully. 0 contract violations.',
            status: 'success',
            durationMs: 2420,
          },
        ],
        taskContract: {
          output: ['src/qa/evaluator.ts', 'src/qa/prompts/criteria-check.ts'],
          status: 'verified',
        },
      },
      {
        id: 'msg_03',
        role: 'assistant',
        content: 'Deterministic test suite completed with **0 errors**. The second LLM QA evaluator evaluated acceptance criteria against the isolated worktree snapshot:\n\n- [x] Isolated worktree snapshot execution: **PASS**\n- [x] Zero QA tokens spent on pre-check failure: **PASS**\n- [x] Diagnostic hook on reversion: **PASS**\n\nThe commit is ready to prove in git. Would you like me to close the plan item and merge into main?',
        timestamp: '13:31:02',
        taskHeld: true,
        proposedTask: {
          id: 't3_qa_validator_v2',
          description: 'Merge proven sandbox commit 99341b into main branch and record SQLite evidence',
          output: ['src/qa/evaluator.ts', 'src/qa/prompts/criteria-check.ts'],
        },
      },
    ],
  },
  {
    id: 'th_failure_diagnostician',
    title: 'Failure Analysis for Spec Delta Validator (t6)',
    agent: 'Diagnostician Agent',
    mode: 'diagnostician',
    status: 'waiting_approval',
    createdAt: '2026-09-21T11:45:00Z',
    updatedAt: '2026-09-21T11:52:00Z',
    tokenCount: 16400,
    costUsd: 0.048,
    messages: [
      {
        id: 'msg_d1',
        role: 'user',
        content: 'Diagnose why task t6_spec_delta_validator failed 3 consecutive times and suggest a corrective contract update.',
        timestamp: '11:45:10',
      },
      {
        id: 'msg_d2',
        role: 'assistant',
        content: 'I analyzed SQLite run logs for `run_5510ab`. The root cause is a **deterministic check syntax failure** in `src/specs/delta-headers.ts`.\n\nThe regex parser fails whenever a spec contains a multi-line `WHEN` condition before the corresponding `THEN` assertion.\n\n### Suggested Remediation:\n1. Expand `output[]` contract to include `src/specs/parser-rules.ts`\n2. Add test fixture for multi-line WHEN clauses\n3. Rerun task with instinct `inst_01` active.',
        timestamp: '11:46:00',
        reasoning: [
          'Queried SQLite table runs where taskId = t6_spec_delta_validator',
          'Detected regex backtracking crash in Stryker mutation run',
          'Synthesized failure pattern: deterministic_check with High confidence',
        ],
      },
    ],
  },
  {
    id: 'th_memory_synthesis',
    title: 'Cross-Agent Memory Conflict Resolution',
    agent: 'Memory Synthesis Wizard',
    mode: 'coder',
    status: 'completed',
    createdAt: '2026-09-21T12:10:00Z',
    updatedAt: '2026-09-21T12:25:00Z',
    tokenCount: 8900,
    costUsd: 0.024,
    messages: [
      {
        id: 'msg_m1',
        role: 'user',
        content: 'Review topicKey "styling_system" conflict between run_5510ab and current workspace.',
        timestamp: '12:10:00',
      },
      {
        id: 'msg_m2',
        role: 'assistant',
        content: 'Conflict resolved. Standardized on Tailwind CSS v4 design system with zinc-950 dark theme base and Plus Jakarta Sans typography across all UI islands.',
        timestamp: '12:11:00',
      },
    ],
  },
];

export const INITIAL_PROJECT_CONTEXT: ProjectContext = {
  constitution: `# CONSTITUTION.md - Immutable Rules for OrchestOS Sub-Agents
1. NEVER modify files outside the declared tasks.yaml output[] slice.
2. ALWAYS execute tests within the ephemeral git worktree branch.
3. NEVER emit placeholder comments ("// TODO: implement this"). Write production code.
4. If tsc or test verifiers fail, automatically revert the worktree.
5. Record every token and sub-agent invocation in the SQLite evidence log.`,
  contextDoc: `# CONTEXT.md - OrchestOS Architecture
- Framework: Vite + React 19 + Tailwind CSS
- Runtime: Bun / Node.js
- Persistence: SQLite telemetry database
- Supported Providers: Claude, Gemini 2.5 Pro, Codex, DeepSeek, OpenCode
- Specs: WHEN/THEN Gherkin acceptance criteria
- Memory: Semantic vector embeddings cache with automated contradiction detection`,
  codeGraphNodes: 64,
  isCleanWorktree: true,
  gitBranch: 'main',
};

// Aliases for convenience
export const initialMockTasks = INITIAL_TASKS;
export const initialMockRuns = INITIAL_RUNS;
export const initialMockSpecs = INITIAL_SPECS;
export const initialMockInstincts = INITIAL_INSTINCTS;
export const initialMockMemories = INITIAL_MEMORIES;
export const initialMockSkills = INITIAL_SKILLS;
export const initialMockProviders = INITIAL_PROVIDERS;
export const initialMockThreads = INITIAL_THREADS;
export const initialMockProjectContext = INITIAL_PROJECT_CONTEXT;
