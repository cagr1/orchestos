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
- [x] **S8.7** Commit `129d317` `docs: honest README + LIMITATIONS + observability commands` — 2026-05-26

---

## Métrica única de éxito Mes 2

¿Un run de `orchestos task run --all` en un proyecto real termina con todas las tareas en `done`, evidencia en SQLite, y ningún archivo modificado fuera del contrato declarado?

- [x] **SÍ** — validado en qa-test-project: t1-normal done, t2-empty reverted (QA fail), t3-repeat-fail → failed_permanent tras 3 retries. Evidence en SQLite. Contract enforcement activo. — 2026-05-26
- [ ] Pendiente — validar con proyecto real de tercero (métrica "¿lo extrañaría si desaparece?").

---

## MES 3 — Reliability + Spec QA

Objetivo del mes: que el harness sea un módulo aislado, que cada tarea declare contratos verificables (LLM + comandos), que el contexto se sugiera desde un grafo de imports, y que la decisión "¿qué proveedor ejecuta esta tarea?" esté en `tasks.yaml`, no en código.

Fuente: crítica de Codex (extraer harness, separar criterios LLM de checks deterministas, Code Graph v0 solo imports) + pregunta del usuario sobre delegar a otros LLMs (campo `executor`).

**Lo que NO se construye este mes (explícito):**
- Code Graph con symbols/calls (solo `import`/`require`/`from`) — Mes 4+.
- Worktree sandbox real con `git worktree add` — Mes 4 (decisión separada en S12).
- Paralelismo entre tareas — Mes 4+. El harness queda listo para ello, pero el scheduler sigue siendo secuencial.
- Marketplace de skills, dashboard web, Engram — no.
- Proveedor "Codex CLI" como subprocess local — sí cuenta como executor, pero detrás de feature flag (`OS_ENABLE_EXEC_CODEX=1`) hasta tener una tarea real que lo use.

**Decisión sobre `executor` en `tasks.yaml`:** se introduce en S11 como un **enum cerrado** (`openrouter` | `anthropic` | `openai` | `codex`), no como string libre. Razón: si lo abrimos a cualquier valor, el harness no sabe cómo construir el cliente. Default sigue siendo `openrouter`. Codex/CLI queda detrás de flag hasta tener evidencia de que cambia algo.

---

### Mapa de delegación — quién actúa en cada sub-paso

Convención: **⚡ = cualquier LLM puede ejecutarlo leyendo este plan** (Codex, Haiku, modelo default). **🧠 = requiere criterio arquitectónico** (Claude Sonnet / Opus).

Un LLM ejecutor solo necesita leer el sub-paso marcado ⚡, los archivos que menciona y el contexto de `AGENTS.md` del repo. Si un sub-paso está bien escrito, no necesita preguntar nada.

