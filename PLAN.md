---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: v0.13-abierto--que-orchestos-entregue-un-producto-premium
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 22 (v0.13) — Que OrchestOS entregue de verdad un producto premium: cerrar C.2

**Eje decidido por Carlos (2026-07-15):** primero que *entregue* algo real, luego las
modificaciones de UI. El norte vuelve a la pregunta que Mes 20 dejó abierta a propósito
— *"¿puede OrchestOS entregar un producto premium?"* — que sigue sin respuesta con dato
real ([DONE.md](DONE.md) § Mes 20/C.2). Las modificaciones (P1: #43 panel IDE embebido,
papercuts #40/#36/#27/#14) quedan **explícitamente pospuestas** hasta después de esta
corrida — no se abren en este Mes.

**Prerequisitos duros para la corrida cara (Bloque C), ambos declarados en el pre-flight
de v0.12:** (1) Bloque A — #32 resuelto; (2) Bloque B — decisión de modelo por Carlos.
No abrir C sin los dos verdes.

### Bloque A — 🧠 #32: presupuesto de outputs de tools en el executor agéntico (prerequisito)

Eslabón defectuoso verificado (IDEAS.md #32): en `src/run/executors/agentic.ts`, `read_file`
devuelve el archivo completo sin cap y `run_check` mete stdout/stderr enteros al historial;
nada trunca outputs de tools antes de `messages[]` → un archivo grande o check verboso infla
el prompt hasta que `contextWindow − prompt` no da para maxTokens → `pending` automático. Es
el mismo modo de fallo que pausó C.2.

- [x] **A.1 — 🧠 (2026-07-15)** `capToolOutput()`: módulo nativo TS (sin deps) con cap duro por
  tool-result (25k chars default) + marcador `[...truncado: N chars omitidos de M]`.
  [src/run/tool-output-cap.ts](src/run/tool-output-cap.ts).
- [x] **A.2 — 🧠 (2026-07-15)** `capCheckOutput()`: truncado cabeza+cola para stdout/stderr de
  `run_check` (los errores viven al final, no solo la cabeza). Mismo archivo. 7 tests · 0 fail ·
  `tsc --noEmit` limpio.
- [x] **A.3 — ⚡ (2026-07-15)** Wiring: `capToolOutput()` inyectado en los 4 tools de
  `agentic.ts` (read_file/write_file/list_dir con `capToolOutput`, run_check con
  `capCheckOutput` para preservar stderr al final) y en el `executeTool` del chat
  (executeFetchUrl/executeSearchMemory y el helper `readProjectTextFile` que cubre
  read_plan/read_tasks/read_ideas/read_file). 7 tests del módulo (A.1+A.2) +
  7 tests nuevos por punto de inyección (4 en `agentic-tool-cap.test.ts`,
  1 en `chat-fetch-url.test.ts`, 2 en `chat-read-project-tools.test.ts`).
  Hallazgo real del integration test: `checks.ts:7 OUTPUT_LIMIT=2_000` ya trunca
  cada stream con `tail()` antes de salir del check — el capCheckOutput del
  executor queda como defensa en profundidad (no dispara en la práctica),
  documentado en el test. 725 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **A.4 — 🔍 (2026-07-15)** Gate causal cerrado. Test en
  [agentic-tool-cap.test.ts](src/__tests__/agentic-tool-cap.test.ts) que prueba con las MISMAS
  funciones que el motor usa para presupuestar (`estimateTokens`/`contextWindowFor`), no umbrales
  inventados: (control) el `read_file` crudo de un archivo dimensionado a `contextWindow*4+50k`
  chars supera la ventana del modelo → es la condición exacta de `pending`/overflow de #32;
  (con cap) el `messages[]` REAL capturado de la ronda siguiente estima por debajo de la ventana,
  con el tool-result bajo `contextWindow/4` → queda margen de sobra para el output (lo que #32
  decía que se perdía: `contextWindow−prompt < maxTokens`). Evidencia = request capturado, no
  `[x]` de reporte ([[feedback-verificar-progreso-delegado]]). 726 tests · 0 fail · `tsc` limpio.
  **Matiz honesto**: el loop agéntico (`runToolLoop`) no emite un status `pending` propio dentro
  del loop — usa un `maxTokens` fijo por ronda; el `pending` formal vive en el pre-check del
  harness (`harness.ts:287`). El gate prueba la causa raíz común (contexto acumulado que revienta
  la ventana), que es el fallo que #32 describe, no un literal `status==='pending'` dentro del loop.
- [x] **A.5 — ⚡ (excepción: Claude implementa por orden explícita de Carlos, 2026-07-16)**
  #36: `defaultChecksFor` ahora valida sintaxis de JS embebido en `.html` y standalone `.js`
  vía `node --check` sobre el código extraído. Cierra el gap real que dejó pasar el bug de
  Mes 20/C.1 (`:` en vez de `+` en `sortIcon()` dentro de un `<script>` inline). Detalle y
  evidencia en [DONE.md § A.5](DONE.md).
  Módulo nuevo: [src/run/html-script-check.ts](src/run/html-script-check.ts) — extractor de
  `<script>` (whitelist de `type=` JS para evitar falsos positivos sobre JSON/templates), wires
  en [src/run/checks.ts](src/run/checks.ts). **Importante**: los checks de sintaxis JS NO están
  gateados por `node_modules` (a diferencia de `tsc`/`bun test` que ya lo estaban) — `node
  --check` solo parsea, sin resolver imports. 22 tests nuevos (11 del módulo + 11 del wiring,
  incluyendo 3 integration tests que prueban end-to-end que el bug de C.1 ahora se detecta).
  748 tests · 0 fail · `tsc --noEmit` limpio.

### Bloque B — 🧠 GATE DE CARLOS: decisión de modelo para la corrida

**No lo decide ningún LLM ni se arrastra de memoria** ([[feedback-modelo-decision-final-carlos]],
incidente de $5.00 quemados). El modelo de la corrida C.2 es el de `orchestos.config.yaml` o el
que Carlos indique en el momento. Este bloque está VERDE solo cuando Carlos lo confirma
explícitamente en el turno de la corrida.

- [x] **B.1 — 🧠 Carlos (2026-07-16)** Modelo confirmado explícitamente por Carlos: tal cual
  `orchestos.config.yaml` — executor `deepseek/deepseek-v4-flash`, QA `anthropic/claude-haiku-4-5`.
  La corrida C.1 la ejecuta Carlos mismo desde el dashboard (no CLI) para observar el proceso real.

**Nota — no bloquea este Mes (2026-07-15):** Carlos planteó una idea de arquitectura mayor —
cascada de selección Local (LLM local) → CLI (Orca/OpenCode/Claude Code, corre contra la cuenta ya
pagada del usuario) → API (OpenRouter, último recurso, la que más gasta) — inspirada en Orca.
Anotada completa en [IDEAS.md #44](IDEAS.md), P3, gated en #39 (generalizar `engine: external` a
más binarios) + una decisión explícita de Carlos aún pendiente por la tensión con
[[feedback-modelo-decision-final-carlos]] (cascada automática vs. "el modelo/engine siempre lo
decide Carlos, nunca un LLM"). No se toca código de esto hasta esa decisión.

### Bloque C — 🔍 Reabrir C.2: dashboard premium multi-archivo con dinero real

Solo con A y B en verde. Es el gate original y más exigente del Mes 20: dashboard premium
multi-archivo (React+TS+Vite), motor agéntico + auto-split (S22 + Mes 20), contratos y
verificación por sub-tarea. Responde con dato real la pregunta de producto.

- [ ] **C.1 — 🔍** Corrida real de la tarea premium multi-archivo, gate con dinero real (mismo
  patrón G.5/Mes 14/Mes 17). Registrar costo, veredicto QA y el entregable abierto de verdad en
  el navegador (no confiar solo en checks — el bug de C.1 solo apareció abriendo la página).
- [ ] **C.2 — 🔍** Verdicto honesto: ¿entregó un producto premium usable end-to-end? Sí/No con
  evidencia. Todo bug real destapado en el camino se convierte en ítem antes de tocar código
  (regla de documentación obligatoria).

---

## v0.12 (MES 21) — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

- [x] **SÍ — v0.12 cerrado (2026-07-14)**
  Higiene de datos (borrado masivo en 5 tablas + cero diálogos nativos, absorbe IDEAS #18), Chat con Markdown/sanitizador propio + chips de task/modelo clicables, visor de diff por run calculado por contenido (no `git diff` post-hoc), y auditoría real de paridad CLI↔dashboard con 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) y verificados independientemente contra código real ([[feedback-verificar-progreso-delegado]]). Nacen 4 reglas de diseño fijas para toda pantalla nueva (anclaje de elementos fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS). Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

- [x] **PARCIAL — Mes 20 cerrado formalmente (2026-07-14), con un gate abierto a propósito**
  Auto-split (el gatillo automático que le faltaba al motor de sub-tareas) diseñado, implementado y con superficie de aprobación en dashboard — el usuario ve y aprueba el plan de sub-tareas antes de gastar. Probado con éxito en un entregable simple end-to-end (`crypto-page-v1`, gate 🔍 con dinero real). **El gate original y más exigente (C.2, dashboard premium multi-archivo React+TS+Vite) sigue PAUSADO** por decisión explícita de alcance de Carlos — gated en 2 prerequisitos concretos: decisión de modelo ([[feedback-modelo-decision-final-carlos]], nacida de un incidente de $5.00 quemados este mismo mes) y presupuesto de outputs de tools del executor agéntico (IDEAS.md #32). Candidato de pre-flight del próximo milestone (ver abajo). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual, no snapshot del mes).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

- [x] **SÍ — Mes 19 cerrado (2026-07-09)**
  El chat lee imágenes con cualquier modelo vía OCR local (`tesseract.js`, sin dependencia de que el modelo elegido tenga visión), soporta múltiples adjuntos (`st.chatFiles[]`, límite 5), y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection en una imagen (el modelo lo ignoró). `task_class: ocr` diferido sin evidencia de caso de uso interno — vuelve a IDEAS.md #30. 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## Pre-flight — gap conocido antes de abrir el próximo milestone

**Mes 20/C.2 sigue abierto** (dashboard premium multi-archivo, React+TS+Vite+Three.js) — la pregunta original de Carlos ("¿puede OrchestOS entregar un producto premium?") no tiene respuesta con dato real todavía. No reabrir sin: (1) decisión explícita de modelo de Carlos para la corrida ([[feedback-modelo-decision-final-carlos]]), y (2) IDEAS.md #32 (presupuesto de outputs de tools en el executor agéntico) resuelto primero. **Próximo milestone: por decidir con Carlos** — candidatos en [IDEAS.md § 🗺️ Mapa de prioridad](IDEAS.md), tramo P1 (acabado/papercuts) o retomar C.2 si los 2 prerequisitos ya están cubiertos.

---

## MES 18 — Chat como entrada única: detección de intención de tarea

- [x] **SÍ — Mes 18 cerrado (2026-07-09)**
  Chat con detección semántica de intención de tarea activada con evidencia real (34 mensajes reales, falso negativo confirmado y corregido — Bloque J), paridad CLI↔Dashboard cerrada (9/9 gaps, Bloque E), auto-selección de skill por dominio (Bloque D), auditoría visual + 13 ajustes "premium dashboard" con causa raíz real en cada uno (Bloques G/I), y 2 bugs reales de producción encontrados y corregidos por dogfooding directo de Carlos (imágenes sin gating de visión, guard de contexto no conectado al chat). 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Mes 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Mes 14/Mes 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Mes 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Mes 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

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
