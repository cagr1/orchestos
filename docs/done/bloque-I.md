# Bloque I — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="bloque-i-i-1"></a>
### I.1 — 🧠 Matar la puerta manual: el chat es la única entrada.
 (cerrado 2026-09-04)
  Quitar de la pantalla principal la barra "Crear tarea" (`chat.createTask` /
  `chat.createTaskHint`, `src/dashboard/public/i18n.js:1006-1007`) y el draft manual con sus
  campos de engine/modelo/`cli_effort`. **El draft no se borra del sistema**: se mueve a la
  superficie de inspección técnica (I.6), donde tiene un usuario legítimo que no es el usuario
  final sino el desarrollador — reproducir un bug con parámetros exactos, correr un eval, forzar
  un engine. Hoy ese uso ya vive además en `scripts/eval-run.ts` y `/api/tasks`, que no se tocan.

  Criterio de cierre, no negociable: si después de este ítem sigue existiendo un camino para
  crear una tarea a mano desde la pantalla principal, el ítem **no está cerrado** — es la
  condición que las tres decisiones anteriores nunca tuvieron.

  **Corrección de alcance en vivo (2026-09-04, decisión de Carlos con captura de Orca):**
  "Tasks" como vista (la lista de tareas) queda **anclado** en el nav, igual que Orca ancla su
  propia pantalla "Tasks" — se le quitó `operator: true` (`app.js:129`), ya no depende de modo
  avanzado. Lo que se mata es la barra manual embebida en Chat (`chat-create-task-bar` +
  listener + `chat.createTask`/`chat.createTaskHint`), no el acceso a Tasks en sí. El resto de
  items del nav (`project`, `instincts`, `runs`, `graph`, `memory`, `specs`) siguen `operator`,
  son "de observación" y quedan fuera de este ítem — pueden reubicarse después.

  **Implementación:** `screens-core.js` — removida la barra + su listener; `st.chatTaskSuggestion`
  (clasificador B.1.b) se deja sin consumidor a propósito, I.2 define el reemplazo real. `i18n.js`
  y `screens.css` — claves/CSS muertos removidos. Backend (`/api/chat/task-bar-click`, gate
  histórico de Sprint 18) no se tocó — fuera de alcance declarado, front-end only.

  **Gate en vivo:** sin navegador/browser interactivo — dashboard real levantado con
  `ORCHESTOS_HOME` temporal (`bun run src/cli.ts dashboard`) y verificado vía `curl` contra
  `/app.js` y `/screens-core.js`, el mismo bundle que serviría a un navegador: confirma `tasks`
  sin `operator:true` y cero referencias a `chat-create-task` en el bundle servido en vivo.
  `tsc --noEmit` limpio, `bun run test:coverage` 1265/1265 verde. Servidor bajado al terminar
  ([[feedback-siempre-cerrar-servidor]]).