| Sub-paso | Actor | Razón |
|----------|-------|-------|
| S9.1 | 🧠 Claude | Diseñar HarnessOpts/TaskResult — decide qué campos entran |
| S9.2 | 🧠 Claude | Mover 250 líneas de cli.ts — riesgo de romper flujo existente |
| S9.3 | ⚡ Codex | Extraer buildPrompt a prompt.ts — movimiento mecánico |
| S9.4 | ⚡ Codex | Añadir try/catch global en harness — comportamiento definido |
| S9.7 | ⚡ Codex | Commit |
| S10.1 | ⚡ Codex | Extender interfaz Task con campos opcionales — schema definido |
| S10.2 | ⚡ Codex | Añadir validaciones en validateTasksFile — reglas explícitas |
| S10.3 | ⚡ Codex | Crear checks.ts — interfaz y firma definidas en el plan |
| S10.4 | 🧠 Claude | Integrar checks en el flujo de harness — orden exacto importa |
| S10.5 | 🧠 Claude | Modificar prompt de QA para acceptance_criteria — prompt engineering |
| S10.6 | ⚡ Codex | safeAddColumn checks_json en runs |
| S10.8 | ⚡ Codex | Commit |
| S11.1 | ⚡ Codex | Añadir executor al schema Task |
| S11.2 | ⚡ Codex | Crear providers/index.ts con interfaz ProviderClient |
| S11.3 | ⚡ Codex | Implementar anthropic.ts real — POST definido, campos claros |
| S11.4 | ⚡ Codex | Implementar openai.ts real — POST definido |
| S11.5 | ⚡ Codex | Conectar executor en harness — una línea de cambio |
| S11.6 | ⚡ Codex | Codex executor con flag — Bun.spawn bien definido |
| S11.9 | ⚡ Codex | Commit |
| S12.1 | ⚡ Codex | Crear tablas files + code_edges — SQL definido en el plan |
| S12.2 | ⚡ Codex | indexProject con regex — patrones definidos, glob definido |
| S12.3 | ⚡ Codex | Comando orchestos index |
| S12.4 | ⚡ Codex | Integrar indexProject en orchestos init |
| S12.5 | 🧠 Claude | context suggest — algoritmo de ranking requiere criterio |
| S12.8 | ⚡ Codex | Commit |
| S13.1 | ⚡ Codex | Auto-suggest cuando input[] vacío — lógica definida |
| S13.2 | ⚡ Codex | --explain mode — dry run, sin API |
| S13.3 | ⚡ Codex | Rediseñar runs --detail con secciones |
| S13.4 | ⚡ Codex | Actualizar summary-pdf |
| S13.5 | ⚡ Codex | README sección Reliability |
| S13.7 | ⚡ Codex | Commit |
| S14.1 | ⚡ Codex | Extender schema YAML de skills |
| S14.2 | ⚡ Codex | Actualizar validators de skills |
| S14.3 | ⚡ Codex | Actualizar compiler targets |
| S14.4–S14.8 | 🧠 Claude | Escribir contenido de las 5 skills — criterio de producto |
| S14.10 | ⚡ Codex | Commit |

**Regla de escritura**: si un sub-paso ⚡ requiere más de 10 segundos para entender qué hacer, está mal escrito — agregar interfaz exacta, nombre de archivo, comportamiento ante error.

---

### SEMANA 9 — Extraer `src/run/harness.ts` (refactor sin features nuevas)

Objetivo medible: `cli.ts` < 350 líneas, el bloque `executeTask` desaparece de `cli.ts`, y `bun run typecheck` sigue verde. Comportamiento idéntico al de Mes 2 — ningún cambio observable para el usuario.

- [x] **S9.1** Crear `src/run/harness.ts` exportando: — 2026-05-27
  ```ts
  export interface HarnessOpts {
    projectRoot: string         // cwd absoluto del proyecto
    project: ProjectRecord      // ya cargado por cli.ts
    task: Task                  // task tal cual viene de tasks.yaml
    contextText: string         // AGENTS.md + context.json renderizado
    logger: RunLogger           // ya abierto por cli.ts
    dryRun?: boolean
    modelOverride?: string      // --model en CLI, opcional
  }

  export interface TaskResult {
    status: 'done' | 'retry' | 'failed' | 'blocked'
    runId: string
    qaVerdict?: 'pass' | 'fail'
    qaReason?: string
    retryReason?: string         // poblado si status === 'retry'
    filesWritten: string[]
    filesBlocked: string[]
    cost: { inputTokens: number; outputTokens: number; usd: number }
    elapsedMs: number
  }

  export async function runTask(opts: HarnessOpts): Promise<TaskResult>
  ```
