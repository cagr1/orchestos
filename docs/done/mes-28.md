## MES 28 — Backlog canónico, categoría Medio (abierto 2026-08-15, cerrado 2026-08-18)

> **Backlog canónico PAUSADO desde 2026-08-16** (decisión de Carlos). Motivo medido, no opinión:
> 487 commits construyendo el sistema vs. **46 runs reales** en toda su historia ($1.58 total), y
> **1 solo run en todo agosto** mientras se cerraban los Bloques N–AA. Se estaba construyendo un
> orquestador sin orquestar nada. El backlog vuelve a abrirse cuando el dogfooding real produzca
> su propia lista de prioridades. Bloque BB es el desbloqueo mínimo para que ese dogfooding sea
> posible — no es una idea de IDEAS.md, es un gap encontrado por Carlos al intentar usar el
> producto de verdad.

### Bloque BB — 🧠 Un solo selector de "cómo corre OrchestOS", y que sea real

**Reporte de Carlos (2026-08-16), verificado en código antes de escribir nada**: *"aún no puedo
trabajar con modo CLI… la configuración está escrita en el dashboard pero no es real; quiero ver
la diferencia de usarlo como CLI con codex o claude"*. Confirmado, con dos causas distintas:

1. **El harness soporta 5 motores, la config deja elegir 3.** `harness.ts:414-419` resuelve
   `single-shot | agentic | external | opencode | codex`, pero `config/schema.ts:40` tipa
   `executorEngine` como solo los 3 primeros y `config/load.ts:59` **descarta a `undefined`
   cualquier otro valor sin un warning**. Escribir `executorEngine: codex` en el YAML cae a
   `single-shot` en silencio. `dashboard/handlers/config.ts:11` tampoco los ofrece.
2. **`executor_mode` (el selector que SÍ ofrece los CLIs) se lee en un solo punto de todo el
   runtime**: `dashboard/handlers/chat.ts:473`. Solo aplica a tareas que el chat auto-crea. Una
   tarea corrida por CLI o escrita a mano en `tasks.yaml` lo ignora por completo. Carlos tenía
   `executor_mode: cli-claude` fijado y sus tareas manuales nunca lo usaron.

**La pieza que ya existe y nadie conectó**: `resolveExecutorSelection()`
(`router/engine-cascade.ts:92`) ya mapea los 5 modos → `{ executor_model, engine }`, ya está
testeada, y respeta [[feedback-deteccion-no-decision-automatica]] (la preferencia del usuario gana
sobre la cascada). El fix no es escribir un traductor nuevo — es llamarlo desde el harness.

**Decisión de Carlos (2026-08-16)**: unificar en **un solo selector**, no parchar los dos.

**Diseño acordado** — `executor_mode` pasa a ser el eje único de "dónde corre", `executorEngine`
queda como refinamiento de "cómo corre cuando es la API" (único caso donde single-shot vs agentic
tiene sentido; un CLI no expone esa distinción). Orden de precedencia, del más específico al más
general:

| # | Fuente | Gana sobre |
|---|---|---|
| 1 | `task.engine` (por tarea, `tasks.yaml`) | todo — override explícito, sin cambios |
| 2 | `executor_mode` (proyecto) | decide el engine cuando es `cli-*` |
| 3 | `executorEngine` (proyecto) | refina `api`/`local`: single-shot vs agentic |
| 4 | default | `single-shot` |

- [x] **BB.1 — 🧠 `executor_mode` aplica a TODA tarea.** (2026-08-16) Cableado en `harness.ts` vía
  `resolveExecutorSelection()` (reusada, no duplicada). Precedencia: `task.engine` →
  `executor_mode` → `executorEngine` → `single-shot`. Decide solo el engine, nunca el modelo
  ([[feedback-modelo-decision-final-carlos]]) — verificado que los mappers de CLI
  (`codex.ts:54`, `opencode.ts:56`) ya degradan a `undefined` y dejan que el binario use su
  default, así que no hacía falta forzar modelo. 3 tests de precedencia nuevos en
  `engine-selection.test.ts` (incluido "task.engine gana sobre executor_mode").
