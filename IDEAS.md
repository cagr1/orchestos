# IDEAS.md — OrchestOS

Backlog accionable. De aquí sale el próximo PLAN.md.

- Dirección de producto y norte estratégico → [VISION.md](VISION.md)
- Lo ya implementado → [DONE.md](DONE.md)
- Estructura de trabajo activa → [PLAN.md](PLAN.md)

Reorganizado: 2026-07-13 (apertura v0.12). El detalle de cada idea sigue abajo con su número
histórico intacto; lo que cambió es el **lente de orden**: ya no "por esfuerzo" sino **por
prioridad de diseño hacia un producto estable**. El mapa manda; los bloques numerados de abajo
son la referencia detallada, no el orden de ejecución.

## 🗺️ Mapa de prioridad (2026-07-13)

**P0 — graduado a PLAN v0.12 (ya NO vive acá):** borrado masivo en tablas (+absorbe #18),
Markdown en Chat (#38), visor de diff por run, auditoría de paridad CLI↔dashboard. Ver
[PLAN.md](PLAN.md) § v0.12.

**Graduado a PLAN v0.13 (ya NO vive acá):** #32 (presupuesto de outputs de tools, Bloque A) y
#36 (check de sintaxis JS/HTML en `defaultChecksFor`, Bloque A.5) — prerequisitos para reabrir
C.2. Ver [PLAN.md](PLAN.md) § Mes 22 (v0.13). Decisión de Carlos (2026-07-15): primero que
OrchestOS *entregue* un producto premium (C.2), luego las modificaciones de UI.

**P1 — acabado / papercuts que hacen que se sienta terminado (POSPUESTOS hasta después de C.2):**
- #43 — **panel derecho como IDE embebido**: tabs reales en `main`, explorer estilo VS Code
  (modificados/untracked), diff+archivo clickeable con gutter y syntax highlighting — pedido
  textual de Carlos (2026-07-14), transcrito sin reinterpretar en el ítem completo
- #40 — editor de Constitution: Guardar/Limpiar explícitos en vez de auto-save silencioso (bug real)
- #14 — notificaciones del sistema cuando algo termina en segundo plano
- #27 — tab de consumo/gasto en Settings (agregación pura sobre `runs`)
- #17 — chat multi-sesión + aviso al 75% de contexto
- #37 — modo "empezar gratis" (modelos `:free` de OpenRouter por defecto)

**P2 — robustez del motor, gated en evidencia (habilitan reintentar Mes 20/C.2):**
- #33 — refuter en el QA loop (segunda opinión barata antes de quemar retry)
- #19 — `engine: external` sin `checks:` pierde su red determinista
- #4 — clasificador semántico para `clarify` · #5 — resolver Ruby · #16 — escala honesta
- #29 — decisión pendiente sobre `topic_key`/memoria de sub-tasks
- #42 — auto-repair dirigido tras `failed_permanent` (cerrar el lazo diagnose→reparación)

**P3 — capacidad nueva grande (post-estable, v0.13+):**
- #41 — **empaquetar como app de escritorio Electron (Mac/Linux/Windows)** — la que más se acerca a
  la forma de producto de Orca; prototipo chico, distribución real medio-alta
- #39 — generalizar `engine: external` a más CLIs (Orca) → **prerequisito de #44**
- #44 — **cascada de selección Local→CLI→API** (Orca-style, "usa lo ya pagado antes que gastar
  saldo") — gated en #39 + una decisión explícita de Carlos por la tensión con
  [[feedback-modelo-decision-final-carlos]] (ver ítem completo)
- #28 — terminal real embebido
- #35 — directorio de proyecto configurable · #10 — cliente MCP · #31 — chat multi-proveedor
- #34 — `orchestos audit` · #7 — brainstorming socrático · #8 — micrófono/dictado
- #6 — Design.md condicional · #26 — Spec Kit · #25 — Mintlify docs · #11 — KuzuDB
- #30 — `task_class: ocr` · #1/#2/#3 — endurecimiento de skills (autoría, sin motor)

**Nota de diseño — primer tramo cerrado (2026-07-13), con capturas reales de Carlos** (Claude
Desktop/Codex/Orca/Hermes): rediseño del header + panel derecho (explorer/terminal/diff), un
solo ícono estático panel-left/panel-right (sin flecha que cambia con el estado), `localhost:4242`
eliminado del header, terminal reubicado del footer fijo a una pestaña del panel derecho, y un
explorador de archivos read-only nuevo (`GET /api/explorer/tree`+`/file`, un nivel por request).
El resto del "estándar visual" (burbujas de chat, pantallas de Settings/Config) sigue siendo
semilla de v0.13 — no tocado en este tramo.

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

- ~~**#23 — Sistema de notificaciones/toasts estilizado**~~ — Resuelto en E.7 (2026-07-07): todos los `alert()`/`prompt()` reemplazados por `showToast()` + modales propios.

## 🔨 Medio — capacidad nueva acotada

### 37. Modo "empezar gratis" — modelos free-tier de OpenRouter por defecto para el no-dev

**Origen**: Carlos (2026-07-13) vio [CodebuffAI/codebuff](https://github.com/CodebuffAI/codebuff)
(agente de código con tier gratis "Freebuff" soportado por publicidad) y preguntó si se puede
añadir como opción gratuita — *"oro para quienes quieren comenzar y tiene buenos modelos"*.

**Verificado contra el repo/SDK real de Codebuff (2026-07-13) — NO es viable como proveedor:**
- Codebuff **es un agente de código completo** (loop multi-agente: File Picker → Planner →
  Editor → Reviewer), TypeScript+Bun, Apache-2.0. Es la MISMA categoría que OrchestOS —
  **competidor, no proveedor**. Mismo veredicto que gentle-ai: capa de agente, no de inferencia.
- El `@codebuff/sdk` **exige `CODEBUFF_API_KEY` de pago** y **rutea por los servidores de
  Codebuff**; solo expone su loop de agente completo (`client.run()` → agent/tool events),
  **NO completions crudas** ni BYOK. Si OrchestOS lo llamara, delegaría a OTRO orquestador y
  tiraría a la basura su propio contrato/QA/graph/checks/costo en SQLite — incoherente.
- **Freebuff (el tier gratis con ads, lo que Carlos vio como "oro") NO es accesible por API** —
  es el CLI interactivo donde un humano ve los ads de texto. No hay endpoint headless: los ads
  financian una sesión humano-en-el-loop, no llamadas de tokens de máquina. `5 sesiones de 1h/día`.

**Pero el objetivo real de Carlos SÍ es viable, nativo, sin dependencia de terceros:** los
modelos que Freebuff regala (DeepSeek V4 Pro/Flash, MiMo 2.5, Kimi K2.7 Code, MiniMax M3) están
**todos en OpenRouter, que OrchestOS ya usa** — y OpenRouter tiene variantes `:free` (precio 0).
El catálogo (`model-catalog.ts:145`) ya ingiere `pricing.prompt`/`pricing.completion`, así que
**detectar modelos gratis es trivial** (precio == 0). Lo que falta es superficie:
1. Marcar/filtrar modelos `:free` en el selector (`buildModelSelect`) con un badge "Free".
2. Un preset "empezar gratis" que fije los roles (`planner`/`executor_*`/`default`) a modelos
   `:free` por defecto para un usuario nuevo sin saldo — el onboarding cero-costo que Carlos
   quiere, honesto (rate limits de OpenRouter aplican, no es infinito, pero es real y gratis).

**Conecta con [#31](#31-chat-multi-proveedor-real--routing-granular-por-función-inspirado-en-hermesopen-webui--pineado-2026-07-09)** (multi-proveedor): es un subcaso — no un proveedor nuevo,
sino usar mejor el que ya existe. **NO requiere** tocar el molde de conexiones de #31.

**Esfuerzo**: bajo-medio — badge + filtro en el selector (reusa el combo buscable existente) +
un preset de config. Sin motor nuevo, sin dependencia externa.

### 4. Clasificador semántico para `clarify`

Hoy `needsClarify` es heurística de palabras clave (verbo ambiguo + sin `input[]`). Un LLM
call extra (haiku, barato) detectaría ambigüedad real semánticamente.

**Costo**: un call por task run. **Solo vale la pena si hay evidencia de falsos negativos.**

**Esfuerzo**: bajo-medio — un call + parseo, pero gated en evidencia real.

### 5. Resolver imports relativos en Graph — solo falta Ruby

**Corregido (2026-07-06)**: esta nota estaba desactualizada — decía que C#/Rust/Go/Java no
resolvían imports. Verificado contra el código real: los 4 resolvers existen y están
registrados (`src/graph/resolvers/{csharp,rust,go,java}.ts`, wireados en
[`graph/index.ts:15-18`](src/graph/index.ts)) desde S21 (`tasks.yaml`:
`s21-6-integrate-resolvers`, done/qa:pass). **Solo Ruby sigue sin resolver.**

**Trabajo restante**: un `rubyResolver` nuevo siguiendo el patrón de los 4 existentes
(namespace/require matching), registrarlo en `graph/index.ts`.

**Esfuerzo**: bajo — el registry y el patrón ya existen, es un resolver más.

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

### 33. Refuter en el QA loop — segunda opinión barata antes de quemar un retry

**Origen**: gentle-ai v2.0.0 (2026-07, re-verificado). Su sistema de review separa 5
funciones (`review-risk/readability/reliability/resilience/refuter`) con modelo asignable
por función. OJO: en gentle-ai eso sigue siendo **prompts/config generados para OpenCode**,
no runtime — consistente con el veredicto de 2026-07-06 (capa opuesta del stack). Lo
robable es el patrón **refuter**: un agente adversarial que intenta tumbar los hallazgos
del reviewer antes de que cuenten.

**Eslabón débil en OrchestOS (verificado en `src/run/qa.ts`)**: `runQA()` es una sola
pasada, un solo modelo, y su veredicto es ley — un `fail` falso dispara un re-run completo
de la tarea (hasta `MAX_RETRIES=3`). Cada falso-fail cuesta 1-3 ejecuciones enteras del
executor + QA de nuevo. Ya hay evidencia de veredictos QA imperfectos en el historial
(falsos negativos del Mes 18).

**Qué hacer**: cuando `runQA()` devuelve `fail`, una segunda llamada barata (modelo
económico, prompt corto: "aquí está el veredicto fail y la evidencia — ¿el hallazgo es
CONFIRMED o PLAUSIBLE? refuta si puedes") antes de gastar el retry. Solo un `fail`
confirmado quema retry; un `fail` refutado pasa. Es asimétrico a propósito: los `pass`
no se re-verifican (el costo del falso-pass lo cubren los `checks:` deterministas).

**No hacer**: los 5 ejes de review de gentle-ai — para el tamaño de tareas de OrchestOS
es sobre-ingeniería; el refuter solo es donde está el ROI.

**Esfuerzo**: bajo-medio — una función `refuteVerdict()` + wiring en los 2 puntos del
harness donde se consume `qa.verdict === 'fail'` + tests. Se apoya en el routing por
función existente para elegir modelo económico (y alimenta la evidencia del #31).

**Nota de costo (verificada en hermes-agent, 2026-07-12)**: su `background_review.py`
documenta la política exacta para este tipo de segunda llamada — **mismo modelo que el
principal → replay completo reutilizando prompt cache tibio (cache reads baratos); modelo
distinto → digest compacto** (un modelo distinto no puede reusar el cache del padre, así
que replayar todo solo escribe tokens fríos). Aplicar el mismo criterio al refuter: si el
modelo económico ≠ modelo de QA, mandarle un resumen corto del veredicto+evidencia, no la
transcripción entera.

### 34. `orchestos audit` — auditoría híbrida de código muerto y hardcodeos, con ledger

**Origen**: Carlos (2026-07-12) — "un agente que revise archivo por archivo si hay basura:
código que ya no se ocupa, código hardcodeado — una revisión real, no superficial — y que
vaya documentando sobre qué archivo/ruta trabajó".

**Diseño híbrido (no puramente LLM)** — la ventaja injusta de OrchestOS es que el code
graph en SQLite ya sabe qué importa a qué:

1. **Pasada determinista primero** (barata, sin LLM):
   - Código muerto candidato: archivos/exports con **cero edges entrantes** en `code_edges`.
   - Hardcodeos candidatos: grep de patrones (URLs, API keys, IPs, magic numbers, paths
     absolutos).
2. **LLM solo sobre los sospechosos** — juzga con contexto si el candidato es realmente
   muerto/hardcodeado o falso positivo. Es la "revisión real" pero anclada en evidencia,
   no opinión archivo por archivo (eso alucina y cuesta una fortuna).
3. **Ledger por archivo** (la pieza que pidió Carlos): tabla con
   `path + estado (clean/flagged/pending) + hash del contenido + timestamp + hallazgos`.
   El hash da gratis: **reanudar** sin repetir archivos y **invalidar** solo lo que cambió
   en la siguiente corrida.

**Blindaje contra falsos positivos**: entry points (cli.ts, index.*), imports dinámicos,
exports públicos de API declarados. Regla dura: el agente **propone, nunca borra**
(mismo principio que Dreaming).

**Superficie**: comando `orchestos audit` + endpoint + pantalla en dashboard con el ledger
navegable (regla de "no solo CLI"). Conecta con #16 (escala honesta).

**Esfuerzo**: medio — la pasada determinista reusa el graph existente; lo nuevo es el
ledger (tabla + migración), el prompt de juicio por sospechoso, y la pantalla.

### 35. Directorio de proyecto configurable — OrchestOS trabaja donde tú elijas, no solo donde vive

**Origen**: Carlos (2026-07-13), tras un bug real: el Chat le preguntaba "¿dónde quieres
que se genere?" para cada tarea nueva — pregunta que no debería existir, porque hoy **no
hay ningún lugar donde elegir eso**. Ya se corrigió el síntoma (el system prompt del chat
ya no pregunta, ver `chat.ts`), pero la causa de fondo sigue: OrchestOS solo puede escribir
dentro de la carpeta donde él mismo vive. Carlos quiere el modelo mental de Claude Code —
"puedo elegir el directorio de trabajo por proyecto/sesión, con un default razonable".

**Verificado en código (2026-07-13) — por qué es así hoy**: `effectiveRoot` en
`src/run/middleware.ts:163` se fija siempre a `opts.projectRoot`, que en cada handler del
dashboard es `resolve('.')` — literal `process.cwd()` del proceso Bun al arrancar
(`chat.ts:261`, `tasks.ts:178`, `project.ts:95`, `context-suggest.ts:18`, y ~10 handlers
más, todos con el mismo patrón). `isSafeRelPath()` en `agentic.ts:34` bloquea cualquier
`..` que intente escapar esa raíz — es un límite de seguridad real, no un descuido.
Curiosamente la tabla `projects` en SQLite (`db/projects.ts`) ya está diseñada para
multi-proyecto (guarda `path` como llave), pero nada en el dashboard la usa para *cambiar*
de proyecto en caliente — solo se lee para el proyecto ya fijo por cwd.

**Diseño propuesto** (default = la carpeta donde vive OrchestOS, igual que hoy; cambiable
por el usuario, como pide Carlos):

1. **Un "proyecto activo" persistido**, no atado al cwd del proceso. Vive en la tabla
   `projects` ya existente (`db/projects.ts`) + una fila de config `active_project_path`
   (o reusar el patrón de `orchestos.config.yaml` pero a nivel de instalación, en
   `~/.orchestos/`, ya que el propio proyecto no puede describir dónde vive él mismo).
2. **Reemplazar `resolve('.')` por un getter `getActiveProjectRoot()`** en los ~15 call
   sites de handlers — un solo punto de verdad, no 15 lugares hardcodeados.
3. **Selector de proyecto en Settings** — input de ruta (con validación: existe, es
   directorio, opcionalmente ofrecer un picker nativo si Electron lo permite) + lista de
   proyectos ya indexados (la tabla `projects` ya trae historial) para cambiar entre ellos
   sin volver a indexar desde cero.
4. **El sandbox de escritura NO cambia** — sigue prohibido escapar la raíz con `..`; lo que
   cambia es *cuál* raíz aplica, no la regla de que hay una raíz.

**Riesgo a vigilar**: el dashboard hoy corre como un solo proceso de larga duración; cambiar
de proyecto en caliente implica invalidar todo el estado cacheado en memoria del servidor
(catálogo de modelos ya cargado, no es problema; pero sí el `state.tasks/runs/memory` del
cliente, que hay que re-fetch completo al cambiar — mismo patrón que ya usa `App.fetchAll()`
al bootear).

**Esfuerzo**: medio-alto — no es un feature aislado, toca el punto de entrada de casi todos
los handlers del dashboard. Candidato a Plan formal (no autoría directa) antes de tocar
los 15 call sites.

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

### 25. Mintlify — agente de docs automático

**Origen**: sesión 2026-07-07. Mintlify está conectado al repo de docs (auto-deploy en push). Los `.mdx` viven en un repo separado (pendiente confirmar cuál).

**Gaps ya identificados (2026-07-07)** — en CLI pero NO documentados:
- `detect`, `summary`, `index`, `context compress`, `skill run`, `instinct propose`, `instinct setup`, `reset`

**Documentado pero NO existe**: `skill fetch` — eliminar de la doc.

**Qué hacer:**
1. Confirmar repo de docs con Carlos
2. Corregir los 8 gaps manualmente (rápido)
3. Scheduled agent que lea `src/cli.ts` y compare contra `.mdx` en cada push — propone actualizaciones

**Esfuerzo**: bajo para la corrección manual, medio para el agente automático.

---

### 26. Spec Kit — formalizar tasks.yaml como spec ejecutable

**Origen**: sesión 2026-07-07. `tasks.yaml` ya es una proto-spec. Spec Kit (github/spec-kit) lo convierte en spec ejecutable: defines el outcome primero, el agente genera la implementación, los tests validan que coincida.

**Por qué es interesante**: reduce el "vibe coding" en el desarrollo de OrchestOS mismo. En vez de describir qué hacer en `description:`, describes el comportamiento esperado y Spec Kit genera la implementación.

**Riesgo**: cambia el workflow central de cómo se escriben las tareas. Evaluar en un bloque experimental antes de adoptar globalmente.

**Esfuerzo**: medio — instalación simple (`uv tool install specify-cli`), pero requiere repensar cómo se redactan las tareas en `tasks.yaml`. Candidato a spike de 1 bloque para evaluar si encaja.

---

### 27. Tab de consumo/gasto en Settings — día/semana/mes por modelo

**Origen**: sesión 2026-07-07. Al remover el redirect automático a Settings por `costLast7d > $0.50` (bug — el umbral era ridículo y secuestraba el home, ver [[feedback-home-siempre-chat]]), Carlos aclaró que sí quiere visibilidad de gasto — solo que como panel consultable, no como interrupción forzada. Referencia explícita: el estilo de openrouter.ai (desglose por modelo) y el contador de mensajes/tokens diario tipo GitHub (heatmap de actividad) de la app de escritorio de Claude.

**Qué mostrar:**
- Gasto en $ por día/semana/mes, desglosado por modelo (mismo dato que ya vive en `runs.cost` — no hace falta tracking nuevo, es agregación).
- Conteo de mensajes/tokens consumidos por día — cubre tanto `runs` (task execution) como `chat_messages`/tokens de chat si ya se trackean ahí.
- Idealmente un heatmap tipo GitHub contributions para actividad diaria, además de las sumas semanal/mensual.

**Qué ya existe (NO reconstruir)**: `runs` (SQLite) ya tiene `cost`, `model`, `created_at` por cada corrida — es la fuente de verdad, ya usada por `costLast7d` (el cálculo que se acaba de remover del redirect, pero la función de agregación en sí puede reusarse para el nuevo tab). **Actualizado 2026-07-08**: se corrigió un gap real descubierto por Carlos — el Chat nunca llamaba `insertRun()`, así que cada mensaje conversacional era invisible para `runs`/el dashboard aunque sí se facturaba en OpenRouter (causa real de la discrepancia que notó entre su consumo real y lo que mostraba OrchestOS). Ya arreglado: cada turno de chat ahora inserta una fila en `runs` con `task_class: 'chat'` (`logChatRun()`, `handlers/chat.ts`). Este tab ya no necesita una tabla nueva — es agregación pura sobre `runs`, incluyendo tanto `task run` como chat.

**Esfuerzo**: bajo-medio — es agregación SQL sobre datos que ya existen (`runs.cost`/`created_at`/`task_class`) + un tab nuevo en Settings (mismo patrón que "Chat evidence" en Project, Mes 18 B.1.b-ui). El heatmap tipo GitHub es la parte más nueva visualmente, resto es reuso de patrones ya probados.

---

### 28. Terminal real en vez de "Recent Runs" en el panel inferior

**Origen**: sesión 2026-07-08. Carlos notó que el panel inferior del dashboard muestra un log de solo lectura de las últimas corridas ("Recent Runs") — propone que sea más útil un terminal real embebido ahí, donde se pueda ejecutar comandos directamente (`orchestos task run`, `git status`, etc.) en vez de solo ver qué ya se corrió.

**Qué implica**: no es un cambio cosmético — es exponer un shell real desde el navegador al proceso del dashboard (mismo host, mismo usuario del sistema). Esto es una superficie de ejecución de comandos arbitrarios expuesta por HTTP — necesita el mismo criterio de seguridad que ya se aplicó a otras decisiones "leer vs actuar" del proyecto (Mes 18, chat tools): como mínimo, mismo-origen estricto (ya existe para POST/PUT/DELETE, `isSameOrigin()` en `server.ts`), y decidir si corre con los mismos permisos del proceso dashboard o en un sandbox acotado.

**Qué ya existe (parcial)**: el patrón de "correr algo real y ver el resultado inline" ya está probado — `POST /api/runs/analyze` (Mes 18 E.4) y el botón "Explain" (E.7) devuelven resultados reales inline sin `alert()`. Un terminal es un salto de superficie distinto (ejecución arbitraria vs. una acción predefinida con parámetros validados), no una extensión trivial de esos patrones.

**Esfuerzo**: medio-alto — no es solo UI (xterm.js + WebSocket/SSE al backend), es una decisión de seguridad real sobre qué comandos se permiten y con qué privilegios. Candidato a diseño previo (`docs/`) antes de tocar código, mismo patrón que Bloque A del Mes 18 (guardrails antes de implementar).

---

### 29. `commitTopicKey` (memoria de sub-tasks) — el wiring está bien conectado, pero casi nunca se dispara en la práctica

**Origen**: investigación de seguimiento a I.6 (Mes 18) — la memoria del audit "premium dashboard" mencionaba `persistSubTaskMemory()` como posible código muerto; ese nombre no existe en el código (nunca existió con ese nombre), la función real es `commitTopicKey()` en `src/agents/context-isolation.ts:383`.

**Lo que se verificó**: la cadena de llamadas SÍ está conectada de punta a punta —
`src/run/scheduler.ts:173` llama `commitTopicKey(st, opts.projectId, result.result)` cuando un sub-task termina `completed`, y esto sí escribe en `memory_entries` vía `upsertMemory()`. No es código muerto en el sentido de "nunca se ejecuta", pero el condicional que lo dispara casi nunca se cumple en el uso real de OrchestOS:

```
if (opts.projectId && result.topic_key_written && result.result) {
  commitTopicKey(st, opts.projectId, result.result)
}
```

`result.topic_key_written` viene de `st.topic_key` (`executor.ts:174`), que es un campo **opcional** en el schema de sub-task (`sub-task-schema.ts`): la regla es "cada sub-task necesita `output` (paths de archivo) O `topic_key` (o ambos)". El LLM planificador (`planner.ts`) casi siempre elige `output` porque las tareas reales de OrchestOS son de código (escriben archivos), no "recordar un hecho/decisión" — así que `topic_key` rara vez se declara.

Además, la decomposición en sub-tasks (`createPlan()` en `cli.ts:1095`) **no es el camino por defecto** de `orchestos task run` — solo se activa con el flag explícito `--expand <taskId>`, y solo si la tarea padre ya escribió un `.plan.yaml` en su `output`. Es un modo opt-in, poco usado en la práctica del proyecto.

**Conclusión**: no hay bug que arreglar — es una feature correctamente cableada pero con dos condiciones que casi nunca coinciden en el flujo real: (1) `--expand` rara vez se usa, (2) cuando se usa, el planificador rara vez asigna `topic_key` en vez de `output`. Explica el 0 filas reales en `memory_entries` sin relación con la fuga de fixtures de I.6.

**Decisión pendiente con Carlos**: ¿vale la pena impulsar el uso de `topic_key` (ej. que el planner lo prefiera para sub-tasks de tipo "decisión/investigación" sin output de archivo), o dejarlo como está porque el flujo `--expand` en sí es poco usado y no es prioridad? No implementar nada sin esa decisión.

---

### 30. `task_class: ocr` como primera clase del pipeline de tareas formales

**Origen**: evaluado en Mes 19 Bloque A/D (diseño en `docs/ocr-chat-design.md`) junto con el OCR
del chat, y diferido explícitamente por Carlos (2026-07-09) por falta de caso de uso real dentro
de OrchestOS mismo.

**Qué sería**: nuevo `task_class: ocr` en el schema de `tasks.yaml` — una tarea formal (no del
chat) que recibe una imagen/PDF como input y el output del OCR entra al pipeline normal
(texto → QA → SQLite), igual que cualquier otra tarea.

**Motor recomendado si se implementa**: `tesseract.js` (Apache-2.0, sin GPU, sin cuenta externa —
mismo elegido para el OCR del chat en Mes 19, ver `docs/ocr-chat-design.md`), no
`baidu/Unlimited-OCR` (requiere GPU propia o su Baidu Cloud API, descartada por fricción de
registro).

**Caso de uso original**: CitasBot (imágenes de agenda por WhatsApp) — proyecto separado, no
OrchestOS. Sin evidencia de que OrchestOS mismo necesite tareas formales con imágenes.

**Esfuerzo**: bajo-medio si se usa `tesseract.js` (ya integrado en el chat para entonces) — el
grueso del trabajo sería el cambio de schema, no el motor OCR en sí.

---

### 31. Chat multi-proveedor real + routing granular por función (inspirado en Hermes/Open WebUI) — PINEADO 2026-07-09

**Origen**: Carlos, evaluando el OCR del Chat en Mes 19, preguntó qué pasa si un usuario es
"cliente puro" de Anthropic/OpenAI/otro proveedor sin OpenRouter. Auditoría del código real
(2026-07-09) confirmó una asimetría real:

- **El pipeline de tareas formales (`tasks.yaml`) SÍ es multi-proveedor** — `orchestos.config.yaml`
  permite `provider: anthropic|openai|codex|openrouter` por rol (`planner`/`executor_heavy`/
  `executor_light`/`default`/`qa`, ver `src/config/schema.ts`), despachado por `getProvider()`
  (`src/providers/index.ts`). Pero es "casi manual": `anthropic.ts`/`openai.ts` son wrappers
  directos sin catálogo dinámico — el `model:` se escribe a mano en el YAML, sin buscador, sin
  metadata de capacidades (visión/precio/ventana de contexto) como sí tiene el catálogo de
  OpenRouter (`model-catalog.ts`).
- **El Chat NO es multi-proveedor** — `handleApiChat` llama siempre a `openrouterChat()`
  ([chat.ts:519](../src/dashboard/handlers/chat.ts#L519)), exige `OPENROUTER_API_KEY` sin
  excepción ([chat.ts:115](../src/dashboard/handlers/chat.ts#L115)). Un usuario con solo clave de
  Anthropic o OpenAI directa (sin OpenRouter) **no puede usar el Chat hoy, sin ningún fallback**.

**Referencia externa que Carlos trajo** (captura de la app Hermes, pantalla de "Helper tasks"):
Hermes tiene una fila por función auxiliar — **Vision** (image analysis), **Web extract** (page
summarization), **Compression** (context compaction), **Skills hub** (skill search), **Approval**
(smart auto-approve), **MCP** (MCP tool routing), **Title gen** (session titles), **Curator**
(skill-usage review) — cada una con default "auto · use main model" y un link "Change" para asignar
un modelo dedicado a esa función puntual. Es el mismo patrón conceptual que ya usan los roles de
`orchestos.config.yaml` (planner/executor/qa) — Carlos lo reconoció como algo que "ya estábamos
haciendo", solo que Hermes lo aplica también al lado de proveedor (cada conexión con su propia
base_url/key) y con más granularidad de funciones.

**Qué sería, si se implementa** (dos piezas separables, no mezclar):
1. **Conexiones multi-proveedor para el Chat** — que el Chat pueda usar Anthropic/OpenAI directo
   (no solo vía OpenRouter), con su propio selector de modelos por proveedor (sin catálogo dinámico
   de capacidades salvo que se construya uno propio por proveedor, ya que solo OpenRouter expone
   ese catálogo hoy).
2. **Roles granulares por función, no solo por etapa del pipeline** — hoy los roles son
   planner/executor_heavy/executor_light/default/qa (etapas del harness). El patrón de Hermes
   sugiere roles por *función transversal*: Vision/OCR (relevante para Mes 19), Web extract
   (ya existe como `fetch_url` tool, sin rol de modelo dedicado), Title gen, etc. — cada uno
   opcional, "auto" por defecto.

**Por qué no se resuelve ahora**: es un cambio de arquitectura grande (nuevo concepto de
"conexión" por proveedor, UI de selección de proveedor, catálogo de capacidades sin OpenRouter
para Anthropic/OpenAI directos) — no bloquea el OCR de Mes 19 (Tesseract corre local, sin
depender de ningún proveedor, así que no hereda esta limitación). Se pinea acá para no perderlo,
con la captura de Hermes como referencia de diseño concreta.

**Actualización (2026-07-09) — leído el repo real de Hermes** (`NousResearch/hermes-agent`,
verificado vía `gh api`: MIT, Python, 212K⭐, activo): su `.env.example` (476 líneas) confirma el
patrón exacto que hace esto barato de implementar — **13 proveedores de LLM** (OpenRouter,
NovitaAI, Google AI Studio/Gemini, Ollama Cloud, z.ai/GLM, Kimi/Moonshot, Arcee AI, MiniMax,
OpenCode Zen, OpenCode Go, Hugging Face Inference, Qwen OAuth, Xiaomi MiMo) siguen **el mismo
molde**: `{PROVIDER}_API_KEY` + `{PROVIDER}_BASE_URL` opcional (override del endpoint por defecto,
compatible con el formato OpenAI). Esto quiere decir que la mayoría de proveedores nuevos NO
necesitan un cliente bespoke como `anthropic.ts`/`openai.ts` — **un solo cliente HTTP genérico
"OpenAI-compatible" con `baseURL` configurable** cubriría casi todos, y sería la forma barata de
cerrar el gap de #31 sin escribir un wrapper por proveedor. Fuera de LLM, el mismo repo también
tiene integraciones de plataforma (Slack/Telegram/MS Teams/Google Chat), STT/TTS (relevante para
IDEAS #8, micrófono/dictado), terminal tool con backends SSH/sudo/Modal cloud, y compresión de
contexto automática — todo documentado abajo en "Referencia — inspiración externa" con lo que
aplica y lo que no.

**Esfuerzo**: alto — toca el schema de config, la UI de Settings/API & Models, el selector de
modelos del Chat, y potencialmente un catálogo de capacidades propio por proveedor directo.

### 39. Generalizar el executor `external` — hoy solo detecta `claude`, no `opencode`/`codex`/otros CLIs

**Origen**: Carlos (2026-07-13), tras ver [Orca](https://github.com/stablyai/orca) (Electron, MIT,
detecta y orquesta CUALQUIER CLI de agente instalado — Claude Code, Codex, OpenCode, Cursor, etc.
como subprocesos, no vía API) — "se me abrieron los ojos", si alguien ya paga una suscripción de
Claude/Codex, correrla vía su propio CLI es potencialmente más barata que quemar saldo de
OpenRouter sin vuelta atrás.

**Verificado — OrchestOS YA hace esto, parcialmente, desde Mes 17**: `engine: external`
(`src/run/executors/external.ts`) lanza `claude -p` como subproceso dentro del worktree, con
detección honesta vía `findClaudeBinary()` (`Bun.which('claude')`, expuesto también en
`GET /api/system/engines/external/availability`). El patrón de detección de Orca **ya existe en
OrchestOS**, solo que **hardcodeado a un único binario** (`claude`) — no generaliza a `opencode`,
`codex`, u otros. Cerrar esta idea es extender un patrón probado, no construir uno nuevo.

**Qué hacer**: generalizar `findClaudeBinary()` → `findAgentBinary(name: 'claude'|'opencode'|'codex')`,
un registro de "external agents" conocidos (comando, flag headless, cómo leer su salida), y que
`engine: external` acepte cuál binario usar por tarea. El opencode CLI trae DeepSeek como agente
default — closing este gap habilita exactamente el combo que Carlos quiere probar: "quien ya paga
una suscripción usa su CLI, quien no, usa OpenRouter/API".

**⚠️ Riesgo real, no cosmético — verificado en los Términos de Consumidor de Anthropic
(2026-07-13)**: *"Except when you are accessing our Services via an Anthropic API Key or where we
otherwise explicitly permit it, [you may not] access the Services through automated or non-human
means."* Automatizar `claude` CLI vía un orquestador externo (Orca, o el `engine: external` que
YA existe en OrchestOS) cae en zona gris real — no hay excepción explícita para "automatización
de CLI vía suscripción", solo para acceso vía API key. Anthropic se reserva discreción amplia para
suspender cuentas. **Esto no es exclusivo de Orca — el `engine: external` de OrchestOS YA corre
este mismo riesgo hoy**, simplemente nadie lo había señalado. Si se generaliza a más CLIs, el
riesgo se generaliza igual. No es razón para no hacerlo, pero si se expone en el dashboard,
necesita un aviso explícito al usuario — no silencioso.

**Conecta con**: [#28](#28-terminal-real-en-vez-de-recent-runs-en-el-panel-inferior) (terminal
real embebido — Orca valida que esta dirección es correcta, mismo principio "el CLI real, no un
resumen"). Múltiples chats/worktrees en paralelo (lo que Orca llama "fleet of parallel agents")
es una extensión natural una vez que el terminal real (#28) exista — no vale la pena antes.

**Esfuerzo**: medio — reusa el patrón de detección ya probado; lo nuevo es el registro
multi-agente + el aviso de riesgo ToS en la UI antes de habilitarlo.

### 40. Editor de Constitution — Guardar/Limpiar explícitos, no auto-save silencioso en cada tecla

**Origen**: Carlos (2026-07-13) — escribió "hola" en el editor de Constitution solo para probar y
**se grabó a `CONSTITUTION.md` en disco solo**, sin pedirlo. "Eso no debe ser así — darme la opción
de escribir Y limpiar." Un archivo de basura terminó en el working tree sin intención.

**Verificado en código (2026-07-13)**: `screens-ops.js:141-157` — el `#constitution-editor` tiene
un `input` listener con **auto-save debounced a 1 s**: cualquier tecleo, tras 1 s de pausa, dispara
`PUT /api/project/constitution` que escribe el archivo real. No hay botón de guardar ni de limpiar;
el guardado es un efecto invisible del tecleo. (El tab de Context de al lado ya tiene botonera
—Regenerate/Detect/Index— así que el patrón de acciones explícitas ya existe en la misma pantalla,
solo que Constitution no lo usa.)

**Qué hacer**:
1. Quitar el auto-save por tecla. Reemplazarlo por acciones explícitas: **Guardar** (escribe el
   archivo) y **Limpiar** (vacía el editor; decidir si "Limpiar" solo borra el textarea local o
   además borra el archivo — probablemente pedir confirmación con el `Modal.confirm()` que ya existe
   desde v0.12/A, y nunca borrar el archivo en silencio).
2. Indicador de "cambios sin guardar" (dirty state) para que el usuario sepa que hay algo pendiente,
   en vez del actual "saved" que aparece solo porque se guardó sin pedirlo.
3. Considerar el mismo tratamiento para cualquier otro editor que hoy auto-guarde en cada tecla.

**Esfuerzo**: bajo — es UI de una sola pantalla (mover de `input`-debounce a botón), reusa
`Modal.confirm()` (v0.12/A) y el patrón de botonera que el tab de Context ya tiene al lado.

### 41. Empaquetar OrchestOS como app de escritorio (Electron) — Mac, Linux y Windows

**Origen**: Carlos (2026-07-13) — quiere OrchestOS como app de escritorio nativa para las 3
plataformas, la misma forma de producto que Orca (Electron) y que ya usa en su stack (MusicKind es
Electron). Pregunta explícita: ¿es un movimiento chico o difícil?

**Respuesta honesta, verificada contra la arquitectura real (2026-07-13) — dos mitades muy distintas:**

*La ventana en sí es un movimiento CHICO.* El dashboard ya es un servidor HTTP local
(`Bun.serve`, `server.ts:258`) que sirve un frontend vanilla JS estático en `localhost:PORT`. El
patrón Electron más barato es: el proceso `main` de Electron **lanza el servidor Bun existente como
subproceso** (igual que hoy `orchestos dashboard`) y abre un `BrowserWindow` apuntando a
`http://localhost:PORT`. Cero reescritura del backend o del frontend — se envuelve lo que ya
funciona. Un prototipo "corre en una ventana en mi Mac" es de una tarde.

*Distribuirlo de verdad es medio-alto, por una razón concreta:* **Electron trae Node+Chromium, no
Bun** — y el backend es Bun-específico y no portable a Node tal cual: `Bun.serve`, `Bun.spawn`, y
sobre todo `bun:sqlite` (`src/db/sqlite.ts:1`). No se puede correr el backend dentro del proceso
`main` de Electron. Caminos:
- **(A, recomendado) empotrar el runtime de Bun**: `bun build --compile` produce un binario
  standalone con el runtime + `bun:sqlite` embebidos; Electron lo trae por plataforma y lo spawnea.
  Es el camino que preserva todo el backend tal cual.
- **(B) exigir Bun instalado** en la máquina del usuario — más simple de empaquetar pero rompe la
  promesa de "app de escritorio para no-dev", así que no.
- **(C) portar el backend a Node** — grande y tira a la basura la ventaja de Bun; descartado salvo
  que aparezca otra razón.

Lo que hace el trabajo real de distribución (independiente de OrchestOS): empaquetar con
electron-builder/forge para 3 OSes, **firma + notarización en macOS** (sin eso Gatekeeper lo
bloquea), instaladores, y auto-update. El data dir (`~/.orchestos/`) no cambia.

**Nota — no es idea nueva del todo**: varias entradas de este backlog ya asumen Electron a futuro
(#8 micrófono: "Pila mínima (Electron)"); el stack de Carlos ya lo incluye. Esto solo lo formaliza
como su propio hito.

**Esfuerzo**: **bajo para un prototipo** (BrowserWindow → localhost + spawn de Bun), **medio-alto
para un instalable real firmado** en las 3 plataformas (empotrar el binario Bun compilado + firma/
notarización + auto-update). Candidato a hito propio post-estable, con doc de diseño previo
(decidir camino A vs B, y si el binario Bun se compila en CI por plataforma).

### 42. Auto-repair dirigido tras `failed_permanent` — cerrar el lazo diagnose→reparación

**Origen**: crítica externa de otro LLM (2026-07-13) sobre el motor de OrchestOS, contrastada
contra el código real antes de aceptarla — dos de sus tres puntos ya existen (ejecución híbrida
por sub-tarea vía `executor_model`/`autoRoute`, y checkpoint/reanudación a granularidad de
tarea vía `tasks.yaml`); este es el único hallazgo real.

**Eslabón débil verificado (`src/run/graph-runner.ts:466-501`)**: cuando una tarea agota
`MAX_RETRIES`, `diagnoseTask` (Haiku) clasifica el patrón de fallo y da una `suggestion` —
pero el resultado **solo informa**: `rate_limit` dispara un requeue, cualquier otro patrón
bloquea la rama entera (tarea + todos sus descendientes) y lo escala al humano. La sugerencia
del diagnóstico nunca se usa para intentar un fix dirigido antes de rendirse. El lazo
diagnose→reparación está partido a la mitad.

**Qué hacer** (cuando se aborde, fuera de v0.12 — ver nota de alcance): tras `failed_permanent`
y diagnóstico != `rate_limit`, un intento de reparación dirigido usando la `suggestion` del
diagnóstico como instrucción explícita al sub-agente (ej. "el diagnóstico indica: falta el
import X — corrígelo") antes de bloquear la rama. Solo si ese intento dirigido también falla,
bloquear y escalar como hoy. Escalar de modelo (no bajar a uno más barato — eso fue un error
de la crítica original) si el patrón sugiere que el modelo actual no da para la tarea.

**No hacer**: no confundir con #33 (refuter, que evita gastar un retry ante un falso-fail del
QA) — son puntos distintos del ciclo. #33 es ANTES de reintentar; #42 es DESPUÉS de agotar
todos los reintentos, cuando hoy la única salida es rendirse.

**Alcance**: v0.12 tiene regla dura de cero features nuevas en el motor — este es motor, no
papercut. Candidato v0.13+.

---

## 📚 Referencia — inspiración externa (NO es backlog)

Repos analizados durante Mes 5-8, más adiciones puntuales cuando aparece un repo real relevante
(ej. Hermes Agent, Mes 19). La mayoría de patrones ya están shipeados; esto queda como mapa de
procedencia. Los pendientes vivos: `Design.md condicional` (#6), el molde multi-proveedor (#31).

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
| Refuter en QA loop (v2.0.0) | gentle-ai | ⏳ ver backlog #33 |
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
- **Hermes Agent** (NousResearch, ~212K⭐) — https://github.com/NousResearch/hermes-agent ·
  agente conversacional Python, analizado 2026-07-09 (traído por Carlos, evaluando el OCR del
  Chat de Mes 19). Aportó: el patrón de "helper tasks" — modelo dedicado opcional por función
  transversal (Vision/Web extract/Compression/Skills hub/Approval/MCP/Title gen/Curator, cada
  uno "auto · use main model" por defecto) — ver #31, mismo principio que ya usan los roles de
  `orchestos.config.yaml`, aplicado con más granularidad; y el molde genérico
  `{PROVIDER}_API_KEY`+`{PROVIDER}_BASE_URL` (OpenAI-compatible) que cubre 13 proveedores de LLM
  sin cliente bespoke por proveedor — la forma barata de resolver #31 cuando se implemente. **NO
  aplica** (fuera del alcance de OrchestOS como orquestador local de desarrollo, no un agente de
  uso general): integraciones de plataforma (Slack/Telegram/MS Teams/Google Chat), terminal tool
  con backends SSH/sudo/Modal cloud, browser tool (Browserbase), skill Hyperliquid. **Posible
  candidato futuro, no pineado todavía**: compresión automática de contexto en conversaciones
  largas (relacionado con IDEAS #17, chat multi-sesión + aviso al 75% de contexto) y STT/TTS
  (relacionado con IDEAS #8, micrófono/dictado, ya gated).
  · **Re-verificado con clon del código 2026-07-12 — el claim "aprende solo" ES real pero
  acotado**: aprendizaje procedimental (archivos skill/memoria), NO fine-tuning ni RL. Tres
  mecanismos en código: (a) nudge en system prompt (`prompt_builder.py`): tras tarea compleja
  (5+ tool calls) guardar el approach como skill, y si una skill resulta desactualizada,
  patcharla en el momento; (b) `background_review.py`: fork daemon post-turno que replaya la
  conversación con whitelist de tools solo memoria/skills y decide qué guardar/actualizar —
  el análogo de Dreaming, pero aplicando en vez de solo proponer; (c) `curator.py` +
  `skill_provenance.py`: curación autónoma que **solo consolida/poda skills que el propio
  agente creó** (provenance), skills pineadas protegidas, borrar = archivar recuperable.
  El patrón (c) es la pieza de seguridad que le falta a Dreaming si algún día gradúa de
  proponer a aplicar. La política de cache del fork (mismo modelo → replay completo tibio;
  modelo distinto → digest frío compacto) quedó anotada en #33.
- **Aden Hive / OpenHive** (Aden, YC S2021, ~10.7K⭐ Apache-2.0) — https://github.com/aden-hive/hive
  · framework multi-agente Python "outcome-driven" para producción. **Traído por Carlos
  (2026-07-15) vía outreach en frío** (ver contexto abajo). **PENDIENTE DE ESTUDIO EN OTRA SESIÓN**
  — el ángulo NO es partnership (es un competidor directo bien financiado, no un socio), sino
  *qué patrones concretos de su código pueden ayudar a OrchestOS*, siendo Apache-2.0 legalmente
  legible. Es la articulación mejor financiada de exactamente lo que OrchestOS construye, así que
  vale como benchmark de arquitectura, no como fuente de features nuevas. **ADN compartido
  verificado (2026-07-15)**: "queen" que genera el grafo de agentes desde lenguaje natural (=
  planner con function calling de OrchestOS, S23), DAG con contratos, memoria role-based
  persistente, cost caps / spend enforcement, checkpoint/crash recovery, multi-proveedor vía
  LiteLLM, MCP como capa de tools. **A revisar en la sesión de estudio** (hipótesis, no
  verificado en su código todavía): (a) cómo aísla estado entre workers y el checkpoint-based
  crash recovery — contrastar con el harness actual; (b) su "outcome-driven" (describe el
  resultado, no los pasos) vs. el `tasks.yaml` explícito de OrchestOS — ¿hay algo adoptable sin
  romper "tasks.yaml es la fuente de verdad"?; (c) observabilidad (WebSocket streaming en vivo,
  analytics de costo) vs. el dashboard actual; (d) los 100+ conectores MCP como catálogo de
  referencia para #10 (cliente MCP). **Higiene**: los claims de marketing (logos enterprise sobre
  v0.2.x, ratio forks:stars ~1:2 anómalo, "Richard Tang co-founder" que no cuadra con los
  fundadores YC Vincent Jiang/Timothy Zhang) son ruido de ventas — separar el código real (sólido)
  del outreach (template masivo en frío). El correo pedía a Carlos ser *implementation partner*
  con comisión: descartado, es vender producto de un competidor, opuesto al objetivo de producto
  propio. Solo el código es interesante.

---

### 43. Panel derecho como IDE embebido — diff/explorer con tabs reales en el main, todo DENTRO de OrchestOS

**Origen — palabras textuales de Carlos (2026-07-14), transcritas sin reinterpretar a propósito
(pidió explícitamente que quedaran anotadas así, tal cual, para no tener que repetirlas ni que se
reinterpreten distinto cada vez):**

> Vamos a dejar esto sobre ideas.md algo que tiene que ver con diseño y comportamiento de
> OrchestOS.
>
> 1. Todos los botones que están en la parte superior (sean del aside derecho o izquierdo) el
>    tooltip debe mostrarse hacia abajo.
> 2. Existe un pequeño espacio de 5 pixeles entre el header y la parte superior de la página, no
>    debe tener espacios superiores.
> 3. Al presionar el botón diff debe mostrarme los archivos modificados de la carpeta y los
>    untracked separados, primero los modificados y luego los untracked.
> 4. Al hacer clic en uno de estos archivos (del diff) me va a mostrar dónde están los cambios así
>    como lo hace un IDE, también las ln (líneas) del lado izquierdo, pero esto debe abrirse justo
>    en el espacio del medio como un tab diferente, y es más que obvio que el nombre de este tab
>    será el mismo del archivo.
> 5. Si estoy en el explorer debe mostrar todos los archivos, pero con la diferencia que ahora
>    (así como lo hace VS Code) me mostrará los archivos que fueron modificados y los untracked,
>    copiando tal cual el estilo de VS Code.
> 6. Además, si hago clic en uno de estos archivos podré así mismo ver un tab en el espacio del
>    chat (NO DENTRO DEL CHAT, en el Main) y cuando eso pase así mismo podré ver las líneas del
>    izquierdo y el color respectivo de código como si estuviera en un IDE.
> 7. En la parte del medio (el espacio del main) ahora va a actuar como tabs, es decir habrá un
>    (+) para agregar un nuevo tab, esto con la finalidad de poder ver código, o abrir un nuevo
>    terminal.

**Lectura de Claude (por qué — interpretación, esto SÍ se puede reinterpretar, lo de arriba no):**
Carlos está trabajando activamente en OrchestOS ahora mismo alternando con VS Code abierto en
paralelo para revisar diffs y navegar archivos — el pedido es que esa segunda ventana deje de
hacer falta. Los 7 puntos son un solo movimiento de diseño, no siete features sueltas: **el `main`
deja de ser una sola pantalla fija y pasa a ser un tab strip real** (punto 7), donde el explorer
(punto 5, estilo VS Code: modificados/untracked resaltados en el árbol) y el diff (puntos 3-4)
alimentan ese tab strip con un editor de solo-lectura con gutter de líneas y color de sintaxis
(puntos 4 y 6 piden lo mismo — un visor tipo IDE — desde dos entradas distintas: clic en un archivo
del diff, o clic en un archivo del explorer). El punto 6 aclara un límite importante: el tab abre
en el `main`, nunca dentro del panel de Chat — el chat sigue siendo conversación, el `main` pasa a
ser el espacio de "ver/inspeccionar código". Los puntos 1-2 son papercuts de pulido chicos y no
relacionados al resto (tooltip hacia abajo en vez de a los costados, y un gap de 5px sobre el
header) — se agrupan acá porque llegaron en el mismo pedido, no porque compartan causa con 3-7.

**Qué ya existe (no reconstruir):** el explorer read-only (`GET /api/explorer/tree`+`/file`, un
nivel por request, shipeado en el tramo "Nota de diseño — primer tramo cerrado" de arriba) y el
visor de diff por run (Mes 21/Bloque C, `PLAN.md`) — ya calculan y sirven diffs reales
(`computeFileDiffs`, `parseUnifiedDiff()`), y el explorer ya lista archivos. Lo que falta es (a)
separar modificados/untracked ahí (hoy el árbol no distingue estado git), (b) el tab strip nuevo
en `main` (hoy es una sola pantalla por ruta, sin concepto de "tabs abiertos"), y (c) el visor de
código con gutter+syntax highlighting (hoy el diff se pinta línea por línea +/− pero no hay un
"abrir archivo completo con highlighting" fuera del contexto de un diff).

**Esfuerzo**: alto — no es un papercut, es un cambio de arquitectura del `main` (de "una pantalla
por ruta" a "tab strip con estado de tabs abiertos"), más un motor de resaltado de sintaxis nuevo
(librería, o extender lo que `marked`/highlight ya trae para el chat) y diferenciar
modificado/untracked en el explorer (necesita `git status --porcelain` real, no solo el árbol de
archivos). Candidato a diseño formal (`docs/`) antes de tocar código — mismo patrón que Bloque A
del Mes 18 o Bloque C del Mes 21 (diseño primero, revisado con Carlos, luego implementación).

### 44. Cascada de selección Local → CLI → API — el CLI corre contra la cuenta ya pagada del usuario, no gasta saldo

**Origen**: Carlos (2026-07-15), tras ver de nuevo Orca — quiere que OrchestOS, al elegir cómo
correr una tarea, intente en este orden: (1) **Local** — LLM local si se detecta uno (Ollama ya
soportado como *proveedor*, ver abajo), (2) **CLI** — si el usuario tiene un CLI de agente
instalado (Claude Code, OpenCode, u otro — ya corre contra SU cuenta/suscripción, no contra saldo
medido), (3) **API** — OpenRouter u otro proveedor por API key, **solo como último recurso**,
porque es la opción que más dinero quema.

**Verificado contra el código real (2026-07-15) — los 3 tramos existen por separado, pero NINGUNA
cascada los conecta:**
- **Local**: Ollama ya está soportado, pero únicamente como *proveedor de modelo* dentro del flujo
  API-style (`router/model-catalog.ts`, `dashboard/llm/clients.ts`) — se elige explícitamente un
  `model: "ollama/..."`, no se autodetecta como tramo preferente de una cascada.
- **CLI**: `engine: external` (`src/run/executors/external.ts`, Mes 17) ya ejecuta un CLI de agente
  como subproceso contra la cuenta del usuario — pero está **hardcodeado a un único binario**
  (`claude`, vía `findClaudeBinary()`) y la selección de engine es **siempre manual**
  (`--engine external` / composer del dashboard), nunca automática. Generalizar a más binarios
  (`opencode`, `codex`) es exactamente [#39](#39-generalizar-el-executor-external), que ya cubre
  el registro de agentes y el riesgo de ToS de automatizar un CLI de suscripción — **prerequisito
  de este ítem**, no un sustituto: #39 generaliza QUÉ binarios se detectan, #44 decide EN QUÉ
  ORDEN se prueban, automáticamente.
- **API**: es el único tramo con selección real hoy — y es manual también (`orchestos.config.yaml`
  o decisión explícita de Carlos por corrida).

**⚠️ Tensión real con [[feedback-modelo-decision-final-carlos]] — no la resuelvo yo, la anoto**:
esa regla nació de un incidente de $5 quemados y dice que el modelo/engine de una corrida
**siempre lo decide Carlos explícitamente — ningún LLM lo decide ni lo arrastra de memoria**. Una
cascada automática Local→CLI→API es, por construcción, una decisión de engine tomada por el
sistema, no por Carlos en el momento. Antes de implementar, esto necesita una decisión explícita
de Carlos: ¿la cascada es el *default* que él puede overridear, o sigue exigiendo confirmación
manual por corrida como hoy? Sin esa respuesta, el ítem no se toca.

**Dificultad arquitectónica (verificada, no solo intuida por Carlos)**: el `router/` (pricing,
`model-catalog.ts`, cost tracking en `transcript-parser.ts`) fue diseñado asumiendo que el costo en
USD por token es la unidad universal de medición — todo `ExecutorOutcome` reporta
`inputTokens`/`outputTokens`/`usd`. Un tramo Local o CLI-por-suscripción no tiene ese costo real
(o es $0, o está fuera del medidor). Introducir tramos "gratis-ish" cruza selección de engine,
catálogo de modelos, y tracking de costo simultáneamente — no es un feature aislado como #39.

**Qué hacer (no antes de la decisión de Carlos arriba)**:
1. Cerrar #39 primero (registro de binarios CLI detectables).
2. Definir cómo se reporta costo real de un tramo Local/CLI en `ExecutorOutcome` (¿`usd: 0` con un
   flag `costFree: true`? ¿no medir en absoluto?) — decisión de diseño, no trivial.
3. Función de detección en orden (`selectEngineCascade()`): Ollama local disponible → binario CLI
   conocido disponible → fallback API. Expuesta en dashboard/CLI como lo que decidió, nunca
   silenciosa (mismo principio que C.2 del engine external: "detección honesta").
4. Decidir el punto de override manual (composer del dashboard / flag CLI) para cuando Carlos
   quiere forzar un tramo específico pese a la cascada.

**Esfuerzo**: medio-alto — depende en gran parte de la respuesta de Carlos a la tensión de arriba;
si la cascada es solo un *default* con override siempre visible, es medio; si tiene que coexistir
con la regla de decisión-explícita-siempre, es más diseño que código.

### 45. Visibilidad de gasto real — cuánto se gastó, si vino de API o CLI, cuota de LLM restante

**Origen**: Carlos (2026-07-16), al confirmar que el chat puede crear+correr tareas solo sin pedir
confirmación (Bloque D.7 de PLAN.md/Mes 22) — aclaró explícitamente: **no quiere un límite/tope de
gasto** (eso no se implementa), lo que sí necesita siempre es **saber cuánto se gastó**, distinguir
si el gasto vino de **consumo de API medido en USD** o de una corrida por **CLI contra una cuenta
ya pagada** (sin costo marginal medible, pero con cuota/tiempo de uso que si se agota bloquea), y
ver ese **tiempo/cuota restante por LLM** cuando aplica.

Toca la misma tensión ya documentada en [#44](#44-cascada-de-selección-local--cli--api--el-cli-corre-contra-la-cuenta-ya-pagada-del-usuario-no-gasta-saldo) ("Dificultad arquitectónica"): el `router/`
asume que el costo en USD por token es la única unidad de medición (`ExecutorOutcome.usd`); un
tramo CLI-por-suscripción no tiene ese costo real. Antes de resolver #44 (la cascada automática)
hace falta esto: una forma de reportar/mostrar gasto que sepa distinguir "$X consumidos de saldo
API" de "N llamadas contra una cuota de suscripción, quedan Y" — sin eso, correr tareas solas
(D.7) es gastar a ciegas en el tramo API.

**Qué hacer**: (1) decidir el modelo de dato — `ExecutorOutcome` necesita un campo de tipo de gasto
(`usd` vs `quota`), no solo `usd`; (2) superficie en dashboard: un total visible de gasto USD
acumulado + si hay CLI activo, su cuota/tiempo restante (si el binario expone esa info — investigar
qué exponen `claude`/`opencode`/etc, puede no ser trivial); (3) CLI: mismo dato por `orchestos
run status` o similar.

**Esfuerzo**: medio — el modelo de dato y la superficie en dashboard son alcanzables; la parte de
"cuota restante de un CLI de terceros" depende de qué exponga cada binario, puede no ser posible
para todos.

### 46. Graphify — grafo de codebase consultable para que los agentes dejen de hacer grep repetido

**Origen**: encontrado en el vault (`MemoriesMD/wiki/tools/graphify.md`, ingerido 2026-07-16;
repo github.com/Graphify-Labs/graphify, 4k stars, MIT). Skill + CLI que convierte una carpeta
(código, SQL, docs, PDFs) en un **grafo de conocimiento** consultable en vez de índice vectorial.
El código se parsea localmente con tree-sitter (AST), sin LLM, nada sale de la máquina; solo
docs/imágenes usan el modelo. Cada edge etiquetado `EXTRACTED` (explícito en la fuente) vs
`INFERRED` (resuelto por graphify) — distingue lo leído de lo inferido. Se consulta con
`graphify explain "X"`, `graphify path "A" "B"`, `graphify query "pregunta"`; expone MCP server
(`python -m graphify.serve`).

**Por qué encaja con OrchestOS (candidato de arquitectura, no urgente)**:
- Hoy los agentes orquestados entienden el código haciendo `read_file`/grep repetido — devuelve
  bloques crudos que inflan el contexto. Un `graphify query` da una respuesta acotada y
  estructurada. **Ataca directamente el mismo modo de fallo que cerró Mes 22/Bloque A ([#32](#32),
  cap de outputs de tools)**: en vez de truncar un `read_file` gigante, se evita pedirlo.
- OrchestOS ya tiene su propio grafo de código (`graph/`, S21, resuelve C#) y `context suggest`
  (S24) — así que esto NO es adoptar una dependencia nueva a ciegas: es un candidato para
  **comparar** contra lo propio (¿graphify da mejor recall/confidence-tagging que el grafo
  actual?, ¿vale exponerlo como engine de contexto o robar solo el etiquetado EXTRACTED/INFERRED?).
- El MCP server lo haría exponible como herramienta para los agentes, sin acoplar su binario.

**Escepticismo honesto (de la ficha del vault)**: los benchmarks (LOCOMO recall@10 0.497,
LongMemEval-S 76%) son **auto-reportados** por el proyecto, no independientes — tratar como
cualquier claim de marketing propio. Tiene producto comercial derivado (Penpax) en waitlist; el
repo en sí es MIT y funcional aparte de eso.

**Qué hacer (cuando se retome, no ahora)**: (1) correr `graphify . ` sobre el propio repo de
OrchestOS y comparar `graphify query` contra el `context suggest` actual sobre las mismas
preguntas; (2) decidir si se adopta como engine de contexto, se expone como MCP a los agentes, o
solo se roba el patrón de etiquetado EXTRACTED/INFERRED para el grafo propio. No adoptar sin ese
A/B — OrchestOS ya tiene grafo, la pregunta es si este es mejor, no si "grafo" es buena idea.

**Esfuerzo**: bajo para el spike de comparación (instalar + correr + un puñado de queries);
medio-alto si se decide integrarlo como engine de contexto real de los agentes.

### 47. Auto-split por tamaño estimado, no por número de archivos

**Origen**: destapado corriendo C.1 en vivo (2026-07-16, ver PLAN.md Bloque E). El gate de
auto-split (`shouldSplit` en `harness.ts`) decide si invocar al planner (Haiku) para partir una
tarea en sub-tareas midiendo `output.length × SPLIT_AVG_TOKENS_PER_FILE (2048)` contra
`maxTokens × 0.7`. El problema: **mide por NÚMERO de archivos, no por tamaño real esperado**. Una
tarea de UN archivo premium (HTML+CSS+JS autocontenido, o un componente grande) da
`1 × 2048 = 2048` → nunca supera el umbral → nunca se parte, aunque el output real sea 20-30k
tokens. Resultado: el planner que Carlos puso justamente para "dividir tareas grandes en varias
llamadas y no quemar todo en una" no se invoca para el caso que más lo necesita.

**Por qué NO es urgente ahora**: el fallo inmediato (truncado a 8192) lo resuelve E.1 (quitar el
clamp arbitrario → deepseek recupera su presupuesto de ~1M, el archivo único entra sin partir).
Así que esto no bloquea la corrida premium de C.1. Pero sigue siendo una mejora real: para un
archivo genuinamente enorme (más grande que la ventana de salida real del modelo), partir en
varias llamadas es la única salida — y hoy el gate no lo detecta.

**Complicación honesta**: un HTML autocontenido **no se puede** partir en sub-tareas (es un solo
archivo por diseño). El split por tamaño solo tiene sentido cuando la tarea produce varios
archivos (React+TS+Vite, el C.2 original) o cuando se puede pedir el archivo en secciones y
concatenar. Estimar el tamaño de salida ANTES de generarlo es intrínsecamente difícil (no hay
forma exacta sin generar) — probablemente una heurística por tipo de tarea/skill (una landing
premium ≈ N tokens) o una primera llamada de "esqueleto + estimación" antes de comprometerse.

**Qué hacer (cuando se retome)**: (1) reemplazar/complementar el conteo de archivos con una
estimación de tamaño (heurística por skill, o señal del planner); (2) definir qué hacer cuando el
output no se puede partir (un solo archivo que excede la ventana real) — ¿pedir en secciones?,
¿rechazar con mensaje claro en vez de truncar? Conecta con [#32](#32) (cap de outputs) y con el
Bloque E de PLAN.md.

**Esfuerzo**: medio — la estimación de tamaño es el núcleo difícil; el resto es wiring sobre el
`shouldSplit`/`generatePlan` que ya existen.

### 48. ~~Carrera real entre auto-commit de tasks.yaml (D.5/D.7) y el merge-back del worktree sandbox~~

**RESUELTO — PLAN.md Bloque E.5 (2026-07-16).** Se reprodujo una tercera vez (misma tarea,
`crypto-dashboard-v2`, mismo `git merge ... failed after rebase`) y se resolvió de raíz: mutex de
archivo entre procesos (`src/run/git-lock.ts`, `withGitLock()`) que serializa `mergeWorktreeBack()`
contra los auto-commits de `tasks.yaml` (D.5/D.7) — ambos tocan `projectRoot` (checkout/commit/merge
sobre el mismo working dir), nunca pueden intercalarse. Verificado con un test de concurrencia REAL
entre dos subprocesos del SO (no solo dos llamadas en el mismo proceso, que habrían sido
trivialmente secuenciales por ser JS de un hilo) — confirmado que sin el lock las ventanas se
solapan y con el lock no. Detalle completo → PLAN.md Bloque E.5.

### 49. Visibilidad en vivo de lo que el agente está haciendo — no solo el resultado final

**Origen**: Carlos (2026-07-16), tras la cadena de fixes E.1-E.10 de hoy — pidió explícitamente
poder "ver" qué está haciendo el modelo mientras trabaja en una tarea, no solo enterarse al final
si falló o no. Comparación explícita con cómo el propio Claude Code narra su proceso en el chat
(qué archivo lee, qué comando corre, qué decide) — "sino el usuario como sabe que OrchestOS
realmente está haciendo algo".

**El problema real que esto ataca**: hoy una tarea corre en un subproceso completamente opaco
(`Bun.spawn(['bun','run','src/cli.ts','task','run','--id',...])`) — el dashboard no muestra nada
mientras corre, solo el estado final (`done`/`failed`) cuando termina. Para el no-dev (el usuario
objetivo de OrchestOS), un sistema que "no muestra nada por 30-60 segundos y después dice si
funcionó o no" es indistinguible de uno que no está haciendo nada — no genera confianza, y hace
que debuggear un fallo (como los de hoy) dependa 100% de leer logs después del hecho.

**Dónde debería verse (pedido explícito)**: idealmente DENTRO del chat mismo cuando el auto-flow
(D.7) crea y corre una tarea — el usuario ve el progreso ahí, no solo la nota final
(`▶ Started task...`). También aplica a la pantalla Tasks/Runner existente.

**Qué hacer (no investigado en profundidad, requiere diseño)**:
1. El harness (`src/run/harness.ts`) ya tiene puntos de log internos (`log.info(...)`, ver
   `sandbox: worktree created...`, `auto-split: ...`, etc.) — hoy van a stdout del subproceso
   (visible solo en la terminal si corres el dashboard con `stdout: 'inherit'`), nunca al
   dashboard/chat.
2. Necesita un canal de streaming del subproceso `task run` hacia el frontend — opciones: (a)
   SSE/WebSocket desde el endpoint que spawnea la tarea, reenviando líneas de `log.info` en vivo;
   (b) polling del estado de la tarea con un campo "current step" que el harness actualiza en la
   DB conforme avanza (más simple, sin infra de streaming nueva); (c) si se resuelve el chat
   auto-flow (D.7), inyectar esas actualizaciones como mensajes intermedios en `chatHistory`.
3. Mínimo viable: mostrar la etapa actual (ej. "generando código...", "verificando con QA...",
   "corriendo checks...", "guardando cambios...") — no hace falta el output crudo del LLM en vivo,
   con las etapas del harness ya alcanza para responder "¿está haciendo algo?".

**Esfuerzo**: medio — el mecanismo de streaming/polling es la parte nueva; las etapas ya existen
como eventos internos del harness, solo hace falta exponerlas.

### 50. Chat persistente con sesiones acotadas (máx ~20) — no copiar el patrón de chats infinitos

**Origen**: Carlos (2026-07-17), decisión de diseño de producto explícita — NO quiere copiar el
patrón de la industria (Claude Desktop, ChatGPT, Codex: historial infinito de conversaciones que
nadie vuelve a abrir). Dos partes:

**(a) Bug/gap verificado en código**: `chatHistory` vive SOLO en memoria JS (`app.js:80`,
`state.chatHistory: []`) — ni localStorage ni SQLite. Al refrescar la página se pierde TODA la
conversación. OrchestOS ya tiene SQLite local como DB — no hay razón para que el chat sea efímero
cuando la memoria del sistema (tabla `memory`, `runs`) ya persiste todo lo demás. "De qué sirve
tener memoria si no la ocupo en esto" (Carlos, literal).

**(b) Sesiones con límite duro (~20, configurable)**: en vez de historial infinito, un máximo de
~20 conversaciones. Al llegar al tope: la más vieja se archiva/borra (política a decidir — puede
ser FIFO automático con aviso, o pedir al usuario elegir). Racional de Carlos: la mayoría de
usuarios jamás regresa a un chat viejo; sesiones infinitas solo acumulan ruido. Contexto de la
industria (investigado 2026-07-17): los proveedores guardan todo porque (1) almacenar texto es
casi gratis y borrar cuesta confianza del usuario, (2) en planes consumer las conversaciones
pueden usarse para entrenamiento (ChatGPT por defecto con opt-out; Anthropic pide consentimiento
explícito desde 2025) — OrchestOS no entrena nada, así que ese incentivo no aplica: puede
permitirse el diseño más honesto (límite + persistencia local).

**Distinción técnica clave para el diseño** (por qué "el LLM te pide abrir chat nuevo"): guardar
el historial es barato; RE-ENVIARLO al modelo en cada mensaje es lo caro — cada turno re-manda
toda la conversación, y un chat largo degrada calidad y quema tokens. Son dos problemas distintos:
persistencia (disco, resuelve (a)) vs. ventana de contexto (modelo, ya cubierto por el aviso de
límite existente en el chat + [[feedback-no-compactar-contexto]]: nunca comprimir a ciegas, avisar
y cortar a sesión nueva — que con (b) se convierte en "avisar y abrir una de las 20 sesiones").

**Refinamiento de Carlos (2026-07-17)**: mostrar **15 sesiones en el nav izquierdo**; al superar
el tope, la más antigua NO se borra — se mueve completa a un tab de "archivadas". El problema
central no es mover de posición sino **medir el contexto por chat con varios modelos**.

**Cómo medir el contexto por chat (la maquinaria YA existe, verificado en código)**:
- `estimateTokens()` (chars/4) + `contextWindowFor(model)` del catálogo — es exactamente lo que
  `handlers/chat.ts:559-586` ya calcula por request para decidir si la respuesta cabe.
- **Insight clave**: "qué tan lleno está un chat" NO es una propiedad del chat — es relativa al
  MODELO ACTIVO. La misma conversación de 150k tokens está al 75% en Haiku (200k) y al 14% en
  deepseek-v4-flash (1M). El medidor se recalcula al cambiar el modelo del combo, no se guarda
  como número fijo por sesión.
- Umbral: la propia regla del 70% que Carlos ya usa consigo mismo ([[feedback-limite-contexto-70]])
  aplicada como producto — al cruzar 70% de la ventana del modelo activo, aviso visible +
  ofrecer "continuar en sesión nueva". Nunca compactar en silencio.

**Hallazgo real al investigar esto (2026-07-17)**: el chat HOY trunca en silencio —
`handlers/chat.ts:347` hace `rawHistory.slice(-10)`: solo los últimos 10 mensajes viajan al
modelo, los anteriores se descartan sin avisar. Eso contradice [[feedback-no-compactar-contexto]]
(nunca degradar en silencio) y explica por qué el chat "olvida" cosas de la misma conversación.
Al implementar #50, esa línea debe reemplazarse por el presupuesto real de contexto (mandar todo
lo que quepa bajo el 70%, avisar cuando no quepa) — no un número mágico de mensajes.

**Qué hacer**: (1) tabla `chat_sessions` + `chat_messages` en SQLite (mismo patrón que `runs`);
(2) nav izquierdo con 15 sesiones + tab "archivadas" para las que pasen el tope; (3) al
refrescar, restaurar la sesión activa; (4) medidor de contexto por sesión relativo al modelo
activo, umbral 70%, con CTA "continuar en sesión nueva" (resumen corto opcional, nunca
compactación silenciosa); (5) eliminar el `slice(-10)` a favor del presupuesto real.

**Esfuerzo**: medio — el modelo de datos es simple (SQLite ya está); el grueso es la UI de
sesiones en el chat y el medidor por modelo activo.

---

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
