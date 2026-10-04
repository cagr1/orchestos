# CX.4 — Los runs guardan tokens reales (spec para Luna)

Ítem: PLAN.md § CX.4. Plan aprobado por Carlos (2026-10-04).

## Bug medido (DB real, 2026-10-04)

- Claude: 11 runs suman **30** tokens de input. `src/run/executors/external.ts:64,444,534` lee solo
  `usage.input_tokens` y descarta `cache_read_input_tokens` y `cache_creation_input_tokens`, que en Claude son la
  mayor parte del prompt. El costo sí es real (`total_cost_usd` del CLI); lo que está mal son los tokens.
- Codex: `codex.ts:217-238` (`parseCodexStream`) y el parser del chat de Codex (~línea 497) leen `input_tokens` y
  `output_tokens`, pero ignoran `cached_input_tokens`. En OpenAI, `input_tokens` **incluye** los cacheados, así
  que `calcCost` cobra todo a precio completo.
- Las corridas del chat guardan `elapsed_ms: 0` (`src/dashboard/handlers/chat.ts:577,1016,1392`).

## Semántica, igual para todos los proveedores

`runs.input_tokens` = input **no** cacheado; `cache_read_tokens` = input leído de caché;
`cache_write_tokens` = input escrito a caché. Prompt total = la suma de los tres.

## Cambios

1. **Migración 20** en `src/db/migrate.ts` (después de la 19, mismo patrón con postcondition):
   `ALTER TABLE runs ADD COLUMN cache_read_tokens INTEGER NOT NULL DEFAULT 0` y lo mismo para
   `cache_write_tokens`. La postcondition verifica las dos columnas con `PRAGMA table_info(runs)`.
2. **`src/db/runs.ts`**: `RunRecord` suma `cache_read_tokens: number` y `cache_write_tokens: number`. `insertRun`
   los inserta, con default 0 si el llamador no los pasa (en `InsertRunRecord` van opcionales).
3. **Claude (`external.ts`)**: `ClaudeCodeJson.usage` suma `cache_read_input_tokens?` y
   `cache_creation_input_tokens?`. Los dos caminos (chat ~444 y tarea ~534) devuelven `cacheReadTokens` y
   `cacheWriteTokens`. El costo sigue siendo `total_cost_usd`.
4. **Codex (`codex.ts`)**: `parseCodexStream` y el parser del chat leen `cached_input_tokens` y
   `cache_write_input_tokens` del `turn.completed`. Devuelven `inputTokens = input_tokens − cached_input_tokens`
   (nunca negativo), `cacheReadTokens = cached_input_tokens` y `cacheWriteTokens = cache_write_input_tokens ?? 0`.
5. **Precio de caché**:
   - `src/router/model-catalog.ts:~138-155` lee `pricing.input_cache_read` y `pricing.input_cache_write` de
     OpenRouter como `priceCacheRead?` y `priceCacheWrite?` (por 1M, el mismo `Number(...) * 1_000_000`, `NaN` →
     ausente).
   - `src/router/pricing.ts` exporta `knownCostWithCache(model, { input, output, cacheRead, cacheWrite })`: si el
     catálogo trae precio de caché lo usa, y si no, cobra esos tokens a `priceIn`, como hoy.
   - Codex (tarea ~351 y chat ~416) pasa a usar ese cálculo.
   - `knownCost` y `calcCost` no cambian de firma.
6. **Propagación**: `cacheReadTokens` y `cacheWriteTokens` viajan por el mismo camino que hoy recorre
   `inputTokens`, desde el resultado del executor hasta `insertRun` (`grep -n inputTokens` en `src/run/harness.ts`,
   `src/dashboard/handlers/chat.ts` y `src/db/chat-turns.ts`). Cada `insertRun` de esos caminos pasa
   `cache_read_tokens` y `cache_write_tokens`. Los proveedores que no reportan caché (OpenRouter, OpenCode) quedan
   en 0.
7. **`elapsed_ms` del chat**: guardar `const turnStartedAt = Date.now()` al entrar al handler del turno y pasar
   `elapsed_ms: Date.now() - turnStartedAt` en los tres sitios de `chat.ts` (577, 1016, 1392).
8. **`src/dashboard/handlers/usage.ts`**: la consulta suma también `cacheReadTokens` y `cacheWriteTokens`, y los
   devuelve en cada fila de `byDayModel`. No tocar el frontend (la pantalla de uso es CX.5).

## Tests

- Migración 20: una DB en versión 19 sube a 20 y quedan las dos columnas con default 0. Seguir el patrón de
  `src/__tests__/migration.test.ts`.
- Claude: un JSON de resultado con `cache_read_input_tokens: 1000` y `cache_creation_input_tokens: 200` devuelve
  `cacheReadTokens 1000` y `cacheWriteTokens 200`, con el `inputTokens` original.
- Codex: un `turn.completed` con `input_tokens 20500`, `cached_input_tokens 20000` y `output_tokens 10` devuelve
  `inputTokens 500` y `cacheReadTokens 20000`.
- `knownCostWithCache`: con precio de caché lo usa; sin él cae a `priceIn`.
- `insertRun` sin campos de caché guarda 0.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos) · `bun test` completo. Reportar salidas reales. El
cerebro corre después `test:coverage` y un `gate:evidence -- ui:gate auto-flow` real: los runs de Claude y Codex
deben quedar con `cache_read_tokens > 0` en la DB.

## Fuera de alcance

La pantalla de uso (CX.5), el anillo de contexto (CX.2), OpenCode y OpenRouter más allá del default 0. No commitear
ni tocar `PLAN.md`.
