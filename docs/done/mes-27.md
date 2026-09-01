## MES 27 — Backlog canónico, categoría Bajo-medio (abierto 2026-08-10, cerrado 2026-08-13)

Este Mes ejecutó la categoría **Bajo-medio** de IDEAS.md: `#4`, `#30`, `#33`, `#37`, `#51`. Mismo
orden de índice = único orden de ejecución (regla desde 2026-07-30).

**`#4` y `#30` verificadas y saltadas antes de tocar código (2026-08-10)** — ambas tienen su propio
gate explícito en el texto de la idea, y ninguna lo cumple hoy:
- `#4` (clasificador semántico para `clarify`): *"Solo vale la pena si hay evidencia de falsos
  negativos."* Grep de `needsClarify`/incidentes en DONE.md/PLAN.md: cero evidencia. Verificado
  además en código que hoy `needsClarify()` solo decide si se muestra un banner de advertencia en
  `orchestos task run --clarify` (comando manual, opt-in) — no gatea nada automático, mucho menos
  consecuente que lo que la idea describe.
- `#30` (`task_class: ocr`): *"diferido explícitamente por Carlos (2026-07-09) por falta de caso de
  uso real dentro de OrchestOS mismo."* El caso de uso real es CitasBot, proyecto aparte. Sin
  evidencia nueva de que cambió.

Ninguna de las dos se eliminó de IDEAS.md — seguir sin evidencia no es lo mismo que resolver.

### Bloque X — 🧠 IDEAS #33: refuter en el QA loop — segunda opinión barata antes de quemar un retry

**Lo que pedía la idea**: cuando `runQA()` da `fail`, una segunda llamada barata decide si el
hallazgo es real (`CONFIRMED`, consume el retry) o un error del juez (`REFUTED`, pasa) — antes de
gastar un retry completo (executor + QA de nuevo). Mirror asimétrico de K.4b (que hace lo mismo
para el lado `pass`, opt-in, catch de falsos-positivos); esto ataca falsos-negativos.

**Evidencia verificada, no asumida**: `DONE.md` (gate D.1, Mes 17, dinero real) — *"El QA-LLM dio un
falso negativo sobre un diff objetivamente correcto"*. Incidente real, no hipotético. Verificado
también que `qa.verdict === 'fail'` solo se consume en **un** punto de `harness.ts` (línea 639) —
la nota original de la idea decía "2 puntos", desactualizada.

- [x] **X.1 — 🧠 `runRefuter()` en `qa.ts`.** (2026-08-10) Mismo patrón que `runAdversarialQA()` (K.4b): recibe
  la descripción, criterios, archivos escritos, checks y el veredicto/razón del `fail` original;
  devuelve `{ verdict: 'CONFIRMED' | 'REFUTED', reason, inputTokens, outputTokens, model }`.
  **Fail-safe en la dirección opuesta a K.4b a propósito**: una respuesta no parseable o ambigua
  debe caer en `CONFIRMED` (el fail original se sostiene, se consume el retry) — nunca en
  `REFUTED` (dejar pasar sería el error que este ítem existe para evitar, no para reintroducir del
  otro lado).
- [x] **X.2 — 🧠 Wiring en `harness.ts`.** (2026-08-10) Nuevo flag `refuterQA?: boolean` en `OrcheConfig`
  (`config/schema.ts`), opt-in — mismo criterio de "Carlos decide el costo explícito" que
  `adversarialQA`. Cuando `qa.verdict === 'fail'` (línea 639) y `orcheConfig?.refuterQA`, llamar
  `runRefuter()` ANTES del bloque de revert/retry: `REFUTED` → tratar como `pass` (mismo path de
  éxito, sin consumir `retry_count`); `CONFIRMED` → seguir el path de fail normal, sin cambios.
  Persistir el veredicto del refuter en `runs` (columna nueva, mismo patrón que
  `adversarial_verdict`/`adversarial_reason` de K.4b — no reusar esas dos, son ejes distintos:
  uno vigila falsos-positivos, el otro falsos-negativos, y verlos mezclados en un dashboard futuro
  sería engañoso).
