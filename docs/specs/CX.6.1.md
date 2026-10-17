# CX.6.1 — Chat Codex (app-server): costo del turno entero y contexto del propio evento; Claude ignora subagentes

Hallado al verificar CX.6 en vivo (2026-10-17). Diff de CX.6 aún sin commitear en el árbol: trabajar encima.

## Evidencia
Turno real de chat Codex (`gpt-6-luna`, 2 herramientas). Rollout del hilo `01a14bf2-…`:
```
token_count last.input_tokens=23567 last.total=23623 total.input=23567
token_count last.input_tokens=23833 last.total=23919 total.input=47400
token_count last.input_tokens=32529 last.total=32569 total.input=79929   window=258400
```
El run quedó con `input_tokens=20881`, `cache_read_tokens=11648` → 32 529 = solo la ÚLTIMA llamada. Causa:
`src/run/executors/codex-app-server.ts:211` guarda `params.tokenUsage?.last` en `state.usage` y `:475-481` lo usa como
uso del turno → con herramientas el costo del chat Codex se subcuenta (aquí ~41 %).

Contrato (`codex app-server generate-ts`, v2):
```ts
ThreadTokenUsageUpdatedNotification = { threadId, turnId, tokenUsage: ThreadTokenUsage }
ThreadTokenUsage = { total: TokenUsageBreakdown, last: TokenUsageBreakdown, modelContextWindow: number | null }
TokenUsageBreakdown = { totalTokens, inputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens, reasoningOutputTokens }
```
Un `thread/tokenUsage/updated` por llamada al modelo (3 eventos = 3 llamadas en la corrida de arriba).

## Qué hacer
1. `codex-app-server.ts`: por turno, **sumar** cada `tokenUsage.last` recibido (input, cached, cacheWrite, output) →
   eso es el uso del turno para costo (`:475-481`). Guardar además el `last` final y `modelContextWindow`.
   Devolver `contextUsed = last.totalTokens` (del último evento) y `contextWindow = modelContextWindow` (null si null).
2. `codex.ts` `runCodexChat` (camino app-server, `:566`): usar esos dos valores en vez de
   `readCodexRolloutContext`; el rollout queda solo para `runCodexChatExec` (`:474`), donde `exec --json` no trae
   ventana (`turn.completed.usage` ya es acumulado ahí: no tocar ese costo).
3. `external.ts` `runClaudeCode` (`consumeLine`, `lastAssistant`): ignorar mensajes `assistant` con
   `parent_tool_use_id` no nulo (son de subagentes, con su propio contexto).

4. `handleApiChatSessionContext` (`src/dashboard/handlers/chat-sessions.ts`): si el run tiene `context_used_tokens`
   pero el `?model=` pedido difiere del modelo del run, `used` = el medido (el historial no cambia con el modelo) y
   `window` = `contextWindowFor(<pedido>)`, `source: 'estimated'`. Visto en vivo: el compositor pedía `gpt-6.1-sol`
   (Orquestador) tras un run con `gpt-6-luna` y el anillo volvía al acumulado.

## Tests
- App-server: los 3 eventos de arriba (como notificaciones) → costo input+cached = 79 929 en total
  (input sin caché + cacheRead), `contextUsed=32569`, `contextWindow=258400`. Un evento con `modelContextWindow: null`
  → `contextWindow` null.
- Claude: un `assistant` final con `parent_tool_use_id` no cuenta; el último del hilo principal sí.

## Qué NO se toca
Lo demás de CX.6, el anillo, `harness.ts`. Prohibido: `git stash`, `git commit`, `git checkout`/`restore`,
`prettier`. Escribes bajo el candado del cerebro.

## Verificación
`bun run typecheck`, `bun run lint`, `bun run test:coverage`. En vivo lo corre el cerebro.
