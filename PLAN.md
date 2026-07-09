---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-18-cerrado--mes-19-abierto
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

## MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

**Eje decidido por Carlos (2026-07-09), graduado de IDEAS.md #13 y #24 en el cierre del Mes 18 (regla IDEAS→PLAN→DONE) — ítems eliminados de allá.**

**Origen**: durante el dogfooding del Mes 18 (Bloque J), Carlos subió una imagen de referencia al chat y "no cargó" — J.2 corrigió el síntoma (ahora rechaza con 422 claro si el modelo no tiene visión, en vez de fallar en silencio), pero la dependencia de fondo sigue: la imagen solo sirve si el usuario eligió un modelo con visión, y la mayoría de los baratos (DeepSeek, Llama) no la tienen. El OCR mata esa dependencia de raíz: extraer el texto de la imagen y mandarlo como contexto de texto plano funciona con **cualquier** modelo. Decisión explícita de Carlos (2026-07-09): "no depender del modelo — que sí o sí lea todo, independiente del modelo".

**Qué ya existe (NO reconstruir)**:
- Gating de visión (Mes 18 J.2): `supportsVision` en `ModelInfo` (`model-catalog.ts`, leído de `architecture.input_modalities` de OpenRouter) + rechazo 422 con mensaje claro en `handleApiChat` antes de mandar el `image_url` block. **El OCR es el camino alternativo cuando ese gate rechaza** — no un reemplazo del gate: con modelo de visión la imagen sigue yendo directa como `image_url`, con modelo de solo texto entra el OCR.
- Upload de un solo archivo: `POST /api/chat/upload` (un archivo por request), estado singular `st.chatFileId`/`st.chatFileMeta` (`app.js:59`), chip de adjunto singular en el composer (`screens-core.js:93`). PDF/txt/md ya extraen texto (Mes 9, D1-D5) — el gap de lectura es solo imágenes.
- Pipeline de tareas formales: `task_class` en el schema, harness → QA → SQLite — el output del OCR entra ahí como texto normal, sin rama especial.

