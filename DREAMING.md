# DREAMING.md — 2026-09-26

## Runs analizados
- Total: 20 runs
- Periodo: 2026-09-23T23:57:34Z → 2026-09-25T00:13:45Z
- failed: 1 | blocked: 0 | done: 19 | qa_failed: 0

Distribución: 19 `chat` (codex, gpt-5.6-luna ×18 y gpt-6-luna ×1) y 1 `implement` (role:codex, gpt-6-luna).
Ningún run tiene `qa_verdict`, `qa_reason` ni `checks_failed > 0`: los criterios de QA de este
análisis no tienen señal en esta ventana.

## Patrones detectados

### `implement` falla 1/1 sin causa registrada
- Evidencia: run `cb98fe9b`, task_class `implement`, model `gpt-6-luna`, provider `role:codex`,
  status `failed`, 28.8 s, tokens 0, `qa_verdict`/`qa_reason` null.
- Frecuencia: 1/1 runs `implement` (100 %, supera el umbral de 50 % pero con n=1: no es tendencia).
- qa_reason recurrente: ninguna — el fallo no deja causa en el resumen. Con tokens 0, lo probable
  es que el CLI no llegó a responder (arranque/timeout/modelo), no que QA lo rechazara. No verificado.

### `elapsed_ms` siempre 0 en los runs de chat
- Evidencia: los 19 runs `chat` tienen `elapsed_ms: 0`. `src/dashboard/handlers/chat.ts:573`
  escribe `elapsed_ms: 0` literal en `insertRun`.
- Frecuencia: 19/19 runs chat.
- Efecto: no hay latencia medible del chat; imposible detectar regresiones de tiempo (p. ej. el
  clasificador lento con Codex documentado en NEXT.md).

### Etiqueta de modelo no canónica
- Evidencia: los runs chat guardan `model` = "gpt-5.6-luna via Codex CLI (effort: medium)"
  (`chat.ts:1508`), el run implement guarda "gpt-6-luna". El mismo modelo aparece con dos
  formatos distintos.
- Frecuencia: 19/20 runs.
- Efecto: agrupar por `model` (el criterio "mismo model con fail en 3+ runs") no funciona sin
  normalizar a mano.

### Outlier de tokens en chat
- Evidencia: run `1f94cfe2` (2026-09-24T00:40Z) = 277,625 tokens; la línea base es ~12.3k y el
  resto ≤ 26.6k.
- Frecuencia: 1/19 runs chat (~22× la mediana).
- qa_reason recurrente: n/a.

## Propuestas

### Propuesta 1 — Registrar la causa de fallo en runs `implement`
- Qué cambiar: la ruta que marca `status: failed` para task_class `implement` con provider
  `role:codex` debe poblar `qa_reason` (o un campo equivalente exportado a runs-summary.json) con
  la causa: exit code, timeout o error del CLI.
- Por qué: el único run implement falló con tokens 0 y sin causa; no se puede diagnosticar desde
  el resumen.
- Riesgo: bajo

### Propuesta 2 — Medir `elapsed_ms` real en el chat
- Qué cambiar: `src/dashboard/handlers/chat.ts:573` — pasar la duración del turno en vez de `0`.
- Por qué: 19/19 runs chat sin latencia; el cuello de botella del clasificador con Codex no se
  puede seguir con datos.
- Riesgo: bajo

### Propuesta 3 — Guardar el modelo canónico en `runs.model`
- Qué cambiar: en `chat.ts` guardar `canonicalModel` (ya disponible en `finishTurnSuccess`) en
  `model` y dejar la etiqueta "via Codex CLI (effort)" solo para la UI, o exportar ambos.
- Por qué: 19/20 runs con etiqueta compuesta; rompe el agrupado por modelo.
- Riesgo: bajo (revisar consumidores que parseen la etiqueta).

### Propuesta 4 — Revisar el turno de 277k tokens
- Qué cambiar: nada todavía; inspeccionar el run `1f94cfe2` (prompt/read_audit) para ver si el
  contexto inyectado al CLI se desbordó (relacionado con AT.13).
- Por qué: un turno de chat costó ~22× la mediana.
- Riesgo: bajo (solo investigación).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
