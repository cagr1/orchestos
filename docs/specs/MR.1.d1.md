# MR.1.d1 — El chat y sus tareas usan los roles: Orquestador, Ejecutor, Auxiliar

Decisiones de Carlos (2026-09-25): (1) el chat arranca con el rol Orquestador y el picker del composer lo cambia
explícitamente para esa sesión; sin Orquestador ni elección → error claro, nunca DeepSeek; (2) las tareas que el
chat crea solas: `taskAgentRules` si coincide, si no el Ejecutor — el agente del chat no decide quién ejecuta;
(3) este sub-ítem es routing; el contexto veraz (AT.13) es MR.1.d2. Fuera: ventana libre de OpenCode (parcada).
Preflight de Luna: `--item MR.1`.

## Backend
1. `src/dashboard/handlers/chat.ts:803` — agente del turno: `body.agent ?? session?.agent ??
   roles.orchestrator?.agent` (ya no `cfg.agent`). Modelo: `body.model ?? session` (si la sesión guarda modelo) `??
   roles.orchestrator.model`; esfuerzo igual con `roles.orchestrator.effort`. Borrar el fallback
   `'deepseek/deepseek-v4-flash'` (`:1199`). Si no hay agente o modelo resuelto: `finishTurnFailure` + 400
   `Orchestrator role is unassigned — assign it in Settings → Model routing`, sin llamar a ningún provider.
   Orquestador `agent: api` → el provider/modelo del rol (vía `roleClient`/`clientFromAssignment`,
   `src/router/role-runner.ts`), no OpenRouter fijo.
2. `src/chat/classify-task-intent.ts:32` — borrar `CLASSIFIER_MODEL`; clasificar con el rol Auxiliar
   (`roleClient(cfg, 'auxiliary', { cwd: root })`; la función recibe `root`/config). Auxiliar sin asignar →
   `{ isTask: false, reason: 'auxiliary-unassigned' }` sin llamar a nada, y la instrucción de sistema del turno
   (`chat.ts` ~`:1250`, rama "NOT auto-detected") dice al usuario, en una frase, que la creación automática de
   tareas está apagada hasta asignar el Auxiliar en Settings → Model routing. Mantener `maxTokens: 1000`.
   Medir y reportar la latencia del clasificador con Codex (3 llamadas) — es un spawn de CLI por mensaje.
3. Tareas auto-creadas desde el chat (`chat.ts:1072-1089`) y desde `POST /api/tasks` sin engine/model
   (`handlers/tasks.ts:357-372`): regla que coincide → `engine` según su agente (`claude`→`external`,
   `codex`→`codex`, `opencode`→`opencode`, `api`/`local`→ nada) + `cli_effort` de la regla, **sin
   `executor_model`** (el CLI usa su propio default; OrchestOS no elige modelo). Sin regla → no escribir
   `engine`/`executor_model`: el run resuelve `roles.executor` (MR.1.b). Borrar los modelos fijos de
   `resolveAgentSelection` (`src/router/engine-cascade.ts:138,142`: `anthropic/claude-sonnet-5`,
   `openai/gpt-5.4`) y dejar de usar `session?.agent` / `cfg.agent` / la cascada para elegir el ejecutor en esos
   dos sitios. Si `resolveAgentSelection`/`resolveCascadeTier` quedan sin uso, borrarlos con sus tests; si otro
   sitio los usa, listarlo en el reporte sin tocarlo.
4. Tests: turno sin `body.model` usa el Orquestador (agente y modelo); sin Orquestador → 400 sin spawn/fetch;
   clasificador usa el Auxiliar y con Auxiliar sin asignar no llama a nada; tarea auto-creada sin regla no trae
   `engine`/`executor_model`; con regla `codex` trae `engine: codex` y ningún modelo.

4b. `src/dashboard/chat-cli-models.ts:168` — `readCliModelCatalogs` usa `Promise.all`: si un CLI falla al spawnear
   (visto 2026-09-25: `ENOEXEC … posix_spawn ~/.local/bin/claude`, transitorio) `GET /api/chat/cli-models` y
   `/api/models/catalog` devuelven 500 para todos. Aislar por CLI: el que falla vuelve `{ id, models: [], efforts:
   [], error: <mensaje> }` y los demás siguen; la UI ya muestra `error` bajo el control (MR.1.c). Test con un runner
   que rechaza para un CLI.

