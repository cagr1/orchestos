# CI.25 — El turno de Claude en `chat-continuity` no responde en 180 s, sin rastro

**Ahora se reproduce siempre** (2026-10-14: pre-push de `5d67f56` ×2 y `bun run ui:gate chat-continuity` a solas ×1,
todos `page.waitForResponse: Timeout 180000ms`). El push anterior (`777ad20`) pasó `chat-continuity` 8/8 y desde
entonces solo cambiaron comentarios y docs. Lo que sí cambió: Claude Code se actualizó a **2.1.300**.

Datos del cerebro:
- `claude -p "Reply only OK" --model haiku --output-format stream-json --verbose --include-partial-messages
  --restricted --strict-mcp-config --tools Read,Glob,Grep --settings <settings vacío> --add-dir <dir>` con el HOME
  real responde en 2,5 s.
- El mismo comando con un `HOME` temporal responde al instante `"result":"Not logged in · Please run /login"`
  (`is_error: true`, `terminal_reason: api_error`) — no se cuelga.
- `dashboard.log` del gate no registra nada del spawn de chat.

## Qué hacer
1. **Evidencia primero**: que el chat registre en `dashboard.log` por cada spawn de CLI de chat: agente, pid, args
   (sin el prompt), cwd, variables de entorno relevantes (`HOME`, `CLAUDE_CONFIG_DIR`, `PATH` recortado), ms hasta el
   primer byte, exit code y las últimas líneas de stderr. Mismo rastro para Codex (sirve a CI.11).
2. Correr `bun run ui:gate chat-continuity`, leer ese rastro y el flujo (`scripts/ui-gate/flows/chat-continuity.mjs`)
   y encontrar la causa: qué petición espera, qué CLI, con qué entorno, por qué no responde (¿HOME/credenciales del
   entorno del gate? ¿un "Not logged in" que el chat no convierte en respuesta? ¿proceso que no termina?).
3. Arreglar la causa en el producto (no en el gate, salvo que el defecto sea del gate). Si el CLI devuelve un error
   (`is_error: true`), el chat debe mostrarlo como error visible en el turno, nunca quedarse esperando.

Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado del cerebro.
`src/run/harness.ts` no se toca sin entrada en `LEDGER.md`.

## Verificación
`bun run typecheck`, `bun run lint`, `bun run test:coverage`; `bun run ui:gate chat-continuity` 3 veces seguidas en
verde; test que cubra "CLI de chat responde con `is_error`" → error visible. Reporte con la causa demostrada (líneas
del rastro nuevo).
