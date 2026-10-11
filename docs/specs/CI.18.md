# CI.18 — `chat-roles` registra por qué falla el paso del marcador (spec)

## Defecto
"Orchestrator marker creates a held task without Auxiliary" (`scripts/ui-gate/flows/chat-roles.mjs:~156`) falló 3 veces
en el pre-push completo. Aislado pasa. Hoy el detalle solo dice `No held task label visible`, que no distingue entre:
- (a) Codex respondió sin el marcador;
- (b) el backend creó la tarea, pero la UI no la mostró;
- (c) el turno no terminó (`sendTurn` devolvió false).

## Cambios (solo `chat-roles.mjs`; diagnóstico, sin cambiar qué se exige)
1. `sendTurn` guarda en una variable del flujo (`lastTurn`) lo siguiente del POST `/api/chat` que ya espera:
   - `status` HTTP;
   - `text`;
   - `autoTask`;
   - `autoTaskSkipped`, si el JSON los trae.
   Se lee con `await postResponse.json().catch(() => null)`. La forma de devolver `true`/`false` no cambia.
2. El detalle del paso del marcador pasa a ser un JSON con:
   - `secondTurnDone`;
   - `httpStatus`;
   - `apiText`, los últimos 400 caracteres;
   - `hasMarkerLine`: si alguna línea de `apiText` empieza por `[[orchestos:task]]`. Si el handler ya lo quitó del
     texto, vale null. Mirar en `src/dashboard/handlers/chat.ts` qué devuelve (`settleTaskIntent`) y documentarlo en un
     comentario de una línea.
   - `autoTask`;
   - `autoTaskSkipped`;
   - `dbTasks`: las tareas del proyecto en la DB (`id`, `status`, y `held` si existe la columna), con el mismo patrón
     `runJson` de solo lectura que `firstTurn`;
   - el texto del label, o `missing`.
3. Si el paso falla, tomar `await shot('marker-failure')` antes de seguir, para no perder la captura cuando el siguiente
   `evaluate` lanza un timeout.

## No tocar
El resto de pasos y aserciones, los timeouts y los demás archivos.

## Verificación (cerebro)
- `node --check`
- `bunx biome check scripts/ui-gate/flows/chat-roles.mjs`
- `bun run ui:gate chat-roles`: tiene que seguir pasando 11/11, con el detalle nuevo poblado.
- Luego, 3 corridas del set completo del pre-push para medir.
