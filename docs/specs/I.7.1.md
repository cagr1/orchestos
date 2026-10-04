# I.7.1 — La regla de proyecto declara el modelo; el run registra lo que de verdad corrió (spec para Luna)

Ítem: PLAN.md § I.7.1. Decisión de Carlos ya tomada (2026-10-03): **modelo en la regla**. No reabrirla.

## Bug medido (gate I.7 r4)

Regla `{ match: { output: ['claude-*.md'] }, agent: claude }` con Ejecutor `codex/gpt-6-luna`:
- `chat.ts:1081` crea la tarea con `engine: external` pero sin `executor_model`.
- `router/auto-route.ts:12` ignora `task.engine` y devuelve el rol Ejecutor (`codex/gpt-6-luna`).
- `harness.ts:250-270` arma el provider con `routeAgent = codex`, y `harness.ts:471` usa el engine `external`
  → `claude -p --model gpt-6-luna` → `missing declared output(s)`.
- El run se persiste `provider=role:codex model=gpt-6-luna` (`router/role-runner.ts:29`) para una tarea que
  corrió en Claude: el registro miente.

## Cambios

1. **`src/config/schema.ts:57`** — `TaskAgentRule` suma `model?: string` (comentario de una línea: modelo del
   CLI de esa regla; obligatorio si `agent` ≠ agente del rol Ejecutor).
2. **`src/config/load.ts:244`** — `parseTaskAgentRules` lee `model` (string no vacío, trim; otro tipo → se
   ignora el campo, no la regla). Actualizar el ejemplo comentado del YAML (`load.ts:353`) con `model:`.
3. **`src/dashboard/handlers/config.ts:206`** — validar `rule.model`: si viene, string no vacío; si no,
   400 `taskAgentRules[i].model must be a non-empty string`. Nada más en el handler.
4. **Helper único `src/router/engine-cascade.ts`** — exportar
   `taskFieldsFromRule(rule: TaskAgentRule, cfg: OrcheConfig): { engine?: 'external'|'codex'|'opencode'; executor_model?: string; cli_effort?: string } | { error: string }`:
   - engine: `claude→external`, `codex→codex`, `opencode→opencode`; `local`/`api` → sin engine.
   - si hay engine, `rule.model` ausente y `rule.agent !== cfg.roles.executor?.agent` → `{ error:
     "Task rule for <agent> has no model. Set it in Settings → Task rules." }`.
   - `executor_model = rule.model` si existe; `cli_effort = rule.cli_effort` si existe.
   Usarlo en **los dos** call sites, borrando el mapeo duplicado agent→engine de cada uno:
   - `src/dashboard/handlers/chat.ts:1081-1098`: resolver la regla y el helper **antes** de
     `reserveTurnTask`/`createTaskRecord`. Si devuelve `error` → no se reserva ni se crea nada y
     `autoTask = { error }` (el chat ya muestra `⚠ Could not auto-create the task: <error>`).
   - `src/dashboard/handlers/tasks.ts:360-381`: mismo helper; `error` → `errorResponse(error, 400)`.
     `body.cli_effort` sigue ganando sobre el de la regla.
5. **`src/router/auto-route.ts`** — `autoRoute` respeta `task.engine` CLI (`external→claude`,
   `codex→codex`, `opencode→opencode`):
   - modelo = `task.executor_model` ?? (modelo del Ejecutor **solo si** `roles.executor.agent` es ese mismo
     agente); si no hay modelo → `null`.
   - devuelve `{ agent, provider: agent, model, effort: (mismo agente que el Ejecutor ? executor.effort :
     undefined), source: task.executor_model ? 'task' : 'executor' }`.
   - Sin engine CLI: comportamiento actual intacto (`executor_model` → `api`; si no, Ejecutor).
   Callers que heredan el cambio sin tocarlos: `harness.ts:248`, `tasks.ts:493`, `config.ts:60`,
   `cli.ts:1037,2668`, `evals/runner.ts:69`. Verificar que todos manejan `null` (ya lo hacen).
