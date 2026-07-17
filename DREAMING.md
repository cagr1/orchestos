# DREAMING.md — 2026-07-17

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-16T17:25:48.612Z → 2026-07-17T02:32:30.032Z
- failed: 2 | blocked: 0 | done: 18 | qa_failed: 0

## Patrones detectados

### task_class "plan" con fallo en la mitad de sus corridas
- Evidencia: solo 2 runs de `plan`, ambos con `model: anthropic/claude-haiku-4-5` (1e8891ce done, 3da60e11 failed). El que falló no llegó a generar `qa_verdict` (quedó `null`), así que no hay `qa_reason` que correlacionar.
- Frecuencia: 1/2 (50%)
- qa_reason recurrente: N/A — la corrida fallida no alcanzó la etapa de QA.
- Nota de confianza: muestra demasiado pequeña (n=2) para concluir que el modelo o el `task_class` sea la causa; podría ser ruido.

### Corrida "fix" con duración anómala antes de fallar
- Evidencia: c39c7f09 (`task_class: fix`, `model: deepseek/deepseek-v4-flash`, `status: failed`) tardó `elapsed_ms: 1185829` (~19.7 minutos). El resto de las 20 corridas están entre 0ms y 34s.
- Frecuencia: 1/20 (única corrida `fix` del dataset, outlier de tiempo respecto a todo el resto)
- qa_reason recurrente: N/A — nunca llegó a QA.

## Propuestas

### Propuesta 1 — Investigar la corrida `fix` (c39c7f09) que tardó 19.7 min y falló
- Qué cambiar: revisar logs/traza de esa corrida específica (posible timeout colgado, loop de reintentos, o llamada bloqueante al proveedor `deepseek/deepseek-v4-flash` vía OpenRouter) y, si se confirma un patrón de cuelgue, agregar un timeout explícito para `task_class: fix`.
- Por qué: es un outlier de 35x el tiempo típico de cualquier otra corrida en el dataset, y terminó en fallo — sugiere que algo se quedó esperando en vez de fallar rápido.
- Riesgo: bajo (solo investigación de logs; el cambio de timeout, si se decide aplicar, sería medio).

### Propuesta 2 — No tomar acción todavía sobre `task_class: plan` + haiku
- Qué cambiar: nada por ahora — seguir acumulando runs de `plan` antes de decidir si hay un problema real con `anthropic/claude-haiku-4-5` en ese `task_class`.
- Por qué: con solo 2 corridas (1 fallo) la tasa de 50% no es estadísticamente significativa; actuar ahora sería sobreajustar a ruido.
- Riesgo: bajo (es una propuesta de "esperar y observar", no un cambio de configuración).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
