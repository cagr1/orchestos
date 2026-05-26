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

## Commands

### Project context

```bash
orchestos detect ./my-project       # scan stack → AGENTS.md + context.json (no DB)
orchestos init   ./my-project       # same + save to SQLite
orchestos init   ./my-project --pdf # also generate a PDF summary
orchestos context show  ./my-project
orchestos context update ./my-project
orchestos context list
```

### Task workflow

```bash
orchestos task init   ./my-project         # scaffold tasks.yaml
orchestos task list   ./my-project         # show status table
orchestos task run    ./my-project         # run next pending task
orchestos task run    ./my-project --id t1 # run specific task
orchestos task run    ./my-project --all   # run all in dependency order
orchestos task status ./my-project         # id | status | retry | qa | cost
```

### Observability

```bash
orchestos runs                   # last 10 runs
orchestos runs --limit 50        # last 50
orchestos runs --detail <run-id> # full evidence: tokens, cost, snapshots, QA
orchestos runs --export          # dump all runs to runs-export.json
```

### Skills

```bash
orchestos skill add    <id>      # scaffold a new skill YAML
orchestos skill list             # list compiled skills
orchestos skill build            # compile to dist/skills/ (claude / cursor / openai)
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

## Limitations

See [LIMITATIONS.md](LIMITATIONS.md) for a full list.

The short version: this is a sequential, local, single-model CLI. It is not autonomous. It does not replace git. It has no sandbox. It costs real money per run.
