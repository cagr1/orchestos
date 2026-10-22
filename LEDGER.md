# LEDGER.md — Responsabilidad de LLMs sobre este repo

Registro append-only. Gobernanza de CÓMO se desarrolla OrchestOS (varios LLMs, distintas
sesiones, tocando el mismo repo) — **no es un feature de OrchestOS-el-producto**, no vive en
`src/`, no tiene superficie en el dashboard. Mismo estatus que PLAN.md/IDEAS.md/DONE.md/CLAUDE.md:
texto plano, versionado en git, legible por humano.

**Propósito**: distinguir tres comportamientos para saber con qué modelo conviene trabajar —
obediencia ciega (aceptable), desviación razonada con argumento sólido (el más valioso), y
desviación silenciosa / regresión (el que rompe reglas sin avisar). No es para castigar, es para
que Carlos tenga su propia base de conocimiento de cómo actúa cada LLM en este proyecto.

Diseño completo, campos y ejemplo → [PLAN.md § Sprint 22 Bloque F, F.1](PLAN.md).
Cuándo es obligatorio agregar una entrada → [PLAN.md § Sprint 22 Bloque F, F.2](PLAN.md) — el gate de
`scripts/pre-commit.sh` lo exige automáticamente cuando el commit toca un archivo listado en
`.claude/protected-rules.json`.
Reporte agregado (tabla por modelo) → `bun run ledger:report` ([PLAN.md § F.3](PLAN.md), pendiente
de implementar).

---


## 2026-07-20 16:53 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.5) no toca la derivación de `max_tokens`/contextWindow — solo
agrega el import de `opencodeEngine` y una rama `else if (requestedEngine === 'opencode')` a la
selección de executor, más un ajuste de comentario en `shouldSplit()` para excluir también el
nuevo engine 'opencode' del split (mismo motivo ya existente para 'external': el executor no es la
API LLM directa). Cero líneas tocadas en el cálculo de `maxTokens`.
**Reversibilidad/evidencia**: commit de G.5 (feat(Bloque G/G.5): executor opencode (batch), cierra
G.5) — revertible con `git revert`, sin side-effects en datos. 797 tests · 0 fail · `tsc --noEmit`
limpio antes del commit.

---

## 2026-07-27 10:19 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.3.3) no toca `max_tokens`/contextWindow — agrega
`clearRunSteps(ctx.task.id)` antes de `engine.run()` y pasa `onStep: (event) => insertRunStep(...)`
en el objeto `opts` que ya se le pasaba al engine (junto a `maxTokens`/`maxIterations`, sin
modificar esos dos campos). Cero líneas tocadas en el cálculo de `maxTokens`.
**Reversibilidad/evidencia**: commit de G.3.3 (feat(Bloque G/G.3.3): transporte + UI de cards en
vivo — cierra Bloque G.3) — revertible con `git revert`, sin side-effects en datos (tabla
`run_steps` nueva, no toca `runs`). 813 tests · 0 fail · `tsc --noEmit` limpio antes del commit;
verificado además en vivo contra el dashboard real (ver PLAN.md § G.3.3).

---

## 2026-07-27 11:44 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.4.2b, nuevo executor `codex.ts`) toca dos puntos de
`harness.ts`: (1) `import { codexEngine }` + una rama `else if (requestedEngine === 'codex')` en
la selección de executor, mismo patrón que ya tenían `external`/`opencode`; (2) `shouldSplit()`
gana `|| task.engine === 'codex'` en su exclusión — mismo motivo ya documentado ahí para
`external`/`opencode` (el executor es un CLI, no la API LLM directa, así que el split por tokens
no aplica). Cero líneas tocadas en la derivación de `maxTokens`/`contextWindow`.
**Reversibilidad/evidencia**: commit de G.4.2b (feat(Bloque G/G.4.2b): ExecutorEngine real para
Codex) — revertible con `git revert`, sin side-effects en datos. 843 tests · 0 fail ·
`tsc --noEmit` limpio antes del commit. Contrato de `codex exec --json` verificado con un probe
real contra un git repo temporal (2026-07-27) antes de codear el parser — no asumido.

