# orchestos — contract-first coding runner

A CLI that runs LLM-powered coding tasks inside a declared file contract.
Each task specifies exactly which files it can write. Anything outside that list is blocked.
Every run produces evidence in SQLite. A second LLM call (QA) validates the output before marking it done.

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

Set your API key (uses OpenRouter — one key for Claude, GPT-4o, Gemini, DeepSeek, etc.):

```bash
mkdir -p ~/.orchestos
echo "OPENROUTER_API_KEY=sk-or-..." > ~/.orchestos/.env
```

---

## Quickstart (5 commands)

```bash
# 1. Detect stack and save to DB
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
tasks.yaml  →  LLM call  →  contract check  →  QA call  →  done / pending / failed_permanent
                              (blocks writes           (second LLM validates
                               outside output[])        the generated output)
```

1. **`tasks.yaml`** declares every task: what to do, which files may be written (`output[]`), and which tasks must complete first (`depends_on[]`).
2. **LLM call** generates the files. The model is routed automatically (DeepSeek by default via OpenRouter).
3. **Contract check** blocks any write outside the declared `output[]`. Violations are logged to SQLite and the task fails — nothing partial is written.
4. **QA call** is a second LLM call that reads the generated files and returns `{verdict: "pass"|"fail", reason}`. If it fails, files are reverted to their pre-run state and the task goes back to `pending`.
5. After 3 QA failures the task becomes `failed_permanent` and is skipped by the scheduler.
6. **Evidence** — every run writes to SQLite: tokens, cost, `snapshot_before/after` (SHA1 hashes), files attempted/authorized/blocked, QA verdict and reason.
7. **Run log** — each `task run` session appends events to `runs/YYYY-MM-DD-HH-mm.log` in the project root.

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
orchestos task status ./my-project              # id | status | retry | qa | cost
```

### Observability

```bash
orchestos runs                   # last 10 runs
orchestos runs --limit 50        # last 50
orchestos runs --detail <run-id> # full evidence: provider, checks, criteria, cost
orchestos runs --export          # dump all runs to runs-export.json
```

### Skills

```bash
orchestos skill add    <id>                    # scaffold a new skill YAML
orchestos skill list                           # list compiled skills
orchestos skill build                          # compile to dist/skills/ (claude / cursor / openai)
orchestos skill build --project <path>         # compile with language-aware sections
```

---

## tasks.yaml format

```yaml
version: 1
project: my-project
tasks:
  - id: add-button
    description: "Create a reusable Button component with hover and disabled states"
    skill: implement          # optional: injects skill guidelines into the prompt
    input:                    # files the LLM may read (not write)
      - src/styles/tokens.css
    output:                   # REQUIRED — the only files the LLM may write
      - src/components/Button.tsx
      - src/components/Button.module.css
    depends_on: []            # task ids that must be done first
    status: pending
    retry_count: 0
```

---

## Reliability features

Three independent systems that reduce wasted LLM calls and make failures auditable:

### 1. Deterministic checks — fail fast before spending QA tokens

Run shell commands after the LLM writes files. If the command exits with the wrong code, orchestos reverts the files and retries without calling the QA LLM. TypeScript errors caught here cost zero QA tokens.

```yaml
- id: add-auth-service
  description: "Add JWT authentication service"
  output:
    - src/services/auth.ts
  checks:
    - cmd: "bun run typecheck"        # must exit 0
    - cmd: "bun test src/services"    # must exit 0
    - cmd: "grep -r 'TODO' src/services/auth.ts"
      expect_exit: 1                  # grep returns 1 when nothing found = no TODOs left
```

Checks run in dependency order. First failure stops the chain — no tokens spent on downstream checks or QA.

### 2. Acceptance criteria — tell the LLM exactly what pass means

Instead of asking "does this look reasonable?", define each criterion explicitly. The QA LLM evaluates them one by one. A single failing criterion fails the whole task.

```yaml
- id: add-button
  description: "Create a Button component"
  output:
    - src/components/Button.tsx
  acceptance_criteria:
    - "File exports a React component named Button"
    - "Component accepts props: label (string), onClick (function), disabled (boolean)"
    - "No TypeScript errors — no 'any' types"
    - "Disabled state applies cursor-not-allowed and reduced opacity"
