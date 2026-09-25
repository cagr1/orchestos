# MR.1.b — Ejecución por rol + borrar los hardcodes de modelo (spec para Luna)

Preflight: `bun run agent:preflight -- --item MR.1 --agent codex` (el preflight solo reconoce ítems de primer nivel).
Contexto: PLAN.md § MR.1 y `docs/specs/MR.1.a.md` (ya cerrado: `cfg.roles`, `resolveRole`, `RoleUnassignedError`).
Este sub-ítem hace que **toda** elección de modelo en ejecución salga de `cfg.roles` (o de una indicación explícita:
`--model`, `task.executor_model`, `task.engine`) y borra los modelos hardcodeados. **No** toca la UI ni el chat del
dashboard (`handlers/chat.ts`, eso es MR.1.c/MR.1.d) ni los campos `models`/`routes` que GET/PUT de config exponen
hoy a la UI (los retira MR.1.c junto con la UI vieja).
Prohibido: `orchestos init`, `git config` de cualquier tipo, tocar ítems ⚡ ajenos, commitear, invocar `codex exec`
o delegar a otro agente, escribir en el `orchestos.config.yaml` real del repo (tests siempre en dir temporal),
volver a introducir un modelo por defecto en producción (en tests sí, dentro del fixture).

## Decisiones de Carlos (2026-09-24) — no reabrir
- Rol sin asignar = error claro (`RoleUnassignedError`, mensaje de MR.1.a). Nunca un default elegido por OrchestOS.
- Migración: si el config legacy tiene `agent` (o sus nombres viejos, ver `resolveAgent`) = `claude`, `codex` u
  `opencode`, el rol `executor` **no** se migra desde `models.executor_heavy` (queda sin asignar). Motivo: el modelo
  API viejo no es traducible al CLI y migrarlo cambiaría en silencio de CLI a API.

## 1. `src/router/role-runner.ts` (nuevo) — un solo punto para llamar a un rol en modo lectura
```ts
export interface RoleClient { role: RoleName; agent: RoleAgent; model: string; effort?: string; provider: ProviderClient }
export interface RoleRunnerDeps { claude?: typeof runClaudeChat; codex?: typeof runCodexChat; opencode?: typeof runOpencodeChat; getProvider?: typeof getProvider }
export function roleClient(cfg: OrcheConfig, role: RoleName, opts: { cwd: string; timeoutMs?: number; deps?: RoleRunnerDeps }): RoleClient
export function clientFromAssignment(role: RoleName, a: RoleAssignment, opts: { cwd: string; timeoutMs?: number; deps?: RoleRunnerDeps }): RoleClient
```
- `roleClient` = `clientFromAssignment(role, resolveRole(cfg, role), opts)` → lanza `RoleUnassignedError` si falta.
- `provider.chat({model, system, messages, maxTokens})` según `agent`:
  - `api` → `getProvider(a.provider ?? 'openrouter').chat(...)` tal cual.
  - `claude` → `runClaudeChat(cwd, system, userMessage, timeoutMs, a.model, a.effort)`;
    `codex` → `runCodexChat(cwd, system, userMessage, timeoutMs, a.model, a.effort)`;
    `opencode` → `runOpencodeChat(cwd, system, userMessage, timeoutMs, a.model)` (su chat no acepta esfuerzo:
    comentario de una línea, sin inventar flag).
  - `userMessage` = `messages.map(m => \`## ${m.role}\n${m.content}\`).join('\n\n')` (mismo formato que
    `providers/codex.ts`). `maxTokens` se ignora en los CLI.
  - Devuelve `ChatResponse` `{ text, inputTokens, outputTokens, model }` con el `model` **real** que devuelve el
    runner del CLI (no el pedido).
- Los tres runners de chat ya son de solo lectura (`--restricted` + Read/Glob/Grep; `--sandbox read-only`;
  `--agent plan`): Revisor, Auxiliar y Orquestador corren siempre por aquí y **nunca** por los engines de escritura.
- `timeoutMs` por defecto: `cfg.external?.timeoutMs ?? 20 * 60_000` (mismo tope que el engine external).
- `provider.name` = `'role:<agent>'`.

## 2. `src/config/load.ts` y `src/config/schema.ts`
- `resolveRoles`: aplicar la decisión de migración de arriba (usar el valor ya resuelto por `resolveAgent(raw)`).
  Comentario de una línea con el porqué.
