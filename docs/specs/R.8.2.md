# R.8.2 — Continuidad historial→CLI tras recarga (spec)

GO de Carlos 2026-10-10. Hallazgo 1 de Sol (`docs/done/evidence/R.8-revision-sol-2026-10-05.md:19`).

## Defecto (verificado leyendo código)
- **Claude:** `runClaudeChat` (`src/run/executors/external.ts:384`) solo recibe `systemPrompt` + `combinedText`
  (`src/dashboard/handlers/chat.ts:1475-1480`). El historial de `chat.ts:1063-1069` solo llega al camino API
  (`chat.ts:1298`). Cada turno de Claude es `claude -p` sin memoria, con o sin recarga.
- **Codex:** el thread persiste en `chat_sessions.codex_thread_id`, así que sobrevive a la recarga. Si `thread/resume`
  falla por thread expirado, `codex-app-server.ts:311-332` abre uno nuevo y pierde los turnos previos. Lo mismo pasa
  con cualquier thread nuevo en una sesión que ya tiene mensajes.

## Cambios
1. **`src/dashboard/handlers/chat.ts`** — función pura exportada
   `buildChatTranscript(history: {role,content}[]): string`:
   - recibe `history` (ya recortado a 10, `chat.ts:1069`) y filtra a `user`/`assistant`;
   - devuelve `''` si queda vacío;
   - si no, devuelve un bloque que empieza con una línea fija `Conversation so far in this chat (oldest first):`,
     seguida de cada mensaje `User:`/`Assistant:`, y termina con `Current message:\n`;
   - el contenido del asistente va envuelto con `untrustedContent('chat-history:assistant', …)`
     (`src/security/untrusted-content.ts:2`); el del usuario va en texto plano.

   Usarla para la entrada del CLI, NO para el camino API (ese ya manda `messages`):
   - Claude: `runClaudeChat(..., transcript + combinedText, ...)`.
   - Codex: pasar `transcript` como parámetro nuevo de `runCodexChat` → `server.turn({ ..., transcript })`.
2. **`src/run/executors/codex.ts`** (`runCodexChat`, `:394`) — parámetro nuevo opcional `transcript?: string`,
   al final de la firma para no romper llamadas existentes, reenviado a `server.turn`. El camino `runCodexChatExec`
   (sin sessionId) no cambia.
3. **`src/run/executors/codex-app-server.ts`** (`turn`, `:259`) — `input.transcript?: string`. Se antepone al mensaje
   **solo cuando el thread es nuevo en este turno**: rama `!threadId` (`:284`) o `threadRecreated`. Con el thread
   reanudado no se antepone, porque Codex ya tiene esos turnos y duplicarlos gasta tokens. El texto del paso
   "Codex thread expired…" (`:330`) pasa a decir que los turnos previos se reenviaron cuando haya transcript.
4. **Captura para el gate** — solo con `process.env.ORCHESTOS_GATE_CAPTURE_DIR`, mismo patrón try/catch que
   `chat.ts:1286-1294`. Se sobrescribe en cada turno `chat-cli-input-<sessionId>.txt` con el texto exacto que recibe
   el CLI:
   - Claude: escribir en `chat.ts` justo antes de `runClaudeChat`.
   - Codex: escribir en `codex-app-server.ts` justo antes de `turn/start`, con el `message` final.
5. **Gate nuevo `scripts/ui-gate/flows/chat-continuity.mjs`** — copiar helpers y fixture de `chat-context.mjs`
   (`sendTurn`, `startChat`, `selectClaudeHaiku`, proyecto temporal con `writeGateRoles`, cleanup con purge) y la
   recarga + reselección de sesión de `codex-live.mjs:287-299`. Centinela: `R82-` + 8 hex aleatorios por corrida.
   - **Claude (Haiku):**
     1. Turno 1: `Remember this code for later: <S>. Reply only OK.`
     2. Recargar la página y reabrir la misma sesión.
     3. Turno 2: `What was the code I gave you earlier in this chat? Reply with only the code.`
     4. Pasos:
        - (a) el texto del turno 2 no contiene `<S>`;
        - (b) `chat-cli-input-<id>.txt` contiene `<S>`;
        - (c) la respuesta contiene `<S>`.
   - **Codex (gpt-6-luna, como chat-context):**
     1. Turno 1, recarga y turno 2, igual que Claude.
     2. Pasos:
        - (d) la respuesta contiene `<S>`;
        - (e) la captura del turno 2 NO contiene `<S>`. Eso prueba que la memoria viene del thread y que no hay
          duplicado.
     3. Luego simular la expiración: `UPDATE chat_sessions SET codex_thread_id = '<uuid aleatorio>' WHERE id = ?`
        sobre `databasePath` (patrón `runJson` de chat-context).
     4. Turno 3, la misma pregunta.
     5. Pasos:
        - (f) la captura contiene `<S>`;
        - (g) la respuesta contiene `<S>`.
     6. Si el error real de Codex para un thread inexistente no lo reconoce `isExpiredThreadError`
        (`codex-app-server.ts:421`), **no** ampliar el regex a ciegas: reportar el mensaje real y parar.
6. **`scripts/pre-push.sh`** — añadir `chat-continuity` al bloque de chat (`:97`, junto a `chat-streaming codex-live`)
   y al regex `chat_paths` (`:65`).

## Tests unitarios
- `buildChatTranscript`:
  - vacío → `''`;
  - orden más antiguo primero;
  - asistente envuelto en `untrusted-data`;
  - ignora roles que no son user/assistant.
- `codex-app-server.test.ts`, con el server falso existente:
  - thread nuevo + transcript → el `turn/start` lleva el transcript;
  - thread reanudado → no lo lleva;
  - thread expirado → lo lleva.
- `claude-chat.test.ts`: si existe un doble de `runClaudeChat`/handler, que el userMessage del turno 2 incluya el
  turno 1. Si no hay forma sin spawn, basta el test de `buildChatTranscript` y el gate.

## No tocar
- El camino API (`messages`).
- `runCodexChatExec`.
- El límite de 10.
- Imágenes del historial.
- R.8.4 (reinicio del dashboard).
- `read-boundary.mjs`, `IDEAS.md`, `orchestos.config.yaml` (ajenos).

## Verificación (cerebro)
- `bunx tsc --noEmit`
- `bun run test:coverage`
- `bun run gate:evidence -- --label R.8.2-chat-continuity -- bun run ui:gate chat-continuity`
- `bun run gate:evidence -- --label R.8.2-chat-live -- bun run ui:gate chat-streaming codex-live`
