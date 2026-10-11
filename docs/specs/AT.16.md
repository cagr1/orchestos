# AT.16 — Aviso de contexto: 40 % de la ventana o 150 000 tokens, lo que ocurra primero (spec)

Decisión de Carlos, 2026-10-11. Motivo: cada turno re-lee todo el historial, así que el costo crece con los tokens
usados, no con el porcentaje; con ventana de 1 M el 60 % actual son 600 000 tokens. Regla global:
`~/.agent-method/detail/context-cost.md` punto 4.

## Qué cambiar

1. `scripts/context-budget.ts`
   - `BudgetThresholds` (línea 15): añadir opcionales `warnTokens?: number` y `criticalTokens?: number`.
   - `DEFAULT_BUDGET_THRESHOLDS` (línea 32): `{ warn: 40, critical: 65, warnTokens: 150_000, criticalTokens: 250_000 }`.
     Actualizar el comentario de arriba con la fecha y el motivo (una frase).
   - `budgetStatus` (línea 111): `critical` si `pct >= critical` **o** (`criticalTokens` definido y
     `used >= criticalTokens`); si no, `warn` si `pct >= warn` **o** (`warnTokens` definido y `used >= warnTokens`);
     si no, `ok`. Validar que los topes, si vienen, sean finitos, ≥ 0 y `criticalTokens >= warnTokens`; si no,
     `invalid budget thresholds`. Sin topes definidos el comportamiento es idéntico al actual.
2. `scripts/context-adapters.ts:96`: `DEFAULT_THRESHOLDS` deja de repetir los números y pasa a ser
   `DEFAULT_BUDGET_THRESHOLDS` (una sola fuente). No cambiar la forma de los adaptadores.
3. `.claude/hooks/context-budget.js`
   - Línea 111: el aviso lleva primero los tokens:
     `Contexto alto|crítico: <used> tokens, <pct> de la ventana de <model> (<window>).<handoff>`
   - Línea 113: sustituir "Cierra este tab y abre uno nuevo para retomar con menos contexto." por
     `Cierra el ítem en curso, deja el estado en NEXT.md y haz /clear.`
4. Tests y fixtures (`scripts/context-budget.test.ts`, `scripts/context-budget-hook.test.ts`,
   `scripts/context-adapters.test.ts`, `tests/hooks/context-budget.test.ts`, `scripts/fixtures/context-adapters/`):
   mover la frontera de `warn` de 60 a 40 (fixtures nuevos `codex-39-9.jsonl` → `ok` y `codex-40.jsonl` → `warn`;
   los de 59.9 y 60 se borran si nadie más los usa) y añadir estos asserts, con estos nombres de caso:
   - `149_999 / 1_000_000` → `ok`; `150_000 / 1_000_000` → `warn` (pct 15); `250_000 / 1_000_000` → `critical`.
   - `80_000 / 200_000` → `warn` por porcentaje (40 %); `79_999 / 200_000` → `ok`.
   - umbrales pasados sin topes (`{ warn: 50, critical: 80 }`) se comportan como hoy.
   - `criticalTokens < warnTokens` → lanza `invalid budget thresholds`.
   - el hook imprime `/clear` y no imprime `abre uno nuevo`.

## Qué NO tocar

`src/` entero, `scripts/ui-gate/`, `PLAN.md`, `NEXT.md`, hooks distintos de `context-budget.js`. Si un test de
`src/` o un flow de ui-gate afirma un `level` que cambie con el umbral nuevo, parar y reportar el archivo: no editarlo.
No hacer commit.

## Gates (salida cruda)

    bunx tsc --noEmit
    bun test scripts/context-budget.test.ts scripts/context-budget-hook.test.ts scripts/context-adapters.test.ts tests/hooks/context-budget.test.ts
    grep -rn "warn: 60" scripts src    # sin resultados

El cerebro corre después `bun run test:coverage` fuera del sandbox y el gate en vivo: una sesión real por encima de
150 000 tokens muestra el aviso con `/clear` (el mismo criterio 🔍 de H.7.3).