## Frontend (`src/dashboard/app/src`)
5. Nuevo chat y composer arrancan con el Orquestador de `/api/config` → `roleAssignments.orchestrator`
   (agente+modelo+esfuerzo). Borrar `DEFAULT_CHAT_MODEL` (`api/chat.ts:39`) y su uso en
   `NewAgentSelectorModal.tsx:87`. Orquestador sin asignar y sin elección → el composer muestra
   "Orchestrator unassigned" con un botón a Settings → Model routing, y no envía.
6. Settings → sección Executor: quitar los chips "Default agent" (el rol Ejecutor los reemplaza; hoy dicen "Which
   agent runs the tasks", ya falso). Se quedan `apiMode`, iteraciones y timeout. El `agent` del YAML deja de
   escribirse desde ahí.

## Gate en navegador — flujo nuevo `scripts/ui-gate/flows/chat-roles.mjs`
Proyecto temporal; roles por `writeGateRoles` **menos** el Auxiliar al principio. Pasos:
1. Chat nuevo sin tocar el picker: el composer muestra Codex · GPT-6-Luna · medium (el Orquestador); enviar una
   pregunta → el turno registrado tiene `provider/agent = codex` y modelo `gpt-6-luna`.
2. Con Auxiliar sin asignar, un pedido de build ("Modifica README.md…") no crea tarea y la respuesta avisa que el
   Auxiliar no está asignado.
3. Asignar el Auxiliar (API de config), repetir el pedido → tarjeta de tarea retenida; en `tasks.yaml` la tarea no
   trae `executor_model` ni `engine` (sin reglas).
4. Settings → Executor: no hay chips "Default agent".
Añadirlo a `ui_flows` de `scripts/pre-push.sh`. Todo identificador del flujo importado.

## Verificación (Luna)
`bunx tsc --noEmit`; tsc de la app; tests tocados; `bun test` completo (línea final literal); biome; `node --check`
del flujo; check-css. Los ui:gate los corre el cerebro.

## Ronda 2 (cerebro, 2026-09-25)
1. `test:coverage` rojo: `src/dashboard/__tests__/chat-r5-reliability.test.ts:128` (`reserves before YAML creation…`,
   `result.failure` null). Con MR.1.d1 el clasificador necesita el Auxiliar: el fixture del test debe asignar los
   roles (orchestrator/auxiliary/executor en su config temporal, o inyectar el clasificador) para que la ruta de
   auto-tarea se ejerza de verdad. No debilitar la aserción. Revisar otros tests del chat que hayan dejado de
   ejercer la auto-tarea por la misma causa (pasan porque ya no entran a la rama) y listarlos.
2. El punto 4b del spec (`src/dashboard/chat-cli-models.ts:168`, aislar el fallo por CLI) no se hizo. Hacerlo.
3. Esfuerzo: se añadió `effort?: 'low' | 'medium' | 'high'` a `TaskAgentRule` (`src/config/schema.ts`) y a `ChatOpts`
   (`src/providers/index.ts`). `TaskAgentRule` ya tiene `cli_effort` (lo que escribe la UI de MR.1.c): borrar el
   `effort` nuevo de `TaskAgentRule` y usar `cli_effort`. En `ChatOpts`, `effort?: string` (sin enumerar niveles:
   OrchestOS no valida esfuerzo por engine, decisión de Carlos). Ajustar los usos.
Verificación: `bun run test:coverage` completo con `ORCHESTOS_ROLE` sin exportar en el proceso de tests (pegar la
línea final literal); tsc; biome. No correr ui:gate. Preflight `--item MR.1`.

## Ronda 3 (cerebro, 2026-09-25) — ui:gate real: 5 flujos rojos
Captura del chat nuevo (sesión Codex, Orquestador = Codex · gpt-6-luna · medium): el composer muestra
**"Auto Router (Beta) · high"**, una fila de chips de CLI visible, y el mensaje no se envía (no aparece burbuja).
1. `src/dashboard/app/src/components/common/AgentComposer.tsx` (~`:457`): la ronda 1 cambió `{false && (` por `{` y
   mostró la fila de chips de CLI. Revertir a oculta tal como estaba (comentario "Kept structurally for template
   fidelity; the session header owns CLI identity"; el CLI se elige en "Nuevo chat" y la sesión queda bloqueada a
   ese CLI). Quitar `onCliChange`/`explicitCliChoice` si quedan sin uso. `bun run ui:fidelity:jsx` debe pasar.
2. Modelo inicial: si la sesión no fija modelo, el composer arranca con el modelo y esfuerzo del Orquestador cuando
   el agente de la sesión es el del Orquestador (`roleAssignments.orchestrator`), mostrando su nombre del catálogo
   ("GPT-6-Luna · medium"). Nunca un modelo de OpenRouter en una sesión CLI. "Nuevo chat" (`NewAgentSelectorModal`)
   preselecciona agente, modelo y esfuerzo del Orquestador y la sesión creada los usa. Encontrar de dónde sale
   "Auto Router (Beta)" / `high` y corregirlo; decir la causa en el reporte.
3. El envío no puede fallar en silencio: si el POST del chat devuelve error (p. ej. 400 de rol sin asignar o de
   modelo requerido), el error se ve en el chat.
4. `project-delete`: tras borrar el proyecto activo, el frontend pide `/api/config` con el id borrado → 404 en
   consola. No pedir config con un `activeProjectId` que ya no existe (limpiarlo al borrar/recargar proyectos).
5. `scripts/ui-gate/flows/chat-roles.mjs`: `shot(...)` después de cada paso; los detalles de `step` con el valor
   real observado (texto de la última respuesta, fila leída, etc.), nunca un texto fijo.
Verificación: tsc app; tests de la app; `bun run ui:fidelity:jsx`; check-css; `node --check` de los flujos; biome.
No correr ui:gate. Preflight `--item MR.1`.

## Ronda 4 (cerebro, 2026-09-25) — tras rebuild: 10/11 verdes, `chat-roles` rojo
El ui:gate de la ronda 3 corrió contra `src/dashboard/app/dist` de las 13:01 (anterior a la ronda 3): `ui:gate` no
reconstruye el frontend. Con `bun run build:app` antes: `usage-bar`, `text-sweep`, `chat-turn-details`,
`project-delete` verdes; `chat-roles` rojo por dos causas del producto:
1. **Primer mensaje perdido en silencio.** El flujo hace "Start Chat" → `fill` → `Enter` y el composer queda vacío,
   sin burbuja ni error (captura `orchestrator-question-response.png`). Encontrar la causa (candidatos: el
   `key={thread?.id ?? 'new-chat'}` de `OrchestChatView.tsx` remonta el composer al llegar el id de sesión y borra el
   texto; o `Enter` con `modelsReady` falso vacía el input sin enviar) y corregirla en el producto: un texto escrito
   nunca se pierde; si todavía no se puede enviar, queda en el input. Decir la causa en el reporte.
2. **Aviso de Auxiliar sin asignar determinista.** Hoy es una instrucción al LLM (`handlers/chat.ts:1284`, "Tell the
   user that in one sentence") que el modelo parafrasea. Quitar esa instrucción; el backend marca el turno (campo en la
   respuesta/mensaje) y la UI del chat muestra un aviso fijo bajo la respuesta: "Auxiliary role is unassigned — tasks
   are not created. Model routing" con el enlace a Model routing (mismo patrón que el aviso de Orquestador sin asignar
   de `AgentComposer.tsx`). Sin CSS nuevo (clases ya existentes). Test del handler que cubra el campo.