- `DEFAULT_CONFIG.models = {}` y el tipo de `OrcheConfig.models` pasa a
  `Partial<Record<'planner'|'executor_heavy'|'executor_light'|'default', ModelRoleConfig>> & { qa?: ModelRoleConfig }`.
  `mergeWithDefaults` solo pone las claves presentes en el YAML (sin default). `models` queda **solo** como origen de
  la migración y para lo que GET/PUT de config ya exponen; ningún código de ejecución lo lee.
- Arreglar los lectores de `cfg.models.*` que quedan (`handlers/config.ts:36-40` y similares) con encadenamiento
  opcional; mostrar `'(sin asignar)'` cuando falte. No cambiar la forma del JSON de GET.

## 3. Ejecutor — `src/router/auto-route.ts` + `src/run/harness.ts`
Reescribir `autoRoute(task, cfg)` (quitar el parámetro `configFound` y actualizar todos los llamadores):
```ts
export interface RouteResult { agent: RoleAgent; provider: string; model: string; effort?: string; source: 'task' | 'executor' }
export function autoRoute(task: Task, cfg: OrcheConfig): RouteResult | null   // null = executor sin asignar
```
- `source:'task'` si `task.executor_model` existe: `{ agent: 'api', provider: task.executor, model: task.executor_model }`.
- Si no, `roles.executor`: `{ agent, provider: a.provider ?? (agent==='api' ? 'openrouter' : agent), model, effort }`.
- Borrar `CLASS_TO_ROLE` y la regla planner→executor_heavy (ya no hay roles por clase: `executor_light` desaparece).
- `formatRoute` → `"<agent>/<model> (<source>)"`, con `" · <effort>"` si hay esfuerzo.
- Borrar `src/router/models.ts` (`MODEL_MAP`/`resolveModel`) y todos sus usos.

En `runTask`:
- `modelOverride` (el `--model` de Carlos) sigue ganando sobre el modelo; el engine lo decide la ruta.
- `route === null` y sin `modelOverride` → `throw new RoleUnassignedError(<mensaje de resolveRole para 'executor'>)`
  dentro del `try` existente (así cae en el catch-all y la corrida queda registrada como fallida con ese motivo).
- **Antes de gastar** (justo después de resolver la ruta, antes de la cadena de enriquecimiento): resolver también el
  Revisor con `roleClient(orcheConfig, 'reviewer', …)`; si lanza, la corrida falla igual, sin llamar al Ejecutor.
  Sin `orcheConfig` → `loadOrcheConfig(projectRoot)` (hoy el harness acepta `orcheConfig` undefined).
- Engine: `ctx.task.engine` gana (lo fija `taskAgentRules` o la tarea); si no, por `route.agent`:
  `claude→external`, `codex→codex`, `opencode→opencode`, `api→orcheConfig.apiMode ?? 'single-shot'`.
  El top-level `orcheConfig.agent` **deja de decidir el engine del Ejecutor** (sigue existiendo para el chat, MR.1.d).
  Actualizar el comentario largo de la precedencia (quitar lo que ya no es cierto, conservar el porqué histórico).
- `ctx.providerName` = `route.provider`. `ctx.provider`: si `route.agent === 'api'` → `getProvider(route.provider)`;
  si es CLI → `clientFromAssignment('executor', {agent, model, effort}, {cwd: effectiveRoot}).provider`
  (hoy `getProvider('claude'|'opencode')` lanzaría).
- Esfuerzo: añadir `cliEffort?: string` a `RunContext` (`src/run/middleware.ts`) = `ctx.task.cli_effort ?? route.effort`;
  los tres engines CLI leen `ctx.cliEffort` en vez de `ctx.task.cli_effort` (`codex.ts:382,427`,
  `external.ts:469,533`, `opencode.ts:308`). No mutar `ctx.task`.
- `dryRun`: imprimir `agent/model (source)` y el Revisor resuelto.

Llamadores de `autoRoute`/`resolveModel` a actualizar: `cli.ts:666` (one-shot `run --task`: usar
`roleClient(cfg,'executor',{cwd:root})` para modelo y llamada; `contextWindowFor` sigue con `client.model`),
`cli.ts:995-1040` (`config show`: imprimir los 4 roles `role → agent/model · effort` o `(sin asignar)`, y la vista
previa por tarea con `formatRoute` o `(executor sin asignar)`), `cli.ts:2640` (`task explain`),
`evals/runner.ts:71` (engine con la misma regla que el harness; sin ruta ni `overrides.model` → lanza
`RoleUnassignedError`), `handlers/config.ts:55` y `handlers/tasks.ts:486` (mostrar `(executor sin asignar)`).

