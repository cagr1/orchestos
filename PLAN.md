---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: f0-integridad-cerrado--mes-16-desbloqueado
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**:
- 🧠 = Claude implementa — requiere criterio arquitectural o decisión de diseño
- ⚡ = DeepSeek implementa — tarea bien especificada, ejecuta leyendo el plan
- 🔍 = revisión obligatoria por Claude — gate antes de cerrar el sprint, independiente de quién implementó

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

**Status: CERRADO (2026-07-02).** Origen: auditoría completa 2026-07-02 (arquitecto + debugger + QA + dev), pedida por Carlos antes de avanzar al Mes 16 ("quiero dejar todo limpio... y ver cada detalle que haya quedado en el pasado"). Hallazgo central: no se puede "probar el sistema hasta el colapso" (Mes 16) si la suite de tests es flaky y `tasks.yaml` (la fuente de verdad) contradice lo que el código real hace. F0.1–F0.9 cerrados con evidencia verificada (no checkbox delegado). Mes 16 desbloqueado.

- [x] F0.1 ⚡ **Suite determinista.** (2026-07-02) 8 archivos de test usaban `mock.module()` (`openrouter-chat.test.ts`, `graph-runner.test.ts`, `ssrf.test.ts`, `memory-judge.test.ts`, `graph-summary.test.ts`, `diagnose.test.ts`, `chat-effort.test.ts`, `execute-plan.test.ts`) — sin scope por archivo, contamina la suite según orden de ejecución ([[reference-bun-mock-module-gotcha]]). Reproducido en vivo (2026-07-02): `bun test` completo da 518 pass · 3 fail (`chat-fetch-url.test.ts`, roto por el mock de `dns/promises` de `ssrf.test.ts`); el mismo archivo aislado da 6/6. Fix: extender el patrón de inyección de dependencias ya usado en `graph-runner.ts` (`GraphRunOpts` con `loadTasksFn`/`updateTaskStatusFn`) a los módulos mockeados por estos 8 archivos, eliminando `mock.module()` uno por uno. **Cierre:** de los 8 originales, 7 ya estaban limpios al reverificar (4 realmente arreglados por la corrida delegada + 3 que solo tenían la cadena `mock.module` en comentarios explicativos, falso positivo del grep inicial). El único archivo con llamadas reales pendientes era `src/dashboard/__tests__/run-graph-api.test.ts` (no estaba en la lista original — se añadió al alcance): mockeaba `tasks/loader.ts`, `context/load.ts`, `db/projects.ts`, `config/load.ts`. Fix: `src/dashboard/handlers/run-graph.ts` gana un objeto `deps` (mismo patrón que `runGraphImpl`) con `__setDepsForTests`/`__resetDepsForTests`; el test ya no mockea módulos — usa `tasks/loader.ts`/`loadTaskRows` reales contra el `tasks.yaml` real en el tmpDir, y override explícito de `loadContext`/`getProject`/`loadOrcheConfig` vía el seam (evita depender del `~/.orchestos/db.sqlite` o `config.yaml` reales de la máquina).
- [x] F0.2 🔍 Gate: `bun test` completo da el mismo resultado corrido 5 veces seguidas, en cualquier orden de archivos. **Cerrado 2026-07-02.** `grep -rlE '^\s*mock\.module\('` sobre todo `src/` → 0 archivos. `bunx tsc --noEmit` limpio. `bun test` (39 archivos): **521 pass · 0 fail** en 5 corridas orden default + 3 corridas orden aleatorio (`sort -R`) + 1 corrida orden inverso (`sort -r`) — 9 corridas totales, 0 fail en todas. Gate satisfecho con evidencia real, no checkbox delegado ([[feedback-verificar-progreso-delegado]]).
  **Historial:**
  **Intento 2026-07-02 (pre-F0.1, no cerró el gate):** 11+ corridas (orden default ×8, orden inverso, orden aleatorio ×3 con `sort -R`, incluyendo `src/__tests__` + `tests/`) → **0 fail en todas**. El fallo de `chat-fetch-url.test.ts` visto el mismo día (contaminado por `mock.module('dns/promises')` de `ssrf.test.ts`) NO se reprodujo reordenando archivos. Conclusión: no reproducible vía orden de lista de archivos — la contaminación probablemente depende del scheduling interno de Bun entre test files (`mock.module()` no tiene scope por archivo, ver [[reference-bun-mock-module-gotcha]]), no solo del orden en que se pasan como argumentos. No cerró el gate en ese momento: F0.1 (eliminar `mock.module()`) seguía pendiente — la ausencia de fallo ese día fue falso negativo, no prueba de determinismo.
  **Intento 2 — 2026-07-02, tras el avance paralelo de F0.1 (delegado, working tree sin commit):** verificado con grep real, no checkbox: `mock.module` ELIMINADO de `ssrf.test.ts`, `diagnose.test.ts`, `execute-plan.test.ts`, `graph-summary.test.ts` (4 de 9). Gate corrido sobre ese estado: 521 pass · 0 fail en 5 corridas default + 2 aleatorias. Seguía sin cerrarse: quedaban 5 archivos con la cadena `mock.module` (`graph-runner.test.ts`, `openrouter-chat.test.ts`, `memory-judge.test.ts`, `chat-effort.test.ts`, `run-graph-api.test.ts`).
  **Progreso paralelo verificado en el mismo working tree (sin commit todavía):** F0.3 tareas front-2/front-3 reconciliadas a `done` (`run_id: F0.3-reconciliation`) y residuos de dogfooding retirados de `tasks.yaml` (~450→275 líneas) · F0.5 basura de raíz borrada (fix-copegadoc, index.ts raíz, package-lock.json, runs-export.json, prototypes/, logs de examples/) · F0.6 `providers/anthropic.ts`/`openai.ts` modificados · F0.7 default `claude-3-haiku` reemplazado por `claude-haiku-4-5` en `diagnose.ts` y `memory/judge.ts:114` (queda un comentario stale en `judge.ts:107`) · F0.8 `pricing.ts` + `model-catalog.ts` modificados. Pendiente: gates 🔍 de F0.6–F0.9 sobre estos cambios antes de marcar `[x]`, y commit del bloque completo.
