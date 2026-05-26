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

## MES 2 — Contract-first workflow con evidencia

Objetivo del mes: `orchestos task run` ejecuta un workflow declarativo en `tasks.yaml`, cada tarea genera evidencia real en SQLite, y un QA stage valida el output antes de marcarlo `done`. Nadie lo hace así de simple y auditable.

Fuente: crítica brutal (wedge = "cambios acotados, auditables, revisables") + ideas buenas de `ai-orchestrator-base`.

**Lo que NO se construye este mes (explícito):**
- Git worktrees / aislamiento por tarea — Mes 3+
- Paralelismo real — Mes 3+
- Dashboard web — después del CLI
- Marketplace de skills — después de 10 skills en uso real
- Engram / memoria semántica — Mes 3+

---

### SEMANA 5 — `tasks.yaml` como fuente de verdad

Objetivo medible: `orchestos task init` genera `tasks.yaml` en el proyecto + `orchestos task run` ejecuta la primera tarea y guarda evidencia.

- [ ] **S5.1** Schema `tasks.yaml` — cada tarea tiene: `id`, `description`, `skill`, `input[]`, `output[]` (contrato de archivos), `depends_on[]`, `status` (`pending|running|done|failed`).
- [ ] **S5.2** `src/tasks/schema.ts` — tipo `Task` + `TasksFile`. Validador que falla con mensaje claro si falta `output[]`.
- [ ] **S5.3** `src/tasks/loader.ts` — `loadTasks(root)` / `saveTasks(root, tasks)`. Lee/escribe `tasks.yaml` en la raíz del proyecto. Lock optimista con hash (igual que ai-orchestrator-base, pero simple).
- [ ] **S5.4** Comando `orchestos task init <path>` — genera `tasks.yaml` de ejemplo con 2 tareas pre-pobladas según el stack detectado (ej: Next.js → tarea de componente + tarea de test).
- [ ] **S5.5** Comando `orchestos task list <path>` — imprime tabla: `id | status | skill | output[]`.
- [ ] **S5.6** Comando `orchestos task run <path>` — selecciona la próxima tarea `pending` sin dependencias bloqueadas, ejecuta via `enforceContract`, guarda evidencia en SQLite, actualiza `status` en `tasks.yaml`.
- [ ] **S5.7** Evidencia extendida en SQLite — agregar `task_id`, `snapshot_before` (hashes), `snapshot_after` (hashes) a la tabla `runs`.
- [ ] **S5.8 — Validación**:
  - [ ] `orchestos task init` genera `tasks.yaml` válido.
  - [ ] `orchestos task run` ejecuta T1, escribe solo los archivos declarados en `output[]`, falla si intenta escribir fuera.
  - [ ] `tasks.yaml` muestra `status: done` en T1 después del run.
  - [ ] SQLite tiene `snapshot_before` y `snapshot_after` distintos.
- [ ] **S5.9** Commit `feat(tasks): tasks.yaml workflow + evidence snapshots`.

---

### SEMANA 6 — QA stage (segundo LLM call antes de `done`)

Objetivo medible: después de cada run, un QA call valida el output. Si falla → tarea vuelve a `pending` con `retry_reason`.

- [ ] **S6.1** `src/run/qa.ts` — `runQA(task, filesWritten, model)`: llama al LLM con el output generado + descripción de la tarea. Espera respuesta `{ verdict: "pass" | "fail", reason: string }`.
- [ ] **S6.2** Prompt de QA — inyecta: descripción original de la tarea + contenido de los archivos escritos + pregunta: "¿El output cumple exactamente lo pedido? Responde JSON `{verdict, reason}`".
- [ ] **S6.3** Integrar QA en `task run` — flujo: ejecutar → escribir archivos → QA call → si `pass` → `done`; si `fail` → revertir archivos (restaurar snapshot_before) → `pending` con `retry_reason` + contador `retry_count`.
- [ ] **S6.4** Límite de reintentos — si `retry_count >= 3` → `status: failed_permanent`. No vuelve a ejecutarse.
- [ ] **S6.5** Comando `orchestos task status <path>` — muestra tabla con `id | status | retry_count | qa_verdict | cost_usd`.
- [ ] **S6.6 — Validación**:
  - [ ] QA falla intencionalmente: tarea con output vacío → status vuelve a `pending`.
  - [ ] QA pasa: tarea normal → `done` con `qa_verdict: pass` en SQLite.
  - [ ] Tarea con 3 fallos QA → `failed_permanent`, no se reintenta.
