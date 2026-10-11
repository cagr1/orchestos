# CI.17 — Limpieza de tmpdirs de ui-gate con reintentos (spec)

## Defecto
`usage-bar` falló dos veces en el pre-push con `ENOTEMPTY` al borrar su tmpdir `orchestos-ui-13-5-*`: el 2026-10-05 y
el 2026-10-11, la segunda bloqueando un push. `rmSync(dir, { recursive: true, force: true })` sin reintentos choca con
el dashboard, que todavía escribe en `<proyecto>/.orchestos/` justo después del purge. `chat-context.mjs` y
`chat-continuity.mjs` ya usan `maxRetries: 10, retryDelay: 300` y no fallan.

## Cambio
Agregar `maxRetries: 10, retryDelay: 300` a estas llamadas, sin otro cambio:
- `scripts/ui-gate/flows/usage-bar.mjs:60` y `:290`
- `scripts/ui-gate/flows/chat-turn-details.mjs:118`
- `scripts/ui-gate/flows/orchestration.mjs:45`
- `scripts/ui-gate/flows/opencode-terminal.mjs:55`
- `scripts/ui-gate/flows/project-isolation.mjs:86`
- `scripts/ui-gate/flows/project-tabs.mjs:185`
- `scripts/ui-gate/flows/tasks.mjs:148`

Las llamadas quedan así: `rmSync(x, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })`.

## No tocar
`read-boundary.mjs` (ajeno) y cualquier otra línea.

## Verificación (cerebro)
- `node --check` de cada archivo
- `bunx biome check scripts/ui-gate/flows/`
- `bun run gate:evidence -- --label CI.17 -- bun run ui:gate usage-bar tasks`
- el pre-push completo al hacer push
