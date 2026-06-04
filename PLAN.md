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

- [ ] B1 (🧠) Diseño de la pantalla "Proyecto": dos pestañas — "Guía del agente" (CONSTITUTION.md) y "Contexto comprimido" (CONTEXT.md, read-only con botón "Regenerar"). Definir secciones editables de CONSTITUTION.md: qué secciones exponer como campos guiados vs textarea libre. Decisión: textarea libre con helper text por sección — menos fricción que campos individuales.
- [ ] B2 (⚡) `GET /api/project/constitution` → devuelve `{ content: string, exists: boolean }`. `PUT /api/project/constitution` → escribe el archivo. `GET /api/project/context` → devuelve CONTEXT.md. `POST /api/project/context/regenerate` → ejecuta `context compress` y devuelve el nuevo contenido.
- [ ] B3 (⚡) Pantalla "Proyecto" en el nav (entre Memory e Instincts). Pestaña "Guía del agente": textarea editable con placeholder con estructura sugerida (reglas, tone, no tocar). Auto-save con debounce 1s + indicador "guardado". Pestaña "Contexto": textarea read-only + botón "Regenerar" con spinner.
- [ ] B4 (⚡) Añadir "Proyecto" al nav del dashboard y al diccionario i18n (en/es). Actualizar la pantalla I2 Setup para enlazar a "Proyecto" cuando falta CONSTITUTION.md.
- [ ] B5 (🔍) Gate: editar una regla en "Guía del agente", verificar que el archivo CONSTITUTION.md cambió en disco y que el harness la usa en el próximo run.

---

### BLOQUE C — Control Center: Setup → salud continua

I2 Setup screen hoy es un checklist estático de prerequisitos de primer arranque. Delta:
extenderla para que también responda en cualquier momento: ¿qué está bloqueado? · ¿qué
espera aprobación? · ¿qué costó esta semana? · ¿qué aprendió recientemente?
**No es pantalla nueva** — es I2 extendida con datos que ya existen en SQLite.

- [ ] C1 (🧠) Diseño del Control Center: definir las 5 secciones de salud — (1) Estado del sistema (prerequisitos, verde/amarillo/rojo), (2) Tareas bloqueadas (failed_permanent que no han sido diagnosticadas), (3) Aprobación pendiente (instincts unverified + specs en draft), (4) Costo acumulado (últimos 7 días desde `runs.cost_usd`), (5) Últimos aprendizajes (últimos 3 instincts auto aprobados). Contrato de los 5 endpoints necesarios.
- [ ] C2 (⚡) `GET /api/health` — agrega datos de los 5 bloques desde SQLite: checklist (bun/keys/db/tasks), `tasks.filter(failed_permanent)`, `instincts.filter(unverified)` + `specs.filter(draft)`, `sum(runs.cost_usd, last 7d)`, `instincts.filter(source:auto, verified, last 5)`.
- [ ] C3 (⚡) Pantalla I2/Setup extendida: sección superior mantiene checklist de prerequisitos. Sección inferior "Estado del proyecto" muestra los 5 bloques de salud. Auto-refresh cada 30s. Colores semáforo. Links directos a la pantalla relevante (ej. "Ver tareas bloqueadas" → Tasks filtrado por failed).
- [ ] C4 (⚡) Hacer el Control Center la pantalla de inicio por defecto si hay algún ítem de atención (instinct unverified, tarea bloqueada, costo > umbral configurable). Si todo está verde, pantalla de inicio = Tasks (comportamiento actual Mes 9).
- [ ] C5 (🔍) Gate: crear una tarea que falle, proponer un instinct (auto), verificar que el Control Center muestra los dos ítems de atención y que el link directo funciona.

---

### BLOQUE D — Archivos como input en Chat

El chat panel existe (Mes 9). El no-dev quiere analizar un PDF o imagen sin crear una tarea
formal — drop de archivo → conversación → si emerge algo accionable, "crear tarea desde
esto". **Distinto** de `context authorize` (archivos del proyecto): esto es input externo
conversacional. Formatos mínimos: imagen PNG/JPG (vision), PDF (texto extraído), .txt/.md.

