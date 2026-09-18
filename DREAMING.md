# DREAMING.md — 2026-09-18

## Runs analizados
- Total: 20 runs
- Periodo: 2026-09-03T21:37:32.310Z → 2026-09-15T15:00:37.294Z
- failed: 1 | blocked: 0 | done: 19 | qa_failed: 0

(Sin runs nuevos desde el análisis anterior: el último es del 2026-09-15.)

## Patrones detectados

Ningún patrón alcanza los umbrales (task_class >50% fallo, modelo con 3+ qa fail, qa_reason repetida, checks_failed recurrente): 0 runs con qa_verdict, 0 qa_reason, 0 checks_failed, 0 files_blocked.

### Fallo aislado del proveedor opencode
- Evidencia: 1 run `chat`, provider `opencode`, model `unknown`, status `failed`, 0 tokens, 0 ms (2026-09-15).
- Frecuencia: 1/20 runs (único fallo).
- qa_reason recurrente: ninguna (qa_verdict null).

### Etiquetado inconsistente motor/proveedor
- Evidencia: 2 runs con model "codex (cli default model) via Codex CLI" registrados con provider `openrouter` (los otros 9 con provider `codex`).
- Frecuencia: 2/20 runs.
- qa_reason recurrente: n/a. Relacionado con AT.10 (caída silenciosa a OpenRouter); no verificado contra el código.

### Cobertura de datos limitada
- Todos los runs son `task_class: chat`; ninguno pasó por QA. No se puede evaluar fiabilidad por task_class ni por modelo.

## Propuestas

### Propuesta 1 — Registrar el error del run fallido de opencode
- Qué cambiar: persistir motivo de fallo (y modelo real en lugar de `unknown`) en el run al fallar el adaptador opencode.
- Por qué: 1 fallo sin causa ni modelo; imposible diagnosticar desde runs-summary.json.
- Riesgo: bajo

### Propuesta 2 — Priorizar AT.10 y revisar el registro de provider
- Qué cambiar: cuando el CLI elegido es Codex, el run debe registrar provider `codex` o marcar explícitamente el fallback.
- Por qué: 2/11 runs de Codex quedaron con provider `openrouter`.
- Riesgo: medio

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
