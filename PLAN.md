---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-10-activo
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

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

Tema: **cold-start → primer run sin ayuda**. Dos frentes que se refuerzan: eliminar el
muro real del onboarding (API key como barrera humana) y rediseñar la superficie para que
el no-dev vea lo que importa sin necesitar la jerga interna del operador.

Los bloques A–D son ⚡ Rápido — conectan UI a lógica ya probada.
Los bloques E–F son 🔨 Medio — capacidad nueva, alta palanca estratégica.

**Prerequisitos verificados al entrar**: dashboard Mes 9 ✅ · I2 Setup screen ✅ · chat panel ✅ · S25 diagnoseTask ✅ · CONSTITUTION.md / CONTEXT.md ✅.

---

### BLOQUE A — Diagnóstico de fallos en el dashboard

Motor ya existe (S25 `diagnoseTask` + auto-trigger en `failed_permanent`). Hoy solo visible
por CLI (`task diagnose <id>`). Objetivo: cuando una tarea llega a `failed` en el dashboard,
el usuario ve sin salir de la UI: qué intentó · por qué falló · qué cambiaría · botones
"Convertir en hábito" y "Reintentar con esta corrección".

- [x] A1 (🧠) Diseño del panel de diagnóstico: contrato del endpoint `GET /api/tasks/:id/diagnose` → `DiagnoseResult` ya tipado en `src/agents/diagnose.ts`. Definir cuándo se llama (on-demand al abrir tarea failed vs auto al cargar Tasks). Decisión: on-demand con botón "Ver diagnóstico" para no hacer LLM calls en background sin pedir.
- [x] A2 (⚡) `GET /api/tasks/:id/diagnose` en `src/dashboard/server.ts` — llama `diagnoseTask(id, root)` y devuelve `DiagnoseResult` JSON. Solo si tarea existe y tiene runs. ✓ 2026-06-04
- [x] A3 (⚡) Panel de diagnóstico en Tasks: fila de tarea `failed` muestra chip "Ver diagnóstico" → expande inline con `pattern · confidence · suggestion · details`. Spinner mientras carga. Texto en lenguaje humano (sin `confidence` crudo — traducir a Alta/Media/Baja). ✓ 2026-06-04
- [x] A4 (⚡) Botón "Reintentar" en el panel → `POST /api/tasks/:id/run` (endpoint ya existe). Botón "Convertir en hábito" → `POST /api/instincts` con `trigger` y `action` derivados de `suggestion` del diagnóstico (🔍 Claude revisa el mapeo antes de implementar). ✓ 2026-06-04
- [x] A5 (🔍) Gate ✓ 2026-06-04 — 3 problemas encontrados y corregidos:
  - `pattern` se mostraba como enum crudo (`scope_creep`) → ahora traducido a lenguaje humano (en/es) para los 7 valores de `FailurePattern`
  - `patternLabels` incompleto: faltaban `context_overflow` y `unknown` → trigger del hábito quedaba como "Task failure pattern detected"
  - `habitTrigger` era el label genérico del patrón → ahora incluye el ID de la tarea: "Cuando la tarea «add-auth» (La tarea era demasiado amplia)"

---

### BLOQUE B — Vista editable de "lo que OrchestOS sabe del proyecto"

`CONSTITUTION.md` y `CONTEXT.md` existen como archivos en el proyecto. El no-dev no sabe
dónde están ni cómo editarlos. Objetivo: pantalla en el dashboard que lee/escribe esos dos
archivos vía API, con secciones claras: propósito · stack · reglas · tono · archivos críticos
· qué no debe tocar. Mismo patrón que Settings → `.env`.

- [x] B1 (🧠) Diseño + decisión: textarea libre con helper text ✓ 2026-06-04
- [x] B2 (⚡) `GET/PUT /api/project/constitution` · `GET /api/project/context` · `POST /api/project/context/regenerate` ✓ 2026-06-04
- [x] B3 (⚡) Pantalla "Proyecto": tabs "Guía del agente" / "Contexto comprimido", auto-save 1s + indicador, read-only + Regenerar ✓ 2026-06-04
- [x] B4 (⚡) Nav actualizado (entre Memory e Instincts), i18n en/es, CSRF guard extendido a PUT ✓ 2026-06-04
- [x] B5 (🔍) Gate ✓ 2026-06-04 — Verificado: PUT escribe `join(resolve('.'), 'CONSTITUTION.md')`; harness llama `loadConstitution(projectRoot)` en cada run desde el mismo path; CSRF cubre PUT; nav "Proyecto" entre Memory e Instincts; `ICON.project` ✓; i18n 13 claves en/es ✓; auto-save debounce 1s ✓; regenerate re-fetch 1.5s ✓; typecheck verde.

