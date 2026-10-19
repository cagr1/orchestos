# ERP.5 — Qué quitar manteniendo fiabilidad y control humano (medido 2026-10-19)

Informe para que Carlos decida. Nada de esto se adopta sin su GO. No propone reglas, hooks ni agentes nuevos.

**Veredicto:** el peso por turno ya está medido y está bien (ERP.6: OrchestOS arranca con menos contexto que el CLI
directo). La sobrecarga está en otros dos lugares: **código de subsistemas que nadie usa** y **ceremonia del proceso
de desarrollo**. El control humano y los controles mecánicos (checks, salidas declaradas, worktree) son los que
encontraron todos los fallos reales: se conservan.

## Fuente
- Base real `~/.orchestos/db.sqlite`: 573 runs (2026-07-16 → 2026-10-18), 99 tareas. Corridas de fixtures de
  ui-gate (`task_id` `gate-*`, `ctx-*`) separadas de las reales.
- Mapa de código: `delegate leer` (gpt-6-luna), con archivo:línea; verificado por muestreo.
- Proceso: `git log` desde 2026-09-19 (447 commits).
- Unidades: tokens = entrada del modelo; no se convierten a cuota ni a dólares.

## 1. Producto — subsistemas
| pieza | uso observado | costo | beneficio demostrado | propuesta |
|---|---|---|---|---|
| Checks mecánicos (`tsc`, tests) | 10 fallos reales en tareas de chat | segundos | **10 de 19 fallos reales** | conservar |
| Salidas declaradas | 9 fallos reales | 0 tokens | 9 de 19; algunos pueden ser el planner declarando de más (`data/inventario.sqlite`, 6 archivos en una tarea de 2026-10-13) | conservar; revisar si el falso positivo existe (ítem aparte si sí) |
| Revisor LLM de QA (`src/run/qa.ts:87`, `harness.ts:903`) | 82 revisiones reales, **0 fallos** detectados; sus 20 `fail` son fixtures sembrados | ~4,5 k tokens y unos s por tarea (ERP.6) | ninguno medido. Tampoco se midió lo que dejó pasar | **decidir:** conservar (regla de revisión cruzada) o correrlo solo si la tarea trae criterios de aceptación |
| Adversarial y refutador (`harness.ts:948,989`, `config/schema.ts:105,115`) | **0 de 573** runs; apagados por defecto | código + 2 tests + UI en Orchestration | ninguno | quitar |
| Embeddings y grafo de código (`src/graph/` ~750 líneas, `memory-fetch.ts`) | `context_chunks`, `code_edges` y `files` en **0 filas**; `embed_hits` 0 | el middleware corre en cada tarea (`harness.ts:287`) aunque no encuentre nada | ninguno | quitar, o al menos sacar el middleware del camino de cada tarea |
| Orquestación de flotas (`orchestration_runs`, `leases`) | 0 filas | tablas + split en `harness.ts:412-472` | ninguno | quitar las tablas; el split, solo si Carlos no piensa usarlo |
| `constitution_rules` (`harness.ts:305-317`) | 0 runs en octubre | lectura de `CONSTITUTION.md` por tarea | ninguno | quitar |
| Instincts (`src/instincts/` ~440 líneas, `instinct-apply.ts`) | 2 filas | middleware por tarea; UI propia | no medido | conservar en pausa: IDEAS #72 (hoy) propone alimentarlo; decidir junto con eso |
| Memoria (`src/db/memory.ts`, `chat.ts:1254`) | 1 entrada (mecánica desde ERP.4.16) | filas al contexto del chat | aún sin datos | conservar; volver a medir en un mes |
| Evals (`src/evals/`) | 21 trials, fuera del camino de tarea y chat | 0 por turno | herramienta de medición | conservar |
| Reintentos (`MAX_RETRIES = 3`, `qa.ts:282`) | solo después de un fallo | una ejecución por intento | no separado del total | conservar |

## 2. Proceso de desarrollo de OrchestOS
| hallazgo | evidencia | propuesta |
|---|---|---|
| 60 % de los commits solo tocan documentos de proceso | 266 de 447 desde 2026-09-19 (`docs` 256); 39 son `docs(NEXT)` | spec + código + cierre en un solo commit por ítem (la regla global ya lo dice); `NEXT.md` se actualiza al cerrar un lote, no en cada ítem |
| `NEXT.md` acumula historia | 12,8 KB; la línea "Cerrados" ronda 2 KB y repite lo que ya dice `PLAN.md` | dejar solo el orden y las trampas vivas; lo cerrado vive en `PLAN.md` y git |
| `PLAN.md` pesa 195 KB | se lee por partes; los ítems cerrados conservan párrafos de evidencia | mover los bloques cerrados a `docs/done/` (como ya se hizo con sprints) |
| El plan gate muerde el formato, no el contenido | trampa de `plan:reconcile` (2 cierres en un día), ítem sin emoji, título partido, preflight sin sub-ítems (`agent-governance.ts:37`) | arreglar el parser para que acepte esos formatos (es producto, no regla nueva) |
| Arranque de sesión | 57 k tokens medidos (`docs/specs/CTX-GUARD.md`); hoy el conector `claude.ai Claude Docs` cargó 3 herramientas aunque figura en `disabledMcpServers` (`.claude/settings.json:121`) | investigar por qué esa llave no lo apaga; el startup-guard no avisó |

## Lo que no se toca
Confirmación previa para lo destructivo, worktree por tarea, frontera de lectura (AT.21), checks mecánicos, salidas
declaradas, candado de escritor, pre-push con `test:coverage`.

## Decisiones para Carlos
1. Revisor LLM de QA: ¿se conserva siempre, o solo con criterios de aceptación? Recomendación: solo con criterios.
   En 82 revisiones no encontró nada, y la revisión cruzada en el desarrollo ya la hace `qa`.
2. ¿Se quitan adversarial/refutador, embeddings/grafo, flotas y constitution? Recomendación: sí, un ítem por pieza,
   cada uno con su test borrado y la suite verde.
3. Proceso: ¿un commit por ítem y `NEXT.md` por lote? Recomendación: sí.
