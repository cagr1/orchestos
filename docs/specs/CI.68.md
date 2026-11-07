# CI.68 — `model-routing`: esperar el botón de sugerencia en vez de mirarlo una vez

Ítem: `PLAN.md` § CI.68. Evidencia: pre-push de ADE.3 (2026-11-07), `FAIL model-routing: installed CLI is proposed
for unassigned roles: failed`; aislado, `PASS model-routing 24/24`.

## Qué cambiar

`scripts/ui-gate/flows/model-routing.mjs:161`: hoy
`await step('installed CLI is proposed for unassigned roles', await suggestionButton.isVisible())` mira una sola
vez. Cambiar a esperar con `suggestionButton.waitFor({ state: 'visible', timeout: 10_000 })` dentro de un
try/catch que pase `true`/`false` a `step`; si falla, el detalle del paso incluye el texto de los botones
visibles de la sección de roles (para la próxima vez que falle). Buscar en el mismo archivo otros `isVisible()`
usados como aserción inmediata sobre algo que carga asíncrono y aplicar el mismo patrón (hermanos).

## Qué NO tocar

Producto (`src/`). Otros flujos.

## Cómo se verifica

`bun run gate:evidence -- --label CI.68-model-routing -- bun run ui:gate model-routing` 3 veces seguidas verde, y
una vez en paralelo con `bun run test:coverage` (carga como en el pre-push).
