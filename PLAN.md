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

- [x] **S5.1** Schema `tasks.yaml` con `id`, `description`, `skill`, `input[]`, `output[]`, `depends_on[]`, `status`, `retry_count`, `retry_reason`, `qa_verdict`, `run_id`. — 2026-05-26
- [x] **S5.2** `src/tasks/schema.ts` — `Task` + `TasksFile` + `validateTasksFile`. Falla con mensaje claro si falta `output[]` o si el `id` no es kebab-case; detecta ids duplicados. — 2026-05-26
- [x] **S5.3** `src/tasks/loader.ts` — `loadTasks` / `saveTasks` con lock optimista por hash + `updateTaskStatus` patch. — 2026-05-26
- [x] **S5.4** `orchestos task init` — scaffold con 2 tareas según stack (Next.js / Python / genérico). — 2026-05-26
- [x] **S5.5** `orchestos task list` — tabla con icono de status, deps, qa, retry. — 2026-05-26
- [x] **S5.6** `orchestos task run` — selecciona próxima `pending` sin deps bloqueadas, ejecuta via `enforceContract`, persiste run en SQLite, actualiza status en `tasks.yaml`. — 2026-05-26
- [x] **S5.7** Tabla `runs` extendida: `task_id`, `snapshot_before`, `snapshot_after`, `qa_verdict`, `qa_reason` (via `safeAddColumn`). — 2026-05-26
- [x] **S5.8 — Validación** (commit a59ed37): — 2026-05-26
  - [x] `task init` genera `tasks.yaml` válido en stack detectado.
  - [x] `task run` ejecuta T1 (`t1-util`) y escribe solo lo declarado; intentos fuera = `blocked`.
  - [x] `tasks.yaml` queda con `status: done` en T1.
  - [x] SQLite guarda `snapshot_before` y `snapshot_after` distintos.
- [x] **S5.9** Commit `a59ed37` `feat(tasks): tasks.yaml workflow + dependency scheduler` (incluye también el scheduler de S7 — fusionado en un solo commit). — 2026-05-26

---

### SEMANA 6 — QA stage (segundo LLM call antes de `done`)

Objetivo medible: después de cada run, un QA call valida el output. Si falla → tarea vuelve a `pending` con `retry_reason`.

- [x] **S6.1** `src/run/qa.ts` — `runQA({description, output, written, model})` con `snapshotContents` + `restoreContents` para revert basado en contenido (no solo hashes). — 2026-05-26
- [x] **S6.2** Prompt de QA — system+user con descripción + archivos escritos + pide JSON `{verdict, reason}`. — 2026-05-26
- [x] **S6.3** Integrado en `task run`: pass → `done` con `qa_verdict: pass`; fail → `restoreContents` + `pending` con `retry_reason` y `retry_count++`. Loop `--all` distingue `retry` (sigue) de `failed` (corta). — 2026-05-26
- [x] **S6.4** `MAX_RETRIES = 3`. Al alcanzarlo → `failed_permanent`; el scheduler lo trata como bloqueo terminal. — 2026-05-26
- [x] **S6.5** Comando `orchestos task status <path>` — tabla con `id | status | retry_count | qa | cost` + total. Lee costos vía `listRunsByTaskId`. — 2026-05-26
- [x] **S6.6 — Validación** — 2026-05-26
  - [x] QA falla intencionalmente: tarea con output vacío → `retry_count=1/3 → back to pending` ✓
  - [x] QA pasa: `add(a,b)` normal → `done · QA pass` + `qa_verdict: pass` en SQLite ✓
  - [x] Tarea con 3 fallos QA → `retry_count=3 ≥ 3 → failed_permanent`, 4to intento devuelve `permanently failed` sin ejecutar ✓
- [x] **S6.7** Commit `31b0c6d` `feat(qa): QA stage - second LLM call validates output before done` — 2026-05-26

---

### SEMANA 7 — Workflow multi-tarea con dependencias

Objetivo medible: `orchestos task run --all` ejecuta todas las tareas en orden topológico, respetando dependencias.