- [x] F0.3 ⚡ **Reconciliar `tasks.yaml`.** (2026-07-02) 5 tareas no-`done` reconciliadas una por una, decisiones explícitas:
  - `front-2-persist-effort: failed` y `front-3-i18n-effort: pending` → **reconciliadas a `done`** con `run_id: F0.3-reconciliation`, `retry_count: 1`, `qa_verdict: pass`. Evidencia real: `app.js:58` tiene `localStorage.getItem('orchestos-chat-effort')`, `screens-core.js:256` tiene el `localStorage.setItem('orchestos-chat-effort', e.target.value)`, y `i18n.js` tiene `chat.effort.{label,low,medium,high}` en ambos bloques (en: líneas 64-67, es: líneas 560-563). El `failed`/`pending` venía de parse errors del modelo al reformatear archivos completos (no respeta `<<<FILE:...>>>`); la funcionalidad ya estaba en código desde el commit `61d6bcc` (feat(chat): selector de esfuerzo en UI · Bloque FRONT).
  - `cleanup-plan-to-done: failed` → **borrada** (decisión Carlos 2026-07-02). Era un residuo meta: el LLM falló con parse error al intentar regenerar `PLAN.md` y `DONE.md`. El trabajo que pedía (mover S19-S21 de PLAN.md a DONE.md) ya se hizo manualmente cuando se cerró el Mes 5 (commit `3e1f290`).
  - `crear-web-local-comercial: failed` → **borrada** (decisión Carlos 2026-07-02). Su `failed` real (`OpenRouter 400: requested about 1.048.622 tokens, max 1.048.576`) destapó el bug `maxTokens=8192` que se arregló en `9e5a5ed` y `e30134c`; la fix de `e30134c` también es la base de F0.6. El truncamiento brownfield multi-archivo sigue siendo el techo del single-shot → ya está en Mes 16 Bloque G como hallazgo #1. Output parcial revertido en `187ac2a`.
  - `dogfood-worktree-no-silent-fallback: pending` → **borrada** (decisión Carlos 2026-07-02). Test-de-dogfooding que ya cumplió su propósito: 2 bugs reales arreglados en `2dcee21` (`task run` no chequeaba sandbox limpio → generaba `status: running` huérfanas) y `26a3f81` (restaurar la spec completa). El comportamiento "worktree explícito no hace fallback silencioso" ya está implementado y cubierto por la regresión del Mes 15 (DONE.md § Mes 15 Bloque D).
  **Verificación parcial** (gate completo en F0.4): `bun src/cli.ts task status` → 6 tareas listadas, todas `done` con `qa_verdict: pass`, 0 `failed`/`pending` en el archivo.