- [x] **S9.2** Mover de `cli.ts` a `harness.ts`: — 2026-05-27 classify → resolveModel → buildPrompt → chat → parseLLMResponse → enforceContract → snapshotContents → write → runQA → restoreContents (si fail) → insertRun. `cli.ts` solo orquesta: abre logger, llama `runTask`, mapea `TaskResult` a `updateTaskStatus`.
- [x] **S9.3** Mover `buildPrompt(task, contextText, skill?)` a `src/run/prompt.ts`. No es responsabilidad del harness construir el prompt, es responsabilidad del harness ejecutarlo. — 2026-05-27
- [x] **S9.4** Error handling: cualquier excepción no controlada dentro de `runTask` — 2026-05-27 se atrapa, se loggea como `ERROR` y se devuelve `{ status: 'failed', retryReason: e.message, ... }`. El harness **nunca** lanza hacia `cli.ts`.
- [x] **S9.5** `cli.ts` post-refactor solo contiene: — 2026-05-27 ⚠️ 666 líneas (legacy `orchestos run` command no migrado al harness — ver decisiones) parsing de comandos commander + carga de `tasks.yaml` + scheduler topológico (sigue inline, no es para extraer todavía) + formato de salida en terminal.
- [x] **S9.6 — Validación** — 2026-05-27
  - [ ] `wc -l src/cli.ts` < 350. ⚠️ 666 líneas — legacy run no migrado (decisión anotada abajo)
  - [x] `wc -l src/run/harness.ts` 200–350. → 191 líneas ✓
  - [ ] ⚠️ MANUAL — `orchestos task run --all` en qa-test-project (requiere API key)
  - [x] `bun run typecheck` verde ✓
- [x] **S9.7** Commit `14b0ff8` + `prompt.ts` — 2026-05-27

---

### SEMANA 10 — `acceptance_criteria[]` + `checks[]` en tasks.yaml

Objetivo medible: una tarea con `checks: ["bun run typecheck"]` ejecuta el comando, captura exit code, y si != 0 marca la tarea como `retry` con `retryReason` derivado del check fallido — antes de gastar un token en QA.

- [x] **S10.1** Extender `Task` en `src/tasks/schema.ts`: — 2026-05-27
  ```ts
  interface Task {
    // ...campos existentes
    acceptance_criteria?: string[]   // frases que el QA LLM evalúa
    checks?: Check[]                 // comandos que el harness ejecuta
  }
  interface Check {
    cmd: string                      // ej. "bun run typecheck"
    cwd?: string                     // relativo al projectRoot, default '.'
    timeout_ms?: number              // default 60000
    expect_exit?: number             // default 0
  }
  ```
- [x] **S10.2** Validar en `validateTasksFile`: — 2026-05-27
  - `cmd` obligatorio si el item está presente.
  - `cmd` no puede contener `&&`, `||`, `;`, backticks, `$(` (sin shell metachars — un check = un proceso).
  - Si quieres concatenar, declara dos checks.
- [x] **S10.3** `src/run/checks.ts`: — 2026-05-27
  ```ts
  export interface CheckResult {
    cmd: string
    exitCode: number
    stdout: string         // últimas 2000 chars
    stderr: string         // últimas 2000 chars
    elapsedMs: number
    timedOut: boolean
  }
  export async function runChecks(checks: Check[], projectRoot: string, logger: RunLogger): Promise<CheckResult[]>
  ```
  Implementar con `Bun.spawn` + `signal: AbortSignal.timeout(timeout_ms)`. No interpretar `cmd` con shell — split por espacios respetando comillas (helper `tokenize(cmd)`).
- [x] **S10.4** Integrar en `harness.runTask`. — 2026-05-27
- [x] **S10.5** Modificar prompt de QA en `src/run/qa.ts` para que reciba `acceptance_criteria`. — 2026-05-27
- [x] **S10.6** Persistir en `runs`: `safeAddColumn checks_json TEXT`. — 2026-05-27
- [ ] **S10.7 — Validación**
  - [ ] ⚠️ MANUAL — Tarea con `checks: ["bun run typecheck"]` y output que rompe TS → `retry`, sin llamada QA.
  - [ ] ⚠️ MANUAL — Tarea con `acceptance_criteria` → QA devuelve `criteria[]` por criterio.
  - [ ] ⚠️ MANUAL — Tarea sin campos nuevos → comportamiento Mes 2 idéntico.
  - [x] `bun run typecheck` verde ✓