<a id="bloque-i-i-2"></a>
### I.2 — 🧠 El punto de confirmación: lo único que reemplaza la fricción que se quita.
 (cerrado 2026-09-04)
  Al sacar el draft se pierde el único momento en que el usuario puede decir "no" antes de que un
  agente escriba en su repo, y eso **no puede quedar sin reemplazo**. `classifyTaskIntent` es un
  clasificador: tiene falsos positivos por definición. El precedente propio está en § E.14 — la
  **tarea fantasma**, donde el chat respondió "Started task X" sobre una tarea que nunca se creó
  ni corrió, porque el system prompt daba la creación por hecha sin verificarla. Automatizar más
  sobre un clasificador falible sin punto de "no" multiplica esa clase de fallo.

  El reemplazo NO es un formulario: es una línea inline en el hilo, antes de ejecutar —
  *"Voy a tocar 3 archivos en `src/auth/` · [Ver] [Cancelar]"*.

  **Decisión de producto pendiente, a resolver con Carlos DENTRO del ítem** (por eso es 🧠 y no
  ⚡): ¿se confirma siempre, o solo cuando la tarea toca archivos **existentes** y se ejecuta
  directo cuando solo crea archivos nuevos? Recomendación: la segunda. No se elige por
  conveniencia del implementador.

  **Lo que NO se toca:** `sessionAllowsTaskExecution()` (`src/db/chat-sessions.ts:152`), comentado
  en el código como *"hard read-only boundary"* y verificado en vivo en el gate CC.1-D1 — está en
  la DB la evidencia de que rechazó dos intentos reales de prompt injection ("create injected.txt
  PWNED"). Chat mode vs Code mode **no es ruido de UI, es una frontera de seguridad real**
  (INS-2026-014: el límite de un tool no puede ser el prompt). Se vuelve **invisible**, no se
  elimina: el modo deja de ser un selector que el usuario debe entender y pasa a derivarse del
  contexto — sesión sin proyecto asociado = read-only, siempre.

  **Decisión de producto (2026-09-04, con Carlos):** solo se confirma si la tarea toca archivos
  **existentes** — si solo crea archivos nuevos, se ejecuta directo (recomendación del ítem).

  **Implementación (`chat.ts`):** antes de `spawnTaskRun`, se filtran `draft.output` contra
  `existsSync(join(root, f))`. Si hay coincidencias, `createTaskRecord` igual se llama (la tarea
  queda `pending` en `tasks.yaml`, visible/corrible desde Tasks — anclado desde I.1) pero
  `spawnTaskRun` **no** se llama — `autoTask = { id, held: true, existingFiles }`. El system prompt
  (`autoTaskInstruction`) y `autoTaskNote` ganan una rama nueva para este caso: el LLM nunca dice
  "Started task", dice que quedó esperando confirmación. Front (`screens-core.js`): el mensaje del
  chat guarda `pendingTask` (no `taskId` — eso sigue reservado a tareas realmente en vuelo, para no
  activar `startStepPolling` sobre una tarea que no corrió) y `renderConfirmCard()` dibuja la línea
  inline *"Voy a tocar N archivo(s) existente(s) en `dir/` · [Ver] [Cancelar]"*. **[Ver]** reusa el
  mismo camino que el chip de tarea existente (`App.go('tasks')` + `SidePanel.openTask()`).
  **[Cancelar]** hace `DELETE /api/tasks/:id` (endpoint ya existía) y oculta la tarjeta — no hay
  "descartar sin borrar" porque la tarea nunca llegó a correr.

  **Lo que NO se implementó (con razón, no por omisión):** el "modo invisible" de Chat/Code de más
  arriba. Verificado en vivo: hoy no existe NINGÚN selector de `mode` en el frontend — el front
  nunca manda `sessionId` a `/api/chat` (eso es I.4, ver PLAN.md I.0), así que `session` es siempre
  `null` server-side y `sessionAllowsTaskExecution(null)` ya devuelve `true` por diseño. No hay
  selector visible que ocultar todavía; la instrucción de "derivar del contexto" queda como
  restricción de diseño para cuando I.4 exponga sesiones reales, no como deuda de este ítem.

  **Evidencia:** `tsc --noEmit` limpio, `bun run test:coverage` 1265/1265 verde (sin test nuevo
  dedicado al flujo HTTP completo: `classifyTaskIntent` llama a OpenRouter de verdad y
  `chat-effort.test.ts` ya documenta por qué mockear `fetch` alrededor de `handleApiChat` es racy
  en esta suite — mismo motivo por el que D.7 tampoco tiene ese test hoy).

  **Gate en vivo:** sin navegador/browser interactivo — dashboard real levantado con
  `ORCHESTOS_HOME` temporal (`bun run src/cli.ts dashboard`) y verificado vía `curl` contra
  `/screens-core.js` e `/i18n.js`: confirma `renderConfirmCard`, los listeners
  `confirm-view`/`confirm-cancel` y las claves `chat.confirm.*` presentes en el bundle servido
  en vivo. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).

