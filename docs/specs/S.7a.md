# S.7a — Escape de regex roto en el gate de procedencia de specs

**Ejecutable por cualquier LLM sin decisiones adicionales.** El defecto ya está confirmado por
una auditoría independiente (`docs/audits/2026-09-10-block-s-review.md`, hallazgo 2). Quien
ejecute esto NO diseña: implementa lo de abajo. Si algo del spec resulta imposible o falso al
tocar el código, **parar y reportarlo**, no improvisar una alternativa.

Preflight obligatorio: `bun run agent:preflight -- --item S.7a --agent <tu-id>`.

## Contexto en una línea

El gate de procedencia archivado (`checkProvenance()`) exige que la línea `Ejecutado por: ... ·
Spec: docs/specs/<ID>.md` de la evidencia coincida con el ID del ítem que se cierra. Esa
comparación construye un `RegExp` interpolando el ID sin escapar sus metacaracteres, así que
la comparación queda rota para cualquier ID con un punto (todos: `S.7a`, `F.1`, `R.8`...).

## 1. El defecto exacto

`scripts/plan-gate.ts:138`:

```ts
const expected = new RegExp(
  `^Ejecutado por: .+ · Spec: docs/specs/${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\.md$`,
  'm',
)
```

El patrón de escape `/[.*+?^${}()|[\\]\\\\]/g` no matchea un `.` literal ni ningún otro
metacarácter de un ID real — `id.replace(...)` es un no-op sobre entradas como `F.1` o `S.7a`.
El `.` de `F.1` queda actuando como wildcard de regex en el `RegExp` resultante, así que
`Spec: docs/specs/Fx1.md` (con cualquier carácter en vez del punto) pasa la comprobación para el
ítem `F.1`.

## 2. Cómo reproducirlo

Fixture Git real (no mock), siguiendo el patrón que ya usa `scripts/plan-gate.test.ts` (ver el
test `rejects evidence whose section belongs to a different item`, línea ~129, que usa
`OTHER.md`): escribir `PLAN.md` con `- [x] **F.1 — ⚡ ...** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)`,
escribir `docs/done/bloque-F.md` con `Ejecutado por: gpt-5.6-terra · Spec: docs/specs/Fx1.md`,
stagear y borrar `docs/specs/F.1.md` del índice, y correr `checkProvenance()`. Con el bug, la
llamada NO lanza error — el spec `Fx1.md` (con `x` en vez de `.`) pasa como si fuera `F.1.md`.

## 3. Corrección exigida

Escapar de verdad los metacaracteres de regex del ID antes de interpolarlo. Usar un escape
estándar y correcto — por ejemplo `id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` (sin la doble
barra invertida final que rompe la clase de caracteres del patrón actual), o construir el
`RegExp` sin interpolación de string libre. No relajar la comprobación ni convertirla en
sustring; debe seguir siendo un match exacto de línea completa.

No toques la lógica de resolución de rutas (`evidenceSectionFromIndex`, `sectionAtHead`) ni el
resto de `checkProvenance()` — el defecto está aislado a la construcción del patrón.

## 4. Test obligatorio que debe fallar ANTES del fix

Añadir un caso nuevo a `scripts/plan-gate.test.ts` (no borrar ni modificar el existente que usa
`OTHER.md`, línea ~129): item `F.1` con evidencia declarando `Spec: docs/specs/Fx1.md` (nota:
`x` reemplaza el punto, no cualquier otro carácter random, para que el caso solo pueda pasar por
la falla real del wildcard `.`) debe ser **rechazado** por `checkProvenance()`. Confirmar que
este test falla contra el código actual antes de aplicar el fix, y pasa después.

## 5. Gates

```
bunx tsc --noEmit
bun run test:coverage      # comando exacto de CI, NO `bun test` a secas
bun run lint
git diff --check
```

## 6. Qué NO tocar

- Ningún archivo fuera de `scripts/plan-gate.ts` y `scripts/plan-gate.test.ts`.
- No tocar `scripts/plan-import.ts` ni `src/db/plan-items.ts` — son S.7b y S.7c, ítems
  independientes con specs propios.
- No editar `PLAN.md` desde el ejecutor: el cierre (marcar `[x]`, pegar evidencia, borrar este
  spec) lo hace el cerebro después de verificar.
- No usar `--no-verify` en ningún commit.
- No ejecutar `git config` bajo ninguna circunstancia.
- No tocar la ruta inline de procedencia (sin `evidenceHref`) ni `Sin delegación:`.

## 7. Cierre

Un commit que corrige el escape y agrega el test de regresión. NO marcar S.7a `[x]`: lo hace
quien verifique de forma independiente, con la evidencia del punto 4 pegada en `PLAN.md`.
