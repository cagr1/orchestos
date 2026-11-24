# DREAMING.md — 2026-11-24

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-23T21:44Z. DB local: 1105 runs.
> Primer informe con runs de producto nuevos desde el 2026-11-19 (10 chat + 1 doc del 2026-11-23).
> **9 de 20 runs son de gate** (`gate:uso.35/36/44-*`) y concentran 6 de los 7 fallos: la Propuesta 4 de ayer
> (excluir gates del resumen) ya distorsiona las cifras. Ninguna propuesta previa se aplicó: sin commits desde el
> 22-11 en `scripts/export-runs-summary.ts`, `src/run/harness.ts` ni `src/db/runs.ts`.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-22T17:07:01Z → 2026-11-23T21:26:59Z
- failed: 7 | blocked: 0 | done: 13 | qa_failed: 6

Distribución: 10 `chat` (claude-opus-5-5, 10/10 done), 1 `doc` (gpt-6-luna, failed), 9 `gate:*:implement`
(gpt-6-luna: 3 done, 6 failed). Sin runs de producto: tasa de fallo real 1/11.

## Patrones detectados

### `doc` con gpt-6-luna falla en QA — segundo `doc` fallido seguido
- Evidencia: `804fca61` (2026-11-23, `doc`, gpt-6-luna). DB: `failure_kind = qa`, `result = "QA fail - reverted 1 file(s)"`.
  El anterior `doc` (`aa76c894`, 2026-11-19) falló por `output_missing`. Causas distintas, misma clase.
- Frecuencia: 1/20 en la ventana; 1/1 `doc` (100 %, n=1); 2/2 `doc` en los dos últimos informes.
- qa_reason: "El documento reúne seis referentes, pero no describe el flujo de ficha, cantidad y carrito en al menos cinco."
- Lectura: el QA funcionó (criterio explícito incumplido). El fallo es de ejecución; el run se revirtió entero,
  perdiendo un documento casi completo. No hay reintento con el motivo de QA en el resumen.

### gpt-6-luna con `qa_verdict: fail` en 6 runs — 5 provocados por gates
- Evidencia: `82559864` (gate:uso.35-live), `fe30dba4`, `8f86d74a` (gate:uso.36-live), `28580907`, `c00cba9e`
  (gate:uso.36-counter), `804fca61` (doc, real).
- Frecuencia: 6/20 runs; 6/15 runs de gpt-6-luna.
- Lectura: dispara el criterio "mismo modelo con fail en 3+ runs", pero solo `804fca61` es producto. Sin filtro de
  gates el patrón es ruido (ver Propuesta 3).

### `checks_failed > 0` recurrente — todo de un gate
- Evidencia: 4 runs `gate:uso.36-*` (2026-11-22 17:11–17:12Z), todos `check failed: sh verify.sh exit 3 (expected 0)`.
- Frecuencia: 4/20 runs; 4/4 de `gate:uso.36-*` (tasa de fallo 100 %, > 50 %).
- qa_reason recurrente: "check failed: sh verify.sh exit 3 (expected 0)" (4 veces).
- Lectura: fallo buscado por el gate USO.36 (salida larga de progreso + exit ≠ 0). No es defecto de producto.

### Fallo de configuración clasificado como `unknown`
- Evidencia: `b3bd9385` (2026-11-23, gate:uso.44-live, gpt-6-luna, codex). DB: `failure_kind = unknown`,
  `result = "codex engine requires worktree sandbox mode — refusing to run an uncontrolled external process..."`.
  Mensaje emitido en `src/run/executors/generic-cli.ts:15` (hermanos: `external.ts:739`, `opencode.ts:323`).
- Frecuencia: 1/20. `qa_reason` vacío en el resumen: el motivo no es visible sin abrir la DB.
- Lectura: es un error de configuración determinista (modo de sandbox), no desconocido; a la vez el run 30 min
  después (`0d9fc6d5`) pasó, así que la config se corrigió a mano.

### Run `done` sin ninguna verificación
- Evidencia: `da0a0db5` (2026-11-23, gate:uso.44-live, gpt-6-luna): `status = done`, `qa_verdict = skipped`,
  "Sin revisión LLM y sin checks: nada verificó esta tarea".
- Frecuencia: 1/20. Es un gate; el aviso existe y funciona, pero el run queda `done` igual.

### Chat estable
- 10/10 chat con claude-opus-5-5 done, sin checks fallidos. El patrón de cupo de `gpt-6.1-sol` (informes
  anteriores) no aparece porque no hubo chats con Sol en la ventana: ni confirmado ni descartado.

## Propuestas

### Propuesta 1 — Clasificar "requires worktree sandbox mode" como fallo de configuración
- Qué cambiar: donde se asigna `failure_kind` a errores de executor externo (`ExecutorExternalError` de
  `src/run/executors/generic-cli.ts:15`, `external.ts:739`, `opencode.ts:323`), mapear este error a un kind propio
  (p. ej. `config`) y exportarlo con el motivo corto.
- Por qué: `b3bd9385` quedó `unknown` con un motivo determinista y accionable.
- Riesgo: bajo

### Propuesta 2 — Reintento de `doc` con el motivo de QA antes de revertir
- Qué cambiar: en el flujo de QA fail de `src/run/harness.ts`, para tareas `doc`, un reintento único pasando
  `qa_reason` al ejecutor antes del revert. Diagnosticar primero si ya existe y por qué no se usó en `804fca61`.
- Por qué: 2/2 `doc` recientes fallaron; `804fca61` perdió un documento casi completo por un criterio parcial.
- Riesgo: medio (más gasto por run; no debe enmascarar fallos reales)

### Propuesta 3 — Excluir runs `gate:*` del resumen (repite 2026-11-23; ahora prioritaria)
- Qué cambiar: `scripts/export-runs-summary.ts` — filtrar `task_class LIKE 'gate:%'` del arreglo `runs` y de
  `stats`, o exportarlos en un bloque aparte.
- Por qué: 9/20 runs y 6/7 fallos de esta ventana son gates; los patrones "modelo con 3+ fail" y `checks_failed`
  recurrente salen solo de fallos provocados a propósito.
- Riesgo: bajo

### Propuesta 4 — Exportar `failure_kind` y motivo corto (repite 2026-11-18, -19 y -23)
- Qué cambiar: `scripts/export-runs-summary.ts` — añadir `failure_kind` y `result` truncado (≤ 200 chars).
- Por qué: `b3bd9385` aparece como `failed` sin causa; hizo falta abrir la DB para saberla.
- Riesgo: bajo

### Propuestas previas sin cambios
- 2026-11-23 P1 (`output_missing` en `doc` que commitea) y P2 (`failure_kind: 'quota'` en chat) siguen vigentes;
  sin datos nuevos en esta ventana.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
