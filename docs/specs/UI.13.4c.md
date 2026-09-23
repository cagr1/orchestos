# UI.13.4c — razonamiento, herramientas y tarea retenida en el chat (spec para Luna)

Lote L1, ítem 2 de 3. PLAN.md § UI.13.4, inventario punto 5. Requiere CI.2.B (`ui:gate`) ya hecho.

## Hallazgo que manda el diseño

En la plantilla, los tres bloques se dibujan en
`~/Documents/screens/orchestos-ai-agent-dashboard/src/components/threads/ThreadsView.tsx:245-390`
(razonamiento plegable `:245-275`, herramientas `:277-313`, tarjeta de tarea retenida `:345-390`), no en
`OrchestChatView`. Hoy la app no pinta ninguno: `OrchestChatView.tsx:126-200` solo pinta `content`.
El backend ya guarda los pasos de cada turno de CLI (`chat_turn_steps`, vía `persistChatStep`,
`handlers/chat.ts:882`) pero **descarta el razonamiento** (`step-event.ts:265-296` ignora
`item.type === 'reasoning'` de Codex) y **no liga el mensaje con su turno** (`chat_messages` no tiene
`turn_id`).

## Qué cambiar

### Backend

1. **Migración 14** en `src/db/migrate.ts` (seguir el patrón de la 13):
   - `ALTER TABLE chat_messages ADD COLUMN turn_id TEXT` (nulo en filas viejas).
   - Reconstruir `chat_turn_steps` (`migrate.ts:~822`) con `CHECK(type IN ('tool_use','text','step_finish','reasoning'))`,
     copiando filas e índices. `run_steps` (`migrate.ts:~808`) **no** se toca.
2. **Paso `reasoning`**: añadir `'reasoning'` al tipo de `ExecutorStepEvent` (`src/run/executors/step-event.ts:26`
   y `types.ts` si lo repite). Parsers, los tres (arreglar los hermanos, no solo Codex):
   - Codex (`codexEventToStep`, `step-event.ts:~265`): `item.type === 'reasoning'` → `{ type: 'reasoning', label: 'reasoning', detail: item.text }`.
   - Claude (`step-event.ts:~97`): bloque `thinking` → `{ type: 'reasoning', …, detail: block.thinking }`.
   - OpenCode (`step-event.ts:~222`): `part.type === 'reasoning'` → `detail: part.text`.
   - Donde el texto de respuesta se arma sumando pasos `text` (`codex.ts:281` y equivalentes), el razonamiento
     **no** entra en la respuesta.
   - `src/db/run-steps.ts`: si recibe un paso `reasoning`, lo ignora (su CHECK no lo admite); test.
3. **Mensaje ↔ turno**: `commitTurnSuccess` (`src/db/chat-turns.ts:~146`) pasa `turnId` a
   `appendChatExchange`, que lo guarda en el mensaje `assistant`. `toMessageRow`
   (`handlers/chat-sessions.ts:~73`) expone `turnId` (o `null`).

### Front (`src/dashboard/app/src`)

4. `api/chat.ts`: `ChatMessageRow.turnId?: string | null`. Función pura nueva
   `attachTurnDetails(messages: ChatMessage[], rows: ChatMessageRow[], timeline: TimelineResponse): ChatMessage[]`:
   para cada `assistant` con `turnId`, busca el turno en `timeline.turns` y rellena:
   - `reasoning` = `detail` de los pasos `type === 'reasoning'`, en orden de `seq`;
   - `toolCalls` = pasos `tool_use` → `{ name: tool ?? 'tool', args: target ? { target } : detail ? { command: detail } : {}, result: output ?? undefined, status: ok === false ? 'failed' : 'success', durationMs: durationMs ?? undefined }`;
     si el turno sigue `pending`, los pasos sin `ok` van como `'running'`.
   Tests en `api/chat.test.ts` (turno con razonamiento + comando ok + comando fallido; mensaje sin `turnId` queda igual).
5. **Tarea retenida**: `mapMessage` (`api/chat.ts:~165`) además llena `proposedTask = { id: taskId, description, output: existingFiles }`
   cuando `taskHeld`. Al cargar mensajes, la tarjeta solo se muestra si la tarea sigue `pending` en
   `GET /api/tasks` (header `x-orchestos-project-id` del proyecto de la sesión, como `api/runs.ts:23`);
   si no existe o ya no está `pending`, `taskHeld` pasa a `false` (misma regla que el vanilla,
   `public/screens-core.js:360-365`). `description` = la descripción real de la tarea si está en la lista.