## 4. Revisor — QA, adversarial y refuter
- Borrar `QA_JUDGE_DEFAULTS` y `resolveQAJudge` de `harness.ts`. El juez = el `RoleClient` del Revisor resuelto
  antes de gastar (punto 3): `runQA`, `runAdversarialQA` y `runRefuter` reciben `provider: reviewer.provider` y
  `model: reviewer.model`.
- Si Revisor y Ejecutor tienen el mismo `agent` y `model`: conservar `log.info('qa judge equals executor model —
  correlated errors risk')`. No bloquea.
- `runQA`/`runAdversarialQA`/`runRefuter` (`src/run/qa.ts`): si hoy tienen un provider por defecto cuando falta
  `provider`, hacerlo obligatorio (sin default).

## 5. Auxiliar — `agents/diagnose.ts` y `memory/judge.ts`
- `diagnoseTask(taskId, root, modelOverride?)`: con `modelOverride` → `clientFromAssignment('auxiliary',
  {agent:'api', model: modelOverride}, {cwd: root})`; sin él → `roleClient(loadOrcheConfig(root), 'auxiliary', {cwd: root})`.
  Borrar `'anthropic/claude-haiku-4-5'` y el doble intento `chat` → `getProvider('openrouter')` (caída silenciosa).
  `usdCost` sigue con `calcCost(resp.model, …)`.
- `judgeConflict(entryA, entryB, client: { provider: ProviderClient; model: string })`: parámetro obligatorio (no
  tiene llamadores de producción; ajustar el re-export de `db/memory.ts` si hace falta). Borrar el default haiku y el
  doble intento.

## 6. Orquestador — `spec/draft.ts` y auto-split
- `draftSpec`: `roleClient(loadOrcheConfig(root), 'orchestrator', {cwd: root})`; borrar `models.default` y
  `'deepseek/deepseek-r1'`.
- Auto-split (`harness.ts`, `generatePlan`): usar el Orquestador, no el Ejecutor. `generatePlan(desc, id, opts)`
  (`agents/planner.ts`) acepta `opts.client?: ProviderClient`: si viene, usa ese cliente por el camino de texto
  (sin tool-calling); si no, el comportamiento actual. Orquestador `api` → `{provider: a.provider ?? 'openrouter',
  model}`; CLI → `{provider: agent, model, client: roleClient(...).provider}`. Orquestador sin asignar → el `catch`
  existente lo loguea (`auto-split: generatePlan falló (Rol 'orchestrator' sin asignar…)`) y sigue como hoy.

## 7. Barrido final — cero modelos hardcodeados en producción
`rg -n "claude-haiku-4-5|gpt-4o-mini|deepseek-r1|deepseek-v4-flash|MODEL_MAP|resolveModel|QA_JUDGE_DEFAULTS" src --glob '!**/__tests__/**' --glob '!**/*.test.ts' --glob '!src/dashboard/app/**'`
Pegar la salida. Lo que quede debe ser solo: comentarios históricos, tablas de precios/ventanas de contexto
(`model-catalog`/`pricing`), mapeos de nombre CLI, o `load.ts` scaffold comentado. Cualquier otro uso como modelo
elegido por defecto → borrarlo con la misma regla (rol o error). Listar en el reporte cada línea que quede y por qué.

## 8. Tests
Nuevos en `src/__tests__/role-runner.test.ts` (runners inyectados por `deps`, nunca binarios reales ni HOME real):
1. `api` → llama a `getProvider(provider).chat` con model/system/messages sin cambios.
2. `claude`/`codex`/`opencode` → llaman al runner con `(cwd, system, userMessage formateado, timeout, model, effort)`
   (opencode sin effort) y el `ChatResponse.model` es el que devuelve el runner.
3. Rol sin asignar → `RoleUnassignedError` con el mensaje exacto.
4. Migración: YAML con `agent: codex` + `models.executor_heavy` → `roles.executor` ausente; con `agent: api` (o sin
   `agent`) → migra como en MR.1.a.
5. `autoRoute`: `task.executor_model` → `source:'task'`; `roles.executor` codex con esfuerzo → agent/model/effort;
   sin executor → `null`.
6. Harness: sin Revisor asignado → la corrida falla con el mensaje de `RoleUnassignedError` y el provider del Ejecutor
   **no** recibió ninguna llamada. Con Ejecutor `codex` + esfuerzo `medium` → el engine codex recibe
   `cliEffort:'medium'` (espiar `buildCodexArgs` o el engine inyectado, lo que ya usen los tests del harness).
