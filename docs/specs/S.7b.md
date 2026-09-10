# S.7b — SHA de un cierre anterior aceptado tras reabrir un ítem

**Ejecutable por cualquier LLM sin decisiones adicionales.** El defecto ya está confirmado por
una auditoría independiente (`docs/audits/2026-09-10-block-s-review.md`, hallazgo 1). Quien
ejecute esto NO diseña: implementa lo de abajo. Si algo del spec resulta imposible o falso al
tocar el código, **parar y reportarlo**, no improvisar una alternativa.

Preflight obligatorio: `bun run agent:preflight -- --item S.7b --agent <tu-id>`.

## Contexto en una línea

Un ítem que se cierra, se reabre y se vuelve a cerrar **sin un commit nuevo** de por medio debe
quedar con `commitPending: true` (no hay prueba del cierre vigente). Hoy hereda en silencio el
SHA del cierre viejo.

## 1. El defecto exacto

`scripts/plan-import.ts:46-59`, función `commitShaFor`:

```ts
function commitShaFor(
  item: PlanItemSource,
  closeCommits: Map<string, string>,
  allowProvisional: boolean,
  root: string,
): string {
  const sha = closeCommits.get(item.id)
  if (sha) return sha                     // <- corre ANTES de considerar la reapertura
  if (allowProvisional) {
    const provisional = gitHead(root)
    if (provisional) return provisional
  }
  throw new Error(`Could not prove a closing commit SHA for ${item.id}`)
}
```

`closeCommits` viene de `findAllPlanCloseCommits()` (`src/db/plan-items.ts:210-230`), que camina
el historial `--first-parent` de `PLAN.md` y devuelve, por ID, el SHA de la **transición más
reciente** open→done (el walk va de más nuevo a más viejo y el primer match gana). El problema es
que `commitShaFor` toma ese SHA sin preguntar si hubo una reapertura **posterior** a ese cierre
que todavía no tiene su propio commit de cierre confirmado. Si el flujo es:
`open → done (commit A) → open (commit B) → done (sin commit todavía)`, `findAllPlanCloseCommits`
sigue devolviendo `A` para ese ID (es la única transición open→done que existe en el historial),
y `commitShaFor` lo devuelve sin más — el ítem sale `done` con `commitPending: false` aunque el
cierre vigente no tenga commit real.

## 2. Cómo reproducirlo

Fixture Git real con `ORCHESTOS_HOME` temporal (mismo patrón de `scripts/plan-import.test.ts`):

1. Crear un repo con un ítem que cierra con commit real → SHA `A` queda en `closeCommits`.
2. Commitear la reapertura del ítem (línea vuelve a `- [ ]`) → commit `B`.
3. Editar `PLAN.md` de vuelta a `- [x]` para el mismo ítem, **sin commitear** ese cambio.
4. Correr el import/reconcile (`importSources` / la ruta que usa `commitShaFor`) y observar que
   el SHA resuelto es `A` (el cierre viejo) y no un estado pendiente.

## 3. Corrección exigida

Un cierre **posterior a una reapertura** no puede reutilizar un SHA anterior a esa reapertura.
Concretamente: `commitShaFor` (o la función que le da su entrada) debe verificar, usando el
historial disponible, si existe una transición done→open para ese ID **después** del SHA
candidato. Si la hay, ese SHA queda invalidado como prueba del cierre vigente y el ítem debe
resolver a `allowProvisional` (si aplica, mismo camino que un cierre nuevo en curso) o lanzar el
error de "no se pudo probar" — nunca al SHA viejo.

Decidí la forma concreta de detectar la reapertura posterior mirando cómo ya camina el historial
`findAllPlanCloseCommits` (`src/db/plan-items.ts:210-230`): se necesita el mismo tipo de
información (transiciones por commit) pero para done→open, no solo open→done. Reutilizar el
parseo ya hecho ahí en vez de duplicar el walk de git desde cero — por ejemplo, extendiendo esa
función (o una hermana con el mismo `parsed`/`shas`) para exponer también la última transición
done→open de cada ID, y comparando el orden de ambos SHAs en el historial `--first-parent`
(el que aparece primero al caminar desde HEAD hacia atrás es el más reciente).

No cambies el contrato de `allowProvisional` en `commitShaFor` para otros casos (import inicial,
cierre en curso desde el board — ver el comentario que ya existe en `plan-import.ts:32-45` sobre
por qué ese camino existe). El fix es estrictamente: invalidar un SHA de cierre que quedó
"detrás" de una reapertura no confirmada por un cierre nuevo.

## 4. Test obligatorio que debe fallar ANTES del fix

Fixture git real: `open → close A (commit) → reopen (commit) → reclose (SIN commit)`.
Confirmar que el resultado es `commitPending: true` (o el equivalente en la capa que se esté
probando: `commitShaFor` lanza / `listPlanItemsWithCommitStatus` marca pendiente — usar el punto
de entrada más directo a la función corregida). Confirmar que este test falla contra el código
actual (hoy resolvería a `commitPending: false` con el SHA de `A`) y pasa después del fix.

Verificar además, en el mismo test o uno adicional, que una reconciliación posterior **no
revive** el SHA anterior una vez que el estado está marcado pendiente.

## 5. Gates

```
bunx tsc --noEmit
bun run test:coverage      # comando exacto de CI, NO `bun test` a secas
bun run lint
git diff --check
```

## 6. Qué NO tocar

- Archivos permitidos: `scripts/plan-import.ts`, `scripts/plan-import.test.ts`, y — solo si es
  estrictamente necesario para exponer la información de transiciones done→open — extender
  `src/db/plan-items.ts` (`findAllPlanCloseCommits` o una función hermana) y su test. No tocar
  ninguna otra función de ese archivo.
- No tocar `scripts/plan-gate.ts` ni `src/db/plan-items.ts:238-282`
  (`listPlanItemsWithCommitStatus`) más allá de lo estrictamente necesario — son S.7a y S.7c,
  ítems independientes con specs propios. Si el fix de S.7b requiere tocar
  `listPlanItemsWithCommitStatus`, pararse y reportarlo en vez de absorber ese ítem.
- No editar `PLAN.md` desde el ejecutor: el cierre lo hace el cerebro después de verificar.
- No usar `--no-verify` en ningún commit.
- No ejecutar `git config` bajo ninguna circunstancia.
- No cambiar el esquema SQLite ni las migraciones.

## 7. Cierre

Un commit que corrige `commitShaFor` (y su dependencia de datos si aplica) y agrega el test de
regresión. NO marcar S.7b `[x]`: lo hace quien verifique de forma independiente, con la
evidencia del punto 4 pegada en `PLAN.md`.