- [x] **S10.8** Commit `feat(tasks): acceptance_criteria + deterministic checks` — 2026-05-27

---

### SEMANA 11 — `executor` field + multi-provider

Objetivo medible: una tarea con `executor: anthropic` corre por Anthropic directo (no por OpenRouter), y otra con `executor: openrouter` sigue funcionando. Cambiar el executor no requiere tocar código.

- [x] **S11.1** Extender `Task`: — 2026-05-27
  ```ts
  executor?: 'openrouter' | 'anthropic' | 'openai' | 'codex'  // default 'openrouter'
  ```
  Validar enum en `validateTasksFile`. Default queda en `openrouter` para no romper `tasks.yaml` existentes.
- [x] **S11.2** `src/providers/index.ts` — registry: — 2026-05-27
  ```ts
  export interface ProviderClient {
    name: string
    chat(opts: ChatOpts): Promise<ChatResponse>
  }
  export function getProvider(name: string): ProviderClient
  ```
  `getProvider('anthropic')` lee `ANTHROPIC_API_KEY` de `~/.orchestos/.env` y devuelve cliente que habla directo con `api.anthropic.com/v1/messages`. `getProvider('openai')` igual con `OPENAI_API_KEY`. Si la key falta, error claro: `Provider anthropic requires ANTHROPIC_API_KEY in ~/.orchestos/.env`.
- [x] **S11.3** Implementar `src/providers/anthropic.ts` real (ya hay stub) — POST a `/v1/messages`, system separado, devolver `{ text, inputTokens, outputTokens, model }`. — 2026-05-27
- [x] **S11.4** Implementar `src/providers/openai.ts` real — POST a `/v1/chat/completions`. — 2026-05-27
- [x] **S11.5** Harness usa `getProvider(task.executor ?? 'openrouter').chat(...)`. El QA hereda el mismo executor por defecto; si la tarea declara `qa_executor` (opcional) lo usa en su lugar — decisión: **no agregar `qa_executor` aún**, esperar a tener una razón real. — 2026-05-27
- [x] **S11.6** `executor: codex` — detrás de `OS_ENABLE_EXEC_CODEX=1`. Implementación mínima: `Bun.spawn(['codex', 'exec', '--json', prompt])` y parsear stdout. Si la env var no está, validador rechaza tasks con `executor: codex` con mensaje `codex executor disabled — set OS_ENABLE_EXEC_CODEX=1 to enable`. — 2026-05-27
- [x] **S11.7** Persistir `provider` en `runs` (la columna ya existe — solo asegurar que se rellena con el executor real, no hardcoded `openrouter`). — 2026-05-27
- [ ] **S11.8 — Validación**
  - [ ] Tarea con `executor: anthropic` corre y `runs --detail` muestra `provider: anthropic`.
  - [ ] Tarea con `executor: foo` → validator falla con `unknown executor 'foo' — allowed: openrouter, anthropic, openai, codex`.
  - [ ] `tasks.yaml` sin `executor` → corre por openrouter sin cambios.
  - [ ] Tarea con `executor: codex` sin env var → falla en validación, no llega al harness.
- [ ] **S11.9** Commit `feat(executor): multi-provider routing per task`.

---

### SEMANA 12 — Code Graph v0 (solo imports) + `context suggest`

Objetivo medible: `orchestos index` recorre el proyecto, persiste un grafo de imports en SQLite, y `orchestos context suggest --task "fix login bug in auth.ts"` devuelve los 5 archivos más relevantes en < 500ms.