---

### BLOQUE C — Control Center: Setup → salud continua

I2 Setup screen hoy es un checklist estático de prerequisitos de primer arranque. Delta:
extenderla para que también responda en cualquier momento: ¿qué está bloqueado? · ¿qué
espera aprobación? · ¿qué costó esta semana? · ¿qué aprendió recientemente?
**No es pantalla nueva** — es I2 extendida con datos que ya existen en SQLite.

- [x] C1 (🧠) Diseño del Control Center: definir las 5 secciones de salud — (1) Estado del sistema (prerequisitos, verde/amarillo/rojo), (2) Tareas bloqueadas (failed_permanent que no han sido diagnosticadas), (3) Aprobación pendiente (instincts unverified + specs en draft), (4) Costo acumulado (últimos 7 días desde `runs.cost_usd`), (5) Últimos aprendizajes (últimos 3 instincts auto aprobados). Contrato de los 5 endpoints necesarios.
- [x] C2 (⚡) `GET /api/health` — agrega datos de los 5 bloques desde SQLite: checklist (bun/keys/db/tasks), `tasks.filter(failed_permanent)`, `instincts.filter(unverified)` + `specs.filter(draft)`, `sum(runs.cost_usd, last 7d)`, `instincts.filter(source:auto, verified, last 5)`. ✓ 2026-06-04
- [x] C3 (⚡) Pantalla I2/Setup extendida: sección superior mantiene checklist de prerequisitos. Sección inferior "Estado del proyecto" muestra los 5 bloques de salud. Auto-refresh cada 30s. Colores semáforo. Links directos a la pantalla relevante (ej. "Ver tareas bloqueadas" → Tasks filtrado por failed). ✓ 2026-06-04
- [x] C4 (⚡) Hacer el Control Center la pantalla de inicio por defecto si hay algún ítem de atención (instinct unverified, tarea bloqueada, costo > umbral configurable). Si todo está verde, pantalla de inicio = Tasks (comportamiento actual Mes 9). ✓ 2026-06-04
- [x] C5 (🔍) Gate ✓ 2026-06-04 — 1 defecto encontrado y corregido: auto-refresh de 30s faltaba (C3) → añadido `setInterval` en `wire()` + `clearInterval` en `App.go()`. Todo lo demás verificado: 5 bloques renderizados con semáforo, `data-nav+data-filter` funcional, C4 routing por `attentionCount`, i18n en/es completo, typecheck verde.

---

### BLOQUE D0 — Detección de modelos locales (Ollama) ★ PRIORIDAD pre-D

OrchestOS hoy solo resuelve providers cloud (Anthropic, OpenAI, OpenRouter). Si el usuario
tiene Ollama instalado con modelos locales, el dashboard no los detecta ni los ofrece. Delta:
probe automático a `localhost:11434/api/tags` al arrancar → si hay modelos disponibles,
aparecen en el selector marcados "Local" con advertencia de calidad. Sin API key requerida.

**Alcance acotado**: solo detección + warning. Integración profunda de agentes con modelos
locales es trabajo futuro — esto es la superficie mínima honesta con el usuario.

- [x] D0-1 (🧠) Diseño ✓ 2026-06-04 — Decisiones: (a) `GET /api/providers/local` → probe `localhost:11434/api/tags` con AbortSignal 1s; devuelve `{ available, models: { id: string (prefijado `ollama/<nombre>`), name, size }[] }`. (b) Selector: `state.localModels` separado de `orModels`; `buildModelSelect` añade `<optgroup label="Local (Ollama)">` con precio "local". (c) `inferExecutorFromModel`: añade rama `/^ollama\//` → `'ollama'` antes del fallback openrouter; `handleApiChat` cuando executor=`ollama` llama `localhost:11434/v1/chat/completions` con modelo sin prefijo + `Authorization: Bearer ollama`. (d) Warning: banner dismissible via `sessionStorage('ollama-warn-shown')` al seleccionar modelo local por primera vez en la sesión; system prompt cambia "via OpenRouter" → "vía Ollama (local) — resultados pueden variar".
- [x] D0-2 (⚡) `GET /api/providers/local` — fetch a `http://localhost:11434/api/tags` con AbortSignal de 1s. Mapea respuesta a `{ available: boolean, models: { id: string, size: string }[] }`. ✓ 2026-06-04
- [x] D0-3 (⚡) Selector de modelos del chat: `state.localModels` separado; `loadLocalModels()` llama `/api/providers/local` al primer render; `buildModelSelect` acepta `localModels` y añade `<optgroup label="Local (Ollama)">`. Warning banner dismissible via `sessionStorage('ollama-warn-shown')` al seleccionar modelo local. i18n 3 claves en/es. ✓ 2026-06-04
- [x] D0-4 (⚡) `inferExecutorFromModel` rama `/^ollama\//` → `'ollama'`. `ollamaChat()` en module scope llama `localhost:11434/v1/chat/completions` con modelo sin prefijo + `Authorization: Bearer ollama`. `handleApiChat` ramifica por `isOllama`. System prompt indica "vía Ollama (local)" cuando es modelo local. ✓ 2026-06-04
- [x] D0-5 (🔍) Gate ✓ 2026-06-04 — Verificado: `/api/providers/local` devuelve `{ available: true, models: [{ id: "ollama/qwen2.5-coder:7b", size: "4.4 GB" }] }`. Chat via dashboard con `ollama/qwen2.5-coder:7b` devuelve respuesta coherente (model tag correcto en response). Cloud model `deepseek/deepseek-v4-flash` sigue funcionando sin cambios. 369 tests · 0 fail. Nota: primera carga del modelo tarda ~60s (4.7GB); cargas posteriores son rápidas.

