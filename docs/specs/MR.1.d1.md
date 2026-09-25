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
