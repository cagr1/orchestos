# orchestos — Limitations

Honest list of what orchestos does not do and has no plans to do soon.

---

## Execution model

- **Sequential only.** Tasks run one at a time. There is no parallelism. If you have 10 independent tasks, they run one after the other.
- **Git worktree is the only sandbox.** In a git repo on a branch, each run writes inside a worktree and is merged back only after checks and QA pass. Outside a git repo, on a detached HEAD, or with `--sandbox=cwd`, it falls back to writing directly in the project (with a warning). There is no VM or container isolation, and CLI agents run with your user's permissions.
- **No rollback beyond the current run.** `snapshot_before` captures SHA1 hashes of output files before each run. If QA fails, orchestos restores those files from the in-memory content snapshot. If the process crashes mid-write, no automatic rollback happens. Use git.

## LLM behavior

- **Not deterministic.** Running the same task twice may produce different output. QA may pass one run and fail the next.
- **QA is also an LLM.** The QA call uses the same provider and is subject to the same hallucination risks. A bad QA verdict (false pass or false fail) is possible.
- **Context management is an estimate.** Before calling the model, a pre-flight compares the estimated prompt size with the model's context window and leaves the task `pending` if it does not fit; oversized outputs propose an auto-split plan. Token counts are estimated, not exact, so a borderline task can still be truncated.

## Not a replacement for

- **git** — orchestos makes its own commits (task state in `tasks.yaml`, the worktree merge, and the files you pick in "Commit & Run"), but it does not manage branches, pushes or history for you.
- **CI/CD** — deterministic `checks[]` (e.g. `tsc --noEmit`, tests) run before QA, but only the commands the task or project declares. It does not replace your CI pipeline.
- **Code review** — the reviewer role checks the task's acceptance criteria. It is not a security audit or a correctness proof.
- **An agent framework** — memory between tasks is what lives in SQLite (Memory entries per finished task, instincts, specs) and `tasks.yaml`. The executor is whatever CLI you configure, and it can run commands inside the worktree; orchestos itself does not browse the web.

## Cost

- Every `task run` makes at least 2 LLM calls (execute + QA). Each retry makes 2 more. A task with 3 retries costs 6 LLM calls.
- With CLI agents (`claude`, `codex`, `opencode`) the calls use your plan's quota; only `agent: api` roles cost money per call.
- Costs and token counts are logged in SQLite and shown in `orchestos task status` and the dashboard, but there is no budget cap or pre-run cost estimate.

## Clarify mode

- **Heuristic only.** `--clarify` uses keyword matching ("optimize", "improve", "fix" without target files) to decide if a task is ambiguous. It does not use an LLM call or semantic understanding. Tasks with explicit `input[]` will not trigger clarify even if the description is vague.
- **Single question, no follow-up.** If clarify triggers, it asks one open-ended question and appends the answer to the task description. There is no multi-turn dialogue.

## Code Graph

- **Imports only.** `context suggest` knows which files import which other files (TS/JS and Python built in; resolvers for Go, Rust, Java, C# and Ruby). It does not know which function calls which function, which class extends which class, or what symbols are exported. For tasks like "rename function X", the graph cannot identify callers.
- **Regex-based extraction.** Import extraction uses regular expressions, not an AST parser. Unusual syntax (dynamic imports with template literals, barrel re-exports via `export * from`), may be missed.
- **No watch mode.** The index is a snapshot. Run `orchestos index` manually after significant code changes. The index auto-runs on `orchestos init` but not on file saves.

## Scale

- Tested on projects under ~50 files. Large monorepos with hundreds of input files have not been tested.
- The SQLite DB grows unbounded. Run records are never pruned automatically (a retention helper for run steps exists but nothing calls it yet).

## Multi-user

- orchestos is single-user, local-only. The DB lives at `~/.orchestos/db.sqlite`. There is no remote sync, no team sharing, no access control.