7. Harness: el juez de QA recibe el modelo del Revisor (no `gpt-4o-mini`).
Actualizar los tests existentes que dependían de lo borrado (`qa-judge.test.ts`, `router.test.ts`, tests de
`runTask`, diagnose, judge, draft): en vez de depender del default, el fixture declara `roles` explícitos. No borrar
un test sin decir en el reporte cuál y por qué.
Recordatorio (PLAN.md § CI.5): Bun no ve cambios a `process.env`/`homedir()` en runtime; `loadOrcheConfig` también
lee el config global del HOME real → en los tests pasar siempre el `orcheConfig` o un `root` temporal con su YAML.

## Verificación (Luna corre y pega la salida real, sin resumir)
1. `bunx tsc --noEmit`
2. `bun test src/__tests__/role-runner.test.ts src/__tests__/model-roles-config.test.ts src/__tests__/qa-judge.test.ts src/__tests__/router.test.ts` más los archivos de test del harness, diagnose, judge y draft que hayas tocado.
3. El barrido del punto 7.
4. `bunx biome check` sobre los archivos tocados.
(`bun run test:coverage` lo corre el cerebro fuera del sandbox.)
Reporte final: archivos tocados, tests modificados o borrados con su motivo, y cualquier punto del spec que no se
pudo cumplir, dicho explícitamente.

## Ronda 2 — hallado por el cerebro fuera del sandbox (2026-09-24)
`bun test` completo: **1512 pass / 25 fail**. La ronda 1 solo corrió la suite dirigida. Fallos por archivo:
engine-selection 8, harness-evidence 7, harness-engine-persistence 5, spec 2, chat-r5-reliability 2,
skill-auto-selection 1. La mayoría: `Rol 'reviewer'/'orchestrator' sin asignar` porque el fixture no declara `roles`.
1. Arreglar esos 6 archivos declarando `roles` explícitos en el `orcheConfig`/YAML temporal del fixture. No debilitar
   asserts ni reintroducir defaults en producción. Si un test afirmaba el comportamiento viejo `agent` → engine
   (BB.1), reescribirlo a `roles.executor.agent` → engine y decirlo en el reporte.
2. `src/dashboard/handlers/skills.ts` `auxiliaryClient`: borrar la rama que inventa `{agent:'api', model:'mock'}`
   cuando `chatImpl` está mockeado. Producción no se comporta distinto bajo test: el rol sale siempre de
   `roleClient(config, 'auxiliary', …)` (el `deps.getProvider` inyectado puede quedar); los tests de skills
   declaran `roles.auxiliary` en su root temporal.
3. `handleApiSkillsRegistryImport` llama `normalizeImport(..., process.cwd())`: pasarle el root del proyecto igual que
   a los otros handlers de skills (`withDashboardProject` en `server.ts`).
4. Un `script "db:migrate" exited with code 1` aparece en la salida: ubicar qué test lo produce; si ya fallaba antes
   de MR.1.b (`git stash` no — compararlo leyendo el test), decirlo en el reporte sin tocarlo.
Verificación: `bunx tsc --noEmit`; `bun test` **completo** con la línea final `N pass / M fail` pegada literal; biome
sobre los tocados.

## Ronda 3 — hallado por el hook pre-push (ui:gate en navegador real, 2026-09-24)
`chat-turn-details`, `runs-graph` y `project-tabs` fallan: sus proyectos temporales (`orchestos init`) no declaran
`roles`, y antes funcionaban por los defaults que MR.1.b borró (`Rol 'orchestrator'/'reviewer' sin asignar`).
1. En esos 3 flujos (`scripts/ui-gate/flows/*.mjs`), justo después de `orchestos init`, escribir en el
   `orchestos.config.yaml` del proyecto temporal (parse + set con la lib `yaml` que ya usan, sin pisar el resto):
   `roles: { orchestrator, executor, reviewer, auxiliary }` = `{ agent: codex, model: gpt-6-luna, effort: medium }`
   los cuatro (turno real de gate = Codex · gpt-6-luna · medium, AGENTS.md). Revisar si otro flujo de
   `scripts/ui-gate/flows/` ejecuta tareas o chat con auto-creación sin roles y aplicarle lo mismo; listarlos.
