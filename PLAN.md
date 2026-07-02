---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-16-cerrado--mes-17-sin-tema-oficial
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

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

**Eje decidido por Carlos (2026-07-02): IDEAS.md #15 (ejecutores externos) — primero; #12 (chat como entrada única) queda comprometido como el eje siguiente (Mes 18), en ese orden.** Ítem #15 movido acá desde IDEAS.md y eliminado de allá (regla IDEAS→PLAN→DONE).

**Tesis (revisión estratégica Fable 5, 2026-07-01, memoria `project-strategic-review-2026-07`):** el valor diferenciador de OrchestOS es la **capa de verificación** (contrato + checks + evidencia + QA + diagnose), no el ejecutor propio. Un ejecutor externo (Claude Code headless / opencode) es una tercera implementación de `ExecutorEngine` (Mes 16 G): lanzar el proceso como subproceso dentro del worktree, dejarlo trabajar, y al terminar aplicar `enforceContract` post-hoc + checks + QA sobre el diff resultante — la capa de verificación no cambia, solo el motor. Es LA jugada que convierte a OrchestOS de "runner casero que compite contra gigantes" a "la capa de confianza que los gigantes no dan".

**Por qué ahora (evidencia de G.5):** el engine agéntico interno v1 tiene riesgo de fidelidad en archivos grandes con modelos baratos (reescribe archivos completos — gpt-4o-mini omitió funciones al reproducir 419 líneas). Los ejecutores externos **editan** en vez de reescribir — el problema desaparece por diseño. El agéntico interno queda para tareas chicas/greenfield; el externo apunta a brownfield real.

**Pre-flight (2026-07-02):** F1-F4/G sin deuda abierta propia. Contexto caliente: `ExecutorEngine` (`src/run/executors/types.ts`), sandbox por worktree, patrón de gates con dinero real — todo construido esta misma semana.

### Bloque A — Diseño (ANTES de tocar código, se revisa con Carlos)
- [ ] A.1 🧠 `docs/external-executor-design.md`. Debe decidir explícitamente (las 4 decisiones pendientes anotadas al graduar la idea): (a) **cómo pasarle el contrato al ejecutor externo** — prompt vs mecanismo nativo (`--allowedTools`/settings de Claude Code; equivalente en opencode); (b) **cómo capturar costo/tokens de un proceso externo** (Claude Code headless emite JSON con usage; opencode a investigar — si no hay dato real, el costo se reporta como desconocido, NUNCA $0 silencioso — misma lección de F0.8); (c) **timeout para garantizar terminación** — mismo rol que `maxIterations` del agéntico, NO un tope de gasto (decisión G.1: OrchestOS no pone techos de dinero); (d) **qué pasa si el externo toca archivos fuera de `output[]`** — el diff del worktree se filtra por el contrato: lo autorizado se aplica, lo no autorizado se descarta con evidencia (el sandbox actual ya resuelve el discard). También decidir: ¿`claude -p` primero, opencode primero, o interface genérica `external` con adaptadores? (propuesta de partida: Claude Code primero — ya está instalado en la máquina de desarrollo y emite JSON estructurado).
- [ ] A.2 🔍 Revisión del doc con Carlos antes de abrir B.

### Bloque B — Implementación del engine
- [ ] B.1 🧠 `src/run/executors/external.ts` implementando `ExecutorEngine` según A.1: spawn del subproceso en el worktree (`effectiveRoot`), esperar con timeout, leer el diff del worktree contra el snapshot, mapear a `FileChange[]` (el harness aplica `enforceContract` post-hoc igual que siempre — cero cambio en la capa de verificación).
- [ ] B.2 ⚡ Selección: `engine: external` como tercer valor de `TaskEngine` (`tasks/schema.ts` + `config/schema.ts` + validaciones existentes de G.4 extendidas).
- [ ] B.3 ⚡ Tests: mock del subproceso (mismo patrón de inyección que la suite ya usa), contrato aplicado sobre el diff, timeout, costo desconocido reportado honesto.

### Bloque C — Superficie ([[feedback-dashboard-no-solo-cli]])
- [ ] C.1 ⚡ `external` en el selector de engine del composer de Tasks + `--engine external` en CLI + detalle del run mostrando el engine externo e info de proceso.
- [ ] C.2 ⚡ Detección honesta: si el binario externo no está instalado, error claro al seleccionar (no fallo críptico en runtime).

### Bloque D — Gate en vivo
- [ ] D.1 🔍 La misma tarea brownfield de G.5 (archivo real de 419 líneas, agregar una línea sin tocar el resto) corrida con el ejecutor externo — comparar contra los resultados registrados de single-shot y agéntico (DONE.md § MES 16 G.5). Medir: fidelidad del diff (¿editó solo la línea?), costo real, tiempo, y que `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla. Esta comparación ES la evidencia de la tesis del mes.

### Cierre del mes
- [ ] H.1 🧠 Cierre formal (4 acciones obligatorias — [[feedback-orden-desarrollo]]) + aplicar la regla nueva IDEAS→PLAN→DONE en el cierre.

**Comprometido como eje del Mes 18 (decisión Carlos 2026-07-02):** IDEAS.md #12 — chat como entrada única (detección semántica de intención de tarea). Sigue en IDEAS.md hasta que entre a PLAN.md; su primer paso es el diseño de guardrails revisado con Carlos.

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
