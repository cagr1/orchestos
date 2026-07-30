---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-25-activo--pendientes-heredados-de-los-cierres-22-24
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

## MES 25 — Pendientes heredados de los cierres 22–24

Este mes conserva pendientes reales que no se cierran por arrastre documental (cada uno mantiene su procedencia y evidencia completa en [DONE.md](DONE.md)) **y, desde 2026-07-30, abre la ejecución del backlog canónico por esfuerzo de [IDEAS.md](IDEAS.md)** — el orden ahí es el único orden de ejecución, y al graduar una idea se elimina de IDEAS.md en el mismo commit (regla de flujo IDEAS→PLAN→DONE).

**Tabla de estado del proyecto (2026-07-29)**

| Mes | Bloques | Estado |
| --- | --- | --- |
| Mes 22 / v0.13 | A–K | ✅ Cerrado formalmente, sin pendientes |
| Mes 23 | L | ⏳ L.5.7 cerrado (2026-07-30); L.6.2 sigue abierto |
| Mes 24 | M | ✅ Cerrado formalmente, sin pendientes (resueltos 2026-07-30) |
| Mes 25 | Pendientes heredados | ⏳ Activo |

### Pendientes explícitos

- [x] **K.6.2-R7 — Endurecimiento de comportamientos críticos (cerrado 2026-07-30).** Carlos aceptó `51.76%` como baseline funcional de `qa.ts`, re-verificado por Claude corriendo `mutation:qa` en limpio: confirma que ningún sobreviviente altera lógica de veredicto. Historial completo: [DONE.md § Mes 22](DONE.md).
- [x] **L.5.7 — Linaje versionado y rollback de migraciones (cerrado 2026-07-30).** L.5.7.1–L.5.7.7 estaban documentados y verificados; solo faltaba marcar el ítem contenedor. Historial completo: [DONE.md § Mes 23](DONE.md).
- [ ] **L.6.2 — Gate manual de seguridad.** Procede de Mes 23. Falta revisión visual con navegador y los flujos manuales de ejecución, worktree, diagnóstico y exportación; además Carlos debe decidir mitigación o aceptación de `L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validar). No corregirlos fuera de un ítem explícito.
- [x] **M — Provisioning de roadmaps para proyectos nuevos (cerrado 2026-07-30, decisión Carlos: centralizado, no copiado).** Carlos decidió que `docs/roadmaps/{engineering-baseline,disciplines,languages}` NO viaja copiado a cada proyecto — es conocimiento de OrchestOS, centralizado, y cualquier proyecto que gestione lo lee desde ahí. `project-profile.md` es la única excepción (describe el repo detectado, sigue siendo por proyecto, nunca cae al fallback). Implementado: `src/detect/roadmap-profile.ts` (`findLanguageDoc`/`docExists` ahora prueban `root` primero y caen a `ROADMAP_DOCS_ROOT`, la instalación de OrchestOS vía `import.meta.dir`) y `src/roadmaps/context.ts` (mismo fallback en `readBounded()` para el contenido, nunca para `profilePath`). Verificado en vivo con un proyecto Rust real sin `docs/roadmaps/` propio: `Lenguaje: Rust` pasa a `known`/`selected` con contenido real; `project-profile.md` correctamente ausente. Tests actualizados (2 nuevos, 2 reescritos con C# como caso "verdaderamente missing" ya que Rust/Go/TS ahora resuelven por fallback). 1013 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **M — Presupuesto de contexto de roadmaps (cerrado 2026-07-30).** Verificado en vivo antes de tocar código: `loadRoadmapContext()` corrido contra este mismo repo confirmó que el presupuesto de 12.000 chars SÍ se agotaba en producción (11.781/12.000, omitiendo `architecture`, `ai-agents` y el lenguaje TypeScript — el principal de OrchestOS). El total real necesario sin truncar es ~22.800 chars; los archivos individuales más grandes (`backend.md` 3.407, `typescript-bun.md` 3.711) ya excedían el tope por-documento de 3.000. Subidos `MAX_TOTAL_CHARS` 12.000→26.000 y `MAX_DOC_CHARS` 3.000→4.000 en [src/roadmaps/context.ts](src/roadmaps/context.ts). Reverificado en vivo: 22.962 chars, cero truncado, las 6 disciplinas + TypeScript + Rust entran completos.

### Bloque N — 🧠 IDEAS #1: endurecimiento de skills (Iron Law / Common Rationalizations / Red Flags)

Primer ítem del backlog canónico de IDEAS.md (categoría **Mínimo**, graduado 2026-07-30). Origen:
delta pendiente de [obra/superpowers](https://github.com/obra/superpowers) y
[mattpocock/skills](https://github.com/mattpocock/skills) — el curador + pack "pro" ya está
shipeado (Mes 11). El objetivo real no es "más contenido": es que una skill **se respete bajo
presión** en vez de ignorarse cuando el agente encuentra una excusa para saltársela.

**Corrección de alcance sobre IDEAS #1 (verificada en código, 2026-07-30):** la idea afirmaba
*"Esfuerzo: mínimo — autoría + paso por la puerta importar. Sin código."* — **es falso**.
`buildSections()` ([src/skills/targets/_shared.ts:3](src/skills/targets/_shared.ts)) es el ÚNICO
renderer skill→prompt y solo conoce 6 campos (`instructions`, `when_to_use`, `inputs_required`,
`anti_patterns`, `verifiers`, `examples` + `language_targets`); `SkillDef`
([src/skills/registry.ts:18](src/skills/registry.ts)) tampoco declara los campos nuevos, y
`validateSkill()` no es strict — **un `iron_law:` en el YAML cargaría sin error y jamás llegaría al
LLM**. Autoría sin wiring = contenido muerto. Por eso el bloque arranca por el contrato, no por el
contenido. Sigue siendo un bloque chico, pero no es cero código.

- [ ] **N.1 — 🧠** Extender el contrato de skill en
  [src/skills/registry.ts](src/skills/registry.ts): `iron_law?: string` (la regla innegociable, una
  sola), `common_rationalizations?: { excuse: string; refutation: string }[]` (la excusa que el
  agente se dice + su refutación — el par es el punto, una lista plana de excusas sin refutar sería
  darle munición), `red_flags?: string[]`. Añadir validación en `validateSkill()` con el mismo
  patrón de los campos existentes (tipos, arrays no vacíos, `excuse`/`refutation` ambos presentes) y
  un cap de longitud para `iron_law` (es una regla, no un párrafo). Tests de validación.
- [ ] **N.2 — 🧠** Renderizar los 3 campos en `buildSections()`
  ([src/skills/targets/_shared.ts](src/skills/targets/_shared.ts)) con **orden deliberado, no
  append al final**: `iron_law` va **antes** de `instructions` (hoy `sections[0]` es
  `skill.instructions` — cambiarlo afecta el prompt de las 24 skills existentes, es el punto del
  ítem: la regla innegociable se lee primero, no sepultada); `common_rationalizations` y
  `red_flags` van **después** de `anti_patterns` (son su escalón siguiente: anti_patterns dice qué
  no hacer, rationalizations dice con qué excusa te lo vas a permitir). Verificar los 3 targets
  (`claude`/`cursor`/`openai`) — comparten `_shared.ts`, confirmar que ninguno reordene por su
  cuenta. Tests de render.
- [ ] **N.3 — 🧠** Enseñar los campos nuevos a la **puerta importar del curador**
  ([src/dashboard/prompts/curator.ts](src/dashboard/prompts/curator.ts), líneas ~17 y ~45 describen
  el contrato al LLM): sin esto, toda skill importada de ahora en adelante nace sin `iron_law` y el
  endurecimiento solo aplicaría a lo ya existente — la puerta por la que IDEAS #1 decía que esto
  entra quedaría desalineada del contrato real.
- [ ] **N.4 — ⚡** Superficie en dashboard (regla [[feedback-dashboard-no-solo-cli]]): los 3 campos
  en el detalle de skill y en el formulario de creación/edición
  ([src/dashboard/public/app.js](src/dashboard/public/app.js) ~936/949/1076/1131/1146/1250) +
  claves i18n **en inglés y español** ([src/dashboard/public/i18n.js](src/dashboard/public/i18n.js)
  ~499/544/1255/1300). `common_rationalizations` es el único par excusa/refutación — decidir su
  edición (dos columnas o `excusa :: refutación` por línea), no forzarlo al `listField` plano de
  los demás.
- [ ] **N.5 — ⚡** Autoría del contenido: `iron_law` + `common_rationalizations` + `red_flags` en
  las skills existentes (16 en `skills/` + 8 en `skills/pro/`). **Decisión pendiente de Carlos
  antes de arrancar este ítem**: ¿las 24, o solo aquellas donde la presión de saltarse la skill es
  real y ya documentada? Recomendación (no aplicada sin su OK): empezar por `tdd-enforcer`,
  `security-review`, `qa-structured`, `test-writer` y `frontend-design` — son las que un ejecutor
  barato tiene más incentivo a esquivar (escribir el test después, "el linter ya lo cubre", "se ve
  bien así"), y `test-writer`/`qa-structured` conectan directo con el antipatrón que persigue
  [IDEAS.md #54](IDEAS.md) (tests que pasan vacíamente).
- [ ] **N.6 — 🔍** Gate: verificar contra el **prompt real compilado**, no contra el YAML — que el
  `iron_law` aparece antes de las instrucciones en la salida de `buildSections()` para una skill
  endurecida, en los 3 targets, y que una skill sin los campos nuevos compila idéntico a como
  compilaba antes (cero regresión sobre las skills no tocadas). Verificación en vivo en el
  dashboard de N.4 ([[feedback-verificar-gates-en-vivo]]), no solo `bun test`. Cerrar con conteo de
  tests + `tsc --noEmit` limpio.

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
