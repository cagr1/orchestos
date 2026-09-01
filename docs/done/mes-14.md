### MES 14 — Autonomía interna: el runner que conduce el grafo solo

Origen: candidato directo anotado en DONE.md § MES 12 y § MES 13 (IDEAS.md #9). Eje: del aislamiento (Mes 13) a la autonomía — el conductor recorre el DAG completo de `tasks.yaml` de principio a fin, decide solo retry-vs-bloqueo ante un fallo vía `diagnoseTask()`, y no se detiene globalmente porque una rama caiga. Norte: intervención humana = 0 en el happy path.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| 0 | Pre-flight — lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`, decisión de comando aditivo | ✅ SÍ |
| A | El conductor (motor) — `graph-runner.ts`, integración de `diagnoseTask`, circuit breaker | ✅ SÍ |
| A.R | Hallazgos de review local max-effort (AR.1–AR.7) | ✅ SÍ |
| B | CLI — `run --graph` + reporte de cierre con métrica de autonomía | ✅ SÍ |
| C | Superficie en el dashboard — endpoints + pantalla "Runner de grafo" + i18n | ✅ SÍ |
| D | Tests + verificación en vivo (D1 unit, D2 dashboard real, D3 e2e real) | ✅ SÍ |
| E | Cierre formal del mes | ✅ SÍ (este registro) |
| EXTRA — BACK | Catálogo + wiring de reasoning effort por modelo | ✅ SÍ |
| EXTRA — FRONT | Selector de esfuerzo en el chat + 5 bugs de UI encontrados en vivo | ✅ SÍ |
| EXTRA — visual | Auditoría `impeccable` + 10 fixes aplicados (a11y, contraste, motion, command palette) | ✅ SÍ |

**BLOQUE 0 — Pre-flight**
- 0.1 (🔍) Lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`. Hallazgos clave: `TaskStatus` ya incluía `'blocked'` (cero cambios de schema); el patrón "aislar rama, no detener el grafo" ya existía y estaba probado en `executePlan()` (`scheduler.ts`); el gap real estaba aislado en el bloque `--all` de `cli.ts` (`MAX=20` hardcoded + `break` global al primer `failed`); `diagnoseTask()` (S25) ya era 100% reusable sin cambios — solo faltaba pasar de "sugiere" a "decide" — 2026-06-23
- 0.2 (🔍) Decisión: comando nuevo `run --graph`, sin tocar `--all` (consumidores existentes — hook post-completion S30, dogfooding en E2E.md — asumen halt-on-fail) — 2026-06-23

**BLOQUE A — El conductor (motor)**
- A1 (🧠) Diseño en `docs/graph-runner-design.md`: `'blocked'` reusado sin cambios de schema, mapa `FailurePattern`→estrategia (solo `rate_limit` autoriza requeue único en memoria), el algoritmo nunca hace `break` global (único punto de parada total es el circuit breaker A4), `blockedAncestors` porta el patrón `failedIds` de `scheduler.ts` a `Task[]` — 2026-06-23
- A2 (⚡) `src/run/graph-runner.ts`: traversal topológico completo del DAG; una rama agotada bloquea sus dependientes con razón explícita y las ramas independientes continúan — 2026-06-23
- A3 (🧠/⚡) `diagnoseTask()` integrado en `executeSingleTask()`: al llegar a `failed_permanent` aplica la estrategia de A1 automáticamente, sin pedir permiso por decisión individual — 2026-06-23
- A4 (⚡) Circuit breaker en `runGraph()`: tope de costo acumulado, tope de wall-clock, tope de iteraciones (200 hard cap), `cost_notice` a $5 — 2026-06-23

**BLOQUE A.R — Hallazgos del review local max-effort (2026-06-25)**
- AR.1 quitado `sleep(200)+continue` en atascos de grafo (dep inexistente/ciclo) — corte inmediato con `circuit_break_reason` nombrando cada tarea atascada
- AR.2 `model-catalog.ts`: fallback a disco vencido marcaba `memoryFetchedAt` con el timestamp vencido en vez de `Date.now()`, causando reintentos de fetch (10s timeout) en cada tarea del grafo — fix: un solo intento real por proceso
- AR.3 `DiagnoseResult.usdCost` expuesto (antes invisible) — `graph-runner.ts` ahora lo acumula en `accCost`
- AR.4 `--max-cost 0`/`--max-minutes 0` se trataban como "sin límite" por truthiness — fix: `!= null` en los 3 checks
- AR.5 `skipped_circuit_breaker` declarado pero nunca emitido, y tareas bloqueadas transitivamente sin entry en el reporte — fix: barrido final que cubre toda tarea sin reportar
- AR.6 dos aserciones `find(...)!` que revientan con TypeError si la tarea desaparece de `tasks.yaml` en vivo — cambiadas a check explícito con `failed_permanent` y razón clara
- AR.7 `Number(pricing.prompt)` daba NaN si el string no era numérico, serializado como `null` en cache — fix: `Number.isFinite()` guard → 0
  Todos con test de regresión donde aplicaba. 468→476 tests, 0 fail.

**BLOQUE B — CLI**
- B1 (⚡) `orchestos run --graph [path] [--max-cost N] [--max-minutes N] [--dry-run]` — `--task`/`--output` pasan a opcionales (solo obligatorios en modo one-shot), `--dry-run` imprime orden topológico en capas + config del breaker sin gastar tokens — 2026-06-25
- B2 (⚡) Reporte de cierre: tabla outcome por tarea en 4 buckets (Completed alone / Retried and resolved / Branch blocked / Unfinished) + métrica de autonomía prominente (`★ autonomy: N/M`). Exit code 0 solo si 100% autónomo — 2026-06-25

**BLOQUE C — Superficie en el dashboard**
- C1 (🧠) `POST /api/run/graph` + `GET /api/run/graph/status` — runner corre in-process (no subproceso, el resultado solo existe como objeto en memoria); estado en singleton de módulo; progreso en vivo leído de `tasks.yaml`; 409 si ya hay corrida en curso. Verificado en vivo contra dashboard real (no solo mocks) — 2026-06-25
- C2 (🧠) Pantalla "Runner de grafo": botón con `confirm()` (gasta dinero real), tabla de progreso en vivo, panel de resultado en los mismos 4 buckets del CLI, auto-refresh cada 3s mientras corre — 2026-06-25
- C3 (🧠) i18n en/es real (17 claves) — reabierto y corregido el mismo día tras detectar que una corrida delegada previa había marcado `[x]` sin código real detrás (ver [[feedback-verificar-progreso-delegado]]) — 2026-06-25

**BLOQUE D — Tests + verificación en vivo**
- D1 (⚡/🧠) 11 tests unitarios de `graph-runner.ts` (happy path, branch isolation, circuit breaker, retry guiado por diagnose, edge cases). Hardening post-C1/C2: la versión original mockeaba módulos compartidos con `mock.module()`, rompiendo otros archivos de test por falta de scope por archivo — fix real: extendido el seam de inyección de `GraphRunOpts` a `loadTasksFn`/`updateTaskStatusFn` en vez de depender de orden de archivos — 2026-06-25 (ver [[reference-bun-mock-module-gotcha]])
- D2 (🔍) Gate en vivo contra dashboard real corriendo (proyecto aislado en temp dir): grafo de 4 tareas con 2 ramas falladas a propósito — confirmó que la tercera rama independiente completó sin interferencia, costo real $0.000815, `autonomy_metric: 0.25` verificado contra archivos en disco — 2026-06-25 (ver [[feedback-verificar-gates-en-vivo]])
- D3 (🔍) Smoke real end-to-end contra el `tasks.yaml` real de OrchestOS, sin supervisión. Destapó un falso positivo de QA (el harness no corría `tsc`/tests reales sin `checks:` declarados) — fix: `defaultChecksFor()` agrega checks deterministas automáticamente. Destapó un segundo bug: fallo de check no respetaba `MAX_RETRIES` — fix en `harness.ts`. Re-verificado en vivo una tercera vez: `failed_permanent` exacto en `retry=3/3`. 510 tests · 0 fail. Costo total de verificación: ~$0.04 USD. Hallazgo fuera de alcance (follow-up): `--keep-worktree` no aisló correctamente (`sandbox: worktree mode selected but no branch/task id`) — sin daño, no se tocó.

**EXTRA — Control de reasoning effort por modelo (BLOQUE BACK + FRONT, en paralelo, no bloqueó el cierre)**
- BACK.1–BACK.5: catálogo captura `supportsReasoning` desde `supported_parameters` de OpenRouter; `openrouter.ts`/`tool-call.ts` propagan `effort` opcional al body; `handleApiChat` valida y descarta en silencio si el modelo no soporta el parámetro; verificado con dinero real (3 llamadas reales a distintos modelos) — 2026-06-29
- FRONT.1–FRONT.10: selector de esfuerzo condicional al modelo, persistido en `localStorage`; combobox de modelo rediseñado con búsqueda integrada; botones de chat circulares sin triángulos; auto-grow de textarea (chat + tasks); menú de tipo de adjunto (Imagen/Documento/URL). 5 bugs reales encontrados y corregidos solo al verificar en vivo con Playwright: overlap visual selector↔refresh, placeholder multilínea inflando el auto-grow, y el más serio — `App.fetchAll()` hacía `rerender()` incondicional cada 30s, borrando silenciosamente cualquier input activo (textarea del chat, buscador de modelo) mientras el usuario escribía — 2026-06-29

**EXTRA — Pulido visual del dashboard (en paralelo, no bloqueó el cierre)**
- Auditoría real con `/impeccable audit` + `/impeccable critique` sobre `src/dashboard/public/`: Audit Health Score 12/20, Design Health Score 24/40. 2 hallazgos P1 nuevos no anticipados por el usuario: navegación por teclado rota en toda la app, contraste real que falla WCAG (`--text-faint`, `.ln.dim` de terminal) — 2026-06-25
- 10 fixes aplicados y verificados en vivo con Playwright: profundidad del compose-bar, jerarquía tipográfica (2 archivos HTML estáticos de uso avanzado, antes 5 tamaños dispersos → 2 niveles limpios), estados vacíos con tinte de accent, command palette (Cmd/Ctrl+K), navegación por teclado (`tabindex`+`role`+handler), contraste WCAG corregido (`--text-faint` 4.12:1→6.01:1, `.ln.dim` 3.31:1→4.90:1), `prefers-reduced-motion` global, CSS muerto del Kanban eliminado (~46 líneas), layout-property transitions reemplazadas por `grid-template-rows`/`opacity` — 2026-06-26
- 1 bug fuera de los 6 ítems originales, encontrado durante la verificación: loop infinito de fetch+rerender en Chat cuando falta `OPENROUTER_API_KEY` (cada fallo de `/api/chat/models` re-disparaba el fetch) — fix: flag `orModelsAttempted` que limita el auto-load a un intento por sesión — 2026-06-26
- **Nota de portabilidad de plugins**: los plugins de diseño usados acá (`impeccable`, `taste-skill`, `frontend-design`) están instalados a nivel de **usuario** en la PC donde se hizo esta auditoría (`scope: "user"`, bajo `~/.claude/plugins`) — **no viajan con `git pull`**, solo el código y `PLAN.md`/`PRODUCT.md` (commiteados) viajan. Para tenerlos disponibles en otra máquina (ej. Mac), correr en una sesión de Claude Code ahí:
  ```
  /plugin marketplace add https://github.com/pbakaus/impeccable.git
  /plugin marketplace add https://github.com/Leonxlnx/taste-skill.git
  /plugin marketplace add anthropics/claude-plugins-official

  /plugin install impeccable@impeccable
  /plugin install taste-skill@taste-skill
  /plugin install frontend-design@claude-plugins-official
  ```
  Como `PRODUCT.md` ya queda commiteado en el repo, una vez instalados los plugins ahí `/impeccable audit/critique/polish` arrancan directo, sin pedir el init de nuevo.

**Decisiones de diseño Mes 14**
- A2 (graph-runner) no fue un motor nuevo — es `executePlan()` adaptado de `SubTask[]` a `Task[]` de `tasks.yaml`, reduciendo el riesgo porque el patrón cascada-y-continúa ya estaba en producción desde Mes 5.
- `run --graph` es aditivo, no reemplaza `--all` — evita un cambio de comportamiento silencioso sobre consumidores existentes.
- Los gates 🔍 deben correr contra el dashboard/CLI real con dinero real cuando aplica — D2/D3/BACK.5/FRONT.4 encontraron bugs reales (falso positivo de QA, check sin tope de retry, loop de rerender) que ningún mock había mostrado.
- `mock.module()` sin scope por archivo es un riesgo estructural de la suite — D1 lo resolvió con inyección de dependencias real en vez de depender de orden de archivos; ver [[reference-bun-mock-module-gotcha]] (riesgo similar detectado y corregido post-cierre en `diagnose.test.ts`/`memory-judge.test.ts` mockeando `fetch` en vez del módulo).
- El trabajo EXTRA (reasoning effort, pulido visual) corrió en paralelo sin bloquear el cierre del eje central del mes — mismo patrón que permitió cerrar Mes 14 sin deuda acumulada.

**Lista prohibida Mes 14** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior, con acciones de efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- `description` vacía en `GET /api/skills/registry` — sigue sin resolver desde Mes 13, no generó fricción real todavía.
- OCR para imágenes adjuntas + adjuntar varios archivos a la vez ("Folder") — el estado del chat solo soporta un archivo a la vez; soportar varios es un cambio de modelo de datos, no un ajuste de menú (anotado en IDEAS.md #13).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono/dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 14 — SÍ (2026-06-29)**
`orchestos run --graph` recorre un `tasks.yaml` real completo sin intervención humana en el happy path; ante un fallo, bloquea solo la rama afectada (las independientes completan) y la decisión retry/bloqueo la toma diagnose, no el humano. Verificado en vivo en el dashboard (D2) y en el CLI real contra el `tasks.yaml` de producción del propio proyecto (D3), no solo en tests. 518 tests · 0 fail · `tsc --noEmit` limpio.

---

### Fixes post-cierre Mes 14, pre-Mes 15 (2026-06-29) — dogfooding real del flujo chat→tarea

Origen: Carlos probó en vivo el flujo "pedir algo por el chat → se crea una tarea → correrla" usando como caso real un pedido de prototipos de rediseño visual del dashboard (ver IDEAS.md, pendiente de tema oficial para Mes 15). Cada bug de abajo se encontró usando el sistema real, no leyendo código en frío — mismo principio que [[feedback-verificar-gates-en-vivo]].

**Bug 1 — prompt/parser desincronizados en el one-shot `run --task --output` (cli.ts)**
El system prompt de este path le decía al modelo que respondiera en JSON (`{"files":[...]}`), pero `parseLLMResponse` (`contract.ts`) solo entiende el formato de delimitadores `<<<FILE:path>>>...<<<ENDFILE>>>` — el mismo que ya usaba correctamente el path de `tasks.yaml`/`--graph` (`run/prompt.ts`). Rompía **cualquier** tarea one-shot, no solo el caso de prueba. Fix: alineado el prompt de `cli.ts` al formato de delimitadores real.

**Bug 2 — `max_tokens: 8192` hardcodeado en los 3 providers, sin relación con el tope real del modelo**
Generar un mockup HTML+CSS+JS completo se cortaba a mitad de archivo porque 8192 tokens de salida no alcanzan para ningún modelo "premium" de verdad — y el código no tenía forma de saberlo, porque nunca leía el dato real. Mismo principio ya aplicado a `contextLength` en `model-catalog.ts` ("el motor no debe adivinar la ventana de un modelo"): se extendió a tokens de salida. `ModelInfo.maxOutputTokens` ahora captura `top_provider.max_completion_tokens` (publicado por OpenRouter), con `maxOutputTokensFor(modelId)` síncrono (fallback `DEFAULT_MAX_OUTPUT_TOKENS=8192` si el modelo no está en catálogo). `openrouter.ts:chat()` acepta `maxTokens?` opcional; `cli.ts` lo resuelve vía `ensureCatalogLoaded()` antes de cada llamada. Decisión explícita de Carlos: no es aceptable "simplemente subir el número" sin atarlo al dato real por modelo — la alerta debe ser siempre por modelo, nunca un valor fijo adivinado.
Provider/harness genérico (`run/harness.ts`, usado por `tasks.yaml`/`--graph` vía `ProviderClient`) queda **fuera de este fix** — mezclar el catálogo de OpenRouter (no aplica igual a Anthropic/OpenAI directos) ahí es un cambio más grande, anotado como deuda conocida, no resuelto todavía.

**Bug 3 — el más serio: una excepción en la resolución de sandbox tumbaba el proceso de `task run` sin dejar rastro**
`resolveSandboxMode()` (`sandbox-policy.ts`) lanza si el working tree tiene cambios sin commitear y el modo resuelto es `worktree` — pero esa llamada, junto con `createWorktree()` y el spec-gate, vivían **fuera** del `try/catch` de `runTask()` (`harness.ts`). Cualquier excepción ahí crasheaba el subproceso entero, sin pasar por el catch-all ya documentado ("S9.4 — nunca lanza"). Síntoma real observado: una tarea creada desde el chat (`crear-web-local-comercial`) quedó en `status: running` para siempre — sin fila en `runs`, sin diagnóstico, solo un `START` suelto en el log de la corrida. Causa concreta de esa instancia: el repo tenía cambios sin commitear (los fixes 1 y 2, todavía no commiteados) cuando se disparó la tarea desde el dashboard. Fix: el `try` ahora envuelve el spec-gate + resolución de sandbox + creación de worktree, así cualquier error ahí mapea a `status:'failed'` (con razón legible) en vez de tumbar el proceso. 2 tests existentes (`spec.test.ts`, "harness spec gate") actualizados — antes esperaban `rejects.toThrow()`, ahora correctamente esperan `result.status === 'failed'`, consistente con el invariante ya documentado de que `runTask()` nunca debe lanzar. Tarea huérfana liberada manualmente de vuelta a `pending` en `tasks.yaml`.

**Bug 4 — el toggle de "Diagnose" en Tasks no volvía a colapsar**
`screens-core.js`: la flecha ▲/▼ que reemplaza al link "Diagnose" una vez cacheado el resultado se renderizaba **sin** el atributo `data-diag` (solo el link inicial lo tenía) — el handler de toggle ya existía y funcionaba bien, pero nunca se conectaba a la flecha. El click caía al handler de la fila (abría el side-panel) en vez de colapsar el detalle inline. Fix: la flecha ahora también lleva `data-diag`. Verificado en vivo con Playwright contra el dashboard real: 1er click abre (`detail-row` visible), 2do click colapsa (`detail-row` desaparece) — confirmado vía `classList`, no solo visualmente.

**Bug 5 — el refresh del dashboard siempre caía en Settings, nunca en Chat**
`app.js` redirigía a Settings ("Control Center") cada vez que `attentionCount > 0` — pero ese contador (`setup.ts`) suma `unverifiedInstincts + draftSpecs`, backlogs pasivos de revisión que casi siempre son > 0 en uso normal (99 instincts sin revisar en este caso). Esto pisaba silenciosamente la decisión ya tomada en Mes 14 EXTRA ("Chat convertido en pantalla principal") en cada recarga. Fix: el redirect urgente ahora solo dispara con `blockedTasks.length > 0` (trabajo real atascado) o el umbral de costo semanal — instincts/specs pendientes ya tienen su propio badge en el nav, no necesitan secuestrar la pantalla de inicio. Verificado en vivo con Playwright: con `blockedTasks: []` real, el refresh ahora aterriza en Chat (`heading "Chat"` + composer visibles).

**Decisión de diseño**: ningún fix de este bloque consumió generación de contenido por LLM para probarse — los 5 son debugging real sobre estado ya producido (logs, DB, tasks.yaml, dashboard en vivo), siguiendo la regla explícita de Carlos de esta sesión: tareas de generación-y-prueba-iterativa las corre él mismo por CLI para no quemar cuota de Claude; debugging de bugs reales sí lo hace Claude.

**Hallazgo abierto, anotado en IDEAS.md (no resuelto)**: la auditoría de paridad CLI↔Dashboard — varias capacidades del CLI (`spec approve/lint/archive`, `instinct set-confidence/propose`, `task run --explain/--clarify`, `skill build`, `detect/init/index`, `runs --analyze` manual) no tienen ningún botón/endpoint equivalente en el dashboard. Ver IDEAS.md #9b.

518 tests · 0 fail · `tsc --noEmit` limpio en cada fix.

---