---

## 2026-07-28 09:51 America/Guayaquil — codex-gpt-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio K.2 solo pasa el `checksResults` que el harness ya calculaba a `runQA()`;
no modifica `maxTokens`, `contextWindow` ni la selección del presupuesto de salida. La línea
tocada está en la llamada al QA, después de ejecutar los checks deterministas. Cero líneas tocadas
en la derivación de `maxTokens`.
**Reversibilidad/evidencia**: commit de K.2 (`feat(qa): expose check results to judge`) — revertible
con `git revert`, sin side-effects adicionales en datos. Suite completa: 875 tests · 0 fail ·
`tsc --noEmit` limpio.

---

## 2026-07-28 10:41 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio K.4b agrega el segundo juez adversarial (`runAdversarialQA()`) entre
`qa.verdict === 'pass'` y `mergeWorktreeBack()`, reusando `qaJudge.model`/`qaJudge.provider` ya
resueltos — no toca `maxTokens`, `contextWindow` ni la selección del presupuesto de salida en
ningún punto. Las líneas nuevas leen `orcheConfig?.adversarialQA`, acumulan tokens del segundo
call en `qa.inputTokens/outputTokens` (para que `qaCost`/`totalCost`, ya existentes, los incluyan)
y downgradean `qa.verdict`/`qa.reason` cuando `REFUTED` — todo aguas abajo de donde `maxTokens` ya
se calculó para el executor. Cero líneas tocadas en esa derivación.
**Reversibilidad/evidencia**: commit de K.4b (`feat(qa): opt-in adversarial second QA judge`) —
revertible con `git revert`; feature opt-in (`orcheConfig.adversarialQA`, default off), cero
side-effects en runs existentes (columnas nuevas `adversarial_verdict`/`adversarial_reason` vía
`safeAddColumn`, NULL para filas previas). 886 tests · 0 fail · `tsc --noEmit` limpio antes del
commit. Gate destrabado con evidencia sintética real (3 tests adversariales en `qa-judge.test.ts`
probando que K.4a deja pasar evidencia literal-pero-engañosa), no por decisión de saltarlo.

---

## 2026-07-29 16:20 America/Guayaquil — codex-gpt-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: M4 agrega el middleware de roadmaps, el bloqueo explícito de toolchains ausentes y la
selección de checks deterministas; todo ocurre antes o después de la derivación existente y no
modifica `maxTokens`, `contextWindow` ni el presupuesto de salida.
**Reversibilidad/evidencia**: commit M4 (`feat: integrate roadmaps into task execution`) — revertible
con `git revert`, sin cambios de datos. `bunx tsc --noEmit` limpio; tests específicos M4/M3/checks:
51 pass, 0 fail.

---

## 2026-08-05 16:57 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: O.3 agrega la resolución de gates transversales (`resolveGates()`) justo antes de
invocar `runQA()` y suma el campo `skill_gates_json` a los `insertRun()` que ya existían después del
veredicto. Las líneas nuevas leen `ctx.task.description` y arman `gatesJson`/`appliedGateSkills` —
no tocan `maxTokens`, `contextWindow`, `resolveQAJudge()` ni la selección del presupuesto de salida
del executor en ningún punto de la función.
**Reversibilidad/evidencia**: commit de O.3 (`feat(skills): O.3 — gates transversales...`) —
revertible con `git revert`; columna nueva `runs.skill_gates_json` vía `safeAddColumn` (NULL para
filas previas, sin backfill ni migración destructiva). 8 tests nuevos en `skill-gates.test.ts`
contra las skills reales del repo (no mocks); `tsc --noEmit` limpio; gate de drift verde antes del
commit.

---

