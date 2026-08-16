# IDEAS.md — OrchestOS

Backlog accionable. De aquí sale el próximo PLAN.md.

- Dirección de producto y norte estratégico → [VISION.md](VISION.md)
- Lo ya implementado → [DONE.md](DONE.md)
- Estructura de trabajo activa → [PLAN.md](PLAN.md)

Reorganizado: 2026-07-29. Desde este momento, el índice siguiente es el **único orden de
ejecución**. Las secciones detalladas que aparecen más abajo conservan contexto histórico y no
constituyen otro orden.

## 🧭 Backlog canónico por esfuerzo — fase de dogfooding

Objetivo operativo: desde 2026-07-30 trabajar únicamente estas ideas, en orden. Después de cerrar
este backlog comienza la prueba real de OrchestOS durante aproximadamente un mes; no se agregan
features nuevas durante esa fase salvo bugs que impidan usar el producto.

Regla permanente: toda idea nueva debe tener exactamente una categoría de esfuerzo. Se agrega al
final de su categoría, nunca se inserta por preferencia. Si cambia su estimación, pasa al final de
la nueva categoría y conserva su historial.

### Mínimo

_(vacía — `#1` graduado a PLAN.md § Mes 25 / Bloque N el 2026-07-30)_

### Bajo

_(vacía — `#2` graduado a PLAN.md § Mes 26 / Bloque Q el 2026-08-06; `#3` a Bloque R el 2026-08-06;
`#5` a Bloque S el 2026-08-06; `#19` a Bloque T el 2026-08-06; `#40` a Bloque U el 2026-08-07; `#46`
a Bloque V el 2026-08-08; `#58` a Bloque W el 2026-08-08 — categoría Bajo completa, Mes 26 cierra)_
2. `#59` Etiquetar `code_edges` con `EXTRACTED`/`INFERRED` en `graph/` propio.

### Bajo-medio

1. `#4` Clasificador semántico para `clarify`.
2. `#30` `task_class: ocr`.
3. `#51` Acciones por mensaje: **rebobinar** (copiar + timestamp ya implementados, Bloque Z,
   2026-08-12 — bloqueado por las sesiones persistentes, hoy en PLAN.md § Mes 29 / CC.2).

_(`#33` graduó a Bloque X el 2026-08-10; `#37` graduó a Bloque Y el 2026-08-10 — categoría
Bajo-medio en curso, Mes 27)_

### Medio

1. `#7` Brainstorming socrático.
2. `#14` Notificaciones en segundo plano.
3. `#16` Escala honesta de DB, `input[]` y `cli.ts`.
4. `#25` Agente automático de documentación.
5. `#26` Spec Kit.
6. `#29` Impulsar `topic_key` en sub-tasks.
7. `#34` `orchestos audit`.
8. `#45` Visibilidad de gasto real.
9. `#47` Auto-split por tamaño estimado.
10. `#55-B` models.dev como fallback del catálogo (fuera de OpenRouter).

_(`#6` graduó a Bloque AA el 2026-08-15. `#31`, `#35` y `#50` fueron ABSORBIDAS por PLAN.md § Mes 29
(orquestador real) el 2026-08-16 — eran partes de un mismo eje estructural, no ideas sueltas.)_

### Medio-alto

1. `#8` Micrófono/dictado.
2. `#28` Terminal real embebido.
4. `#41` App Electron distribuible.
5. `#42` Auto-repair dirigido.
6. `#57` Cuota semanal de suscripciones CLI.
7. `#60` Extracción a nivel de función/símbolo en `graph/` propio (tree-sitter).

### Alto

1. `#10` Cliente MCP.
2. `#11` KuzuDB.
4. `#43` Panel derecho como IDE embebido.
5. `#52` Lenguaje visual premium completo.
6. `#56` Workspace multiagente paralelo.
7. `#54` Mutation testing — adopción como gate del producto (el spike ya se graduó a PLAN.md § Bloque K / K.5).

### Reconciliadas y fuera del backlog

- `#27`, `#32` y `#36`: graduadas a PLAN y cerradas según DONE/PLAN.
- `#39`: **REABIERTO (2026-07-31) — el índice decía "cerrada en G.4.2/G.4.2b" y es impreciso.**
  G.4.2 cerró solo la mitad: **detección** (`cli-registry.ts`, `KNOWN_CLIS`). La otra mitad del
  ítem original — que `engine: external` pueda **invocar** el CLI detectado, no solo listarlo —
  sigue sin hacer. Evidencia: `kimi` está en `KNOWN_CLIS` pero **no** en
  `ExecutorMode` ([schema.ts:23](src/config/schema.ts)) — ni con el binario real instalado hay
  forma de configurar `executorEngine: cli-kimi`. `engine-cascade.ts` solo sabe usar Claude Code
  como tier `cli`; `opencode`/`codex`/`kimi` quedan documentados a propósito como pendientes. Ver
  cuerpo del ítem #39 más abajo, corregido con el diseño validado de Orca (registro +
  `promptInjectionMode`).
- `#44`: cascada de selección cerrada en el Bloque G.
- `#49`: visibilidad en vivo cerrada en G.3.
- `#55-A`: catálogo `models.dev` para opencode cerrado en G.4.5.

Las entradas anteriores a `#43` que sigan apareciendo abajo son detalle histórico; las entradas
`#43–#57` se mantienen abajo porque contienen especificación extensa, pero el índice de arriba
manda. Las superficies que agregan shell, filesystem, MCP o ejecución externa (`#10`, `#28`, `#35`)
requieren declarar límites y pasar revisión de seguridad antes de implementarse.

**Nota de diseño — primer tramo cerrado (2026-07-13), con capturas reales de Carlos** (Claude
Desktop/Codex/Orca/Hermes): rediseño del header + panel derecho (explorer/terminal/diff), un
solo ícono estático panel-left/panel-right (sin flecha que cambia con el estado), `localhost:4242`
eliminado del header, terminal reubicado del footer fijo a una pestaña del panel derecho, y un
explorador de archivos read-only nuevo (`GET /api/explorer/tree`+`/file`, un nivel por request).
El resto del "estándar visual" (burbujas de chat, pantallas de Settings/Config) sigue siendo
semilla de v0.13 — no tocado en este tramo.

---

## ⚡ Rápido — autoría sobre puertas que ya existen (casi sin código nuevo)

