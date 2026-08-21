# DREAMING.md — 2026-08-21

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-17T22:36:30.586Z → 2026-08-19T21:02:14.779Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### `task_class: doc` + modelo `deepseek/deepseek-v4-flash` — 100% de fallo con la misma causa
- Evidencia: los 3 runs de `task_class: doc` en la ventana (2026-08-19T20:30:14Z, 20:30:30Z, 20:30:48Z) corrieron con `deepseek/deepseek-v4-flash`, los 3 terminaron `status: failed`, `qa_verdict: fail`.
- Frecuencia: 3/3 runs de `doc` (100%); también cubre el patrón "mismo modelo con `qa_verdict: fail` en 3+ runs" (deepseek acumula exactamente esos 3 fails).
- `qa_reason` recurrente, idéntica en los 3 runs: `"missing declared output(s): src/utils/helper.js"`.
- Contexto en código: la tarea de ejemplo `t2-doc` (`src/tasks/init.ts:63`) declara `input: ['src/utils/helper.js']` e `output: ['src/utils/helper.js']` — el skill `doc` debe editar el archivo in-place (agregar JSDoc), no crear uno nuevo. deepseek-v4-flash nunca produjo esa escritura en los 3 intentos; en cambio el mismo modelo sí completó con éxito una tarea `implement` sobre ese mismo archivo 4 minutos antes (20:26:24Z, `status: done`, `qa_verdict: pass`), así que el modelo no falla de forma genérica — falla específicamente en el patrón "editar archivo existente sin crear uno nuevo" del skill `doc`.

### Patrón secundario, más débil — "missing declared output(s)" también en `implement`/gpt-5.4 (no confirmado)
- Evidencia: un run `implement` con `openai/gpt-5.4` (2026-08-19T18:17:58Z) falló con `qa_reason: "missing declared output(s): hello-b.txt"`, pero el reintento inmediato con el mismo modelo (2026-08-19T18:19:55Z) sí completó (`status: done`, `qa_verdict: pass`).
- Frecuencia: 1/2 runs de esa combinación puntual — no llega al umbral de 3+ runs ni a mayoría sostenida, se anota como contexto pero no como patrón confirmado.

## Propuestas

### Propuesta 1 — revisar el prompt/skill `doc` para deepseek-v4-flash cuando input == output
- Qué cambiar: el prompt que arma el skill `doc` (buscar en `src/skills/registry.ts` y donde se construye el system prompt para `task_class: doc`) — posiblemente falta una instrucción explícita de "edita el archivo declarado como output in-place, no generes un archivo nuevo ni solo describas los cambios", o el harness no está pasando el flag/tool correcto para que deepseek escriba sobre un archivo existente.
- Por qué: 3/3 fallos idénticos y consecutivos con la misma causa exacta, aislados a la combinación `task_class: doc` × `deepseek/deepseek-v4-flash`; el mismo modelo sí escribe archivos correctamente en `implement`, así que el defecto parece específico del wiring del skill `doc`, no una limitación general del modelo.
- Riesgo: bajo — es una revisión de prompt/wiring, no un cambio de arquitectura.

### Propuesta 2 — considerar excluir/marcar `deepseek/deepseek-v4-flash` como no confiable para `task_class: doc` hasta resolver Propuesta 1
- Qué cambiar: si la Propuesta 1 no resuelve el problema rápido, agregar una exclusión temporal en el router de modelos para no asignar deepseek-v4-flash a tareas `doc` (o degradar automáticamente a fallback tras 1 fallo con esta `qa_reason`).
- Por qué: mismo patrón — evita seguir quemando corridas con una combinación que falla 100% de las veces observadas.
- Riesgo: medio — toca lógica de selección de modelo/routing, que según `CLAUDE.md` de este repo requiere plan corto confirmado antes de codear si redefine comportamiento central.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
