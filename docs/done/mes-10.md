### MES 10 — El producto que alguien que nunca programó puede usar

**BLOQUE A — Diagnóstico de fallos en el dashboard**
- A1 (🧠) Diseño: endpoint `GET /api/tasks/:id/diagnose` → `DiagnoseResult`, on-demand con botón "Ver diagnóstico" — no auto-call en background — 2026-06-04
- A2 (⚡) `GET /api/tasks/:id/diagnose` en `server.ts` — llama `diagnoseTask(id, root)`, devuelve JSON — 2026-06-04
- A3 (⚡) Panel inline en Tasks: chip "Ver diagnóstico" en fila `failed` → expand con pattern · confidence (Alta/Media/Baja) · suggestion · details — 2026-06-04
- A4 (⚡) Botón "Reintentar" → `POST /api/tasks/:id/run`; botón "Convertir en hábito" → `POST /api/instincts` con trigger+action del diagnóstico — 2026-06-04
- A5 (🔍) Gate: 3 defectos corregidos — pattern crudo→humano (7 valores `FailurePattern`), `patternLabels` incompleto (faltaban `context_overflow` y `unknown`), `habitTrigger` genérico→incluye ID de tarea — 2026-06-04

**BLOQUE B — Vista editable de "lo que OrchestOS sabe del proyecto"**
- B1 (🧠) Diseño: textarea libre con helper text, auto-save debounce 1s, CONTEXT.md read-only + botón Regenerar — 2026-06-04
- B2 (⚡) `GET/PUT /api/project/constitution` · `GET /api/project/context` · `POST /api/project/context/regenerate` — 2026-06-04
- B3 (⚡) Pantalla "Proyecto": tabs "Guía del agente" / "Contexto comprimido", auto-save + indicador idle/saving/saved/error, Regenerar con re-fetch 1.5s — 2026-06-04
- B4 (⚡) Nav actualizado (entre Memory e Instincts), i18n 13 claves en/es, CSRF guard extendido a PUT, `ICON.project` — 2026-06-04
- B5 (🔍) Gate: PUT escribe a `join(resolve('.'), 'CONSTITUTION.md')` (mismo path que usa el harness), auto-save ✓, regenerate ✓, typecheck verde — 2026-06-04

**BLOQUE C — Control Center: Setup → salud continua**
- C1 (🧠) Diseño 5 secciones: sistema (prerequisitos), tareas bloqueadas, aprobación pendiente, costo 7d, últimos aprendizajes. Contratos de 5 endpoints — 2026-06-04
- C2 (⚡) `GET /api/health` — 5 bloques desde SQLite: checklist, `failed_permanent` no diagnosticados, unverified+draft, `sum(cost_usd 7d)`, últimos 5 instincts auto — 2026-06-04
- C3 (⚡) I2/Setup extendida: checklist superior + 5 bloques de salud con semáforo + auto-refresh 30s + links directos a pantalla relevante — 2026-06-04
- C4 (⚡) Pantalla de inicio adaptativa: `attentionCount > 0 || cost > threshold` → settings; sin atención + `advanced` → runs; normal → tasks — 2026-06-04
- C5 (🔍) Gate: 1 defecto corregido (auto-refresh 30s faltaba en C3). 5 bloques + semáforo + `data-nav+data-filter` + i18n en/es ✓ — 2026-06-04

**BLOQUE D0 — Detección de modelos locales (Ollama)**
- D0-1 (🧠) Diseño: `GET /api/providers/local`, `state.localModels`, prefijo `ollama/`, executor `'ollama'`, warning dismissible `sessionStorage`, system prompt diferenciado — 2026-06-04
- D0-2 (⚡) `GET /api/providers/local` — probe `localhost:11434/api/tags` con AbortSignal 1s, devuelve `{ available, models }` — 2026-06-04
- D0-3 (⚡) Selector: `loadLocalModels()`, optgroup "Local (Ollama)", warning dismissible. i18n 3 claves en/es — 2026-06-04
- D0-4 (⚡) `inferExecutorFromModel` rama `/^ollama\//`, `ollamaChat()` → `localhost:11434/v1/chat/completions`, `handleApiChat` ramifica por executor — 2026-06-04
- D0-5 (🔍) Gate: `/api/providers/local` devuelve modelos ✓, chat via `ollama/qwen2.5-coder:7b` funcional ✓, cloud sin cambios ✓ — 2026-06-04

**BLOQUE D0-ext — Mejoras UX al selector y Settings Ollama**
- D0-ext-1 (⚡) Locales primero en selector + buscador en tiempo real `buildModelOpts()` con `withSearch=true` solo en chat. XSS seguro — 2026-06-04
- D0-ext-2 (⚡) Settings Ollama: badge "Detected/Not detected" por probe real (no por env var), input "Override URL (opcional)" para Ollama remoto — 2026-06-04

