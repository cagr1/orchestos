# orchestos — contract-first LLM coding runner

A CLI that runs LLM-powered coding tasks inside a declared file contract.
Each task specifies exactly which files it can write. Anything outside that list is blocked.
Every run produces evidence in SQLite. A QA LLM validates the output before marking it done.

369 tests · 0 fail · Mes 8 complete

---

## Install

```bash
# Requires Bun ≥ 1.1
curl -fsSL https://bun.sh/install | bash

git clone https://github.com/cagr1/orchestos
cd orchestos
bun install
```

Add to your shell (optional):

```bash
# ~/.bashrc or ~/.zshrc
alias orchestos="bun /path/to/orchestos/src/cli.ts"
```

Set your API keys (OpenRouter covers Claude, GPT-4o, Gemini, DeepSeek, etc.):

```bash
mkdir -p ~/.orchestos
cat > ~/.orchestos/.env <<EOF
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...    # optional, for direct Anthropic calls
OPENAI_API_KEY=sk-...           # optional, for embeddings (text-embedding-3-small)
EOF
```

---

## Quickstart (5 commands)

```bash
# 1. Detect stack and save to DB + index code graph
orchestos init ./my-project

# 2. Create a declarative task list
orchestos task init ./my-project
#    → Edit tasks.yaml: define id, description, output[]

# 3. Run the next pending task
orchestos task run ./my-project

# 4. See what happened
orchestos task status ./my-project

# 5. Inspect a specific run with full evidence
orchestos runs --detail <run-id>
```

---

## How it works

```
tasks.yaml  →  middleware chain  →  LLM call  →  contract check  →  checks[]  →  QA call  →  done / pending / failed_permanent
                (enrichment:              (blocked outside          (deterministic,      (second LLM
                 context, memory,          output[])                 exit-code based)     validates
                 skills, instincts)                                                       criteria)
```

1. **`tasks.yaml`** declares every task: what to do, which files may be written (`output[]`), and which tasks must complete first (`depends_on[]`).
2. **Middleware chain** enriches the task context before any LLM call: loads spec, sets up sandbox worktree, routes model, fetches memory, injects skills and instincts, builds the final prompt.
3. **LLM call** generates the files inside a git worktree (sandbox). Writes are isolated from the main branch until QA passes.
4. **Contract check** blocks any write outside the declared `output[]`. Violations are logged to SQLite and the task fails — nothing partial is written.
5. **Deterministic checks** run shell commands (typecheck, tests) before the QA LLM. First failure reverts files immediately — no QA tokens spent.
6. **QA call** is a second LLM call that evaluates each `acceptance_criteria` item. If any fails, files are reverted and the task goes back to `pending`.
7. After 3 QA failures the task becomes `failed_permanent`. A diagnosis agent automatically analyzes the run history and suggests a fix.
8. **Evidence** — every run writes to SQLite: tokens, cost breakdown per sub-agent, `snapshot_before/after`, files attempted/authorized/blocked, QA verdict, context monitor warnings.

---

## Quick command reference

### Task workflow

```bash
orchestos task init   ./my-project              # scaffold tasks.yaml
orchestos task list   ./my-project              # show status table
orchestos task run    ./my-project              # run next pending task
orchestos task run    ./my-project --id t1      # run specific task
orchestos task run    ./my-project --explain t1 # dry-run: show plan, no LLM call
orchestos task run    ./my-project --all        # run all in dependency order
orchestos task run    ./my-project --expand <plan-task-id>  # expand to sub-agents
orchestos task run    ./my-project --clarify t1 # ask for clarification before running
orchestos task status ./my-project              # id | status | retry | qa | cost
orchestos task diagnose <task-id>               # analyze failure patterns in last 3 runs
```

### Observability

```bash
orchestos runs                      # last 10 runs
orchestos runs --limit 50           # last 50
orchestos runs --detail <run-id>    # full evidence: provider, checks, criteria, cost breakdown, context warnings
orchestos runs --export             # dump all runs to runs-export.json
orchestos runs --analyze [--last N] # pattern analysis via Haiku — suggests improvements
orchestos dashboard [--port 4242]   # local web dashboard: runs, tasks, instincts, specs
```

### Specs (Spec-Driven flow)

```bash
orchestos spec create <task-id>     # scaffold .orchestos/specs/<id>.md
orchestos spec draft  <task-id>     # LLM generates spec draft with WHEN/THEN criteria
orchestos spec show   <task-id>
orchestos spec list [--all]         # --all includes archived specs
orchestos spec approve <task-id>    # gate: harness blocks task if requireSpec=true and not approved
orchestos spec lint   <task-id>     # check WHEN/THEN format + delta headers (exit 1 on findings)
orchestos spec archive <task-id>    # move to .orchestos/specs/archive/
```