### BLOQUE D0-ext — Mejoras UX al selector de modelos y Settings Ollama

Dos mejoras identificadas al validar D0 en el dashboard real:

- [x] D0-ext-1 (⚡) Selector de modelos del chat: modelos locales primero (optgroup "Local (Ollama)"), luego cloud (optgroup "Cloud"). Buscador en tiempo real encima del select — filtra por ID y nombre vía `buildModelOpts()` (helper reutilizable). `withSearch=true` solo en chat; draft/modal no lo necesitan. i18n 2 claves en/es. XSS seguro: todo contenido dinámico pasa por `esc()`, query nunca se renderiza. ✓ 2026-06-04
- [x] D0-ext-2 (⚡) Settings — campo Ollama: `handleApiSettingsGet` ahora es async y añade `_ollama: { set, masked }` con resultado del probe a `localhost:11434/api/tags` (timeout 1s). Fila OLLAMA_HOST marcada `special: 'ollama'` — badge muestra "Detected / Not detected" según probe real, no según env var. Input pasa a ser "Override URL (opcional)" para Ollama remoto. API devuelve `localhost:11434 — 1 model detected`. ✓ 2026-06-04

---

### BLOQUE D — Archivos como input en Chat

El chat panel existe (Mes 9). El no-dev quiere analizar un PDF o imagen sin crear una tarea
formal — drop de archivo → conversación → si emerge algo accionable, "crear tarea desde
esto". **Distinto** de `context authorize` (archivos del proyecto): esto es input externo
conversacional. Formatos mínimos: imagen PNG/JPG (vision), PDF (texto extraído), .txt/.md.