- [x] F0.4 🔍 Gate: `orchestos task status` no muestra ninguna tarea cuyo estado contradiga el código real; 0 tareas `failed`/`pending` sin justificación explícita en este ítem. **Cerrado 2026-07-02.** `bun src/cli.ts task status` → 6 tareas, todas `done` con `qa_verdict: pass`. 0 `failed`/`pending` en el archivo. Los 3 residuos que tenían status non-done fueron borrados en F0.3 con decisión explícita documentada en PLAN.md.
- [x] F0.5 ⚡ **Basura de raíz.** (2026-07-02, working tree — commit en F0.9) Borrados: `fix-copegadoc-context.ts`, `index.ts` raíz, `package-lock.json`, `runs-export.json`, `examples/e2e/runs/*.log`, `prototypes/` (4 archivos). `CONSTITUTION.md` nunca fue commiteado — no existe en el árbol. Verificado con `git status --short`: todos en estado `D` (deleted staged).
- [x] F0.6 ⚡ **`maxTokens` ignorado en providers directos.** (2026-07-02, working tree — commit en F0.9) `anthropic.ts` y `openai.ts` ahora aceptan `maxTokens?: number` en su firma y lo pasan como `max_tokens: opts.maxTokens ?? 8192` al body. El harness ya calculaba `maxTokens = contextWindow - promptTokens - SAFETY_MARGIN` y lo pasaba en `provider.chat({ ..., maxTokens })` — el fix conecta el cable que faltaba. Verificado: `git diff` muestra el parámetro añadido en ambos providers; `ChatOpts` en `providers/index.ts:11` ya tenía `maxTokens?: number`; harness llama `ctx.provider.chat({ ..., maxTokens })` en línea 219.
- [x] F0.7 ⚡ **Modelo retirado como default del núcleo.** (2026-07-02, working tree — commit en F0.9) `diagnose.ts:127` y `judge.ts:114` ahora usan `'anthropic/claude-haiku-4-5'` como default. Queda un comentario stale en `judge.ts:107` que dice "default: anthropic/claude-3-haiku" — cosmético, no afecta comportamiento, se puede limpiar en cualquier momento. Verificado con grep: 0 ocurrencias de `claude-3-haiku` como valor de string en el código (solo en el comentario).
- [x] F0.8 🧠 **Pricing con fuente de verdad duplicada.** (2026-07-02, working tree — commit en F0.9) `src/router/pricing.ts` tiene 12 modelos hardcodeados con fallback `{input:0, output:0}` — cualquier modelo fuera de la lista reporta costo $0 silencioso (evidencia mentirosa, mismo género que el hallazgo F3 del Mes 16). El catálogo OpenRouter (ya consumido en `model-catalog.ts` para `contextLength`/`maxOutputTokens`) trae pricing real. Decisión de diseño: migrar `calcCost()` a leer del catálogo con fallback a la tabla estática solo si el catálogo no tiene el modelo (no borrar la tabla — sirve de fallback offline). Mismo patrón para `context-monitor.ts:65-71` (tabla de context windows paralela al catálogo).
  **Refinamiento (decisión de Carlos, 2026-07-02):** el costo tiene dos roles que conviven y no se mezclan: (1) **límite** — `maxCost`/`maxMinutes` del Graph Runner se MANTIENEN como circuit breaker en corridas autónomas (seguridad de gasto); (2) **anuncio** — el reporte post-run debe mostrar, estilo página Activity de OpenRouter, tokens de entrada/salida REALES (ya vienen de `usage.*` de la API, no estimados) y precio real por modelo leído del catálogo. Los conteos de tokens en `runs` ya son reales; lo que miente hoy es el precio (fallback $0). Nota conceptual para no reconfundir: `contextWindow` = capacidad total del modelo, `maxOutputTokens` = tope que el modelo puede emitir, `max_tokens` (param API) = tope que nosotros pedimos por respuesta. Son tokens de verdad — la unidad de facturación de todo LLM — no se renombra la variable.
