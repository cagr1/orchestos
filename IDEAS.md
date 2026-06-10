# IDEAS.md — OrchestOS

Backlog accionable, **ordenado por esfuerzo** (rápido → lento). De aquí sale el próximo PLAN.md.

- Dirección de producto y norte estratégico → [VISION.md](VISION.md)
- Lo ya implementado → [DONE.md](DONE.md) Sección 2

Reorganizado: 2026-06-10 (cierre Mes 11).

---

## ⚡ Rápido — superficie sobre motor que ya existe (alto ROI, bajo riesgo)

_Todos los items de este tramo que estaban aquí fueron implementados en Mes 10 (Bloques A–D)._
_Ver DONE.md § MES 10 para el historial completo._

---

## 🔨 Medio — capacidad nueva acotada

### Criterio de ingeniería pro — siguiente delta de superpowers/mattpocock

El curador + pack "pro" (8 skills) ya está shipeado (Mes 11, ver DONE.md § MES 11). Queda
el resto del delta identificado en [obra/superpowers](https://github.com/obra/superpowers)
y [mattpocock/skills](https://github.com/mattpocock/skills):

1. **`brainstorming` / planning socrático** (superpowers `writing-plans` + mattpocock
   `grill-me`): refina la intención con preguntas hasta resolver todas las ramas de
   decisión *antes* de ejecutar. Es lo que más sirve al no-dev — la herramienta piensa
   *con* él. Hoy `clarify` es una sola pregunta heurística; esto es una sesión de diseño.
2. **`verification-before-completion`** (superpowers): checklist que confirma que el fix
   realmente funciona antes de declarar `done`. Complementa el QA loop existente.
3. **Par `requesting-code-review` / `receiving-code-review`** (superpowers): validación
   estructurada antes de mergear y cómo procesar feedback.
4. **Patrón de endurecimiento de skills**: además de `anti_patterns`, añadir a las skills
   existentes secciones **"Iron Law"** (la regla innegociable), **"Common
   Rationalizations"** (las excusas que el agente se dice para saltarse la skill, con su
   refutación) y **"Red Flags"**. Hace que la skill se *respete bajo presión* en vez de
   ignorarse. Es un upgrade a las skills que ya existen, no contenido nuevo — se puede
   aplicar vía la puerta "importar" del curador (#1 ya implementado).

**Prerequisito**: curador ✅ (Mes 11). Los 4 ítems son independientes entre sí.

---

### Micrófono / dictado en Chat

Dictar es 3–5× más rápido que tipear para describir tareas complejas o dar feedback largo.

**Pila mínima (Electron)**: `MediaRecorder` → blob → Whisper API → texto editable en el input.

**Gap estructural**: no existe `STTProvider` abstraction (solo LLM text). Hay que añadir
una interface análoga a `ProviderClient` para audio→texto. **No es solo un botón.**

**Provider**: Whisper API (OpenAI `/v1/audio/transcriptions`) — mismo key que ya usa el
usuario para el LLM; si `openaiClient` existe, es un endpoint más. (Web Speech API se
descarta: Google-only, audio a servidores externos, mal en español técnico.)

**Prerequisito**: chat panel ✅ + decisión sobre STTProvider.

---

### Resolver imports relativos en Graph (lenguajes no-JS)

Hoy solo JS/Python resuelven paths relativos en `code_edges`. Para C#, Rust, Go, Java,
Ruby → los imports se guardan pero `to_file_id` queda `null`.

**Trabajo**: extender `resolveImport()` con lógica por extensión de archivo.

---

### Clasificador semántico para `clarify`

Hoy `needsClarify` es heurística de palabras clave (verbo ambiguo + sin `input[]`). Un LLM
call extra (haiku, barato) detectaría ambigüedad real semánticamente.

**Costo**: un call por task run. **Solo vale la pena si hay evidencia de falsos negativos.**

---

### Design.md condicional para tareas complejas (OpenSpec)

Único patrón de OpenSpec aún no shipeado (el resto → S28/S29/S32). Para tareas complejas,
generar un `design.md` intermedio entre `proposal` y `tasks`, condicional a la complejidad.

**Prerequisito**: flujo spec (S20/S32) ✅.

---

## 🧱 Largo plazo / esperar evidencia

### autoskills — registry de skills por lenguaje/framework

**Referencia**: `npx autoskills` (midudev) — https://github.com/midudev/autoskills

`skill scaffold` genera YAML genérico local. Con autoskills se descargaría una skill curada
por la comunidad para ese lenguaje/framework.

```bash
orchestos skill fetch --language rust      # rust-development del registry
orchestos skill fetch --framework nextjs   # nextjs-development
orchestos skill fetch --list               # lista disponibles
```

**Decisión pendiente** (lo que lo frena): ¿registry propio o wrappear autoskills como
fuente? Sin esa decisión no arranca. Si se adopta el estándar agentskills.io (ver "Pack
curado" en 🔨 Medio), el registry podría servir skills en ese formato — portable entre
harnesses.

**Encaja con el curador** (🔨 Medio): `skill fetch` es la puerta "importar" automatizada
desde un registry — pasa por la misma normalización a `SkillDef`. Las altas de skills
(escribir · importar manual · fetch desde registry) terminan todas en `skills/*.yaml`
validado, editable localmente.

**Prerequisito**: `skill scaffold` ✅ como base local.

---

### KuzuDB — upgrade del graph

Migrar `code_edges` + `files` a KuzuDB (embebible, Cypher, Rust) **cuando el grafo llegue a
10K+ nodos**. Hoy SQLite + regex es suficiente. No antes de evidencia real de escala.

---

## 📚 Referencia — inspiración externa (NO es backlog)

Repos analizados durante Mes 5-8. La mayoría de patrones ya están shipeados; esto queda
como mapa de procedencia. El único pendiente vivo (`Design.md condicional`) ya está arriba.

### Patrones extraídos → estado

| Patrón | Repo | Estado |
|--------|------|--------|
| Middleware chain ordenado | DeerFlow | ✅ S31 |
| Skills con tool policy (`allowed_tools`) | DeerFlow | ✅ S22.0.1 |
| Memoria estructurada en capas | DeerFlow | ✅ parcial — S22.0.3 |
| Subagent executor con status tracking | DeerFlow | ✅ S22 |
| Instincts con confidence scoring | ECC | ✅ S33 |
| Context monitor hook | ECC | ✅ S27 |
| Continuous learning v2 (hooks→instincts) | ECC | ✅ S34 |
| Cost tracker via transcript parsing | ECC | ✅ S35 |
| Detección de conflictos via BM25 | Engram | ✅ S26 |
| `topic_key` upsert (no duplicar) | Engram | ✅ S22.0.3 |
| DAG con contratos Read/Write | gentle-ai | ✅ S22.0.2 |
| apply-progress continuity | gentle-ai | ✅ S22.5a |
| Reglas de delegación con umbrales | gentle-ai | ✅ docs/AGENTS.md |
| WHEN/THEN en acceptance_criteria | OpenSpec | ✅ S28 |
| Capabilities contract | OpenSpec | ✅ S32 |
| Archive de specs con fecha | OpenSpec | ✅ S29 |
| Delta headers (ADDED/MODIFIED/REMOVED) | OpenSpec | ✅ S32 |
| Design.md condicional | OpenSpec | ⏳ ver backlog arriba |

### Los repos (una línea cada uno)

- **DeerFlow** (ByteDance, ~70K⭐) — https://github.com/bytedance/deer-flow · SuperAgent
  harness Python/LangGraph. Aportó: middleware chain, tool policy, memoria en capas,
  subagent executor con status tracking. NO aplica: LangGraph, sandbox Docker, JWT gateway.
- **ECC** (affaan-m, ~197K⭐) — https://github.com/affaan-m/ECC · ops para harnesses.
  Aportó: instincts con confidence, context monitor hook, continuous learning v2 (hooks
  100% confiables vs skills probabilísticas), cost tracker. NO aplica: reglas por harness,
  plugin marketplace.
- **Engram** (Gentleman-Programming, ~3.8K⭐) — https://github.com/Gentleman-Programming/engram
  · motor de memoria persistente Go/FTS5. Aportó: BM25 conflict detection, `topic_key`
  upsert. NO aplica: el binario Go, cloud sync, TUI.
- **gentle-ai** (Gentleman-Programming, ~3.4K⭐) — https://github.com/Gentleman-Programming/gentle-ai
  · workflow SDD multi-harness. Aportó: DAG de fases con contratos Read/Write,
  apply-progress merge, reglas de delegación con umbrales. NO aplica: binario Go, adaptadores
  por harness.
- **OpenSpec** (Fission-AI) — https://github.com/Fission-AI/OpenSpec · framework SDD
  agnóstico de harness, recomendado por usuario externo en producción ~1 año. Aportó:
  WHEN/THEN scenarios, capabilities contract, archive con fecha, delta headers. Pendiente:
  design.md condicional. NO aplica: carpetas por feature, slash commands `/opsx:*`.

---

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