```

### 3. Executor routing — choose which LLM runs each task

Each task can declare which provider executes it. Route expensive tasks to a strong model, mechanical tasks to a cheaper one.

```yaml
- id: design-api-interface
  description: "Design the REST API contract for the auth module"
  executor: anthropic          # Claude — architectural decisions need strong reasoning
  output: [docs/api-auth.md]

- id: scaffold-endpoints
  description: "Generate Express route stubs from docs/api-auth.md"
  executor: openrouter         # DeepSeek via OpenRouter — mechanical, cheaper
  output: [src/routes/auth.ts]
  depends_on: [design-api-interface]
```

Valid values: `openrouter` (default), `anthropic`, `openai`, `codex`.

### 4. Auto-suggested context — graph finds relevant files automatically

After `orchestos init`, the project's imports are indexed into a local code graph. When a task declares no `input[]`, orchestos tokenizes the task description and scores every indexed file — files with matching names rank higher, files that import them follow as neighbors.

```yaml
- id: fix-login-bug
  description: "Fix the null pointer in auth login flow"
  output: [src/services/auth.ts]
  # input[] omitted — orchestos suggests: src/services/auth.ts, src/middleware/jwt.ts, ...
```

To see what would be suggested before running:

```bash
orchestos task run --explain fix-login-bug
# prints: executor, model, suggested files, checks, acceptance criteria
# no LLM call, no cost
```

To index manually after large code changes:

```bash
orchestos index ./my-project
```

### Putting it all together

```yaml
- id: add-payment-service
  description: "Add Stripe payment service with webhook validation"
  executor: anthropic
  output:
    - src/services/payment.ts
    - src/routes/webhook.ts
  # input[] omitted — graph suggests stripe-related files automatically
  checks:
    - cmd: "bun run typecheck"
    - cmd: "bun test src/services/payment"
  acceptance_criteria:
    - "PaymentService class exported with methods: createCharge, refund"
    - "Webhook handler validates Stripe signature before processing"
    - "No hardcoded API keys — uses process.env.STRIPE_SECRET_KEY"
    - "All async functions have try/catch with typed error handling"
```

Flow for this task:
1. Graph suggests `src/services/payment.ts`, `src/config/env.ts`, `src/routes/index.ts` as context
2. Anthropic Claude generates the files
3. `bun run typecheck` runs — if it fails, files revert immediately, no QA cost
4. `bun test` runs — same
5. QA LLM checks all 4 criteria, one by one
6. Full evidence (tokens, cost, check results, criteria verdicts) visible in `orchestos runs --detail <id>`

### 5. Model routing — assign the right model to each task

Create an `orchestos.config.yaml` to define model roles. Tasks are automatically routed based on their description:

```yaml
# orchestos.config.yaml
models:
  planner:                # architectural/planning tasks
    provider: anthropic
    model: claude-opus-4-7
  executor_heavy:         # fixes, refactors
    provider: openrouter
    model: deepseek/deepseek-v4-flash
  executor_light:         # generation, edits, docs
    provider: openrouter
    model: deepseek/deepseek-chat
  default:                # fallback
    provider: openrouter
    model: deepseek/deepseek-v4-flash
```

Routing logic: `plan` → planner, `fix/refactor` → executor_heavy, `generate/edit/doc` → executor_light, no match → default.

Override per-task by setting `executor` or `executor_model` directly in `tasks.yaml` — explicit always wins.

```bash
orchestos config init              # scaffold orchestos.config.yaml
orchestos config show              # active config + model per pending task
```

### 6. Constitution — constrain what the agent can do

Create `CONSTITUTION.md` in your project root to declare rules the agent must follow. It is automatically injected into every task prompt.

```markdown
## ALLOWED
- Modify files under src/

## FORBIDDEN
- Modify .env files
- Delete files

## REQUIRE_CONFIRMATION
- Any change to src/db/schema.ts
```

```bash
orchestos constitution init        # scaffold CONSTITUTION.md
orchestos constitution show        # see parsed rules
orchestos task run --clarify <id>  # ask for confirmation before executing
```

### 7. Language-aware skills

Skills can define language-specific verifiers and anti-patterns. When compiling with `--project`, the correct section is selected automatically.

```bash
orchestos skill build --project ./my-project   # compiles with project language
orchestos skill build                          # compiles default (no language targeting)
```

Example skill section for TypeScript vs C#:

```yaml
language_targets:
  typescript:
    verifiers: ["bun test", "npx tsc --noEmit"]
  csharp:
    verifiers: ["dotnet test"]
  default:
    verifiers: ["run your test suite"]
