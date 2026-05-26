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
- [x] **S1.10** Repo creado https://github.com/cagr1/orchestos — push `9886d9f` — 2026-05-26

---

## SEMANA 2 — Persistencia SQLite + memoria entre sesiones

Objetivo medible: `orchestos init` persiste, `orchestos context show` sobrevive cerrar terminal.

- [x] **S2.1** `src/db/sqlite.ts` — 2026-05-26
- [x] **S2.2** `src/db/migrate.ts` — 2026-05-26
- [x] **S2.3** `src/db/projects.ts` — 2026-05-26
- [x] **S2.4** Comandos `init`, `context show/update/list` — 2026-05-26
- [x] **S2.5** `src/context/load.ts` + `src/index.ts` — 2026-05-26
- [x] **S2.6 — Validación** — 2026-05-26
  - [x] `orchestos init` citasbot-whatsapp → SQLite en 91ms
  - [x] `orchestos context show` → AGENTS.md correcto desde DB
  - [ ] ⚠️ MANUAL — probar en sesión Claude real con AGENTS.md como system prompt
- [x] **S2.7** Commit `e536922` pusheado — 2026-05-26

---

## SEMANA 3 — Compilador de skills (YAML → 3 targets)

Objetivo medible: una skill YAML compila a Claude, Cursor y OpenAI sin errores.

- [x] **S3.1** `bun add yaml` + estructura completa — 2026-05-26
- [x] **S3.2** Validador YAML con mensajes claros — 2026-05-26
- [x] **S3.3** Compilador `claude` → SKILL.md — 2026-05-26
- [x] **S3.4** Compilador `cursor` → .mdc — 2026-05-26
- [x] **S3.5** Compilador `openai` → JSON tool — 2026-05-26
- [x] **S3.6** Comandos `skill add / list / build [--target] [--id]` — 2026-05-26
- [x] **S3.7 — Validación** — 2026-05-26
  - [x] 3 skills creadas: fix-typescript-errors, summarize-pr-diff, generate-prisma-migration
  - [x] 9 archivos compilados, 0 errores
  - [ ] ⚠️ MANUAL — copiar `dist/skills/claude/fix-typescript-errors.md` a `~/.claude/skills/` e invocar en sesión real
- [x] **S3.8** Commit `b725c99` pusheado — 2026-05-26

---

## SEMANA 4 — Router + `orchestos run` + primer usuario externo

Objetivo medible: `orchestos run "<prompt>"` clasifica, llama provider, loguea costo. **+ una persona externa lo usa.**

- [x] **S4.1** `src/router/classify.ts` — 2026-05-26
- [x] **S4.2** `src/router/models.ts` — 2026-05-26
- [x] **S4.3** `src/providers/anthropic.ts` — API key desde `~/.orchestos/.env` — 2026-05-26
- [x] **S4.4** `src/providers/openai.ts` — stub explícito — 2026-05-26
- [x] **S4.5** `src/router/pricing.ts` — tabla USD/1M tokens — 2026-05-26
- [x] **S4.6** Tabla `runs` con `files_attempted/authorized/blocked/status` — 2026-05-26
- [x] **S4.7** `run/contract.ts` — enforceContract BLOQUEA writes fuera de --output — 2026-05-26
- [x] **S4.8** Comando `orchestos run --task --output [--skill] [--file] [--project] [--dry-run]` — 2026-05-26
- [x] **S4.9 — Validación parcial** — 2026-05-26
  - [x] `--dry-run` construye prompt correcto: task_class=fix para "fix tsc errors", plan para "plan auth refactor"
  - [x] Carga contexto citasbot desde SQLite en system prompt
  - [x] Anthropic + OpenAI stub (2 providers declarados)
  - [ ] ⚠️ PENDIENTE — run real con API key: `echo "ANTHROPIC_API_KEY=sk-..." > ~/.orchestos/.env`
  - [ ] ⚠️ PENDIENTE — 1 persona externa instala y corre
  - [ ] ⚠️ PENDIENTE — feedback en `IDEAS.md ## Feedback usuario 1`
- [x] **S4.10** Commit `593292e` pusheado — 2026-05-26

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
