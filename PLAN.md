---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: not-started
---

# OrchestOS — Plan de ejecución Mes 1

Versión corta y honesta del pivot desde `ai-orchestrator-base` (JS, congelado).
Stack obligatorio: **Bun + TypeScript + SQLite (`bun:sqlite`)**.
Cualquier agente que retome esto: leer este archivo, abrir la próxima `[ ]`, cerrarla, marcar `[x]` con fecha, commit, siguiente.

## Reglas maestras (no negociables)

- No saltar semanas. Si validación de la semana N falla, no abrir N+1.
- No agregar tests automatizados antes de S4. Validación = manual contra repos reales.
- No tocar `ai-orchestrator-base/` — congelado.
- Commits atómicos por sub-paso (S1.3, S1.6…).
- Repo GitHub `cagr1/orchestos` recién al final de S1, no antes.
- Si aparece impulso de agregar: paralelismo, worktrees, dashboard, graph DB, marketplace, multi-provider extra, Restate/Temporal, Rust → línea en `IDEAS.md`, seguir.
- Bun ≥ 1.1 obligatorio. Si no está: `irm bun.sh/install.ps1 | iex` y validar `bun --version`.

---

## SEMANA 1 — `orchestos detect` → AGENTS.md

Objetivo medible: `orchestos detect <path>` genera `AGENTS.md` + `context.json` en < 3 s.

- [x] **S1.1** Bootstrap (`bun init -y`, `bun add commander glob`, `bun add -d @types/bun typescript`, crear `IDEAS.md` vacío). — 2026-05-26
- [x] **S1.2** Crear stubs vacíos: `src/cli.ts`, `src/detect/{manifest,languages,conventions}.ts`, `src/generators/{agents-md,context-json}.ts`. Configurar `package.json` con `"type":"module"` y `"bin":{"orchestos":"src/cli.ts"}`. — 2026-05-26
- [x] **S1.3** Implementar `src/detect/manifest.ts` — 2026-05-26
- [x] **S1.4** Implementar `src/detect/languages.ts` — 2026-05-26
- [x] **S1.5** Implementar `src/detect/conventions.ts` — 2026-05-26
- [x] **S1.6** Implementar `src/generators/agents-md.ts` — 2026-05-26
- [x] **S1.7** Implementar `src/generators/context-json.ts` — 2026-05-26
- [x] **S1.8** Implementar `src/cli.ts` con commander — 2026-05-26
- [x] **S1.9 — Validación** — 2026-05-26
  - [x] Detecta `Next.js + Prisma` en citasbot-whatsapp — 182ms
  - [x] Cisepro no en disco — salteado
  - [x] AGENTS.md tiene nombre, stack, comandos y nota Prisma
  - [x] Tiempo < 3000ms — 182ms
- [ ] **S1.10** Crear repo `cagr1/orchestos` en GitHub y `git push -u`. Commit final semana 1: `feat(detect): cli + stack profile + AGENTS.md generator`.

---

## SEMANA 2 — Persistencia SQLite + memoria entre sesiones

Objetivo medible: `orchestos init` persiste, `orchestos context show` sobrevive cerrar terminal.

- [ ] **S2.1** `src/db/sqlite.ts` → abre `~/.orchestos/db.sqlite` (mkdir si falta) con `bun:sqlite`. Singleton.
- [ ] **S2.2** `src/db/migrate.ts` — `CREATE TABLE IF NOT EXISTS` para `projects` y `context_chunks` (schema en chat). Ejecutar al boot.
- [ ] **S2.3** `src/db/projects.ts` → `upsertProject`, `getProject`, `listProjects`. `id = hash(path)`.
- [ ] **S2.4** Añadir comandos al CLI:
  - [ ] `orchestos init [path]` — detect + upsert.
  - [ ] `orchestos context show [path]` — imprime AGENTS.md guardado.
  - [ ] `orchestos context update [path]` — re-detecta y reemplaza.
- [ ] **S2.5** `src/context/load.ts` → `loadContext(projectPath: string): string`. Exportar desde `src/index.ts`.
- [ ] **S2.6 — Validación**:
  - [ ] `orchestos init` en citasbot-whatsapp → fila en SQLite.
  - [ ] Cerrar terminal, abrir nueva, `orchestos context show` → mismo AGENTS.md.
  - [ ] Copiar AGENTS.md como system prompt en sesión Claude → no pregunta stack.
- [ ] **S2.7** Commit `feat(persistence): sqlite store + init/context commands`.

---

## SEMANA 3 — Compilador de skills (YAML → 3 targets)

