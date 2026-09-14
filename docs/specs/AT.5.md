# AT.5 — Freno mecánico de costo de sesión: umbral absoluto + bloqueo real

Ejecutor: Luna. Implementa exactamente esto; si algo resulta imposible, para y repórtalo.
**No commitees y no toques `PLAN.md`.** El cierre lo hace el cerebro.

Preflight: `bun run agent:preflight -- --item AT.5 --agent luna`.

## Problema

`.claude/hooks/context-budget.js` avisa por **porcentaje de la ventana del modelo en curso**
(`scripts/context-budget.ts` § `DEFAULT_BUDGET_THRESHOLDS`, warn 60% / critical 65%). Eso
está bien calibrado para evitar el autocompact (dispara ~78%) — **no lo toques, sigue
existiendo tal cual**. El problema es otro: con un modelo de ventana grande (p. ej. 1M
tokens), el 18% de esa ventana ya son 180.000 tokens reales. Una sesión puede reenviar el
contexto entero en cada llamada (prompt caching no evita el costo de uso/cupo) y quemar
millones de tokens acumulados sin que el `pct` de ventana se mueva lo suficiente para
avisar — medido el 2026-09-14: 8.8M tokens releídos en 67 llamadas, uso real 18%→54% del
medidor de cupo de la cuenta, mientras el hook de contexto se mantenía callado. Falta un
segundo umbral, **en tokens absolutos de la llamada actual**, independiente del tamaño de
ventana del modelo, con un bloqueo real (no solo un mensaje que el LLM puede seguir
ignorando).

## Cambio 1 — `scripts/context-budget.ts`: umbral absoluto

Agregar, debajo de `DEFAULT_BUDGET_THRESHOLDS` (línea 32-35):

```ts
/**
 * AT.5 (2026-09-14): a diferencia de `DEFAULT_BUDGET_THRESHOLDS` (% de la
 * ventana, calibrado contra el autocompact), este es un tope en tokens
 * absolutos de la llamada actual — protege contra el costo real de una
 * sesión larga en un modelo de ventana grande, donde un 18% ya son 180k
 * tokens. Medido 2026-09-14: 8.8M tokens releídos en 67 llamadas sin que el
 * % de ventana avisara. `warn` imprime una vez; `block` corta la sesión.
 */
export const ABSOLUTE_BUDGET_THRESHOLDS = { warn: 60_000, block: 90_000 }

export function absoluteBudgetLevel(
  used: number,
  thresholds: { warn: number; block: number } = ABSOLUTE_BUDGET_THRESHOLDS,
): 'ok' | 'warn' | 'block' {
  if (used >= thresholds.block) return 'block'
  if (used >= thresholds.warn) return 'warn'
  return 'ok'
}
```

En el bloque `if (import.meta.main)` (línea 148-169), agregar el campo `absoluteLevel` al
JSON que se imprime: justo antes de `console.log(JSON.stringify(...))`, calcular

```ts
const absoluteLevel =
  typeof budget?.used === 'number' ? absoluteBudgetLevel(budget.used) : null
```

y añadir `absoluteLevel` a **ambas** ramas del `JSON.stringify(budget ?? {...})` — la rama
`budget` real (spread: `{ ...budget, absoluteLevel }`) y la rama de fallback
`{ used: null, model: null, window: null, pct: null, level: null, source: null,
absoluteLevel: null }`. No cambies nada del resto del archivo ni de `context-adapters.ts`.

## Cambio 2 — `.claude/hooks/context-budget.js`: usar el umbral absoluto

Hoy la función `main()` (línea 11-29) descarta el budget entero si el nivel por-% no es
`warn`/`critical` (línea 18: `if (!budget || (budget.level !== 'warn' && budget.level !==
'critical')) return`). Eso es exactamente lo que oculta el caso de ventana grande. Cambiar
la condición de corte temprano para que también considere `absoluteLevel`:

