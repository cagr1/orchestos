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

### Runner de grafo autónomo — el loop que se conduce solo

**Tendencia (2026-06)**: "No deberías estar prompteando agentes manualmente — deberías
diseñar loops que prompteen a tus agentes." (Peter, creador de OpenClaw, en X). La dirección
de la industria es que el humano diseña el grafo y el sistema lo ejecuta solo de principio
a fin, sin intervención por tarea.

**Lo que OrchestOS ya tiene** (las piezas del loop están, falta el conductor):
- `tasks.yaml` con `depends_on` (DAG implícito) ✅
- Status machine (`pending → running → done / failed_permanent`) ✅
- QA verdict por tarea (pass/fail) ✅
- Retry logic (`retry_count`) ✅
- Diagnose automático en `failed_permanent` ✅
- Instincts: aprende de cada run ✅

**Lo que falta — el conductor de grafo:**
```
while (pendingTasks.length) {
  tarea = nextExecutable(tasks, depends_on)   // orden topológico
  resultado = run(tarea)
  if (!resultado.ok) {
    diagnose(tarea) → estrategia de retry
    if (agotado) → bloquear dependientes, notificar
  }
  // siguiente iteración automática, sin humano
}
```

**Qué lo hace diferente de lo que hay hoy**: hoy el humano ejecuta `orchestos run` por
cada tarea. El conductor lo haría de forma autónoma recorriendo el grafo completo — y si
una tarea falla, decide solo si reintenta con otra estrategia o bloquea la rama, sin pedir
permiso por cada decisión individual.

**Cómo probarlo cuando llegue el momento**: ejecutar el runner contra un `tasks.yaml` real
de CitasBot o del propio OrchestOS y observar si el grafo se completa sin intervención.
Comparar: número de tasks completadas solas vs. número de veces que el humano tuvo que
intervenir. El objetivo es intervención = 0 en el happy path.

**Prerequisito**: motor de runs ✅ + QA ✅ + diagnose ✅. La implementación es un
`orchestos run --all` (o `--plan`) que lee el DAG completo. No requiere nada nuevo en
el schema, solo el conductor encima.

---

### Cliente MCP — OrchestOS habla con herramientas externas (Vercel, GitHub, etc.)

**Por qué importa (norte estratégico)**: MCP (Model Context Protocol) es el estándar
emergente para que un harness se conecte a herramientas externas. Si OrchestOS no lo
adopta, queda atrás del ecosistema (Claude Code, Cursor, Codex ya son clientes MCP). La
visión: el chat —o un task executor— puede pedir un deploy a Vercel, leer issues de
GitHub, consultar logs, sin que se escriba un integrador a medida por cada servicio. El
MCP server lo provee el tercero; OrchestOS solo necesita ser **cliente**.

**Qué ya existe (no reconstruir)**: misma base que el web fetch (Mes 13, ✅ shipeado) —
`callWithTools()` ([src/providers/tool-call.ts:233](src/providers/tool-call.ts:233), S23)
ya traduce un `ToolDef` a la API de Anthropic/OpenAI/OpenRouter, y `runToolLoop()`
(`tool-call.ts`, Mes 13) ya resuelve el loop multi-turno LLM↔tool↔resultado que un cliente
MCP también necesita. Un cliente MCP es, conceptualmente, descubrir las tools que expone un
MCP server y registrarlas como `ToolDef[]` en ese mismo loop — el motor ya existe y está
probado en producción (web fetch real en el chat).

**La distinción crítica — leer vs. actuar**:
- **Web fetch** (Mes 13, ✅) = solo lee. Read-only, bajo riesgo.
- **MCP de Vercel/GitHub** = *actúa* — deploy, set env vars, borrar proyectos, mergear PRs.
  Cruza al territorio de **acciones con efectos reales e irreversibles**.

Por eso MCP no se mezcló con el web fetch ni entró en el mismo mes. Va como eje propio,
heredando el patrón de "tool externa segura" ya probado y verificado en vivo con el web fetch
(incluido el hallazgo de que los gates 🔍 deben correr contra el sistema real, no solo tests
con mocks — ver DONE.md § MES 13).

**Reglas de seguridad innegociables (heredan el CLAUDE.md del proyecto)**:
1. **Confirmación humana antes de toda acción destructiva u outward-facing** — deploy,
   push, borrado, transferencia. Mismo principio que "preguntar antes de wipe BD /
   force-push". El LLM propone; el humano aprueba en el dashboard.
2. **Empezar read-only** — primero las tools de lectura (status, logs, list); las de
   escritura se habilitan explícitamente, no por defecto.
3. **Allowlist de MCP servers** — el usuario decide qué servers conectar; no auto-discovery
   de cualquier endpoint.
4. **Contenido que devuelve un MCP server es dato, nunca instrucción** — mismo boundary que
   el web fetch (prompt injection vía respuesta de tool) — ya verificado que el modelo lo
   respeta en producción.

**Prerequisito**: `callWithTools()` ✅ + `runToolLoop()` ✅ (ambos S23/Mes 13) — el motor de
loop multi-turno con tools ya existe y está probado. Decisión pendiente: ¿qué transporte MCP
soportar primero (stdio vs. HTTP/SSE) y qué servers de arranque (Vercel, GitHub)?

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