Objetivo medible: una skill YAML compila a Claude, Cursor y OpenAI sin errores.

- [ ] **S3.1** `bun add yaml`. Crear estructura `src/skills/{registry,compile}.ts`, `src/skills/targets/{claude,cursor,openai}.ts`, carpeta `skills/`.
- [ ] **S3.2** Validador manual de schema YAML: `id` (kebab), `version` (semver), `name`, `description` (≤200), `instructions` (≤4000), `targets[]` ⊂ `{claude,cursor,openai}`. Throw con mensaje claro si falta.
- [ ] **S3.3** Compilador `claude` → `SKILL.md` con frontmatter `name`, `description` + cuerpo `instructions`.
- [ ] **S3.4** Compilador `cursor` → `.mdc` con frontmatter `description`, `globs:["**/*"]`, `alwaysApply:false`.
- [ ] **S3.5** Compilador `openai` → JSON tool `{type:"function", function:{name:id, description, parameters:{type:"object", properties:{}}}}`.
- [ ] **S3.6** Comandos CLI:
  - [ ] `orchestos skill add <id>` — scaffold `skills/<id>.yaml`.
  - [ ] `orchestos skill list`.
  - [ ] `orchestos skill build [--target <t>]` → output a `dist/skills/<target>/`.
- [ ] **S3.7 — Validación**:
  - [ ] 3 skills propias creadas (sugeridas: `fix-typescript-errors`, `summarize-pr-diff`, `generate-prisma-migration`).
  - [ ] Cada una compila a los 3 targets sin warning.
  - [ ] Una skill `claude` se copia a `~/.claude/skills/` y se invoca en sesión real.
- [ ] **S3.8** Commit `feat(skills): yaml schema + compiler for 3 targets`.

---

## SEMANA 4 — Router + `orchestos run` + primer usuario externo

Objetivo medible: `orchestos run "<prompt>"` clasifica, llama provider, loguea costo. **+ una persona externa lo usa.**

- [ ] **S4.1** `src/router/classify.ts` — regex sobre prompt lowercased: `plan|implement|fix|review|doc`.
- [ ] **S4.2** `src/router/models.ts` — mapping:
  - `plan → claude-opus-4-7`
  - `implement → claude-sonnet-4-6`
  - `fix → claude-haiku-4-5`
  - `review → claude-sonnet-4-6`
  - `doc → claude-haiku-4-5`
- [ ] **S4.3** `src/providers/anthropic.ts` con firma `chat({model, system, messages}) → {text, usage}`. API key desde `~/.orchestos/.env`.
- [ ] **S4.4** `src/providers/openai.ts` — mismo contrato. (Stub explícito si no hay key, no bloquea.)
- [ ] **S4.5** `src/router/pricing.ts` — tabla estática USD/1M tokens por modelo.
- [ ] **S4.6** Migración append: tabla `runs` (schema en chat).
- [ ] **S4.7** Comando `orchestos run "<prompt>" [--file <path>...] [--project <path>]`:
  1. `loadContext(project)` como system.
  2. `--file` → append contenido bajo `### Files:`.
  3. `classifyTask` → modelo.
  4. Provider call con `elapsed_ms`, `usd_cost`.
  5. Insert en `runs`.
  6. Footer `[run] {model} · {tin}/{tout} · ${cost} · {ms}ms`.
- [ ] **S4.8 — Validación**:
  - [ ] `orchestos run "fix tsc errors" --file foo.ts` → modelo fix, loguea.
  - [ ] `orchestos run "plan auth refactor"` → modelo plan.
  - [ ] Al menos 2 providers responden (o 1 + stub explícito).
  - [ ] **1 persona externa** lo instaló y corrió en su repo.
  - [ ] Feedback escrito guardado en `IDEAS.md` bajo `## Feedback usuario 1 — {fecha}`.
- [ ] **S4.9** Commit `feat(router): classify + run + sqlite runs log`.

---

## Métrica única de éxito (cierre de mes)

¿Hay 1 persona externa que lo usa y lo extrañaría si desaparece?

- [ ] **SÍ** → OrchestOS tiene tracción real, abrir plan Mes 2.
- [ ] **NO** → Semana 5 = conseguir esa persona. No agregar features.

---

## Registro de progreso

Formato: marcar `[x]` con fecha `YYYY-MM-DD` cuando se cierra. Si una validación falla, dejar `[ ]` y anotar bajo "Bloqueos".

### Bloqueos / desvíos
_(vacío)_

### Decisiones tomadas durante ejecución
_(vacío — registrar aquí cualquier cambio de scope que no implique agregar features prohibidas)_
