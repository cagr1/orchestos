# CI.16 — cuota de Claude fresca en cada GET /api/session/status

Eres el EJECUTOR: edita tú mismo, no delegues, no corras preflight ni handoff.

## Por qué
`handleApiSessionStatus` espera el refresco 3 s como mucho y si no devuelve la caché. El refresco incluye la cuota en
vivo de Codex (1.5–3+ s), así que la cuota de Claude (lectura barata de archivos statusline) queda vieja.

## Cambiar (solo `src/dashboard/handlers/session-status.ts` + su test)
1. Nueva función exportada `withFreshClaudeQuota(clis, read = readClaudeStatuslineRateLimits)` (importar
   `readClaudeStatuslineRateLimits` de `scripts/session-status.ts`). Devuelve una copia de `clis` donde, si
   `read()` no es `null`, la entrada con `id === 'claude'`:
   - si `available` es true: solo reemplaza `rateLimits` por `{ source: 'claude', windows: reading.windows }`;
   - si `available` es false: además `available: true`, `observedAt: reading.observedAt`, `context: null`
     (mismo criterio que `readActiveSessionStatuses`, `scripts/session-status.ts:231-246`).
   Si `read()` es `null` o lanza, devuelve `clis` sin cambios. No muta la caché.
2. Aplicarla a `clis` en las TRES respuestas de `handleApiSessionStatus` (refrescada, caché, y primera carga),
   con `available` calculado sobre el resultado.
3. Comentario de 2 líneas con el motivo (CI.16).

## Tests (en `src/dashboard/__tests__/session-status.test.ts`, sin red ni CLIs reales)
- `withFreshClaudeQuota` con lectura que trae ventanas → reemplaza las de claude; con `available:false` → pasa a true.
- Lectura `null` y lectura que lanza → mismo array sin cambios.
- No toca la entrada de codex.

## No tocar
`scripts/session-status.ts`, el frontend, el flujo `usage-bar.mjs`, PLAN.md. No commitear.

## Verificación
`bun test src/dashboard/__tests__/session-status.test.ts` verde; `bunx tsc --noEmit` exit 0; `bunx biome check` de los
archivos tocados sin errores. El baseline ya está verde FUERA de tu sandbox; si ves `EADDRINUSE`/`EPERM` al abrir
puertos es artefacto del sandbox: ignóralo y repórtalo. El cerebro corre la suite completa y el gate en vivo.
