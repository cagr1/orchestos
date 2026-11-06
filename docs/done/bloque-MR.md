# Bloque MR — evidencia de cierre

<a id="plan-orden-mr-1"></a>
- [x] **MR.1 — 🧠 Model routing por rol con CLI: Orquestador, Ejecutor, Revisor y Auxiliar; cero modelos hardcodeados.** (abierto 2026-09-24, GO de Carlos a los 4 roles; va antes de UI.13.7; absorbe AT.10 y AT.13; cerrado 2026-09-28)
  Sin delegación: cierre de padre, el trabajo está en sus sub-ítems.
  **Por qué (verificado en el código 2026-09-24):** hay dos sistemas que nunca se tocan. Settings → Model routing
  (`OrchestSettingsView.tsx:1256-1372`) asigna roles `planner`/`executor_heavy`/`executor_light`/`default` a modelos
  de API, con el combobox alimentado por `/api/chat/models` = 458 modelos solo de OpenRouter; defaults
  `deepseek-v4-flash` (`src/config/schema.ts:110`). Los CLI (`/api/chat/cli-models`: Claude/Codex/OpenCode) solo los
  usa el composer del chat; la ejecución elige CLI por `agent`, `taskAgentRules` (solo YAML, `schema.ts:44`) y
  `engine` por tarea. `getProvider` (`src/providers/index.ts:19-31`) no tiene Claude CLI; el `codex` de
  `providers/codex.ts` ignora modelo y sandbox. La tarjeta "QA judge" es texto fijo "auto (dual gate)".
  **Hardcodes a eliminar:** `QA_JUDGE_DEFAULTS` (`harness.ts:172`, juez `gpt-4o-mini`: causa del `runs-graph`
  intermitente, reformula criterios y R.3 lo rechaza en `qa.ts:258`), `agents/diagnose.ts:166` y
  `memory/judge.ts:118` (`claude-haiku-4-5` vía OpenRouter), `spec/draft.ts:177` (`deepseek-r1`).
  **Diseño aprobado:** 4 roles globales, cada uno `{agente: claude|codex|opencode|api, modelo, esfuerzo}`:
  Orquestador (cerebro del chat, `agents/planner.ts`, `spec/draft.ts`), Ejecutor (`runTask`), Revisor (QA + adversarial
  + refuter, solo lectura), Auxiliar (diagnose, juez de memoria; solo lectura). `executor_light` desaparece: la
  especialización por tarea va en `taskAgentRules` (ruta/skill → agente), que recibe UI en este ítem. Un catálogo
  único (CLI detectados + sus modelos + OpenRouter) para chat, routing, reglas y QA. Un solo punto de ejecución por rol
  que lanza el CLI o la API. Rol sin asignar = "sin asignar" en la UI y error claro; nunca un default elegido por
  OrchestOS. Revisor = mismo agente+modelo que Ejecutor → aviso de errores correlacionados, no bloqueo.
  **Plan (sub-ítems, un spec por sub-ítem, ejecuta Luna):** MR.1.a config + migración (`models.*` viejos → roles
  nuevos con `agente: api`; `executor_heavy`→Ejecutor, `planner`→Orquestador) y catálogo único; MR.1.b ejecución por
  rol (Claude/Codex/OpenCode/API, sandbox solo lectura para Revisor/Auxiliar) y borrar los 4 hardcodes; MR.1.c UI de
  Model routing (4 filas agente+modelo+esfuerzo con valor real) + UI de `taskAgentRules`; MR.1.d AT.10/AT.13 (el chat
  usa el Orquestador/CLI elegido sin caída a OpenRouter; contexto veraz). Gate: `runs-graph` 5/5 con el Revisor
  configurado por UI; flujo nuevo `model-routing` que cambia cada rol clickeando y afirma el modelo registrado en el run.
  - [x] **MR.1.a — ⚡ Config de 4 roles + migración en memoria + catálogo único `GET /api/models/catalog`.**
    (abierto y cerrado 2026-09-24; spec `docs/specs/MR.1.a.md`; no cambia ejecución ni UI — eso es MR.1.b/c)
    Hecho: `roles.{orchestrator,executor,reviewer,auxiliary}` `{agent,model,effort?,provider?}`; migración en memoria
    `planner→orchestrator`, `executor_heavy→executor`, `qa→reviewer` (auxiliary sin origen); `resolveRole` lanza
    `RoleUnassignedError` (sin consumidores hasta MR.1.b); GET/PUT `roleAssignments` + `roleWarnings`; catálogo
    único claude/codex/opencode/api (OpenRouter caído → `error`, no 502). `null` se persiste explícito: con
    `deleteIn` el loader re-migraba desde `models.*` y un rol legacy no se podía desasignar (hallado en el gate en
    vivo, ronda 2; el fixture de Luna no tenía origen legacy).
    Gate en vivo (dashboard real, sin navegador — MR.1.a no tiene UI; la UI y su gate en navegador son MR.1.c): proyecto
    temporal con copia del `orchestos.config.yaml` del repo; GET migra los 3 roles a `api`; PUT `executor` codex +
    `orchestrator: null` → YAML con `roles:`, `models:`/`agent:` intactos; tras reiniciar el dashboard, GET devuelve
    `orchestrator: None`, `executor` codex; mismo agent+modelo en reviewer → `reviewer-same-as-executor`; agent
    inválido → 400; `/api/models/catalog` → claude 9, codex 9, opencode 393, api 460 modelos. `test:coverage`
    1540/0 (75.03%/62.20%). Ejecutado por: luna (2 rondas) · Spec: docs/specs/MR.1.a.md
    Hallazgo de proceso: `agent:preflight` solo reconoce ítems de primer nivel (`findOpenPlanItem`,
    `scripts/agent-governance.ts`); los sub-ítems se ejecutan con `--item <padre>` — anotado en el spec.
    Commit con `--no-verify` autorizado por Carlos (2026-09-24) solo para MR.1.a y MR.1.b: `agent:live-gate` exige
    cerrar un ítem de primer nivel con gate en navegador y estos sub-ítems no tienen UI; tsc, secretos y
    `plan:render` pasaron a mano. El gate en navegador se hace en MR.1.c, que cierra MR.1.
  - [x] **MR.1.b — ⚡ Ejecución por rol + borrar los modelos hardcodeados.** (abierto 2026-09-24; reabierto: ui:gate rojo;
    cerrado 2026-09-25)
    Ejecutado por: luna (8 rondas) · Spec: docs/specs/MR.1.b.md (borrado al cerrar)
    Hecho: `router/role-runner.ts` (`roleClient`/`clientFromAssignment`: api → provider;
    claude/codex/opencode → sus runners de chat de solo lectura); `autoRoute` = `task.executor_model` o
    `roles.executor` (sin clases ni `executor_light`); engine del Ejecutor por `roles.executor.agent` (el `agent`
    top-level queda solo para el chat, MR.1.d); esfuerzo del rol → `ctx.cliEffort`; Revisor resuelto antes de gastar
    (QA, adversarial y refuter); Auxiliar en diagnose, judge, analyze-patterns y skills curate/import; Orquestador en
    draft, auto-split y setup de proyecto. Borrados `MODEL_MAP`/`resolveModel`, `QA_JUDGE_DEFAULTS`, los haiku/r1
    hardcodeados y `DEFAULT_CONFIG.models`. Quedan dos hardcodes del chat (`chat/classify-task-intent.ts:33`,
    `handlers/chat.ts:1199`) → MR.1.d.
    Decisión de Carlos (2026-09-24): con `agent` legacy = CLI, `executor` **no** migra desde `models.executor_heavy`
    (sin asignar; migrar cambiaba de CLI a API en silencio). Config del repo: `executor` codex gpt-6-luna medium,
    `auxiliary` codex gpt-5.6-luna (elegidos por Carlos).
    Gate en vivo (CLI real, proyecto temporal, sin navegador — sin UI en este sub-ítem): `config show` lista los 4
    roles; sin Revisor la tarea falla con `Rol 'reviewer' sin asignar…` sin lanzar el Ejecutor; con Revisor, Codex
    corre `gpt-6-luna` y el engine lo rechaza después de gastar (`not in the pricing catalog`) → ver MR.1.b2.
    `test:coverage` 1537/0 (75.20%/62.34%). Ejecutado por: luna (2 rondas; la 1 dejó 25 fallos en la suite completa y
    un modelo `'mock'` en producción en `skills.ts`) · Spec: docs/specs/MR.1.b.md
    **Reabierto (pre-push, ui:gate real):** rondas 3-5 dan roles a los flujos (`writeGateRoles`, `ui-gate/lib.mjs`) y
    arreglan MR.1.b2. Quedan rojos: `tasks`/`runs-graph` (Revisor codex gpt-6-luna → `QA criterion results must match
    the original text and order exactly`, R.3 `qa.ts:229`: el juez reescribe el texto del criterio, mismo síntoma que
    tenía gpt-4o-mini) y `chat-turn-details` (2/2: la segunda tarjeta retenida no aparece; el bot contesta "Voy a
    comprobar…"). Verde: smoke, plan-doc, project-delete, usage-bar, text-sweep, project-tabs 23/23.
    **Cierre (rondas 6-8, 2026-09-25):** R.3 por decisión de Carlos (normalizar): `qa.ts` compara por posición, el
    resultado guarda siempre el texto original y `normalizeCriterionText` solo iguala comillas tipográficas, `\"` y
    espacios; si difiere en algo más sigue fallando y el `reason` incluye el texto crudo del juez. `chat-turn-details`
    no era de roles: (a) la ronda 4 borró el import de `readFileSync` del flujo; (b) `classify-task-intent.ts` con
    `maxTokens: 150` cortaba la respuesta de `deepseek-v4-flash` (razona antes, 101-154 tokens) → `isTask:false` en
    ~1 de cada 2-4 mensajes, sin error visible; subido a 1000 (sondeo 4/4). En `eee0401` el flujo pasó por suerte.
    Criterios de fixture con doble punto (`"Gate ran.".`) reescritos a `README.md contains the line: …`.
    Gate en vivo: navegador real (Playwright, `bun run ui:gate`): `tasks` 13/13, `runs-graph` 16/16,
    `chat-turn-details` 26/26 (Codex · `gpt-6-luna` · medium en los 4 roles). `test:coverage` en el cierre.
  - [x] **MR.1.b2 — 🧠 Codex como Ejecutor con id nativo (`gpt-6-luna`) no puede completar tareas.** (hallado en el gate
    de MR.1.b, 2026-09-24; antecede a MR.1: BB.6/F0.8) El engine exige que el modelo esté en el catálogo de precios de
    OpenRouter (`executors/codex.ts:404`) y lo comprueba **después** de correr; los ids nativos de Codex no están → la
    tarea falla tras gastar. El chat de Codex, en cambio, registra `$0` si falta el precio (`codex.ts` `runCodexChat`),
    lo que F0.8 prohíbe. Hecho (ronda 3): `codexPricingId` tarifa ids nativos como `openai/<id>` (engine y chat) y el
    chequeo de catálogo del engine corre antes de spawnear. El `$0` del chat cuando no hay precio sigue abierto.
  - [x] **MR.1.c — ⚡ UI de Model routing (4 roles agente+modelo+esfuerzo) + UI de `taskAgentRules`.** (abierto y
    cerrado 2026-09-25)
    Ejecutado por: luna (7 rondas) · Spec: docs/specs/MR.1.c.md (borrado al cerrar)
    Decisiones de Carlos (2026-09-25): grilla 2×2 actual con 3 campos por
    tarjeta; borrar la tarjeta "QA judge"; el plegable "Task → Model Mappings" (con `Claude 3.7 Sonnet` inventado)
    se reemplaza por las reglas. Gate: flujo nuevo `model-routing` (roles y reglas por clicks, persisten tras recargar,
    el run registra el modelo y el `qa_model` puestos por UI) + los 9 ui:gate verdes.
    Hecho: GET/PUT `/api/config` con `taskAgentRules` validadas; tarjetas con agente/modelo/esfuerzo del catálogo
    único (etiquetas y nombres legibles, mismos menús que el combobox, sin `<select>` nativo); aviso Revisor =
    Ejecutor; reglas con orden = prioridad; Settings lee **y escribe** en el proyecto activo
    (`x-orchestos-project-id`) — antes el guardado iba a la raíz del servidor y la ronda 1 llegó a escribir en el
    `orchestos.config.yaml` del repo (restaurado; hermano en `handleSaveExecutor` arreglado).
    Gate en vivo: navegador real (Playwright, `bun run ui:gate`), `docs/done/evidence/MR.1.c-live.json`: `model-routing` 8/8 — roles y regla puestos por
    clicks, visibles tras recargar, y la tarea corre con Ejecutor y Revisor `gpt-6-luna` elegidos en la UI (`done`,
    QA pass); los otros 9 flujos verdes (`usage-bar` intermitente: "No quota limits reported" en 1 de 2, → CI.2).
    `test:coverage` 1545/0 (75.41%/62.45%).
    Aprendido: Luna sin `ORCHESTOS_ROLE=executor` y la frase "eres el ejecutor" intenta delegar en otro `codex exec`
    (falla en su sandbox); el preflight de Luna va con `--item MR.1` (no ve sub-ítems).
  - [x] **MR.1.d1 — ⚡ El chat y sus tareas usan los roles: Orquestador, Ejecutor y Auxiliar.** (abierto 2026-09-25, cerrado 2026-09-26;
    spec `docs/specs/MR.1.d1.md`) Decisiones de Carlos (2026-09-25): el chat arranca con el Orquestador y el picker
    del composer lo cambia por sesión (sin DeepSeek por defecto; sin rol → error claro); las tareas que crea el chat
    usan `taskAgentRules` → Ejecutor, no el agente del chat; clasificador de intención al Auxiliar. Incluye los
    modelos fijos de `resolveAgentSelection` (`engine-cascade.ts:138,142`), hermanos de los hardcodes de MR.1.b, y
    quitar los chips "Default agent" de Settings → Executor. Gate: flujo nuevo `chat-roles` + los 10 ui:gate.
    Gate en vivo: navegador real (Playwright, `bun run ui:gate`), `docs/done/evidence/MR.1.d1-live.json`: 11/11 flujos.
    Evidencia 2026-09-26: ui:gate 11/11 (`ui-gate-33033`: chat-roles 10/10, project-delete 11/11 ×6), `test:coverage`
    1540/0 (75.39 %/61.16 %), tsc back+app, `ui:fidelity:jsx`. Ronda 10 (cerebro): el rojo de chat-roles era del
    flujo (esperaba un texto que ya existía del turno 1 y enviaba con el composer ocupado → helper `sendTurn`); el 404
    de project-delete venía de `OrchestSettingsView.tsx:337` (petición de config lanzada antes del purge, respondida
    después) → abort en cleanup y al confirmar purge. Pendiente de Carlos: Auxiliar = Codex tarda 8-12 s por mensaje.
  - [x] **MR.1.d3 — ⚡ El Orquestador marca la intención de tarea: sin clasificador aparte.** (abierto 2026-09-26, cerrado 2026-09-26; pedido
    de Carlos: "quiero que la respuesta sea enseguida"; spec `docs/specs/MR.1.d3.md`) Medido: el clasificador con
    Auxiliar = Codex cuesta 5.5-6.4 s y 7,600 tokens por mensaje antes de responder, en Chat y Dev; el esfuerzo no
    influye. Decisión de Carlos 2026-09-26: el Orquestador pone `[[orchestos:task]]` en su respuesta (0 procesos
    extra), sin volver a API. Gate: tests + `chat-roles` sin Auxiliar + los 11 ui:gate + latencia antes/después.
    Ejecutado por: Codex · `gpt-6-luna` (1 ronda) · Spec: docs/specs/MR.1.d3.md (borrado al cerrar)
    Gate en vivo: navegador real (Playwright, `node scripts/ui-gate/run.mjs` ×11), `docs/done/evidence/MR.1.d3-live.json`: 11/11 flujos.
    Evidencia 2026-09-26: `chat-roles` 9/9 sin rol Auxiliar (tarea retenida creada por el marcador, marcador visible 0
    veces, `tasks.yaml` sin engine/modelo); `test:coverage` 1532/0 (75.45 %/61.20 %); tsc back+app; `ui:fidelity:jsx`.
    Latencia: turno normal 11.1 s envío→respuesta con Orquestador Codex `gpt-6-luna` medium, ya sin los 5.5-6.4 s del
    clasificador. Los 8 fallos que reportó Luna eran del sandbox (EADDRINUSE y gates de cierre sobre su árbol sin commit).
    Queda: el piso es el `codex exec` nuevo por turno del Orquestador (sin sesión persistente) → NEXT.md.
  - [x] **MR.1.d2 — 🧠 El contexto que el chat inyecta al CLI dice la verdad (AT.13).** (abierto 2026-09-25, cerrado 2026-09-27) Alcance =
    AT.13 puntos 1-8 (herramientas reales, `n/a` en costos desconocidos, tasks en una línea, motivo de QA, nombres de
    modelo normalizados, fechas con zona, índice de memoria/specs, sin prompts apilados) + `$0` del chat de Codex sin
    precio (resto de MR.1.b2). Carlos decidió el punto 8: esta pasada mide, el prompt base del CLI se reemplaza aparte.
    Ejecutado por: Codex · `gpt-6-luna` (5 rondas) + 3 ajustes del cerebro · Spec: docs/specs/MR.1.d2.md (borrado al cerrar)
    Gate en vivo: navegador real (Playwright), `docs/done/evidence/MR.1.d2-live.json`: 13/13 flujos, con el nuevo
    `chat-context` (turno real Codex gpt-6-luna + Claude haiku; aserciones sobre el prompt capturado por el servidor
    del gate, `ORCHESTOS_GATE_CAPTURE_DIR`) — herramientas reales por agente, `n/a` + "partial", task en una línea con
    motivo de QA, `codex · codex default`/`codex · gpt-6-luna`, `Now: … UTC-05:00`. `test:coverage` 1552/0
    (75.64 %/61.57 %); tsc back+app; biome limpio en lo tocado (2 errores previos ajenos en HEAD).
    Medición: el run de chat guarda `context_tokens`. Fixture chico: contexto de OrchestOS 635 tokens dentro de
    14,483 de input de Codex → ~96 % del input es el prompt base de Codex (dato para el reemplazo del prompt base).
    Claude reporta `input_tokens` 10 (excluye caché): no sirve para comparar. "Antes" no medido en el mismo turno.
    Hallazgos del gate: (1) "You cannot edit files" sin decir qué hacer hacía que haiku marcara tarea ante "Escribe
    los números…" (`chat-streaming` 2/4 vs 3/3 en HEAD) → la línea dice que el texto se responde en el chat (4/4);
    (2) pedirle al agente que copie su prompt era intermitente (Codex a veces se niega) → captura en el servidor.
  - [x] **MR.1.d4 — 🧠 El chat pinta la respuesta mientras se genera, para cualquier agente.** (abierto 2026-09-27, cerrado 2026-09-27, GO de
    Carlos; "mientras trabaja no sé qué está haciendo, pinta el texto que se va generando como en el CLI") Hoy el Chat
    hace un único `POST /api/chat` (`app/src/api/chat.ts:447`) y no pinta nada hasta el final (spinner mínimo
    `OrchestChatView.tsx:411`), aunque el backend ya recibe los pasos en vivo (`persistChatStep`, `chat.ts:942`).
    Capa GENÉRICA, no por CLI: buffer en memoria del turno activo (texto acumulado + razonamiento + herramientas) que
    alimenta cualquier adaptador vía `onChatStep`; endpoint que el Chat consulta cada ~300 ms mientras hay turno (mismo
    patrón que el polling 1 s de Dev, `OrchestDevWorkspace.tsx:157`); burbuja del asistente que crece en Chat y Dev en
    lugar del spinner; al terminar, el mensaje final como hoy. La DB no cambia. Claude CLI ya entrega deltas
    (`stream-json` + `--include-partial-messages`, `external.ts:141`), pero `claudeEventToStep` los descartaba
    (corregido 2026-09-27: shape `stream_event`/`text_delta` verificado en vivo; hay que mapearlo, spec
    `docs/specs/MR.1.d4.md`). Codex
    `exec` no emite deltas (medido): con d4 muestra razonamiento/herramientas al ocurrir; el texto en vivo es MR.1.d5.
    Fuera: adaptadores nuevos, OpenCode, API, ejecutor de tareas, MR.1.d2. Gate: tests del buffer/endpoint; flujo nuevo
    `chat-streaming` (texto visible ANTES de que el turno termine y creciendo, con Claude CLI); los 11 ui:gate; tiempo
    hasta el primer texto antes/después.
    Ejecutado por: Codex · `gpt-6-luna` (1 ronda) + ajustes del cerebro · Spec: docs/specs/MR.1.d4.md (borrado al cerrar)
    Gate en vivo: navegador real (Playwright), `docs/done/evidence/MR.1.d4-chat-streaming.json`: `chat-streaming` 8/8
    con Claude CLI haiku — Chat primer texto 3.0 s / fin 5.2 s (4 crecimientos; antes primer texto = fin), Dev 2.5 s /
    3.4 s; los 11 ui:gate verdes; `test:coverage` 1545/0 (75.47 %/61.15 %); tsc back+app; biome.
    Hallazgos del gate: (1) el flujo de Luna elegía Claude sin modelo → CLI default `fable`, que en esta cuenta responde
    "You're out of usage credits" de una pieza → el flujo fija `haiku` en el composer; (2) `text-sweep` leía la DB en
    cuanto veía la burbuja, que ahora aparece antes de persistir → espera el mensaje guardado; (3) `chat-live.ts`
    duplicaba `stripTaskMarker` → una sola definición. Con Codex el texto sigue llegando al final (MR.1.d5).
  - [x] **MR.1.d5 — 🧠 Adaptador `codex app-server`: texto en vivo con Codex y turnos siguientes ~2 s.** (abierto
    2026-09-27; GO de Carlos 2026-09-28, cerrado 2026-09-28) `codex app-server` = el mismo Codex como proceso
    persistente con JSON-RPC por stdio (`codex app-server generate-ts` da el protocolo); el binario lo marca
    "[experimental]" (el protocolo puede cambiar entre versiones). Emite `item/agentMessage/delta`. Sonda 2026-09-27:
    turno 1 primer texto 7.4 s / total 14.2 s (con config de usuario), turno 2 en el mismo thread 1.5 s / 2.2 s, vs 11.1 s
    hoy por turno. Requiere: thread por sesión de chat (id persistido, `thread/resume` tras reinicio), solo el mensaje
    nuevo por turno, sandbox read-only y CODEX_HOME aislado, caída visible a `codex exec` si falla, test contra el
    esquema generado. Descartado: `codex exec resume` (no más rápido, +16 K tokens por turno; NEXT.md).
    Hallazgo 2026-09-28 (lectura de `chat.ts:1057,1280,1508`): las ramas CLI del chat no mandan historial — cada turno
    de Claude/Codex/OpenCode es una conversación nueva. d5 lo arregla para Codex (thread); Claude/OpenCode, ítem aparte.
    Ejecutado por: luna (4 rondas; r2 se detuvo por fallos propios del sandbox) · Spec: docs/specs/MR.1.d5.md (borrado al cerrar)
    Hecho: `src/run/executors/codex-app-server.ts` (un proceso por CODEX_HOME, thread por sesión en
    `chat_sessions.codex_thread_id`, resume tras reinicio, thread vencido → uno nuevo con aviso visible, contexto
    reenviado solo si cambia fuera de la línea `Now:`); caída visible a `codex exec` solo por error de protocolo; errores
    de auth/turno → 502 sin caída. Apagado en `server.stop()`/SIGINT/SIGTERM.
    Gate en vivo: navegador real, `docs/done/evidence/MR.1.d5-live.json`: `codex-live` 6/6 — 6 textos distintos antes
    del final, turno 2 recuerda la palabra, 12 978 ms → 2 804 ms, `provider=codex`. `test:coverage` 1570/0.
    No verificado en vivo: memoria tras reiniciar el dashboard (el runner no reinicia; cubierto solo por test unitario).