### Skills

```bash
orchestos skill add       <id>                    # scaffold a new skill YAML
orchestos skill list                              # list compiled skills
orchestos skill build                             # compile to dist/skills/ (claude / cursor / openai)
orchestos skill build     --project <path>        # compile with language-aware sections
orchestos skill scaffold  --language <lang>       # scaffold with language-specific verifiers
orchestos skill languages                         # list all 36 supported languages
orchestos skill fetch     --language <lang>       # fetch curated skill from remote registry
orchestos skill fetch     --list                  # list available remote skills
```

### Instincts (learned behaviors)

```bash
orchestos instinct list                           # all instincts with confidence
orchestos instinct add    "<trigger>" "<action>"  # add manual instinct (confidence=1.0)
orchestos instinct review                         # list unverified auto-proposals
orchestos instinct approve <id>                   # set verified=true, confidence+=0.1
orchestos instinct reject  <id>                   # delete proposal
orchestos instinct set-confidence <id> <0-1>
```

### Memory

```bash
orchestos memory conflicts [--project <path>]     # show detected memory conflicts
```

### Project context

```bash
orchestos detect  ./my-project                    # scan stack → AGENTS.md + context.json (no DB)
orchestos init    ./my-project                    # same + save to SQLite + index code graph
orchestos init    ./my-project --pdf              # also generate a PDF summary
orchestos context show/update/list/compress       # manage context; compress → CONTEXT.md (~500 tokens)
orchestos context suggest "fix auth login"        # see which files the graph suggests
orchestos index   ./my-project                    # re-index code graph after large changes
orchestos constitution init/show  ./my-project    # scaffold / parse CONSTITUTION.md rules
orchestos config  init/show       ./my-project    # scaffold / inspect orchestos.config.yaml
```

---

## tasks.yaml format

```yaml
version: 1
project: my-project
tasks:
  - id: add-button
    description: "Create a reusable Button component with hover and disabled states"
    executor: anthropic            # openrouter (default) | anthropic | openai | codex
    skill: implement               # optional: injects skill guidelines into the prompt
    input:                         # files the LLM may read (omit to use graph suggestion)
      - src/styles/tokens.css
    output:                        # REQUIRED — the only files the LLM may write
      - src/components/Button.tsx
      - src/components/Button.module.css
    depends_on: []                 # task ids that must be done first
    checks:                        # deterministic shell checks — run BEFORE QA
      - cmd: "bun run typecheck"
      - cmd: "bun test src/components"
    acceptance_criteria:           # evaluated per-item by QA LLM
      - "WHEN Button receives disabled=true THEN cursor-not-allowed and opacity-50 are applied"
      - "WHEN onClick is triggered THEN it is not called while disabled=true"
    status: pending                # managed by orchestos
    retry_count: 0                 # managed by orchestos
```

---

## Reliability features

### 1. Deterministic checks — fail fast before spending QA tokens

```yaml
checks:
  - cmd: "bun run typecheck"
  - cmd: "bun test src/services"
  - cmd: "grep -r 'TODO' src/services/auth.ts"
    expect_exit: 1                 # grep exits 1 when nothing found = no TODOs
    timeout_ms: 30000
```

Checks run before the QA LLM. First failure reverts files and retries — no QA tokens spent.

### 2. WHEN/THEN acceptance criteria

Define criteria in event-driven form. The QA LLM evaluates them one by one.

```yaml
acceptance_criteria:
  - "WHEN user submits empty form THEN validation error is shown"
  - "WHEN token expires THEN user is redirected to /login"
```

Use `orchestos spec lint <task-id>` to check that all criteria use the WHEN/THEN format before approving.

### 3. Sandbox via git worktree

Every task runs in an isolated git worktree. On QA pass → merge (ff-only). On failure → discard. No partial writes escape to the main branch.

```bash
orchestos task run ./my-project --sandbox    # explicit (default for tasks.yaml runs)
orchestos task run ./my-project --keep-worktree  # debug: keep worktree on failure
```

### 4. Executor routing — choose which LLM runs each task

```yaml
- id: design-api-interface
  executor: anthropic              # Claude — architectural decisions
  output: [docs/api-auth.md]

- id: scaffold-endpoints
  executor: openrouter             # DeepSeek via OpenRouter — mechanical, cheaper
  depends_on: [design-api-interface]
  output: [src/routes/auth.ts]
```