- [x] F0.9 🔍 Gate final. **Cerrado 2026-07-02.** `bunx tsc --noEmit` limpio · `bun test` **524 pass · 0 fail** (40 archivos) en orden default (×3) y aleatorio (`sort -R`) · `git status` sin basura de raíz (F0.5) · `orchestos task status` reconciliado (F0.4, 6/6 `done`).
  **Run real con provider directo — decisión de Carlos (2026-07-02):** no hay `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` configurada en esta máquina (solo `OPENROUTER_API_KEY` en `~/.orchestos/.env`), así que no se pudo correr un run end-to-end real. Sustituido por verificación a nivel de unidad: `src/__tests__/provider-max-tokens.test.ts` (nuevo) stubea `globalThis.fetch` (mismo patrón que `chat-effort.test.ts` BACK.4 — cada `chat()` hace UNA sola llamada fetch, sin ventana de carrera) y confirma que el body HTTP real enviado a Anthropic/OpenAI lleva `max_tokens: 187000`/`112000` (valor grande pasado explícitamente, imposible de confundir con el default) cuando `maxTokens` viene del harness, y que el fallback a `8192` solo ocurre si `maxTokens` no se pasa en absoluto (llamada directa/manual, no vía harness). Prueba la lógica del fix de F0.6 sin necesitar la key real. Pendiente si Carlos consigue una key: correr una tarea barata real con `executor_model` directo de Anthropic/OpenAI y confirmar en `runs --detail` que no trunca — no bloqueante para cerrar F0.
  Comentario stale corregido de paso: `judge.ts:107` decía "default: anthropic/claude-3-haiku", actualizado a `claude-haiku-4-5` (coincide con F0.7).

**Deudas identificadas pero NO en F0 — movidas a IDEAS.md, no bloquean el Mes 16:**
- Pause/cancel de una corrida de grafo en curso (DONE.md § Mes 15 Bloque C).
- Paralelismo del scheduler (secuencial desde Mes 3; sin evidencia de que sea cuello de botella real todavía).
- `description` vacía en `GET /api/skills/registry` (Mes 13/14, sin fricción real reportada).
- Landing page — estaba gated en "precisa VISION.md primero"; VISION.md existe desde 2026-06-04, gate obsoleto. Decisión de Carlos si se desbloquea.
- Router por regex (`classify.ts`/`models.ts`) mapea 5 clases al mismo modelo — teatro funcional. No se toca en F0: muere naturalmente absorbido por `config.models` en el Bloque G del Mes 16.
- Tool-calling no dispara con el modelo default (`deepseek-v4-flash` no soporta tools nativos — `search_memory` y `fetch_url`, las dos features insignia de Mes 13/15, quedan mudas en una instalación fresca sin cambiar el modelo). Requiere decisión de producto (cambiar default vs. fallback prompt-based) — candidato a discutir antes de abrir Mes 16, no una tarea mecánica de F0.

