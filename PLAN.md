---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-11-activo
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**:
- 🧠 = Claude implementa — requiere criterio arquitectural o decisión de diseño
- ⚡ = DeepSeek implementa — tarea bien especificada, ejecuta leyendo el plan
- 🔍 = revisión obligatoria por Claude — gate antes de cerrar el sprint, independiente de quién implementó

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

Prerequisitos verificados al entrar: dashboard Mes 10 ✅ · wizard API key ✅ · toggle humano/operador ✅ · Control Center ✅ · chat con archivos ✅.

Eje del mes: **el producto trae su propio criterio de ingeniería y permite al usuario ampliar ese criterio sin salir del dashboard** — tres puertas (escribir · importar · exportar) + pack "pro" absorbido vía la puerta importar.

Estado actual de skills: archivos YAML en `skills/`, cargados por CLI y harness, sin superficie en dashboard. El mes añade API + pantalla + curador LLM.

---

### Bloque A — API backend de skills (⚡)

Exponer las skills como recurso REST del servidor. Fuente de verdad: archivos `skills/*.yaml`.

- [x] A1 `GET /api/skills` — lee `skills/*.yaml`, valida con `validateSkill()`, devuelve lista (2026-06-09)
- [x] A2 `GET /api/skills/:id` — devuelve un skill o 404 (2026-06-09)
- [x] A3 `POST /api/skills` — recibe `SkillDef`, valida, escribe `skills/{id}.yaml`, rechaza duplicados (2026-06-09)
- [x] A4 `PUT /api/skills/:id` — sobreescribe YAML existente, revalida antes de persistir (2026-06-09)
- [x] A5 `DELETE /api/skills/:id` — borra el YAML (pide confirmación en el body: `{ confirm: true }`) (2026-06-09)
- [x] A6 `POST /api/skills/:id/build` — ejecuta `compileSkill()`, devuelve paths de los artefactos (2026-06-09)

---

### Bloque B — Pantalla Skills en el dashboard (⚡)

Nueva vista `/skills`. Misma estructura visual que las pantallas existentes (Runs, Memory, Specs).

- [x] B1 Ruta `/skills` en el nav — badge con conteo de skills (similar al badge de Runs) (2026-06-09)
- [x] B2 Vista lista: cards con nombre, descripción, targets como badges, botones Editar/Exportar/Borrar (2026-06-09)
- [x] B3 Modal de detalle: muestra todos los campos del `SkillDef` (instrucciones, verifiers, examples…) (2026-06-09)
- [x] B4 Confirmación de borrado inline (no prompt del browser) (2026-06-09)
- [x] B5 Botones flotantes "Nueva skill" e "Importar" en la cabecera de la vista (2026-06-09)

---

### Bloque C — Curador LLM (🧠)

Servicio que transforma texto libre del usuario en un `SkillDef` válido. Núcleo del mes.

- [x] C1 Diseño del system prompt del curador: extrae `id`, `name`, `description`, `instructions`, `targets`, `when_to_use`, `anti_patterns`, `verifiers` desde lenguaje natural (2026-06-09)
- [x] C2 `POST /api/skills/curate` — recibe `{ text: string }`, llama al LLM (Haiku), devuelve `SkillDef` parcial sin guardar (2026-06-09)
- [x] C3 Gate de validación: si el output no pasa `validateSkill()`, el curador itera hasta 2 veces antes de devolver error (2026-06-09)
- [x] C4 🔍 Review calidad: probar con 5 descripciones distintas (técnica, vaga, en español, en inglés, multi-paso) — el output debe ser útil sin edición manual (2026-06-09) — 5/5 útil sin editar, iter=1 en todos, encoding UTF-8 correcto

---

### Bloque D — Puerta Escribir (⚡)

Modal "Nueva skill" con asistencia del curador.

- [x] D1 Campo textarea "Describe tu skill en lenguaje natural" + botón "Curar con IA" (2026-06-09)
- [x] D2 Al curar: pre-rellena formulario con los campos generados (editables por el usuario) (2026-06-09)
- [x] D3 Preview del YAML resultante antes de guardar (2026-06-09)
- [x] D4 Botón "Guardar" → llama `POST /api/skills`, cierra modal, refresca lista (2026-06-09)

---

### Bloque E — Puerta Importar (⚡)

Modal con dos sub-tabs: URL y YAML pegado.

- [x] E1 Sub-tab URL: campo de URL → el servidor hace fetch del YAML crudo → valida/normaliza con curador si hay campos faltantes → preview (2026-06-09)
- [x] E2 Sub-tab YAML: textarea de paste directo → `validateSkill()` → curador normaliza si falla → preview (2026-06-09)
- [x] E3 Preview compartido: muestra campos del `SkillDef` y cualquier warning de normalización (2026-06-09)
- [x] E4 Botón "Importar" → llama `POST /api/skills`, maneja conflicto de id (ofrece renombrar) (2026-06-09)

---

### Bloque F — Puerta Exportar (⚡)

Exportación desde cada skill card.

- [x] F1 Botón "Exportar YAML" en el card → `GET /api/skills/:id/export` → download del `.yaml` con nombre `{id}.yaml` (2026-06-09)
- [x] F2 Botón "Copiar YAML" → clipboard (mismo contenido que F1) (2026-06-09)
- [x] F3 `GET /api/skills/:id/export` — endpoint que devuelve el YAML con `Content-Disposition: attachment` (2026-06-09)

---

### Bloque G — Pack "pro" de ingeniería (🧠)

Skills curados listos para importar con un click. Absorbido vía la puerta Importar.

- [ ] G1 Selección y escritura de 8 skills "pro": `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen`
- [ ] G2 Cada skill validado con `validateSkill()` y probado en una tarea real antes de incluir
- [ ] G3 Sección "Skills recomendados" en la pantalla Skills — lista estática con descripción y botón "Importar"
- [ ] G4 Los YAMLs del pack viven en `skills/pro/` (no en `skills/` para evitar conflictos con los del usuario)
- [ ] G5 🔍 Review del pack: cada skill pro ejecutado en al menos una tarea, output revisado manualmente

---

### Bloque H — CLI: curate e import (⚡)

Paridad CLI del curador e importación.

- [ ] H1 `orchestos skill curate "<descripción>"` — llama al curador vía API, imprime YAML draft. Flag `--save` guarda directamente
- [ ] H2 `orchestos skill import <url>` — fetch + normalización + guarda en `skills/`. Reusa el endpoint E1
- [ ] H3 Tests unitarios de los nuevos comandos CLI (mock de la API)

---

### Bloque I — Tests y cierre (⚡ + 🔍)

- [ ] I1 Unit tests del curador con respuestas LLM mockeadas (happy path + output malformado + timeout)
- [ ] I2 Integration tests de los endpoints A1–A6, F3 y `/api/skills/curate`
- [ ] I3 Contador de tests ≥ 380 · 0 fail
- [ ] I4 🔍 Gate final: smoke completo en dashboard — tres puertas funcionando, pack visible, exportar descarga, CLI curate produce YAML válido. Actualizar DONE.md · PLAN.md · IDEAS.md antes de cerrar.

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
