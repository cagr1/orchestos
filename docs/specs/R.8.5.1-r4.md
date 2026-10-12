# R.8.5.1 — ronda 4: hallazgos de la revisión `qa`

**Contexto del árbol:** `src/run/executors/codex.ts`, `src/run/executors/external.ts`, sus tests y
`scripts/ui-gate/flows/qa-negative.mjs` tienen cambios SIN commitear: son las rondas 1 y 3 de este ítem, ya revisadas.
No son ajenos; se edita encima. No revertirlos.

## Defectos

1. **Spawn de Codex sin aislar en el camino de roles** — `src/providers/codex.ts:12` lanza `codex exec` sin `env`.
   Lo alcanza `src/run/role-runner.ts:34` cuando un rol (p. ej. revisor) está configurado como
   `{agent: api, provider: codex}`. Hereda el `~/.codex/AGENTS.md` del usuario.
2. **El revisor de QA provisiona su home dentro del worktree** — `src/run/harness.ts:258` pasa `effectiveRoot` al
   revisor y `src/run/executors/codex.ts:331` usa ese mismo valor como cwd **y** como raíz del home. Con sandbox
   worktree el home queda en `<worktree>/.orchestos/agent-home/codex` y desaparece al limpiar el worktree.
3. **El gate acepta un rollout que no es de la tarea** — `scripts/ui-gate/flows/qa-negative.mjs` (bloque
   `// R.8.5.1`) concatena todos los rollouts del home del proyecto; un rollout de chat o del revisor bastaría para
   que los tres pasos pasen.

## Qué cambiar

1. Todo spawn de `codex` fuera del chat interactivo corre con `CODEX_HOME` aislado. Separar "cwd donde trabaja el CLI"
   de "raíz del proyecto cuyo home se usa": el cwd puede ser el worktree, el home es siempre el del proyecto
   (`<projectRoot>/.orchestos/agent-home/codex`). Para (2), que el llamador pase ambos. Para (1), si el llamador no
   conoce la raíz del proyecto, propagarla desde `role-runner.ts`/harness; solo si de verdad no existe proyecto usar
   el mismo override de home general que ya usa el chat general (`codex.ts:412-420`). No duplicar lógica de
   provisión: todo pasa por `provisionCliConfigHome` + `buildCodexChatEnv`.
2. Revisar con `grep` todos los spawns de `codex` y `claude` en `src/` (excluyendo tests) y listar en el reporte cada
   uno con `archivo:línea` y si aísla. Los de `claude` fuera del chat que no aíslen: aplicar el mismo criterio de la
   ronda 1 (los flags del chat) solo si son ejecución de tareas/roles; si es otra cosa (detección de versión, cuotas,
   login), no tocar y decirlo.
3. Gate: los tres pasos operan solo sobre el rollout **de la tarea** `gate-qa-ok`: filtrar los rollouts por un
   marcador propio de la corrida del ejecutor (el texto del contrato de salida con `ok.txt`/el archivo declarado de
   esa tarea, o el `cwd` del worktree de esa tarea). El primer paso exige exactamente que exista al menos uno tras el
   filtro y su detalle dice cuántos había antes y después de filtrar.
4. Tests unitarios para (1) y (2): el env del spawn lleva el home del **proyecto** cuando el cwd es un worktree; el
   spawn de `src/providers/codex.ts` lleva `CODEX_HOME` aislado. Sin spawn real; sin depender del `HOME` del host.

## Qué NO tocar

`scripts/ui-gate/flows/read-boundary.mjs`, `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`, `PLAN.md`, `NEXT.md`. Comportamiento del chat interactivo. `GENERATED_INSTRUCTIONS`. No
commitear. No `git config`.

## Entorno

- El candado de escritor `ocupado: claude …` es el cerebro que delega: seguir.
- NO correr `bun run test:coverage` ni detenerse por el baseline. Dashboard ajeno en `localhost:4242`: no tocarlo.

## Verificación (la repite el cerebro)

1. `bunx tsc --noEmit`
2. `bun test` de los tests tocados y nuevos.
3. `bunx biome check` sobre los archivos tocados.
4. `bun run ui:gate qa-negative` en verde.

Reporte final: archivos tocados, salida de 1-4, la lista de spawns del punto 2, desviaciones.
