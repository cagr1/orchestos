# CX.3 — Hook de Claude Code: el aviso sale solo por % de ventana (spec para Luna)

Ítem: PLAN.md § CX.3. Decisión de Carlos (2026-10-04): el disparo es la ventana de contexto, como en Claude
Desktop. El nivel `block` desaparece: solo se avisa.

## Bug medido (2026-10-04)

`bun run context:budget -- --transcript <tab actual>` →
`{"used":124799,"window":1000000,"pct":12.5,"level":"ok","absoluteLevel":"block"}`. El hook avisó
"Contexto alto: 12%" por el tope absoluto de AT.5 (`scripts/context-budget.ts:45`, 60k warn / 90k block). El
arranque medido de una sesión limpia ya es de 57k, así que el aviso sale casi siempre. El texto no dice la
causa, y `block` no bloquea nada.

## Cambios

1. **`scripts/context-budget.ts`**: borrar `ABSOLUTE_BUDGET_THRESHOLDS`, `absoluteBudgetLevel` y su comentario,
   y sacar `absoluteLevel` de la salida JSON (`:180-192`). `DEFAULT_BUDGET_THRESHOLDS` y los umbrales por CLI de
   `context-adapters.ts` no se tocan.
2. **`.claude/hooks/context-budget.js`**:
   - El guard (`:20-26`) avisa solo con `level === 'warn' || level === 'critical'`.
   - Se repite en cada turno solo con `critical` (`:36`). `warn` sigue avisando una vez por sesión.
   - `isBudget` deja de exigir `absoluteLevel`.
   - `printWarning`: primera línea
     `Contexto <alto|crítico>: <pct>% de la ventana de <modelo> (<used> / <window> tokens).`, con los números en
     `toLocaleString('en-US')`. Se borra la línea `Ventana: …`. El resto (handoff, "Cierra este tab…") queda
     igual.
3. **Tests**:
   - `scripts/context-budget.test.ts:121-124`: borrar el bloque de `absoluteBudgetLevel`.
   - `tests/hooks/context-budget.test.ts:55-68` (prueba el script, no el hook): reemplazar los dos casos por
     uno que corre un transcript de 90k tokens y verifica que el JSON **no** trae `absoluteLevel` y que `level`
     sale del % (`ok` si la ventana del modelo del fixture es grande).
   - `scripts/context-budget-hook.test.ts` (ejecuta el hook): actualizar los casos de `absoluteLevel` y sumar estos dos casos: `level: 'ok'`
     con `used` alto no imprime nada; `level: 'warn'` imprime `% de la ventana de` y el modelo.
4. **Docs**: en `docs/done/bloque-AT.md`, junto a la entrada de AT.5 (~línea 138), añadir una línea fechada:
   `Retirado en CX.3 (2026-10-04): el disparo es solo el % de ventana, por decisión de Carlos; el tope absoluto avisaba con el arranque de 57k.`
   No borrar el historial.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos en los archivos tocados) · `bun test` completo. Además,
`bun run context:budget -- --transcript <cualquier transcript .jsonl real de ~/.claude/projects>` imprime JSON
sin `absoluteLevel`. Reportar salidas reales.

## Fuera de alcance

El anillo del dashboard (CX.2), los umbrales en %, `startup-guard.js` y `session-resume.js`. No commitear ni
tocar `PLAN.md`.
