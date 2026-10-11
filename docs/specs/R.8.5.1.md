# R.8.5.1 — Las tareas corren con el home del CLI aislado, igual que el chat

Decisión de Carlos 2026-10-11: las tareas no heredan las instrucciones globales del usuario.

## Problema (verificado)

- El chat de Codex corre con `CODEX_HOME` aislado: `provisionCliConfigHome(projectRoot, 'codex', …)`
  (`src/run/executors/cli-registry.ts:160-199`) crea `.orchestos/agent-home/codex`, escribe un `AGENTS.md` generado
  (`GENERATED_INSTRUCTIONS`, `cli-registry.ts:62-67`) y enlaza `auth.json`; `buildCodexChatEnv`
  (`src/run/executors/codex.ts:312`) lo pasa al proceso.
- El camino de **tareas** no: `codexEngine.run` llama `runCodex(ctx.effectiveRoot, args, timeoutMs, opts.onStep)` sin
  `env` (`codex.ts:528-534`), y `runCodex` cae en `safeChildEnv()` (`codex.ts:158-164`). El `~/.codex/AGENTS.md` global
  del usuario entra al prompt de cada tarea.
- Efecto medido 2026-10-11 (gate `restart-mid-run`): Luna se negó a escribir el archivo citando una regla personal
  del usuario ("un árbol, un escritor") sin ejecutar ninguna herramienta.

## Qué cambiar

1. **Codex, tareas** — `src/run/executors/codex.ts`, `codexEngine.run`: provisionar el home con
   `provisionCliConfigHome` y pasar el env a `runCodex`. El home es el del **proyecto** (la misma ruta que usa el chat
   para ese proyecto), no uno dentro del worktree: `ctx.effectiveRoot` puede ser `.orchestos/worktrees/<id>`; usar la
   raíz real del proyecto que el contexto ya trae (`src/run/middleware.ts:63-102`). Reutilizar `buildCodexChatEnv` o
   renombrarlo si el nombre deja de ser cierto; no duplicar la lógica.
2. **Hermanos** — `src/run/executors/external.ts:209-225,502-514` (Claude) y `src/run/executors/opencode.ts:178-189`:
   para cada CLI, el camino de tareas debe usar **exactamente** el aislamiento que el camino de chat de ese mismo CLI
   usa hoy (el registro los declara en `cli-registry.ts:80-108`). Si el chat de ese CLI no aísla hoy, **no inventarlo**:
   no tocar ese CLI y decirlo en el reporte con `archivo:línea`.
3. **Tests unitarios** (`src/__tests__/codex-engine.test.ts` y el que corresponda): el env con que el runner de
   tareas lanza el CLI lleva el home aislado del proyecto, también cuando `effectiveRoot` es un worktree. Sin spawn
   real del CLI; sin depender del `HOME` del host (Bun no ve `process.env.HOME` mutado en runtime: pasar rutas
   explícitas o usar el override que `provisionCliConfigHome` ya acepta).
4. **Paso en vivo** en un flow del pre-push que ya corre una tarea real de Codex (`restart-mid-run` caso A o
   `qa-negative`, el que menos cambie): tras terminar la tarea,
   - existe un rollout de esa corrida **dentro** de `<proyecto>/.orchestos/agent-home/codex/` (prueba que
     `CODEX_HOME` surtió efecto);
   - ese rollout contiene el texto generado por OrchestOS (`GENERATED_INSTRUCTIONS`);
   - si el host tiene `~/.codex/AGENTS.md`, una línea distintiva suya (la primera no vacía de más de 20 caracteres)
     **no** aparece en el rollout. Si el host no tiene ese archivo, el paso lo declara en el detalle y comprueba solo
     las dos condiciones anteriores.
   Nombres de paso que prometan solo lo que comprueban; ningún `true` literal; respetar `lintFlowSource`.

## Qué NO tocar

- `scripts/ui-gate/flows/read-boundary.mjs`, `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
  `runs-summary.json` (cambios ajenos sin commitear).
- `PLAN.md`, `NEXT.md`. No commitear. No `git config`.
- El contenido de `GENERATED_INSTRUCTIONS` y el camino de chat: no cambian de comportamiento.
- `~/.codex/`, `~/.claude/` del usuario: solo lectura.

## Entorno

- El candado de escritor `ocupado: claude …` es el cerebro que delega: no es un bloqueo, seguir.
- macOS no tiene `timeout`.
- NO correr `bun run test:coverage` ni detenerse por el baseline; lo corre el cerebro.
- Hay un dashboard ajeno en `localhost:4242`: no tocarlo.

## Verificación (la repite el cerebro)

1. `bunx tsc --noEmit`
2. `bun test src/__tests__/codex-engine.test.ts src/__tests__/cli-registry.test.ts` y los tests nuevos.
3. `bunx biome check` sobre los archivos tocados.
4. `bun run ui:gate <flow elegido>` en verde, con los pasos nuevos.

Reporte final: archivos tocados, salida de 1-4, qué CLIs quedaron aislados y cuáles no (con el porqué), desviaciones.