<a id="bloque-i-i-3"></a>
### I.3 — 🧠 Task inteligente: saber DÓNDE corre, por tarea y no global.
 (cerrado 2026-09-04)
  El requisito nuevo de Carlos. Hoy el agente es una preferencia **global** de Settings
  (`screens-ops.js:1666`) y el select de engine del draft ni siquiera ofrece `codex`
  (`screens-core.js:1107-1112`). Con varios proyectos y varios CLIs eso deja de servir: la
  asignación agente+modelo+proyecto tiene que resolverse **por tarea**, que es justo lo que el
  DAG mixto Claude/Codex del dogfooding necesita y hoy no puede expresar.

  Se implementa como **resolución declarativa**, jamás inferida por un LLM (ver la línea
  no-negociable arriba): reglas persistentes de proyecto → preferencia de sesión → cascada E.16
  como último recurso. El resultado se **persiste en la tarea** (`engine`/`model`/`cli_effort`,
  que ya existen en `src/tasks/schema.ts:22-45`) para que el run sea reproducible y comparable —
  sin eso, H.5.3 no puede comparar dos corridas.

  Depende del backend de H.8 ya hecho (`CLI_EFFORT_LEVELS`, validación de `codex + minimal` /
  rechazo de `codex + max` en `/api/tasks`). Ese trabajo **no se tira**: es exactamente lo que
  este ítem consume.

  **Marco acordado con Carlos antes de codear (2026-09-04):** este ítem NO es "el chat cambia de
  CLI a mitad de conversación" — eso no lo hace ninguna herramienta seria (Cursor, Continue,
  Aider, Copilot, el propio Claude Code/Codex CLI: se elige el agente al abrir el hilo y se queda
  fijo). Es un eje distinto: cada TAREA del DAG (`tasks.yaml`) es una unidad de trabajo con inicio
  y fin, más parecida a un job de CI que a un turno de chat — puede resolver su propio agente sin
  que eso implique que el chat "cambie de identidad". Los roles (planner/executor_heavy/
  executor_light/qa de `OrcheConfig.models`) no cambian.

  **Diseño (decisión de implementación, no de producto — mecánica y reversible vía config):**
  `TaskAgentRule` nuevo en `config/schema.ts`: `{ match: { output?: string[], skill?: string },
  agent, cli_effort? }`. `output` matchea por glob contra `Task.output` (`Bun.Glob`, sin
  dependencia nueva); `skill` por id exacto. Si una tarea matchea ambos tipos, gana `output` por
  ser más específico; primera regla en orden de declaración que matchea, sin merge parcial.
  Se editan a mano en `orchestos.config.yaml` (`taskAgentRules:`, documentado en
  `scaffoldConfigYaml()`) — sin UI de edición todavía, deliberado, mismo criterio que `models.*`
  hoy (tampoco tienen UI de alta).

  **Implementación:**
  - `config/schema.ts` — `TaskAgentRule`, `OrcheConfig.taskAgentRules?`.
  - `config/load.ts` — `parseTaskAgentRules()`: descarta entradas mal formadas con aviso
    (`agent` inválido, `match` vacío), nunca rompe la carga del resto del config.
  - `router/engine-cascade.ts` — `resolveProjectAgentRule(rules, {output, skill})`, función pura.
  - `dashboard/handlers/chat.ts` (D.7) — `preferredAgent = projectRule?.agent ?? session?.agent
    ?? config.agent`, precediendo a `resolveAgentSelection`.
  - `dashboard/handlers/tasks.ts` (`handleApiTasksCreate`) — mismo principio, acotado a "ni
    `engine` NI `executor_model` vinieron explícitos" (el draft de Tasks SIEMPRE manda un
    `executor_model`, aunque el usuario no lo haya tocado — pisarlo dejaría `engine` y
    `executor_model` contradiciéndose).

  **Gap conocido, no resuelto acá (documentado, no escondido):** el draft de `SCREENS.tasks` no
  pre-llena su selector de engine/modelo con lo que una regla resolvería — sigue mostrando
  "inherit" + el modelo por defecto. Arreglarlo requiere que el front distinga "el usuario no
  tocó el selector" de "el usuario eligió el default explícitamente", cambio de UI separado, no
  de este ítem (el backend ya resuelve correctamente cuando el caller no manda nada, que es el
  caso real de D.7 y de cualquier creación programática/API).

  **Evidencia:** `tsc --noEmit` limpio. Tests nuevos: `src/__tests__/task-agent-rules-config.test.ts`
  (parseo defensivo, 5 casos) y `describe('resolveProjectAgentRule()')` en
  `src/__tests__/engine-cascade.test.ts` (match por output, por skill, prioridad output>skill,
  sin match). `bun run test:coverage` 1275/1275 verde.

  **Gate en vivo:** sin navegador/browser interactivo — dashboard real levantado (`bun run
  src/cli.ts dashboard`, cwd = proyecto temporal con `orchestos.config.yaml` real conteniendo
  `taskAgentRules`) y ejercitado con `curl -X POST /api/tasks` (mutación real contra la API viva,
  no un mock): `output: ["apps/api/foo.ts"]` sin engine/executor_model → tasks.yaml quedó con
  `engine: codex, executor_model: openai/gpt-5.4` (matchea la regla); `output: ["demo/x.ts"]` sin
  match → cayó a `agent: claude` del config (`engine: external, executor_model:
  anthropic/claude-sonnet-5`); `engine: "single-shot"` explícito → se respetó tal cual, sin
  inyectar executor_model. Los 3 casos de la cadena de precedencia verificados end-to-end.
  Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).