3. **`scripts/ui-gate/run.mjs` reconstruye el frontend** (`bun run build:app`) antes de levantar el dashboard, para
   que un gate nunca vuelva a pasar/fallar contra un build viejo.
4. `chat-roles.mjs`: el paso "unassigned Auxiliary is explained" busca el aviso fijo del punto 2.
Verificación: tsc (backend y app); tests de la app y del handler; `bun run test:coverage`; `bun run ui:fidelity:jsx`;
`node --check` de run.mjs y del flujo; biome. No correr ui:gate. Preflight `--item MR.1`.

## Ronda 5 (cerebro, 2026-09-25) — ui:gate 6/11 tras la ronda 4 (build fresco, 16:06)
Evidencia: `/var/folders/.../ui-gate-77394/`. El texto ya no se pierde, pero quitar el `key` rompió la sincronización:
1. **Regresión de la ronda 4.** `AgentComposer` inicializa `activeCli` (y modelo/esfuerzo) una sola vez con
   `useState(lockedCli ?? defaultCli)`; sin remount, cuando llega la sesión Codex el composer sigue en el CLI del
   montaje (API): muestra "Auto Router (Beta) · medium", el POST da 502 y la lista de modelos es la de API (por eso
   `chat-turn-details`, `text-sweep` y `usage-bar` no encuentran `gpt-6-luna` clicable). Arreglo: al cambiar
   `lockedCli`/`defaultCli` (y `defaultModel`/`defaultEffort`), sincronizar `activeCli`, modelo y esfuerzo **sin
   tocar el texto ni los adjuntos**. No volver a poner el `key`. Test de la app: el composer montado sin sesión y luego
   con sesión Codex + Orquestador `gpt-6-luna · medium` muestra ese modelo y conserva el texto escrito.
