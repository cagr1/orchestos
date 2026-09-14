# AT.2 — `listPlanItemsWithCommitStatus` deja de congelar el dashboard

Ejecutor: Luna. Implementa exactamente esto; si algo resulta imposible, para y repórtalo.
**No commitees y no toques `PLAN.md`.** El cierre lo hace el cerebro.

Preflight: `bun run agent:preflight -- --item AT.2 --agent luna`.

## Problema medido

`src/db/plan-items.ts` `listPlanItemsWithCommitStatus()` tarda 5.7 s síncronos sobre este repo
(61 ítems con SHA): por cada SHA lanza `rev-parse --verify`, `merge-base --is-ancestor`, dos
`git show` y a veces `rev-parse --is-shallow-repository`. `/api/plan` lo llama y el front lo pide
cada 30 s, así que el servidor no atiende nada más mientras tanto.

## Cambio (solo `src/db/plan-items.ts` y su test)

1. **Alcanzabilidad, un spawn por HEAD.** Caché de módulo con una sola entrada por `root`:
   `{ head: string, reachable: Set<string> }`. En cada llamada: `git rev-parse HEAD`; si el head
   cambió o no hay entrada, `git rev-list HEAD` → `Set`. Si cualquiera de los dos falla, usar un
   `Set` vacío (sin guardarlo).
2. **Dentro de `stateFor(sha)`:** tras el chequeo de `FULL_COMMIT_SHA`, reemplazar
   `rev-parse --verify <sha>^{commit}` y `merge-base --is-ancestor` por `reachable.has(sha)`
   (si no está → `null`, igual que hoy).
3. **Contenido, caché permanente.** Mapa de módulo con clave `` `${root}\0${sha}` `` que guarda el
   valor `{ after, before }` **solo cuando es no nulo**. Antes de los `git show`, si la clave
   existe, devolverla. Los resultados `null` (objeto ausente, padre ausente en clon shallow) no
   se cachean: pueden cambiar tras un `fetch`.
4. El resto de la lógica (padre, shallow, `confirmed`, `commitPending`) no cambia.
   No tocar `findAllPlanTransitionCommits`, `isConfirmedPlanCloseCommit` ni `scripts/plan-import.ts`.

## Test nuevo en `src/db/plan-items.test.ts`

Siguiendo los helpers del bloque `describe` de S.7c (línea ~203): repo git con el ítem X cerrado
en el commit A y la DB con `commitSha = A`.
- Primera llamada: X `commitPending: false`. Segunda llamada: mismo resultado.
- `git reset --hard A^` (A deja de ser alcanzable desde HEAD) → nueva llamada: X `commitPending: true`.

## Gates del ejecutor

`bun test src/db/plan-items.test.ts scripts/plan-import.test.ts` verde · `bunx tsc --noEmit`
limpio · `git status` muestra solo los 2 archivos de arriba.
