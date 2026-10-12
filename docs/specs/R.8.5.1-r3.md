# R.8.5.1 — ronda 3: el paso del host no puede pasar con `true` literal

Sustituye a `R.8.5.1-r2.md`, que no se ejecutó.

**Contexto del árbol:** `scripts/ui-gate/flows/qa-negative.mjs`, `src/run/executors/codex.ts`,
`src/run/executors/external.ts` y sus tests tienen cambios SIN commitear: son la ronda 1 de este mismo ítem, ya
revisada por el cerebro. No son ajenos; se edita encima de ellos. No revertirlos.

Único archivo a editar: `scripts/ui-gate/flows/qa-negative.mjs`, bloque que empieza en el comentario `// R.8.5.1`.

El paso `rollout does not contain the host AGENTS.md distinctive line` evalúa `hostLine === undefined ? true : …`:
cuando el host no tiene `~/.codex/AGENTS.md` es un paso que no puede fallar.

Cambio:
- Si `hostLine === undefined`: **no emitir ese paso**.
- El paso anterior (`rollout contains the OrchestOS generated instructions`) añade a su detalle JSON el campo
  `hostAgents`: `'absent'` si no hay línea, `'checked'` si la hay.
- Si hay línea: el paso se emite con condición `!rolloutText.includes(hostLine)`, sin rama `true`, y el detalle actual.

No tocar nada más. No commitear. No correr `ui:gate` ni `test:coverage`. El candado `ocupado: claude …` es el cerebro
que delega: seguir.

Verificación: `node --check scripts/ui-gate/flows/qa-negative.mjs` y
`bunx biome check scripts/ui-gate/flows/qa-negative.mjs`.
