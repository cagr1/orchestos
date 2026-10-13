# ERP.4.8 — el run fallido guarda y muestra lo que respondió el ejecutor

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.8 --agent claude --scope "src/run/**,src/db/**,src/dashboard/handlers/runs.ts,src/dashboard/app/src/**,src/__tests__/**,src/dashboard/__tests__/**,scripts/ui-gate/flows/qa-negative.mjs,NEXT.md,PLAN.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques.

## Problema (piloto ERP.4, hallazgo 15)
Run `ac5c6ee6`: el ejecutor (codex) respondió con un veredicto de revisión y no escribió nada. OrchestOS guardó solo
"missing declared output(s): …"; la respuesta del ejecutor hubo que sacarla del rollout de Codex. Hoy:
- `ExecutorOutcome` (`src/run/executors/types.ts:18`) no lleva el texto final del CLI.
- Codex: `parseCodexStream` (`src/run/executors/codex.ts:225-249`) no devuelve el último `agent_message`; el outcome
  se arma en `codex.ts:577`.
- Claude: `ClaudeCodeJson` (`src/run/executors/external.ts:63`) no declara el campo `result` (texto final) del
  evento `type: "result"`; el outcome se arma en `external.ts:562`.
- `runs.result` (el motivo) no sale por la API (`runRecordToRow`, `src/dashboard/handlers/runs.ts:80`) ni se ve en
  el detalle del run (`RunsEvidenceView.tsx`).

## Cambios

1. **Outcome.** `ExecutorOutcome.finalText?: string` — último mensaje de texto del agente.
   - Codex: `parseCodexStream` devuelve además el texto del último evento `agent_message` (mira cómo lo lee
     `step-event.ts:287`); `codex.ts:577` lo pone en el outcome.
   - Claude: añadir `result?: string` a `ClaudeCodeJson`; `external.ts:562` pone `parsed.result` en el outcome.
   - Engines sin ese texto (single-shot, agentic) no lo rellenan.

2. **Persistencia.** Columna nueva `runs.executor_reply TEXT` con `safeAddColumn` (patrón de
   `skill_gates_json`, `src/db/migrate.ts:994`), campo opcional `executor_reply?: string | null` en `RunRecord` /
   `InsertRunRecord` (`src/db/runs.ts`), pasado por el mismo `scrub` que `result` (`runs.ts:101,156`) y recortado a
   4 000 caracteres (si se recorta, termina en `…`). `NULL` = el engine no dio texto o el run no falló.
   Se guarda **solo** en los `insertRun` de fallo o bloqueo que ya tienen `outcome`: `src/run/harness.ts:653`
   (contrato), `:724` (salidas faltantes), `:833` (check) y `:1037` (QA). Los runs `done` no lo guardan.

3. **API.** `runRecordToRow` (`handlers/runs.ts:80`) añade `result: r.result` y
   `executorReply: r.executor_reply ?? null` a `RunRow`.

4. **UI.** `src/dashboard/app/src/api/runs.ts` (tipo `RunRow`, línea 3, y su mapeo) y `RunItem`
   (`src/dashboard/app/src/types/orchestos.ts:67`) llevan `failureReason?: string` (de `result`, solo si el run no
   terminó bien) y `executorReply?: string`. En `RunsEvidenceView.tsx`, pestaña **Contract** (línea 149), encima del
   contenido actual y solo cuando el run falló o quedó bloqueado y hay alguno de los dos datos:
   - el motivo (`failureReason`) en una línea;
   - la respuesta del ejecutor bajo la etiqueta `Executor reply`, en un `<pre>` con las **mismas clases** que el
     `<pre>` del patch en la pestaña Diffs (línea ≈ 177).
   Solo clases que ese archivo ya usa; no tocar `styles.css`; sin textos explicativos adicionales.

5. **Tests.**
   - `parseCodexStream`: con dos `agent_message`, devuelve el texto del último; sin ninguno, `undefined`.
   - Claude: el outcome lleva `result` del evento final (en el test que ya cubre `externalEngine.run`).
   - Harness: un run con salidas declaradas faltantes guarda `executor_reply` con el `finalText` del engine (usa
     el engine falso de los tests existentes del harness) y un run `done` lo deja `NULL`.
   - `runRecordToRow`: expone `result` y `executorReply`.
   - Recorte a 4 000 caracteres y redacción de un secreto dentro de `executor_reply`.
   Los fixtures que hagan `git commit` llevan identidad propia (`git -c user.name=… -c user.email=…`).

6. **Flujo `scripts/ui-gate/flows/qa-negative.mjs`.** Tras el paso `'rejected run visible'` (línea 387), sobre el
   run de `gate-qa-bad` (codex, rechazado por QA): un paso por API —`GET /api/runs/:id` trae `executorReply` como
   texto no vacío— y un paso de UI —la pestaña Contract muestra `Executor reply` y los primeros 30 caracteres de
   ese texto—. Detalle real en cada `step` (longitud, extracto); sin `true` literales.

## No tocar
El chat, `prompt.ts`, las skills, el formato de `tasks.yaml`, el texto de `runs.result`, `styles.css`, otros flujos.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test` de los archivos de test tocados · `bun run build:app` ·
`bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`. `test:coverage` y `ui:gate` los
corre el cerebro fuera del sandbox.