## 2026-08-08 09:42 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: W.1 borra el middleware `tool-policy.ts` (dead code, decisión de Carlos) y quita su
línea `.use(toolPolicy)` de la cadena de enrichment en `harness.ts`. El cambio es remover una
llamada a un middleware que solo seteaba `ctx.allowedTools` (nunca leído por ningún ejecutor) — no
toca `maxTokens`, `contextWindow`, `resolveQAJudge()` ni ningún punto de la derivación del
presupuesto de salida del executor.
**Reversibilidad/evidencia**: commit de W.1 (`chore(run): W.1 — borrar tool-policy.ts dead code...`)
— revertible con `git revert`; sin cambios de esquema ni de datos (el campo `allowedTools` era de
`RunContext` en memoria, nunca persistido). 1111 tests (eran 1117, -6 del middleware borrado) ·
0 fail · `tsc --noEmit` limpio antes del commit.

---

## 2026-08-10 — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: X.2 (IDEAS #33) agrega el refuter opt-in (`orcheConfig.refuterQA`) entre
`qa.verdict === 'fail'` y el bloque de revert/retry, reusando `qaJudge.model`/`qaJudge.provider`
ya resueltos — mismo patrón que K.4b (2026-07-28) en la dirección opuesta. Las líneas nuevas leen
`orcheConfig?.refuterQA`, acumulan tokens del segundo call en `qa.inputTokens/outputTokens` (para
que `qaCost`/`totalCost`, ya existentes, los incluyan) y suben `qa.verdict` a `'pass'` cuando
`REFUTED` — todo aguas abajo de donde `maxTokens` ya se calculó para el executor. Cero líneas
tocadas en esa derivación.
**Reversibilidad/evidencia**: commit de X.1/X.2/X.3 (`feat(qa): X — refuter en el QA loop, opt-in`)
— revertible con `git revert`; feature opt-in (`orcheConfig.refuterQA`, default off), cero
side-effects en runs existentes (columnas nuevas `refuter_verdict`/`refuter_reason` vía
`safeAddColumn`, NULL para filas previas). 1122 tests (eran 1111, +11) · 0 fail · `tsc --noEmit`
limpio antes del commit. Gate X.3 corrido con `harness-refuter-qa.test.ts` (4 tests contra
`runTask()` completo, no `qa.ts` aislado) — sin `OPENROUTER_API_KEY` disponible para un control
pagado real, mismo nivel de rigor que el propio gate de K.4b (ver entrada 2026-07-28).

---

## 2026-08-16 — claude-opus-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: BB.1 cambia SOLO la selección de motor (`requestedEngine`): agrega `executor_mode`
como escalón intermedio de precedencia entre `task.engine` y `executorEngine`, reusando
`resolveExecutorSelection()` que ya existía en `router/engine-cascade.ts`. No toca `maxTokens`,
`contextWindow`, `resolveQAJudge()` ni el presupuesto de salida del executor en ningún punto —
las líneas nuevas leen `orcheConfig.executor_mode` y escriben una línea de log. Deliberadamente
NO fija el modelo (aunque `resolveExecutorSelection` devuelve un `executor_model` sugerido, acá
solo se consume `.engine`): [[feedback-modelo-decision-final-carlos]] manda que el modelo salga de
`orchestos.config.yaml` o de Carlos, nunca de una regla derivada.
**Reversibilidad/evidencia**: commit de BB.1/BB.2 (`fix(config): BB — un solo selector de motor...`)
— revertible con `git revert`; sin cambios de esquema ni de datos. Cambio de comportamiento
acotado y buscado: un proyecto con `executor_mode` fijado ahora corre sus tareas manuales por ese
motor (antes lo ignoraba en silencio — el bug reportado). Proyectos sin `executor_mode`: cero
cambio. 3 tests nuevos de precedencia en `engine-selection.test.ts` (16 pass, 0 fail) + parser
verificado en vivo (acepta `codex`, y un typo ahora avisa por stderr en vez de desaparecer).
`tsc --noEmit` limpio.

---

