# DREAMING.md — 2026-09-01

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-18T01:15:25.413Z → 2026-08-30T17:53:00.307Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### 1. task_class "doc" falla 100% — mismo archivo declarado y nunca creado
- Evidencia: 3/3 runs de `task_class: doc`, todos con `model: deepseek/deepseek-v4-flash`,
  provider `openrouter`. Runs: `696cc3ca`, `01f9b0e6`, `516bcb21` (2026-08-19, en una ventana
  de ~35 segundos entre sí — parece la misma tarea reintentada 3 veces).
- Frecuencia: 3/3 runs de esa task_class (100%), y 3/7 runs de deepseek-v4-flash (43%).
- qa_reason recurrente (idéntico en los 3): `"missing declared output(s): src/utils/helper.js"`.
- Nota: task_class "doc" y el fallo de deepseek con ese qa_reason son el MISMO conjunto de
  3 runs, no dos patrones independientes — todo apunta a una sola tarea que se reintentó y
  falló igual las 3 veces.
- Contraste: hay un run posterior de deepseek (`792ebc9f`, sin fecha de creación clara en el
  export pero con qa_verdict pass) que sí generó `src/utils/helper.js` con éxito — o sea el
  modelo puede hacerlo, pero falló consistentemente en esos 3 intentos concretos.

## Propuestas

### Propuesta 1 — investigar por qué el reintento no cambió el resultado
- Qué cambiar: nada en código todavía — falta contexto que `runs-summary.json` no tiene
  (el prompt/tarea original que generó esos 3 runs, y si el sistema reintentó automáticamente
  o si fue Carlos manualmente).
- Por qué: 3 intentos idénticos con el mismo qa_reason en 35 segundos sugiere que el reintento
  no varió el prompt ni el contexto — si el orquestador reintenta tareas fallidas de forma
  automática sin ajustar nada, va a repetir el mismo fallo indefinidamente sin converger.
- Riesgo: bajo (es solo investigación, no cambio de comportamiento).

### Propuesta 2 — quizás agregar un check declarativo de "archivo esperado existe" antes del QA
- Qué cambiar: si el pipeline de tareas `doc`/`implement` declara `files_expected` o similar,
  validar su existencia como check mecánico (rápido, barato) antes de invocar el QA verdict
  completo (más caro, como se ve en el `usd_cost` de estos runs: ~$0.09–0.14 cada uno).
- Por qué: los 3 runs gastaron QA completo solo para reportar "falta el archivo declarado" —
  eso es una verificación de existencia de archivo, no algo que necesite juicio de un LLM.
- Riesgo: medio (depende de si `files_expected` ya existe en el schema de tareas — no verificado
  en este análisis; requiere revisar `tasks.yaml` y el código de QA antes de decidir).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
