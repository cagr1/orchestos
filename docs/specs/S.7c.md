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
que el commit es la raíz real del repo ni que es válido tratar `before` como vacío.

**Decisión de diseño ya tomada por el cerebro (2026-09-10) — el ejecutor NO elige aquí.** No se
introduce ningún estado nuevo: shallow no probado como raíz resuelve a `commitPending: true`, el
booleano que ya existe. Motivo: `commitPending` lo consumen `bun run next`, el Sprint Board y el
gate del ledger; un tercer estado obligaría a tocar tipos, UI y posiblemente el esquema SQLite,
todo prohibido por §6. Y semánticamente `commitPending: true` ya significa exactamente "no puedo
probar el cierre vigente", que es el caso.

El árbol de decisión a implementar, sin variantes:

1. `git rev-parse --verify <sha>^` **exitCode 0** → comportamiento actual sin cambios (se compara
   `before` real contra `after`).
2. `rev-parse --verify <sha>^` **falla** → consultar `git rev-parse --is-shallow-repository`:
   - devuelve `false` → `sha` es la raíz real de un historial completo. Escenario legítimo (ítem
     creado ya cerrado en el commit inicial): se conserva el comportamiento actual, `before`
     vacío y `confirmed` puede salir `true`. **No romper este caso.**
   - devuelve `true` → el padre existe en el remoto pero no localmente: el commit **no es
     confirmable**. `confirmed = false` → `commitPending: true`.
3. Si `is-shallow-repository` falla o devuelve algo que no sea `true`/`false` parseable, tratar
   como no confirmable (`commitPending: true`) — nunca confirmado por defecto.

Prohibido asumir `before = null → confirmed = false` de forma incondicional: eso rompe el caso
1/2a (raíz real de un repo completo), que es legítimo. Si al tocar el código este árbol resulta
imposible o falso, **parar y reportarlo**, no inventar otro criterio.

## 4. Test obligatorio que debe fallar ANTES del fix

Un clon shallow real (`git clone --depth=1`, no simulado) donde el último commit disponible
localmente es solo de prosa (no toca el ítem que se está evaluando) debe producir
`commitPending: true` para ese ítem. Confirmar que el test falla contra el código actual (hoy
sale `false`) y pasa después del fix.

**Segundo test obligatorio, no negociable:** un repo con historia completa donde el ítem nace ya
cerrado en el commit inicial (caso 2a del árbol de §3) debe seguir dando `commitPending: false`.
Sin este test, el fix del caso shallow puede romper la raíz legítima sin que nadie lo note.

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