- [x] **BB.2 — ⚡ Fin del descarte silencioso.** (2026-08-16) `executorEngine` acepta los 5
  motores reales; valor inválido **avisa por stderr** en vez de caer a `undefined`. Verificado en
  vivo: `executorEngine: codex` ahora parsea a `codex`; `cdex`/`cli-clod` imprimen el aviso con
  la lista de valores permitidos. De paso: el texto de `--help` de `task run --engine` mentía
  (listaba 3 de 5 motores aunque la validación real ya aceptaba los 5) — corregido.
- [x] **BB.4 — 🔍 La comparación, medida.** (2026-08-16) Proyecto scratch limpio, misma tarea
  (`slugify.ts` + tests, con 3 acceptance criteria WHEN/THEN), corrida con los 3 motores CLI.
  **Los 3 pasaron QA y produjeron código que funciona** (los tests generados por opencode corren
  verdes: 4 pass). Resultados:

  | Motor | Veredicto | Tiempo | Tokens in/out | Costo reportado | Líneas producidas |
  |---|---|---|---|---|---|
  | `external` (Claude Code) | ✅ QA pass | 31.5s | 1.012 / 1.731 | $0.35044 | impl 13L · test 28L |
  | `codex` | ✅ QA pass | 43.7s | 101.608 / 1.704 | $0.00924 | impl 7L · test 22L |
  | `opencode` | ✅ QA pass | 28.0s | 10.129 / 1.098 | $0.00297 | impl 8L · test 27L |

  **Los costos NO son comparables entre sí** — hallazgo del propio ejercicio: `external` reporta
  el `total_cost_usd` real que le devuelve Claude Code; `codex` **no expone costo** y OrchestOS lo
  estima con `calcCost()` sobre el modelo del config (`deepseek-v4-flash`) — pero codex no usó ese
  modelo, usó el suyo propio, así que ese $0.00924 es **ficticio**. Poner los tres en la misma
  columna sin esta nota sería engañoso. Registrado como `BB.6`.
- [x] **BB.5 — 🧠 Los artefactos del tooling del host rompen toda tarea CLI.** (2026-08-16)
  **Fix**: `readWorktreeDiff()` recibe ahora los `output[]` declarados y descarta los artefactos
  de tooling del host (`.impeccable/`, `.claude/`, `.codex/`, `.opencode/`, `.cursor/`,
  `.aider/`, `.DS_Store`) — **salvo que la tarea los declare explícitamente**, en cuyo caso se
  respetan. No es un filtro ciego: una tarea que de verdad quiera editar `.claude/settings.json`
  sigue pudiendo. Mismo criterio que el pathspec `':!node_modules'` de T (Mes 26): no es output
  del engine, es ruido del entorno. Aplicado a los 3 engines CLI (comparten el módulo).
  **Gate en vivo**: la MISMA corrida que fallaba con `contract violation:
  .impeccable/hook.cache.json` ahora da ✅ QA pass, en un repo **sin** el workaround de
  `.gitignore` (18.6s). 2 tests nuevos (8 pass en `sandbox-node-modules.test.ts`).
- [x] **BB.3 — ABSORBIDO en Mes 29 (2026-08-16).** Unificar los dos selectores de Settings no
  tiene sentido aislado si la navegación completa se rediseña — pasa a ser parte de CC.4.
  Decisión de Carlos: *"si nos ponemos a arreglar uno a uno ahora no vamos a aterrizar"*.
