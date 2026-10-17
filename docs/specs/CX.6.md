# CX.6 — El anillo de contexto muestra el contexto real, en Chat y en Dev

Pedido de Carlos 2026-10-14: "me interesa ver el context window, en el chat y en el chat del Dev", con números
reales, no calculados. Regla vigente (memoria `feedback-context-no-max-tokens`): la ventana nunca sale de catálogo
si el CLI la reporta.

## Lo que hay hoy (verificado 2026-10-17, revisado contra AT.19.1–AT.21)
- Chat y Dev usan el MISMO endpoint: `getSessionContext` → `/api/chat/sessions/:id/context`
  → `handleApiChatSessionContext` (`src/dashboard/handlers/chat-sessions.ts:373-387`). Dev no lee transcripts.
- `used` = `input + cache_read + cache_write + output` del run (`chat-sessions.ts:384`); `window` =
  `contextWindowFor(model)` → catálogo (`:385`).
- Claude: `src/run/executors/external.ts:515-521` (y `:612`, camino `--resume` de AT.19.1) toma `usage` del evento
  `result` — **acumulado de todas las llamadas del turno**. Codex: `src/run/executors/codex.ts:264` toma
  `turn.completed.usage` — **también acumulado**. Con AT.20/AT.21 (herramientas MCP) casi todo turno tiene varias
  llamadas, así que el anillo hoy marca de más.

## Corridas reales (2026-10-17, turno con 2 herramientas)
Claude (`claude -p --output-format stream-json --verbose --model haiku`), mensajes `assistant` (un mismo mensaje se
repite por bloque de contenido; quedarse con el último):
```
{"i":2,"cr":8867,"cw":13355,"o":5}      ← llamada 1
{"i":2,"cr":22222,"cw":482,"o":4}       ← llamada final: contexto real = 2+22222+482 = 22706
result.usage: {"input_tokens":4,"cache_read_input_tokens":31089,"cache_creation_input_tokens":13837,"output_tokens":362}  ← acumulado 44930
result.modelUsage: {"claude-haiku-5-5":{...,"contextWindow":1000000,"maxOutputTokens":128000,...}}
```
Codex (`codex exec --json`): `turn.completed.usage.input_tokens` = 41364 (acumulado) y **no emite la ventana**. El
rollout `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*-<thread_id>.jsonl` sí (el `thread_id` viene en `thread.started`,
ya capturado en `codex.ts:262`; `CODEX_HOME` es el del env del spawn, `codex.ts:353`):
```
{"payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":20785,...,"total_tokens":20790},"total_token_usage":{"input_tokens":41364,...},"model_context_window":258400}}}
```
El último `token_count` es el contexto real. `scripts/context-adapters.ts:133-151` (`codexAdapter.read`) ya lo
parsea y es reutilizable.

## Qué hacer
1. Capa común: el resultado del ejecutor lleva `contextUsed: number | null` y `contextWindow: number | null`, aparte
   del uso acumulado (que sigue siendo el de costo; no tocarlo).
   - Claude (`external.ts`, ambos caminos): `contextUsed` = `input + cache_read + cache_creation` del `usage` del
     último mensaje `assistant` del stream; `contextWindow` = `result.modelUsage[<modelo del último assistant
     (message.model)>].contextWindow`, o el único/mayor si no casa.
   - Codex (`codex.ts`): al terminar, buscar el rollout por `thread_id` bajo el `CODEX_HOME` del spawn y leer el
     último `token_count` con el adaptador (`last_token_usage.total_tokens`, `model_context_window`). Si no aparece,
     `null` (no inventar).
   - Otros ejecutores: `null` → el endpoint cae al cálculo de hoy marcado como estimado.
   - Si `scripts/context-adapters.ts` lo necesita `src/`, moverlo a `src/` y dejar los imports de `scripts/` apuntando
     ahí.
2. Migración **27** numerada en `src/db/migrate.ts` (patrón de la 26, con postcondición): `runs.context_used_tokens
   INTEGER NULL`, `runs.context_window_tokens INTEGER NULL`; `src/db/runs.ts` los escribe y lee.
3. `handleApiChatSessionContext`: si el run tiene ambos y no hay `?model=` distinto del modelo del run → `used`/`window`
   medidos, `source: 'measured'`. Si no → cálculo de hoy, `source: 'estimated'`. Respuesta añade `source` y `engine`
   (el CLI que corrió el run); el tipo en `src/dashboard/app/src/api/chat.ts` también.
4. Tooltip del anillo (Chat `OrchestChatView.tsx` y Dev `OrchestDevWorkspace.tsx`): "N de M tokens · <CLI> (medido)"
   o "(estimado)". Sin cambiar el diseño visual del anillo.

## Qué NO se toca
El diseño visual del anillo. El uso acumulado y el cálculo de costo. `harness.ts` solo si es imprescindible (entrada
en `LEDGER.md`). Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado
del cerebro.

## Verificación
- Tests con las líneas reales de arriba como fixture: Claude → 22706 / 1000000; Codex (rollout en tmpdir con
  `CODEX_HOME` pasado por env, nunca `process.env` mutado) → 20790 / 258400; run sin datos → `estimated`.
- Test de la migración 27 (columnas presentes, idempotente).
- `bun run typecheck`, `bun run lint`, `bun run test:coverage`.
- En vivo (lo corre el cerebro): un turno con herramientas en Chat con Claude y con Codex → el endpoint devuelve el
  `used`/`window` del stream/rollout crudo de ese run; en Dev, el mismo número en el anillo.
