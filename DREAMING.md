# DREAMING.md — 2026-08-18

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-27T22:24:25.712Z → 2026-08-18T01:47:44.864Z
- failed: 0 | blocked: 0 | done: 20 | qa_failed: 0

## Patrones detectados

Ninguno de los cuatro patrones buscados aparece en esta ventana:
- Ningún `task_class` con tasa de fallo > 50% (los 20 runs son `task_class: chat`, todos `status: done`).
- Ningún `model` con `qa_verdict: fail` en 3+ runs (los 20 runs tienen `qa_verdict: null`).
- Ninguna `qa_reason` repetida (todas son `null`).
- Ningún `checks_failed > 0` recurrente (los 20 runs tienen `checks_failed: 0`).

### Observación fuera de los 4 patrones — `qa_verdict` nulo en el 100% de los runs
- Evidencia: los 20 runs de la ventana, todos `task_class: chat`, tienen `qa_verdict: null` y `qa_reason: null` sin excepción.
- Frecuencia: 20/20 runs.
- No es evidencia de que el trabajo esté fallando — es evidencia de que el gate de QA no se está ejerciendo sobre esta clase de tarea, o que `chat` está fuera de su alcance por diseño. No se puede distinguir desde `runs-summary.json` solo.

## Propuestas

### Propuesta 1 — confirmar si `qa_verdict` debería aplicar a `task_class: chat`
- Qué cambiar: nada en código todavía — primero verificar en `src/` si el pipeline de QA excluye intencionalmente `task_class: chat`, o si el wiring de QA no está corriendo para esa clase.
- Por qué: 20/20 runs con `qa_verdict: null` es una señal de "gate ausente", el mismo patrón de fondo que motivó el self-check de `pre-commit.sh` descrito en `CLAUDE.md` (un chequeo que existe en la fuente pero no se ejerce, en silencio). Vale la pena descartar que sea el mismo patrón antes de asumir que es diseño intencional.
- Riesgo: bajo (la propuesta es solo de investigación, no de cambio).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