2. MR.1.b2 — `src/run/executors/codex.ts`: el catálogo de Codex da ids nativos (`gpt-6-luna`) y el precio está en
   OpenRouter como `openai/gpt-6-luna`. Añadir `codexPricingId(model)` (`model.includes('/') ? model :
   \`openai/${model}\``) y usarlo en el chequeo de catálogo del engine (`codex.ts:404`, y `calcCost` del engine) y
   en el `calcCost` de `runCodexChat`. Además mover el chequeo de catálogo del engine a **antes** de lanzar el
   proceso (se sabe de antemano; hoy se descubre tras gastar), con el mismo mensaje. Tests en
   `codex-engine.test.ts`: id nativo con `openai/<id>` en el catálogo → corre y tarifa; id que no está → falla sin
   spawnear (espía del spawn con 0 llamadas).
Verificación: `bunx tsc --noEmit`; `bun test` completo (línea final literal); biome sobre los tocados. Los ui:gate los
corre el cerebro fuera del sandbox.

## Ronda 4 — ui:gate real (cerebro, 2026-09-24)
5 flujos fallan con `ENOENT … orchestos.config.yaml`: `orchestos init` no crea ese archivo. Extraer a
`scripts/ui-gate/lib.mjs` un helper `writeGateRoles(projectRoot)` que lea el YAML si existe (si no, parte de `{}`),
fije los 4 roles `{ agent: codex, model: gpt-6-luna, effort: medium }` y lo escriba; los 5 flujos lo usan en vez de
su copia inline. Test en `scripts/ui-gate/run.test.ts`: dir temporal sin config → crea el archivo con los 4 roles;
con config previa → conserva sus otras claves.
Verificación: `bunx tsc --noEmit`; `bun test scripts/ui-gate/run.test.ts`; `node --check` de los 5 flujos; biome.

## Ronda 5 — ui:gate real (cerebro, 2026-09-24)
`tasks`, `runs-graph`, `project-tabs` → `flow: yamlStringify is not defined`: la ronda 4 quitó el import de `yaml`
que esos flujos siguen usando para `tasks.yaml`. Restaurar los imports necesarios en los 5 flujos. Verificar con
`node -e "import('./scripts/ui-gate/flows/<f>.mjs')"` por flujo (debe importar sin ReferenceError de módulo) y con
`grep -n "yamlStringify\|yamlParse" scripts/ui-gate/flows/*.mjs` pegado junto a sus imports.

## Ronda 6 — ui:gate real (cerebro, 2026-09-25)
1. `chat-turn-details` → `flow: readFileSync is not defined`: la ronda 4/5 quitó `readFileSync` del import de
   `node:fs` en `scripts/ui-gate/flows/chat-turn-details.mjs:2` y el flujo lo sigue usando. Restaurarlo. Revisar los
   9 flujos de `scripts/ui-gate/flows/`: todo identificador de `node:fs`, `node:path`, `node:os`, `yaml`, `../lib.mjs`
   que se use debe estar importado (un `import()` no lo detecta: el ReferenceError sale al ejecutar). Pegar en el
   reporte, por flujo, la línea de import y el `grep -o` de los identificadores usados.
2. R.3 (decisión de Carlos 2026-09-25: normalizar) — `src/run/qa.ts` (~`:221-229`, `matchesOriginal`): comparar por
   posición; el `text` del resultado es **siempre** `expectedCriteria[index]` (nunca el del juez). Para decidir si
   coincide, normalizar ambos lados con una función pura exportada `normalizeCriterionText`: comillas tipográficas
   (“ ” „ ‘ ’ ‚ « ») → `"`/`'`, quitar barras de escape antes de comillas (`\"` → `"`), colapsar espacios
   (incluido NBSP) a uno y `trim`. Nada más (ni mayúsculas ni puntuación). Si tras normalizar difiere, sigue siendo
   `identityMismatch` y el `reason` pasa a incluir el primer caso:
   `QA criterion results must match the original text and order exactly (criterion <n>: got "<texto crudo del juez, máx 200 chars>")`.
   Tests en `src/__tests__/qa-core.test.ts`: comillas tipográficas / `\"` / espacios dobles → pasa y `text` es el
   original; texto reescrito de verdad → falla con el `reason` que incluye el texto crudo; orden cambiado → falla.
Verificación: `bunx tsc --noEmit`; `bun test src/__tests__/qa-core.test.ts`; `bun test` completo (línea final
literal); biome sobre los tocados. Los ui:gate los corre el cerebro fuera del sandbox.