<a id="bloque-i-i-4"></a>
### I.4 — ⚡ El chat se guarda entero (absorbe H.9.1, mismo archivo).
 (cerrado 2026-09-05)
  Idéntico alcance al que tenía H.9.1, ejecutado aquí para no tocar el front dos veces:
  1. El front manda `sessionId` en `/api/chat` (`screens-core.js:592-613`), creando la sesión al
     vuelo si no hay ninguna. `st.chatHistory` deja de ser la fuente de verdad.
  2. `runs.result` deja de guardarse vacío para `task_class='chat'` — hoy se persiste el prompt
     del usuario y **nunca la respuesta** (medido: los dos chats reales del 2026-09-03 tienen
     `result` vacío).
  3. **Qué archivos leyó el CLI** — los eventos de tool ya vienen en el stream JSON que
     `runClaudeCode` (`external.ts:201-226`) parsea y descarta. Sin este campo, el gate de H.9.4
     no tiene contra qué afirmar: se le estaría preguntando al modelo si respetó la regla, en vez
     de cruzarlo contra lo que realmente leyó (INS-2026-001 — artefacto verificable en el punto de
     decisión, no prosa).

  Contexto de por qué esto estaba roto: `chat_sessions`/`chat_messages` existen completos desde
  CC.2 y el front nunca los usó — `chat_messages` tiene 12 filas, **todas del 2026-08-19**,
  sembradas por curl en un gate. Backend construido, superficie nunca cableada
  ([[feedback-dashboard-no-solo-cli]]).

  **Puntos 1-3 (sesión sin commitear de 2026-09-04, retomada y verificada 2026-09-05):** una
  sesión anterior quedó cortada a mitad de este ítem (scope-lock declarado en
  `.orchestos/handoff.md`, cambios sin commitear). Se revisó completo antes de continuar
  (`tsc`/suite en verde con esos cambios aplicados) — trabajo real, no descartado:
  - `app.js`/`screens-core.js` — `ensureChatSession()` crea la sesión al vuelo, `send()` manda
    `sessionId` y `history: []`; `chat.ts:634-639` ya prioriza `listChatMessages(session.id)` sobre
    `body.history` cuando hay sesión.
  - `chat.ts` (`logChatRun`) — `runs.result` ahora guarda `responseText` real, no `null`.
  - `db/migrate.ts`/`db/runs.ts` — columna `files_read` nueva; `external.ts`/`step-event.ts` —
    `claudeEventToReadPaths()` extrae los `Read` reales del stream de Claude Code CLI (con test).
    Codex/OpenCode mandan `[]` a propósito — esos executors no reportan lecturas todavía.

  **Hallazgo en vivo de Carlos (2026-09-05), corregido dentro de este mismo ítem:** con la
  conversación ya persistida de verdad, el botón "Clear" (borraba solo el array en memoria, sin
  tocar la sesión en DB) pasó de inofensivo a **engañoso** — recargar la página traía de vuelta la
  conversación "borrada". El patrón correcto, señalado por Carlos y confirmado contra Claude
  Desktop/Codex/Orca/Hermes/ChatGPT: lista de conversaciones en un **aside**, cada una borrable
  desde ahí, "nueva conversación" como acción separada — nunca un botón que vacía el hilo activo.
  Decisión explícita de Carlos: resolverlo bien ahora (no parche temporal), sin invertir en pulido
  visual todavía (`"el UI tiene que evolucionar, no lo veo como herramienta premium aún"` — eso es
  I.5). Implementado:
  - `db/chat-sessions.ts` — `listChatSessions(projectId?)` filtra por proyecto activo (`p1`/`p2`/
    `null` para sesiones generales; sin argumento, todo — compat hacia atrás). `appendChatExchange`
    pone el título de la sesión desde el primer mensaje del usuario (una sola vez, trunca a 60
    con `…`) — antes quedaba "New conversation" para siempre, inútil en una lista de N.
  - `dashboard/handlers/chat-sessions.ts` + `server.ts` — `GET /api/chat/sessions` filtra por el
    proyecto resuelto de la request.
  - `app.js` — `fetchChatSessions()`, `switchChatSession()`, `startNewChatSession()`,
    `deleteChatSession()` (con `Modal.confirm()`, nunca `confirm()` nativo).
  - `screens-core.js`/`screens.css` — aside `.chat-sessions-aside` a la izquierda del chat
    (`.chat-layout` envuelve aside + `.chat-main`), botón "Nueva conversación" arriba, borrar por
    ítem con hover. Botón "Clear" y sus i18n (`chat.clear`) eliminados por completo.

  **Evidencia:** `tsc --noEmit` limpio. `src/dashboard/__tests__/chat-sessions.test.ts` — fix al
  test existente (el listado ahora exige contexto de proyecto, se pasó el header) + test nuevo
  (`listChatSessions()` filtra p1/p2/general, título del primer mensaje, no se pisa en el segundo
  intercambio, truncado a 60 con `…`). `bun run test:coverage` 1277/1277 verde.

  **Gate en vivo:** sin navegador/browser interactivo — dashboard real levantado (`bun run
  src/cli.ts dashboard`, proyecto temporal) y ejercitado con `curl` contra la API viva: `GET
  /api/chat/sessions` arrancó `[]`; 2× `POST` crearon sesiones reales (`projectId: null`, sesión
  general — no estaba registrado como proyecto conectado); el listado las mostró a ambas; `DELETE`
  de una la sacó del listado real. `curl` a `/screens-core.js` y `/app.js` confirmó el aside, los
  3 handlers nuevos y cero referencias a `chat-clear` en el bundle servido. Servidor bajado al
  terminar ([[feedback-siempre-cerrar-servidor]]).