---

## MES 15 — Dashboard usable en pruebas reales: reset, diagnóstico, grafo accionable, memoria buscable

- [x] **SÍ — Mes 15 cerrado (2026-07-01)**
  Las 4 fricciones del dogfooding real cerradas con superficie completa en dashboard + CLI: reset de datos de prueba (Bloque A), diagnose expone el motivo real del fallo (`lastErrorResult`, B), retry con modelo alternativo transitorio (B2), Graph Runner accionable con límites editables y retry por fila reusando el endpoint de B2 (C), y memoria buscable vía FTS5/BM25 en dashboard y chat con `search_memory` tool + router multi-tool (D0/D). Todos los gates 🔍 verificados en vivo contra el dashboard real, no mocks. 521 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).


---

## MES 16 (BLOQUEADO — requiere F0 cerrado) — El giro del timón: motor honesto + ejecutor agéntico

**Status: bloqueado por MES 15.F0 (Integridad).** No abrir F1 hasta que F0.1–F0.9 estén `[x]`. Origen: revisión estratégica externa (Claude Fable 5, 2026-07-01, guardada en memoria como `project-strategic-review-2026-07`). Lectura completa de `harness.ts`/`contract.ts`/`prompt.ts`/`qa.ts` encontró **6 fallas reales del corazón del producto** (no cosmética). Diagnóstico central: OrchestOS tiene dos productos adentro — un ejecutor LLM de un solo disparo (la parte débil, arquitectura 2023) y una **capa de verificación** (contrato + checks + evidencia + diagnose — la parte fuerte y diferenciadora). Este mes corrige las 4 fallas puntuales (F1–F4, ~1 día cada una) y ejecuta la decisión de arquitectura (Bloque G): desacoplar la capa de verificación del ejecutor para que pueda envolver ejecutores agénticos.

**Los 6 hallazgos de la revisión (referencia para todos los bloques):**
1. **Ejecutor de un solo disparo** — `harness.ts:219`: una tarea = una llamada LLM que emite archivos completos en `<<<FILE:...>>>`. No puede leer archivos a demanda, correr comandos ni iterar sobre errores. Es el techo del producto (causa raíz del truncamiento de `crear-web-local-comercial` y del riesgo de regresión en brownfield). → Bloque G.
2. **Retry ciego** — `prompt.ts` (`buildPrompt`) nunca inyecta `retry_reason` ni el veredicto QA anterior: un retry es el mismo prompt re-tirado. `Task.retry_reason` ya existe (`src/tasks/schema.ts:29`) pero nadie lo lee al construir el prompt. → Bloque F1.
3. **QA se autocalifica** — `harness.ts:345` pasa `model: ctx.model` a `runQA`: el mismo modelo que generó el código lo juzga (errores correlacionados). → Bloque F2.
4. **Evidencia incompleta** — `harness.ts:220-223`: si la llamada LLM falla (timeout/429/key inválida) retorna `failed` SIN `insertRun` — cero fila en SQLite justo en la clase de fallo más común. Además casi todos los paths de fallo descartan el id de `insertRun` y retornan `runId: ''`. → Bloque F3.
5. **Contrato = igualdad exacta de strings** — `contract.ts:76` (`allowedPaths.includes(file.path)`): sin normalización, `./src/a.ts` o `src\a.ts` contra un contrato `src/a.ts` = falso positivo de violación que quema un retry entero. → Bloque F4.
6. **Escala no probada** — <50 archivos testeados, `input[]` va completo al prompt, DB sin poda, `cli.ts` 2127 líneas. → NO va en este mes; anotado en IDEAS.md #16 (gated en evidencia de usuario real).

