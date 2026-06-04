# IDEAS.md — OrchestOS

Backlog accionable, **ordenado por esfuerzo** (rápido → lento). De aquí sale el próximo PLAN.md.

- Dirección de producto y norte estratégico → [VISION.md](VISION.md)
- Lo ya implementado → [DONE.md](DONE.md) Sección 2

Reorganizado: 2026-06-04 (cierre Mes 10).

---

## 🎯 Candidato a Mes 11 — el tema probable del próximo plan

El producto ya es usable para el no-dev (Mes 10 cerrado). El siguiente eje:
**OrchestOS como experto, no solo ejecutor** — que el producto traiga su propio criterio
de ingeniería y permita al usuario ampliar ese criterio sin salir del dashboard.

1. **Autoría de skills con curador** — el curador normaliza intención libre → `SkillDef`
   válido (tres puertas: escribir · importar · exportar). La pantalla Skills en el dashboard.
2. **Pack curado de skills "pro"** — absorber el criterio de ingeniería de repos como
   mattpocock/skills y superpowers vía la puerta "importar" del curador.

La narrativa: un no-dev puede crear, importar y usar skills sin abrir una terminal,
y el agente ejecuta con criterio "pro" por defecto.

---

## ⚡ Rápido — superficie sobre motor que ya existe (alto ROI, bajo riesgo)

_Todos los items de este tramo que estaban aquí fueron implementados en Mes 10 (Bloques A–D)._
_Ver DONE.md § MES 10 para el historial completo._

---

## 🔨 Medio — capacidad nueva acotada

### Autoría de skills con orden garantizado — normalizador de intención

**El problema de Carlos**: cuando alguien quiere añadir una skill, no puede entrar como
texto libre. Tiene que salir ordenada — qué hace, qué **no** hace, cómo actúa — en un YAML
que se respeta. El usuario escribe la intención; el orquestador no la manda tal cual: la
normaliza primero.

**Decisión de arquitectura (resuelta 2026-06-04)**: el `SkillDef` YAML propio es la fuente
de verdad y NO se cambia — es más rígido y rico que el `.md` de esos repos (carga `verifiers`
→ QA, `allowed_tools` → tool-policy, `language_targets` → compilador). agentskills.io se
trata como puerto de entrada/salida en el borde, nunca como formato central. El valor de los
repos entra como **contenido curado a este schema**, no como su formato.

**Qué ya existe (no reconstruir)**: `SkillDef` ya tiene schema rico — `when_to_use`,
`inputs_required`, `verifiers`, `anti_patterns`, `examples`, `allowed_tools`,
`language_targets`. `skill scaffold` genera plantilla genérica por lenguaje, y el compilador
ya exporta a 3 targets (claude/cursor/openai). El orden a nivel schema **ya está**.

**El núcleo — un curador, tres puertas**: cualquier skill que entra se **normaliza al
`SkillDef` validado antes de guardar**. Igual que un asistente que tiene su propia estructura
para guardar lo que le escribes — no lo guarda crudo. Tres entradas, un solo pipeline de
curación:

1. **Escribir** — `orchestos skill new "<intención en lenguaje natural>"`. Un LLM convierte
   el texto libre en `SkillDef`: deriva `name` (slug), `when_to_use` como *condiciones de
   disparo* (no resumen del workflow), `anti_patterns` (el "qué NO hace"), pasos de acción,
   `verifiers`. Mismo patrón que `POST /api/natural` (H1) ya hace para tareas.
2. **Importar** — un `SKILL.md` externo (de esos repos o agentskills.io) → parser que mapea
   frontmatter+body a los campos del `SkillDef`, el LLM completa los que el `.md` no tiene
   (`verifiers`, `allowed_tools`, `language_targets`), y se valida. Lo que no mapee se marca,
   no se inventa.
3. **Exportar** — `SkillDef` → `SKILL.md` agentskills.io como 4º target del compilador
   existente. Para compartir hacia otros harnesses.

**Disciplina heredada de superpowers/mattpocock**: `description`/`when_to_use` deben ser
*solo condiciones de disparo* ("Use when…"), nunca el workflow — así el harness sabe *cuándo*
activar la skill sin ambigüedad.

**Por qué importa**: es el puente para que un no-dev contribuya skills sin romper el contrato,
y para absorber las skills curadas de los repos sin atarse a su formato. La curación es la
garantía de que todo lo que entra sale ordenado y se respeta.