**BLOQUE D — Archivos como input en Chat**
- D1 (🧠) Diseño: FormData multipart, pipeline por tipo (imagen→base64, PDF→texto regex, texto→directo), límite 10MB, fallback si provider sin visión — 2026-06-04
- D2 (⚡) `POST /api/chat/upload` — almacenamiento en memoria (expira al cerrar sesión), PDF→texto con regex sobre buffer, imagen→base64 — 2026-06-04
- D3 (⚡) Botón clip 📎 en chat, chip del archivo sobre input, `fileId` en POST, backend inyecta como `image_url` o bloque de texto precediendo la pregunta — 2026-06-04
- D4 (⚡) "Crear tarea desde esta conversación" tras 3+ mensajes, pre-fill con últimos 3 mensajes del usuario (no el volcado completo) — 2026-06-04
- D5 (🔍) Gate: PDF 2 páginas extraído ✓, imagen descrita por visión ✓, seed 152 chars accionables vs 236 del volcado ✓ — 2026-06-04

**BLOQUE E — Wizard API key: resolver el muro del cold-start**
- E1 (🧠) Diseño: trigger desde checklist ("Configurar ahora") + Settings ("Cambiar clave"), `Modal.openWizard()`, 3 pasos, rollback solo en 401, key nunca en logs ni response — 2026-06-04
- E2 (⚡) `POST /api/setup/api-key` — `writeEnv` existente (merge), test call `max_tokens:1`, errores→mensajes humanos, rollback 401, tipo `ApiKeyValidationResponse` — 2026-06-04
- E3 (⚡) `Modal.openWizard()` + `Modal._renderWizard()` — 3 pasos, dots indicator, toggle ver/ocultar, spinner. i18n 24 claves en/es — 2026-06-04
- E4 (⚡) Trigger desde I2 (action `open-wizard`) + Settings (botón "Cambiar clave"). Éxito: `App.fetchAll()` + toast — 2026-06-04
- E5 (🔍) Gate: wizard 3 proveedores ✓, 3 pasos ✓, wire `data-open-wizard` → `Modal.openWizard()` ✓, i18n en/es ✓ — 2026-06-04

**BLOQUE F — Superficie humano vs operador**
- F1 (🧠) Diseño: `operator:true` en runs/memory/specs, `localStorage('orchestos-mode')`, `buildNav()`, `ICON.sliders`, `.nav-mode-btn`, badge `adv`, transición opacity 250ms, redirect al desactivar desde pantalla operador — 2026-06-04
- F2 (⚡) `buildNav()` extraída de `boot()`: filtra por modo, badge `adv`, botón toggle, fade-in 250ms en ítems operator, redirect a Tasks al volver a normal desde pantalla operador — 2026-06-04
- F3 (⚡) i18n: `nav.mode.enable` / `nav.mode.disable` en/es. Banners `.spec-explainer` en Runs y Memory con texto humano. 8 claves i18n — 2026-06-04
- F4 (🧠) Banners explicativos "What are Runs?" y "What is Memory?" — aparecen en todos los estados (loading/error/empty/populated) — 2026-06-04
- F5 (⚡) Pantalla de inicio: `advanced` sin atención → runs; normal sin atención → tasks. Fusionado con C4 en `fetchAll()` — 2026-06-04
- F6 (🔍) Gate: modo normal ✓ · avanzado con Runs/Memory/Specs y badge `adv` ✓ · persistencia tras reload ✓ · redirect a Tasks al desactivar desde Runs ✓ — 2026-06-04

**Decisiones de diseño Mes 10**
- Diagnóstico on-demand — LLM call solo cuando el usuario lo pide; no en background al cargar Tasks.
- `PUT /api/project/constitution` escribe al mismo path que usa el harness — una sola fuente de verdad, sin sincronización.
- Control Center extiende I2, no es pantalla nueva — reutiliza checklist + infraestructura existente.
- Ollama como ciudadano de primera clase: prefijo `ollama/` + optgroup separado + probe automático. Sin API key.
- Archivos en Chat son input conversacional (no `context authorize`) — dos superficies con propósito diferente.
- Wizard: rollback solo en 401 (key claramente inválida). 402/timeout/5xx no hacen rollback.
- `buildNav()` re-renderiza el DOM en cada toggle — simplicidad sobre complejidad. Fade-in vía `requestAnimationFrame`.
- Stacking context del sidebar: `z-index:1` para que los tooltips escapen el CSS Grid.

**Lista prohibida Mes 10** _(lo que NO se hizo — referencia histórica)_
- Autoría de skills con curador (normalizador de intención) — prerequisitos listos, scope grande para Mes 11.
- Pack curado de skills de ingeniería "pro" — espera al curador.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 10 — SÍ (2026-06-04)**
Wizard API key completo: 3 proveedores, validación real, rollback en 401, i18n 24 claves. Toggle humano/operador navegable con persistencia y redirect automático. Diagnóstico en Tasks con "Reintentar" + "Convertir en hábito". Archivos (imagen/PDF) en Chat + "Crear tarea desde conversación". Control Center con 5 bloques + semáforo + auto-refresh 30s. Ollama auto-detectado. 369 tests · 0 fail.

---

