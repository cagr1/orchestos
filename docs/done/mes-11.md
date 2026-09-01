### MES 11 — OrchestOS como experto: autoría de skills con curador

**BLOQUE A — API backend de skills**
- A1 (⚡) `GET /api/skills` — lee `skills/*.yaml`, valida con `validateSkill()`, devuelve lista — 2026-06-09
- A2 (⚡) `GET /api/skills/:id` — devuelve un skill o 404 — 2026-06-09
- A3 (⚡) `POST /api/skills` — valida, escribe `skills/{id}.yaml`, rechaza duplicados — 2026-06-09
- A4 (⚡) `PUT /api/skills/:id` — sobreescribe YAML existente, revalida antes de persistir — 2026-06-09
- A5 (⚡) `DELETE /api/skills/:id` — requiere `{ confirm: true }` en el body — 2026-06-09
- A6 (⚡) `POST /api/skills/:id/build` — ejecuta `compileSkill()`, devuelve paths de artefactos — 2026-06-09

**BLOQUE B — Pantalla Skills en el dashboard**
- B1 (⚡) Ruta `/skills` en el nav con badge de conteo — 2026-06-09
- B2 (⚡) Vista lista: cards con nombre, descripción, targets como badges, botones Editar/Exportar/Borrar — 2026-06-09
- B3 (⚡) Modal de detalle con todos los campos del `SkillDef` (instrucciones, verifiers, examples…) — 2026-06-09
- B4 (⚡) Confirmación de borrado inline (no prompt del browser) — 2026-06-09
- B5 (⚡) Botones flotantes "Nueva skill" e "Importar" en la cabecera — 2026-06-09

**BLOQUE C — Curador LLM**
- C1 (🧠) System prompt del curador: extrae `id`, `name`, `description`, `instructions`, `targets`, `when_to_use`, `anti_patterns`, `verifiers` desde lenguaje natural — 2026-06-09
- C2 (⚡) `POST /api/skills/curate` — `{ text }` → LLM (Haiku) → `SkillDef` parcial sin guardar — 2026-06-09
- C3 (⚡) Gate de validación: hasta 2 reintentos si `validateSkill()` falla — 2026-06-09
- C4 (🔍) Review: 5 descripciones (técnica, vaga, es, en, multi-paso) — 5/5 útil sin editar, iter=1 en todos, encoding UTF-8 correcto — 2026-06-09

**BLOQUE D — Puerta Escribir**
- D1 (⚡) Textarea "Describe tu skill en lenguaje natural" + botón "Curar con IA" — 2026-06-09
- D2 (⚡) Pre-rellena formulario editable con los campos generados por el curador — 2026-06-09
- D3 (⚡) Preview del YAML resultante antes de guardar — 2026-06-09
- D4 (⚡) "Guardar" → `POST /api/skills`, cierra modal, refresca lista — 2026-06-09

**BLOQUE E — Puerta Importar**
- E1 (⚡) Sub-tab URL: fetch del YAML crudo → normaliza con curador si faltan campos → preview — 2026-06-09
- E2 (⚡) Sub-tab YAML pegado: `validateSkill()` → curador normaliza si falla → preview — 2026-06-09
- E3 (⚡) Preview compartido con warnings de normalización — 2026-06-09
- E4 (⚡) "Importar" → `POST /api/skills`, maneja conflicto de id (ofrece renombrar) — 2026-06-09

**BLOQUE F — Puerta Exportar**
- F1 (⚡) Botón "Exportar YAML" → `GET /api/skills/:id/export`, descarga `{id}.yaml` — 2026-06-09
- F2 (⚡) Botón "Copiar YAML" al portapapeles (mismo contenido que F1) — 2026-06-09
- F3 (⚡) `GET /api/skills/:id/export` — devuelve YAML con `Content-Disposition: attachment` — 2026-06-09

