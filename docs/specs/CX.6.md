# CX.6 — El anillo de contexto muestra el contexto real, en Chat y en Dev

Pedido de Carlos 2026-10-14: "me interesa ver el context window, en el chat y en el chat del Dev", con números
reales, no calculados. Regla vigente (memoria `feedback-context-no-max-tokens`): la ventana nunca sale de catálogo.

## Lo que hay hoy (verificado por lectura, `leer` 2026-10-14)
- Chat y Dev: `ContextRing` recibe `used`, `window`, `pct`, `model` de `sessionContext`
  (`OrchestChatView.tsx:271`, `OrchestDevWorkspace.tsx:1016`).
- `chat-sessions.ts:378-382`: `used` = entrada + caché leída + caché escrita + salida del último run del turno;
  `window` = `contextWindowFor(model)` → **de catálogo**. En un turno con varias llamadas al modelo (herramientas),
  el uso del run es acumulado: el anillo puede mostrar más de lo que de verdad ocupa el contexto.
- `scripts/context-adapters.ts:133-151` ya lee de Codex `last_token_usage.total_tokens` y `model_context_window`
  del evento `token_count` (no confirmado que alimente el anillo de Dev).

## Qué hacer
1. **Medir lo que reporta el CLI**, por adaptador (capa común + adaptador por CLI, nada solo para un LLM):
   - Contexto usado = tamaño del prompt de la ÚLTIMA llamada al modelo del turno (Claude: `usage` del último mensaje
     `assistant` del stream: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`; Codex:
     `last_token_usage` del último `token_count`, o el equivalente que emita `exec --json` — comprobarlo con una
     corrida real y pegar la línea en el reporte).
   - Ventana = la que reporta el CLI (Claude: `modelUsage[<modelo>].contextWindow` del evento `result`; Codex:
     `model_context_window`). Solo si el CLI no la reporta, catálogo, y el anillo lo dice ("estimado").
2. Guardar ambos en el run (migración numerada, no `safeAddColumn`) y que `sessionContext` los use.
3. **Dev**: averiguar de dónde saca hoy el anillo de Dev sus números (sesión CLI abierta en la terminal: transcript
   de Claude `~/.claude/projects/*.jsonl` / rollout de Codex) y aplicar la misma regla: último prompt real / ventana
   reportada. Reutilizar `scripts/context-adapters.ts` si sirve (moverlo a `src/` si el dashboard lo necesita).
4. Tooltip del anillo: "N de M tokens · fuente: <CLI> (medido)" o "(estimado)".

## Qué NO se toca
El diseño visual del anillo. `harness.ts` solo si es imprescindible (entrada en `LEDGER.md`). Prohibido:
`git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado del cerebro.

## Verificación
- `bun run typecheck`, `bun run lint`, `bun run test:coverage`; tests con líneas de stream reales capturadas.
- En vivo (el cerebro lo vuelve a correr): un turno con herramientas en Chat (Claude y Codex) → el anillo muestra el
  `used` y la `window` exactos del stream crudo (comparar con el log del run); en Dev, el anillo coincide con lo que
  el propio CLI reporta para esa sesión (`/context` de Claude o `token_count` de Codex).
