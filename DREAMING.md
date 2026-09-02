# DREAMING.md — 2026-09-02

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-18T01:15:25.413Z → 2026-08-30T17:53:00.307Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### 1. task_class "doc" falla 100% con deepseek/deepseek-v4-flash
- Evidencia: 3/3 runs de `task_class: doc` fallaron, los 3 con `model: deepseek/deepseek-v4-flash` (provider openrouter), `qa_reason` idéntico en los 3: "missing declared output(s): src/utils/helper.js". IDs: 696cc3ca, 01f9b0e6, 516bcb21 — todos creados en la misma ventana (2026-08-19T20:30:14–48Z), sugiriendo reintentos consecutivos del mismo task sin cambiar de estrategia.
- Frecuencia: 3/20 runs totales, 3/3 de la clase "doc"
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js"

### 2. "missing declared output(s)" también aparece en implement con gpt-5.4
- Evidencia: run d064d1b9 (`task_class: implement`, `model: openai/gpt-5.4`) falló con "missing declared output(s): hello-b.txt" pese a costar $0.169 y usar 65,857 tokens — el modelo consumió presupuesto real sin producir el archivo declarado.
- Frecuencia: 1/6 runs de implement (17%), pero mismo tipo de fallo que el patrón 1 → posible causa raíz compartida en cómo se resuelve/valida la ruta de output declarada, no solo un problema de deepseek.
- qa_reason recurrente: "missing declared output(s): <archivo>"

### 3. task_class "chat" es 100% estable
- Evidencia: 11/11 runs de chat con status "done", sin qa_verdict fail. No requiere intervención.

## Propuestas

### Propuesta 1 — evitar deepseek-v4-flash para task_class "doc" hasta investigar
- Qué cambiar: en la configuración de selección de modelo/routing (`orchestos.config.yaml` o el módulo de cascada de motor), excluir o des-priorizar `deepseek/deepseek-v4-flash` para tareas clasificadas como "doc" hasta confirmar la causa del fallo de output declarado.
- Por qué: 3/3 fallos idénticos en la misma ventana de 34 segundos, mismo archivo faltante — patrón consistente, no ruido aleatorio.
- Riesgo: bajo (es una exclusión de modelo para una clase de tarea específica, reversible).

### Propuesta 2 — validar que el path de output declarado se resuelva correctamente antes de reportar éxito
- Qué cambiar: revisar el componente que compara "output declarado" vs. "archivos creados" (probablemente en el runner de tasks o en el gate de QA) — los 4 fallos con "missing declared output(s)" ocurren en dos modelos distintos (deepseek-v4-flash, gpt-5.4) y dos task_class distintos (doc, implement), lo que sugiere que el problema puede estar en cómo OrchestOS registra o normaliza la ruta esperada, no solo en el modelo.
- Por qué: mismo mensaje de qa_reason cruzando modelo y task_class es más consistente con un bug de wiring/path-resolution que con una falla puntual de LLM.
- Riesgo: medio (toca el gate de verificación, requiere pruebas antes de aplicar).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