## 2026-08-17 — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Sprint 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: CC.D1 renombra `resolveExecutorSelection()` → `resolveAgentSelection()` (mismo import,
misma firma salvo el nombre del primer parámetro: `preferredMode` → `preferredAgent`) y cambia las
dos líneas que leían `orcheConfig?.executor_mode`/`orcheConfig?.executorEngine` para leer
`orcheConfig?.agent`/`orcheConfig?.apiMode` — la consolidación de schema decidida en PLAN.md § CC.D
tras investigar el Agent Client Protocol de Zed (el agente externo, no el orquestador, es dueño de
su selección de modelo). Cero líneas tocadas en `maxTokens`, `contextWindow`, `resolveQAJudge()` ni
el presupuesto de salida del executor — el bloque modificado es exclusivamente la selección de
`requestedEngine`, igual que BB.1 (2026-08-16), del cual esta entrada es la continuación directa
(mismo bloque de código, solo cambia de qué campos de config lee).
**Reversibilidad/evidencia**: commit de CC.D1 (`refactor(config): CC.D1 — consolidar executor_mode
+ executorEngine en agent + apiMode`) — revertible con `git revert`; sin cambios de esquema de
datos (SQLite intacto). `orchestos.config.yaml` con los nombres legacy (`executor_mode`,
`executorEngine`) sigue funcionando sin edición manual vía migración-en-lectura en `config/load.ts`
(`resolveAgent()`/`resolveApiMode()`) — verificado en vivo: el `orchestos.config.yaml` real de este
repo (`executor_mode: cli-claude` + `executorEngine: external`, nunca editado) resuelve
`agent: "claude"` / `apiMode: "single-shot"` vía `GET /api/config`, y el panel Settings → Executor
muestra "Claude CLI" ya seleccionado con el timeout reubicado. El próximo guardado explícito desde
Settings persiste solo los campos nuevos, dejando las claves legacy huérfanas pero inofensivas en
el YAML. Verificación en vivo con Playwright (no solo curl, per
[[feedback-verificar-gates-en-vivo]]): picker de agente muestra las 5 opciones
(`local`/`claude`/`opencode`/`codex`/`api`) con labels traducidos correctamente (no claves crudas),
panel "Executor engine" reducido a 2 opciones (`single-shot`/`agentic`, sin `external`), y el chat
sigue mostrando los 5 niveles reales de esfuerzo de Claude CLI (Low/Medium/High/Extra
high/Max) — sin regresión de CC.1/CC.1b/CC.1c. 1154 tests (eran 1152 antes del fix del último
archivo de test, 0 fail) · `tsc --noEmit` limpio en todo el repo.

---