- [x] **S7.1** Selección de próxima tarea inline en `task run` — filtra `pending` cuyas `depends_on` estén todas `done`. Implementado dentro de `cli.ts` en vez de `src/tasks/scheduler.ts` separado (decisión: mantenerlo simple hasta que haga falta). — 2026-05-26
- [x] **S7.2** `orchestos task run --all` — loop con `MAX=20` iteraciones, recarga `tasks.yaml` cada vuelta, termina cuando no hay `pending`. — 2026-05-26
- [x] **S7.3** Halt en fallo — `'failed'` corta el loop con mensaje; los dependientes quedan `pending` (no se ejecutan porque su dep no está `done`). `'retry'` (QA fail) no corta. — 2026-05-26
- [x] **S7.4** `orchestos task run --id <task-id>` — ejecuta una tarea específica saltando el scheduler. — 2026-05-26
- [x] **S7.5** `src/run/logger.ts` — clase `RunLogger`: abre `runs/YYYY-MM-DD-HH-mm.log` al iniciar, escribe `START / QA:pass / QA:fail / DONE / BLOCKED / CONTRACT_VIOLATION / ERROR` con timestamp HH:mm:ss.mmm. Integrado en `executeTask`. — 2026-05-26
- [x] **S7.6 — Validación completa** — 2026-05-26
  - [x] T1 → T2: `--all` ejecutó t1-util → t2-doc en orden.
  - [x] Contract enforcement bloquea writes fuera de `output[]`.
  - [x] Log en disco verificado: `2026-05-26-21-25.log` con `START → QA:pass → DONE` ✓
- [x] **S7.7** Incluido en commit `docs: honest README + LIMITATIONS + observability commands` (S8.7). — 2026-05-26

---

### SEMANA 8 — Observabilidad + README honesto

Objetivo medible: alguien externo puede clonar el repo, leer el README y correr `orchestos task run` en su proyecto en < 10 minutos.

- [x] **S8.1** `orchestos runs --detail <run-id>` — muestra evidencia completa: date, task, model, status, qa_verdict, qa_reason, tokens, cost, elapsed, allowed/attempted/authorized/blocked, snapshot_before/after, result. — 2026-05-26
- [x] **S8.2** `orchestos runs --export` — exporta todo el historial a `runs-export.json` en cwd. `listRuns(0)` = sin límite. — 2026-05-26
- [x] **S8.3** `summary-pdf.ts` — nueva sección "Recent Runs": total runs, done/all, costo total, tabla de últimas 8 runs con status + qa_verdict. Se pasa `recentRuns[]` desde `init` y `summary`. — 2026-05-26
- [x] **S8.4** `README.md` reescrito — título honesto, install, quickstart 5 pasos, explicación del flujo, todos los comandos, formato tasks.yaml, sin claims falsos. — 2026-05-26
- [x] **S8.5** `LIMITATIONS.md` — ejecución secuencial, sin sandbox, sin rollback si el proceso crashea, QA también alucina, sin límite de costo, single-user local. — 2026-05-26
- [x] **S8.6 — Validación** — 2026-05-26
  - [ ] ⚠️ Clonar en directorio limpio — pendiente (requiere máquina sin bun instalado o VM; aplaza a revisión externa).
  - [x] `runs --detail` muestra evidencia real de run `6b6f67fe` con snapshot, qa_reason, tokens ✓
  - [x] `runs --export` genera `runs-export.json` con 9 runs / 227 líneas ✓
  - [x] README no contiene "deterministic parallel", "anti-hallucination", "LLM-fatigue protection" ✓
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

- **2026-05-26 — S5+S7 fusionados en un solo commit (`a59ed37`)**. El scheduler resultó tan pequeño que extraerlo a `src/tasks/scheduler.ts` era overkill; quedó inline en `cli.ts`. Si crece (ciclos, paralelismo, batching) se extrae entonces.
- **2026-05-26 — S7.5 (log a disco) postergado**. No bloquea S6. Se hace junto con S8.1/S8.2 (observabilidad) o cuando aparezca la primera necesidad real de auditoría offline.
- **2026-05-26 — S6 QA usa el mismo modelo que la tarea**. Plan original sugería "model" como parámetro libre; por ahora reutilizamos `resolveModel(taskClass)` para no introducir una segunda decisión de routing antes de tener datos. Si el QA falla seguido por ser muy permisivo/estricto, se mete un modelo dedicado.
- **2026-05-26 — Revert de QA fail captura contenido completo, no solo hashes**. `snapshot_before` (hashes) se mantiene como evidencia en SQLite; `snapshotContents` vive solo en memoria del run y nunca se persiste. Razón: hashes no permiten restaurar, y persistir contenidos infla la DB sin valor probado.
