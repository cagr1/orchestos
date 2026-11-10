# AUD.1 — Lo que se mergea es exactamente lo que el contrato aprobó

GO de Carlos: 2026-11-10. Rol: `criterio`. Revisión: `qa` de otro proveedor. Citas verificadas por lectura el 2026-11-10.

## Problema

El contrato solo ve lo que le entrega `readWorktreeDiff`, y el merge commitea todo el worktree:

- `src/run/executors/worktree-diff.ts:117` descarta los archivos borrados (`if (!existsSync(full)) continue`).
- `worktree-diff.ts:79-92` descarta lo no declarado bajo `.impeccable/ .claude/ .codex/ .opencode/ .cursor/ .aider/`.
- `worktree-diff.ts:15-30` parsea `git status --porcelain` sin `-z`: una ruta con espacios o no-ASCII llega
  entrecomillada, no resuelve y se descarta.
- `src/run/sandbox.ts:205` hace `git add -A -- . :!node_modules` y commitea.
- Entre el contrato (`src/run/harness.ts:538`) y el merge (`harness.ts:984`) corren checks y QA, que también pueden
  escribir en el worktree.

Resultado: un borrado no declarado, un `.claude/hooks/x` o un archivo de nombre raro llegan a la rama base sin que
ningún paso los haya visto.

## Decisión (cerrada)

Invariante: **el commit del merge contiene solo rutas de `task.output`**. Dos piezas, ambas independientes del motor:

1. **Puerta temprana en el harness**, justo después de `enforceContract` (`harness.ts:538`) y solo si hay worktree.
   - Nueva función exportada en `worktree-diff.ts`: `listWorktreeChanges(root): { path: string; deleted: boolean }[]`.
     Usa `git status --porcelain -z -uall -- . :!node_modules` con spawn directo (sin el `.trim()` de `git()`), mismo
     parseo que `listDirtyFiles` (`src/run/sandbox-policy.ts:31-48`): un rename aporta origen (borrado) y destino.
   - Clasificación de cada ruta, normalizada con `normalizeRelPath`:
     - está en `task.output` → permitida;
     - `isHostToolingArtifact(path, task.output)` es true → ruido: no falla, no se mergea;
     - cualquier otra, borrados incluidos → violación.
   - Si hay violaciones: mismo camino que el `catch` existente de `harness.ts:539-560` (fila de run con
     `files_blocked`, descarte del worktree, `log.contractViolation`). El mensaje distingue `deleted: <ruta>`.
   - Un output declarado que fue borrado no es violación aquí: ya lo detecta `missingOutputs` (`harness.ts:603`).
2. **Merge por rutas explícitas.** `mergeWorktreeBack` (`sandbox.ts:176-184`) recibe un cuarto parámetro
   `paths: string[]`, obligatorio cuando la estrategia no es `discard`.
   - Reemplaza el `git add -A` de `sandbox.ts:205` por `git add -- <rutas>`, donde `<rutas>` es la intersección de
     `paths` con lo que `listWorktreeChanges` reporta en ese momento (evita "pathspec did not match").
   - Si la intersección es vacía no se commitea (comportamiento actual de "sin cambios").
   - `harness.ts:984` pasa `ctx.task.output`. Es el único llamador no-`discard` (verificado con grep).
3. **Hermano del bug:** `readWorktreeDiff` pasa a usar `listWorktreeChanges` en vez de `parseGitStatusPorcelain`, para
   que las rutas con espacios lleguen al contrato. Su firma y su valor de retorno no cambian.

## No tocar

- `enforceContract` (`src/run/contract.ts:69`) ni la lista `HOST_TOOLING_PREFIXES`.
- Los cuatro ejecutores (`external.ts:754`, `codex.ts:708`, `opencode.ts:362`, `generic-cli.ts:64`).
- El resto de `mergeWorktreeBackLocked` (rebase, squash, ff-only). `runs-summary.json` es AUD.2.

## Verificación

Tests nuevos con repo git temporal e identidad propia (`git -c user.name=… -c user.email=… commit`), sin spawn de CLIs:

1. Worktree con un output declarado modificado + un tracked no declarado borrado → la puerta reporta violación con
   `deleted:` y nada llega a la base.
2. Worktree con output declarado + `.claude/hooks/x.sh` no declarado → la tarea no falla; el commit del merge
   (`git show --stat --name-only`) lista solo el output.
3. Archivo `con espacio.txt` no declarado → violación (antes se descartaba en silencio).
4. Archivo `con espacio.txt` declarado → se mergea.
5. Un archivo escrito en el worktree después de la puerta (simula un check) no aparece en el commit.

Gates: `bunx tsc --noEmit`, `bun run lint`, `bun run test:coverage`. Si la suite revela un archivo que el propio
harness escribe en el worktree y debe mergearse, se añade a una constante con nombre y comentario; no se vuelve a `-A`.

## No verificado al escribir el spec

- Que `effectiveRoot` sea siempre `worktree.path` cuando hay worktree (`harness.ts:196` lo asigna; no revisé si algo lo
  cambia después). Si difieren, las rutas se calculan relativas a `worktree.path` y se reporta.
- Que ningún test existente dependa de que el merge arrastre archivos no declarados.
