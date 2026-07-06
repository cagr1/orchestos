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

### 9b. Auditoría de paridad CLI ↔ Dashboard — todo "poder" del CLI debe tener superficie en el front

**Origen**: Carlos, 2026-06-29, dogfooding en vivo del flujo chat→tarea. Observación directa:
"el CLI sí está funcionando pero el front no" — el dashboard expone solo un subconjunto de lo
que el CLI ya sabe hacer, y esa brecha no estaba siendo rastreada en ningún lado (relacionado
con [[feedback-dashboard-no-solo-cli]], que hasta ahora solo aplicaba a features *nuevas*, no
a un barrido retroactivo de lo que ya existe en `cli.ts`).

**Gaps concretos encontrados en una primera pasada (NO exhaustiva — falta auditoría completa)**,
comparando los `.command(...)` de [src/cli.ts](src/cli.ts) contra los endpoints reales bajo
`src/dashboard/handlers/`:
- `spec approve/lint/archive/create` — el dashboard solo tiene `GET /api/specs` (listar) y
  `POST /api/specs/draft`. No hay forma de aprobar, lintear o archivar un spec sin la CLI.
- `instinct set-confidence` / `instinct propose` — solo existen `approve`/`reject` como
  endpoints; ajustar confianza a mano o disparar el análisis de patrones manualmente requiere CLI.
- `task run --explain` / `--clarify` — el modo "explicar sin ejecutar" y el modo de
  clarificación antes de correr no tienen ningún botón equivalente en Tasks.
- `skill build` (compilar YAML → 3 targets: claude/cursor/openai) — el dashboard solo cubre
  curar/importar (Mes 11), no recompilar skills locales ya editadas.
- `detect`, `init`, `index` (detección de stack + indexado del grafo de código) — 100% CLI,
  cero superficie en el dashboard, ni siquiera de solo lectura.
- `runs --analyze` (S30, aprendizaje continuo) — hoy solo se dispara automático vía hook
  post-completion; no hay botón manual "analizar patrones ahora" en Runs.

**Por qué importa**: el dashboard es la interfaz que Carlos usa día a día (chat como entrada
principal, Mes 14 EXTRA); cada vez que una capacidad solo vive en CLI, el dashboard miente por
omisión sobre lo que OrchestOS puede hacer — el usuario no sabe que existe hasta que tropieza
con la CLI por necesidad (como pasó hoy).

**El gap real**: nadie ha hecho el barrido completo `cli.ts` (commands) vs `handlers/*.ts`
(endpoints) de punta a punta — la lista de arriba salió de comparar a ojo durante una sesión de
debugging, no de una auditoría sistemática. Falta ese barrido formal antes de decidir qué cerrar
primero.

**Esfuerzo**: depende de la auditoría — probablemente varios ítems chicos (un botón + un
endpoint cada uno) más que una sola pieza grande. Candidato a partirse en sub-tareas una vez
completado el barrido formal.

---

## 🧱 Largo plazo / mucho código o esperar evidencia

### 9. Runner de grafo autónomo — el loop que se conduce solo ✅

