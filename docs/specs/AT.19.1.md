# AT.19.1 — Turnos reales para Claude en el chat (`--resume`), como Codex con `thread/resume`

Rol: criterio. GO de Carlos 2026-10-17. Modelo a copiar: el hilo de Codex (`src/run/executors/codex-app-server.ts:296-404`,
store en `src/db/chat-sessions.ts:213-231`).

## Hechos medidos (sonda del cerebro, 2026-10-17, CLI real, haiku)
- `claude -p --restricted --strict-mcp-config --tools Read --settings s.json --resume <id> "msg"` funciona y conserva el
  mismo `session_id`; el turno retomado recordó un dato del turno 1.
- **Al retomar, el `--append-system-prompt` nuevo NO se aplica**: turno 1 con "codename ECHO", turno 2 retomado con
  "codename FOXTROT" → respondió "ECHO". Por eso el estado fresco del proyecto va en el mensaje, como Codex
  (`<orchestos-context-update>`, `codex-app-server.ts:355-360`).
- La sesión del CLI vive en la carpeta de config de Claude asociada al `cwd`. Un chat sin proyecto usa un `cwd`
  temporal que se borra al terminar el turno (`chat.ts:1540,1595`): ahí no hay sesión que retomar.

## Qué cambiar
1. **DB** (`src/db/migrate.ts`, migración 26 siguiendo el patrón de la que añadió `codex_thread_id`, `:620-640`):
   columnas `claude_session_id TEXT NULL`, `claude_context_hash TEXT NULL`, `claude_message_count INTEGER NULL` en
   `chat_sessions`. En `src/db/chat-sessions.ts`, `getClaudeChatSession(id)` / `setClaudeChatSession(id, sessionId,
   hash, messageCount)` junto a las de Codex.
2. **`src/run/executors/external.ts`**:
   - `buildClaudeChatArgs` acepta `resumeSessionId?: string` y, si viene, añade `--resume <id>`.
   - `runClaudeChat` recibe `resumeSessionId?` y lo pasa. Si el CLI falla con sesión inexistente (leer el texto real
     que devuelve `claude -p --resume <uuid-inexistente>`; medirlo, no adivinarlo) lanza un error tipado
     (`ClaudeSessionNotFoundError` o un flag en `ExecutorExternalError`) para que el handler reintente.
3. **`src/dashboard/handlers/chat.ts`, rama `useClaudeCli` (`:1536-1597`)**:
   - Hash de contexto: reusar `codexContextHash` (exportarlo con un nombre neutro, p. ej. `chatContextHash`, sin
     cambiar su comportamiento; ignora la línea `Now:`).
   - Se puede retomar si: hay `session`, `hasProjectContext`, hay `claude_session_id` guardado y
     `claude_message_count === rawHistory.length` (si no coincide, otro CLI respondió entre medias o se borraron
     mensajes: no retomar).
   - Al retomar: `cliInput` = (si el hash cambió) `<orchestos-context-update>\n${systemPrompt}\n</orchestos-context-update>\n\n`
     + `combinedText` + `imageNote`. Sin `transcript`. Se sigue pasando `--append-system-prompt` (inofensivo).
   - Sin retomar: igual que hoy (`transcript` + mensaje).
   - Si retomar falla por sesión inexistente: un reintento sin `--resume` y con `transcript`, y un paso visible
     `persistChatStep({ type: 'reasoning', label: 'Claude session expired — started a new one (earlier turns were resent)' })`
     (mismo texto que Codex, `codex-app-server.ts:348-351`).
   - Tras un turno correcto con proyecto: `setClaudeChatSession(session.id, result.sessionId, hash, rawHistory.length + 2)`
     (historia previa + mensaje del usuario + respuesta). Verificar en el código que el mensaje del usuario y la
     respuesta se guardan en `chat_messages` y que `+2` corresponde; si el conteo real difiere, usar el real.
   - Sesión sin proyecto: sin cambios (transcript, cwd temporal).
4. **Tests unitarios**: `buildClaudeChatArgs` con y sin `resumeSessionId`; la decisión retomar/no retomar (extraerla a
   una función pura testeable: entrada = guardado + `rawHistory.length` + `hasProjectContext` + hash; salida =
   `{ resume, includeTranscript, contextUpdate }`); migración 26 crea las columnas.
5. **Gate en vivo**: ampliar `scripts/ui-gate/flows/chat-continuity.mjs` (ya tiene una sesión Claude, `:143-152`):
   leer `chat-cli-input-<sessionId>.txt` de `ORCHESTOS_GATE_CAPTURE_DIR` (lo escribe `captureChatCliInput`,
   `chat.ts:132`) y afirmar que el turno 2 de Claude **no** contiene `Conversation so far` y que la respuesta sigue
   recordando el dato del turno 1. Si la captura se sobrescribe por turno, afirmar sobre la última. Al cambiar texto o
   selectores, `rg` en todo `scripts/ui-gate/` (lección de `AGENTS.md`).

## No tocar
- Codex, OpenCode, camino API/OpenRouter, `buildChatTranscript`, el marcador de tareas, `buildAutoTaskInstruction`.
- No commitear, no tocar `PLAN.md`/`NEXT.md`, no `git stash`.

## Verificación (el ejecutor la corre; el cerebro la repite)
- `bunx tsc --noEmit`
- `bun run test:coverage`
- `bun run gate:evidence -- --label AT.19.1-chat-live -- bun run ui:gate chat-continuity chat-streaming codex-live chat-context`
- Reportar `context_tokens`/`input_tokens` del turno 2 de Claude antes y después (de la DB del gate o del log).