**Reglas del mes:**
- La regla "No tocar `harness.ts`" del Mes 15 queda **levantada** al abrir este mes — F1–F4 y G viven exactamente ahí.
- Orden obligatorio: F1→F2→F3→F4 (independientes pero chicos, cerrarlos antes de abrir G) → G1…G5. F1–F4 NO dependen de G; si G se retrasa, F1–F4 ya valen solos.
- Cada F-bloque termina con `bunx tsc --noEmit` limpio + suite completa verde + verificación en vivo (checklist abajo). Mismo estándar 🔍 de siempre ([[feedback-verificar-gates-en-vivo]]).
- **No inventar abstracciones que el bloque no pide.** G define la única interface nueva del mes.

### Bloque F1 — Retry con feedback: el ejecutor debe saber por qué falló la vez anterior
- [ ] F1.1 ⚡ `buildPrompt()` (`src/run/prompt.ts`) gana parámetro opcional `previousFailure?: string`. Si viene, añade al FINAL de `userContent` (no del system) un bloque: `\n## PREVIOUS ATTEMPT FAILED\nThe last attempt at this task failed for this reason:\n<motivo>\nFix the cause described above. Do not repeat the same mistake.` Truncar el motivo a 2000 chars (`.slice(0, 2000)`).
- [ ] F1.2 ⚡ `harness.ts` (donde llama `buildPrompt`, línea ~166): pasar `previousFailure: t.retry_count > 0 ? t.retry_reason : undefined`. `retry_reason` ya se persiste en `tasks.yaml` vía `updateTaskStatus` en cada fallo — solo falta leerlo aquí. OJO: `buildPrompt` tiene 6 parámetros posicionales; añadir el 7º opcional al final o (mejor, decisión del implementador) migrar la firma a un objeto opts — si se migra, actualizar TODOS los call sites (`grep -rn "buildPrompt(" src/`).
- [ ] F1.3 ⚡ Tests: (a) unit — `buildPrompt` con `previousFailure` incluye el bloque y trunca a 2000; sin él, prompt idéntico al actual (snapshot); (b) el path de retry en harness pasa el motivo (mock del provider capturando el prompt recibido).
- [ ] F1.4 🔍 Verificar en vivo: tarea desechable con check `exit 1` determinístico → primer run falla → segundo run (retry) debe contener "PREVIOUS ATTEMPT FAILED" en el prompt real (instrumentación temporal en el provider o log del prompt, removida después). Patrón de tarea desechable: igual que B2.6/C.3 del Mes 15 (backup de `tasks.yaml`, diff vacío al final).

### Bloque F2 — QA con juez distinto: nunca el mismo modelo que generó
- [ ] F2.1 🧠 `src/config/schema.ts`: añadir rol opcional `qa?: ModelRoleConfig` a `models` (líneas 18-21; el default de líneas 31-34 NO lo incluye — ausencia = comportamiento resolutivo de F2.2, no un modelo fijo hardcodeado).
- [ ] F2.2 🧠 Resolución del modelo juez en `harness.ts` antes de llamar `runQA` (línea ~345): (1) si `orcheConfig.models.qa` existe → usarlo; (2) si no, elegir un default barato DISTINTO de `ctx.model` por provider: `anthropic → claude-haiku-4-5`, `openai → gpt-4o-mini`, `openrouter → openai/gpt-4o-mini` (y si `ctx.model` ya ES ese default, caer a `anthropic/claude-haiku-4.5` en openrouter); (3) si tras resolver, juez === ejecutor → `log.info('qa judge equals executor model — correlated errors risk')` y proceder (elección explícita del usuario solo en el caso (1)). Documentar la tabla de defaults como constante exportada `QA_JUDGE_DEFAULTS` para poder testearla.
- [ ] F2.3 ⚡ `runQA` (`src/run/qa.ts:49`): ya recibe `model` y `provider` en opts — no cambia su firma; el cambio es SOLO en el call site del harness (pasar el modelo juez resuelto y su provider si difiere del ejecutor — `getProvider()` ya existe). El costo del QA ya se calcula con `qa.model` (`calcCost(qa.model, ...)` en `harness.ts:350`), así que el breakdown de costos sigue correcto sin tocarlo.
- [ ] F2.4 ⚡ Tests: resolución (config explícito gana; default difiere del ejecutor; colisión default→fallback alternativo; juez==ejecutor solo posible por config explícito).
- [ ] F2.5 🔍 Verificar en vivo: correr una tarea real barata y confirmar en `runs --detail` que el run registra el modelo ejecutor en la fila y el costo QA calculado con el modelo juez (instrumentar temporalmente si hace falta ver el modelo juez; considerar añadir `qa_model` como columna — decisión del implementador, si se añade va con migración en `src/db/migrate.ts` y visible en `runs --detail`).

