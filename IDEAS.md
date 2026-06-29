# IDEAS.md — OrchestOS

Backlog accionable, **ordenado por esfuerzo** (rápido → lento). De aquí sale el próximo PLAN.md.

- Dirección de producto y norte estratégico → [VISION.md](VISION.md)
- Lo ya implementado → [DONE.md](DONE.md)
- Estructura de trabajo activa → [PLAN.md](PLAN.md)

Reorganizado: 2026-06-23 (cierre Mes 13). Verificado contra DONE.md — ningún item de abajo está implementado.

---

## ⚡ Rápido — autoría sobre puertas que ya existen (casi sin código nuevo)

Estos tres items se entregan por la **puerta "importar" del curador** (Mes 11, ✅) o como
upgrade de skills existentes. No requieren motor nuevo — son contenido endurecido que
entra por infraestructura ya probada. Independientes entre sí.

Son el resto del delta identificado en [obra/superpowers](https://github.com/obra/superpowers)
y [mattpocock/skills](https://github.com/mattpocock/skills); el curador + pack "pro"
(8 skills) ya está shipeado (Mes 11, ver DONE.md § MES 11).

### 1. Endurecimiento de skills — Iron Law / Common Rationalizations / Red Flags

Además de `anti_patterns`, añadir a las skills existentes secciones **"Iron Law"** (la regla
innegociable), **"Common Rationalizations"** (las excusas que el agente se dice para saltarse
la skill, con su refutación) y **"Red Flags"**. Hace que la skill se *respete bajo presión*
en vez de ignorarse. Es un upgrade a las skills que ya existen, no contenido nuevo.

**Esfuerzo**: mínimo — autoría + paso por la puerta importar. Sin código.

### 2. `verification-before-completion` (superpowers)

Checklist que confirma que el fix realmente funciona antes de declarar `done`. Complementa
el QA loop existente. Entra como skill vía la puerta importar.

**Esfuerzo**: bajo — skill nueva, sin motor nuevo.

### 3. Par `requesting-code-review` / `receiving-code-review` (superpowers)

Validación estructurada antes de mergear y cómo procesar feedback. Dos skills que entran
por la puerta importar.

**Esfuerzo**: bajo — dos skills, sin motor nuevo.

---

## 🔨 Medio — capacidad nueva acotada

### 4. Clasificador semántico para `clarify`

Hoy `needsClarify` es heurística de palabras clave (verbo ambiguo + sin `input[]`). Un LLM
call extra (haiku, barato) detectaría ambigüedad real semánticamente.

**Costo**: un call por task run. **Solo vale la pena si hay evidencia de falsos negativos.**

**Esfuerzo**: bajo-medio — un call + parseo, pero gated en evidencia real.

### 5. Resolver imports relativos en Graph (lenguajes no-JS)

Hoy solo JS/Python resuelven paths relativos en `code_edges`. Para C#, Rust, Go, Java,
Ruby → los imports se guardan pero `to_file_id` queda `null`.

**Trabajo**: extender `resolveImport()` con lógica por extensión de archivo.

**Esfuerzo**: medio — acotado, sin abstracción nueva (el registry de resolvers ya existe, S21).

### 6. Design.md condicional para tareas complejas (OpenSpec)

Único patrón de OpenSpec aún no shipeado (el resto → S28/S29/S32). Para tareas complejas,
generar un `design.md` intermedio entre `proposal` y `tasks`, condicional a la complejidad.

**Prerequisito**: flujo spec (S20/S32) ✅.

**Esfuerzo**: medio — se apoya en el flujo spec existente, añade un paso condicional.

### 7. `brainstorming` / planning socrático

(superpowers `writing-plans` + mattpocock `grill-me`): refina la intención con preguntas
hasta resolver todas las ramas de decisión *antes* de ejecutar. Es lo que más sirve al
no-dev — la herramienta piensa *con* él. Hoy `clarify` es una sola pregunta heurística;
esto es una sesión de diseño.

**Esfuerzo**: medio — no es una skill más, es un flujo conversacional multi-turno (estado,
preguntas encadenadas). Más que el #1–#3 del tramo rápido.

### 8. Micrófono / dictado en Chat

Dictar es 3–5× más rápido que tipear para describir tareas complejas o dar feedback largo.

**Pila mínima (Electron)**: `MediaRecorder` → blob → Whisper API → texto editable en el input.

**Gap estructural**: no existe `STTProvider` abstraction (solo LLM text). Hay que añadir
una interface análoga a `ProviderClient` para audio→texto. **No es solo un botón.**

**Provider**: Whisper API (OpenAI `/v1/audio/transcriptions`) — mismo key que ya usa el
usuario para el LLM; si `openaiClient` existe, es un endpoint más. (Web Speech API se
descarta: Google-only, audio a servidores externos, mal en español técnico.)

**Prerequisito**: chat panel ✅ + decisión sobre STTProvider.

**Esfuerzo**: medio-alto — abstracción nueva (`STTProvider`) + wiring Electron + superficie
en dashboard. El tope del tramo medio.

---

## 🧱 Largo plazo / mucho código o esperar evidencia

### 9. Runner de grafo autónomo — el loop que se conduce solo

**Candidato directo para Mes 14** (anotado en DONE.md § MES 12 y MES 13).

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

**Esfuerzo**: poco código nuevo (reusa todo el motor) pero **alto riesgo** — es autonomía
sin humano por tarea. Por eso es eje propio y va después del hardening (Mes 12 ✅).

### 10. Cliente MCP — OrchestOS habla con herramientas externas (Vercel, GitHub, etc.)

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

**Esfuerzo**: alto — transporte MCP nuevo + descubrimiento de tools + el boundary de
seguridad completo (lo que lo hace su propio mes, no el motor que ya existe).

### 11. KuzuDB — upgrade del graph

Migrar `code_edges` + `files` a KuzuDB (embebible, Cypher, Rust) **cuando el grafo llegue a
10K+ nodos**. Hoy SQLite + regex es suficiente. No antes de evidencia real de escala.

**Esfuerzo**: alto + **bloqueado por evidencia** — no se toca sin un grafo real de 10K+ nodos.

### 12. Chat como entrada única — detección semántica de intención de tarea + auto-envío a Tasks

**⚠️ PRÓXIMO ÍTEM A ATENDER (marcado por Carlos, 2026-06-29) — alta prioridad y alta delicadeza.**
No empezar sin diseño explícito de los guardrails (sección abajo) revisado con Carlos primero.

**Origen**: Carlos quiere que, con el tiempo, el chat sea el medio de comunicación principal de
OrchestOS (como ya hacen Open WebUI/Hermes/Claude Desktop) — una sola entrada, y la pantalla
Tasks pasa a ser solo un **visor** de lo que corre por debajo, no el lugar donde se crea el
trabajo. Pregunta concreta que lo disparó: si el usuario escribe en el chat algo como *"lee
PLAN.md y ejecuta front 2"* — sin la palabra "tarea" — ¿el sistema puede entender que es
realmente una tarea y sugerir convertirla, en vez de solo responder conversacionalmente?

**Qué ya existe (NO reconstruir)**: el chat-create-task-bar (Mes 10, `chat-create-task-bar` en
[screens-core.js:48](src/dashboard/public/screens-core.js:48)) ya pre-llena el composer de Tasks
con el contexto de la conversación — pero es una heurística tonta (aparece a partir de 3+
mensajes, sin mirar contenido) y **requiere acción manual del usuario** (click en "Crear tarea
desde esta conversación"). El chat hoy NO tiene ninguna tool para leer `PLAN.md`/`tasks.yaml` ni
para crear o correr tareas — solo `FETCH_URL_TOOL` (Mes 13). `runToolLoop()`/`callWithTools()`
(`tool-call.ts`, Mes 13, ✅ probado en producción) ya resuelven el loop multi-turno LLM↔tool↔
resultado — el motor para darle al chat tools de lectura de proyecto/tasks ya existe, solo falta
registrarlas.

**El gap real, en dos capas separadas que NO deben mezclarse**:
1. **Detección semántica de intención** — un LLM call (mismo patrón que el ítem 4, clasificador
   semántico de `clarify`) que mire el mensaje del usuario y decida "esto describe trabajo
   ejecutable sobre el repo" vs. "esto es una pregunta conversacional", independiente de si
   contiene la palabra "tarea".
2. **Acción sobre esa detección** — qué hace el sistema cuando detecta intención de tarea. Acá
   es donde está la delicadeza real.

**Por qué es delicado — leer vs. actuar (mismo principio que el ítem 10, cliente MCP)**:
- Darle al chat una tool de **lectura** (`PLAN.md`, `tasks.yaml`, `IDEAS.md`) es de bajo riesgo —
  mismo boundary ya probado con el web fetch (contenido externo = dato, nunca instrucción).
- Darle al chat la capacidad de **crear y/o correr** una tarea automáticamente, sin que el
  usuario revise el draft en el composer primero, es otra cosa: pierde el punto de control que
  hoy existe (revisar `description`/`output`/`executor` antes de gastar dinero real en el
  executor). Un falso positivo del clasificador semántico podría disparar un run real no
  pedido.

**Reglas de seguridad innegociables (decisión ya tomada en la conversación con Carlos, no
renegociar sin volver a preguntar)**:
1. **Nunca auto-run silencioso.** El chat puede, como máximo, *sugerir* la conversión y
   pre-llenar el draft — igual que el botón actual, pero disparado por intención detectada en
   vez de conteo de mensajes. El usuario sigue confirmando antes de que algo se ejecute.
2. **El clasificador es un call adicional, no debe alucinar tareas que no existen** — mismo
   cuidado que el ítem 4: gatear esto en evidencia real de que la heurística de 3+ mensajes
   genera falsos negativos frecuentes, no implementarlo "porque se puede".
3. **Las tools de lectura de proyecto (PLAN.md/tasks.yaml) son de solo lectura** — no se mezcla
   con escritura de archivos ni con disparar `task run`/`run --graph` desde el chat en esta
   misma pieza de trabajo.

**Prerequisito**: `runToolLoop()` ✅ (Mes 13) para las tools de lectura · ítem 4 (clasificador
semántico) es el patrón de referencia para la capa de detección, aunque sea un módulo distinto
(scope: chat, no `clarify`).

**Esfuerzo**: medio en código (clasificador + 1-2 tools de lectura), pero **alto en diseño de
guardrails** — la mayor parte del trabajo real es decidir el punto de control humano, no escribir
el clasificador. No estimar como "🔨 Medio" por volumen de código; tratar la fase de diseño de
guardrails con el mismo cuidado que el ítem 10.

### 13. OCR para imágenes adjuntas en el Chat + adjuntar varios archivos a la vez

Origen: Carlos pidió rediseñar el menú de adjuntar del chat (Imagen/Documento/URL, hecho
2026-06-29) y notó dos gaps reales al diseñarlo:

1. **Sin OCR** — hoy una imagen adjunta se manda como `image_url` directo al modelo
   (`screens-core.js`, `send()`), es decir, depende 100% de que el modelo elegido tenga
   visión real. Si el usuario está en un modelo de solo texto (la mayoría de los baratos —
   DeepSeek, Llama), la imagen es inútil para ese modelo. OCR permitiría extraer el texto de
   la imagen y mandarlo como contexto de texto plano, funcionando con **cualquier** modelo,
   no solo los de visión.
2. **Sin adjuntar varios archivos a la vez** ("Folder" en el pedido original) — el estado
   del chat hoy solo soporta **un** archivo adjunto (`st.chatFileId`/`st.chatFileMeta`,
   singular) y `POST /api/chat/upload` solo acepta un archivo por request. Subir una carpeta
   real (o simplemente 2+ archivos) requiere: (a) cambiar el estado a un array de adjuntos,
   (b) decidir si el upload es secuencial (N requests) o batch (un endpoint nuevo que acepte
   `multipart` con varios archivos), (c) UI para listar/quitar cada adjunto individualmente
   (hoy el chip de adjunto es singular). Deliberadamente NO implementado en el rediseño del
   menú — se dejó solo Imagen/Documento/URL para no mezclar un cambio de UI con un cambio de
   modelo de datos.

**Repo de referencia para el OCR, dado por Carlos**: https://github.com/baidu/Unlimited-OCR
— verificado real vía `gh api repos/baidu/Unlimited-OCR` (2026-06-29): Python, licencia
**MIT**, ~11.9K⭐, 932 forks, repo activo (push 2026-06-28). **No leído todavía** — cuando se
implemente este ítem, leer el código real del repo y extraer lo mejor de su enfoque (no
asumir nada de su arquitectura interna sin haberlo leído). Por ser MIT, reusar su código es
legal pero **exige atribución real** — el NOTICE/crédito al extraer lógica de ese repo no es
opcional, es parte de la licencia (no es "agregarlos como colaborador de GitHub" literal, es
documentar el origen del código reusado en el archivo/commit que lo introduce).

**Prerequisito**: decidir primero el cambio de estado a múltiples adjuntos (gap #2) — el OCR
(gap #1) puede entrar después, como un paso de procesamiento adicional sobre cualquier imagen
ya adjunta, sin depender de que el modelo number 2 esté resuelto primero (son independientes,
pero #2 es la base de UI/estado que ambos comparten).

**Esfuerzo**: medio-alto — cambio de modelo de datos del chat (#2) + integración de un motor
OCR externo con su propio runtime/dependencias (#1, probablemente Python — fricción con el
stack Bun/TypeScript del resto del proyecto, a evaluar cuando se lea el repo real).

### 14. Notificaciones cuando termina algo en segundo plano

Origen: Carlos notó que "casi todas las herramientas de este tipo" (Slack, Linear, GitHub,
Claude Code, ChatGPT) avisan con una notificación del sistema cuando algo termina en segundo
plano, no solo con un cambio visual dentro de la pestaña. OrchestOS hoy no lo hace.

**Qué ya existe (NO reconstruir)**: `showToast()` (`app.js:1518`) — toast **dentro de la
pestaña**, visible solo si el usuario ya está mirando el dashboard en ese momento. Cero uso de
la `Notification` API del navegador (`grep` confirma 0 coincidencias en todo `public/`) — si el
usuario cambia de pestaña/app mientras corre un Graph Runner o una tarea larga, no se entera de
que terminó hasta que vuelve a mirar.

**Candidatos de disparo (eventos que ya existen, solo falta enganchar la notificación)**:
- Fin de una corrida del Graph Runner (`POST /api/run/graph`, Mes 14) — hoy se ve el resultado
  solo si el usuario sigue en la pantalla "Graph Runner" con el auto-refresh de 3s activo.
- `task run` individual que termina en `done`/`failed_permanent` mientras el usuario navegó a
  otra pantalla.
- Setup/health: cuando una key recién agregada falla la validación (ya hay rollback en 401,
  Mes 10) — útil avisar aunque el usuario ya se fue a otra pantalla del wizard.

**Cómo implementarlo (Web Notification API, sin librería nueva)**:
1. Pedir permiso (`Notification.requestPermission()`) una sola vez, con gesto explícito del
   usuario (ej. un toggle en Settings → General, NUNCA al cargar la página sin pedir — los
   navegadores penalizan/bloquean permisos pedidos sin interacción).
2. Wrapper simple `notify(title, body)` que llama a `new Notification(...)` si hay permiso y
   `document.hidden` es true (no molestar si el usuario ya está mirando el dashboard — para eso
   ya existe `showToast()`), si no, usar el toast existente.
3. Enganchar el wrapper en los 2-3 puntos de `fetchAll()`/polling donde un estado pasa de
   `running` a `done`/`failed` (mismo lugar donde hoy se compara estado antes/después para
   decidir si vale la pena notificar — evitar notificar en cada poll de 30s si nada cambió).

**Esfuerzo**: medio — la Notification API en sí es trivial (sin dependencias), lo real es
decidir bien los 2-3 puntos de enganche para no generar spam de notificaciones, y el toggle de
permiso en Settings (no pedirlo a ciegas).

---

## 📚 Referencia — inspiración externa (NO es backlog)

Repos analizados durante Mes 5-8. La mayoría de patrones ya están shipeados; esto queda
como mapa de procedencia. El único pendiente vivo (`Design.md condicional`) está arriba (#6).

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
| Design.md condicional | OpenSpec | ⏳ ver backlog #6 |

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