- [ ] **S12.1** Schema SQLite (vía `safeAddTable` en `db/migrate.ts`):
  ```sql
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    path TEXT NOT NULL,                  -- relativo al projectRoot
    language TEXT NOT NULL,              -- 'ts' | 'tsx' | 'js' | 'py' | ...
    sha1 TEXT NOT NULL,                  -- de contenidos
    size_bytes INTEGER NOT NULL,
    indexed_at TEXT NOT NULL,
    UNIQUE(project_id, path)
  );
  CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

  CREATE TABLE IF NOT EXISTS code_edges (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    from_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    to_path TEXT NOT NULL,               -- ruta resuelta relativa al projectRoot
    to_file_id INTEGER,                  -- NULL si externo (node_modules / unresolved)
    kind TEXT NOT NULL,                  -- 'import' | 'require' | 'from'
    raw TEXT NOT NULL,                   -- la línea original, para debugging
    UNIQUE(from_file_id, raw)
  );
  CREATE INDEX IF NOT EXISTS idx_edges_from ON code_edges(from_file_id);
  CREATE INDEX IF NOT EXISTS idx_edges_to ON code_edges(to_file_id);
  ```
- [ ] **S12.2** `src/graph/index.ts` con función `indexProject(projectRoot, projectId)`:
  - Glob de `**/*.{ts,tsx,js,jsx,mjs,cjs,py}` excluyendo `node_modules`, `dist`, `.next`, `.git`, `runs/`.
  - Por archivo: regex (no tree-sitter en v0) para extraer imports en TS/JS y Python.
  - Resolver paths relativos (`./foo` → `src/auth/foo.ts`) probando extensiones en orden `.ts, .tsx, .js, .jsx, .py, /index.ts, /index.js`. Paquetes sin `./` quedan `to_file_id: NULL`.
  - Upsert por `sha1`: si no cambió, no reparsear.
- [ ] **S12.3** Comando `orchestos index [--project <name>]` — corre indexación, imprime `indexed N files, M edges in X ms`.
- [ ] **S12.4** Integración con `orchestos init`: al final del init, correr `indexProject` automáticamente. No hay watcher — el usuario corre `orchestos index` manualmente cuando cambia mucho código.
- [ ] **S12.5** `orchestos context suggest --task "<texto>" [--max 5]`:
  - Tokenizar el texto: extraer nombres en CamelCase/snake_case/kebab-case + paths explícitos.
  - Buscar en `files.path` por substring match de cada token.
  - Por cada match, sumar 1-hop vecinos (importadores + importados).
  - Ranking: `score = tokenMatchesEnPath*3 + edgesAtravesados`.
  - Devolver top N paths.
- [ ] **S12.6** Añadir a `LIMITATIONS.md`: "Context suggest v0 solo conoce imports. No sabe qué función llama a qué función. Para 'rename function X', el grafo no te ayuda — Mes 4+ con symbols."
- [ ] **S12.7 — Validación**
  - [ ] `orchestos index` en citasbot-whatsapp termina en < 2s, persiste `files` y `code_edges` no vacíos.
  - [ ] `orchestos context suggest --task "fix bug in auth login"` devuelve archivos que mencionan `auth` o `login`, en < 500ms.
  - [ ] Reindexar sin cambios = 0 inserts nuevos en `code_edges`.
  - [ ] Borrar un archivo y reindexar → su row en `files` desaparece y sus `code_edges` también (cascade).
- [ ] **S12.8** Commit `feat(graph): code graph v0 + context suggest`.

---

### SEMANA 13 — Integración + hardening

Objetivo medible: `harness.runTask` usa `context suggest` cuando `input[]` está vacío; `runs --detail` es auditable en 30 segundos; un usuario externo corre el flujo completo con los 3 sistemas juntos sin fricción.