## 2026-09-01 — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] — `harness.ts` y `model-catalog.ts` están
protegidos por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: H.2.1 adopta Biome como linter/formatter y corrió `biome check --write .` sobre todo
el repo (324 archivos). En ambos archivos el diff es exclusivamente reordenar imports
(`organizeImports`) y reformatear expresiones largas a multilínea (comillas, wraps de línea a
100 cols) — cero líneas de lógica tocadas. Verificado línea por línea: `maxTokens = providerRealCap
> 0 ? Math.min(availableForOutput, providerRealCap) : availableForOutput` en `harness.ts` es
textualmente la misma expresión, solo con salto de línea; `maxOutputTokens: ... ? ... : 0` en
`model-catalog.ts` (el fallback a 0/desconocido que exige la regla) tampoco cambió.
**Reversibilidad/evidencia**: commit de H.2.1 (`feat(harness): adoptar Biome como
linter+formatter`) — revertible con `git revert`; sin cambios de esquema ni de datos. `bunx tsc
--noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, 2852 expects, 120 archivos;
functions 73.96% ≥ 69%, lines 62.49% ≥ 57%) tras el reformateo, sin regresión.

## 2026-09-23 16:05 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-5.6-luna
**Contexto**: UI.13.2e (Lote L2) — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el diff solo cambia `project_id: null` → `runProjectId` en los 7 `insertRun` y agrega
`runProjectId = _projectId ?? getProject(projectRoot)?.id ?? null` (+ import de `getProject`). Ninguna línea
de `maxTokens`/`contextWindow`/`maxOutputTokensFor` tocada (verificado con `git diff --cached src/run/harness.ts
| grep -i token` → vacío).
**Reversibilidad/evidencia**: commit `feat(UI.13.2e)`, revertible con `git revert`; sin cambio de esquema.
`gate:all` 1533 pass / 0 fail · `ui:gate runs-graph` 16/16 · `ui:gate smoke` 6/6.

## 2026-09-24 10:57 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: CI.4 (Lote L4) — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el diff solo reemplaza la expresión `ctx.task.retry_count > 0 ? ctx.task.retry_reason : undefined` por
`previousFailureForTask(ctx.task)` (misma lógica, movida a `src/run/prompt.ts`) y su import. Ninguna línea de
`maxTokens`/`contextWindow`/`maxOutputTokensFor` tocada (`git diff --cached src/run/harness.ts | grep -i token` → vacío).
**Reversibilidad/evidencia**: commit `fix(CI.4)`, revertible con `git revert`. `test:coverage` 5×1533/0 · `gate:all` verde.

## 2026-10-03 10:52 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: ERP.3 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el diff solo añade `&& effectiveConfig.orchestration?.enabled === true` a la condición del auto-split y
un log cuando se omite por OFF. `maxTokens` se lee igual que antes; ninguna línea que lo derive
(`contextWindow`/`maxOutputTokensFor`) tocada.
**Reversibilidad/evidencia**: commit `feat(ERP.3)`, revertible con `git revert` (migración 19 aditiva).
`test:coverage` 1601/0 · `ui:gate orchestration` 6/6 · `tasks` 13/13 · `project-isolation` 10/10.

## 2026-10-03 19:18 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: I.7.1 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el diff solo cambia el error cuando una tarea con engine CLI no tiene modelo y renombra el provider
de rutas CLI al agente real (`name: routeAgent`). Ninguna línea de `maxTokens`/`contextWindow`/`maxOutputTokensFor`
tocada (`git diff --cached src/run/harness.ts | grep -i token` → vacío).
**Reversibilidad/evidencia**: commit `fix(I.7.1)`, revertible con `git revert`. `test:coverage` 1612/0 ·
`ui:gate model-routing` 18/18 · `auto-flow` 24/26 (rojos = I.7.2).

## 2026-10-04 10:26 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: CX.4 — `src/run/harness.ts` y `src/router/model-catalog.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: en harness solo se propagan `cacheReadTokens`/`cacheWriteTokens` junto a input/output del run; en el
catálogo solo se leen `pricing.input_cache_read`/`input_cache_write`. Ninguna línea de `maxTokens`,
`contextWindow`, `maxOutputTokensFor` ni `knownMaxOutputTokensFor` tocada.
**Reversibilidad/evidencia**: commit `fix(CX.4)`, revertible con `git revert` (migración 20 aditiva).
`test:coverage` 1620/0 · `auto-flow` 26/26 con caché > 0 · `chat-streaming` 15/15 · `codex-live` 14/14.

## 2026-10-04 12:00 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: CX.5 — `src/run/harness.ts` y `src/router/model-catalog.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: harness solo propaga `cliSessionId`; el catálogo suma `schemaVersion`, `priceCacheWrite1h` y el
fetch público sin key. Ninguna línea de `maxTokens`/`contextWindow`/`maxOutputTokensFor`/`knownMaxOutputTokensFor`
tocada (`git diff … | grep -iE "maxTokens|maxOutput|contextWindow"` → vacío).
**Reversibilidad/evidencia**: commit `feat(CX.5)`, revertible (migración 21 aditiva). `test:coverage` 1626/0 ·
Settings → Usage en el dashboard real.

## 2026-10-11 12:11 — claude-opus-5-5 (revisor) · ejecutor Codex gpt-6-luna
**Contexto**: R.8.3 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el harness solo añade `qa_criteria_json` a los dos `insertRun` posteriores al juez y `file_diffs` al
run rechazado por QA. Ninguna línea de `maxTokens`/`contextWindow`/`maxOutputTokensFor`/`knownMaxOutputTokensFor`
tocada (`git diff -- src/run/harness.ts | grep -iE "maxTokens|maxOutput|contextWindow"` → vacío).
**Reversibilidad/evidencia**: commit `feat(R.8.3)`, revertible (migración 22 aditiva). `test:coverage` 1654/0 ·
`qa-negative` 18/18 · `runs-graph` 16/16.

