# orchestos — Limitations

Honest list of what orchestos does not do and has no plans to do soon.

---

## Execution model

- **Sequential only.** Tasks run one at a time. There is no parallelism. If you have 10 independent tasks, they run one after the other.
- **No real sandbox.** The LLM output is written to your actual filesystem. If the contract check passes, the files land immediately. There is no VM, container, or temp-directory isolation.
- **No rollback beyond the current run.** `snapshot_before` captures SHA1 hashes of output files before each run. If QA fails, orchestos restores those files from the in-memory content snapshot. If the process crashes mid-write, no automatic rollback happens. Use git.

## LLM behavior

- **Not deterministic.** Running the same task twice may produce different output. QA may pass one run and fail the next.
- **QA is also an LLM.** The QA call uses the same provider and is subject to the same hallucination risks. A bad QA verdict (false pass or false fail) is possible.
- **No context window management.** Large input files are sent in full. If the combined system prompt + input files + task description exceeds the model's context window, the call will fail or be truncated.

## Not a replacement for

- **git** — orchestos does not commit, branch, or stash. Version control your project yourself.
- **CI/CD** — there is no test runner integration, no lint gate, no type-check gate. QA only checks if the output looks reasonable to an LLM.
- **Code review** — QA does a shallow plausibility check, not a security audit or correctness proof.
- **An agent framework** — orchestos does not maintain memory between tasks beyond what's in SQLite and `tasks.yaml`. It does not browse the web, execute code, or call external APIs on its own.

## Cost

- Every `task run` makes at least 2 LLM calls (execute + QA). Each retry makes 2 more. A task with 3 retries costs 6 LLM calls.
- Costs are logged in SQLite and shown in `orchestos task status`, but there is no budget cap or pre-run cost estimate.

## Clarify mode

- **Heuristic only.** `--clarify` uses keyword matching ("optimize", "improve", "fix" without target files) to decide if a task is ambiguous. It does not use an LLM call or semantic understanding. Tasks with explicit `input[]` will not trigger clarify even if the description is vague.
- **Single question, no follow-up.** If clarify triggers, it asks one open-ended question and appends the answer to the task description. There is no multi-turn dialogue.

## Code Graph

- **Imports only.** `context suggest` knows which files import which other files. It does not know which function calls which function, which class extends which class, or what symbols are exported. For tasks like "rename function X", the graph cannot identify callers — Mes 4+ with tree-sitter symbol indexing.
- **Regex-based extraction.** Import extraction uses regular expressions, not an AST parser. Unusual syntax (dynamic imports with template literals, barrel re-exports via `export * from`), may be missed.
- **No watch mode.** The index is a snapshot. Run `orchestos index` manually after significant code changes. The index auto-runs on `orchestos init` but not on file saves.

## Scale

- Tested on projects under ~50 files. Large monorepos with hundreds of input files have not been tested.
- The SQLite DB grows unbounded. No pruning, archiving, or TTL on run records.

## Multi-user

- orchestos is single-user, local-only. The DB lives at `~/.orchestos/db.sqlite`. There is no remote sync, no team sharing, no access control.