### Bloque F3 — Evidencia completa: TODO fallo deja fila en runs y el runId no se descarta
- [ ] F3.1 ⚡ `harness.ts:220-223` (catch de la llamada LLM): añadir `insertRun` con `status:'failed'`, `result: e.message`, tokens/costo 0, `snapshot_before` ya disponible, `qa_verdict: null`. Es el único path de fallo sin evidencia hoy.
- [ ] F3.2 ⚡ Capturar el retorno de `insertRun` en TODOS los paths que hoy lo descartan y devolverlo en `TaskResult.runId` (hoy retornan `runId: ''`): parse error (~línea 234), contract violation (~246), missing outputs (~269), check fail (~323), QA fail (~365) y el nuevo F3.1. El único que ya lo hace bien es el path de éxito (~383).
- [ ] F3.3 ⚡ Tests: mock provider que lanza → existe fila en `runs` con el mensaje; cada path de fallo retorna `runId` no vacío que existe en la DB.
- [ ] F3.4 🔍 Verificar en vivo: correr con una API key inválida a propósito (env temporal) → `runs --detail <id>` muestra el fallo del proveedor con su mensaje real; restaurar la key.

### Bloque F4 — Contrato con paths normalizados
- [ ] F4.1 ⚡ `src/run/contract.ts`: helper exportado `normalizeRelPath(p: string): string` = `p.replaceAll('\\','/')` → quitar prefijo `./` repetido → colapsar `//` → quitar trailing `/`. NO resolver `..` (un path con `..` debe seguir sin matchear nunca el contrato — es la protección anti-escape actual y se conserva).
- [ ] F4.2 ⚡ Aplicar `normalizeRelPath` a AMBOS lados en `enforceContract` (`contract.ts:76`) y en el cálculo de `missingOutputs` del harness (`harness.ts:259`). El path que se ESCRIBE y el que se guarda en evidencia es el normalizado. `snapshotHashes`/`snapshotContents` reciben los declarados tal cual (no cambian — las claves del snapshot son los paths del contrato).
- [ ] F4.3 ⚡ Tests: `./src/a.ts`, `src\a.ts`, `src//a.ts` autorizan contra contrato `src/a.ts`; `../x` y `src/../../x` siguen bloqueados; `missingOutputs` no da falso positivo cuando el LLM emitió `./`+path.
- [ ] F4.4 🔍 Verificar en vivo: tarea desechable cuyo prompt induzca al modelo a emitir `./` en el path (o instrumentar `parseLLMResponse` en test de integración) — el run completa sin falsa violación de contrato.

### Bloque G — La decisión de arquitectura: capa de verificación desacoplada + ejecutor agéntico
> El norte: la capa contrato/checks/QA/evidencia debe poder envolver CUALQUIER ejecutor. El single-shot actual pasa a ser "un ejecutor más". El primer ejecutor nuevo es agéntico y reusa `runToolLoop()` (`src/providers/tool-call.ts`, Mes 13, probado en producción en el chat). Ejecutores EXTERNOS (Claude Code headless, opencode) NO van en este mes — IDEAS.md #15, gated en que G funcione.

