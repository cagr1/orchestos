### MES 16 — El giro del timón: motor honesto + ejecutor agéntico

Origen: revisión estratégica externa (Claude Fable 5, 2026-07-01, memoria `project-strategic-review-2026-07`). Diagnóstico central: OrchestOS tiene dos productos adentro — un ejecutor LLM de un solo disparo (parte débil, arquitectura 2023) y una capa de verificación (contrato + checks + evidencia + diagnose — parte fuerte y diferenciadora). Este mes corrigió 4 fallas puntuales del ejecutor (F1-F4) y ejecutó la decisión de arquitectura (Bloque G): desacoplar la capa de verificación del ejecutor para que envuelva cualquier engine, empezando por uno agéntico.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| F0 | Integridad — suite determinista, `tasks.yaml` reconciliado, providers arreglados (prerequisito de Mes 15→16, cerrado la mañana del 2026-07-02) | ✅ SÍ |
| F1 | Retry con feedback — `previousFailure` en el prompt | ✅ SÍ |
| F2 | QA con juez distinto — `resolveQAJudge()` nunca el mismo modelo que generó | ✅ SÍ |
| F3 | Evidencia completa — ningún fallo pierde fila en `runs`, `runId` nunca vacío | ✅ SÍ |
| F4 | Contrato con paths normalizados — `./`/`\`/`//` ya no disparan falsa violación | ✅ SÍ |
| G.1 | Diseño `ExecutorEngine` — interface + 4 tools del agéntico + decisión de eliminar topes de gasto | ✅ SÍ |
| G.2 | Extracción single-shot a `executors/single-shot.ts`, cero cambio de comportamiento | ✅ SÍ |
| G.3 | Ejecutor agéntico (`executors/agentic.ts`) + selección de engine por tarea/config | ✅ SÍ |
| G.4 | Superficie dashboard + CLI (selector de engine, detalle con iteraciones, `--engine`) | ✅ SÍ |
| G.5 | Gate comparativo con dinero real — encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**F0 — Integridad (prerequisito, cerrado 2026-07-02 por la mañana)**
Auditoría completa (arquitecto + debugger + QA + dev) pedida por Carlos antes de tocar el motor. 8 archivos de test con `mock.module()` sin scope por archivo (contaminaba la suite según orden) — eliminado, inyección de dependencias en su lugar (ver [[reference-bun-mock-module-gotcha]]). `tasks.yaml` reconciliado (6 tareas non-done resueltas una por una con decisión explícita). `maxTokens` ignorado en providers directos conectado. Modelo retirado (`claude-3-haiku`) reemplazado por `claude-haiku-4-5` como default del núcleo. Pricing con fuente de verdad duplicada (fallback $0 silencioso) migrado a leer del catálogo real. 524 tests · 0 fail al cerrar.

**F1 — Retry con feedback**
`buildPrompt()` gana `previousFailure?: string` — si `retry_count > 0`, inyecta bloque `## PREVIOUS ATTEMPT FAILED` con el motivo truncado a 2000 chars al final de `userContent`. Verificado en vivo: tarea desechable con check `exit 1` — el segundo intento sí trae el bloque, el primero no.

**F2 — QA con juez distinto**
`resolveQAJudge()` en `harness.ts`: (1) `orcheConfig.models.qa` explícito gana siempre; (2) si no, default barato por provider distinto del ejecutor (constante `QA_JUDGE_DEFAULTS`); (3) colisión → fallback anti-colisión, con `log.info` si ocurre solo por config explícita. Nueva columna `qa_model` en `runs`, visible en `runs --detail`. Verificado en vivo: ejecutor `deepseek/deepseek-v4-flash`, juez `openai/gpt-4o-mini` — distinto, confirmado con dinero real.

**F3 — Evidencia completa**
El catch de la llamada LLM (antes retornaba `failed` sin fila en `runs` — el hueco más grave, justo la clase de fallo más común) ahora hace `insertRun`. Los 6 paths de fallo del harness devuelven `runId` real en vez de `''`. Verificado en vivo con `OPENROUTER_API_KEY` inválida real: `runs --detail` mostró el 401 del proveedor con `runId` no vacío.

**F4 — Contrato con paths normalizados**
`normalizeRelPath()` en `contract.ts`: `\`→`/`, `./` repetido, `//` colapsado — aplicado en ambos lados de `enforceContract()` y en el cálculo de `missingOutputs`. `../` sigue bloqueado a propósito (anti-escape intacto, nunca se resuelve `..`). Verificado en vivo: prompt que fuerza al modelo a emitir `./src/...` — el contrato autorizó sin falso positivo.

