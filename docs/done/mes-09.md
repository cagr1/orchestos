### MES 9 — Dashboard usable: de observador a orquestador

**BLOQUE A — Navegación y estructura**
- A1 (🧠) Reordenar nav: Tasks primero, Runner eliminado, pantalla por defecto = Tasks. Nav final: Tasks → Runs → Memory → Instincts → Specs → Settings — 2026-06-03

**BLOQUE B — Runner / entrada principal**
- B1 (🧠) Barra de composición en Tasks: textarea lenguaje natural → "Crear y ejecutar" → crea task + lanza CLI en background. Botón "Avanzado" abre modal completo — 2026-06-03

**BLOQUE C — Tasks (UX)**
- C1 (⚡) Ordenar columnas al hacer click en el header (status, retries, qa) — 2026-06-03
- C2 (⚡) Filtrar por status con tabs: Todos · Pending · Running · Done · Failed — 2026-06-03
- C3 (🧠) New Task — eliminar campo "Task ID": slug kebab-case automático desde las primeras 4–5 palabras de la descripción — 2026-06-03
- C4 (🧠) New Task — "Output files" → "Archivos a crear o modificar (opcional)" — 2026-06-03
- C5 (⚡) Executor con nombres humanos en Compose modal: "Rápido (DeepSeek)" · "Preciso (Claude)" · "Económico (OpenAI)" — 2026-06-03

**BLOQUE D — Memory**
- D1 (⚡) Barra de búsqueda en Memory — filtra por topic_key o contenido, client-side — 2026-06-03

**BLOQUE E — Instincts (UX para no-devs)**
- E1 (🧠) Pantalla Instincts reescrita con lenguaje humano: "Hábitos del agente" · "Enseñar un hábito nuevo" · confianza Alta/Media/Baja · secciones propuestos/activos/inactivos — 2026-06-03

**BLOQUE F — Runs**
- F1 (⚡) Auto-refresh en Runs cada 5s + indicador "● actualizando" / "● en espera" — 2026-06-03
- F2 (⚡) Filtro por status en Runs: Todos · Running · Done · Failed — 2026-06-03

**BLOQUE G — Specs**
- G1 (🧠) Banner explicativo "¿Qué es una Spec?" siempre visible + empty state guiado — 2026-06-03
- G2 (⚡) Botón "Nueva Spec" → modal (selector de tarea + desc auto-rellena) → `POST /api/specs/draft` → CLI en background — 2026-06-03

**BLOQUE H — Input natural (visión)**
- H1 (🧠) `POST /api/natural` → claude-haiku con contexto del proyecto → `TaskDraft {id, description, output[], executor}`. Compose bar en dos fases: escribe → IA genera borrador editable → confirmar y ejecutar. Fallback gracioso si falla IA — 2026-06-03

**BLOQUE I — Setup automático (onboarding)**
- I1 (🧠) Comando `orchestos setup` — checklist pre-flight: Bun · bun install · API keys · tasks.yaml · DB · índice de código — 2026-06-03
- I2 (⚡) Pantalla "Setup" en dashboard — misma checklist visual, auto-mostrada si falta prerequisito crítico. Settings fusionado con Setup — 2026-06-03
- I3 (⚡) Auto-run `bun install` al iniciar `orchestos dashboard` si falta node_modules. Sin preguntar, con fallback de error — 2026-06-04
- I4 (🧠) Installer de un solo archivo: `install.bat` (doble-click Windows) + `install.ps1` + `install.sh` (Mac/Linux). Detecta/instala Bun, `bun install`, crea `~/.orchestos/.env` con comentarios, pausa interactiva si falta API key, abre dashboard — 2026-06-04

**BLOQUE J — i18n + bugs de UI**
- J1 (🧠) i18n completo: `i18n.js` con diccionarios `en`/`es` + `t(key, ...args)` global en `window`. Selector de idioma en Settings → `localStorage('orchestos-lang')`. Todas las pantallas usan `t()`. Fix bug memory search: `requestAnimationFrame` restaura foco — 2026-06-03

**No planificado — shipeado durante el mes**
- Chat panel con selector de modelo universal — envía mensajes al LLM con contexto del proyecto, respuesta en streaming. Selector de modelo aplica globalmente al panel — 2026-06-03 (af7c65c)
- Ops screen con assets de branding (logo, mark, favicon SVG) — 2026-06-03 (757a4f2)
- Fix: system prompt del chat refleja el modelo real seleccionado, no el hardcoded — 2026-06-03 (d77847f)

**Decisiones de diseño Mes 9**
- Compose bar de dos fases (escribe → borrador IA → confirma) no interrumpe el flujo si la IA falla — fallback a slug simple. El error de IA nunca bloquea la creación de tareas.
- Slug auto desde descripción: kebab-case de primeras 4–5 palabras. Elimina fricción sin perder trazabilidad (el ID sigue siendo legible).
- i18n como ciudadano de primera clase desde el inicio del dashboard — `t()` global en lugar de strings hardcodeados en cada pantalla. Coste de adopción: cero si se hace antes de escalar pantallas.
- Installer con pausa interactiva en la API key: la herramienta no arranca si el prerrequisito crítico no está. Evita confusión del no-dev ante un dashboard roto.
- Chat panel shipeado fuera de plan porque el modelo base ya existía (`/api/natural`) — reutilizar sin añadir dependencias nuevas.
- Instincts con lenguaje humano: los nombres internos (`confidence`, `verified`, `source`) nunca aparecen en la UI de no-devs. La abstracción es "hábito" con tres estados comprensibles.

**Lista prohibida Mes 9** _(lo que NO se hizo — referencia histórica)_
- Micrófono / dictado — análisis hecho, gap es `STTProvider` abstraction, pospuesto.
- Files como input en Chat — entrada conversacional bien definida, pospuesto.
- Arquitectura humano/operador (toggle "modo avanzado") — Mes 10+, necesita dashboard estable primero.
- VISION.md — brújula del producto, pospuesto.
- Control Center (salud continua) — delta sobre I2 Setup, pospuesto.
- Landing page — precisa VISION.md primero.
- KuzuDB — sin evidencia de escala.

**Métrica Mes 9 — SÍ (2026-06-04)**
Dashboard convertido en interfaz principal de trabajo: 10 bloques cerrados (A–J), 16 items `[x]`. Input de lenguaje natural operativo con preview de IA. i18n en/es completo. Instalador de un solo archivo para Windows y Mac/Linux. Chat panel + modelo selector shipeado fuera de plan. 369 tests · 0 fail mantenidos.

---

