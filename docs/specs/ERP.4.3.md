# ERP.4.3 — El borrador no declara como salida un archivo que el proyecto ignora

## Problema
`buildNaturalDraft` (`src/dashboard/handlers/project.ts:200`) devolvió `output` con `data/inventario.sqlite`, que el
`.gitignore` del proyecto ignora (`*.sqlite`). El run falla siempre con "missing declared output(s)" y revierte los
archivos correctos.

## Cambio
1. `src/dashboard/handlers/project.ts`: agregar y exportar
   `dropIgnoredOutputs(root: string, output: string[]): string[]`.
   - Para cada ruta, `git(['check-ignore', '-q', '--', ruta], root)` (helper `git` de `src/run/sandbox.ts`, devuelve
     `exitCode`): `exitCode === 0` → ignorada, se descarta. Cualquier otro código (1 = no ignorada, 128 = no es un
     repo git) → se conserva.
   - Conserva el orden. No toca disco.
2. En `buildNaturalDraft`, justo después de la línea
   `if (draft.output.length === 0) draft.output = extractMentionedPaths(input, root)` (`project.ts:254`), aplicar
   `draft.output = dropIgnoredOutputs(root, draft.output.filter((f) => typeof f === 'string'))`.
3. Tests nuevos en `src/dashboard/__tests__/draft-ignored-outputs.test.ts`, sobre `dropIgnoredOutputs` directamente
   (sin LLM): tmp dir real con `git init` y `.gitignore` con `*.sqlite` →
   `['src/db/migrate.ts', 'data/inventario.sqlite', 'tests/migrate.test.ts']` devuelve los dos `.ts` en orden;
   tmp dir sin `git init` → devuelve la lista intacta. No hacer `git commit` en el fixture. Borrar los tmp dirs al final.

## No tocar
- `src/run/harness.ts`, `chat.ts`, el frontend, `PLAN.md`, `NEXT.md`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bunx tsc --noEmit`
- `bun test src/dashboard/__tests__/draft-ignored-outputs.test.ts src/__tests__/skill-auto-selection.test.ts`
- `bunx biome check src/dashboard/handlers/project.ts src/dashboard/__tests__/draft-ignored-outputs.test.ts`

NO correr `test:coverage` ni detenerse por el baseline (en el sandbox da fallos falsos; se verificó fuera). El candado
de escritor `ocupado: claude …` es el cerebro que delega: se puede editar. No commitear.
