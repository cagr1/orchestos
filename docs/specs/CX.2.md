# CX.2 — El anillo de contexto mide el hilo activo y se recalcula al cambiar de modelo (spec para Luna)

Ítem: PLAN.md § CX.2. Decisión de Carlos (2026-10-04): es información, no un aviso. Muestra cuánto de la ventana
del modelo ocupa la conversación, como en Claude Desktop. Si se cambia de modelo, el % cambia según la ventana del
modelo nuevo, con los colores que ya existen (naranja ≥60, rojo ≥80). Depende de CX.4: los runs ya guardan
`cache_read_tokens` y `cache_write_tokens`.

## Hoy

- El header del chat (`OrchestChatView.tsx:135,205-210`) toma `sessionStatus.clis[cli].context`, que sale de
  `scripts/session-status.ts:176-195`: el transcript **más reciente** de ese CLI en el proyecto. Puede ser un tab de
  Claude Code ajeno a la conversación abierta.
- El modelo elegido vive dentro de `AgentComposer` (`selectedModel`, `AgentComposer.tsx:103,314`) y nadie se
  entera de que cambió hasta el próximo envío.
- Cada turno del chat manda historial y contexto completos a un proceso nuevo del CLI (sin resume). Por eso el
  contexto del hilo es el prompt del último turno más su respuesta.

## Cambios

1. **Backend, `GET /api/chat/sessions/:id/context?model=<id>`**:
   - Registrar la ruta en `src/dashboard/server.ts` junto a `/timeline` (~línea 414) y sumar `|\/context` al regex
     de `sessionIdFromUrl` (`chat-sessions.ts:83`).
   - Handler `handleApiChatSessionContext(url)` en `chat-sessions.ts`. Respuestas:
     - sesión inexistente → 404;
     - si no, buscar el último turno con `run_id` de esa sesión (`chat_turns` ORDER BY `created_at` DESC) y su run
       (`getRun`);
     - sin run → `{ used: null, window: null, pct: null, model: null }`;
     - con run: `used = input_tokens + cache_read_tokens + cache_write_tokens + output_tokens`,
       `model = query.model?.trim() || run.model`,
       `window = await contextWindowFor(model)` de `scripts/context-budget.ts:69` (solo catálogo, `null` si es
       desconocida: nunca se inventa una ventana) y `pct = window ? used / window * 100 : null`.
2. **`AgentComposer.tsx`**: prop opcional `onSelectionChange?: (cli: CliId, model: string) => void`, llamada desde
   un `useEffect` cuando cambian `activeCli` o `effectiveSelectedModel`. Nada más del composer cambia.
3. **`api/chat.ts`**: `getSessionContext(sessionId, model, projectId)` →
   `{ used: number|null; window: number|null; pct: number|null; model: string|null }`, con el mismo patrón de
   headers que `getTimeline`.
4. **`OrchestChatView.tsx`**:
   - Estado `composerModel` alimentado por `onSelectionChange`.
   - Pide `getSessionContext(thread.id, composerModel, thread.projectId)` cuando cambia el id del hilo, el
     `composerModel` o la cantidad de mensajes del hilo.
   - El `ContextRing` del header usa esa respuesta (`percent=pct`, `model`, `usedTokens=used`,
     `maxTokens=window`) **en lugar de** `sessionStatus` para este header. `pct: null` → el anillo no se muestra,
     igual que hoy.
   - No tocar la barra de estado inferior ni otros consumidores de `sessionStatus`.
5. **Gate, `scripts/ui-gate/flows/chat-streaming.mjs`**: después del primer turno real ya verificado, sumar dos
   pasos:
   - `context ring reflects thread`: el elemento con `aria-label` `Context window usage: N%` es visible, con N > 0.
   - `context ring recalculates on model change`: abrir el selector de modelo, como el flujo ya hace en ~línea 70, y
     elegir otro modelo con ventana conocida y distinta. Sin enviar nada, el % cambia en menos de 5 s. Si el
     catálogo no da una ventana distinta para ningún modelo visible, el paso falla con un detalle claro: no se
     salta.

## Tests

- Handler: sesión con un turno cuyo run tiene `input 100`, `cache_read 9000`, `cache_write 500` y `output 400` →
  `used 10000`. Con `?model=` de un modelo del catálogo usa su ventana, y uno desconocido da `window: null` y
  `pct: null`. Sesión sin turnos → todo `null`. Sesión inexistente → 404. Seguir el patrón de tests de
  `chat-sessions`.
- `AgentComposer.test.ts`: si el patrón existente lo permite, cubrir que `onSelectionChange` se llama al cambiar de
  modelo.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos) · `bun run build:app` · `bun test` completo. El cerebro
corre `test:coverage` y `ui:gate chat-streaming codex-live` en vivo.

## Fuera de alcance

`scripts/session-status.ts`, el hook de Claude Code, la pantalla de uso (CX.5) y estilos o CSS nuevos (el
`ContextRing` ya existe). No commitear ni tocar `PLAN.md`.
