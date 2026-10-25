# CHAT.3 — Si el modelo no responde, el chat dice por qué, en el momento

Ítem: PLAN.md § CHAT.3. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. **PROHIBIDO `git stash`,
`git checkout`, `git restore`.**

## Pedido de Carlos (2026-10-25)
"Si el modelo no responde tiene que mostrarme un mensaje inmediatamente del por qué no responde; existen muchos
errores." Contexto: CI.11 midió que Codex a veces espera al modelo 2 min sin recibir nada y el hilo solo muestra
`Thinking` y al final `Codex CLI: Codex timed out after 120000ms`.

## Principio
Cada causa conocida se muestra en el hilo **en cuanto OrchestOS la sabe**, con el motivo concreto, nunca un genérico.
Lo que no se sabe no se inventa: si el CLI no informa causa, el hilo dice exactamente lo que sí se sabe (petición
enviada al modelo hace N s, sin error reportado). Capa común + adaptador por CLI (memoria: detección genérica, no por
CLI): el front no conoce Codex ni Claude, solo avisos tipados.

## Cambios
1. **Tipo común** (junto a `ExecutorStepEvent`, `src/run/executors/`): un paso de turno `notice` con
   `{ kind, message, detail? }`. `kind` ∈ `retrying`, `quota`, `rate-limit`, `auth`, `network`, `overloaded`,
   `invalid-model`, `no-response`, `process-exit`, `timeout`, `unknown`. Un clasificador común
   `classifyCliFailure(text): kind` por patrones de texto (429/rate limit, quota/usage limit, 401/403/unauthorized/
   login, ENOTFOUND/ECONNRESET/stream disconnected/network, 503/529/overloaded, model not found/unsupported model),
   con tests de tabla. `unknown` conserva el texto original.
2. **Adaptador Codex** (`src/run/executors/codex-app-server.ts`, despacho de `notification`):
   - `error` con `willRetry=true` → `notice` `retrying` con el mensaje de Codex (p. ej. reconexión n/m), sin fallar
     el turno. Hoy se descarta (`~:496`).
   - `account/rateLimits/updated` con algún límite usado ≥ 100 % → `notice` `quota` con la hora de reinicio si viene.
   - `error` sin reintento, `turn/completed` `failed`, salida del proceso y timeout → mensaje final clasificado.
   - Silencio: tras `turn/started` sin ningún delta ni item del modelo, el estado vivo del hilo pasa a decir
     "Request sent to <modelo> Ns ago — no response yet, no error reported by Codex" (actualizado con el contador
     que ya existe). Sin umbrales nuevos de timeout.
3. **Adaptador Claude** (`src/run/executors/external.ts`, stream `stream-json`): mapear al mismo `notice` los eventos
   de reintento/error de API que emita el CLI instalado. **Verificar con el binario real** qué emite (capturar un
   `stream-json` de una petición con modelo inválido); no suponer nombres de eventos. Si no emite reintentos, solo el
   fallo final clasificado.
4. **Fallo final** (`src/dashboard/handlers/chat.ts`, respuesta 502 y adaptadores en `chat-adapters.ts`): el texto
   que ve el usuario es el mensaje clasificado en inglés (idioma de la UI), con el texto crudo del CLI como `detail`.
   Ejemplos: timeout sin respuesta → "No response from gpt-6.1-sol in 120 s. Codex reported no error: the request
   reached the model provider and it never answered."; cuota → "Codex usage limit reached — resets at 15:00.";
   modelo inválido → "Model 'x' is not available for Codex CLI." El crudo sigue visible al expandir.
5. **Front** (hilo del chat: `OrchestChatView.tsx`, `ThreadThinking.tsx`, `thinking.ts`): los `notice` aparecen en el
   hilo en cuanto llegan por el sondeo de 300 ms existente, como una línea discreta dentro del turno (familia UI.24:
   un acento, sin degradados, sin texto de relleno); el fallo final reemplaza la alerta cruda por el mensaje
   clasificado + detalle plegable. Sin CSS nuevo en `styles.css`; clases Tailwind del hilo existente.

## No tocar
Timeouts, reintentos, orden de requests, la instrumentación `[codex-turn]` de CI.11 (puede leer sus contadores),
otros flujos y vistas fuera del hilo del chat.

## Verificación (pegar salida)
    bun run typecheck
    bunx biome check <archivos tocados>
    bun test <tests tocados>   # incluye la tabla del clasificador y un turno Codex falso con error willRetry,
                               # rateLimits al 100 % y timeout: cada uno produce el notice esperado
    bun run test:coverage
    bun run gate:evidence -- --label CHAT.3-chat-live -- bun run ui:gate chat-streaming codex-live
En vivo, con navegador real (dashboard en home temporal, `NEXT.md` § Trampas vivas): un turno con un modelo inválido
en Codex muestra el mensaje clasificado en el hilo (captura); un turno normal no muestra ningún `notice`.