**En el dashboard, no solo CLI (requisito, no opcional)**: si el curador vive solo en
`orchestos skill new`, el no-dev no lo puede usar — y ese es justo el usuario objetivo. Hoy
el dashboard **no tiene pantalla de Skills** (nav: Tasks · Runs · Memory · Instincts · Specs
· Settings). Hace falta:
- Pantalla **Skills**: galería de las skills actuales (reusa `skill list`) + estado.
- **Escribir**: textarea de intención libre → preview del `SkillDef` curado, editable, antes
  de guardar (mismo patrón de dos fases que la compose bar de Tasks, H1).
- **Importar**: pegar un `SKILL.md` o subir archivo → preview normalizado → guardar.
- **Exportar**: botón para bajar la skill como `SKILL.md`.

Cada comando CLI del curador necesita su endpoint + superficie en el dashboard. La regla del
proyecto: una feature para el no-dev no está hecha hasta que está en el dashboard.

**Prerequisito**: `skill scaffold` ✅ + `SkillDef` validator ✅ + compilador multi-target ✅
+ patrón `/api/natural` ✅. La puerta 2 (importar) es la que más LLM-glue necesita; la
pantalla Skills es trabajo de dashboard nuevo (no existe aún).

---

### Pack curado de skills de ingeniería "pro" — la herramienta como cerebro

**El problema de Carlos**: si quien usa esto no tiene buenos principios de desarrollo, el
resultado es malo. La herramienta debería *aportar* el criterio de ingeniería, no asumirlo.

**Fuente**: extraído de [mattpocock/skills](https://github.com/mattpocock/skills) y
[obra/superpowers](https://github.com/obra/superpowers) — skills de workflow de ingenieros
que ya hacen desarrollo pro. Ambos usan el estándar emergente
[agentskills.io](https://agentskills.io/specification) (`SKILL.md` + frontmatter), portable
entre Claude Code/Codex/Cursor.

**Qué ya tiene OrchestOS** (no duplicar): `tdd-enforcer`, `diagnose`,
`improve-architecture`, `security-review`, `qa-structured`, `test-writer`.

**Lo que vale la pena traer (delta real)**:
1. **`brainstorming` / planning socrático** (superpowers `writing-plans` + mattpocock
   `grill-me`): refina la intención con preguntas hasta resolver todas las ramas de
   decisión *antes* de ejecutar. Es lo que más sirve al no-dev — la herramienta piensa
   *con* él. Hoy `clarify` es una sola pregunta heurística; esto es una sesión de diseño.
2. **`verification-before-completion`** (superpowers): checklist que confirma que el fix
   realmente funciona antes de declarar `done`. Complementa el QA loop existente.
3. **Par `requesting-code-review` / `receiving-code-review`** (superpowers): validación
   estructurada antes de mergear y cómo procesar feedback.
4. **Patrón de endurecimiento de skills** (el aporte más fino de superpowers): además de
   `anti_patterns`, añadir a las skills existentes secciones **"Iron Law"** (la regla
   innegociable), **"Common Rationalizations"** (las excusas que el agente se dice para
   saltarse la skill, con su refutación) y **"Red Flags"**. Esto hace que la skill se
   *respete bajo presión* en vez de ignorarse. Es un upgrade a las 6 skills que ya existen,
   no contenido nuevo.

**Lo descartado (no sirve a OrchestOS)**: skills de setup específicas de su repo
(`setup-pre-commit`, `git-guardrails`, `migrate-to-shoehorn`, `scaffold-exercises`);
`to-issues`/`to-prd` (GitHub-issue-céntricas — orchestos usa tasks.yaml+specs, y el
decompose ya lo hace el planner S22/S23 + capabilities S32); `using-git-worktrees` (ya:
S19); `dispatching-parallel-agents`/`subagent-driven-development` (paralelismo está en la
lista prohibida a propósito); `caveman`, `handoff`, install/meta-skills.

**Cómo entra el pack** (resuelto): vía la puerta 2 del curador (importar) — cada `SKILL.md`
de los repos se normaliza al `SkillDef`. No se copia el formato, se absorbe el contenido.

**Prerequisito**: schema `SkillDef` ✅ + curador (entrada anterior). El endurecimiento (#4)
es independiente y se puede hacer ya sobre las skills actuales sin esperar al curador.

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
