# CI.4 — Higiene de gates: Luna 6, test inestable, residuo de tests

Diagnóstico en PLAN.md § CI.4 (no re-diagnosticar).

## Cambios
1. **Luna 6 en los turnos reales.** En `scripts/ui-gate/flows/*.mjs`, todo lo que elige o compara `gpt-5.6-luna`
   pasa a `gpt-6-luna` (regex del selector incluida: `/gpt-6-luna/i`). Fixtures y tests que usan el id como dato de
   ejemplo (`src/dashboard/app/src/api/tasks.test.ts`, `src/dashboard/__tests__/tasks-api-init.test.ts`,
   `src/dashboard/handlers/runs.test.ts`, `src/dashboard/app/src/data/orcaProjectData.ts`): actualizar solo si el
   test depende del modelo vigente; si es un id cualquiera, dejarlo. Comentarios de `src/run/executors/codex.ts`
   (`:31`, `:63`, `:82`) que dicen qué declara hoy `config.toml`: actualizarlos a `gpt-6-luna`. Nada de lista
   hardcodeada nueva: el catálogo sigue saliendo de la caché de Codex.
2. **Test inestable, `scripts/context-adapters.test.ts:187`.** El binario falso es un script de bun; su arranque en
   frío bajo carga supera los 500 ms. Subir `timeoutMs` del test (p. ej. 5 000) y el timeout del `test()` para
   que lo cubra: el falso responde en cuanto arranca, así que el caso normal sigue siendo rápido. No tocar el
   timeout de producción (`context-adapters.ts:201`). Revisar si otros tests del mismo archivo o de
   `session-status.test.ts` usan un timeout igual de corto contra un proceso real y aplicar lo mismo.
3. **Residuo de tests.** Encontrar qué test escribe `.orchestos/adversarial-review-state.json` en la raíz del repo
   real (`STATE_PATH`, `scripts/adversarial-review.ts:33`; sospecha: un camino que usa `process.cwd()` en vez del
   `root` temporal, visto con `infrastructure-error` en el sandbox) y hacer que use su tmpdir. Luego barrer: correr
   `bun run test:coverage` con el árbol limpio y comprobar `git status --porcelain` vacío; todo archivo nuevo que
   aparezca es otro residuo del mismo tipo y se arregla igual.

## Gate (lo que el cerebro va a medir)
- `bun run ui:gate usage-bar`, `text-sweep`, `chat-turn-details`, `tasks`, `runs-graph`, `project-tabs` verdes con el
  turno real en `gpt-6-luna` (el paso del modelo lo dice en su detalle); `text-sweep` registra `gpt-6-luna` · `medium`.
- `bun run test:coverage` 5 veces seguidas: 0 fallos las 5.
- Tras `bun run gate:all`: `git status --porcelain` sin archivos nuevos.
- `grep -rn "gpt-5.6-luna" scripts/ui-gate` vacío.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. No re-ejecutes `agent:preflight` (ni para este ítem ni para otro). El dashboard
real corre en :4242: no lo mates. `bun run typecheck` completo; `bunx biome check . --diagnostic-level=error` = 0.
Lista TODOS los archivos que toques. Si algo falla por el sandbox (EADDRINUSE, EPERM, red), dilo así. No hagas commit.
