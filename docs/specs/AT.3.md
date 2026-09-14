# AT.3 — El chat no crea conversaciones que nacen muertas

Ejecutor: Luna. Implementa exactamente esto; si algo resulta imposible, para y repórtalo.
**No commitees y no toques `PLAN.md`.** El cierre (con gate en navegador) lo hace el cerebro.

Preflight: `bun run agent:preflight -- --item AT.3 --agent luna`.

## Problema

`send()` en `src/dashboard/public/screens-core.js:698` crea la sesión con
`App.ensureChatSession()` y recién después `/api/chat` rechaza al agente sin frontera de lectura
(`src/dashboard/handlers/chat.ts:762-763`). El agente de una sesión es inmutable: cada intento
deja una conversación inservible en el aside.

## Cambio

1. `src/run/executors/cli-registry.ts`: exportar
   `projectChatUnavailableMessage(label: string, reason: string): string` que devuelve
   `` `CLI "${label}" no está disponible para chat de proyecto: ${reason}` ``.
   `projectChatReadBoundaryError` en `chat.ts:120` pasa a usarla (mismo texto, cero cambio de comportamiento).
2. `src/dashboard/handlers/chat-sessions.ts` `handleApiChatSessionsCreate`: justo después del
   `return errorResponse('Invalid agent', 400)`, si `projectId !== null`, buscar en `KNOWN_CLIS`
   la definición con `id === agent`; si existe y `definition.readBoundary.kind !== 'project-root'`,
   devolver `errorResponse(projectChatUnavailableMessage(definition.label, definition.readBoundary.reason), 400)`.
   Se valida la frontera **declarada**, no la efectiva: no depende de binarios del host (CI no
   tiene `claude`). La efectiva sigue validándose al enviar, como hoy.
3. `src/dashboard/public/screens-core.js` `send()`: envolver `await App.ensureChatSession()` en
   `try/catch`; en el catch, `showToast(error.message || t('chat.err.general'), 'error')` y `return`
   (el texto queda en el textarea, no se agrega mensaje).
4. `src/dashboard/public/app.js` `startNewChatSession()`: el `catch` recibe el error y llama
   `showToast(error.message || t('chat.err.conn'), 'error')`. Nada más cambia.
   Sin claves nuevas en `i18n.js`.

## Test nuevo en `src/dashboard/__tests__/chat-sessions.test.ts`

Mismo patrón `runIsolated` del test "implements CRUD…": con el proyecto `p1`,
- POST `{ projectId: 'p1', agent: 'codex' }` → 400, `error` contiene `no está disponible para chat de proyecto`, y `listChatSessions`/SELECT no tiene filas nuevas.
- POST `{ projectId: null, agent: 'codex' }` → 201 (sesiones generales no cambian).

## Gates del ejecutor

`bun test src/dashboard/__tests__/chat-sessions.test.ts` verde · `bunx tsc --noEmit` limpio ·
`bun run lint` exit 0 · `git status` muestra solo los 5 archivos de arriba.