2. **`project-delete` 404 otra vez** (`/api/config`). Candidato: el `getConfig(thread?.projectId)` que la ronda 3
   añadió en `OrchestChatView.tsx` pide config del proyecto recién borrado. Ningún componente pide `/api/config` con
   un id de proyecto que ya no existe (buscar todos los call sites de `getConfig`, no solo este).
Verificación: tsc (backend y app); tests de la app; `bun run test:coverage`; `bun run ui:fidelity:jsx`; biome.
No correr ui:gate. Preflight `--item MR.1`.

## Ronda 6 (cerebro, 2026-09-25) — ui:gate 10/11, solo `chat-roles`
Evidencia `ui-gate-11843/chat-roles/orchestrator-question-response.png`: composer correcto ("GPT-6-Luna · medium"),
el texto sigue en el input y el botón de enviar está activo, pero el `Enter` que el flujo pulsa justo tras
"Start Chat" no envió nada. Hipótesis: `Enter` llega con `modelsReady` falso (o durante la sincronización de la
ronda 5) y `handleSend` sale sin avisar.
1. Confirmar la causa (decirla en el reporte). Si es la carga de modelos: en el producto, un `Enter`/click mientras
   carga no se pierde en silencio — el mensaje se envía en cuanto el composer está listo (una sola vez), o el botón
   y el placeholder muestran que aún carga. Elegir lo más simple sin CSS nuevo.
2. `chat-roles.mjs`: antes de escribir el primer mensaje, esperar a que el control de modelo muestre el modelo
   (no "Loading models…"), como hacen `chat-turn-details`/`text-sweep`.
Verificación: tsc (back y app); tests de la app; `bun run ui:fidelity:jsx`; `node --check` del flujo; biome.
No correr ui:gate ni test:coverage (el cerebro los corre). Preflight `--item MR.1`.

## Ronda 7 (cerebro, 2026-09-25) — ui:gate 10/11, `chat-roles` avanza hasta el paso de tareas
Evidencia `ui-gate-39733`. El primer turno ya va por Codex. Dos causas:
1. **`runs.model` guarda la etiqueta de display**, no el id: `{"provider":"codex","model":"gpt-6-luna via Codex CLI
   (effort: medium)"}`. Origen: `finishTurnSuccess({ resultLabel })` en `handlers/chat.ts` (~`:1556`, rama Codex) y
   sus hermanas (Claude, OpenCode, API). El run debe guardar el id del modelo (`gpt-6-luna`) y el esfuerzo en su campo
   propio si existe; la etiqueta "via … (effort: …)" solo para el mensaje mostrado. Buscar los consumidores de
   `runs.model` (precio/coste — probable causa del `$0` de MR.1.b2/F0.8 —, Runs graph, turn details) y confirmar que
   siguen bien con el id. Test del handler: el run de un turno Codex guarda `model = 'gpt-6-luna'`.
2. **409 en `/api/chat`** en el tercer mensaje (tras asignar Auxiliar): el flujo envía cuando ve el aviso del segundo
   turno, pero el servidor todavía considera ese turno en curso (`handlers/chat.ts:893-905`). Encontrar qué rama del
   409 salta y por qué el turno sigue "en curso" después de que la UI ya muestra la respuesta; corregir en el producto
   (el turno se libera al terminar la respuesta visible) o, si hay trabajo posterior legítimo, que la UI no permita
   enviar hasta que termine y que un 409 se vea en el chat. Decir la causa en el reporte.
Verificación: tsc (back y app); tests del handler y de la app; `bun run ui:fidelity:jsx`; `node --check` del flujo;
biome. No correr ui:gate ni test:coverage. Preflight `--item MR.1`.

