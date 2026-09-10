# S.7c — Historial shallow hace pasar un commit de prosa como commit de cierre

**Ejecutable por cualquier LLM sin decisiones adicionales.** El defecto ya está confirmado por
una auditoría independiente (`docs/audits/2026-09-10-block-s-review.md`, hallazgo 3). Quien
ejecute esto NO diseña: implementa lo de abajo. Si algo del spec resulta imposible o falso al
tocar el código, **parar y reportarlo**, no improvisar una alternativa.

Preflight obligatorio: `bun run agent:preflight -- --item S.7c --agent <tu-id>`.

## Contexto en una línea

En un clon `git clone --depth=1`, `listPlanItemsWithCommitStatus()` confirma como cierre válido
cualquier commit cuyo padre no exista localmente — incluido un commit que solo cambia prosa,
sin tocar el ítem. "El padre no está disponible" se está tratando como "el padre no tiene el
ítem", y son dos cosas distintas.

## 1. El defecto exacto

`src/db/plan-items.ts:242-282`, `listPlanItemsWithCommitStatus()`, dentro de `stateFor`:

```ts
const after = git(root, ['show', `${sha}:PLAN.md`])
const parent = git(root, ['rev-parse', '--verify', `${sha}^`])
const before = parent.exitCode === 0 ? git(root, ['show', `${parent.stdout}:PLAN.md`]) : null
if (after.exitCode !== 0 || (before && before.exitCode !== 0)) {
  states.set(sha, null)
  return null
}
const value = {
  after: new Map(...),
  before: new Map((before ? parsePlanFeatureStatus(before.stdout) : []).map(...)),
}
```

Cuando `git rev-parse --verify <sha>^` falla (padre inexistente localmente — típico de un clon
`--depth=1`, donde el commit más viejo disponible no tiene padre en el repo local), `before`
queda `null` y el código NO lo trata como error: cae al operador ternario `before ? ... : []`,
que produce un mapa **vacío**. Más abajo:

```ts
const confirmed = state?.after.get(item.id) === 'done' && state.before.get(item.id) !== 'done'
```

Con `before` vacío, `state.before.get(item.id)` es `undefined`, que `!== 'done'` es `true` — así
que si `after` dice `done` para ese ID, `confirmed` sale `true` sin importar si ESE commit
específico fue el que hizo la transición o si es simplemente el commit más antiguo visible en un
historial truncado que ya traía el ítem cerrado desde antes (p. ej., un commit de solo prosa
posterior al cierre real, que en un clon completo no sería ni siquiera candidato porque
`findAllPlanCloseCommits` solo elige commits con transición open→done).

## 2. Cómo reproducirlo

1. Sobre un repo con historia normal, crear el cierre real de un ítem (commit con la transición
   `- [ ]` → `- [x]`), y luego un commit adicional que solo cambia prosa de otra parte de
   `PLAN.md` (sin tocar el ítem).
2. Confirmar que `item.commitSha` en la DB apunta al commit de PROSA (esto puede requerir sembrar
   la DB a mano para el fixture, ya que `findAllPlanCloseCommits` normal no elegiría ese commit;
   el objetivo del fixture es aislar el comportamiento de `listPlanItemsWithCommitStatus` frente
   a un SHA que no es su propio commit de cierre, no reproducir cómo llegó a estar mal asignado
   — ese es un escenario distinto, ya cubierto por S.7b si aplica un git real con reapertura).
3. Clonar ese repo con `git clone --depth=1` a un directorio separado, de forma que el commit de
   prosa sea la raíz local (sin padre resoluble).
4. Llamar `listPlanItemsWithCommitStatus(root)` sobre el clon shallow y observar que
   `commitPending` sale `false` para ese ítem, aunque el commit registrado no sea el que hizo la
   transición real y su padre no se pueda verificar.

## 3. Corrección exigida

Distinguir explícitamente "el padre no existe porque el historial está truncado" de "el padre
existe y no tiene el ítem". Cuando `git rev-parse --verify <sha>^` falla, **no** se puede asumir
que el commit es la raíz real del repo ni que es válido tratar `before` como vacío. El estado
correcto ante historia shallow es **no confirmado** (o un estado explícito de indeterminado que
en la capa de arriba se trate igual que "no confirmado" para efectos de `commitPending`) —
nunca confirmado por defecto.

Una forma válida de resolverlo: distinguir la raíz real del repo (verificable con
`git rev-list --max-parents=0 <sha>` o comparando contra el resultado de un
`rev-parse --verify <sha>` seguido de comprobar que no es una raíz shallow — inspeccionar
`git rev-parse --is-shallow-repository` y/o el archivo `.git/shallow`) de un padre simplemente
ausente por truncamiento. Si el repo es shallow y no se puede probar de forma fiable que `sha`
es realmente la raíz del historial completo, tratar ese commit como **no confirmable** en vez de
como raíz.

No es aceptable "arreglar" esto asumiendo `before = null → confirmed = false` de forma
incondicional sin distinguir el caso, porque una raíz real (repo completo, primer commit del
historial, ítem creado ya cerrado en el commit inicial) es un escenario legítimo y distinto —
documentar en el código y/o el test cuál decisión se tomó y por qué, si el spec resulta
insuficiente para cubrir ambos casos sin ambigüedad, **pararse y reportarlo** en vez de
inventar el criterio.

## 4. Test obligatorio que debe fallar ANTES del fix

Un clon shallow real (`git clone --depth=1`, no simulado) donde el último commit disponible
localmente es solo de prosa (no toca el ítem que se está evaluando) debe producir
`commitPending: true` (o el estado indeterminado explícito que se decida, tratado como no
confirmado) para ese ítem. Confirmar que el test falla contra el código actual (hoy sale
`false`) y pasa después del fix.

## 5. Gates

```
bunx tsc --noEmit
bun run test:coverage      # comando exacto de CI, NO `bun test` a secas
bun run lint
git diff --check
```

## 6. Qué NO tocar

- Archivos permitidos: `src/db/plan-items.ts` (solo `listPlanItemsWithCommitStatus` / `stateFor`
  y, si es indispensable, un helper nuevo acotado a esta detección) y su test
  (`src/db/plan-items.test.ts` o el que corresponda según convención del repo).
- No tocar `findAllPlanCloseCommits` ni `findPlanCloseCommit` salvo que el fix demuestre que es
  estrictamente necesario — si es así, pararse y reportarlo en vez de absorberlo en silencio.
- No tocar `scripts/plan-gate.ts` ni `scripts/plan-import.ts` — son S.7a y S.7b, ítems
  independientes con specs propios.
- No editar `PLAN.md` desde el ejecutor: el cierre lo hace el cerebro después de verificar.
- No usar `--no-verify` en ningún commit.
- No ejecutar `git config` bajo ninguna circunstancia.
- No cambiar el esquema SQLite ni las migraciones.

## 7. Cierre

Un commit que corrige `listPlanItemsWithCommitStatus()` y agrega el test de regresión con clon
shallow real. NO marcar S.7c `[x]`: lo hace quien verifique de forma independiente, con la
evidencia del punto 4 pegada en `PLAN.md`.