- [x] D1 (🧠) Diseño del flujo de archivos en Chat: (a) cómo llega el archivo al backend (FormData multipart vs base64 inline), (b) pipeline por tipo — imagen → base64 al provider con `type:image_url`, PDF → extracción de texto con `Bun.file` + regex mínimo (sin dependencia externa), texto → adjunto directo. (c) límites: 1 archivo por mensaje, max 10MB. Decisión sobre qué hacer si el provider no soporta visión: fallback a solo texto del alt.
- [x] D2 (⚡) `POST /api/chat/upload` — recibe archivo, devuelve `{ fileId, type, preview }`. Almacenamiento en memoria (no en disco) — el fileId expira al cerrar sesión. Para PDF: extrae texto con regex sobre el buffer. Para imagen: devuelve base64. ✓ 2026-06-04
- [x] D3 (⚡) En el chat panel: botón de clip (📎) abre file picker (accept: image/*, .pdf, .txt, .md). Chip del archivo adjunto aparece sobre el input. Al enviar: `fileId` incluido en el POST. Backend incluye el contenido como parte del mensaje del usuario al LLM (imagen como `image_url`, texto/PDF como bloque de texto precediendo la pregunta). ✓ 2026-06-04
- [x] D4 (⚡) Botón "Crear tarea desde esta conversación" visible tras 3+ mensajes. Pre-fill: últimos 3 mensajes del usuario (no la conversación completa) → el AI draft los convierte en tarea estructurada. `chatToTask` se limpia en `wire()` de Tasks tras primer render. ✓ 2026-06-04
- [x] D5 (🔍) Gate ✓ 2026-06-04 — PDF 2 páginas subido y extraído correctamente (preview incluye contenido de ambas páginas). Pregunta sobre contenido → respuesta coherente ("OpenRouter API / tasks.yaml"). Imagen subida y descrita correctamente con modelo de visión (claude-haiku-4-5). Nota: modelos sin visión devuelven error 404 de OpenRouter — comportamiento esperado según D1 (fallback pendiente como mejora futura). Seed "Crear tarea": 3 últimos mensajes del usuario = 152 chars accionables vs 236 del volcado completo. 369 tests · 0 fail.

---

### BLOQUE E — Wizard API key: resolver el muro del cold-start ★ PRIORIDAD #1

El bloqueo real del no-dev. I1/I2 detectan si falta la key pero no explican qué es ni cómo
conseguirla. "Añade tu `OPENROUTER_API_KEY` en `~/.orchestos/.env`" es una pared para alguien
que nunca programó. Objetivo: wizard dentro del producto que lleva de la mano: qué es una API
key → a qué web ir → copiar → pegar en un campo del dashboard → validar con una llamada de
prueba → feedback claro.

- [x] E1 (🧠) Diseño ✓ 2026-06-04 — Decisiones: (a) Trigger: botón "Save key" del ítem `openrouter-key` en checklist se reemplaza por "Configurar ahora" → `Modal.openWizard()`. Sin banner extra — el ítem existente ya es prominente. (b) Modal: nuevo método `Modal.openWizard()` sobre infraestructura existente. `state.wizardStep` (1/2/3) + `state.wizardProvider` ('openrouter'|'anthropic'|'openai'). Paso 1: explicación humana + dropdown provider. Paso 2: instrucciones + URL directa por provider. Paso 3: input[password] + toggle ver/ocultar + botón "Verificar y guardar" → spinner → ✅/❌. (c) Backend `POST /api/setup/api-key`: escribe con `writeEnv` existente, test call `max_tokens:1`. Errores mapeados: 401→"clave no válida", 402→"sin crédito", timeout→"sin conexión", 5xx→"servicio caído". Key nunca en logs ni en response. Éxito: `{ valid: true }` → cierra modal + `App.fetchAll()` + toast "¡Listo para trabajar!". (d) Settings: fila OPENROUTER sin key también muestra botón → `Modal.openWizard()`.
- [x] E2 (⚡) `POST /api/setup/api-key` — recibe `{ provider, key }`, persiste con `writeEnv` existente (merge, no sobreescribe), test call `max_tokens:1` por provider. Errores mapeados a mensajes humanos: 401→"clave no válida" + rollback, 402→"sin crédito", timeout→"sin conexión", 5xx→"servicio caído". Key nunca en logs ni en response. Rollback solo en 401 (key claramente inválida). Tipos: `ApiKeyValidationResponse` en types.ts. ✓ 2026-06-04
- [x] E3 (⚡) `Modal.openWizard()` + `Modal._renderWizard()` sobre infraestructura Modal existente. 3 pasos: (1) explicación humana + dropdown provider, (2) instrucciones + link al sitio, (3) input[password] + toggle ver/ocultar + spinner + ✅/❌. Steps como texto plano con `esc()` — sin HTML en strings (XSS safe). Al éxito: `App.fetchAll()` + `showToast(wizard.success)`. i18n 24 claves en/es. CSS: `.wiz-modal`, `.wiz-indicator`, `.wiz-dot`, `.wiz-steps-list`, `.wiz-key-row`. ✓ 2026-06-04
- [x] E4 (⚡) Integrar el trigger en I2/Control Center: si checklist detecta key faltante, el ítem muestra botón "Configurar" que abre el wizard directamente (no redirige a Settings). También añadir acceso desde Settings como "Cambiar API key". ✓ 2026-06-04
- [x] E5 (🔍) Gate ✓ 2026-06-04 — Wizard abre desde Settings "Change key" (3 proveedores) ✓. 3 pasos navegan correctamente (step indicator, instrucciones, input+verificación) ✓. Wire data-open-wizard → Modal.openWizard() confirmado por JS probe ✓. Render del checklist con action:'open-wizard' genera botón "Configure now" ✓. i18n en/es ("Change key" / "Cambiar clave", "Configure now" / "Configurar ahora") ✓. 369 tests · 0 fail.

---

### BLOQUE F — Superficie humano vs operador ★ PRIORIDAD #2

Hoy el nav expone Runs · Specs · Instincts · Memory como hermanos — abstracciones internas
al mismo nivel. Un no-dev ve "Runs" y no sabe qué es. Objetivo: un solo motor, dos niveles
de prominencia. **Superficie humana por defecto** (qué está pasando · qué aprendió · qué
necesita aprobación). **Superficie operador** (Runs crudas, cost breakdown, memory conflicts,
spec lint, evidencia técnica) detrás de un toggle visible pero discreto. **No son dos UIs**
— es un rediseño de jerarquía con degradación.

- [x] F1 (🧠) Diseño ✓ 2026-06-04 — Decisiones:
  **(a) Split:**
  - Human (visible por defecto): `tasks`, `project`, `instincts` (nav label EN → "Habits"), `settings` (= Control Center), `chat`.
  - Operator (ocultos por defecto): `runs`, `memory`, `specs`.
  **(b) Toggle:**
  - `NAV` array: añadir `operator: true` a `runs`, `memory`, `specs`.
  - `localStorage('orchestos-mode')` = `'normal'` (default) | `'advanced'`.
  - Extraer lógica del sidebar de `boot()` a función `buildNav()` (reutilizable al toggle).
  - Toggle element: `.nav-mode-btn` con nuevo `ICON.sliders` (SVG sliders), colocado entre `<div class="grow">` y el icono de Settings. Solo icono + tooltip (sin texto para no agrandar el sidebar). Clase `.active` cuando modo = advanced (acento de color).
  - Al click: flip `localStorage`, llamar `buildNav()` + `App.rerender()`.
  **(c) Degradación:**
  - Normal: `mainNav.filter(n => !n.operator)` → nav muestra: tasks, project, instincts, chat + toggle + settings.
  - Advanced: todos los `mainNav` → adicionalmente runs, memory, specs con badge `<span class="nav-adv-badge">adv</span>` debajo del icono.
  - CSS: `.nav-icon.operator` `opacity:0; max-height:0; overflow:hidden` en normal; animación `max-height + opacity` 250ms al activar advanced. Pero como `buildNav()` re-renderiza el DOM, la animación se aplica con clase `.entering` vía JS en el primer frame.
  - Nota: nav label `'nav.instincts'` EN cambia de "Instincts" → "Habits" (F3 cubre i18n). Operador ítems conservan sus labels actuales (runs/memory/specs son términos técnicos apropiados en ese contexto).
- [x] F2 (⚡) Toggle "Modo avanzado" en el nav: switch con label "Avanzado" + ícono de tuerca. Persistido en `localStorage('orchestos-mode')`. Al activar, aparecen en el nav: Runs · Memory · Specs con badge "avanzado". Al desactivar, desaparecen (collapse animado). El nav en modo normal queda: Tasks · Proyecto · Hábitos · Control Center · Chat · Settings.
- [ ] F3 (⚡) Añadir entradas al diccionario i18n para el modo avanzado y los ítems que aparecen/desaparecen. Revisar que todas las pantallas de operador (Runs, Memory, Specs) tienen su traducción completa.
- [x] F4 (🧠) Revisión ✓ 2026-06-04 — Banner `.spec-explainer` añadido a Runs y Memory. Runs: "What are Runs? Each time the agent executes a task it creates a run — a record of what it did, how long it took, what it cost, and any warnings. This is the technical log. Most users won't need to check here often." Memory: "What is Memory? The agent stores things it learns about your project — file paths, conventions, past decisions. These are the raw entries. The agent updates them automatically; you rarely need to edit them directly." 8 claves i18n en/es. Aparece en todos los estados (loading, error, empty, populated). 369 tests · 0 fail.
- [ ] F5 (⚡) Pantalla de inicio adaptativa: si `orchestos-mode = normal` y no hay ítems de atención, pantalla de inicio = Tasks. Si `orchestos-mode = advanced`, pantalla de inicio = Runs (comportamiento familiar para el dev). Control Center sigue siendo la pantalla de inicio si hay ítems de atención, en ambos modos.
- [ ] F6 (🔍) Gate: (a) abrir dashboard en modo normal — verificar que nav solo muestra Tasks · Proyecto · Hábitos · Control Center · Chat · Settings. (b) Activar modo avanzado — verificar que aparecen Runs · Memory · Specs. (c) Verificar que el toggle persiste al recargar. (d) Verificar con un usuario no-técnico si el modo normal es comprensible sin explicación.

---

### Cierre Mes 10

- [ ] **¿SÍ?** — Wizard completo y probado con usuario real · toggle humano/operador navegable · diagnóstico de fallos visible en Tasks · archivos en Chat operativos · Control Center como pantalla de salud. Tests: ≥ 369 · 0 fail. Mover items IDEAS.md → DONE.md. Actualizar tabla estado. PLAN.md limpio. Pre-flight Mes 11.

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
