# DREAMING.md — 2026-11-25

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-24T20:15Z.
> **Sin datos nuevos:** los 20 runs son exactamente los del informe del 2026-11-24 (último run 2026-11-23T21:26Z;
> 0 runs posteriores). Único commit desde entonces: `270310a1` (el propio informe de ayer). Ninguna propuesta se
> aplicó: sin cambios en `scripts/export-runs-summary.ts`, `src/run/harness.ts`, `src/run/executors/` ni `src/db/`.
> El análisis de patrones detallado está en el informe del 2026-11-24 (`git show 270310a1:DREAMING.md`).

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-22T17:07:01Z → 2026-11-23T21:26:59Z
- failed: 7 | blocked: 0 | done: 13 | qa_failed: 6

Distribución: 10 `chat` (claude-opus-5-5, 10/10 done), 1 `doc` (gpt-6-luna, failed), 9 `gate:*:implement`
(gpt-6-luna: 3 done, 6 failed). Sin gates: 1/11 fallos.

## Patrones detectados

### `doc` con gpt-6-luna falla en QA (sin cambios)
- Evidencia: `804fca61` (2026-11-23, `doc`, gpt-6-luna, `qa_verdict: fail`). Precedente `aa76c894` (2026-11-19).
- Frecuencia: 1/20; 1/1 `doc` en la ventana (n=1).
- qa_reason recurrente: "El documento reúne seis referentes, pero no describe el flujo de ficha, cantidad y carrito en al menos cinco."

### gpt-6-luna con `qa_verdict: fail` en 6 runs — 5 son gates (sin cambios)
- Evidencia: `82559864`, `fe30dba4`, `8f86d74a`, `28580907`, `c00cba9e` (gates USO.35/36) + `804fca61` (doc).
- Frecuencia: 6/20.
- qa_reason recurrente: "check failed: sh verify.sh exit 3 (expected 0)" (4 veces, todas gate USO.36, fallo buscado).

### `checks_failed > 0` recurrente — solo gate USO.36 (sin cambios)
- Evidencia: 4 runs `gate:uso.36-*` del 2026-11-22 17:11–17:12Z.
- Frecuencia: 4/20; `gate:uso.36-*` con 100 % de fallo (> 50 %), provocado a propósito.

### Fallo sin causa visible en el resumen (sin cambios)
- Evidencia: `b3bd9385` (gate:uso.44-live) `failed` con `qa_reason` vacío; la causa ("codex engine requires
  worktree sandbox mode") solo se ve en la DB.
- Frecuencia: 1/20.

### Ventana estancada
- Evidencia: `runs-summary.json` se regenera en cada commit, pero no hubo runs el 2026-11-24. Con el mismo export
  el análisis diario repite el anterior y gasta una corrida sin información nueva.
- Frecuencia: 2 informes consecutivos sobre los mismos 20 runs.

## Propuestas

### Propuesta 1 — Saltar el informe cuando no hay runs nuevos
- Qué cambiar: el prompt del scheduled task `orchestos-dreaming` (fuera del repo): si el `created_at` más reciente
  de `runs-summary.json` no supera al del último `DREAMING.md`, escribir solo "Sin runs nuevos desde <fecha>" y
  commitear, sin rehacer el análisis.
- Por qué: este informe y el del 2026-11-24 cubren los mismos 20 runs.
- Riesgo: bajo

### Propuestas vigentes del 2026-11-24 (sin aplicar, sin datos nuevos)
- P1: clasificar "requires worktree sandbox mode" como `failure_kind` de configuración
  (`src/run/executors/generic-cli.ts`, `external.ts`, `opencode.ts`). Riesgo bajo.
- P2: reintento único de `doc` con el `qa_reason` antes de revertir (`src/run/harness.ts`). Riesgo medio.
- P3: excluir `gate:*` del resumen o separarlos (`scripts/export-runs-summary.ts`) — 9/20 runs y 6/7 fallos son
  gates. Riesgo bajo. Prioritaria.
- P4: exportar `failure_kind` y motivo corto (`scripts/export-runs-summary.ts`) — cuarta repetición. Riesgo bajo.
- 2026-11-23 P1 (`output_missing` en `doc`) y P2 (`failure_kind: 'quota'` en chat) siguen vigentes.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuestas vigentes del 2026-11-24 (P1–P4)
- [ ] Ignorar
- [ ] Requiere revisión
