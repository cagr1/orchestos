# UI.26.7 — Orquestación en Tasks: los límites solo aparecen cuando se pueden editar

Ítem: PLAN.md § UI.26. Rol: `mecanico`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear
(`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
**PROHIBIDO `git stash`, `git checkout` y `git restore`**: la contraprueba se hace con copia en `/tmp` +
`git show HEAD:<ruta> > <ruta>`, restaurar la copia y confirmar con `cmp`.

## Diagnóstico (cerebro, 2026-10-14)

No es un fallo: "Máximo concurrente" y "Tope total por ejecución" (`OrchestSettingsView.tsx:~2316-2340`) llevan
`disabled={!orchestration.enabled}` a propósito. Se habilitan al marcar la casilla "Activada/Desactivada" y se guardan
con "Guardar" (el flujo `orchestration.mjs:74-80` lo afirma: activar solo habilita los límites sin guardar). La
sección sí aporta: el scheduler los consume (`src/run/scheduler.ts:121`, `src/run/orchestration-budget.ts`) para
limitar subtareas en paralelo y en total al orquestar un plan. El problema es que nada en pantalla dice que la casilla
habilita los campos: se ven dos entradas grises que no aceptan texto.

## Cambio (solo `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`, bloque de la sección)

1. Con la orquestación desactivada, los dos campos **no se renderizan** (igual que el botón "Guardar", que ya solo
   aparece activada). Con ella activada, se ven y se editan como hoy.
2. Debajo del título "Orquestación", una línea `text-xs text-app-muted`: `Limita las subtareas en paralelo y en total
   al orquestar un plan.` (una sola; nada más de texto nuevo).
3. Tokens de la familia en el bloque: la caja `m-4 rounded-card border border-app bg-app-surface` →
   `m-4 rounded-card bg-app-elevated` sin borde; los `<input type="number">` → `h-7 w-32 rounded-control
   bg-app-bg px-2 text-[13px] tabular-nums text-app` sin borde; el botón "Guardar" → `Button` de
   `@/components/ui/button` (`size="sm"`) dentro de `SettingsPrimaryAction` (`components/settings/primitives.tsx`).
   Conservar: heading "Orquestación", rol `checkbox`, rol `spinbutton` de los dos campos, nombre "Guardar".

Nada de handlers, estado, endpoints ni validación cambia.

## Gate: ampliar `scripts/ui-gate/flows/orchestration.mjs`

Antes de `await enabledSwitch().check()` (línea ~74), paso nuevo `límites ocultos con la orquestación desactivada`:
la casilla no está marcada y `inputs().count() === 0`. Tras marcarla, el paso existente sigue y además
`inputs().count() === 2`.
Contraprueba: con el archivo de HEAD (método de arriba), el paso nuevo debe fallar; pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check src/dashboard/app/src/components/settings/OrchestSettingsView.tsx scripts/ui-gate/flows/orchestration.mjs
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate orchestration project-tabs smoke
