---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-17-cerrado--mes-18-abierto
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**:
- 🧠 = Claude implementa — requiere criterio arquitectural o decisión de diseño
- ⚡ = DeepSeek implementa — tarea bien especificada, ejecuta leyendo el plan
- 🔍 = revisión obligatoria por Claude — gate antes de cerrar el sprint, independiente de quién implementó

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 18 — Chat como entrada única: detección de intención de tarea

**Eje decidido por Carlos (2026-07-02), graduado de IDEAS.md #12 en el cierre del Mes 17 (2026-07-05, regla IDEAS→PLAN→DONE) — ítem eliminado de allá.**

**Origen**: Carlos quiere que, con el tiempo, el chat sea el medio de comunicación principal de OrchestOS (como ya hacen Open WebUI/Hermes/Claude Desktop) — una sola entrada, y la pantalla Tasks pasa a ser solo un **visor** de lo que corre por debajo, no el lugar donde se crea el trabajo. Pregunta concreta que lo disparó: si el usuario escribe en el chat algo como *"lee PLAN.md y ejecuta front 2"* — sin la palabra "tarea" — ¿el sistema puede entender que es realmente una tarea y sugerir convertirla, en vez de solo responder conversacionalmente?

**Qué ya existe (NO reconstruir)**: el chat-create-task-bar (Mes 10, `chat-create-task-bar` en [screens-core.js:48](src/dashboard/public/screens-core.js:48)) ya pre-llena el composer de Tasks con el contexto de la conversación — pero es una heurística tonta (aparece a partir de 3+ mensajes, sin mirar contenido) y **requiere acción manual del usuario**. El chat hoy NO tiene ninguna tool para leer `PLAN.md`/`tasks.yaml` ni para crear o correr tareas — solo `FETCH_URL_TOOL` (Mes 13). `runToolLoop()`/`callWithTools()` (`tool-call.ts`, Mes 13, ✅ probado en producción) ya resuelven el loop multi-turno LLM↔tool↔resultado — el motor para darle al chat tools de lectura de proyecto/tasks ya existe, solo falta registrarlas.

