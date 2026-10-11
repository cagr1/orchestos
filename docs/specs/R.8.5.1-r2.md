# R.8.5.1 — ronda 2: el paso del host no puede pasar con `true` literal

Único archivo: `scripts/ui-gate/flows/qa-negative.mjs`, bloque `// R.8.5.1`.

El paso `rollout does not contain the host AGENTS.md distinctive line` evalúa `hostLine === undefined ? true : …`:
cuando el host no tiene `~/.codex/AGENTS.md` es un paso que no puede fallar (lo prohíbe R.8.6).

Cambio: si `hostLine === undefined`, **no emitir ese paso**; en su lugar añadir al `detalle` del paso anterior
(`rollout contains the OrchestOS generated instructions`) el campo `hostAgents: 'absent'`. Si hay línea, el paso
queda como está, con condición `!rolloutText.includes(hostLine)` sin rama `true`.

No tocar nada más. No commitear. No correr `ui:gate` ni `test:coverage`. El candado `ocupado: claude …` es el cerebro
que delega: seguir.

Verificación: `node --check scripts/ui-gate/flows/qa-negative.mjs` y `bunx biome check` sobre ese archivo.
