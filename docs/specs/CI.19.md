# CI.19 fase 1 — el andamiaje de los ui-gates dice por qué falla un comando

## Problema
Un `git … commit -qm task fixture` falló 1 vez sin motivo: 25 flows definen su propio
`function run(command, args, cwd)` con `execFileSync(…, { stdio: 'ignore' })`, que tira el stdout/stderr.
`scripts/ui-gate/flows/qa-negative.mjs:9-18` y `restart-mid-run.mjs` ya tienen la versión que reporta
`failed (exit N): <últimos 600 chars de stdout+stderr>`.

## Qué cambiar
1. `scripts/ui-gate/lib.mjs`: exportar `run(command, args, cwd)` con el cuerpo exacto de `qa-negative.mjs:9-18`
   (import de `execFileSync` arriba).
2. En los 27 flows de `scripts/ui-gate/flows/` que definen `function run(command, args, cwd)`: borrar la copia
   local e importar `run` desde `../lib.mjs` (sumarlo al import existente si ya lo hay). Si `execFileSync` queda sin
   uso en el archivo, quitar su import. Lista: `grep -ln "^function run(" scripts/ui-gate/flows/*.mjs`.
3. Test en `scripts/ui-gate/run.test.ts` (o el archivo de test que ya importe `lib.mjs`): `run('git', ['nope'], tmp)`
   lanza un Error cuyo mensaje contiene `exit 1` y texto de git; un comando OK no lanza.

## Qué no tocar
- Otras llamadas a `execFileSync` de los flows (las que leen salida, p. ej. `git status --porcelain`).
- La lógica de los flows, `PLAN.md`, `NEXT.md`.

## Cómo se verifica
- `grep -c "^function run(" scripts/ui-gate/flows/*.mjs | grep -v ':0'` → vacío.
- `bun run typecheck`, `bun run lint`, `bun run test:coverage` verdes.
- En vivo (fuera del sandbox): `bun run gate:evidence -- --label CI.19-live -- bun run ui:gate plan-doc project-tabs model-routing`
  verde (sin `qa-negative` ni flujos de chat: Codex sin cupo hoy); copiar el `result.json` a `docs/done/evidence/CI.19-live.json` y `biome format --write`.