- [x] **X.3 — 🔍** (2026-08-10) Sin `OPENROUTER_API_KEY` en esa shell — no había LLM real disponible
  para un control pagado end-to-end. Gate ejecutado al mismo nivel de rigor que el propio gate de
  K.4b (LEDGER 2026-07-28: *"destrabado con evidencia sintética real... no por decisión de
  saltarlo"*): `src/__tests__/harness-refuter-qa.test.ts`, 4 tests que corren `runTask()` completo
  (no `qa.ts` aislado) contra un `fetch` mockeado por llamada, cubriendo el ciclo real del harness
  — executor → QA fail → refuter → decisión: (1) desactivado por default, 2 fetch calls, sin
  refuter; (2) `REFUTED` sube `qa_verdict` a `pass`, `status: 'done'`, sin retry consumido; (3)
  **control**: `CONFIRMED` sostiene el fail, `status: 'failed'`, retry consumido normalmente; (4)
  el refuter NO corre si el QA normal ya dio pass. Los 4 verifican columnas `refuter_verdict`/
  `refuter_reason` persistidas via `getRun()` contra la DB real (no mock de DB). Runs de prueba
  borrados en `afterAll` (`task_id = 'x2-refuter'`). `bun run test:coverage`: 1122 pass · 0 fail
  (eran 1111, +11: 7 en `qa-core.test.ts` + 4 en `harness-refuter-qa.test.ts`) · `tsc --noEmit`
  limpio.

### Bloque Y — 🧠 IDEAS #37: modo "empezar gratis" — badge + preset de modelos `:free`

**Lo que pedía la idea**: superficie para el onboarding cero-costo — (1) marcar/filtrar modelos
`:free` de OpenRouter en el selector con badge "Free"; (2) un preset que fije los roles
(`planner`/`executor_*`/`default`) a modelos `:free` por defecto. Verificado en el propio texto de
la idea: **no** requiere motor nuevo ni dependencia externa (Codebuff/Freebuff se descartaron como
proveedor en la investigación de origen) — es solo mejor uso del catálogo de OpenRouter que
OrchestOS ya consume (`priceIn`/`priceOut` en `model-catalog.ts`).

- [x] **Y.1 — ⚡ Badge "Free" en el combo de modelos.** (2026-08-10) `buildComboOptions()`
  (app.js) — por `id.endsWith(':free')`, NO por `priceIn === 0`: verificado en vivo contra el
  catálogo real de OpenRouter que los meta-routers sin pricing (`openrouter/auto*`,
  `openrouter/fusion`, `openrouter/pareto-code`) también caen en precio 0/negativo y NO son
  gratis — badgearlos habría sido un falso "Free". Nueva clave i18n `chat.models.free`
  (en/es) + clase CSS `.model-combo-price.free`.
- [x] **Y.2 — 🧠 Bug real encontrado al verificar en vivo: la selección de rol en Model routing
  se revertía en silencio.** (2026-08-10) Antes de construir el preset, probé manualmente elegir
  un modelo distinto para el rol Planner en Settings → Model routing (Playwright contra el
  dashboard real, puerto 4242) — el valor volvía al anterior de inmediato. Causa: el click
  handler genérico de `buildModelSelect` (app.js) muta el input oculto vía DOM y dispara
  `App.rerender()`, que reemplaza `#main.innerHTML` por completo; `routingPanel()`
  (screens-ops.js) recalculaba `val` desde `cfg.roles[role]` (estado del servidor, sin cambios
  hasta Guardar) en cada render, pisando la elección recién hecha. Bug preexistente, no
  introducido por esta sesión — nadie lo había reportado porque nadie probó seleccionar y
  esperar el rerender sin guardar de inmediato. **Fix**: `routingPanel()` ahora prefiere el
  valor vivo del input oculto en el DOM (todavía presente en el momento en que el string HTML se
  arma, antes del reemplazo) sobre `cfg.roles[role]`, sin estado global nuevo. Sin este fix el
  preset de Y.3 tampoco habría sobrevivido su propio `App.rerender()`.
- [x] **Y.3 — ⚡ Preset "Empezar gratis".** (2026-08-10) Botón nuevo en el footer de "Roles"
  (Settings → Model routing) — filtra `st.orModels` por `:free`, ordena por `contextK`
  descendente, aplica el mejor a los 4 roles (`planner`/`executor_heavy`/`executor_light`/
  `default`). **No auto-guarda** — mismo patrón de Guardar explícito que el resto del panel
  (consistente con el fix de U.1 de Mes 26: mover foco sin persistir es la clase de bug que
  ese Bloque ya cerró). Sin id de modelo hardcodeado — el catálogo `:free` de OpenRouter cambia
  con el tiempo.
- [x] **Y.4 — 🔍** (2026-08-10) Verificado en vivo contra el dashboard real (puerto 4242,
  `OPENROUTER_API_KEY` configurada en esa máquina — catálogo real, no fixture): (1) badge
  "Free" visible solo en modelos `:free` reales (confirmado contra 200+ opciones del catálogo
  real, incluyendo los meta-routers que NO llevan badge); (2) selección manual de rol ya no se
  revierte (Y.2, antes/después comparado); (3) click en "Empezar gratis" pobló los 4 roles con
  `nvidia/nemotron-3-ultra-550b-a55b:free` (el `:free` de mayor contexto disponible en ese
  momento) + toast de confirmación, sin tocar `orchestos.config.yaml` (verificado con `cat` antes
  y después — el preset no llegó a Guardar, como diseñado). Servidor de dashboard bajado al
  terminar. `tsc --noEmit` limpio; `bun run test:coverage`: 1122 pass · 0 fail (sin cambio — este
  Bloque es JS de dashboard sin harness de test unitario, mismo criterio que otros cambios de UI
  de este Mes; la verificación real es la corrida en vivo de arriba).

### Bloque Z — ⚡ IDEAS #51 (parcial): acciones por mensaje en el chat (copiar + timestamp)

**Lo que pedía la idea**: hover-reveal en cada burbuja (usuario Y asistente) con **copiar**,
**rebobinar** y **timestamp**. El propio texto de la idea gatea "rebobinar" explícitamente:
*"encaja mejor DESPUÉS de #50, no antes"* (sesiones persistentes en SQLite) — verificado que `#50`
sigue sin implementar en IDEAS.md (no graduado). **Alcance de este Bloque: copiar + timestamp
únicamente** — "rebobinar" quedó fuera, no por evitar trabajo sino porque la propia idea dice que
rebobinar una conversación que solo vive en memoria JS (`state.chatHistory`, sin persistencia
todavía) no tiene el mismo sentido. `#51` **no se graduó completo** de IDEAS.md — queda anotado
como parcial hasta que `#50` desbloquee el resto.

- [x] **Z.1 — ⚡ Botón "copiar" + timestamp por mensaje, hover-reveal.** (2026-08-12)
  `screens-core.js` (`SCREENS.chat`): `ts: Date.now()` en los 4 sitios donde se hace
  `chatHistory.push()` (mensaje de usuario, respuesta ok, error de servidor, error de conexión).
  Markup nuevo `.chat-msg-col` (envuelve burbuja + fila de acciones, mismo lado que ya definía
  `justify-content` en `.chat-msg`) + `.chat-msg-actions` (oculto por default, visible en
  `:hover`/`:focus-within` — mismo patrón que `.modal-scrim`/`.local-model-warn` ya usan en
  `screens.css`). Copiar por índice contra `st.chatHistory[i].content` (no por atributo HTML) para
  no depender de re-escapar mensajes largos en un `data-*`. Reusa `ICON.copy`/`ICON.check` de
  `data.js`, mismo patrón visual que el `data-copy` de E.8 (panel de diagnosis, Mes 22) pero con su
  propio handler — ese vive en `SCREENS.tasks.wire()`, otro screen. 2 claves i18n nuevas
  (`chat.copyErr`, en/es).
- [x] **Z.2 — parked.** `#51` dejó fuera "rebobinar" — no fue un ítem de este Bloque, ver nota de
  scope arriba. Sin sub-tarea porque no había trabajo que hacer hasta que `#50` exista.
- [x] **Z.3 — 🔍** (2026-08-12) Verificado en vivo contra el dashboard real (puerto 4242,
  Playwright): mensaje enviado → burbuja de usuario y respuesta del asistente muestran ambas su
  fila de acciones oculta (`opacity:0` confirmado por `getComputedStyle`); hover sobre `.chat-msg`
  → `opacity:1`; click en copiar → ícono cambia a check (mismo revert temporal que el patrón
  existente) — verificación por swap de ícono, no por leer el portapapeles (headless Playwright
  cuelga esperando el permiso de lectura de `navigator.clipboard.readText()`, gap conocido de la
  herramienta, no del código). Alineación correcta a cada lado (`chat-msg-col` con
  `align-items: flex-end` en usuario, `flex-start` en asistente) confirmada por captura de
  pantalla. **Efecto secundario encontrado y limpiado**: el mensaje de prueba disparó
  auto-creación de una tarea real (`ping-test`) en `tasks.yaml` — sin runs asociados en la DB
  (nunca llegó a ejecutar), removida a mano antes de cerrar el Bloque. Servidor de dashboard
  bajado al terminar. `tsc --noEmit` limpio; `bun run test:coverage`: 1122 pass · 0 fail (sin
  cambio — mismo criterio que Y: JS de dashboard sin harness de test unitario, la verificación
  real es la corrida en vivo).

**Mes 27 cierra parcial: `#33` y `#37` completos, `#51` parcial (rebobinar bloqueado por `#50`,
sin implementar), `#4` y `#30` siguen parqueados en IDEAS.md sin evidencia. La categoría
Bajo-medio del backlog canónico NO queda en cero — a diferencia del cierre de Bajo (Mes 26), acá
quedan 3 remanentes explícitos y documentados, no deuda oculta.**

---