Estos items se entregan por la **puerta "importar" del curador** (Mes 11, ✅) o como
upgrade de skills existentes. No requieren motor nuevo — son contenido endurecido que
entra por infraestructura ya probada. Independientes entre sí.

Son el resto del delta identificado en [obra/superpowers](https://github.com/obra/superpowers)
y [mattpocock/skills](https://github.com/mattpocock/skills); el curador + pack "pro"
(8 skills) ya está shipeado (Mes 11, ver DONE.md § MES 11).

## 🔨 Medio — capacidad nueva acotada

### 4. Clasificador semántico para `clarify`

Hoy `needsClarify` es heurística de palabras clave (verbo ambiguo + sin `input[]`). Un LLM
call extra (haiku, barato) detectaría ambigüedad real semánticamente.

**Costo**: un call por task run. **Solo vale la pena si hay evidencia de falsos negativos.**

**Esfuerzo**: bajo-medio — un call + parseo, pero gated en evidencia real.

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

**Corrección de alcance (2026-07-31) — verificado contra el código real de Orca, no contra
suposición.** Pregunta de Carlos: "hoy existen ya muchos CLIs (Kimi CLI, GLM, etc.) — ¿cómo lo
resuelve un sistema profesional?". Se investigó el repo público de Orca
(`github.com/stablyai/orca`, MIT) en vez de reinventar:

- **`src/shared/agent-kind.ts`** — registro plano, **34 agentes** conocidos, un `Record` literal.
  El propio comentario del archivo: *"Centralizing here means a new TuiAgent member is one edit,
  not a sweep across renderer + main."* — el mismo principio que ya rige `cli-registry.ts`
  ([[feedback-deteccion-generica-no-por-cli]]), a mayor escala.
- **`src/shared/tui-agent-config.ts`** — esto es lo que le faltaba al diseño de OrchestOS: la capa
  de **invocación** (Capa 3 — no solo "¿está instalado?" sino "¿cómo le paso el prompt?") también
  se resuelve con datos, no con una función nueva por CLI. Campo clave:
  `promptInjectionMode: 'argv' | 'flag-prompt' | 'flag-prompt-interactive' | 'flag-interactive' |
  'hermes-query' | 'stdin-after-start'` — un enum de **6 estrategias conocidas** de cómo un CLI
  recibe el prompt. Agregar un CLI nuevo (Kimi, GLM, el que sea) normalmente es rellenar el
  registro y elegir cuál de esas 6 estrategias ya existentes aplica — código nuevo solo en el caso
  raro de una estrategia realmente distinta.
- **Settings → Agents → Add custom agent** (`onorca.dev/docs/agents/custom-cli`, doc pública): el
  usuario declara un CLI propio (nombre, binario, args por defecto, hook de inicio previo) **sin
  tocar el código fuente de Orca**. Confirma que la lista curada en código y la extensión por el
  usuario son capas separadas — patrón validado en producción, no invención propia.

**Traducción concreta a OrchestOS, con lo que ya existe vs. lo que falta:**

| Pieza de Orca | Estado en OrchestOS |
|---|---|
| `agent-kind.ts` (registro plano) | Existe: `cli-registry.ts` / `KNOWN_CLIS` (4 entradas) |
| `tui-agent-config.ts` + `promptInjectionMode` | **No existe** — la invocación de Claude está ad-hoc en `external.ts`, no como dato parametrizado; sin esto, generalizar a `opencode`/`codex`/`kimi` significa repetir código, no rellenar registro |
| Settings → Add custom agent | **No existe** — sería `extra_clis:` en `orchestos.config.yaml`, mergeado con `KNOWN_CLIS` en `detectInstalledClis()` |

**Qué hacer, reemplazando el "Qué hacer" original de este ítem:**
1. `ExecutorMode` deja de ser un enum cerrado por CLI (`'cli-claude' | 'cli-opencode' |
   'cli-codex'`) — se deriva del registro, no se lista a mano (cierra el gap de `kimi` encontrado).
2. `cli-registry.ts` gana un campo tipo `promptInjectionMode` (empezar con 2-3 modos reales:
   los que ya cubren `claude` vía `-p` y lo que use `opencode`/`codex`; no importar los 6 de Orca
   sin evidencia de que hacen falta acá — agregar el modo cuando aparezca el CLI que lo necesite).
3. `orchestos.config.yaml` admite `extra_clis: [{id, binary, label}]`, mergeado en
   `detectInstalledClis()` — vos agregás el próximo CLI que salga sin esperar un commit al repo.
4. `engine-cascade.ts` deja de tener a Claude Code hardcodeado como único tier `cli` — recorre el
   registro y usa el primero instalado con invocación conocida.

**Relación con el Bloque O (PLAN.md, skills que se activan solas):** son ejes independientes que
no deben mezclarse — #39 es "qué motor/CLI ejecuta la tarea", Bloque O es "qué skill guía el
trabajo dentro de esa ejecución". Ambos pueden convivir: una tarea puede correr vía `cli-kimi` y
tener `qa-structured` como gate, son ortogonales.

**Esfuerzo actualizado**: medio — el registro de invocación (`promptInjectionMode`-lite) y
`extra_clis` son extensiones de patrones que ya existen en el repo, no diseño desde cero; el
riesgo de ToS señalado arriba sigue aplicando igual, se generaliza con el alcance.

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
procedencia. El molde multi-proveedor (ex-#31) fue absorbido por PLAN.md § Mes 29 / CC.1.

### Patrones extraídos → estado

| Patrón | Repo | Estado |
|--------|------|--------|
| Middleware chain ordenado | DeerFlow | ✅ S31 |
| Skills con tool policy (`allowed_tools`) | DeerFlow | ✅ S22.0.1 (sub-tareas del planner, `SubTask.allowed_tools`) — el camino paralelo de tareas simples (`tool-policy.ts`) resultó dead code y se borró en PLAN.md § Mes 26 / Bloque W (2026-08-08) |
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
| Refuter en QA loop (v2.0.0) | gentle-ai | ✅ Bloque X (2026-08-10) |
| WHEN/THEN en acceptance_criteria | OpenSpec | ✅ S28 |
| Capabilities contract | OpenSpec | ✅ S32 |
| Archive de specs con fecha | OpenSpec | ✅ S29 |
| Delta headers (ADDED/MODIFIED/REMOVED) | OpenSpec | ✅ S32 |
| Design.md condicional | OpenSpec | ✅ Bloque AA (2026-08-15) |

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
- **gentle-ai** (Gentleman-Programming, ~5.4K⭐, revalidado 2026-08-06) —
  https://github.com/Gentleman-Programming/gentle-ai · workflow SDD multi-harness. Aportó: DAG
  de fases con contratos Read/Write, apply-progress merge, reglas de delegación con umbrales.
  **Evolución real desde julio (PR #1801, "Organic RDD", v2.2.0)**: reemplazó su control-plane
  viejo por *Receipt-Driven Development* — un candidate se congela contra su hash de contenido
  exacto (sha256), la autoridad de revisión nunca avanza sobre nada que no sean esos bytes, y 5
  gates de entrega (`post-apply`/`pre-commit`/`pre-push`/`pre-pr`/`release`) re-validan el mismo
  receipt. Sigue confirmado sin ninguna llamada a LLM (`go.mod` sin SDK de IA) — es gobernanza
  que un agente anfitrión invoca desde afuera, no un runtime. Detalle completo en
  [[reference-external-repos]]. NO aplica: binario Go, adaptadores por harness. Idea robable sin
  gradutar todavía: atar el gate de OrchestOS a un hash de contenido inmutable en vez de solo
  "archivos declarados" — no en backlog, anotado por si surge más adelante.
- **OpenSpec** (Fission-AI) — https://github.com/Fission-AI/OpenSpec · framework SDD
  agnóstico de harness, recomendado por usuario externo en producción ~1 año. Aportó:
  WHEN/THEN scenarios, capabilities contract, archive con fecha, delta headers, design.md
  condicional (Bloque AA). NO aplica: carpetas por feature, slash commands `/opsx:*`.
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
  largas (relacionado con #50, chat persistente + medidor de contexto por modelo) y STT/TTS
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
- **VoltAgent/awesome-design-md** — https://github.com/VoltAgent/awesome-design-md (MIT) ·
  colección de `DESIGN.md` por marca (Stripe, Apple, Linear, Vercel, etc. — formato
  [Stitch de Google](https://stitch.withgoogle.com/docs/design-md/overview/)), traído por Carlos
  vía el vault (`raw/ai/skills/VoltAgentawesome-design-md...md`) el 2026-08-02, verificando
  fidelidad de `frontend-design` (N.5.1). **No es una corrección de `frontend-design` ni
  `design-tokens`** — esas dos ya cubren "cómo evitar que una UI se vea genérica/AI-made"
  (disciplina universal); esto es una capacidad **distinta y nueva**: clonar el lenguaje visual de
  una marca específica dejando caer su `DESIGN.md` en el proyecto. Candidato de contenido, no de
  arquitectura — sería una skill nueva (`design-brand-match` o similar) que el usuario elige a
  mano cuando quiere "que se vea como Stripe/Linear/etc.", no algo que el clasificador de N-AUTO/O
  active solo (el criterio "qué marca" no es inferible del código, es una decisión de producto que
  el humano trae).
  **Actualización (2026-08-02) — SÍ aplica, caso concreto encontrado el mismo día**: resuelve
  [IDEAS #52](#52-nivel-premium-de-verdad--de-no-se-ve-genérico--a-un-lenguaje-visual-deliberado),
  palanca 2 (`design.md` por proyecto) — Carlos decidió que esta colección **es** el `design.md`
  que iba a construir él mismo, no un candidato aparte. Ver el detalle completo en #52. Verificado
  leyendo un `DESIGN.md` real completo (`design-md/linear.app/DESIGN.md`, 548 líneas) antes de
  aceptar la decisión — no solo el README de la colección.

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

**Referencia externa (Orca, 2026-07-18, ver [[reference-external-repos]] #9)**: Orca resuelve esto
de raíz porque acopla los agentes como **sesiones de terminal pty reales** (el usuario ve la salida
en vivo, puede escribirle) en vez de un subproceso headless que solo reporta al final — es un modelo
de acople distinto, no solo una feature de UI encima de lo que ya existe. Relevante para el diseño
de PLAN.md § Mes 22 Bloque G/G.3 ("chat conversacional en vivo vía CLI"): la decisión de diseño
pendiente ahí es si conviene imitar el modelo pty-vivo de Orca o quedarse con el headless-batch más
simple que ya usa `external.ts`.

### 51. Acciones por mensaje en el chat — rebobinar (hover, esquina inferior derecha)

**Origen**: Carlos (2026-07-17), pedido explícito de UX — patrón estándar de las herramientas de
chat (ChatGPT/Claude/etc.): cada burbuja de mensaje (usuario Y asistente) tiene un set de acciones
que solo aparece con hover, en la esquina inferior derecha del mensaje.

**Copiar y timestamp — implementados (Bloque Z, 2026-08-12)**: ver PLAN.md § Mes 27 Bloque Z.
`screens-core.js`/`screens.css` — botón copiar (por índice contra `chatHistory`, no por atributo
HTML) + timestamp por mensaje, hover-reveal vía `:hover`/`:focus-within`, ambos lados (usuario y
asistente).

**Pendiente — Rebobinar** ("rewind"): vuelve la conversación a ese punto (descarta los mensajes
posteriores). Comportamiento exacto a definir: ¿solo trunca el historial visible?, ¿permite
re-editar el mensaje del usuario y reenviar desde ahí (como "edit and resubmit" de ChatGPT)?
Necesita un ícono nuevo — no hay uno de "undo/rewind" en `ICON.*` hoy (`data.js`), agregar uno
(ej. `corner-up-left` o `rotate-ccw` de Lucide, mismo set que ya usa el resto de `ICON`).

**Por qué sigue sin implementar**: depende de la decisión de comportamiento (truncar vs.
editar-y-reenviar) y de que #50 ya tenga sesiones persistentes en SQLite — rebobinar una
conversación que solo vive en memoria JS (`state.chatHistory`, sigue así tras Bloque Z) tiene
menos sentido. Encaja mejor DESPUÉS de #50, no antes — verificado que #50 sigue sin implementar
(2026-08-12).

**Esfuerzo restante**: bajo — solo rebobinar; depende de #50.

### 52. Nivel "premium de verdad" — de "no se ve genérico" a un lenguaje visual deliberado

**Origen**: Carlos (2026-07-17), tras E.11 (skill de diseño ahora se asigna bien en el auto-flow).
Trajo una lista concreta de referencia de lo que SÍ es premium para él — open-hive.com,
cloudflare.com, helmcode.com, vectrfl.com, db-longbow.webflow.io, shopify.com/editions/winter2026
("la mejor que jamás he visto"), landonorris.com, lusion.co/about, orano.group (slider de
innovación), igloo.inc. Aclaración honesta de Carlos: no espera que OrchestOS alcance ESE nivel
todavía, pero quiere que la dirección apunte ahí — al menos alcanzable cuando quien pide la tarea
es alguien con criterio (diseñador/dev con experiencia describiendo bien lo que quiere).

**Por qué `frontend-design.yaml` no alcanza solo**: es una guía de PRINCIPIOS (contraste,
jerarquía, "nunca gradient-text genérico") — evita lo peor, pero no da DIRECCIÓN. Cloudflare y
Lusion no comparten reglas, comparten un lenguaje visual específico y deliberado (tipografía,
ritmo, motion, densidad) que ningún checklist genérico produce por sí solo.

**Conexión con el propio vault de Carlos**: `helmcode.com` (de su lista) YA está documentado en
`MemoriesMD/wiki/concepts/design-systems-md.md` — caso real de diseñar con Claude Code sin tocar
Figma usando `design.md`/`brandbook.md` + `tokens.css` como **criterio externalizado que el agente
lee antes de construir**. Es literalmente el mecanismo que resuelve esto — ya estaba documentado,
no hay que inventarlo.

**Las 4 palancas identificadas (orden de impacto, ninguna implementada)**:
1. **Referencia visual explícita por tarea** — no "hazlo premium" (adjetivo sin objetivo), sino
   "estilo Lusion: minimalista, mucho espacio negativo, motion como protagonista" o una URL/
   screenshot de referencia directo en la descripción de la tarea.
2. **Un `design.md` por proyecto** (el patrón del vault) — paleta, tipografía, densidad, tono de
   motion decididos UNA vez y reusados en cada tarea, en vez de que el LLM improvise de cero cada
   corrida.
3. **Iteración visual real, no un solo intento** — Lovable/v0 tampoco aciertan a la primera; su
   ventaja es que el usuario ve el resultado y pide ajustes en el mismo turno. Conecta directo con
   [#49](#49-visibilidad-en-vivo-de-lo-que-el-agente-está-haciendo--no-solo-el-resultado-final)
   (sin visibilidad en vivo, no hay loop de iteración rápida — cada corrida tiene que acertar sola).
4. **QA visual, no solo funcional** — hoy el QA de OrchestOS revisa criterios de aceptación
   funcionales; nada evalúa "¿esto se ve premium?" con un modelo de visión comparando contra la
   referencia.

**Por qué NO se toca ahora (decisión explícita, no descuido)**: es una decisión de arquitectura con
varios caminos válidos (los 4 de arriba, o una combinación) — necesita que Carlos la piense con
calma, no una elección unilateral a mitad de sesión. **No cambia la función de OrchestOS** (sigue
siendo el mismo orquestador: decide skill/modelo, ejecuta, verifica) — es aditivo, profundiza la
calidad del input al skill de diseño, misma categoría que E.11, no un giro de producto.

**Esfuerzo**: alto — toca el modelo de datos de tareas (referencia visual como campo nuevo),
posible nuevo artefacto por proyecto (`design.md`), un loop de iteración que hoy no existe, y un
QA con visión que hoy tampoco existe. Candidato de milestone propio, no un ítem suelto.

**Orden invertido (decisión de Carlos, 2026-07-18) — corrige el punto (c) original de esta
entrada**: la versión anterior de esta idea asumía que el veredicto de C.2 (Mes 20/22, "¿entrega
premium?") debía cerrarse primero, y que el `design.md` sería el "siguiente escalón" solo si hacía
falta. Carlos revirtió esa relación: esperar un veredicto premium **sin** que exista primero la
configuración (`design.md` por niveles) fue un error — el motor no puede dar un resultado bueno o
premium si no existe antes la config que define qué es cada nivel. Palanca **2** (arriba) pasa a
ser **prerequisito**, no opción entre cuatro: Carlos va a construir él mismo un `design.md` con
niveles explícitos — **normal / bueno / muy bueno / premium** — antes de que valga la pena volver
a intentar el veredicto. **Bloque C** (Mes 20/22 — dashboard premium multi-archivo, C.1 corrida
real + C.2 veredicto) se sacó de PLAN.md § Mes 22 y queda **gated en esta idea**: no se reabre
hasta que el `design.md` por niveles exista. Las palancas 1/3/4 (referencia visual por tarea,
iteración real, QA con visión) siguen sin decidir — el `design.md` es el primer paso, no todo el
alcance de esta idea.

**Palanca 2 resuelta — `design.md` YA NO se construye desde cero (decisión de Carlos, 2026-08-02).**
El prerequisito de arriba ("Carlos va a construir él mismo un `design.md` con niveles explícitos")
queda **satisfecho, no pendiente**: la guía oficial es
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT — ya anotado
como fuente externa, ver "Los repos" más abajo). Carlos verificó que su idea original de "niveles
normal/bueno/muy bueno/premium" descritos en prosa **era el enfoque equivocado**: *"mi intención
era crear algo premium, pero eso se logra no con un prompt sino con ejemplos de capturas de
pantalla, especificaciones precisas, etc."* — exactamente lo que un `DESIGN.md` de esta colección
ya provee, verificado leyendo uno completo (`design-md/linear.app/DESIGN.md`, 548 líneas): hex
exactos por rol semántico, tipografía en px con letter-spacing y line-height, tokens de componente
con estados (hover/pressed/focus), breakpoints con cambios de layout explícitos, sección **Do's
and Don'ts** concreta (no principios genéricos — "Don't use lavender as a section background",
no "usa buen contraste"), y un **Known Gaps** honesto (qué no se pudo inferir del sitio real). Las
36 marcas de la colección + el formato [Stitch de Google](https://stitch.withgoogle.com/docs/design-md/specification/)
que todas siguen **son el `design.md` que Carlos iba a construir** — no un reemplazo parcial, la
guía completa.

**Qué cambia en consecuencia:**
- El prerequisito de Bloque C dejó de ser "esperar a que Carlos escriba un `design.md`" — ya está
  listo para usarse. **No implica que Bloque C se reabra automáticamente hoy** — es una decisión
  aparte que Carlos no tomó todavía en este turno, solo que el bloqueo documental ya no aplica.
- Palanca **1** (referencia visual explícita por tarea) y palanca 2 se fusionan en la práctica: en
  vez de "un `design.md` por proyecto" fijo, el mecanismo real es **elegir o adaptar un `DESIGN.md`
  de la colección por tarea/proyecto** ("estilo Linear: negro casi puro, un solo acento lavanda,
  cero gradientes") — más cerca de cómo describía la palanca 1 originalmente que de un artefacto
  único congelado por proyecto.
- Palancas 3 (iteración real) y 4 (QA visual con modelo de visión) **siguen sin resolver** — un
  `DESIGN.md` de referencia no reemplaza el loop de iteración ni el QA que compara el resultado
  contra la referencia. Esta idea sigue sin graduar a PLAN.md hasta que Carlos decida sobre esas
  dos, o sobre reabrir Bloque C.

---

### 54. Mutation testing — la métrica anti-trampa para los tests que escriben los agentes

**Origen**: 2026-07-27, consulta al vault sobre mutation testing / coverage gate
(`MemoriesMD/outputs/2026-07-27-mutation-testing-coverage-gate-qa-ejecutando.md`, skill
`github.com/V3RNE42/mutation-testing-skill`). El coverage gate que salió de la misma consulta ya
está accionado en PLAN.md § Bloque J; **esto es lo otro, y no es lo mismo.**

**Qué es**: la cobertura mide qué líneas se *ejecutaron*. Mutation testing introduce bugs a propósito
en el código (`>` → `>=`, invertir un `if`, borrar una llamada) y verifica si algún test falla. Si el
test sigue pasando con el código roto, ese test no sirve — "mutante sobreviviente". Mide **calidad
del test**, no cantidad. Se puede tener 100% de coverage con tests que no aseveran nada.

**Por qué encaja específicamente con este repo (no es consejo genérico)**: [DONE.md:795](DONE.md)
registra la lección "los gates 🔍 deben correr contra el sistema real, no solo `bun test` — los 3
bugs de Mes 13 solo aparecieron verificando en vivo; **los mocks de los tests ya tenían la forma
correcta y los escondían**". El patrón se repite en Mes 13, 14 y 22 ([DONE.md:1064](DONE.md)).
Mutation testing es exactamente la herramienta que detecta "tests que pasan sin importar lo que haga
el código": si un módulo está mockeado de más, sus mutantes sobreviven y quedan listados. Convierte
una lección que hoy se aprende a golpes en una métrica.

**El uso de más valor NO es interno, es de producto** — y por eso vive acá y no en PLAN.md:
OrchestOS genera código *y sus tests* con agentes, y los verifica con
`verifiers: ["bun test", "npx tsc --noEmit"]`. Un ejecutor barato (deepseek) puede escribir tests que
pasan vacíamente y reportar "listo". Mutation score sobre los tests que escribió el agente es la
métrica anti-trampa **objetiva**, complementaria a `fable-judge` (graduado a PLAN.md § Bloque K):
fable-judge lo caza por inspección adversarial, mutation testing lo caza por ejecución.

**Los bloqueos concretos (medidos, no estimados a ojo):**

1. **StrykerJS no tiene runner nativo para `bun test`.** Sus runners oficiales son Jest, Mocha,
   Jasmine, Karma, Vitest y `command`. Quedaría el runner `command`, el peor caso: corre la suite
   **completa** por cada mutante y no permite `coverageAnalysis` para filtrar mutantes no cubiertos.
   **Este es el supuesto que hunde o salva todo el cálculo — verificarlo ANTES de invertir nada.**
2. **Costo con los números reales del repo**: ~19.269 líneas → del orden de 2.500–5.000 mutantes. A
   13.6s de suite completa cada uno, una corrida full se mide en **horas, no minutos**, incluso
   paralelizando. Inviable en CI por PR.
3. La mitad de la superficie de baja cobertura (`dashboard/handlers`, `cli.ts`) no necesita mutation
   testing — necesita tests. Mutation testing sobre código sin tests solo dice "no hay tests".

**Dónde sí tendría sentido**: modo `--incremental`, acotado a `src/run/` y `src/spec/` (donde ya hay
80–100% de cobertura y la pregunta legítima pasa a ser "¿esos tests sirven?"), corrido a mano una
vez, nunca en CI. Los candidatos naturales son los tres módulos donde históricamente aparecieron los
bugs que los tests no vieron: `harness.ts` (81%), `sandbox.ts` (67%), `graph-runner.ts` (76%).

**Descartado en la misma consulta**: `start-fish/riskradar-tracemap-ai` (skills de "quality gate" y
trazabilidad PRD→test→código). Genera **reportes** — un LLM leyendo un diff y opinando, exactamente
el antipatrón que PLAN.md § Bloque K ataca en `qa.ts` (lee, no ejecuta). Además el repo trae
`ops/github-star-growth-playbook.md` y posts de lanzamiento: star-farming, no herramienta. No aporta
nada sobre `fable-judge` + live-proof gate.

**Esfuerzo**: bajo para el spike de validación (confirmar bloqueo 1 y medir el costo real sobre
`src/run/`); alto para adoptarlo como gate del producto. **No arrancar por la adopción** — el spike
primero — **ese spike ya se graduó a PLAN.md § Bloque K como K.5**; lo que queda acá es la ADOPCIÓN
como gate del producto, que sigue siendo backlog hasta tener los números reales de K.5.

---

### 55. models.dev + Vercel AI SDK — dejar de depender de OpenRouter para catálogo y clientes

**Origen**: Carlos, 2026-07-27 — leyendo la documentación de opencode vio que se apoyan en
[models.dev](https://models.dev) y [ai-sdk.dev](https://ai-sdk.dev), y preguntó si sirven para
"ya no depender de un tercero o de un proveedor".

**Precisión necesaria antes de nada**: adoptar esto **no elimina la dependencia de un tercero** —
cambia *cuál*. Hoy OrchestOS depende de OpenRouter en dos capas distintas, y cada herramienta
ataca una:

| Capa | Hoy | Qué cambiaría |
|---|---|---|
| **Catálogo** (precio, contexto, capacidades) | `model-catalog.ts` → `openrouter.ai/api/v1/models`, TTL 24h, cache en `~/.orchestos/cache/models.json` | models.dev: catálogo de 172 proveedores / 5.751 modelos, incluye los que OpenRouter no vende |
| **Clientes HTTP** | `anthropic.ts` (67) + `openai.ts` (64) + `codex.ts` (59) + `openrouter.ts` (129) — wrappers bespoke, uno por proveedor | AI SDK: una interfaz `generateText`/`streamText` para 25+ proveedores |

**models.dev — verificado en vivo (2026-07-27, `curl https://models.dev/api.json`)**:
- MIT, mantenido por sst (los de SST/opencode). Endpoints: `api.json` (3.2 MB), `models.json`,
  `catalog.json`, `logos/{provider}.svg`.
- **172 proveedores, 5.751 modelos.** Schema por modelo: `cost` (input/output/cache_read/
  cache_write), `limit` (context/output), `modalities`, `reasoning` + `reasoning_options`,
  `tool_call`, `temperature`, `release_date`, `last_updated`. Cubre casi 1:1 el `ModelInfo` que
  `model-catalog.ts` ya define (`supportsReasoning`/`supportsTools`/`maxOutputTokens`/
  `supportsVision`).
- **Hallazgo que importa para G.4**: tiene namespace `opencode` **y** `openrouter`. G.4 quedó
  bloqueado justamente porque `orchestosModelToOpencodeModel()` devuelve `undefined` a falta de
  tabla de traducción entre namespaces ([opencode.ts:64](src/run/executors/opencode.ts#L64)) —
  models.dev es esa tabla, ya mantenida por terceros. **Este es el uso más inmediato y concreto.**
- Cada proveedor trae un campo `npm` (ej. `"@ai-sdk/openai-compatible"`) — models.dev y el AI SDK
  están diseñados juntos, no son dos decisiones independientes.
- **NO tiene `ollama`** — el tier local de la cascada (Bloque G) seguiría necesitando su propia
  detección, models.dev no lo cubre.

**El escepticismo real (por qué NO es swap obvio)**:
1. **Frescura del dato.** OpenRouter publica el precio de lo que *él mismo vende*: es autoritativo
   y en vivo. models.dev se mantiene **por PRs de la comunidad** (con validación de schema por
   GitHub Action, pero el dato lo carga una persona). Para el catálogo del tier API — donde el
   precio decide gasto real — eso es un downgrade de confiabilidad, no un upgrade. La decisión
   registrada en PLAN.md § Bloque G ("OpenRouter se mantiene porque su catálogo se actualiza solo")
   sigue siendo válida para ese caso.
2. **El AI SDK no es una dependencia chica.** Los 4 clientes bespoke suman ~320 LOC, pero la
   superficie de integración real es `tool-call.ts` (687 LOC: `runToolLoop`, router de tools,
   6 tool schemas, cap de outputs de A.32). Migrar eso a `generateText`/`streamText` es un cambio
   multi-módulo del núcleo — regla de [[feedback-planificar-cambios-grandes]], nunca en caliente.
3. **Cambiar de amo no es independencia.** Pasar de "dependo de OpenRouter" a "dependo del SDK de
   Vercel + un dataset comunitario" es una dependencia distinta, con otro perfil de riesgo. La
   independencia real que **sí** se gana es otra y vale nombrarla bien: poder hablar **directo**
   con cada proveedor (clave propia de Anthropic/OpenAI, sin intermediario que cobre margen ni
   pueda caerse) — que es exactamente el gap ya pineado en [#31](#31-chat-multi-proveedor-real--routing-granular-por-función-inspirado-en-hermesopen-webui--pineado-2026-07-09).

**Cómo encaja con lo ya pineado**: #31 identificó el problema (el Chat exige `OPENROUTER_API_KEY`
sin fallback; `anthropic.ts`/`openai.ts` no tienen catálogo dinámico) y la nota de Hermes en
[[reference-external-repos]] propuso la solución barata (un cliente genérico OpenAI-compatible con
`baseURL`, molde `{PROVIDER}_API_KEY`). **El AI SDK es la versión "comprada" de esa misma solución**
— más completa y mantenida, a cambio de una dependencia grande. Son alternativas del mismo problema,
no dos ideas: cuando se ataque #31 hay que elegir entre las dos, no hacer ambas.

**Adopción sugerida — por partes, no en bloque:**
1. **models.dev solo para el namespace de opencode (G.4)** — riesgo bajo, resuelve un bloqueo
   concreto y hoy real, no toca el catálogo del tier API. Empezar por acá.
2. **models.dev como *fallback* del catálogo**, no como reemplazo: OpenRouter sigue siendo la
   fuente para lo que OpenRouter vende; models.dev cubre lo que no está ahí (modelos directos de
   proveedor, modelos de CLI). Mantiene la garantía de frescura donde importa.
3. **AI SDK — solo dentro de #31**, como una de las dos opciones evaluadas contra el cliente
   genérico propio. No adoptarlo por separado.

**Esfuerzo**: bajo el punto 1 (una tabla de traducción alimentada por un JSON ya público); medio el
2; alto el 3 (multi-módulo, requiere plan).

**Nota de categorización**: en el índice canónico, `#55-B` corresponde solo al punto 2 (fallback de
catálogo, esfuerzo medio) — el punto 3 (AI SDK) NO es un ítem independiente del backlog, va **dentro
de `#31`** cuando se ataque esa idea, como ya aclara la sección "Adopción sugerida" de arriba.

---

### 56. Workspace multiagente con tabs y ejecución paralela — supervisar una flota de agentes desde OrchestOS

**Origen**: Carlos (2026-07-27), después de usar Orca y observar que sus tabs permiten trabajar con
varios agentes a la vez. La necesidad no es solo tener tabs visuales: cada tab debe representar una
sesión o corrida independiente, con su propio contexto, proyecto/worktree, agente y resultado.

**No confundir con ideas existentes**:
- [#43](#43-panel-derecho-como-ide-embebido--diffexplorer-con-tabs-reales-en-el-main-todo-dentro-de-orchestos)
  cubre tabs del `main` para explorer, código, diff y terminal.
- [#49](#49-visibilidad-en-vivo-de-lo-que-el-agente-está-haciendo--no-solo-el-resultado-final)
  cubre mostrar el progreso interno de una corrida.
- [#50](#50-chat-persistente-con-sesiones-acotadas-máx-20--no-copiar-el-patrón-de-chats-infinitos)
  cubre persistencia y archivo de conversaciones de chat.
- [#39](#39-generalizar-el-executor-external--hoy-solo-detecta-claude-no-opencodecodexotros-clis)
  cubre detectar y ejecutar distintos CLIs.

Este ítem combina esas piezas en una superficie operativa nueva: una barra o gestor de tabs de
sesiones/agentes donde el usuario pueda crear, cambiar y cerrar sesiones sin perder el contexto.

**Qué debería ofrecer**:
1. Tabs persistentes para sesiones de chat, tareas o corridas de agentes, con nombre, icono y
   proyecto/worktree identificables.
2. Ejecución realmente paralela, sin mezclar el contexto ni los logs de una sesión con otra.
3. Estado visible por tab: `idle`, `running`, `waiting`, `needs approval`, `done`, `failed` o
   `cancelled`, incluyendo duración y coste cuando estén disponibles.
4. Vista global de actividad para ver qué agentes están trabajando, esperando o bloqueados.
5. Acciones operativas por sesión: abrir, pausar si el executor lo permite, cancelar, reintentar,
   enfocar el diagnóstico y abrir el diff/resultados.
6. Aislamiento explícito de proyecto, rama o worktree, con advertencias antes de compartir un
   working tree entre corridas.
7. Recuperación tras refrescar o reiniciar el dashboard, enlazada con la persistencia de #50 y
   los registros de `runs`.
8. Notificaciones no intrusivas cuando una sesión termina o necesita aprobación, conectando con
   #14.

**Refinamiento (Carlos, 2026-07-29) — el proyecto es la dimensión de scoping, no un atributo del tab**:
Al volver a usar Orca, lo que destaca no son los tabs en sí sino la separación por proyecto: el
sidebar lista Projects (cada uno con su ruta), dentro de cada proyecto viven ramas/worktrees y
dentro de estas los agentes en corrida, y la barra de tabs superior muestra **solo** los tabs del
proyecto activo. Agregar otra ruta de proyecto y trabajar en paralelo sin mezclar nada es el
comportamiento a capturar. La decisión arquitectural de fondo: *la sesión pertenece al proyecto,
no al proceso*.

**Secuencia técnica (verificada contra el código, 2026-07-29)**:
1. **Sesiones de chat persistentes con `project_id`** — hoy la historia viaja en el body del
   request desde el cliente y se recorta a 10 mensajes (`src/dashboard/handlers/chat.ts`), no hay
   tabla de sesiones. La capa de datos ya está lista: `projects` existe con `path UNIQUE`
   (`src/db/migrate.ts`) y `runs.project_id` también.
2. **Desacoplar los handlers del cwd** — los handlers hacen `resolve('.')` (chat.ts, explorer,
   path-policy) y hay ~22 usos de `process.cwd()` en `src/`; el proyecto activo debe viajar
   explícito por request/sesión. Este desacople es pre-requisito compartido con la migración a
   Electron (un proceso gestionando N proyectos), así que no es trabajo extra sino adelantado.
3. **Tabs UI filtrados por proyecto activo** — recién aquí entra la capa visual estilo Orca.
   Hacer los tabs sin 1 y 2 daría tabs cosméticos.

Al retomar este ítem: revisar primero cómo Orca resuelve esta parte (modelo de sesión y su
interfaz) como referencia de diseño — robar el modelo mental, no copiar la superficie.

**Decisiones pendientes**:
- definir si el tab representa un chat, una task run o una sesión de CLI; puede haber una entidad
  de sesión que agrupe los tres, pero no debe duplicar `runs` ni `chat_sessions` sin necesidad;
- definir si la ejecución paralela inicial se limita a worktrees aislados o también permite tareas
  sobre el mismo proyecto con un lock explícito;
- decidir si los CLIs se muestran como terminal pty en vivo, como eventos de progreso o ambas cosas;
  esto depende del diseño de #39 y #49;
- establecer límites de concurrencia, presupuesto y confirmación de coste antes de lanzar varias
  corridas.

**Dependencias**: diseño de #43 para el tab strip del `main`, #49 para progreso en vivo, #50 para
persistencia de sesiones, #39 para el registro multi-CLI y #14 para notificaciones. No construir un
"AI Vault" de sesiones escaneadas del disco: esta idea trata sesiones que OrchestOS crea y controla.

**Esfuerzo**: alto — requiere modelo de sesión, coordinación de procesos, aislamiento de worktrees,
estado en tiempo real, UI de tabs y recuperación. Debe tener diseño formal antes de implementar.

---

### 57. % de cuota semanal de suscripción CLI (Claude/Codex) en el tab de Usage

**Origen**: Carlos (2026-07-27), viendo el tab de Usage de Orca — muestra "Codex: 12% usado, resetea
en 4d 22h" junto al gasto en $. Es una métrica DISTINTA a H.1 (gasto vía API/OpenRouter): esto es
cuánto del **plan de suscripción del CLI** (Claude Pro/Max, ChatGPT Plus/Pro) ya se consumió esa
semana. No se cruzan — Carlos no usa `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` en absoluto (verificado:
ninguna seteada en `~/.orchestos/.env` ni en el entorno), solo login de suscripción vía `claude
login`/`codex login`.

**Mecanismo real, verificado contra el código fuente de Orca** (`github.com/stablyai/orca`, MIT,
`gh api search/code`) — no es teoría, es lo que Orca hace de verdad:
- **Codex**: `codex app-server` — subcomando real del binario (`[experimental]`, con
  `codex app-server generate-json-schema` para el schema), protocolo JSON-RPC. Es el camino
  primario en [codex-fetcher.ts](https://github.com/stablyai/orca/blob/main/src/main/rate-limits/codex-fetcher.ts).
  Fallback: PTY oculta corriendo `codex` interactivo, envía `/status`, parsea el texto de salida
  (con manejo especial de timing — Orca documenta bugs reales de timing del composer TUI).
- **Claude**: el campo `limits[]` que viene en la respuesta del refresh de la sesión OAuth (la
  misma que usa `claude login` para renovar el token) — no documentado públicamente, cambió de
  forma una vez ya (ver `docs/claude-scoped-oauth-usage-limits.md` del propio repo de Orca, bug
  real que tuvieron que parchear). Fallback: mismo truco de PTY oculta con `/usage`.

**Esfuerzo real** (no trivial, verificado en el propio código de Orca): medio-alto.
`codex-fetcher.ts` solo son ~350+ líneas con `eslint-disable max-lines`, maneja WSL/Windows/SSH
como casos separados, y el camino de Claude depende de un contrato no documentado que ya rompió
una vez. No es "un curl y ya" — es un cliente JSON-RPC + fallback de PTY + parches por SO.

**Orden sugerido si se ataca**: empezar SOLO por Codex (`app-server` es un protocolo real y más
estable que depender del shape no documentado del OAuth de Claude) — Claude queda para una segunda
pasada, aceptando que puede requerir el mismo tipo de parche reactivo que tuvo Orca si Anthropic
cambia el shape de nuevo.

**Esfuerzo**: medio-alto — cliente JSON-RPC contra `codex app-server` (Codex), reverse-engineering
del OAuth refresh de Claude (frágil, ya cambió una vez), fallback de PTY para ambos. No bloquea
nada de Bloque H.

---

### 59. Etiquetar `code_edges` con `EXTRACTED`/`INFERRED` en `graph/` propio

**Origen**: spike de comparación contra Graphify (#46, Bloque V, 2026-08-08) — no adoptado como
dependencia (ver PLAN.md § Bloque V para el porqué), pero el patrón de confianza por edge es
robable y barato. Graphify marca cada edge `EXTRACTED` (referencia literal en el código fuente,
ej. un `import` real) vs `INFERRED` (resuelto por su propio motor de resolución, ej. un `path`
adivinado entre dos nodos sin conexión directa). `graph/` propio (S21) hoy no distingue: un edge
con `to_file_id: null` (sin resolver) y uno resuelto por un `Resolver` custom (`csharpResolver`,
`rustResolver`, etc. — que a veces adivina por convención, ver `ruby.ts` intentando `lib/X.rb`)
se ven igual de "confiables" para quien consuma el grafo.

**Qué hacer**: agregar una columna `confidence` (`extracted` | `inferred`) a `code_edges`.
`extracted` cuando el edge sale directo de la extracción de imports (regex/AST) con match exacto
de path; `inferred` cuando pasó por un `Resolver` que tuvo que adivinar (convención de `$LOAD_PATH`
en Ruby, matching por namespace en C#, etc. — los casos que ya tienen comentarios "best-effort" en
el código de S/Bloque T).

**Esfuerzo**: bajo — un campo nuevo en el schema + marcar el origen en los ~6 sitios donde se
inserta un `code_edges` row.

### 60. Extracción a nivel de función/símbolo en `graph/` propio (no solo imports de archivo)

**Origen**: mismo spike (#46, Bloque V, 2026-08-08) — la brecha real que encontró, no una idea
copiada de Graphify. Verificado en vivo contra el propio código de OrchestOS: Graphify (tree-sitter
real, ~40 lenguajes) devolvió `resolveGates() --calls--> loadSkill()`, `--calls--> listSkillFiles()`
— relaciones a nivel de **función**, dentro de un archivo. `graph/` propio (S21) solo resuelve
`archivo A importa archivo B` — no sabe qué función llama a qué función. No es "Graphify hace lo
mismo pero mejor": es una capacidad que `graph/` genuinamente no tiene hoy.

**Por qué importaría**: `context suggest` (S24) hoy rankea **archivos** relevantes para una tarea.
Un grafo a nivel de función permitiría respuestas más finas ("qué más llama a `runQA()`") sin leer
el archivo completo — el mismo modo de fallo que motivó el spike de Graphify en primer lugar (#32,
cap de outputs de tools), pero resuelto con capacidad propia en vez de un binario externo.

**Qué NO es**: adoptar tree-sitter como dependencia nueva no es gratis — hoy `graph/` usa regex
sobre el texto fuente (`extractCSharpImports`, etc.), no un parser AST real. Tree-sitter en Bun/Node
requiere bindings nativos por lenguaje (`tree-sitter-typescript`, `tree-sitter-rust`, etc.) — el
mismo catálogo de paquetes que Graphify instaló en Python, pero del lado de Node. Verificar el
estado de esos bindings para Bun específicamente antes de estimar esto como "bajo".

**Esfuerzo**: medio-alto — no es un resolver más (patrón de S/Bloque S), es una capa de parsing
nueva. Empezar por UN lenguaje (TypeScript, el propio de OrchestOS) antes de generalizar.

---

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_

## Knowledge promotions

<!-- knowledge-promotion:KP-20260731-085936-15fa5b -->
### Un reviewer mejora con correcciones humanas, no con autorreflexión aislada

- Insight: `INS-2026-009` (candidate/medium)
- Razón: Reviewer manual (contrato 5 líneas + Codex primera pasada) resuelve el cuello de botella de revisión del flujo de Carlos; la feature en OrchestOS se construye después sobre las correcciones acumuladas
- Acción propuesta: Ítem futuro sin apuro: fase 1 manual de acumulación de evidencia; fase 2 skill review-pr read-only + improver como instancia de Dreaming con scope angosto
- Regla: Separar el reviewer operativo del improver periódico. El segundo solo modifica criterios cuando puede contrastar el finding del agente con una corrección o validación humana posterior.
- Evidencia en vault: wiki/concepts/self-improving-code-review-agent
<!-- /knowledge-promotion:KP-20260731-085936-15fa5b -->

### Auditoría de basura del repo: hardcodes, dead code, archivos huérfanos

- Motivo: el repo debe quedar limpio para quien lo clone — solo lo que se usa
  realmente, no lo que "funciona bien pero contamina". Detectado por Carlos
  como preocupación recurrente, 2026-07-31.
- Señal inicial (grep rápido, no exhaustivo): 11 TODO/FIXME/@deprecated en
  src/**/*.ts; 23 archivos con localhost/paths absolutos hardcodeados;
  candidatos a huérfanos por confirmar uno por uno (no asumir sin verificar
  referencias reales).
- Alcance: barrido por categoría (hardcodes → dead code → archivos sin
  importar), un PR chico por categoría, no un solo cambio masivo. Cada
  hallazgo se verifica con grep de referencias antes de borrar — nunca borrar
  por sospecha.
- Explícitamente fuera de esta pasada: refactors de arquitectura, cambios de
  comportamiento. Es limpieza, no rediseño.