**Bloque G — La decisión de arquitectura**
- **G.1 (diseño)**: `docs/executor-engine-design.md`. `ExecutorEngine.run(ctx, opts) → ExecutorOutcome` — el engine solo genera, nunca escribe a disco ni toca contrato/checks/QA/evidencia (universal, queda en el harness). 4 tools del agéntico v1 (`read_file`, `write_file`, `list_dir`, `run_check`) con el gate del contrato DENTRO de `write_file` (error de string al modelo, no excepción — autocorrección en la siguiente iteración). Decisión de Carlos durante el diseño: se elimina el tope de gasto (`maxUsd`/`budget`) — OrchestOS no pone techos de dinero, el costo se **anuncia** (mismo principio de F0.8), no se limita; queda solo `maxIterations` (garantía de terminación, no límite de dinero) y se añade `costByIteration` (medición real, reusa `CostBreakdownEntry` ya existente).
- **G.2 (extracción)**: bloque "LLM call → parse" movido a `executors/single-shot.ts` sin cambio de comportamiento — mismo mensaje de error, mismo costo, cero test existente modificado (553 pass antes y después).
- **G.3 (agéntico)**: `executors/agentic.ts` reusa `runToolLoop()` (Mes 13) tal cual. Selección: `Task.engine` gana sobre `orcheConfig.executorEngine`, default absoluto `single-shot`. Fallback automático a single-shot si el modelo no soporta tool-calling, con aviso en el log.
- **G.4 (superficie)**: selector de engine en el composer de Tasks, bloque "Engine" (type + iterations) en `runs --detail` (dashboard y CLI), flag `--engine` transitorio en `task run`. Cerró de paso un gap que G.3 no había atrapado: el harness generaba `costByIteration` pero nunca lo persistía en SQLite (`runs --detail` mostraba `type: unknown` para todo). Verificado en vivo con dinero real (3 corridas: engine declarado en tasks.yaml, override transitorio por CLI, rechazo de valor inválido).
- **G.5 (gate comparativo, dinero real)**: misma tarea (agregar una línea de JSDoc) sobre un archivo real de 419 líneas (`src/dashboard/handlers/skills.ts` — `test-project/` no tenía ningún archivo de 300+ líneas), mismo modelo (`openai/gpt-4o-mini`), ambos engines. **Resultado inicial: single-shot ganó** — perfecto, $0.0032; el agéntico truncó a mitad de una llamada de función y `tsc` falló ($0.0055, 3.3× más tokens de entrada). **Causa raíz encontrada y corregida** (a pedido explícito de Carlos, "arreglemos esto antes de avanzar, buscar más fallas en el sistema"): barrido completo de `max_tokens`/`maxTokens` en todo `src/` encontró 2 bugs reales — (1) `tool-call.ts` tenía `max_tokens: 4096` hardcodeado en 4 funciones (las 2 rondas del loop multi-turno eran la causa exacta); (2) `harness.ts` calculaba el presupuesto desde la ventana de contexto TOTAL sin toparlo contra el tope real de salida por llamada que el catálogo ya conocía (`maxOutputTokensFor`) — pedía ~122K de salida para un modelo cuyo tope real es 16384, rechazo 400 real de OpenRouter. Los 2 arreglados, 3 consumidores actualizados (`agentic.ts`, `chat.ts`, `planner.ts`) para pasar presupuesto real en vez de heredar el default silencioso. Reverificado en vivo con dinero real adicional: ya sin error 400 ni truncamiento; con `claude-haiku-4-5` el `tsc` pasó limpio (`exit 0`), sin truncar y sin perder código.

**Decisiones de diseño Mes 16**
- El costo se anuncia, nunca se limita — decisión explícita de Carlos que eliminó el concepto de `maxUsd`/tope de gasto del diseño del engine agéntico antes de escribir una línea de código, evitando construir una abstracción que después había que desmontar.
- La capa de verificación desacoplada (F1-F4 + G.1-G.2) demostró su valor incluso cuando el engine nuevo falló: el harness detectó el fallo con evidencia completa (F3), revirtió limpio (checks), y permitió comparar dos engines contra el mismo contrato sin duplicar código — la arquitectura hizo exactamente lo que se esperaba de ella.
- Un gate 🔍 con dinero real encontró 2 bugs de infraestructura que ningún test con mocks había mostrado (`max_tokens` hardcodeado en 4 lugares + presupuesto sin clamp contra el tope real del proveedor) — mismo patrón que Mes 14 D2/D3 y Mes 13 Bloque A: verificar en vivo contra el sistema real, no solo contra mocks (ver [[feedback-verificar-gates-en-vivo]]).
- G.4 se completó en paralelo por delegación (mismo patrón de [[codex-delegation-workflow]]) mientras G.3/G.5 avanzaban — verificado con evidencia concreta (grep del código real + corrida aislada de sus 18 tests) antes de darlo por bueno, no solo por el checkbox (ver [[feedback-verificar-progreso-delegado]]).

**Lista prohibida Mes 16** _(lo que NO se hizo — referencia histórica)_
- Ejecutores externos (Claude Code headless, opencode) como tercera implementación de `ExecutorEngine` — IDEAS.md #15, prerequisito "Bloque G cerrado" ahora satisfecho, candidato natural para el próximo mes.
- Escala honesta (poda de DB, presupuesto de `input[]`, partir `cli.ts`) — IDEAS.md #16, sigue gated en evidencia de usuario real, no en este mes.
- Migrar `supportsToolCalling()` de heurística por prefijo a leer `supported_parameters` real del catálogo OpenRouter — mejora posible, no bloqueante, anotada en el diseño de G.1.

**Métrica Mes 16 — SÍ (2026-07-02)**
Los 4 hallazgos puntuales del ejecutor (F1-F4) corregidos y verificados en vivo. La capa de verificación quedó desacoplada del ejecutor (Bloque G): un segundo engine (agéntico) existe, se selecciona por tarea o config, y se compara contra el original con el mismo contrato — sin duplicar lógica de contrato/checks/QA/evidencia. El gate comparativo con dinero real (G.5) no solo midió, encontró 2 bugs reales de infraestructura y se corrigieron el mismo día, reverificados con dinero real adicional. 585 tests · 0 fail · `tsc --noEmit` limpio. Gasto total de verificación con dinero real en todo el mes: ~$0.15 USD.

---

