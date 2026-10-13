# CI.22 — `usage-bar` falla en el pre-push completo: "Codex: No quota limits reported"

## Problema
`readCodexRateLimitsLive` (`scripts/context-adapters.ts:197-…`) lanza `codex app-server`, pide
`account/rateLimits/read` y espera como máximo `timeoutMs ?? 3_000`. En frío responde en 0.5–0.8 s; dentro del
pre-push completo (máquina cargada) vence y devuelve `[]` en silencio → la barra muestra "No quota limits reported"
y el gate `usage-bar` falla.

## Cambio
1. `scripts/context-adapters.ts:201`: el tope por defecto pasa de `3_000` a `8_000`. Dejarlo como constante
   nombrada exportada (`CODEX_RATE_LIMITS_TIMEOUT_MS = 8_000`) y usarla en el default.
2. En la misma función: si termina sin haber obtenido ventanas (venció el tope o el stream cerró sin resultado),
   escribir una sola línea con `console.error`:
   `[rate-limits] codex app-server sin respuesta de account/rateLimits/read tras <ms> ms (tope <timeoutMs> ms)`.
   No escribir nada cuando sí hay ventanas. No cambiar el valor de retorno (`[]`) ni el cierre del proceso.
3. Tests: en el archivo de tests existente del adaptador (buscar el que ya cubre `readCodexRateLimitsLive` con un
   binario falso; si no existe, crear `scripts/context-adapters.rate-limits.test.ts`):
   - binario falso que responde tarde pero dentro de un `timeoutMs` explícito → devuelve las ventanas;
   - binario falso que nunca responde con `timeoutMs: 300` → devuelve `[]` en menos de ~2 s.
   Los binarios falsos son scripts ejecutables creados en un tmp dir del test (no depender de `codex` del host).
   El default de 8 s no se ejercita en los tests (siempre pasar `timeoutMs`).
4. `AGENTS.md:201-204`: actualizar la frase del intermitente: tope ahora 8 s y deja log al vencer (una línea, sin
   borrar la mención del fallback con `rollout-*.jsonl` como candidato).

## No tocar
- `scripts/session-status.ts`, el frontend, `scripts/ui-gate/`, `PLAN.md`, `NEXT.md`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bunx tsc --noEmit`
- `bun test` de los tests del adaptador (los existentes y los nuevos)
- `bunx biome check` sobre los archivos tocados

NO correr `test:coverage` ni `ui:gate`, ni detenerse por el baseline. El candado de escritor `ocupado: claude …` es
el cerebro que delega: se puede editar. Si `scripts/*.sh` no se toca no hace falta `hooks:install`. No commitear.