6. **Un solo cargador** en `App.tsx`: los 5 sitios que hoy hacen `getSessionMessages(...).map(mapMessage)`
   (`App.tsx:120, 167, 193, 321, 532`) pasan a usar una función `loadThreadMessages(sessionId, projectId)`
   que pide mensajes + `getTimeline` + tareas en paralelo y aplica 4 y 5. Si `getTimeline` o tareas fallan,
   devuelve los mensajes sin detalles (no rompe el chat).
7. **Aprobar/Rechazar reales** (`App.tsx:555-565`, hoy mutan mocks):
   - Aprobar → `POST /api/tasks/:id/run` (header de proyecto, `Origin` mismo origen) y recargar el hilo.
   - Rechazar → `DELETE /api/tasks/:id` (la tarea retenida nunca corrió; es lo que hace el vanilla,
     `screens-core.js:631-645`) y recargar el hilo.
   - Si la API falla, el error se ve en la tarjeta (no se traga).
8. **`OrchestChatView.tsx`**: dentro del mensaje `assistant` (`:126-200`), copiar **tal cual** (JSX y className)
   los bloques de `ThreadsView.tsx:245-313` (antes del Markdown) y `:345-390` (después), con el estado
   `expandedReasoning`/`toggleReasoning` de `ThreadsView.tsx:46-60`. Única diferencia de texto permitida: el
   botón `Approve & Merge to Main` dice `Approve & Run` (aprobar corre la tarea; no hace merge — un botón no
   dice algo que no hace). `onApproveHeldTask`/`onRejectHeldTask` ya son props (`:20-21`).
   Añadir `ThreadsView.tsx` como fuente en `ui:fidelity:jsx` solo si el script lo admite por fragmento; si no,
   dejar nota en el reporte (no inventar un modo nuevo del script).

### Gate en vivo — `scripts/ui-gate/flows/chat-turn-details.mjs`

Usa el runner de CI.2.B. Preparación por API/CLI (permitido: la regla prohíbe *navegar* por `window`, no preparar datos):
- Crear `mkdtemp` con `git init`, un `README.md` y commit; registrarlo con
  `bun run src/cli.ts init <tmp>`; `cleanup`: `DELETE /api/projects/:id` y borrar el tmp.
Recorrido clickeando:
1. Seleccionar el proyecto temporal en el sidebar; nuevo chat con **Codex · gpt-5.6-luna · medium**, eligiendo con los
   controles visibles (el selector de CLI se quitó del composer el 2026-09-22 y el CLI se muestra en la cabecera; leer
   `AgentComposer.tsx`, `App.tsx` y el sidebar para saber dónde se elige CLI, modelo y esfuerzo — no adivinar). Si
   no hay forma visible de elegir Codex para un chat nuevo, el flujo falla con ese paso y lo reportas: no lo esquives por API.
2. Enviar: `Ejecuta el comando ls en la raíz del proyecto y dime cuántas entradas hay.` Esperar la respuesta (hasta 180 s).
3. `step`: el mensaje del bot tiene el bloque de herramientas con al menos 1 fila `command` y estado `success`.
4. `step`: si el timeline (`GET /api/chat/sessions/:id/timeline`) trae pasos `reasoning`, el bloque plegable
   existe y al clicarlo muestra ese texto; si trae 0, registrar `reasoning: 0 pasos del CLI` como detalle
   (no falla, pero queda escrito).
5. Recargar la página → los bloques siguen ahí (vienen de la DB).
6. Enviar: `Modifica README.md para añadir al final la línea "gate UI.13.4c".` → aparece la tarjeta retenida
   (el archivo existe, así que la tarea se retiene). `step` tarjeta visible con el id de la tarea.
7. Clic en **Reject** → la tarjeta desaparece y `GET /api/tasks` ya no tiene esa tarea.
8. Repetir 6 y clic en **Approve & Run** → la tarea sale de `pending` en `GET /api/tasks` (no esperar a que termine).
9. `shot` en 3, 6 y 8. 0 errores de consola.

## Fuera de alcance

Consola de Dev, `run_steps`, cualquier otra pantalla. No commits, no stash. No invoques `codex exec` ni delegues
a otro agente.

## Gate (lo corre el cerebro fuera del sandbox)

`bun run gate:all` verde y `bun run ui:gate chat-turn-details` → `PASS`.
