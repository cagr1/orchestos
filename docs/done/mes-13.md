### MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

Origen: sesión de uso real 2026-06-23 + items pendientes de IDEAS.md (web fetch en chat, autoskills). Eje: romper el aislamiento — traer conocimiento externo por las vías donde el usuario interactúa (chat, skills, modelos), reusando infraestructura existente (tool-calling S23, curador/`normalizeImport` Mes 11) en vez de reconstruirla.

**BLOQUE S13.0 — Pre-flight: pulido de UI detectado en uso real**
- S13.0.1 (⚡) Edición de skills real — el botón "Editar" abría el modal read-only; ahora abre formulario editable con `PUT /api/skills/:id`, con `GET /api/skills/:id` previo (la lista trunca `instructions` a `instructionSummary`) y `id` bloqueado en modo edición — 2026-06-23
- S13.0.2 (⚡) Ícono "YAML Preview" gigante — `ICON.chev` sin regla CSS de tamaño; clase `.m-details` + `width:12px;height:12px` — 2026-06-23
- S13.0.3 (⚡) Caché de modelos OpenRouter sin invalidación — `loadOrModels()` se congelaba en la primera carga; TTL de 1h + botón Refresh manual — 2026-06-23
- S13.0.4 (🔍) Gate: `glm-5.2` apareció en el selector sin recargar la página; Refresh disparó fetch real (`orModelsLastFetch` avanzó); skills/ícono confirmados en vivo — 2026-06-23

**BLOQUE A — Web fetch real en el Chat**
- A1 (🧠) Diseño documentado en `docs/chat-web-fetch-design.md`. Hallazgo que cambió el alcance: `callWithTools()` (S23) es de un solo turno (así lo usa el planner) — no soporta conversación multi-turno ni texto+tool-call mixto. Se decidió implementar `runToolLoop()` como capa nueva, sin tocar `callWithTools`/el planner — 2026-06-23
- A2 (⚡) `runToolLoop()` en `tool-call.ts` (historial multi-turno Anthropic `tool_result` / OpenAI `role:'tool'`) + `FETCH_URL_TOOL` + wiring en `handleApiChat`, fallback intacto para Ollama/modelos sin tool-calling — 2026-06-23
- A3 (⚡) Guard SSRF (`src/dashboard/ssrf.ts`): localhost, 5 rangos privados, dominios `.local`/`.localhost`, resolución DNS de todas las IPs; cap 256 KB, timeout 10s, content-type allowlist — 2026-06-23
- A4 (🔍) Gate — **2 bugs reales encontrados solo al verificar en vivo, no por los 27 tests que ya pasaban**: (1) `checkSsrSafe` usaba `dns.resolve4()` — consulta DNS directa que falla `ECONNREFUSED` en redes que la restringen, aunque la resolución normal (la de `fetch()`) funcione ahí mismo; bloqueaba dominios públicos legítimos. Fix: `lookup(hostname, {all:true, family:4})`. (2) `executeFetchUrl` tenía un solo parámetro pero `ToolExecutor` la invoca con 2 (`toolName, input`) — JS ignoraba el extra, `input` real era el string `'fetch_url'`. Los mocks de los tests ya usaban la firma correcta, por eso ocultaban el bug. Verificado en vivo: URL real trae contenido exacto carácter por carácter, `localhost` bloqueado con mensaje verbatim, payload de prompt injection vía httpbin.org no fue obedecido por el modelo. 468 tests · 0 fail — 2026-06-23

**BLOQUE B — autoskills: skill fetch desde un registry**
- B1 (🧠) Decisión de arquitectura en `docs/autoskills-registry-design.md`: consumir el índice real de `cdn.jsdelivr.net/npm/autoskills/skills-registry/index.json` + `raw.githubusercontent.com` para contenido — `normalizeImport()` (Mes 11) ya es agnóstica al formato de entrada, se reusa sin tocar — 2026-06-23
- B2 (⚡) `orchestos skill fetch --list/--name <id>` — `fetchRegistryList()`/`fetchRegistrySkillContent()` aisladas en `src/skills/fetch.ts` — 2026-06-23
- B3 (⚡) `GET /api/skills/registry` + `POST /api/skills/registry/:id/import`, sección "Discover skills" en el dashboard con botón Import por card — 2026-06-23
- B4 (🔍) Gate — **1 bug real encontrado**: `Bun.serve()` usa `idleTimeout` de 10s por defecto; el import (fetch + normalización LLM, hasta 3 reintentos) tarda 6-14s — la conexión se cortaba antes de entregar la respuesta aunque el archivo ya se hubiera escrito (confirmado: segundo intento devolvió "Skill already exists"). Fix: `idleTimeout: 60`. Verificado en vivo: 217 skills reales listadas, `svelte5-best-practices` (description original 591 chars) importada con éxito normalizada a 97 chars, flujo completo desde la UI (Discover → Import → badge del nav 12→13) — 2026-06-23
- B5 (🧠) Fix del prompt del curador — `CURATOR_SYSTEM`/`IMPORT_SYSTEM` decían "truncate description if >200" (sugería corte mecánico). Verificado que el contenido se redistribuía bien pero `description` quedaba como resumen ("Guide for X, Y, Z") en vez de condición de disparo, rompiendo la disciplina superpowers/mattpocock. Fix: `description` ahora especifica explícitamente "Use when..." como condición de disparo, y la regla cambió a "relocate, never discard". Re-verificado: la misma skill ahora produce `description: "Use when writing, reviewing, or refactoring Svelte 5 components..."` sin perder contenido — 2026-06-23

**Decisiones de diseño Mes 13**
- Tres canales de conexión externa (chat, skills, modelos), cada uno reusando infraestructura existente — ningún motor nuevo, solo conductores nuevos sobre piezas probadas.
- `runToolLoop()` es una capa nueva sobre `callWithTools()`, no una modificación — el planner (S23) queda intacto y sin riesgo de regresión.
- Contenido externo (web fetch, registry) es siempre dato, nunca instrucción — mismo principio de boundary en todo el proyecto.
- Los gates 🔍 deben correr contra el sistema real, no solo `bun test` — los 3 bugs de Mes 13 (SSRF false-positive, arity de `executeFetchUrl`, `idleTimeout`) solo aparecieron verificando en vivo; los mocks de los tests ya tenían la forma correcta y los escondían.
- "Truncar" es la palabra equivocada para un LLM — la instrucción correcta es "redistribuir sin descartar", aprovechando que el schema de `SkillDef` ya separa el disparador (`description`/`when_to_use`) de la explicación (`instructions`).

**Lista prohibida Mes 13** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior al web fetch, hereda su patrón de tool externa segura pero añade acciones con efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- Runner de grafo autónomo — eje de autonomía interna, distinto del eje de conexión externa de este mes. Candidato Mes 14.
- `description` vacía en `GET /api/skills/registry` — `fetchRegistryList()` no la extrae del índice ni del frontmatter (requeriría N+1 fetches). Candidato Mes 14 si genera fricción real.
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 13 — SÍ (2026-06-23)**
Pre-flight de UI cerrado (edición de skills real, ícono corregido, modelos con TTL+refresh). Web fetch real en el chat con loop multi-turno (`runToolLoop`), guard SSRF correcto, transparencia de tool calls — 2 bugs reales encontrados y corregidos por verificación en vivo. Registro de skills de la comunidad (217 reales) con import vía curador, idleTimeout corregido, prompt del curador ajustado para que `description` sea condición de disparo y no resumen. 468 tests · 0 fail · tsc sin errores.

---

