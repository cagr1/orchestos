# DREAMING.md — 2026-07-12

## Runs analizados
- Total: 15 runs
- Periodo: 2026-07-01T17:10:49.197Z → 2026-07-10T00:36:35.779Z
- failed: 9 | blocked: 0 | done: 6 | qa_failed: 8

## Patrones detectados

### 1. task_class "doc" falla el 100% de las veces
- Evidencia: los 6 runs con `task_class: "doc"` terminaron en `status: "failed"` — 3 con `gpt-4o-mini` (`b8cb602b`, `1e9d7cef`, `3100d656`) y 3 con `deepseek/deepseek-v4-flash` (`10514a2f`, `ff94b923`, `c31f7136`)
- Frecuencia: 6/6 runs de esa task_class
- qa_reason recurrente: en deepseek siempre `"check failed: exit 1 exit 1"` (idéntico en los 3); en gpt-4o-mini, 2 de 3 dan `"missing declared output(s): src/dashboard/handlers/skills.ts"` y 1 da `"The output already contains a JSDoc comment above the function."`

### 2. "check failed: exit 1 exit 1" — mismo qa_reason en 5 runs, dos task_class distintas
- Evidencia: aparece en 3 runs de `doc` (`10514a2f`, `ff94b923`, `c31f7136`) y 2 runs de `implement` (`be8e9954`, `4fbd8067`), todos con `model: deepseek/deepseek-v4-flash`, todos con `checks_failed: 1`
- Frecuencia: 5/15 runs totales, 5/5 runs de deepseek-v4-flash que tuvieron checks fallidos
- El mensaje repetido "exit 1 exit 1" (duplicado) sugiere que el check corre el mismo comando dos veces, o que el runner concatena stdout+stderr del mismo proceso — no da información sobre qué falló realmente

### 3. gpt-4o-mini "doc": mismo archivo de salida faltante dos veces
- Evidencia: `1e9d7cef` y `3100d656` — ambos `qa_reason: "missing declared output(s): src/dashboard/handlers/skills.ts"`
- Frecuencia: 2/3 runs doc de gpt-4o-mini
- El modelo declara que va a escribir `src/dashboard/handlers/skills.ts` pero no lo produce — posible problema de prompt/spec de la tarea "doc" apuntando a un archivo que ya no existe o que el modelo no sabe cómo localizar

### 4. Run "plan" fallido sin qa_verdict ni tokens (posible timeout/error de infraestructura)
- Evidencia: `fdd60776` — `task_class: plan`, `model: claude-sonnet-5`, `status: failed`, `qa_verdict: null`, `tokens: 0`, `usd_cost: 0`, `elapsed_ms: 112809` (~113s)
- Frecuencia: 1/15, pero es el único run de "plan" en la muestra — no hay señal de si es sistemático
- El patrón (costo 0, tokens 0, pero 113s de duración) sugiere que el run murió antes de llamar al modelo, no que el modelo fallara — vale la pena revisar logs de ese run_id si vuelve a pasar

## Propuestas

### Propuesta 1 — Mejorar el mensaje de "check failed" para incluir el comando y su output real
- Qué cambiar: el runner de checks (probablemente en `src/checks/` o donde se ejecuten los checks post-tarea) — capturar y loggear stdout/stderr del comando en vez de solo "exit 1 exit 1"
- Por qué: patrón 2 — 5/15 runs fallan con un qa_reason que no dice nada accionable; sin el comando real no se puede saber si el check en sí está roto o si el código generado es malo
- Riesgo: bajo

### Propuesta 2 — Revisar/retirar la task_class "doc" para gpt-4o-mini y deepseek-v4-flash
- Qué cambiar: la definición de la tarea "doc" en `tasks.yaml` (o el prompt de esa task_class) — específicamente la referencia a `src/dashboard/handlers/skills.ts`
- Por qué: patrón 1 y 3 — 100% fail rate en 6/6 runs, con 2 causas de falla claramente identificadas (archivo de salida que no se produce, y check que siempre da exit 1) — la task_class tal como está configurada no está entregando valor con ninguno de los dos modelos probados
- Riesgo: medio (afecta si "doc" se usa activamente en producción; si ya no se usa, riesgo bajo)

### Propuesta 3 — Investigar runs "plan" con costo/tokens en 0 pero elapsed_ms alto
- Qué cambiar: logging/telemetría alrededor del wrapper de ejecución de "plan" (posible timeout antes de la llamada al modelo)
- Por qué: patrón 4 — señal débil (n=1) pero el perfil (0 tokens, 0 costo, 113s) es inusual y merece backlog de esperar más muestras antes de actuar
- Riesgo: bajo (solo investigación, sin cambio de código todavía)

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Ignorar
- [ ] Requiere revisión