**El gap real, en dos capas separadas (mismo principio que Mes 18 — no mezclarlas)**:
1. **Múltiples adjuntos** (ex-#13 gap 2) — el estado del chat solo soporta UN archivo. Subir 2+ requiere: (a) estado como array de adjuntos, (b) decidir upload secuencial (N requests al endpoint existente) vs batch (endpoint nuevo multipart), (c) UI para listar/quitar cada adjunto individualmente. Es un cambio de modelo de datos del chat, deliberadamente separado del rediseño de UI del menú de adjuntar (2026-06-29).
2. **OCR** (ex-#13 gap 1 + ex-#24) — motor que convierte imagen → texto. Independiente de la capa 1 (opera sobre cualquier imagen ya adjunta), pero la capa 1 es la base de UI/estado que ambos comparten.

**Repo de referencia (dado por Carlos)**: https://github.com/baidu/Unlimited-OCR — verificado real vía `gh api` (2026-06-29): Python, licencia **MIT**, ~11.9K⭐, activo. **No leído todavía** — regla innegociable de este mes: leer el código real ANTES de decidir la integración, no asumir nada de su arquitectura. Por ser MIT, reusar su código es legal pero **exige atribución real** — documentar el origen en el archivo/commit que lo introduce, no es opcional (es parte de la licencia).

**Decisión de integración abierta (se resuelve en A.1, no antes)**: el motor es Python — fricción con el stack Bun/TS. Las opciones que A.1 debe evaluar contra el código real del repo: (a) API remota (HuggingFace Spaces / Baidu Cloud, sin GPU propia ni runtime local — lo que ex-#24 sugería), (b) subproceso Python local (sin red, pero agrega runtime y dependencias al setup), (c) otro motor OCR si al leer el repo resulta que no encaja. No decidir por adelantado.

**Reglas de seguridad/diseño innegociables**:
1. El texto extraído por OCR de una imagen es **dato externo, nunca instrucción** — mismo wrapper/boundary ya probado con `fetch_url` (Mes 13): una imagen con texto malicioso no debe poder inyectar instrucciones al modelo.
2. El OCR **nunca degrada en silencio** — si el motor falla o no está disponible, el usuario ve un aviso claro (mismo principio que el 422 de J.2), no una respuesta del modelo que ignoró la imagen.
3. Costo visible: si el OCR usa una API remota con costo, se registra en `runs` como cualquier otro gasto — nunca `$0` silencioso (regla F0.8).

**Pre-flight (2026-07-09):** Mes 18 cerrado sin deuda bloqueante propia. Hallazgos abiertos heredados (backlog, no bloquean este mes): IDEAS.md #19 (`engine: external` sin `checks:` explícitos pierde su red determinista), IDEAS.md #29 (`commitTopicKey`/memoria de sub-tasks casi nunca se dispara en la práctica — hallazgo de I.6).

### Bloque A — Leer el repo real + diseño (ANTES de tocar código, se revisa con Carlos)
- [x] A.1 🧠 (2026-07-09) Leído el código real de `baidu/Unlimited-OCR` (`gh api`, README completo) — **corrige la premisa original de IDEAS #13/#24**: no es una librería liviana, es un modelo de visión-lenguaje que solo corre self-hosted vía `transformers`+CUDA o servidor vLLM/SGLang — requiere GPU propia, descartado para OrchestOS (Bun/TS local, sin GPU). Único camino sin GPU (Baidu Cloud API, `aip.baidubce.com`) verificado real vía su documentación oficial, pero descartado en A.2. Diseño completo en [docs/ocr-chat-design.md](../docs/ocr-chat-design.md).
- [x] A.2 🔍 (2026-07-09) Revisión con Carlos — **Baidu Cloud rechazado** (panel en chino, fricción de registro; "que después no se complique el uso de OCR"). Motor elegido: **`tesseract.js`** (verificado real vía `gh api`: Apache-2.0, JS, 38.1K★, activo) — wrapper WASM del motor Tesseract, corre en el mismo proceso Bun sin GPU/Python/cuenta externa. Diseño actualizado en [docs/ocr-chat-design.md](../docs/ocr-chat-design.md) §(a)/(b). Confirmado: Bloque D se difiere (sin caso de uso real interno), orden B→C (múltiples adjuntos antes que OCR).

### Bloque B — Múltiples adjuntos (base de UI/estado, independiente del OCR)
- [ ] B.1 🧠 Estado del chat como array de adjuntos (`st.chatFiles[]` en vez de `chatFileId`/`chatFileMeta` singular) + decisión secuencial vs batch para el upload (propuesta: secuencial contra el endpoint existente, sin endpoint nuevo, salvo que A.1 encuentre razón en contra).
- [ ] B.2 ⚡ UI: chips por adjunto con quitar individual, límite razonable de adjuntos por mensaje, i18n en/es de los textos nuevos.
- [ ] B.3 ⚡ `handleApiChat` acepta N adjuntos en el payload — cada imagen pasa por el mismo gating de visión de J.2 (o su evolución OCR del Bloque C).

### Bloque C — OCR en el chat (`tesseract.js`, decidido en A.2)
- [ ] C.1 🧠 `bun add tesseract.js` + integración: imagen + modelo sin visión → `createWorker('eng'+'spa')`/`recognize()` → texto extraído como contexto envuelto como dato (wrapper "dato externo", ver diseño §c). Worker creado una vez y reusado, no por mensaje.
- [ ] C.2 ⚡ Superficie: el usuario ve que la imagen fue leída por OCR (transparencia, mismo principio que "qué URLs se fetchearon" del Mes 13) + aviso claro si el OCR falla.
- [ ] C.3 🔍 Gate en vivo con dinero real: la misma imagen que falló en el dogfooding del Mes 18, con un modelo de solo texto (DeepSeek) → el chat responde usando el contenido real de la imagen. Control de seguridad: imagen con texto de prompt injection → el modelo no obedece.

### Bloque D — `task_class: ocr` (ex-#24) — DIFERIDO (decisión A.2, 2026-07-09)
Sin caso de uso real interno a OrchestOS (el ejemplo original era CitasBot, proyecto separado) — vuelve a IDEAS.md, se implementa si aparece evidencia concreta.

### Cierre del mes
- [ ] H.1 🧠 Cierre formal (4 acciones obligatorias — [[feedback-orden-desarrollo]]) + aplicar la regla IDEAS→PLAN→DONE en el cierre.

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