- [ ] D1 (🧠) Diseño del flujo de archivos en Chat: (a) cómo llega el archivo al backend (FormData multipart vs base64 inline), (b) pipeline por tipo — imagen → base64 al provider con `type:image_url`, PDF → extracción de texto con `Bun.file` + regex mínimo (sin dependencia externa), texto → adjunto directo. (c) límites: 1 archivo por mensaje, max 10MB. Decisión sobre qué hacer si el provider no soporta visión: fallback a solo texto del alt.
- [ ] D2 (⚡) `POST /api/chat/upload` — recibe archivo, devuelve `{ fileId, type, preview }`. Almacenamiento en memoria (no en disco) — el fileId expira al cerrar sesión. Para PDF: extrae texto con regex sobre el buffer. Para imagen: devuelve base64.
- [ ] D3 (⚡) En el chat panel: botón de clip (📎) abre file picker (accept: image/*, .pdf, .txt, .md). Chip del archivo adjunto aparece sobre el input. Al enviar: `fileId` incluido en el POST. Backend incluye el contenido como parte del mensaje del usuario al LLM (imagen como `image_url`, texto/PDF como bloque de texto precediendo la pregunta).
- [ ] D4 (⚡) Botón "Crear tarea desde esta conversación" aparece en el chat después de 3+ mensajes — usa el historial para pre-rellenar el compose bar en lenguaje natural (mismo patrón H1 de Mes 9). Solo visible si la conversación tiene contenido de análisis.
- [ ] D5 (🔍) Gate: subir un PDF real de 2+ páginas y preguntar algo sobre su contenido. Verificar que la respuesta es coherente con el contenido del PDF. Probar con imagen. Verificar que el botón "Crear tarea" pre-rellena algo útil.

---

### BLOQUE E — Wizard API key: resolver el muro del cold-start ★ PRIORIDAD #1

El bloqueo real del no-dev. I1/I2 detectan si falta la key pero no explican qué es ni cómo
conseguirla. "Añade tu `OPENROUTER_API_KEY` en `~/.orchestos/.env`" es una pared para alguien
que nunca programó. Objetivo: wizard dentro del producto que lleva de la mano: qué es una API
key → a qué web ir → copiar → pegar en un campo del dashboard → validar con una llamada de
prueba → feedback claro.

- [ ] E1 (🧠) Diseño del wizard: (a) trigger — I2 detecta key faltante → banner prominente "Configura tu clave para empezar" con CTA "Configurar ahora". (b) 3 pasos en modal: Paso 1 "Qué es una API key" (explicación humana, sin jerga, con analogía — "es tu contraseña de acceso al servicio de IA"), Paso 2 "Consigue tu clave" (instrucciones paso a paso con screenshots o descripción textual del sitio, enlace explícito), Paso 3 "Pega tu clave aquí" (campo password + botón "Verificar y guardar"). (c) Backend: escribe en `~/.orchestos/.env`, hace test call con Haiku (1 token) y reporta ✅/❌ con mensaje claro. Diseñar el mensaje de error para cada caso: key inválida · sin crédito · timeout.
- [ ] E2 (⚡) `POST /api/setup/api-key` — recibe `{ provider: 'openrouter'|'anthropic'|'openai', key: string }`. Escribe en `~/.orchestos/.env`. Llama al provider con prompt minimal ("ping") y devuelve `{ valid: boolean, error?: string }`. Nunca loguea la key en claro.
- [ ] E3 (⚡) Modal de wizard en el dashboard — 3 pasos con navegación Anterior/Siguiente. Paso 2 muestra las instrucciones por provider seleccionado (dropdown: OpenRouter / Anthropic / OpenAI). Campo key: type=password, toggle "mostrar". Paso 3: spinner de validación, indicador ✅/❌, mensaje de error en lenguaje humano. Al cerrar con éxito: banner de I2 desaparece, toast "¡Listo para trabajar!".
- [ ] E4 (⚡) Integrar el trigger en I2/Control Center: si checklist detecta key faltante, el ítem muestra botón "Configurar" que abre el wizard directamente (no redirige a Settings). También añadir acceso desde Settings como "Cambiar API key".
- [ ] E5 (🔍) Gate: instalación limpia sin `.env`, abrir dashboard, verificar que el wizard aparece, completar el flujo con una key real, verificar que I2 cambia a verde y que una tarea básica puede ejecutarse inmediatamente después.

---

### BLOQUE F — Superficie humano vs operador ★ PRIORIDAD #2

Hoy el nav expone Runs · Specs · Instincts · Memory como hermanos — abstracciones internas
al mismo nivel. Un no-dev ve "Runs" y no sabe qué es. Objetivo: un solo motor, dos niveles
de prominencia. **Superficie humana por defecto** (qué está pasando · qué aprendió · qué
necesita aprobación). **Superficie operador** (Runs crudas, cost breakdown, memory conflicts,
spec lint, evidencia técnica) detrás de un toggle visible pero discreto. **No son dos UIs**
— es un rediseño de jerarquía con degradación.

- [ ] F1 (🧠) Diseño de la jerarquía: (a) definir qué pertenece a cada superficie. Superficie humana: Tasks ("Trabajo pendiente"), Proyecto (CONSTITUTION/CONTEXT), Hábitos (Instincts en lenguaje humano — ya Mes 9 E1), Control Center (salud continua — bloque C). Superficie operador: Runs (historial técnico de ejecuciones), Memory (entradas crudas de memoria), Specs (lint, archive, estado), detalles de cost breakdown, context warnings. (b) Mecanismo de toggle: "Modo avanzado" como switch en el nav inferior (persistido en localStorage). (c) Regla de degradación: en modo normal, los ítems de operador desaparecen del nav; en modo avanzado, aparecen con etiqueta sutil "avanzado". **El poder no se elimina — se mueve.**
- [ ] F2 (⚡) Toggle "Modo avanzado" en el nav: switch con label "Avanzado" + ícono de tuerca. Persistido en `localStorage('orchestos-mode')`. Al activar, aparecen en el nav: Runs · Memory · Specs con badge "avanzado". Al desactivar, desaparecen (collapse animado). El nav en modo normal queda: Tasks · Proyecto · Hábitos · Control Center · Chat · Settings.
- [ ] F3 (⚡) Añadir entradas al diccionario i18n para el modo avanzado y los ítems que aparecen/desaparecen. Revisar que todas las pantallas de operador (Runs, Memory, Specs) tienen su traducción completa.
- [ ] F4 (🧠) Revisión de pantallas de operador en modo avanzado: Runs debe tener un banner explicativo breve ("Aquí ves el historial técnico de cada ejecución del agente") igual que Specs tenía su banner en Mes 9 G1. Memory también. El no-dev que activa "avanzado" por curiosidad no debe quedar perdido.
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
