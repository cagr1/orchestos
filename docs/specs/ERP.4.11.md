# ERP.4.11 — la tarea muestra el ejecutor del rol Executor, no un proveedor elegido por el LLM

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`/`NEXT.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.11 --agent claude --scope "src/**,scripts/ui-gate/**,NEXT.md,PLAN.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques. Prohibido `prettier`, `git stash`, `git commit`, `git checkout` de archivos.
NO corras `bun run test:coverage` ni te detengas por el baseline: lo corre el cerebro.

## Síntoma (piloto ERP.4, hallazgo 6)
Las tareas creadas por el chat quedaron en `tasks.yaml` con `executor: anthropic` y Settings → Tasks las etiquetó así,
aunque el rol Executor del proyecto era `codex / gpt-6-luna` y todos los runs usaron `codex exec -m gpt-6-luna`.
Regla de Carlos (2026-10-13): nada hardcodeado; la tarea dice quién la hace según la config.

## Causas (leídas en el código)
1. El prompt del borrador hace elegir al LLM `"executor"` entre `openrouter`, `anthropic` y `openai`
   (`src/dashboard/handlers/project.ts:226`), con respaldo `openrouter` (`project.ts:265`), y `chat.ts:1152` lo pasa a
   `createTaskRecord`.
2. `createTaskRecord` escribe siempre `executor: executor || 'openrouter'` (`src/dashboard/handlers/tasks.ts:239,275`).
3. Quién ejecuta lo decide `autoRoute(task, cfg)` (`src/router/auto-route.ts:13-45`): `engine` de la tarea, o
   `executor_model`, o el rol `cfg.roles.executor`. `task.executor` solo es el proveedor cuando hay `executor_model`
   por API (`auto-route.ts:34`) y un respaldo en `harness.ts:263`.
4. La etiqueta visible sale del campo guardado: `loadTaskRows` (`handlers/tasks.ts:86` y el hermano de `:132`),
   `handlers/config.ts:62`, `src/cli.ts:1039` y `:2746`; el frontend arma `assignedAgent` con
   `row.engine || row.executor` (`src/dashboard/app/src/api/tasks.ts:34`).

## Comportamiento exigido
- El borrador no elige proveedor: fuera la clave `"executor"` del prompt, del JSON parseado, de la validación de
  `project.ts:265` y de `NaturalDraft`. `chat.ts` deja de pasarlo. Revisa consumidores de `NaturalDraft.executor` en
  backend y frontend (`grep -rn "executor" src/dashboard/app/src` acotado al borrador/"natural") y quítalos.
- `createTaskRecord` escribe `executor` en `tasks.yaml` **solo** si el llamador lo pasa explícito o si hay
  `executor_model` (inferido como hoy con `inferExecutorFromModel`). Sin ninguno de los dos, el campo no se escribe.
  El esquema ya tolera su ausencia (`validateExecutor(undefined)` → `'openrouter'`, `src/tasks/schema.ts:97`): no lo
  cambies.
- La etiqueta visible se **resuelve**, no se lee del campo: una función pura exportada junto a `autoRoute`
  (p. ej. `describeTaskExecutor(task, cfg): { agent: string; model: string } | null`, que envuelve `autoRoute`).
  `null` = rol Executor sin asignar y tarea sin modelo propio.
  - `loadTaskRows` y su hermano de `tasks.ts:132` devuelven `assignedAgent` y `assignedModel` resueltos (`null` si no
    hay ruta). El campo `executor` de la fila se elimina si nadie más lo usa; si algo lo usa, dilo en el reporte.
  - Frontend (`app/src/api/tasks.ts:34` y el tipo de la fila): `assignedAgent` = `agent · model` de esos campos; sin
    ruta, cadena vacía (no inventar texto nuevo ni clases CSS). No toques el JSX más allá de lo que obligue el tipo.
  - `handlers/config.ts:62`, `cli.ts:1039` y `cli.ts:2746`: misma función; sin ruta imprimen `unassigned`.
- No toques `harness.ts:263` ni `auto-route.ts:34`: el respaldo interno sigue igual.

## Tests
- `describeTaskExecutor`: rol Executor `codex/gpt-6-luna` y tarea sin `engine` ni `executor_model` →
  `{ agent: 'codex', model: 'gpt-6-luna' }`; tarea con `engine: external` y `executor_model` propio → `claude` + ese
  modelo; sin rol y sin modelo → `null`.
- `createTaskRecord` sin `executor` ni `executor_model` → el YAML escrito no contiene la clave `executor`; con
  `executor_model: 'claude-x'` → `executor: anthropic` como hoy.
- `buildNaturalDraft`: el resultado no tiene `executor` y el prompt no menciona `openrouter`.
- `loadTaskRows` (o el handler de `/api/tasks`) con una tarea cuyo YAML dice `executor: anthropic` y rol Executor
  `codex/gpt-6-luna` → `assignedAgent: 'codex'`, `assignedModel: 'gpt-6-luna'`. Este caso es el del piloto: comprueba
  que falla con la lógica vieja y dilo en el reporte.
- Ajusta los tests existentes que afirmen `executor: 'openrouter'` en tareas creadas sin proveedor; lista cuáles.

## Gate en vivo (lo escribes tú, lo corre el cerebro)
En `scripts/ui-gate/flows/tasks.mjs` (navegador real, Settings → Tasks del proyecto temporal) añade pasos:
1. la tarjeta de una tarea creada sin modelo propio muestra el agente y el modelo del rol Executor que el propio flujo
   configura (léelos de la config del fixture, no los escribas a mano en la aserción);
2. el `tasks.yaml` de una tarea creada por el flujo no contiene `executor: openrouter|anthropic|openai`.
Sin pasos `true` literales; cada paso con su `note`.

## No tocar
`autoRoute` (su lógica), `harness.ts`, `styles.css`, el esquema de `tasks.yaml`, `PLAN.md`. No añadir clases CSS.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test <los archivos de test que tocaste>` · `bun run build:app` ·
`bun run ui:fidelity:jsx` · `node --check scripts/ui-gate/flows/tasks.mjs`.