- [x] **BB.6 — 🧠 (re-clasificado desde ⚡) El costo de `codex` es ficticio.** (2026-08-18)
  Ver tabla de BB.4. Estuvo abierto desde el 2026-08-16: el único commit asociado
  (`2e0adef`) lo registró como hallazgo, no lo corrigió.

  **Causa raíz verificada en código (2026-08-18), dos líneas de `run/executors/codex.ts`:**

  ```
  :171   const codexModel = orchestosModelToCodexModel(ctx.model)   → undefined si ctx.model no es openai/*
  :201   const usd = calcCost(ctx.model, ...)                        → tarifa con ctx.model igual
  ```

  Cuando el modelo configurado no es de OpenAI, `orchestosModelToCodexModel()` (`codex.ts:54`)
  devuelve `undefined`, se omite `-m` y **codex corre con su propio default** (`gpt-5.4`,
  confirmado en `~/.codex/config.toml`) — pero el costo se calcula con el precio de
  `deepseek/deepseek-v4-flash`. Ese es el `$0.00924` de la tabla de BB.4: **tokens de GPT-5.4
  tarifados como DeepSeek**.

  **Por qué el guard F0.8 no lo atrapa** (`codex.ts:196`): ese chequeo protege contra *"modelo
  ausente del catálogo → $0 silencioso"*. Acá el modelo **sí** está en el catálogo — es el modelo
  equivocado. El guard pasa limpio y el número sale inventado con apariencia de real. Es un modo de
  fallo distinto del que F0.8 fue diseñado a cubrir, no un agujero en su implementación.

  **Los otros dos motores están correctos** (verificado, no asumido): `external.ts:390` exige
  `total_cost_usd` real de Claude Code y lanza si falta; `opencode.ts:123` suma `part.cost` del
  propio stream. **Solo `codex` estima.**

  **Por qué se re-clasificó a 🧠**: la opción (a) —reportar `null`/"n/a" cuando el costo no es
  medible— no es un cambio local. `ExecutorOutcome.usd` es `number` **no-nullable**
  (`run/executors/types.ts:22`) y `runs.usd_cost` es `REAL NOT NULL` en la DB, así que hacer el
  costo opcional toca el tipo, el schema de SQLite y toda superficie que hoy asume que siempre hay
  un número. Eso excede una tarea ⚡ bien especificada.

  **La opción (b) quedó DESCARTADA por evidencia** (probe contra el binario real, 2026-08-18):
  ningún evento de `codex exec --json` expone el modelo. El stream completo es
  `thread.started` (solo `thread_id`) · `turn.started` (vacío) · `item.completed` (mensajes) ·
  `turn.completed` (solo `usage`). Tampoco sirve leer `~/.codex/config.toml`: declara
  `gpt-5.6-luna`, mientras el comentario de `codex.ts` afirmaba `gpt-5.4` "confirmado" en ese mismo
  archivo — **el dato se desactualizó solo**, que es la prueba de por qué no se puede tarifar
  contra un default que OrchestOS no controla.

  **La opción (a) se implementó en su forma mínima: fallar antes del spawn.** Hacer
  `ExecutorOutcome.usd` nullable tocaba ~30 sitios (`cli.ts`, `agents/executor.ts`,
  `agents/diagnose.ts`, `graph-runner.ts`, `handlers/usage.ts`, varios `.toFixed(5)`) más una
  migración de `runs.usd_cost` a nullable. Se logró el mismo objetivo —**no fabricar el número**—
  con un guard de 3 líneas en `codex.ts`, sin tocar tipo, schema ni UI: si `ctx.model` no es
  `openai/*`, se lanza **antes** de spawnear, así no se gastan tokens ni tiempo en un run cuya
  evidencia económica iba a ser falsa igual. Mismo criterio que F0.8 y que opencode/external:
  el costo desconocido se declara, no se inventa.

  **Cambio de comportamiento declarado:** correr `codex` con un modelo no-OpenAI ahora **falla** en
  vez de devolver un número mentiroso. Es exactamente la configuración de BB.4, y es la única que
  producía datos falsos. El mensaje de error es accionable (dice qué configurar o qué engine usar).

  **Evidencia:** `bunx tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI) →
  **1163 pass / 0 fail** (eran 1158), functions 77.77% / lines 64.43%, ambos sobre umbral ·
  cobertura de `codex.ts` 96.71% de líneas. Se reescribió el test que **codificaba el bug**
  (`codex-engine.test.ts`, afirmaba "omite `-m` y codex usa su default") para afirmar que ahora
  `spawnCalls.length === 0`, y se agregó un segundo test que prueba que el guard F0.8 preexistente
  sigue vigente para su propio caso (modelo `openai/*` ausente del catálogo → sí spawnea, pero no
  reporta $0). Son dos modos de fallo distintos y ahora ambos están cubiertos.
  **Gate en vivo (CLI real, no mocks):** repo scratch con `agent: codex` +
  `model: deepseek/deepseek-v4-flash` — la configuración exacta que generó el `$0.00924` de BB.4 —
  `task run` falla al instante con el mensaje accionable y **sin spawnear codex**.

  **Hallazgo anotado, NO corregido acá** (fuera del alcance del ítem): `turn.completed` trae
  `cached_input_tokens` y `cache_write_input_tokens`, y `parseCodexStream()` los descarta. No se
  tocó porque no está verificado si `input_tokens` ya los incluye (en la API de OpenAI los cacheados
  son un subconjunto de los de prompt, no un extra) — sumarlos a ciegas duplicaría el conteo.
  Requiere un probe propio antes de cambiar nada.

Este Mes ejecutó (parcialmente) la categoría **Medio** de IDEAS.md — solo `#6`, graduado a este
Bloque. La regla de este Mes fue explícita (Carlos, 2026-08-16): *"vamos idea por idea, no todas
las de la categoría a la vez"* — el resto de la categoría Medio sigue en IDEAS.md, no es deuda.

### Bloque AA — 🧠 IDEAS #6: `design.md` condicional para tareas complejas (OpenSpec)

**Lo que pedía la idea**: único patrón de OpenSpec aún no shipeado (el resto → S28/S29/S32) — un
paso `design.md` intermedio entre la creación de la spec y su aprobación, condicional a la
complejidad de la tarea.

**Verificado antes de escribir código**: el flujo real hoy (`src/spec/`, `spec` en `cli.ts`) es
`spec create → spec draft --description → spec approve`, uniforme para toda tarea — **no existe
noción de "compleja" en ningún lado**. El único gate condicional que ya existe es `clarify`
(`pending` bloquea `spec approve` con mensaje explícito, `src/cli.ts` línea ~1552) — mismo patrón
a mirror para `design`. `requireSpec` (harness.ts línea 198) es un flag global de proyecto, no
por-tarea — no sirve como mecanismo de "esta tarea en particular es compleja".

**2 decisiones de diseño resueltas con Carlos (2026-08-15), no asumidas**:
1. **Disparador de "compleja"**: manual, flag `--design` en `spec create` — no un clasificador
   heurístico. Mismo criterio que ya aplicó el saltar `#4` (clasificador semántico para `clarify`)
   este Mes 27: sin evidencia de que un heurístico automático acierte, la decisión explícita del
   humano es lo único honesto.
2. **Gate de aprobación**: paso separado `spec approve-design <id>`, mismo patrón de dos momentos
   de revisión que el gate de `clarify: pending` — `spec approve` falla si `design: pending`.

**No romper el 99% de specs simples**: sin `--design`, el campo `design` queda ausente
(`undefined`), cero cambio de comportamiento — mismo criterio que `capabilities?` (opcional,
ausente = comportamiento actual).

- [x] **AA.1 — 🧠 `SpecFrontmatter.design` en `store.ts`.** (2026-08-15) Campo
  `design?: 'pending' | 'approved'` (ausente = "no complex", nunca un tercer valor string tipo
  `'none'` — un campo opcional YA modela "no aplica" sin inventar un estado extra). Nuevo
  `designApprovedAt?: string` mirror de `approvedAt`. `parseSpec()`/`serializeSpec()` extendidos,
  mismo patrón que `capabilities`/`approvedAt` (opcionales, solo se serializan si están presentes).
- [x] **AA.2 — 🧠 CLI: `spec create --design`, `spec approve-design <id>`, gate en `spec approve`.**
  (2026-08-15) `spec create <id> --design` setea `design: 'pending'` en el frontmatter inicial +
  inserta `## Design` en el body template. Nuevo comando `spec approve-design <id>`: 404 si no hay
  spec, error si `design` no es `'pending'` (ni ausente ni ya `'approved'` — mensaje distinto para
  cada caso), si no `design: 'approved'` + `designApprovedAt`. `spec approve <id>`: nuevo chequeo
  `design === 'pending'` → bloquea con `Cannot approve "<id>" — design is pending. Run: orchestos
  spec approve-design <id>`, ANTES del chequeo de `clarify`. Verificado en vivo (CLI real, proyecto
  scratch): flujo completo `create --design → approve (bloqueado) → approve-design → approve
  (pasa)`, más el caso simple sin `--design` (cero fricción nueva) y los 2 casos de error de
  `approve-design` (sin marcar compleja / ya aprobado).
- [x] **AA.3 — 🧠 `spec draft` genera la sección `## Design` cuando `design: 'pending'`.**
  (2026-08-15) `draftSpec()` (`src/spec/draft.ts`) recibe `opts.design`; cuando está activo, el
  prompt del LLM pide una sección `## Design` adicional (Decisiones y alternativas consideradas —
  contenido DISTINTO de "## Descripción"/"## Criterios de aceptación", no relleno) insertada antes
  de Criterios. Sin el flag, cero cambio en el prompt/output actual (verificado: el system prompt
  generado no menciona "Design"/"COMPLEJA" en absoluto). `spec draft` (CLI) deriva el flag de
  `s.frontmatter.design === 'pending'` — sin flag nuevo redundante, reusa el estado ya guardado por
  `spec create --design`.
- [x] **AA.4 — ⚡ Superficie en dashboard.** (2026-08-15) [[feedback-dashboard-no-solo-cli]]: botón
  "Approve design" en la pantalla Specs (`screens-ops.js`), visible solo cuando
  `design === 'pending'`; el botón "Approve" normal oculto mientras `design` siga `'pending'`.
  Nueva ruta `POST /api/specs/<id>/approve-design` (`server.ts`/`handlers/specs.ts`,
  `handleApiSpecsApproveDesign`) — mismo gate que el CLI. **Hallazgo real durante la
  implementación**: el modal "Nueva Spec" del dashboard salta directo a `spec draft` (nunca pasa
  por `spec create`) — sin cablear ahí, no habría forma de marcar una tarea compleja desde el
  dashboard en absoluto. Cerrado con un checkbox "Mark as complex" en el modal +
  `spec draft --design` (CLI, nuevo flag idempotente: no pisa un `design` ya
  pending/approved) + `handleApiSpecsCreate` también acepta `{ design: true }` en el body (para
  paridad con el CLI, aunque el modal usa el camino de `draft`).
- [x] **AA.5 — 🔍** (2026-08-15) `tsc --noEmit` limpio. 16 tests nuevos (1122→1138, 0 fail):
  round-trip de `design`/`designApprovedAt` en `store.ts` (incluida la ausencia — cero regresión),
  gate simulado de `design: pending` (mismo estilo que el de `clarify` ya existente),
  `draftSpec()` con/sin `{ design: true }` (mock fetch, verifica el system prompt real enviado al
  LLM), y un archivo de integración nuevo (`specs-design-gate.test.ts`) que ejercita
  `POST /api/specs/*` completo vía `route()` real (mismo patrón que `constitution-api.test.ts`) —
  create con/sin `design`, approve bloqueado/no-bloqueado en los 3 estados de `design`, y los 3
  casos de `approve-design` (éxito, sin marcar compleja, ya aprobado). Además, verificación en
  vivo contra el dashboard real (puerto 4242, Playwright, proyecto scratch): botón "Approve
  design" visible solo con `design: pending`, desaparece y "Approve" aparece tras aprobarlo, toast
  de confirmación real, checkbox del modal "Nueva Spec" presente y correctamente etiquetado.
  Servidor bajado al terminar. `bun run test:coverage`: 1138 pass · 0 fail.

**Mes 28 cierra 11/11 ítems del bloque BB+AA.** El eje "categoría Medio completa" NO se cumplió a
propósito — decisión explícita de Carlos de ir idea por idea, no todas las de una categoría a la
vez; el resto de Medio sigue vivo en IDEAS.md. Deuda real que sí quedó abierta y se resolvió
dentro del propio Mes: BB.6 (costo ficticio de `codex`), diagnosticada el 2026-08-16 y cerrada el
2026-08-18 tras verificar contra el binario real que la opción de leer el modelo del stream era
inviable. Ver también la nota de estado ["¿se está perdiendo la esencia?"](../../PLAN.md) escrita el
mismo día en PLAN.md § Mes 29, con los números reales de uso del harness (515 commits / 64 runs /
53 de ellos chat) — quedó como deuda `CC.0-D6` (el uso real del harness no es medible: los gates
en vivo usan `ORCHESTOS_HOME` temporal y no dejan evidencia en la DB principal).

---