```js
const budget = runBudget(transcriptPath)
if (!budget) return

if (budget.absoluteLevel === 'block') {
  const used = budget.used.toLocaleString('en-US')
  process.stderr.write(
    `Contexto: ${used} tokens en esta sesión (tope absoluto 90.000, independiente de la ` +
      `ventana del modelo). Escribe NEXT.md y abre sesión nueva.\n`,
  )
  process.exit(2)
}

if (budget.level !== 'warn' && budget.level !== 'critical' && budget.absoluteLevel !== 'warn')
  return

// resto de la función igual que hoy (firstTimeThisSession, writeHandoff, printWarning) —
// no cambia. `printWarning` sigue leyendo `budget.level`/`budget.pct`/`budget.model` como
// hasta ahora; no necesita saber de `absoluteLevel` para el caso warn.
```

`process.exit(2)` **antes** de imprimir nada más — el bloqueo debe repetirse en **cada**
prompt mientras `used >= 90_000` (no es un aviso de una sola vez como `warn`): así el LLM no
puede simplemente seguir aunque ignore el primer aviso. No toques `writeHandoff` ni
`printWarning`; el camino `block` no los llama.

## Cambio 3 — `.claude/settings.json`: acotar el output de Bash

Verificado contra la documentación oficial de hooks/settings (2026-09-14): la clave real es
**`bashOutputMaxChars`** (top-level de `settings.json`, no una env var —
`BASH_MAX_OUTPUT_LENGTH` no existe, no lo uses). Agregar al `.claude/settings.json` del
repo, como clave top-level junto a `"env"` (no dentro de `"env"`):

```json
"bashOutputMaxChars": 8000,
```

No reordenar ni tocar ninguna otra clave existente del archivo.

## Test nuevo

**`scripts/context-budget.test.ts`** — casos para `absoluteBudgetLevel`:
`absoluteBudgetLevel(59_999)` → `'ok'`, `absoluteBudgetLevel(60_000)` → `'warn'`,
`absoluteBudgetLevel(89_999)` → `'warn'`, `absoluteBudgetLevel(90_000)` → `'block'`.

**`tests/hooks/context-budget.test.ts`** (nuevo archivo, mismo patrón que
`tests/hooks/brain-no-code.test.ts`: `spawnSync('node', [HOOK_PATH], ...)`). Como el hook
llama `bun run context:budget` como subproceso real (no se puede mockear fácil desde fuera),
usa `BRAIN_GUARD_ROOT`-style override: revisa si `context-budget.js` ya soporta apuntar a un
`ROOT` de test (no lo soporta hoy — no lo agregues, no es parte de este spec). En su lugar,
prueba el contrato en dos capas, sin spawnear el hook completo:
1. Los 4 casos de `absoluteBudgetLevel` de arriba (ya cubiertos en `context-budget.test.ts`).
2. Un test de integración contra `bun run context:budget` real: generar un transcript JSONL
   fixture en tmpdir con un único mensaje `assistant` cuyo `message.usage` sume ≥ 90.000
   tokens (`input_tokens`) y `message.model` sea un modelo real del catálogo (usa
   `'claude-sonnet-5-20250929'` o el id que ya use `context-budget.test.ts` en sus fixtures
   — revisa ese archivo primero), correr `bun run scripts/context-budget.ts -- --transcript
   <fixture>` con `spawnSync` y comprobar que el JSON de stdout trae `"absoluteLevel":"block"`.
   Repetir con ~65.000 tokens → `"absoluteLevel":"warn"`.

## Fuera de alcance — NO TOCAR

`DEFAULT_BUDGET_THRESHOLDS`, `budgetStatus()`, `context-adapters.ts`, `printWarning()`,
`writeHandoff()`, cualquier lógica de `firstTimeThisSession`, `PLAN.md`.

## Gates del ejecutor

- `bun test scripts/context-budget.test.ts tests/hooks/context-budget.test.ts` verde.
- `bunx tsc --noEmit` limpio.
- `bun run lint` exit 0.
- Prueba en vivo, pegada tal cual (no resumida): correr a mano
  `bun run scripts/context-budget.ts -- --transcript <fixture con ≥90k>` y pegar el JSON
  completo con `"absoluteLevel":"block"`.
- `git status` muestra solo `scripts/context-budget.ts`, `.claude/hooks/context-budget.js`,
  `.claude/settings.json`, `scripts/context-budget.test.ts`, `tests/hooks/context-budget.test.ts`.
