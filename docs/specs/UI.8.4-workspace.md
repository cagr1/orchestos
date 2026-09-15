# UI.8.4 (pieza 2/2) — contrato Chat → Workspace

Contrato en `PLAN.md:1762-1772` (pieza 2 de 2, la pieza 1 — agentes como filas colapsables —
ya cerró como `UI.8.4a`). Esta pieza NO incluye el inspector condicional (queda pendiente,
anotado en `PLAN.md`, no es parte de este spec).

## Contrato exacto (texto del ítem)

1. Si la conversación **no** generó trabajo persistente, la acción **no aparece** (nunca
   deshabilitada — botón que a veces no lleva a ningún lado = "botón que no hace nada", Regla
   Cero de `AGENTS.md`).
2. Si lo generó: abre **proyecto + entidad de origen ya seleccionada**, misma pestaña, con el
   chat conservado y accesible en un gesto de vuelta.

## Qué es "trabajo persistente" en esta pasada

La única señal ya cableada hoy es la auto-creación de tareas desde el chat
(`chat.ts`, variable `autoTask`, guardada en `chat_turns.task_id` — columna agregada en la
migración 6, `src/db/migrate.ts`). Una sesión "generó trabajo persistente" si **al menos un**
`chat_turns` de esa sesión tiene `task_id IS NOT NULL`. No inventar otras señales (specs
creados, memoria, etc.) en esta pasada — si aparecen después, es continuación, no bloqueo de
esta.

## Cambios

### 1. Backend — saber si una sesión tiene trabajo persistente

`src/db/chat-turns.ts`: dos funciones nuevas, mismo estilo que `getLastTurn`:
- `sessionHasPersistentWork(sessionId: string): boolean` —
  `SELECT 1 FROM chat_turns WHERE session_id = ? AND task_id IS NOT NULL LIMIT 1`.
- `getLastPersistentTaskId(sessionId: string): string | null` — igual pero
  `ORDER BY created_at DESC LIMIT 1`, devuelve el `task_id` (o `null`).

Exponer en la respuesta de sesión: `toSessionRow` (`src/dashboard/handlers/chat-sessions.ts:28`)
agrega `hasPersistentWork: boolean` (usa `sessionHasPersistentWork`). Se aplica tanto a
`GET /api/chat/sessions` (lista) como a la creación/lectura individual — mismo helper, un solo
lugar. No agregues un endpoint nuevo si `toSessionRow` ya cubre los casos que la UI necesita.

### 2. Frontend — el botón condicional

En el header del chat (`SCREENS.chat`, `screens-core.js`) o junto al selector de sesión activa
en el aside — decidir el lugar exacto mirando el layout real, no inventar una barra nueva.
Cuando `state.chatSessions.find(s => s.id === state.chatSessionId)?.hasPersistentWork` es
`true`: mostrar un botón (`"Open in Workspace"` / `t('chat.openWorkspace')`, agregar la key
i18n en los dos idiomas). Si es `false` o no hay sesión activa: el botón **no está en el DOM**
(no `display:none`, no `disabled` — Regla Cero).

Click en el botón:
1. `state.workspaceProjectId = session.projectId` (si `projectId` es `null` — sesión general
   sin proyecto — el botón tampoco debería haber aparecido; confirmar que
   `sessionHasPersistentWork` solo es relevante para sesiones con proyecto, ya que
   `handleApiChat` solo auto-crea tareas con contexto de proyecto — verificar leyendo
   `chat.ts` antes de asumirlo).
2. `state.screen = 'workspace'`, `state.workspaceTab = 'tasks'`.
3. `App.rerender()` y `App.syncNav()` (para que el store de React —`pushShellState`— refleje
   `workspaceProjectId` y el riel resalte el proyecto correcto, mismo patrón que
   `selectWorkspaceProject` ya usa desde el lado React).
4. Si `getLastPersistentTaskId` (traído junto con la sesión, o pedido puntual) da un id real:
   una vez que el tab de tasks montó, abrir `SidePanel.openTask(task)` con esa tarea (buscarla
   en `state.tasks` por id — si `state.tasks` no está cargado todavía, esperar el fetch antes
   de abrir el panel, no fallar en silencio).

### 3. Volver al chat en un gesto

Ya existe: el nav `chat` sigue en el riel (`NAV`, UI.8.3), y `state.chatSessionId` no se toca al
navegar al workspace — volver a Chat desde el riel muestra la misma conversación tal cual quedó.
No hace falta código nuevo para esto, solo confirmarlo en el gate.

## Qué NO tocar

- El inspector condicional (pendiente, otro ítem/pasada).
- Cualquier señal de "trabajo persistente" que no sea `task_id` en `chat_turns`.
- El backend de creación de tareas (`autoTask` en `chat.ts`) — solo se lee, no se cambia.

## Cómo se verifica

1. `bunx tsc --noEmit`, `bunx biome check` en los archivos tocados (0 errores).
2. `bun run build:ui` (recordatorio permanente: el bundle no se reconstruye solo).
3. Test nuevo en `src/dashboard/__tests__/chat-sessions.test.ts` o `chat-turns` equivalente:
   sesión sin `task_id` en ningún turn → `hasPersistentWork: false` en la respuesta; sesión con
   un turn con `task_id` → `true`, y `getLastPersistentTaskId` devuelve ese id.
4. `bun run test:coverage` completo en verde.
5. **Gate en vivo, navegador real, los DOS casos del contrato:**
   - Caso 1: sesión de chat sin ninguna tarea creada — confirmar que el botón no está en el DOM
     (no solo invisible).
   - Caso 2: mandar un mensaje que dispare `autoTask` (mismo patrón que ya prueban los tests de
     `chat-sessions.test.ts` para auto-creación), confirmar que aparece el botón, click abre el
     workspace con el proyecto correcto seleccionado, tab `tasks` activo, `SidePanel` mostrando
     esa tarea, y volver a `Chat` desde el riel conserva la conversación completa.

## Evidencia de cierre

`docs/done/evidence/UI.8.4b-live.json`. Borrar este spec en el commit de cierre. Usar el mismo
patrón de sub-ítem que la pieza 1 (`UI.8.4a`) — este es `UI.8.4b`. **El `UI.8.4` padre NO cierra
todavía**: su propio texto en `PLAN.md` incluye el inspector condicional como tercer componente
(no solo el árbol de agentes y el contrato Chat→Workspace), y ese inspector no es parte de este
spec — queda para una pieza 3 aparte. No marcar el padre como `[x]` en este commit.