**El gap real, en dos capas separadas que NO deben mezclarse**:
1. **Detección semántica de intención** — un LLM call (mismo patrón que IDEAS #4, clasificador semántico de `clarify`) que mire el mensaje del usuario y decida "esto describe trabajo ejecutable sobre el repo" vs. "esto es una pregunta conversacional", independiente de si contiene la palabra "tarea".
2. **Acción sobre esa detección** — qué hace el sistema cuando detecta intención de tarea. Acá es donde está la delicadeza real.

**Por qué es delicado — leer vs. actuar** (mismo principio que MCP en IDEAS.md):
- Darle al chat una tool de **lectura** (`PLAN.md`, `tasks.yaml`, `IDEAS.md`) es de bajo riesgo — mismo boundary ya probado con el web fetch (contenido externo = dato, nunca instrucción).
- Darle al chat la capacidad de **crear y/o correr** una tarea automáticamente, sin que el usuario revise el draft en el composer primero, pierde el punto de control que hoy existe (revisar `description`/`output`/`executor` antes de gastar dinero real en el executor). Un falso positivo del clasificador podría disparar un run real no pedido.

**Reglas de seguridad innegociables (decisión ya tomada con Carlos, no renegociar sin volver a preguntar)**:
1. **Nunca auto-run silencioso.** El chat puede, como máximo, *sugerir* la conversión y pre-llenar el draft — el usuario sigue confirmando antes de que algo se ejecute.
2. **El clasificador no debe alucinar tareas que no existen** — gatear en evidencia real de que la heurística de 3+ mensajes genera falsos negativos frecuentes, no implementarlo "porque se puede".
3. **Las tools de lectura de proyecto son de solo lectura** — no se mezcla con escritura de archivos ni con disparar `task run`/`run --graph` desde el chat en esta misma pieza de trabajo.

**Pre-flight (2026-07-05):** Mes 17 cerrado sin deuda bloqueante propia (ver tabla de estado en DONE.md § MES 17). Hallazgo abierto de Mes 17 (no bloqueante para este mes, backlog): IDEAS.md #19 — tareas `engine: external` sin `checks:` explícitos pierden su única red determinista.

### Bloque A — Diseño de guardrails (ANTES de tocar código, se revisa con Carlos)
- [x] A.1 🧠 Doc de diseño (`docs/chat-task-detection-design.md`, 2026-07-05) que decide: (a) el LLM call clasificador NO se implementa sin evidencia — instrumentar la barra actual (primer paso de B.1) es lo que genera esa evidencia; forma del call ya fijada (modelo barato vía `supportsToolCalling()`, prompt binario, salida `{isTask, reason}` fail-safe); (b) tres `ToolDef` de solo lectura (`read_plan`/`read_tasks`/`read_ideas`) sobre `runToolLoop()`, mismo patrón que `FETCH_URL_TOOL`/`SEARCH_MEMORY_TOOL`, sin wrapper de "dato externo" porque el contenido es del propio repo; (c) el control humano es una extensión de `chat-create-task-bar` existente (aparece antes si `isTask===true`, cita `reason`), el botón sigue pre-llenando el composer sin auto-run, la heurística de 3+ mensajes queda como red de respaldo; (d) orden real: B.2 (tools de lectura) primero por ser bajo riesgo y valor inmediato, B.1 (clasificador) solo si aparece evidencia real de falsos negativos.
- [x] A.2 🔍 Revisión del doc con Carlos antes de abrir B (aprobado 2026-07-05, "GO").

### Bloque B — Implementación (pendiente de diseño de A.1)
- [x] B.2 ⚡ Tools de lectura `read_plan`/`read_tasks`/`read_ideas` (`tool-call.ts`, `handlers/chat.ts`) registradas en `runToolLoop()`, verificado en vivo (2026-07-05): `claude-haiku-4-5` real invocó `read_plan` y citó contenido real de PLAN.md.
- [x] B.2.1 🧠 Bug real encontrado al verificar B.2 en vivo (2026-07-05): `handleApiChat` calculaba `chatMaxTokens` como `contextWindowFor(model) - promptTokens - margen`, sin clamp al tope real de salida del proveedor (`maxOutputTokensFor()`) — misma clase de bug que `harness.ts` corrigió en el gate G.5 (2026-07-02). Reproducido con `anthropic/claude-haiku-4-5` vía OpenRouter pidiendo ~196K tokens de salida contra una ventana de 200K → 400 del proveedor. Corregido con `Math.min(available, maxOutputTokensFor(model))`, mismo patrón que harness.ts, reverificado en vivo (200 OK).
- [x] B.1.a 🧠 Instrumentación de `chat-create-task-bar` (2026-07-05, primer paso de B.1 — ver A.1): tabla `chat_task_bar_events` (`migrate.ts`) registra un evento `message` por mensaje enviado (con `history_len`/`bar_shown`, mismo umbral `>=3` que el frontend) y un evento `click` cuando el usuario usa la barra. Endpoint `POST /api/chat/task-bar-click`. Verificado en vivo (200 OK en ambos endpoints, fila real en la tabla con `bar_shown=1` correcto para el umbral). **El clasificador semántico en sí (B.1.b) sigue sin implementarse** — falta acumular uso real y correlacionar mensajes con `bar_shown=0` que de todas formas describían trabajo ejecutable, antes de gastar en el LLM call. Nota operativa: la instrumentación solo corre en el proceso del dashboard que tenga este código — el proceso ya corriendo en :4242 necesita reiniciarse para empezar a registrar.
- [x] B.1.b-ui 🧠 Vista de solo lectura de `chat_task_bar_events` en el dashboard (2026-07-05): tercer tab "Chat evidence" en la pantalla Project (`screens-ops.js`), endpoint `GET /api/chat/task-bar-events`. Carlos pidió explícitamente ver la evidencia sin depender de que Claude corra un query — mismo principio que [[feedback-dashboard-no-solo-cli]]. Verificado en vivo: tab renderiza resumen (24 mensajes, 14 barra oculta, 10 barra mostrada, 0 clicks) + tabla real, sin errores de consola.
- [ ] B.1.b 🧠 Clasificador semántico de intención de tarea — **EN ESPERA DE EVIDENCIA (decisión de Carlos, 2026-07-05): no se abre por goteo de tiempo, se abre cuando `chat_task_bar_events` tenga suficiente uso real.** Criterio de "suficiente" (sin fecha fija — el uso del chat es esporádico, un umbral de días fijo puede no juntar mensajes reales): al menos ~30-40 mensajes `kind='message'` reales acumulados (no sintéticos/de prueba), con variedad de tipos — algunos conversacionales, algunos que describen trabajo ejecutable — Y idealmente 2+ semanas de calendario para que la variedad sea real y no una sola sesión. Lo que pase primero no importa tanto como la variedad real. Ahora Carlos puede revisarlo él mismo en Project → "Chat evidence".

### Bloque C — Superficie
- [ ] C.1 ⚡ UI de sugerencia (no auto-run) cuando el clasificador detecta intención de tarea. Depende de B.1.b.

### Bloque D — Auto-selección semántica de skill (ex-IDEAS #21, graduado 2026-07-06 — independiente de B.1.b, no bloquea ni bloquea el cierre del mes)
**Origen**: prueba real de Carlos con una landing comercial usando "skills de diseño" no dio el resultado esperado — diagnóstico destapó que ninguna skill se auto-aplica hoy (`skill-route.ts` solo lee `task.skill` explícito) y que no existían skills de diseño nativas. Diseño completo y aprobado por Carlos (2026-07-06) en [docs/semantic-skill-selection-design.md](../docs/semantic-skill-selection-design.md).
- [x] D.0 🧠 Gap de contenido — 4 skills de diseño nativas escritas y verificadas en vivo: `frontend-design`, `ux-guidelines`, `design-brief-inference`, `design-tokens`.
- [x] D.1 🧠 Motor de clasificación (`listAllSkillCandidates()` en `project.ts`): recibe la `description` del draft + `when_to_use` de las 16 skills instaladas, devuelve 0/1/varios candidatos validados contra ids reales — un id inventado se descarta en silencio (`isKnownSkillId()`, mismo fail-safe en `tasks.ts` al crear la tarea).
- [x] D.2 ⚡ Wiring en `/api/natural` — se decidió **un solo call** (no uno adicional): la lista de skills se agregó al prompt del draft existente, mismo call que ya generaba `id`/`description`/`output`/`executor`. Más barato y simple que un segundo call.
- [x] D.3 ⚡ Campo de skill en el composer (`naturalDraft` → `#draft-skill`): 1 candidato → pre-cargado; 2+ candidatos → `<select>` con "None"/"Ninguna" preseleccionada (nunca resuelve el empate a ciegas); 0 candidatos → campo no se renderiza.
- [x] D.4 🔍 Gate en vivo con dinero real (2026-07-06): draft de landing comercial de cafetería → 4 candidatos de diseño reales, selector visible con "None" preseleccionado, confirmado seleccionable en el DOM real. Draft de bugfix de auth middleware → **mejor evidencia de la esperada**: no sugirió diseño, sugirió `diagnose`/`bug-hypothesis`/`code-review` (3 skills de ingeniería que ya existían desde antes de hoy y nunca se auto-aplicaban) — confirma que el motor discrimina por dominio, no es un simple sí/no de diseño. `tasks.yaml` verificado sin diff tras el gate (draft cancelado, no confirmado). 626 tests · 0 fail · `tsc --noEmit` limpio.

### Bloque E — Auditoría de paridad CLI ↔ Dashboard (ex-IDEAS #9b, graduado 2026-07-06 — independiente de B.1.b, no bloquea el cierre del mes)
**Origen**: Carlos, 2026-06-29, dogfooding del flujo chat→tarea — "el CLI sí está funcionando pero el front no". Decisión de Carlos (2026-07-06): mientras B.1.b espera evidencia real (no hay atajo posible), seguir avanzando en paralelo con lo que ya estaba documentado en IDEAS.md, priorizando exactamente esto — "el front DEBE reflejar el back".
- [x] E.1 🧠 Barrido formal completo (2026-07-06): los ~45 subcomandos reales de `cli.ts` comparados contra los endpoints reales de `server.ts` (la lista original de IDEAS #9b era "a ojo", no exhaustiva — **una entrada estaba mal**: `skill build` sí tiene endpoint, `/api/skills/:id/build`, existe desde Mes 11).

  **Gaps confirmados (sin superficie en el dashboard, ni de solo lectura):**
  | Comando CLI | Qué hace | Estado |
  |---|---|---|
  | `spec approve/lint/archive/create` | Ciclo de vida de specs SDD | Solo `list`/`draft` en dashboard |
  | `instinct set-confidence/propose/add` | Ajustar confianza / disparar análisis / agregar manual | Solo `approve`/`reject` en dashboard |
  | `task run --explain/--clarify` | Explicar sin ejecutar / clarificar antes de correr | Sin equivalente |
  | `detect`, `index` | Detección de stack + indexado del grafo de código | 100% CLI |
  | `config init/show` | Gestión de routing de modelos por proyecto | 100% CLI |
  | `task init` | Bootstrap de `tasks.yaml` | 100% CLI (razonable — es setup único) |
  | `context suggest <task>` | Sugerencia de archivos relevantes vía embeddings (S24) | Sin botón en dashboard — la feature de embeddings no tiene superficie propia |
  | `memory conflicts` | Listar conflictos de memoria sin resolver (S26) | Sin endpoint ni pantalla — ni siquiera de solo lectura |
  | `runs --analyze` | Aprendizaje continuo manual (S30) | Solo automático vía hook, sin botón manual |

  **Corregido del hallazgo original**: `skill build` — tiene endpoint real, `/api/skills/:id/build` (server.ts, confirmado). Pendiente verificar si la pantalla Skills tiene un botón que lo dispare para una skill YA editada localmente (gap de wiring de UI, no de endpoint) — no se asumió, queda como sub-ítem de E.2.
- [x] E.2 🧠 Decisión de alcance (2026-07-06, sesión con tiempo acotado antes de cambiar de proyecto): de los 9 gaps, se cerraron los 2 más chicos y de menor riesgo hoy mismo — `memory conflicts` (E.3) y `runs --analyze` (E.4). Los 7 restantes quedan documentados como pendientes explícitos, no perdidos: `spec approve/lint/archive/create`, `instinct set-confidence/propose/add`, `task run --explain/--clarify`, `detect`/`index`, `config init/show`, `context suggest` (embeddings S24). Candidatos para la próxima sesión, en ese orden por tamaño.
- [x] E.3 ⚡ `GET /api/memory/conflicts` — reusa `listConflicts()` ya existente. Panel en pantalla Memory (banner con conteo + lista `relation`/fecha/confianza cuando hay conflictos sin resolver). Verificado en vivo: 5 conflictos reales en la DB, panel legible tras corregir un bug de CSS (`.kv`/`.k`/`.v` no tenían estilo fuera de `.detail`/`.settings-card` — reemplazado por flex inline). 0 filas de test dejadas en `memory_conflicts` (afterAll limpia).
- [x] E.4 ⚡ `POST /api/runs/analyze` — mismo llamado real (S30, `analyzeRunPatterns`) que la CLI, antes solo disparable por hook automático. Botón "Analyze patterns" en Runs, panel de resultados inline (sin `alert()`, respeta IDEAS #18). Verificado en vivo con dinero real: 8 runs reales (todos `failed`) → "No recurring patterns detected." — comportamiento correcto, sin alucinar un patrón donde no lo hay.
- [x] E.5 ⚡ `spec approve/lint/archive/create` (2026-07-07) — `POST /api/specs/:id/approve`, `GET /api/specs/:id/lint`, `POST /api/specs/:id/archive`, `POST /api/specs/:id` (create shell). Botones Aprobar/Lint/Archivar en el detail row de la pantalla Specs. Verificado en vivo: spec de prueba mostró 2 lint findings, botones operativos.
- [x] E.6 ⚡ `instinct set-confidence/propose/add` (2026-07-07) — `POST /api/instincts/:id/confidence` (slider con debounce 600ms), `POST /api/instincts/propose` (confidence 0.6/auto/unverified), fix `handleApiInstinctsCreate` a MANUAL_DEFAULTS (confidence 1.0/manual/verified). Botón "Proponer" en header. Fix bonus: UNIQUE INDEX en `instincts.trigger` — cortaba bug de 146 proposals duplicados por race condition en post-run hook. Verificado en vivo: botón Proponer visible, slider de confidence presente. Estilos pendientes → IDEAS #23.
- [x] E.7 🔍 `task run --explain` y `task run --clarify` (2026-07-07, verificado en vivo) — `GET /api/tasks/:id/explain` devuelve JSON con model/executor/input/checks/constitution. `POST /api/tasks/:id/run` extendido con campo `clarification`. SidePanel: textarea clarificación + botón "Ejecutar con clarificación" + botón "Explain" con resultado inline estilizado. Bonus: todos los `alert()`/`prompt()` del dashboard reemplazados por `showToast()` + `Modal.openPropose()`. CSS propio para textarea y explain card. 629 tests · 0 fail. Gate en vivo: proceso de dashboard en :4242 estaba corriendo con código previo al commit — reiniciado. Click en "Explain" sobre `s21-6-integrate-resolvers` (tarea real done) → `GET /api/tasks/:id/explain` 200 OK, card inline con model/executor/input/checks reales. Tarea desechable `zzz-disposable-e7-clarify-check` con clarificación real vía UI → `POST /api/tasks/:id/run` 200 OK; el dashboard usa sandbox worktree por defecto (sin override), que rechazó el working tree sucio (tasks.yaml modificado) — comportamiento correcto, no bug. Completado el ciclo real vía CLI (`--sandbox cwd`, mismo patrón de gates anteriores): la tarea corrió, QA pass, archivo generado con el contenido correcto. `tasks.yaml` restaurado desde backup, output de prueba borrado, fila de `runs` eliminada — `git status` limpio al cerrar.
- [x] E.8 ⚡ `detect [path]` e `index [path]` (2026-07-07, verificado en vivo) — `POST /api/project/detect` (regenera AGENTS.md + context.json) y `POST /api/project/index` (indexa code graph, S21) sobre el proyecto actual. Refactor de reuso: `buildProfile()` — antes función privada duplicada en `cli.ts` — extraída a `src/detect/profile.ts`, importada tanto por `cli.ts` como por el handler nuevo (mismo patrón que ya pedía [[feedback-dashboard-no-solo-cli]], evita divergencia entre CLI y dashboard). Botones "Detect stack"/"Index code graph" en el tab "Compressed context" de Project. **Hallazgo real al verificar en vivo**: el botón "Detect stack" sobreescribió el `AGENTS.md` real del propio repo (reglas de git-config-prohibido incluidas) con un resumen genérico auto-generado — mismo comportamiento que ya tenía `orchestos detect` en CLI, pero exponerlo como botón de un clic en el dashboard sube el riesgo de pérdida accidental. Restaurado con `git checkout` (no llegó a commitearse). Fix: `confirm()` antes de ejecutar (mismo patrón ya usado para delete task/graph run/reset), con mensaje explícito de qué se pierde. Verificado en vivo: cancelar el confirm no toca `AGENTS.md`; aceptar corre `POST /api/project/detect` 200 OK. `POST /api/project/index` verificado con dinero real: 214 files, 759 edges indexados. 629 tests · 0 fail · `tsc --noEmit` limpio. Sin rastro: `AGENTS.md`/`context.json` restaurados al estado real del repo tras la verificación.
- [ ] E.9 ⚡ `config init/show` — endpoint + panel de configuración de modelos en dashboard. Pendiente.
- [ ] E.10 🧠 `context suggest` — embeddings S24, el más complejo. Depende de que embeddings funcionen end-to-end. Pendiente.

### Cierre del mes
- [ ] H.1 🧠 Cierre formal (4 acciones obligatorias — [[feedback-orden-desarrollo]]) + aplicar la regla IDEAS→PLAN→DONE en el cierre. **NO se puede cerrar el mes mientras B.1.b siga en espera de evidencia** (decisión explícita de Carlos, 2026-07-05) — el mes queda abierto indefinidamente hasta que haya datos suficientes, no es un backlog que se pueda dar por bueno sin resolver.

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Mes 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Mes 14/Mes 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Mes 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Mes 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---
