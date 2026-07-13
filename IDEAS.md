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

- ~~**#23 — Sistema de notificaciones/toasts estilizado**~~ — Resuelto en E.7 (2026-07-07): todos los `alert()`/`prompt()` reemplazados por `showToast()` + modales propios.

### 36. `defaultChecksFor` — validar sintaxis JS embebida en HTML, no solo `.ts`/`.tsx`

**Origen**: hallazgo real en Mes 20/C.1 (2026-07-13) — el archivo `.html` generado tenía un
error de sintaxis JS (`:` donde iba `+` en una concatenación) que rompía el script entero.
Ni `test -s` (¿existe, no vacío?) ni `grep` (busca texto) lo detectan, y el juez QA (`qa.ts`)
tampoco corre el código, solo lo lee — el mismo gap que `checks.ts` ya documenta para
TS/tsc, pero sin cobertura para `.js`/`.html`. Se encontró abriendo la página de verdad en
el navegador, no por ningún check automático.

**Qué hacer**: en `defaultChecksFor` (`src/run/checks.ts`), cuando `output` incluye `.html`
o `.js`, agregar un check que extraiga el/los `<script>` inline (o el archivo `.js` directo)
y corra `node --check` sobre eso — detecta errores de sintaxis sin ejecutar el código (sin
riesgo), mismo principio que el check de `tsc --noEmit` ya existente.

**Esfuerzo**: bajo — una función de extracción de `<script>` + un `Check` más en la lista
condicional, sin motor nuevo.

---

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

### 38. El Chat no renderiza Markdown — se ve `**bold**`/`### header` literal, no formateado

**Origen**: Carlos (2026-07-13) notó que las respuestas del LLM en el Chat muestran la sintaxis
Markdown cruda (`**Para el dashboard 3D:**`, `### ¿Qué hacer ahora?`) en vez de renderizarse
como texto con jerarquía visual — quiere que se vea como las respuestas de Claude Code: bold,
headers, listas, código inline, todo formateado. También quiere que referencias a task-id y
nombre de modelo dentro de la respuesta se resalten visualmente (ej. `crypto-dashboard-3d-premium`
y `deepseek/deepseek-v4-flash` como chips/badges, no texto plano).

**Verificado en código**: `screens-core.js` (chat message render) hace
`esc(m.content).replace(/\n/g, '<br>')` — escapa TODO el texto y solo convierte saltos de
línea a `<br>`. **Cero parseo de Markdown.** Confirmado también que no hay ninguna librería de
Markdown en el proyecto (`grep` de `marked`/`markdown-it` en `package.json` y en todo
`dashboard/public/*.js` → vacío) — es una feature nueva, no un bug de una librería mal cableada.

**Qué hacer**:
1. Agregar un parser de Markdown ligero (ej. `marked` — MIT, cero dependencias runtime pesadas)
   y renderizar `m.content` a HTML sano en vez de solo escapar+`<br>`. Sanitizar con la misma
   disciplina que ya usa el proyecto (`esc()`) — el contenido del LLM nunca es 100% confiable,
   mismo principio que el wrapper "dato externo" de `fetch_url`/OCR (Mes 13/19).
2. **Highlight de task-id y modelo** — más específico que Markdown genérico: un regex/patrón
   que detecte menciones de `task_id` conocidos (contra `state.tasks`) y nombres de modelo
   (contra el catálogo) dentro de la respuesta del LLM, y los envuelva en un chip visual
   (mismo estilo `.badge`/`.chip` que ya usa el dashboard en Tasks/Runs) — para que un usuario
   como Carlos vea de un vistazo "esto es una tarea real, esto es un modelo real" sin tener que
   leerlo como texto plano.

**Esfuerzo**: bajo (Markdown genérico, una librería + wiring) a medio (el highlight de
task-id/modelo específico, que es lógica nueva, no solo estilo).

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

### 32. Presupuesto de outputs de tools en el executor agéntico — el hueco que dispara `pending` por contexto

**Eslabón defectuoso verificado (2026-07-11)**: en `src/run/executors/agentic.ts`,
`read_file` devuelve el archivo **completo sin cap de tamaño** (línea ~116) y `run_check`
mete stdout/stderr **enteros** al historial (línea ~158). Ningún punto del pipeline trunca
o comprime outputs de tools antes de que entren a `messages[]`. Un archivo grande o un
check verboso infla el prompt hasta que `contextWindow − prompt` ya no da para maxTokens
→ pending automático (la regla de `feedback-context-no-max-tokens`). Es el mismo modo de
fallo que pausó la prueba de "página premium" (React+TS+Vite).

**Qué hacer** (nativo en TS, sin dependencias):
1. **Cap duro por tool-result** (ej. ~20-30k chars) con marcador `[...truncado: N chars
   omitidos de M]` — la mitigación del 80% en una tarde.
2. **Truncado inteligente para `run_check`**: conservar cabeza + cola de stdout/stderr
   (los errores casi siempre viven al final), no solo la cabeza.
3. (Opcional, después de evidencia) compresión estadística de resultados JSON tipo
   "SmartCrusher": conservar primeros/últimos items + anomalías + matches relevantes al
   query. Solo si (1)+(2) no bastan.

**Origen**: patrón Headroom (`chopratejas/headroom`, visto vía awesome-llm-apps).
**Verificado**: la librería es Python — NO portable directo; lo que se toma es la técnica,
implementada nativa sobre el executor propio. Los demos del repo awesome-llm-apps son
wrappers, no código original.

**Esfuerzo**: bajo para (1)+(2) — un módulo `capToolOutput()` + tests, se inyecta en los
4 tools de `agentic.ts` y en el executeTool del chat. (3) es medio y espera evidencia.

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

---

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
