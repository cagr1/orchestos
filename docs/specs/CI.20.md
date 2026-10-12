# CI.20 — `chat-continuity` lee la respuesta equivocada del DOM tras recargar

Único archivo: `scripts/ui-gate/flows/chat-continuity.mjs`, función `sendTurn` (líneas 16-43).

## Defecto (pre-push 2026-10-11, 2 de 2)

`Claude recalls sentinel after reload in API and DOM` falla con `API: R82-…` / `DOM: OK`, y la captura muestra el
centinela pintado correctamente. `sendTurn` hace `previousReplyCount = count('div.prose')` y luego lee
`nth(previousReplyCount)`. Tras `reopenSession` (recarga) el historial aún no está hidratado: cuenta 0 y lee la
respuesta del turno anterior (`OK`).

## Cambio

En `sendTurn`, dejar de leer por índice: leer la **última** `div.prose` (`page.locator('div.prose').last()`) y
seguir sondeando hasta que su texto contenga `apiText` (mismo tope de 30 s). Quitar `previousReplyCount`. El valor
devuelto no cambia de forma: `{ api, dom }`, con `dom` = último texto leído.

No tocar ningún otro flow ni archivo. No commitear. No tocar `PLAN.md`/`NEXT.md`. No correr `ui:gate` ni
`test:coverage`. El candado `ocupado: claude …` es el cerebro que delega: seguir.

Verificación: `node --check scripts/ui-gate/flows/chat-continuity.mjs` y
`bunx biome check scripts/ui-gate/flows/chat-continuity.mjs`.