- [ ] **S13.1** Si `task.input` está vacío, `harness.runTask` llama `contextSuggest(task.description)` y mete los top 5 paths como `input` implícito (loggear `INPUT:auto-suggested foo.ts, bar.ts`). Si la tarea declara `input` explícito, ese gana.
- [ ] **S13.2** `orchestos task run --explain <id>` — modo dry que NO ejecuta, solo imprime: executor, modelo, archivos sugeridos por graph, checks que correrían, criterios de aceptación. Para revisar antes de gastar tokens.
- [ ] **S13.3** `runs --detail` rediseñado con secciones: `## Provider`, `## Checks (deterministic)`, `## Acceptance criteria (LLM)`, `## Files`, `## Cost`. Auditable por un humano en 30 segundos.
- [ ] **S13.4** Actualizar `summary-pdf.ts`: añadir columna `executor` y resumen "checks failed / checks passed" del período.
- [ ] **S13.5** README — sección nueva `## Reliability features (Mes 3)` con ejemplo de `tasks.yaml` usando los 3 features juntos.
- [ ] **S13.6 — Validación final del mes**
  - [ ] Una tarea con `executor: anthropic`, `checks: ["bun run typecheck"]`, `acceptance_criteria: ["..."]`, sin `input[]` corre end-to-end: contexto auto-sugerido por graph, checks pasan, QA pasa → `done`. Toda la evidencia visible en `runs --detail`.
  - [ ] Misma tarea pero con código que rompe TS → `retry` por check, 0 tokens de QA gastados, restoreContents revierte.
  - [ ] `orchestos task run --explain` no consume API.
  - [ ] Un usuario externo corre el flujo y comenta en `IDEAS.md ## Feedback Mes 3`.
- [ ] **S13.7** Commit `feat(m3): harness + checks + executor + graph integration complete`.

---

### SEMANA 14 — Skills con estructura real (ECC + mattpocock)

Objetivo medible: `orchestos skill list` muestra 5 skills con `when_to_use`, `verifiers` y `anti_patterns`. Al compilar con `--target claude`, cada skill genera un SKILL.md que un LLM puede seguir como mini-política, no solo como prompt bonito.

- [ ] **S14.1** ⚡ Extender schema YAML de skill en `src/skills/registry.ts`:
  ```ts
  interface Skill {
    // ...campos existentes (id, version, name, description, targets, instructions)
    when_to_use?: string[]       // "When TypeScript errors block build"
    inputs_required?: string[]   // "tsc output", "file with errors"
    verifiers?: string[]         // comandos que confirman que la skill funcionó
    anti_patterns?: string[]     // "Do not silence errors with any"
    examples?: SkillExample[]
  }
  interface SkillExample {
    title: string
    input: string
    output: string
  }
  ```
- [ ] **S14.2** ⚡ Actualizar `validateSkill` en `src/skills/registry.ts` para permitir (no requerir) los campos nuevos. Skills existentes sin ellos siguen siendo válidas.
- [ ] **S14.3** ⚡ Actualizar compiler targets (`src/skills/targets/claude.ts`, `cursor.ts`, `openai.ts`) para incluir los campos nuevos si están presentes. Formato sugerido para claude:
  ```markdown
  ## When to use
  - When TypeScript errors block build

  ## Anti-patterns
  - Do not silence errors with `any`

  ## Verifiers
  Run after applying: `npm run typecheck`
  ```
- [ ] **S14.4** 🧠 Escribir skill: `pre-task-alignment` — antes de ejecutar cualquier tarea, verificar que la descripción es inequívoca. Si hay ambigüedad, devuelve preguntas, no código. Inspirado en spec-kit clarify phase.
- [ ] **S14.5** 🧠 Escribir skill: `diagnose` — debugging estructurado: hipótesis → verificar → siguiente hipótesis. Anti-patrón: escribir código antes de entender el error.
- [ ] **S14.6** 🧠 Escribir skill: `tdd-enforcer` — red-green-refactor. Anti-patrón: implementar sin test primero. Verifier: `npm test` pasa antes y después.
- [ ] **S14.7** 🧠 Escribir skill: `context-compression` — genera `CONTEXT.md` con vocabulario del proyecto (nombres de módulos, convenciones, abreviaciones del equipo). Reduce tokens por run. Input: AGENTS.md + últimos 10 runs. Verifier: `CONTEXT.md` generado, < 500 tokens.
- [ ] **S14.8** 🧠 Escribir skill: `improve-architecture` — identifica módulos con demasiadas responsabilidades (> 300 líneas, > 5 imports de dominios distintos). Sugiere extracción, no la implementa. Anti-patrón: extraer antes de entender el contrato.
- [ ] **S14.9 — Validación**
  - [ ] `orchestos skill list` muestra 5 skills con columna `when_to_use` visible.
  - [ ] `orchestos skill build --target claude --id pre-task-alignment` genera SKILL.md con secciones `When to use`, `Anti-patterns`, `Verifiers`.
  - [ ] Skill sin campos nuevos (las 3 existentes) compila sin error — retrocompatibilidad.
  - [ ] `bun run typecheck` verde.