6. **`src/run/harness.ts:248-270`**:
   - Si `route` es `null`, la tarea tiene engine CLI y `roles.executor` existe, lanzar un `Error` con
     `task <id> runs on <agent> but has no executor_model, and the Executor is <executorAgent>` en vez de
     `RoleUnassignedError('executor')` (que sería mentira). Sin engine CLI: igual que hoy.
   - Para rutas CLI, el provider persistido es el agente real: `ctx.provider = { ...client.provider, name:
     routeAgent }` (el `chat` de `clientFromAssignment` usa closure, no `this`). Así `runs.provider` =
     `claude`/`codex`/`opencode` y `runs.model` = el modelo que se pasó al CLI. No tocar `role-runner.ts`
     (los roles orchestrator/reviewer siguen con `role:<agent>`).
7. **`src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`** (Task rules, ~1570-1745):
   - `RoutingRule` suma `model?: string`.
   - Por regla, un combobox `aria-label="rule model"` copiando **literal** el JSX/className del combobox de
     effort de la misma fila (cero CSS nuevo). Opciones: `''` + `routingCatalog.find(a => a.id === rule.agent)?.models`
     (mostrar `name`, guardar `id`). Etiqueta del vacío: `Executor model` si `rule.agent` ===
     `routingRoles.executor?.agent`, si no `Model required`.
   - Cambiar el agente de una regla borra su `model` y su `cli_effort`.
   - Se guarda por el mismo `saveConfig({ roleAssignments, taskAgentRules })` que ya existe.
8. **`scripts/ui-gate/flows/auto-flow.mjs:255`** — la regla de Claude pasa a
   `{ match: { output: ['claude-*.md'] }, agent: 'claude', model: 'haiku' }` (precedente:
   `chat-streaming.mjs:106`). La de Codex queda sin modelo (= Ejecutor). En `distinctAndPresent` (~línea 415)
   sumar `claudeRun.model === 'haiku'`. No tocar nada más del flujo.

## Tests (bun:test, junto a los existentes de cada módulo)

- `autoRoute`: engine `external` + `executor_model: 'haiku'` → `{agent:'claude', provider:'claude', model:'haiku'}`;
  engine `external` sin modelo con Ejecutor codex → `null`; engine `codex` sin modelo con Ejecutor codex →
  modelo y effort del Ejecutor; sin engine → igual que antes (`api` con `executor_model`, si no Ejecutor).
- `taskFieldsFromRule`: los 3 caminos (claude con model, claude sin model con Ejecutor codex → error, codex
  sin model con Ejecutor codex → solo engine).
- `parseTaskAgentRules`: lee `model`; `model: 3` se ignora sin descartar la regla.
- `POST /api/tasks` sin engine/modelo que matchea regla sin modelo hacia otro agente → 400 y `tasks.yaml`
  sin cambios.
- Si hay tests del auto-task del chat (`chat*.test.ts`), sumar el caso error → ninguna tarea creada.
- Harness: run de tarea `engine: external` + `executor_model` persiste `provider: 'claude'` (con el executor
  inyectado/mocked como en los tests existentes del harness; no spawnear CLIs reales).

## Gate (todo debe pasar antes de reportar)

`bunx tsc --noEmit` · `bun run lint` · `bun test` **completo** · `bun run build:app` (el `dist/` está
versionado; incluirlo). Reportar la salida real de cada uno. El cerebro corre después `test:coverage`,
`ui:gate model-routing` y el `auto-flow` en vivo fuera del sandbox.

## Fuera de alcance

I.7.2 (reporte inline del final), `opencode` en vivo, el modal muerto de `PlanBoardView.tsx:623`, validar
modelos contra el catálogo en el backend, cualquier cambio a `role-runner.ts` o a otros flujos de ui-gate.
No commitear.