- [ ] **S6.7** Commit `feat(qa): QA stage — second LLM call validates output before done`.

---

### SEMANA 7 — Workflow multi-tarea con dependencias

Objetivo medible: `orchestos task run --all` ejecuta todas las tareas en orden topológico, respetando dependencias.

- [ ] **S7.1** `src/tasks/scheduler.ts` — `getNextBatch(tasks)`: devuelve tareas `pending` cuyas dependencias están todas en `done`. Si hay ciclo → error claro.
- [ ] **S7.2** `orchestos task run --all` — loop: `getNextBatch` → ejecutar una tarea → actualizar `tasks.yaml` → repetir hasta que no haya más `pending` o haya un `failed`.
- [ ] **S7.3** Halt en fallo — si una tarea falla (o `failed_permanent`), las que dependen de ella pasan a `blocked`. El loop se detiene con mensaje claro.
- [ ] **S7.4** `orchestos task run --id <task-id>` — ejecutar una tarea específica por ID (ignora scheduler).
- [ ] **S7.5** Log de ejecución — `runs/YYYY-MM-DD-HH-mm.log` en la raíz del proyecto con eventos: `[START]`, `[QA:pass]`, `[QA:fail]`, `[DONE]`, `[BLOCKED]`.
- [ ] **S7.6 — Validación**:
  - [ ] `tasks.yaml` con T1 → T2 (T2 depends_on T1): ejecutar `--all` → T1 done → T2 done en orden.
  - [ ] Si T1 falla → T2 queda `blocked`, loop se detiene.
  - [ ] Log en disco refleja el orden real de ejecución.
- [ ] **S7.7** Commit `feat(scheduler): multi-task workflow with dependency resolution`.

---

### SEMANA 8 — Observabilidad + README honesto

Objetivo medible: alguien externo puede clonar el repo, leer el README y correr `orchestos task run` en su proyecto en < 10 minutos.

- [ ] **S8.1** Comando `orchestos runs --detail <run-id>` — muestra evidencia completa: snapshot_before/after, files_attempted/authorized/blocked, QA verdict, costo.
- [ ] **S8.2** Comando `orchestos runs --export` — exporta historial de runs a `runs-export.json` (para auditoría manual).
- [ ] **S8.3** `src/generators/summary-pdf.ts` — extender para incluir sección de runs recientes y costo total.
- [ ] **S8.4** Reescribir `README.md` — sin claims falsos. Título: **"orchestos — contract-first coding runner"**. Secciones: install, quickstart (5 comandos), cómo funciona, limitaciones honestas.
- [ ] **S8.5** `LIMITATIONS.md` — qué no hace: no es paralelo, no tiene sandbox, no reemplaza git, no es autónomo.
- [ ] **S8.6 — Validación**:
  - [ ] Clonar en directorio limpio → seguir README → `orchestos task run` funciona en < 10 min.
  - [ ] `orchestos runs --detail` muestra evidencia real de un run anterior.
  - [ ] README no contiene palabras: "deterministic parallel", "anti-hallucination", "LLM-fatigue protection".
- [ ] **S8.7** Commit `docs: honest README + LIMITATIONS + observability commands`.

---

## Métrica única de éxito Mes 2

¿Un run de `orchestos task run --all` en un proyecto real termina con todas las tareas en `done`, evidencia en SQLite, y ningún archivo modificado fuera del contrato declarado?

- [ ] **SÍ** → el wedge de la crítica está implementado. Abrir plan Mes 3 (worktrees, paralelismo).
- [ ] **NO** → identificar qué falla y arreglarlo antes de agregar features.

---

## Registro de progreso

Formato: marcar `[x]` con fecha `YYYY-MM-DD` cuando se cierra. Si una validación falla, dejar `[ ]` y anotar bajo "Bloqueos".

### Bloqueos / desvíos
_(vacío)_

### Decisiones tomadas durante ejecución
_(vacío — registrar aquí cualquier cambio de scope que no implique agregar features prohibidas)_