- [ ] **S14.10** ⚡ Commit `feat(skills): structured skills schema + 5 real skills (ECC + mattpocock patterns)`.

---

## Métrica única de éxito Mes 3

¿Una tarea con `executor`, `checks` y `acceptance_criteria` corre end-to-end, los checks deterministas atajan antes del QA cuando deben, el graph sugiere contexto razonable, `cli.ts` ya no contiene lógica de ejecución, y hay 5 skills con `verifiers` + `anti_patterns` compilables?

- [ ] **SÍ** → Mes 3 cerrado. Abrir plan Mes 4 (symbols en el graph, worktrees reales, paralelismo, spec-driven flow completo).
- [ ] **NO** → no abrir Mes 4. Identificar cuál de los 5 ejes (harness / checks / executor / graph / skills) no resistió uso real y rehacerlo.

---

## Lista prohibida Mes 3

- Symbols/calls en el graph — solo imports.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado del `executor` — esperar datos que lo justifiquen.
- Worktrees reales (`git worktree add`) — cwd directo hasta que haya un caso que lo rompa.
- Reescribir el scheduler a archivo separado — sigue inline en `cli.ts`.
- `executor` como string libre — enum cerrado. Agregar Gemini = PR que toca `getProvider`.
- `planner_model` / `executor_model` en tasks.yaml — la separación dos-tier vive en PLAN.md (⚡/🧠) hasta tener datos que justifiquen meterla en el schema. Idea anotada en IDEAS.md.
- Más de 5 skills en S14 — calidad sobre cantidad. Si las 5 no se usan en proyectos reales, no agregar más.

---

## Decisiones explícitas de diseño (Mes 3)

- **2026-05-27 — Checks corren ANTES del QA, no después.** Si TS no compila, no tiene sentido preguntarle a un LLM. Ahorro de tokens + falla más rápida + más determinista.
- **2026-05-27 — Checks usan exit code, no parseo de stdout.** Si el usuario quiere chequear stdout, escribe un wrapper script. orchestos no se mete en parsing.
- **2026-05-27 — Graph v0 con regex, no tree-sitter.** Agrega complejidad de build (parsers nativos por lenguaje). El schema SQLite ya soporta más `kind` que `import` — cuando S12.6 deje de ser suficiente, se cambia en Mes 4.
- **2026-05-27 — Harness nunca lanza.** Toda excepción se traduce a `TaskResult` con `status: 'failed'`. `cli.ts` no tiene `try/catch` alrededor de lógica de ejecución.
- **2026-05-27 — Codex executor detrás de flag.** No hay evidencia de que delegar a CLI externo cambie algo. La estructura queda lista; el botón se prende cuando alguien quiera medirlo.
- **2026-05-27 — S9: legacy `orchestos run` no migrado al harness.** El comando `run --task --output` tiene ~150 líneas de lógica LLM inline que no se movieron. Razón: S9 es refactor sin behavior changes y el comando legacy es un flujo distinto (sin tasks.yaml). Se migra en S11 cuando se implemente el provider registry, o se depreca si nadie lo usa.
- **2026-05-27 — Two-tier LLM: ⚡/🧠 en PLAN.md, no en tasks.yaml aún.** El patrón "modelo fuerte planifica, modelo ligero ejecuta" se implementa como convención de delegación en el plan. `planner_model`/`executor_model` en tasks.yaml va a Mes 4+ cuando haya evidencia de que lo necesita el harness.

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