## 2026-10-11 19:11 — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: R.8.5.1 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el harness solo añade `projectRoot` a las tres llamadas que crean clientes de rol (revisor,
orquestador, ejecutor) para que el home aislado del CLI sea el del proyecto y no el del worktree. Ninguna línea de
`maxTokens`/`contextWindow`/`maxOutputTokensFor` tocada (`git diff -- src/run/harness.ts | grep -ciE
"maxTokens|maxOutput|contextWindow"` → 0).
**Reversibilidad/evidencia**: commit `feat(R.8.5.1)`, revertible (sin migración). `test:coverage` 1675/0 ·
`qa-negative` 21/21 · `auto-flow` 31/31 · `restart-mid-run` 28/28.

## 2026-10-13 09:51 — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: ERP.4.8 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el harness solo añade `executor_reply: outcome?.finalText ?? null` a los cuatro `insertRun` de fallo o
bloqueo que ya tienen outcome (contrato, salidas faltantes, check, QA). Ninguna línea de
`maxTokens`/`contextWindow`/`maxOutputTokensFor` tocada (`git diff HEAD -- src/run/harness.ts | grep -ciE
"maxTokens|maxOutput|contextWindow"` → 0).
**Reversibilidad/evidencia**: commit `feat(ERP.4.8)`, revertible (migración 24 aditiva). `test:coverage` 1709/0 ·
`qa-negative` 25/25.

## 2026-10-13 13:17 — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: ERP.4.10 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el harness solo cambia una línea: `ctx.taskClass = t.task_class ?? classifyTask(t.description)`, para
que la clase declarada al crear la tarea gane a la heurística de la descripción. Ninguna línea de
`maxTokens`/`contextWindow`/`maxOutputTokensFor` tocada (`git diff HEAD -- src/run/harness.ts | grep -ciE
"maxTokens|maxOutput|contextWindow"` → 0).
**Reversibilidad/evidencia**: commit `fix(ERP.4.10)`, revertible (campo opcional en `tasks.yaml`, sin migración).
`test:coverage` 1720/0 · `chat-followup-task` 8/8 · `auto-flow` 31/31.

## 2026-10-14 15:10 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet + Codex luna
**Contexto**: LIMP.1 — `src/router/model-catalog.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el único cambio en el archivo es `export interface ModelInfo` → `interface ModelInfo` (tipo sin
consumidor fuera del archivo). `knownMaxOutputTokensFor()` y la derivación de `max_tokens` no se tocan
(`git diff --cached -- src/router/model-catalog.ts` = 1 línea).
**Reversibilidad/evidencia**: commit `refactor(LIMP.1)`, revertible. typecheck verde · `test:coverage` 1770/1 (el 1
es el test del 409 dependiente del host).

## 2026-10-14 16:05 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: DOC.2 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: solo cambia la ruta de un comentario (`docs/diff-review-design.md` → `docs/done/design/diff-review-design.md`).
Ninguna línea de código; `maxTokens`/`contextWindow` intactos (`git diff --cached -U0 -- src/run/harness.ts` = 2 líneas, ambas comentario).
**Reversibilidad/evidencia**: commit `docs(DOC.2)`, revertible. typecheck y lint verdes.

## 2026-10-19 12:25 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: ERP.5.1 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el cambio solo envuelve la llamada a `runQA` en una condición (criterios o gate de revisión) y usa
`qa.model ?? qaJudge.model` para el costo. `maxTokens`/`contextWindow` intactos.
**Reversibilidad/evidencia**: commit `feat(ERP.5.1)`, revertible. typecheck verde · `test:coverage` 1943/0 ·
`ui:gate tasks` 31/31.

## 2026-10-19 12:50 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: ERP.5.2 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: se quitan las ramas adversarial/refutador, sus imports y 4 campos del insert. `maxTokens`/`contextWindow` intactos.
**Reversibilidad/evidencia**: commit `refactor(ERP.5.2)`, revertible. typecheck verde · `test:coverage` 1917/0 ·
ui-gates tasks, qa-negative, model-routing, orchestration en verde.

## 2026-10-19 15:40 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet + Codex luna
**Contexto**: ERP.5.3 — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: se quita `memoryFetch` de la cadena de middlewares y la escritura de `embed_hits`. `maxTokens`/`contextWindow` intactos.
**Reversibilidad/evidencia**: commit `refactor(ERP.5.3)`, revertible. typecheck verde · `test:coverage` 1852/0 · ui-gates runs-graph, project-tabs, smoke, tasks en verde.

## 2026-10-19 16:30 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet + gpt-6-luna
**Contexto**: ERP.5.4 — `src/run/harness.ts`, `src/run/executors/external.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: se quita el gate de auto-split de `harness.ts` y la lectura de `orchestration.enabled` en `external.ts`
(`blockSubagents` queda en `true`, el valor que ya tenía). solo se borran lecturas de `maxTokens` dentro del split; su cálculo y `contextWindow` intactos.
**Reversibilidad/evidencia**: commit `refactor(ERP.5.4)`, revertible. typecheck verde · `test:coverage` 1784/0 ·
ui-gates tasks, model-routing, qa-negative, smoke, project-tabs en verde.