```

### 8. Context compression — save tokens with CONTEXT.md

Instead of sending the full AGENTS.md (~2000 tokens) on every run, generate a compressed CONTEXT.md (~500 tokens) that includes project facts, the most-connected files from the code graph, and recent run summaries.

```bash
orchestos context compress ./my-project    # generate CONTEXT.md
# Harness automatically uses it if present — no config needed
```

Check the savings in `orchestos runs --detail <id>`:
```
context: CONTEXT.md (487 tokens)
```
vs without CONTEXT.md:
```
context: AGENTS.md (1843 tokens)
```

---

## Commands

### Project context

```bash
orchestos detect ./my-project       # scan stack → AGENTS.md + context.json (no DB)
orchestos init   ./my-project       # same + save to SQLite + index code graph
orchestos init   ./my-project --pdf # also generate a PDF summary
orchestos context show   ./my-project
orchestos context update ./my-project
orchestos context list
orchestos context suggest "fix auth login"   # see which files the graph suggests
orchestos context compress ./my-project      # generate CONTEXT.md (~500 tokens)
orchestos index  ./my-project               # re-index after large code changes
orchestos constitution init   ./my-project  # scaffold CONSTITUTION.md with ALLOWED/FORBIDDEN rules
orchestos constitution show   ./my-project  # show parsed constitution rules
orchestos config init         ./my-project  # scaffold orchestos.config.yaml for model routing
orchestos config show         ./my-project  # show active config + model per pending task
```

---

## tasks.yaml — full field reference

```yaml
- id: add-button                     # unique identifier (kebab-case)
  description: "..."                 # task brief sent to the LLM
  executor: openrouter               # openrouter | anthropic | openai | codex
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
    - "Exports a component named Button"
  status: pending                    # managed by orchestos, don't edit manually
  retry_count: 0                     # managed by orchestos
```

---

## Sub-agents (Mes 5)

Sub-agents descomponen una tarea "plan" en sub-tareas secuenciales, cada una con contexto aislado y worktree propio.

```bash
orchestos task run . --expand <plan-task-id>
```

**Flujo**: tarea padre genera un `.plan.yaml` vía LLM → Planner (`src/agents/planner.ts`) parsea y valida (IDs únicos, DAG sin ciclos, `allowed_tools` válidos) → Scheduler (`src/run/scheduler.ts`) ejecuta en orden topológico → cada sub-task en su worktree → QA en cascada: si una falla, dependientes se marcan `skipped`.

### Contratos

| Archivo | Rol |
|---------|-----|
| `src/agents/planner.ts` | `createPlan()` parsea YAML → `SubTask[]` validados |
| `src/run/scheduler.ts` | `executePlan()` — secuencial, DAG, cascade QA |
| `src/db/memory.ts` | `upsertMemory()` / `getMemory()` para memoria persistente por `topic_key` |
| `src/agents/sub-agent.ts` | Tipos `SubTask`, `SubagentResult`, estados `pending→running→completed\|failed\|skipped` |
| `src/agents/sub-task-schema.ts` | Schema YAML + `validateSubTaskPlan` + `topoSort` + detección de ciclos |

### Reglas

- **Tool policy**: `allowed_tools` se valida en planner/scheduler, no es sugerencia al modelo
- **Memoria**: sub-tasks con `topic_key` persisten en `memory_entries`; re-ejecución hace MERGE no OVERWRITE
- **Paralelismo**: prohibido — scheduler estrictamente secuencial
- **Worktrees**: cada sub-task en su propio worktree; éxito → merge, fallo → discard

Ver `docs/AGENTS.md` para el flujo completo con ejemplo real.

## Limitations

See [LIMITATIONS.md](LIMITATIONS.md) for a full list.

The short version: this is a sequential, local, single-model CLI. It is not autonomous. It does not replace git. It has no sandbox. It costs real money per run.
