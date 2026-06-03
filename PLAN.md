---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-9-activo
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

**Objetivo**: el dashboard deja de ser solo observabilidad y se convierte en la interfaz principal de trabajo. Un usuario sin conocimiento de código debe poder usar OrchestOS desde aquí.

**Feedback real de uso (2026-06-03)** — observaciones del primer uso real del dashboard:

### Bloque A — Navegación y estructura

- [x] **A1** 🧠 Reordenar nav: Tasks primero, Runner eliminado de nav, pantalla por defecto = Tasks ✓ 2026-06-03
  - Nav nueva: Tasks → Runs → Memory → Instincts → Specs → Settings

### Bloque B — Runner / entrada principal

- [x] **B1** 🧠 Barra de composición en Tasks: textarea lenguaje natural → "Crear y ejecutar" → crea task + lanza CLI en background ✓ 2026-06-03
  - Botón "Avanzado" abre el modal completo para usuarios que quieran control total

### Bloque C — Tasks (UX)

- [x] **C1** ⚡ Ordenar columnas al hacer click en el header (status, retries, qa) ✓ 2026-06-03
- [x] **C2** ⚡ Filtrar por status con tabs encima de la tabla: Todos · Pending · Running · Done · Failed ✓ 2026-06-03
- [x] **C3** 🧠 New Task — eliminar campo "Task ID": orchestos lo genera automáticamente desde la descripción (slug kebab-case de las primeras 4-5 palabras) ✓ 2026-06-03
- [x] **C4** 🧠 New Task — renombrar "Output files" a algo comprensible para no-devs → "Archivos a crear o modificar (opcional)" ✓ 2026-06-03
- [x] **C5** ⚡ New Task — campo "Executor" mostrar con nombres humanos: "Rápido (DeepSeek)", "Preciso (Claude)", "Económico (OpenAI)" en lugar de nombres de API ✓ 2026-06-03

### Bloque D — Memory

- [x] **D1** ⚡ Agregar barra de búsqueda en Memory — filtra por topic_key o contenido (client-side) ✓ 2026-06-03

### Bloque E — Instincts (UX para no-devs)

- [x] **E1** 🧠 Reescribir pantalla Instincts con lenguaje humano ✓ 2026-06-03
  - "Hábitos del agente" · "Enseñar un hábito nuevo" · "Cuándo aplicarlo" / "Qué debe hacer"
  - Confianza: Alta/Media/Baja · Estados: "Esperando tu aprobación" / "Activo" / "Inactivo (confianza baja)"
  - Secciones separadas: propuestas → activos → inactivos

### Bloque F — Runs

- [x] **F1** ⚡ Auto-refresh en Runs cada 5s + indicador "● actualizando" / "● en espera" ✓ 2026-06-03
- [x] **F2** ⚡ Filtro por status en Runs: Todos · Running · Done · Failed ✓ 2026-06-03

### Bloque G — Specs

- [x] **G1** 🧠 Banner explicativo "¿Qué es una Spec?" siempre visible + empty state guiado ✓ 2026-06-03
- [x] **G2** ⚡ Botón "Nueva Spec" → modal (selector de tarea + desc auto-rellena) → `POST /api/specs/draft` → CLI en background ✓ 2026-06-03

### Bloque H — Input natural (visión)

- [x] **H1** 🧠 Input de lenguaje natural con preview de IA ✓ 2026-06-03
  - `POST /api/natural` → claude-haiku con contexto del proyecto → devuelve TaskDraft {id, description, output[], executor}
  - Compose bar en dos fases: escribe → IA genera borrador editable → confirmar y ejecutar
  - Fallback gracioso si la IA falla: usa slug simple directo

---

### Bloque I — Setup automático (onboarding para nuevos usuarios)

**Contexto**: para que alguien sin conocimiento de código pueda usar OrchestOS, las dependencias y la configuración inicial deben resolverse solas en lo posible.

**Qué puede hacer orchestos solo (automático):**
- Detectar si Bun está instalado (`bun --version`) y mostrar instrucción de instalación si no lo está
- Ejecutar `bun install` si falta `bun.lockb` o `node_modules`
- Detectar si `~/.orchestos/.env` existe y tiene las API keys necesarias
- Detectar si `tasks.yaml` existe en el directorio activo
- Detectar si la DB SQLite fue inicializada (`orchestos.db`)
- Detectar si el proyecto fue indexado en el code graph

**Qué siempre necesita al usuario:**
- Instalar Bun si no está — en Windows requiere abrir PowerShell manualmente (no hay forma silenciosa sin permisos de admin)
- Ingresar las API keys — credenciales no se auto-generan nunca

- [x] **I1** 🧠 Comando `orchestos setup` — pre-flight completo antes de cualquier otra cosa ✓ 2026-06-03
  - Checklist: Bun ✓/✗ · `bun install` ✓/✗ · API key ✓/✗ · tasks.yaml ✓/✗ · DB ✓/✗
  - Para cada ítem faltante: muestra el comando exacto a copiar-pegar (no ejecuta por el usuario si requiere permisos)
  - Al final: "Todo listo. Abre el dashboard con: `orchestos dashboard`" ó lista de pendientes

- [x] **I2** ⚡ Pantalla "Setup" en el dashboard — misma checklist visual ✓ 2026-06-03
  - Se muestra automáticamente si falta algún prerequisito crítico (API key vacía, sin tasks.yaml)
  - Cada ítem faltante tiene un botón de acción o instrucción clara
  - La pantalla Settings actual se fusiona con esta vista de setup para no tener dos lugares donde configurar cosas

- [ ] **I3** ⚡ Auto-run `bun install` al iniciar `orchestos dashboard` si falta el lockfile
  - Sin preguntar — es seguro, no tiene side effects destructivos
  - Si falla: muestra error con instrucción manual

- [ ] **I4** 🧠 [Visión — post I1+I2] Installer de un solo archivo
  - Un script `install.ps1` (Windows) / `install.sh` (Mac/Linux) que:
    1. Detecta si Bun está instalado, si no lo instala
    2. Clona el repo o descarga el release
    3. Ejecuta `bun install`
    4. Crea `~/.orchestos/.env` vacío con comentarios explicativos
    5. Abre el dashboard automáticamente
  - Objetivo: un usuario sin terminal puede hacer doble-click en el installer y OrchestOS queda listo

### Bloque J — i18n + bugs de UI

- [x] **J1** 🧠 i18n — inglés (default) + español, selector en Settings ✓ 2026-06-03
  - `i18n.js`: diccionario `I18N{en,es}` + función `t(key, ...args)` global en `window`
  - Todas las pantallas usan `t()` para cadenas visibles: títulos, botones, filtros, modales, placeholders
  - Selector de idioma en Settings → guarda en `localStorage('orchestos-lang')` → `App.rerender()`
  - Fix bug memory search: `requestAnimationFrame` restaura foco + cursor después de rerender

---

**Orden de ataque sugerido (actualizado)**: C5 → I1 → I2 → I3 → H1 → I4

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
