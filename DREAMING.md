# DREAMING.md — 2026-11-23

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-22T16:51Z.
> **Sin runs de producto nuevos por cuarto informe seguido**: el último run de chat/tarea sigue siendo 2026-11-19T21:24Z.
> La DB local (`~/.orchestos/db.sqlite`) tiene 1091 runs (1085 el 22-11); los 6 nuevos son **runs de gate** del
> 2026-11-22 17:07–17:12Z, posteriores al export: `gate:uso.35-live` (1 done, 1 `failure_kind=qa`) y
> `gate:uso.36-live` / `gate:uso.36-counter` (4 `failure_kind=check`), todos gpt-6-luna. Son fallos provocados por los
> gates USO.35/USO.36, no fallos de producto; el próximo export los meterá en el resumen (ver Propuesta 4).
> Ninguna propuesta se aplicó: `scripts/export-runs-summary.ts` sigue sin `failure_kind` ni filtro `gate:`, y no hay
> commits desde el 22-11 en ese script, `src/run/harness.ts` ni `src/db/runs.ts`.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-17T17:34:17Z → 2026-11-19T21:24:22Z
- failed: 3 | blocked: 0 | done: 17 | qa_failed: 1

Distribución: 19 `chat` (12 claude-opus-5-5, 5 gpt-6-luna, 2 gpt-6.1-sol) y 1 `doc` (gpt-6-luna).

## Patrones detectados

### `doc` falla por `output_missing` en una tarea cuyo trabajo es commitear
- Evidencia: `aa76c894` (2026-11-19, `doc`, gpt-6-luna, codex). Tarea creada desde chat: "cerrar la sesión" —
  commitear el cambio pendiente de `README.md`, sobrescribir `NEXT.md` con el SHA. Outputs declarados: `README.md`, `NEXT.md`.
  DB: `failure_kind = output_missing`, `result = "missing declared output(s): README.md, NEXT.md — reverted 0 file(s)"`.
- Código: el chequeo (`src/run/harness.ts:661`) compara los outputs declarados con `contractResult.written`.
  Hipótesis **no verificada**: `README.md` ya estaba modificado antes del run y el agente solo lo commitea, así que el run
  no lo "escribe"; el chequeo lo marca como faltante aunque la tarea se cumplió. `NEXT.md` no está explicado por esto.
- Frecuencia: 1/20; 1/1 de `doc` en la ventana (100 %, pero n=1). Histórico local: 14/47 `doc` fallidos, 13 con `failure_kind` NULL.
- qa_reason recurrente: "missing declared output(s): README.md, NEXT.md" (1 vez).

### Chat con `gpt-6.1-sol` falla por cupo de Codex — sigue sin clasificar (quinto informe)
- Evidencia: `7bfc4ed4` y `0260c4e9` (2026-11-17, `chat`, codex). DB: `result = "Codex CLI usage limit reached."`,
  `failure_kind = NULL`. `'quota'` existe en `src/db/runs.ts:22`; el camino de chat no lo asigna.
- Frecuencia: 2/20; 2/2 de `gpt-6.1-sol`; 2/19 de `chat` (10 %, bajo el umbral).
- qa_reason recurrente: ninguna (chat no pasa por QA).

### Sin patrón en `checks_failed` ni en QA por modelo
- `checks_failed = 0` en 20/20. Ningún modelo con `qa_verdict: fail` en 3+ runs (solo 1 fail en total).
- `gpt-6-luna` en chat: 5/5 done.

## Propuestas

### Propuesta 1 — Diagnosticar el `output_missing` de tareas que commitean (`doc` desde chat)
- Qué cambiar: reproducir `aa76c894` y decidir en `src/run/harness.ts:661` si un output declarado que el run deja
  committed sin cambio de contenido cuenta como entregado (p. ej. comparar contra `HEAD` previo al run además de
  `contractResult.written`), o que el chat no declare como `output` archivos que la tarea solo commitea.
- Por qué: falso fallo probable en una tarea de cierre real; el run se marca `failed` cuando el trabajo se hizo.
- Riesgo: medio (toca el chequeo determinista que protege contra outputs truncados).

### Propuesta 2 — Asignar `failure_kind: 'quota'` en los fallos de chat (repite 2026-11-19)
- Qué cambiar: el camino que guarda el run de chat debe clasificar el error del CLI como `providerFailureKind`
  (`src/run/harness.ts`) en vez de dejar `failure_kind` nulo.
- Por qué: 2/2 fallos de Sol son cupo y figuran sin causa; 13/14 fallos históricos de `doc` tampoco tienen causa.
- Riesgo: bajo.

### Propuesta 3 — Exportar `failure_kind` y motivo corto en `runs-summary.json` (repite 2026-11-18 y 2026-11-19)
- Qué cambiar: `scripts/export-runs-summary.ts`, sumar `failure_kind` y ~120 chars redactadas de `result` si `status = 'failed'`.
- Por qué: quinto informe que necesita abrir la DB local para conocer la causa.
- Riesgo: bajo.

### Propuesta 4 — Excluir runs de gate del resumen (repite; sigue vigente)
- Qué cambiar: `scripts/export-runs-summary.ts`, filtrar `task_class LIKE 'gate:%'` o marcarlos `source: 'gate'`.
- Por qué: ya pasó: el 22-11 entraron 6 runs `gate:uso.35/36` (5 failed provocados) a la DB después del export;
  el próximo `runs-summary.json` los contará como fallos de gpt-6-luna y dispararía falsamente el patrón
  "mismo modelo con qa fail en 3+ runs".
- Riesgo: bajo.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