## 2026-10-19 17:30 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet + gpt-6-luna
**Contexto**: ERP.5.5 — `src/run/harness.ts`, `src/run/executors/*` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: se quita la carga de `CONSTITUTION.md` y el parámetro del prompt; ninguna línea de `maxTokens`/`contextWindow`
cambia (`git diff` sin coincidencias).
**Reversibilidad/evidencia**: commit `refactor(ERP.5.5)`, revertible. typecheck verde · `test:coverage` 1774/0 ·
ui-gates project-tabs, tasks, smoke en verde.

## 2026-10-19 18:38 America/Guayaquil — claude-opus-5-5 (revisor) · ejecutor Claude sonnet
**Contexto**: ERP.7.2a — `src/run/harness.ts` ([[feedback-context-no-max-tokens]]).
**Clasificación**: RESPETÓ
**Por qué**: el harness solo guarda el SHA que devuelve `mergeWorktreeBack` en `insertRun`; ninguna línea de
`maxTokens`/`contextWindow` cambia (`git diff` sin coincidencias).
**Reversibilidad/evidencia**: commit `feat(ERP.7.2a)`, revertible. typecheck y lint verdes · `test:coverage` 1783/0.

## 2026-10-20 — Codex · ERP.7.1a

**Regla tocada**: `src/run/harness.ts`, ciclo de ejecución y evidencia por tarea.
**Clasificación**: RESPETÓ.
**Por qué**: capa de aprobación opcional para `supervised`/`auto-edit`, consumida por el adaptador Codex;
reserva el ID antes del executor y lo conserva en la fila final. Limpia solicitudes en `finally`.
No cambia límites de tokens, QA, contrato de salidas ni la ruta sin `approvalMode`/`full`.
**Ejecutado por**: Codex (ejecutor asignado, sin delegación).
**Evidencia**: `docs/done/ERP.7.1a.md` y salidas crudas en `docs/done/evidence/ERP.7.1a/`.

## 2026-10-20 — Codex, ejecutor ERP.7.1c

**Regla tocada**: `src/run/harness.ts`, selección del modo de aprobación por capacidad del ejecutor.
**Clasificación**: RESPETÓ.
**Por qué**: solo se crea la corrida de aprobación cuando el registro declara soporte; los demás ejecutores reciben
`approvalMode: full`. No cambia el cálculo de contexto/maxTokens ni el default de tareas fuera del chat en Codex.
**Evidencia**: gates crudos en `docs/done/evidence/ERP.7.1c/`; sin commit ni edición del plan por el ejecutor.

## 2026-10-20 — Codex, ejecutor ERP.6.2 r2

