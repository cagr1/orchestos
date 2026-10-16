# CI.28 — `session-status` "lee la cuota de Claude desde el payload de statusLine" lanza el `codex` real

Causa (verificada leyendo el código): el test (`src/dashboard/__tests__/session-status.test.ts:137`) borra
`ORCHESTOS_SESSION_TRANSCRIPT`, así que `readActiveSessionStatuses` (`scripts/session-status.ts:199-204`) detecta el
`codex` instalado en el host y llama `readCodexRateLimitsLive`, que lanza el binario real. En el Mac, bajo carga de
la suite, pasa los 5 s (visto 2026-10-16 en `test:coverage`, pasó al repetir). En CI no hay `codex`: nunca falla allí.
Misma clase que la regla 1 de "Verificar contra CI" en `CLAUDE.md`.

## Qué cambiar
Solo en ese test, pasar en las opciones de `readActiveSessionStatuses`:
- `detectClis: () => [...]` con `claude` instalado (`id:'claude'`, `binary:'claude'`, `installed:true`) y `codex`
  instalado, usando el tipo `CliDetectionResult` de `src/run/executors/cli-registry.ts` (copiar los campos que pida el tipo).
- `readCodexRateLimits: async () => { throw new Error('no debe lanzarse el codex real') }` — si el código
  vuelve a lanzarlo, el test falla en vez de depender del host. Si con detecciones falsas la ruta no lo
  llama nunca, usar `async () => []` y un contador que el test afirme `=== 1` o `=== 0` según lo que haga el código hoy
  (leer `scripts/session-status.ts:199`: hoy se llama si `!explicit && codex.installed`; afirmar ese número).

## Qué no tocar
`scripts/session-status.ts` ni los otros tests del archivo.

## Verificación
`bun test src/dashboard/__tests__/session-status.test.ts` y `bun run test:coverage` en verde.