- [ ] G.1 🧠 Diseño en `docs/executor-engine-design.md` ANTES de tocar código. Debe decidir explícitamente: (a) la interface `ExecutorEngine` — propuesta de partida: `run(ctx: RunContext, opts: {maxTokens: number, budget: {maxIterations: number, maxUsd: number}}): Promise<ExecutorOutcome>` donde `ExecutorOutcome = { files: FileChange[], inputTokens, outputTokens, usd, iterations, log: string[] }`; (b) set de tools del agéntico v1: `read_file` (solo dentro de `effectiveRoot`, respetando `input[]` si está declarado + cualquier archivo del repo si no), `write_file` (SOLO paths dentro de `output[]` — el contrato se aplica EN la tool, devolviendo error al modelo para que se autocorrija, en vez de solo post-hoc), `list_dir`, `run_check` (solo los `cmd` ya declarados en `checks[]` de la tarea, nada arbitrario); (c) presupuesto del loop: `maxIterations` default 15, corte por costo acumulado; (d) fallback: si el modelo no soporta tool-calling (catálogo OpenRouter lo publica) → cae a single-shot con warning; (e) `enforceContract` post-hoc se MANTIENE como segunda línea de defensa aun con el gate en la tool. El doc se revisa con Carlos antes de G.2.
- [ ] G.2 🧠 Extracción sin cambio de comportamiento: mover el bloque "LLM call → parse" del harness (`harness.ts:216-236`) a `src/run/executors/single-shot.ts` implementando `ExecutorEngine`. El harness llama al engine y recibe `files` — TODO lo demás (snapshot, missing outputs, checks, QA, revert, insertRun) queda en el harness intacto. Gate: suite completa verde SIN modificar ningún test existente (si un test necesita cambio, la extracción cambió comportamiento — investigar antes de seguir).
- [ ] G.3 🧠 `src/run/executors/agentic.ts` según el diseño de G.1, reusando `runToolLoop()`/`callWithTools()`. Selección: campo opcional `engine: single-shot | agentic` por tarea en `tasks.yaml` (`src/tasks/schema.ts`) + default global en `orchestos.config.yaml` — default absoluto: `single-shot` (cero cambio de comportamiento para todo lo existente; agéntico es opt-in).
- [ ] G.4 ⚡ Superficie en dashboard y CLI ([[feedback-dashboard-no-solo-cli]]): selector de engine en el composer de Tasks + mostrar engine e iteraciones en el detalle del run; CLI `task run --engine agentic`.
- [ ] G.5 🔍 Gate en vivo comparativo (dinero real, presupuesto acotado — decidir tope con Carlos antes): misma tarea brownfield real (editar un archivo existente de 300+ líneas de un proyecto de prueba, ej. `test-project/`) corrida con ambos engines. Medir: archivos completos vs truncados, costo USD, tokens, regresiones (diff contra lo que NO debía tocar), iteraciones del agéntico. Registrar el resultado en DONE.md — esta comparación ES la evidencia de si el giro valió.

### Cierre del mes
- [ ] H.1 🧠 Cierre formal (4 acciones obligatorias — [[feedback-orden-desarrollo]]): IDEAS→DONE, tabla de estado, PLAN.md limpio, pre-flight del mes siguiente.

### Checklist de verificación en vivo (no solo tests)
- **F1**: el prompt real del retry (no mock) contiene el motivo del fallo anterior; el primer intento no contiene el bloque.
- **F2**: un run real muestra costo QA calculado con un modelo distinto al ejecutor; config explícito `models.qa` gana sobre el default.
- **F3**: fallo de proveedor real (key inválida temporal) deja fila en `runs` visible en `runs --detail` y en el dashboard; ningún path de fallo retorna `runId` vacío.
- **F4**: un path emitido con `./` o `\` no dispara falsa violación de contrato en un run real.
- **G**: la tarea brownfield comparativa de G.5 completa con el engine agéntico sin truncar y sin tocar líneas fuera de su alcance; el single-shot sigue funcionando idéntico (regresión cero en una tarea del Mes 15).

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---
