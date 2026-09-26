# MR.1.d3 — El Orquestador marca la intención de tarea: sin clasificador aparte

Decisión de Carlos (2026-09-26): quitar la espera del clasificador sin volver a API. Hoy cada mensaje de Chat y Dev
(`/api/chat`) corre ANTES de responder `classifyTaskIntent` (`src/chat/classify-task-intent.ts:70`) con el rol
Auxiliar: con Codex son 5.5-6.4 s y 7,600 tokens por mensaje, sin importar el esfuerzo (medido 2026-09-26; `minimal`
= HTTP 400). Nuevo contrato: el Orquestador decide en su propia respuesta con una línea marcador; cero procesos extra.
Preflight de Luna: `--item MR.1`. Fuera: que el Orquestador redacte también el draft (sigue `buildNaturalDraft`, solo
en turnos de tarea); animación de espera; MR.1.d2.

## Backend — `src/dashboard/handlers/chat.ts`
1. Borrar la llamada a `classifyTaskIntent` (`:1055`) y el bloque `autoTask` previo a la respuesta (`:1087-1152`).
   Marcador: la línea exacta `[[orchestos:task]]`. Exportar desde `chat.ts` (o un módulo chico en `src/chat/`)
   `TASK_MARKER`, `hasTaskMarker(text)` y `stripTaskMarker(text)` (quita toda línea cuyo `trim()` sea el marcador y
   hace `trimEnd()` del resultado).
2. `autoTaskInstruction` (`:1293`) se arma ANTES de generar, sin depender del resultado:
   - sin contexto de proyecto: la frase actual de "no associated project" pero condicional ("If the user asks you to
     build or modify files, say plainly that…"); sin pedir marcador;
   - sesión `chat`: la frase actual de límite read-only, condicional igual; sin pedir marcador;
   - si no: "If — and only if — the user asks OrchestOS to build, create or modify files in this project, end your
     reply with the line `[[orchestos:task]]` alone, and keep the reply to one or two sentences saying OrchestOS will
     create a task for it. Do not write the code yourself and do not say a task was created or started: the system
     appends the real result. Otherwise never write that line."
   Borrar la rama `auxiliary-unassigned` y las que dependían del resultado (held/started/error/skipped): ese estado
   lo dice solo la nota mecánica.
3. Un único helper async, p. ej. `settleTaskIntent(rawText)`, llamado en TODOS los caminos de respuesta (Claude CLI,
   Codex, OpenCode, Ollama, tool-loop, OpenRouter/role plano — hoy cada uno hace `result.text + autoTaskNote`,
   `:1515,1568,1615,1652,1758,1792`) justo después de que el provider responde y antes de `commitTurnSuccess`:
   `isTask = hasTaskMarker(rawText)`; texto = `stripTaskMarker(rawText)`; si `isTask && hasProjectContext &&
   sessionAllowsTaskExecution(...)` corre la lógica de creación movida tal cual (draft, `output` vacío → skipped,
   regla de proyecto, held si toca archivos existentes, `reserveTurnTask`, `spawnTaskRun`). Devuelve `{ text,
   taskSuggestion, autoTask, autoTaskSkipped }`; `taskSuggestion = isTask ? { isTask: true, reason:
   'orchestrator-marker' } : { isTask: false, reason: '' }`. `autoTaskNote` (`:1471`) se calcula con eso; sumar la
   nota de skipped: `⚠ No task created: the draft named no output files.` Envelope, `commitTurnSuccess`,
   `taskHeld`/`existingFiles` usan lo devuelto. `logChatTaskBarEvent` (`:1057`) pasa a después, con `barShown =
   barShownByCount || isTask`.
4. `persistChatStep` (`:930`): en pasos `text`, aplicar `stripTaskMarker` a `detail`; si queda vacío, no insertar el
   paso. El marcador nunca llega a la UI ni a la DB.
5. Borrar `src/chat/classify-task-intent.ts` y `src/__tests__/classify-task-intent.test.ts` (sin otros usos).
   El rol Auxiliar sigue para diagnose/memory judge/skills/patterns — no tocarlo.
6. Quitar `auxiliaryRoleUnassigned` de punta a punta: `src/dashboard/types.ts`, `handlers/chat-sessions.ts:67-86`,
   `app/src/types/orchestos.ts`, `app/src/api/chat.ts`, `OrchestChatView.tsx:339` (bloque entero). Envelopes viejos
   con el campo se ignoran.
7. Tests (`src/dashboard/__tests__/`, los de chat existentes adaptados, no duplicados):
   - turno normal: el provider se llama UNA vez (el Orquestador), sin clasificador, sin tarea;
   - respuesta con marcador en proyecto modo code: tarea creada; el texto guardado y devuelto no contiene
     `[[orchestos:task]]` y termina con la nota `▶ Started task` / held según corresponda;
   - marcador en sesión `chat` o sin proyecto: sin tarea, sin marcador en el texto;
   - `stripTaskMarker`/`hasTaskMarker`: marcador con espacios, al medio, ausente;
   - paso `text` que es solo el marcador no se persiste.

## Flujo en vivo — `scripts/ui-gate/flows/chat-roles.mjs`
Mantener `delete config.roles.auxiliary` (prueba que el chat ya no depende del Auxiliar). Reemplazar la sección
`:130-163` (explicación de Auxiliar sin asignar, asignarlo por API): el pedido `Modify README.md…` crea la tarea
retenida SIN Auxiliar ("Task ready to run" visible), `tasks.yaml` sin `engine`/`executor_model` (paso existente), y
`page.getByText('[[orchestos:task]]')` cuenta 0. Registrar en el log del paso el tiempo (ms) del primer turno normal
desde el envío hasta la respuesta visible.

## Gate
`bun run test:coverage` verde; `tsc` back + app; `bun run ui:fidelity:jsx`; `bun run ui:gate` (los 11 flujos) fuera
del sandbox, evidencia `docs/done/evidence/MR.1.d3-live.json`. Medir en vivo 3 turnos "hola" antes/después (tiempo
de envío → respuesta) y dejarlos en la evidencia.