### 5. Model routing — `orchestos.config.yaml`

```yaml
models:
  planner:
    provider: anthropic
    model: claude-opus-4-8
  executor_heavy:
    provider: openrouter
    model: deepseek/deepseek-v4-flash
  executor_light:
    provider: openrouter
    model: deepseek/deepseek-chat
  default:
    provider: openrouter
    model: deepseek/deepseek-v4-flash
```

`plan` → planner · `fix/refactor` → executor_heavy · `generate/edit/doc` → executor_light · no match → default.
Per-task `executor` always wins over config.

### 6. Auto-suggested context — code graph

After `orchestos init`, imports are indexed into SQLite. When `input[]` is omitted, orchestos scores every indexed file by keyword + semantic similarity (embeddings) and injects the top matches as context.

```bash
orchestos context suggest "fix auth login flow"   # preview suggestions
orchestos task run --explain <task-id>            # dry-run: show suggestions, 0 tokens
```

Graph covers 36 languages: TS/JS, Python, C#, Rust, Go, Java, Kotlin, Ruby, PHP, Swift, Elixir, and more.

### 7. Semantic embeddings in `suggestContext`

When OpenAI or Ollama credentials are present, `orchestos index` embeds each file. `suggestContext` re-ranks results using `embed_score×0.6 + keyword_score×0.4` — finds relevant files even when the task description shares no keywords with the file path.

`embed_hits` is tracked in every run so you can measure the value in production.

### 8. Constitution — constrain what the agent can do

```markdown
# CONSTITUTION.md
## ALLOWED
- Modify files under src/

## FORBIDDEN
- Modify .env files
- Delete files

## REQUIRE_CONFIRMATION
- Any change to src/db/schema.ts
```

Automatically injected into every task prompt. No config needed — just create the file.

### 9. Context compression

```bash
orchestos context compress ./my-project    # generates CONTEXT.md (~500 tokens vs ~2000 for AGENTS.md)
```

The harness uses `CONTEXT.md` automatically when present. Token savings are visible in `runs --detail`.

---

## Sub-agents

Sub-agents decompose a "plan" task into sequential sub-tasks, each with isolated context and its own worktree.

```bash
orchestos task run . --expand <plan-task-id>
```

**Flow**: parent task generates a `.plan.yaml` via LLM → Planner (`src/agents/planner.ts`) parses and validates (unique IDs, DAG cycle check, `allowed_tools` policy) → Scheduler executes in topological order → each sub-task in its own worktree → cascade QA: if one sub-task fails, dependents are marked `skipped`.

### Sub-agent contracts

| File | Role |
|------|------|
| `src/agents/planner.ts` | `createPlan()` — function calling + YAML fallback |
| `src/run/scheduler.ts` | `executePlan()` — sequential, topological, cascade QA |
| `src/db/memory.ts` | `upsertMemory()` / `getMemory()` — persistent memory by `topic_key` |
| `src/agents/sub-agent.ts` | `SubTask`, `SubagentResult`, states `pending→running→completed\|failed\|skipped` |
| `src/agents/sub-task-schema.ts` | YAML schema + `validateSubTaskPlan` + `topoSort` + cycle detection |
| `src/agents/context-isolation.ts` | `buildIsolatedContext` — slices CONTEXT.md + filters memories by deps |

### Memory conflict detection

When a sub-agent writes to `memory_entries`, BM25 (SQLite FTS5) finds candidate conflicts. A Haiku call classifies the relation (`conflict_with | supersedes | compatible | scoped | related | not_conflict`). Results are stored in `memory_conflicts` and visible via `orchestos memory conflicts`.

---

## Middleware chain

The enrichment phase before each LLM call runs 10 middlewares in canonical order:

```
spec-gate → sandbox-setup → classify-route → memory-fetch → skill-route →
tool-policy → constitution-load → context-source → instinct-apply → prompt-build
```

Each middleware mutates a shared `RunContext` and calls `next()`. The execution phase (LLM → contract → checks → QA → revert → insertRun) remains inline in the harness — it is a stateful error-flow, not independent enrichment steps.

---

## Instincts

Instincts are atomic learned behaviors injected into the system prompt before each run.

- `confidence < 0.6` → not applied without review
- `confidence >= 0.8` + `verified: true` → applied automatically