**BLOQUE G — Pack "pro" de ingeniería**
- G1 (🧠) Selección y escritura de 8 skills "pro": `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen` — 2026-06-10
- G2 (🧠) Cada skill validado con `validateSkill()` y probado en una tarea real — 8/8 OK — 2026-06-10
- G3 (⚡) Sección "Skills recomendados" en la pantalla Skills con botón "Importar" — 2026-06-10
- G4 (⚡) YAMLs en `skills/pro/` (separado de `skills/`) — `listSkillFiles()` no recorre subdirectorios, sin colisión — 2026-06-10
- G5 (🔍) Review del pack: `/api/skills/pro` y `/api/skills/pro/:id/import` probados (list, import, conflicto 409); `code-review` importado y ejecutado en `run --dry-run`, guidelines inyectadas correctamente; 369 tests · 0 fail · tsc sin errores — 2026-06-10

**BLOQUE H — CLI: curate e import**
- H1 (⚡) `orchestos skill curate "<descripción>"` — llama al curador vía API, imprime YAML draft; `--save` guarda directamente — 2026-06-10
- H2 (⚡) `orchestos skill import <url>` — fetch + normalización + guarda en `skills/`, reusa el endpoint E1 — 2026-06-10
- H3 (⚡) Tests unitarios de los comandos CLI con mock de la API — 2026-06-10

**BLOQUE I — Tests y cierre**
- I1 (⚡) Unit tests del curador con LLM mockeado: happy path (iter=1), JSON inválido en los 3 intentos (422), recuperación en retry (iter=2), error/timeout (502), `text` faltante (400) — 2026-06-10
- I2 (⚡) Integration tests A1-A6, F3 y pack pro (`GET /api/skills/pro`, `POST /api/skills/pro/:id/import`) vía `route()` exportado de `server.ts`, fixtures temporales limpiadas en `afterEach` — 2026-06-10
- I3 (⚡) 402 tests · 0 fail — incluye fix de mock incompleto en `diagnose.test.ts` que rompía `saveTasks` al cargar `server.ts` — 2026-06-10
- I4 (🔍) Gate final: dashboard up (`/` 200), `GET /api/skills/pro` 200 (8 skills), export 200 con `Content-Disposition: attachment`, `skill curate` contra dashboard real produjo YAML válido sin `--save`, servidor detenido sin artefactos sueltos, tsc sin errores — 2026-06-10

**Decisiones de diseño Mes 11**
- `SkillDef` YAML propio sigue siendo la fuente de verdad — agentskills.io es puerto de entrada/salida en el borde, nunca formato central.
- Curador único con tres puertas (escribir/importar/exportar) — un solo pipeline de normalización a `SkillDef`, no tres distintos.
- Pack "pro" vive en `skills/pro/` (no `skills/`) para no colisionar con las skills del usuario; `listSkillFiles()` no recorre subdirectorios.
- `description`/`when_to_use` como condiciones de disparo ("Use when…"), nunca workflow — disciplina heredada de superpowers/mattpocock.
- Curador con hasta 2 reintentos antes de fallar — balance entre robustez y costo de LLM calls.

**Lista prohibida Mes 11** _(lo que NO se hizo — referencia histórica)_
- Endurecimiento "Iron Law / Common Rationalizations / Red Flags" en skills existentes — espera evidencia de uso del pack pro.
- `brainstorming`/planning socrático (superpowers `writing-plans` + mattpocock `grill-me`) — candidato fuerte para Mes 12.
- `verification-before-completion` y par `requesting/receiving-code-review` — quedan en backlog.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 11 — SÍ (2026-06-10)**
Pantalla Skills completa en el dashboard (galería + crear + importar + exportar). Curador LLM (`/api/skills/curate`) normaliza lenguaje natural a `SkillDef` válido con retry — 5/5 descripciones de prueba útiles sin editar. Tres puertas operativas: escribir (curador + preview), importar (URL/YAML + normalización + warnings), exportar (download/copiar con `Content-Disposition`). Pack "pro" de 8 skills de ingeniería en `skills/pro/`, importables con un click, 8/8 validados y probados. CLI `skill curate`/`skill import` con paridad del dashboard. 402 tests · 0 fail · tsc sin errores.

---

