# R.8.6 — Pasos que no pueden fallar

Hallazgos 6-7 de `docs/done/evidence/R.8-revision-sol-2026-10-05.md`. Solo gates: `scripts/ui-gate/`. No tocar
`src/`. No commitear, no tocar `PLAN.md`/`NEXT.md`. Árbol: `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`
y `.orchestos/feature-status.json` tienen cambios ajenos: no tocarlos.

## Problema

Hay pasos `step(nombre, true, …)`: cuentan como aserción verde y no pueden fallar. Inflan el `N/N` de cada gate.
Sitios vigentes (grep `step\([^)]*,\s*true` y `^\s*true,$` en `scripts/ui-gate/flows/`):

- `chat-turn-details.mjs:257` (`reasoning optional`), `:278` (`held task card visible`), `:314` (`second held task card visible`)
- `project-isolation.mjs:190` (`fixtures created for Alfa and Beta`)
- `tasks.mjs:63`, `project-tabs.mjs:59`, `runs-graph.mjs:198` (`failed attempt N QA detail`: diagnóstico)
- `text-sweep.mjs:117` (`all stale copy remains absent…`)

Los `auto-flow.mjs:356/360` que cita la revisión ya no pasan `true` literal: revisar igualmente el tramo de
"Approve & Run" (`auto-flow.mjs:316` en adelante) y, si algún paso es verdadero por construcción en ambos caminos,
tratarlo igual.

## Qué hacer

1. **Diagnóstico ≠ aserción.** Añadir al contexto de los flujos en `scripts/ui-gate/run.mjs` una función
   `note(nombre, detalle)` que se guarda en el `result.json` del flujo (campo aparte, p. ej. `notes`), se imprime, y
   **no cuenta** en el `N/N`. Los tres `failed attempt N QA detail` pasan a `note`.
2. **Cada paso restante se convierte en aserción real o se borra.** Criterio: la condición debe ser una expresión
   que pueda dar `false` con el sistema roto.
   - Si justo antes hay un `waitFor`/`hidden` que lanza si falla, el paso es redundante: o se borra, o la condición
     pasa a ser la comprobación misma (p. ej. `text-sweep`: contar literales presentes y exigir 0;
     `held task card visible`: `await locator.isVisible()`).
   - `reasoning optional`: es una rama que no comprueba nada → `note`.
   - `fixtures created for Alfa and Beta`: comprobar que ambos ids existen y son distintos.
3. **Diente mecánico.** `lintFlowSource` (el linter de flujos que ya corre `run.mjs`) rechaza un `step(` cuya
   condición sea el literal `true`, también en formato multilínea. Añadir su test junto a los tests existentes de
   ese linter.
4. **Hallazgo 7, nombres que prometen más de lo que comprueban** (`chat-context.mjs`, pasos `contract output is
   real` e `input token counts` — localizar por nombre; pueden haberse renombrado o movido a otro flujo): o se
   añade la aserción que el nombre promete, o se renombra a lo que realmente comprueba. Preferir añadir la aserción
   cuando sea barata (p. ej. leer el contenido del archivo, no solo su nombre).

No debilitar ninguna aserción existente. No añadir reintentos.

## Verificación (pegar salida real)

- `bunx tsc --noEmit` y `bunx biome check scripts/ui-gate`
- `bun test` del archivo de test del linter de flujos.
- `bun run ui:gate chat-turn-details project-isolation tasks project-tabs runs-graph text-sweep chat-context auto-flow`
- Tabla antes/después del `N/N` de cada gate, con cada paso quitado, convertido a `note` o endurecido.
- Reportar cualquier rojo tal cual, sin reintentar hasta que pase.