## Ronda 8 (cerebro, 2026-09-25) — ui:gate 9/11 (`chat-roles` 409, `project-delete` 404 intermitente)
Evidencia `ui-gate-71216`. `runs.model` ya correcto y el aviso fijo de Auxiliar se ve. Pero:
1. **409 `session-busy` en el tercer mensaje** ("A response for this conversation is already being generated") aunque
   el turno 2 ya se ve completo en pantalla, y el mensaje 3 no deja burbuja: la petición salió, así que la UI no se
   creía ocupada. La DB del gate se borra al terminar, así que no hay rastro del turno que bloqueaba. Hipótesis a
   descartar con evidencia: (a) doble envío desde el composer (Enter + otro disparador; dos `requestKey` distintos,
   el segundo choca con el primero en vuelo — y el manejo de error retira la burbuja del primero); (b) el turno 2 se
   libera después de responder (trabajo posterior a `jsonResponse`); (c) un turno `pending` huérfano de antes.
   - Log del dashboard en cada `session-busy`: id, estado y antigüedad del turno que bloquea (evidencia para el gate).
   - Test del handler: tres POST secuenciales a la misma sesión Codex (CLI simulado), el 2º con Auxiliar sin asignar,
     `PUT /api/config` asignándolo, el 3º crea la tarea held → los tres 200.
   - Corregir la causa real en el producto; decirla en el reporte.
2. **`project-delete` 404 en `/api/config` intermitente** (verde en ronda 5, rojo ahora). Listar TODOS los call sites
   de `getConfig`/`/api/config` en la app y garantizar que ninguno usa un id de proyecto borrado (incluidas carreras:
   una petición lanzada antes del borrado que llega después no debe tocar la red con ese id; si ya salió, un 404 de un
   proyecto que ya no está en la lista se ignora sin error de consola — pero la red sí lo cuenta, así que mejor
   evitarla). Decir cuál era el call site.
Verificación: tsc (back y app); tests del handler y de la app; `bun run ui:fidelity:jsx`; `node --check` de los
flujos; biome. No correr ui:gate ni test:coverage. Preflight `--item MR.1`.

## Ronda 9 (cerebro, 2026-09-25) — ui:gate 10/11; 409 y 404 resueltos, la ronda 8 pierde mensajes
Evidencia `ui-gate-3750/chat-roles/task-held-for-confirmation.png`: el tercer mensaje no deja burbuja y el input quedó
vacío. Causa en el código: `OrchestChatView.tsx:144` hace `if (sendLock.current) return` en silencio, y
`AgentComposer.tsx` `handleSend` (~`:255`) vacía el input sin saber si el envío se aceptó. El candado sigue activo
después de que la respuesta ya se ve: la promesa de `onSendMessage` (`App.tsx`) se resuelve más tarde que la respuesta
visible (averiguar qué espera: refresco de tareas/sesiones/cuota, polling… — decirlo en el reporte).
1. Un mensaje escrito **nunca** se pierde: `onSendMessage` informa si se aceptó (p. ej. devuelve `false`/rechaza) y el
   composer vacía texto y adjuntos solo si se aceptó; si no, quedan en el input.
2. La promesa de envío se resuelve cuando la respuesta del turno está en pantalla; los refrescos posteriores no
   retienen el candado (que corran sin `await` en esa cadena, o fuera de ella).
3. Deuda de la ronda 8 (spec pedido y no hecho): test del handler con tres POST secuenciales a la misma sesión Codex
   (CLI simulado): el 2º con Auxiliar sin asignar, `PUT /api/config` asignándolo, el 3º crea la tarea held → los tres
   200. Y un test de la app para el punto 1 (envío rechazado conserva el texto) si la lógica se puede probar sin DOM.
Verificación: tsc (back y app); tests del handler y de la app; `bun run ui:fidelity:jsx`; `node --check` de los
flujos; biome. No correr ui:gate ni test:coverage. Preflight `--item MR.1`.

## Ronda 10 (cerebro, 2026-09-26) — ui:gate 11/11, cerrado
1. `chat-roles`: el paso "unassigned Auxiliary is explained" usaba `.last()` sobre un texto que ya existía desde el
   turno 1 → pasaba al instante y el 3er `Enter` caía con el composer `busy` (ignorado, texto conservado: la ronda 9
   funciona). Flujo: helper `sendTurn` (reintenta Enter hasta ver `POST /api/chat`, espera que el composer se vacíe)
   y conteo de explicaciones antes/después.
2. `project-delete` 404: call site `OrchestSettingsView.tsx:337` (effect de carga de Settings, sin `AbortSignal`),
   mapeado con el sourcemap. La petición salía antes del purge y respondía 404 después. Fix: abort en cleanup del
   effect; al confirmar purge se aborta la petición en vuelo y el id se excluye hasta que el handler termina.