```bash
orchestos instinct add "WHEN task uses Stripe THEN import from src/billing/stripe.ts" "add context"
# source: manual, confidence: 1.0, verified: true — applied on the next matching run

orchestos instinct review    # list auto-proposed instincts (source: auto, verified: false)
orchestos instinct approve <id>   # bump confidence +0.1, set verified: true
```

**Continuous learning loop**: `runs --analyze` detects patterns across runs. If ≥ 3 runs share a pattern, `instinct propose` creates an auto-instinct at `confidence: 0.6`, `verified: false`. The human reviews and approves before it reaches the harness.

---

## Failure diagnosis

When a task reaches `failed_permanent` (3 QA failures), the diagnosis agent automatically runs:

```bash
orchestos task diagnose <task-id>   # also auto-triggers on task run --all
```

It reads the last 3 runs, calls Haiku to classify the failure pattern, and returns a structured suggestion:

| Pattern | Example suggestion |
|---------|-------------------|
| `deterministic_check` | "TypeScript errors in output files — check import paths" |
| `qa_specific_criterion` | "Criterion 3 fails consistently — narrow the output scope" |
| `parse_error` | "Model returned malformed JSON — add explicit output format instruction" |
| `scope_creep` | "> 20 files suggested — add explicit input[] to constrain context" |

---

## Dashboard

```bash
orchestos dashboard             # starts on http://localhost:4242
orchestos dashboard --port 3000
```

Four views served from SQLite:

| View | Shows |
|------|-------|
| `/runs` | Cost breakdown per sub-agent, context monitor warnings |
| `/tasks` | Status, retry count, QA verdict |
| `/instincts` | Approve / reject auto-proposals from the UI |
| `/specs` | Lint badge (structured / free-form criteria), archived specs |

Vanilla JS, no bundler, no external dependencies.

---

## Spec-Driven flow

Specs live in `.orchestos/specs/<task-id>.md`. When `requireSpec: true` is set in `orchestos.config.yaml`, the harness blocks execution until the spec is approved.

```bash
orchestos spec draft add-button      # LLM generates spec with WHEN/THEN criteria
orchestos spec lint  add-button      # check format + delta headers; exit 1 if findings
orchestos spec approve add-button    # marks spec approved — harness gate passes
orchestos task run . --id add-button # now runs
```

**Delta headers** for brownfield tasks: when a spec has `modified` or `removed` capabilities, `spec lint` checks for the required `## ADDED / ## MODIFIED / ## REMOVED` sections.

---

## tasks.yaml — full field reference

```yaml
- id: add-button                     # unique identifier (kebab-case)
  description: "..."                 # task brief sent to the LLM
  executor: openrouter               # openrouter | anthropic | openai | codex
  planner_model: claude-opus-4-8     # optional per-task model override
  executor_model: deepseek-v4-flash  # optional per-task model override
  skill: implement                   # optional: inject skill guidelines into prompt
  input:                             # files LLM may read (omit to use graph suggestion)
    - src/styles/tokens.css
  output:                            # REQUIRED: only files LLM may write
    - src/components/Button.tsx
  depends_on: [other-task-id]        # must be done before this one runs
  checks:                            # deterministic shell commands (run before QA)
    - cmd: "bun run typecheck"
      expect_exit: 0                 # default 0
      timeout_ms: 30000              # default 10000
  acceptance_criteria:               # evaluated per-item by QA LLM
    - "WHEN disabled=true THEN onClick is not called"
  status: pending                    # managed by orchestos, don't edit manually
  retry_count: 0                     # managed by orchestos
```

---

## Language-aware skills

Skills define language-specific verifiers and anti-patterns. Compiling with `--project` selects the right section automatically.

```bash
orchestos skill build --project ./my-project   # compiles with detected language
```

```yaml
language_targets:
  typescript:
    verifiers: ["bun test", "npx tsc --noEmit"]
  csharp:
    verifiers: ["dotnet test"]
  default:
    verifiers: ["run your test suite"]
```

Supported languages (36): TypeScript, JavaScript, Python, C#, Rust, Go, Java, Kotlin, Scala, Ruby, PHP, Swift, Elixir, Haskell, Lua, Perl, R, Dart, Svelte, OCaml, Julia, VB, F#, Shell, PowerShell, SQL, and more.

---

## Limitations

See [LIMITATIONS.md](LIMITATIONS.md) for a full list.

The short version: this is a sequential, local, single-model CLI. It is not autonomous. It does not replace git. It has no sandbox other than git worktrees. It costs real money per run. The `clarify` heuristic is keyword-based (v0), not semantic.