**Implementado en Mes 14 (2026-06-29)** — ver [DONE.md § MES 14](DONE.md) para el detalle completo (Bloques 0/A/A.R/B/C/D). `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path, decide retry-vs-bloqueo vía `diagnoseTask()`, y aísla ramas fallidas sin detener el grafo completo. Verificado en vivo (dashboard real + CLI real contra `tasks.yaml` de producción).

<details>
<summary>Contexto original (pre-implementación)</summary>

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

</details>

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

### 16. Escala honesta — poda de DB, presupuesto de input[], partir cli.ts

**Origen**: hallazgo #6 de la misma revisión. Tres deudas de escala reales pero SIN evidencia de
usuario que las priorice todavía (probado solo en <50 archivos):
1. **`input[]` va completo al prompt** (`prompt.ts`, `readFileSync` sin límite) — un archivo de 5K
   líneas en input revienta el presupuesto de contexto. Falta: truncado inteligente o selección
   por relevancia (el grafo + embeddings ya existen para esto, S21/S24).
2. **DB sin poda** — `runs` crece sin TTL ni archivado (LIMITATIONS lo admite). Falta: `orchestos
   runs --prune --older-than 90d` o archivado automático.
3. **`cli.ts` 2127 líneas** — mismo patrón que el split de `server.ts` del Mes 12 (1727→159 en 13
   módulos, re-verificado línea a línea). Aplicar el mismo tratamiento cuando el archivo vuelva a
   doler.

**Esfuerzo**: medio cada uno, independientes. **Gated en evidencia**: no abrir hasta que un
proyecto real (propio o de usuario externo) golpee el límite concreto.

### 17. Chat multi-sesión — conversaciones persistentes + aviso al 75% del contexto

**Origen**: Carlos, 2026-07-04. "No creo que todo avance en un solo chat... todas las
herramientas (Claude Code, Codex, Hermes) manejan varios chats." Candidato natural a
integrarse al eje del Mes 18 (chat como entrada única, ítem #12) — si el chat va a ser LA
puerta de entrada del producto, no puede evaporarse con un F5.

**Estado actual verificado (2026-07-04)**: el chat NO persiste nada — `st.chatHistory` es un
array en memoria del navegador ([app.js:55](src/dashboard/public/app.js)), el servidor es
stateless (recibe el historial completo en cada request, `chat.ts:291`), y un refresh borra
toda la conversación. No existe ninguna tabla de chat en SQLite.

**Qué ya existe (NO reconstruir)**:
- El backend ya calcula `promptTokens` contra `contextWindowFor(model)` en cada turno
  ([chat.ts:328](src/dashboard/handlers/chat.ts)) — la medición para el aviso del 75% ya
  está hecha, solo falta exponerla en la respuesta y dispararle un toast.
- Patrón de tablas + handlers de SQLite idéntico al de `runs` (misma DB, mismo estilo).
- `showToast()` ([app.js:1525](src/dashboard/public/app.js)) para el aviso in-page.

**Las dos piezas**:
1. **Sesiones persistentes**: tablas `chat_sessions` (id, título, created_at, model) y
   `chat_messages` (session_id, role, content, tokens). El endpoint gana `sessionId`, carga
   el historial de DB (no confía en el que manda el cliente) y persiste cada turno. Frontend:
   selector/lista de sesiones + "nueva conversación". Título autogenerado (primer mensaje o
   resumen con modelo barato). Bonus alineado con medición honesta: mostrar gasto de contexto
   acumulado por sesión.
2. **Aviso al 75% del contexto (dependiente del modelo)**: cuando `promptTokens` del turno
   supera el 75% del `contextWindowFor(model)` activo, la respuesta del endpoint incluye un
   flag y el frontend muestra un **toast** (ver ítem #18 — NUNCA `alert()` nativo) sugiriendo
   abrir una conversación nueva. El umbral se recalcula si el usuario cambia de modelo a mitad
   de sesión (ventanas distintas). Mismo espíritu que la regla personal de Carlos de cortar al
   70% en vez de esperar el límite real.

**Deliberadamente FUERA de alcance**: compactación/resumen automático del historial para
"seguir infinito" en una misma sesión — frágil y caro; sesión nueva es el 90% del valor con
el 20% del esfuerzo.

**Esfuerzo**: medio — 2 tablas + extender un endpoint existente + UI de lista de sesiones.
La parte 2 (aviso 75%) es chica y puede entrar sola si las sesiones se difieren.

### 18. Higiene de notificaciones in-page — cero `alert()`/`confirm()` nativos, todo toast/modal propio

**Origen**: Carlos, 2026-07-04. Vio diálogos nativos del navegador ("localhost dice: ...")
saliendo desde arriba de la página — no quiere ver NINGUNA notificación de ese tipo; todo
debe ser toast (o modal propio cuando se necesita decisión del usuario).

**Auditoría verificada (2026-07-04, grep completo de `public/`)** — 6 usos nativos vivos:
- [app.js:419](src/dashboard/public/app.js) — `confirm()` al borrar una task
- [app.js:423](src/dashboard/public/app.js) — `alert()` si el delete falla
- [app.js:424](src/dashboard/public/app.js) — `alert()` en error de conexión del delete
- [screens-ops.js:546](src/dashboard/public/screens-ops.js) — `confirm()` en Graph Runner
- [screens-ops.js:866](src/dashboard/public/screens-ops.js) — `alert()` para mostrar texto a copiar
- [screens-ops.js:912](src/dashboard/public/screens-ops.js) — `confirm()` en reset de Settings

**Qué ya existe (NO reconstruir)**: `showToast()` + estilos `.toast`/`.toast-error`
([app.js:1525](src/dashboard/public/app.js), `styles.css:475`) — los 3 `alert()` migran
directo a esto. Los 3 `confirm()` necesitan pieza nueva: un **modal de confirmación propio**
(promesa que resuelve confirmar/cancelar), porque un toast no puede bloquear una acción
destructiva esperando decisión.

**Regla resultante**: prohibido `alert()`/`confirm()`/`prompt()` nativos en `public/` —
candidato a check determinista (grep en CI o pre-commit) para que no vuelvan a entrar.

**Relación**: complementa el ítem #14 (Web Notification API para background) — #14 es avisar
cuando NO estás mirando la pestaña; este es que lo que ves cuando SÍ estás mirando nunca sea
un diálogo nativo del navegador. El toast del 75% de contexto (ítem #17) depende de esta
higiene para nacer bien.

**Esfuerzo**: bajo-medio — 3 reemplazos triviales de `alert()` + un componente modal de
confirmación reutilizable + opcionalmente el check anti-regresión.

### 19. `engine: external` sin `checks:` explícitos pierde silenciosamente su única red determinista

**Origen**: hallazgo del gate D.1 (Mes 17, 2026-07-05, dinero real). `defaultChecksFor()`
([checks.ts:22](src/run/checks.ts)) devuelve `[]` cuando `effectiveRoot` no tiene
`node_modules` — gap documentado desde el Mes 14 (D3) para worktrees frescos que no
symlinkean dependencias. Hasta el Mes 17 esto era un riesgo teórico y acotado (single-shot/
agéntico pueden correr en modo `cwd`, donde sí hay `node_modules`). El ejecutor externo
**exige** modo worktree sin excepción (decisión d, §5 de
[docs/external-executor-design.md](docs/external-executor-design.md), por la razón de
seguridad correcta: un proceso no controlado no puede editar el repo real sin sandbox
desechable) — así que para una tarea `engine: external` **sin** `checks:` declarados
explícitamente, `defaultChecksFor()` siempre devuelve `[]` en la práctica, dejando el
QA-LLM como única red. El gate D.1 mismo mostró que el QA-LLM puede fallar (falso negativo
sobre un diff objetivamente correcto) — con checks determinísticos ausentes, ese es el
único filtro que queda.

**Qué NO se rompe**: si la tarea declara `checks:` explícitos (como hizo la tarea de D.1),
corren normal — `bunx tsc --noEmit` pasó limpio en el worktree pese a la ausencia de
`node_modules` (`bunx` resuelve desde la caché global de Bun). El gap es específico de
tareas SIN checks declarados que dependan del default automático.

**Posibles direcciones (no decidido)**: symlinkear `node_modules` al crear el worktree
(`createWorktree()`, `sandbox.ts`) para que `defaultChecksFor()` deje de verse forzado a
devolver `[]`; o exigir `checks:` explícitos como requisito de schema cuando
`engine: external`; o simplemente documentar la recomendación fuerte de declarar checks
explícitos para toda tarea `engine: external`.

**Esfuerzo**: bajo si es symlink en `createWorktree()` (una línea, afecta los 3 engines
por igual, arregla el gap de raíz) — pero verificar que no rompa el aislamiento del
sandbox (symlink compartido = las dependencias no están "aisladas", aunque tampoco las
edita ningún engine).

---

### 20. Higiene de tests — varios archivos escriben en la `runs` real (`~/.orchestos/db.sqlite`) sin limpiar ✅

**Resuelto el mismo día (2026-07-05).** Los 8 archivos identificados (`harness-evidence.test.ts`,
`engine-selection.test.ts`, `cli-runs-detail-engine.test.ts`, `harness-engine-persistence.test.ts`,
`harness-retry.test.ts`, `spec.test.ts`, `context-monitor-db.test.ts`, `suggest.test.ts`) ahora
limpian sus propias filas de `runs` en `afterAll`/`afterEach` (por `task_id` fijo, o por
`prompt`+`provider`/`project_id` cuando no había una clave fija). Se purgaron **1800 filas
sucias acumuladas** (623 + 1177 en dos pasadas) que venían de meses de `bun test` locales sin
cleanup. Verificado corriendo la suite completa dos veces seguidas: 621 tests · 0 fail · 0 filas
sucias después de cada corrida.

<details>
<summary>Contexto original (hallazgo)</summary>

**Origen**: hallazgo en vivo durante Mes 18 (2026-07-05) — Carlos notó filas raras en
"Recent Runs" del dashboard real (`f3-3-evidence`/`g3-selection-test`, mismo timestamp
exacto repetido, cascada de fallos que nunca ocurrió de verdad). Causa: `src/db/sqlite.ts`
no distingue DB de test — todo apunta siempre a `~/.orchestos/db.sqlite`, la misma que usa
el dashboard corriendo.

</details>

---

### 22. CI en rojo desde Mes 17 C.2 — dos causas distintas, una ya arreglada ✅ (parcial)

**Origen**: Carlos pidió verificar `github.com/cagr1/orchestos/actions/runs/28797793800` tras el
push del Bloque D (Mes 18, 2026-07-06). El run estaba en rojo — y **lo estaba desde antes de
esta sesión**: todo commit desde `feat(mes17/C.2): detección honesta si Claude Code no está
instalado` (2026-07-05) falla en CI, confirmado con `gh run list`.

**Causa 1 — pre-existente, NO se toca hoy**: los ~16 tests de
`src/__tests__/external-engine.test.ts` (Mes 17, ejecutor externo) esperan invocar el binario
`claude` real — el runner de GitHub Actions no lo tiene instalado (`Claude Code binary "claude"
not found in PATH`). Es un gap de infraestructura de CI (falta un paso de instalación o mockear
el binario), no un bug del motor — localmente pasa porque el binario sí está instalado. Requiere
su propia decisión (instalar `claude` en el workflow, o mockear `Bun.spawn` en esos tests) antes
de tocarlo — no se resuelve a ciegas acá.

**Causa 2 — real, introducida hoy, ya corregida**: los 2 tests nuevos de
`skill-auto-selection.test.ts` (Bloque D) fallaban en CI con `Received: undefined` — pasaban
localmente por un motivo equivocado: la máquina de Carlos tiene `OPENROUTER_API_KEY` real en
`~/.orchestos/.env`, así que `handleApiNatural()` llegaba a mi `fetch` mockeado sin problema.
CI no tiene esa key (correctamente, es un secreto) — `openrouterChat()` tira antes de llegar al
mock, cayendo al catch de `handleApiNatural` y devolviendo un error en vez del draft. Fix:
mismo patrón ya usado en `harness-evidence.test.ts` — `process.env.OPENROUTER_API_KEY =
'sk-test-or-key'` explícito en cada test, restaurado en `afterEach`. **Verificado localmente
simulando el entorno de CI** (sin `OPENROUTER_API_KEY` ni `~/.orchestos/.env`): 5/5 pasan.

**Pendiente**: confirmar que el próximo push deja el job `bun test` en verde (la Causa 1 seguirá
en rojo hasta que se decida cómo tratarla — no es parte de este ítem).

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