**Regla tocada**: `src/run/harness.ts`, persistencia del desglose de costo después de QA.
**Clasificación**: RESPETÓ.
**Por qué**: agrega la fila `reviewer` al final del desglose en éxito y fallo de QA; conserva los totales,
la caché del ejecutor y los límites de contexto/maxTokens. `updateRunCost` (`src/db/runs.ts:257`) no tiene
llamadores en el repositorio; no hay sobrescritura posterior a QA por esa función. `ChatResponse`
(`src/providers/openrouter.ts:10`) no declara caché del revisor.
**Evidencia**: tests de suma del desglose con costo no nulo en éxito/fallo y ausencia de revisor omitido;
salidas crudas de gates en `/tmp/ERP.6.2-r2-gates/`. Gate del dashboard real a cargo del cerebro según el spec.
TypeScript, typecheck completo y lint: exit 0; tests tocados: 18/0. `test:coverage`: 1877 pass, 2 skip,
6 fail (adversarial-review ×2, warning de Git en readonly, timeout de runGraph y csrf-origin ×2).

## 2026-10-20 — Codex, ejecutor ERP.6.2 r4

**Regla tocada**: `src/run/harness.ts`, costo y procedencia del revisor.
**Clasificación**: RESPETÓ.
**Por qué**: reutiliza `codexPricingId` del ejecutor cuando el proveedor del revisor es Codex;
`knownCost` calcula una vez el valor compartido por el total y la fila. Sin precio, la fila lleva
`source: 'unknown'` y Runs muestra `—` solo para el revisor. No aparecieron otros
`calcCost(qa.model` ni `calcCost(qaJudge` en `src/`.
**Diagnóstico de pestañas**: una sola instancia en `OrchestSettingsView.tsx:2271`; botón y contenido
usan el mismo estado local. Un remonte también restablecería el contenido a Contract. La captura
es compatible con un fotograma durante `transition: all 150ms` (`index.css:190`); `runs-graph.mjs`
captura tras comprobar filas visibles sin esperar la transición y `shot` llama a `page.screenshot`
sin opciones de animación. Es una hipótesis de artefacto de captura, no una causa confirmada en
navegador; no se modifica el comportamiento de pestañas. Gate en vivo reservado al cerebro por el spec.
**Evidencia**: TypeScript raíz, typecheck completo y lint: exit 0; tests tocados: 20/0, 138 asserts.
Salidas crudas, incluidos los dos errores de tipos de fixtures corregidos de la primera pasada,
en `/tmp/ERP.6.2-r4-*.log`. Sin commit ni edición del plan.
`test:coverage`: exit 1, 1879 pass / 2 skip / 6 fail (adversarial-review ×2 por sandbox,
warning de Git en readonly, timeout de runGraph y csrf-origin ×2 por EADDRINUSE), mismos
nombres de fallos que el reporte de r2; no se corrigen fuera del spec. `runs-graph` no ejecutado.

## 2026-10-22 19:20 — claude sonnet (criterio), ejecutor TCLI.1 · verificado por Opus
**Clasificación**: RESPETÓ.
Registro `task-engines.ts`; harness, auto-route, evals, cascada, `cli.ts`, handlers y schema consultan el registro.
Desvíos menores justificados en el reporte: built-ins con carga diferida (LIMP.3: importar config no abre la DB),
cast temporal en `handlers/tasks.ts` hasta TCLI.2. **Evidencia del cerebro**: typecheck/lint limpios,
`test:coverage` 1971/0, `ui:gate tasks` 31/31 (`TCLI.1-tasks-live`).

## 2026-10-22 19:45 — claude sonnet (criterio), ejecutor TCLI.2 r1+r2 · verificado por Opus
**Clasificación**: RESPETÓ.
r1: tipos abiertos, `executor-modes` desde `KNOWN_CLIS` con `taskEngine`, filtro del rol Ejecutor, `load.ts`/`App.tsx`.
r2: `session` por modo y filtro del modal; arreglo del mock de timeout de codex/opencode. Desvíos aceptados: orden de
modos de `KNOWN_CLIS`; test legacy con `gemini` inalcanzable. r2 se intentó primero con Codex (`mecanico`): sin
`AGENT_WRITER_TOKEN`, no escribió. **Evidencia del cerebro**: typecheck/lint/fidelity limpios, `test:coverage` 1976/0,
`TCLI.2-live` tasks 31/31, chat-roles 10/10, chat-continuity 8/8.
