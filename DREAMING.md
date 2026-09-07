# DREAMING.md — 2026-09-07

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-18T17:42:31.415Z → 2026-09-03T21:39:22.453Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### 1. task_class "doc" con deepseek/deepseek-v4-flash: 100% de fallo
- Evidencia: runs `696cc3ca`, `01f9b0e6`, `516bcb21` — los 3 únicos runs de `task_class: doc`, los 3 con `model: deepseek/deepseek-v4-flash`
- Frecuencia: 3/3 runs (100%, umbral >50%)
- qa_reason recurrente (idéntico en los 3): `"missing declared output(s): src/utils/helper.js"`
- Nota: mismo output declarado (`src/utils/helper.js`) en los 3 — podría ser el mismo caso de prueba repetido en vez de 3 escenarios distintos; no se puede descartar con este dataset.

### 2. qa_reason "missing declared output(s)" cruza task_class
- Evidencia: `696cc3ca`, `01f9b0e6`, `516bcb21` (doc, deepseek) + `d064d1b9` (implement, openai/gpt-5.4, output `hello-b.txt`)
- Frecuencia: 4/20 runs (20% del total, 4/9 runs con qa_verdict no-null = 44%)
- Patrón: el modelo reporta la tarea como completa pero el archivo declarado como output nunca se crea — mismo modo de fallo en 2 modelos distintos (deepseek y gpt-5.4), sugiere problema de verificación/instrucción más que de un modelo puntual

## Propuestas

### Propuesta 1 — verificación de output declarado antes de marcar QA pass
- Qué cambiar: en el paso de QA/verificación (`ledger:gate` o equivalente), chequear con `fs.existsSync` que cada archivo en `outputs:` declarado por la tarea existe en disco ANTES de invocar el LLM juez, en vez de depender de que el juez lo detecte por texto
- Por qué: patrón 2 — 4/20 runs fallaron por este motivo exacto, en 2 modelos distintos; es un check determinístico barato que no necesita LLM
- Riesgo: bajo

### Propuesta 2 — revisar el dataset de prueba de task_class=doc
- Qué cambiar: confirmar si los 3 runs de `doc` son 3 intentos del mismo caso de prueba (`src/utils/helper.js`) reintentado, o 3 tareas reales distintas
- Por qué: patrón 1 — 100% de fallo con un solo output declarado en los 3 casos es sospechoso de ser el mismo test repetido, no evidencia de que deepseek falle sistemáticamente en `doc`
- Riesgo: bajo (solo investigación, no cambia código)

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
