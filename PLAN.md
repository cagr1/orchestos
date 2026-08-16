---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-29-abierto--orquestador-real--cc0-auditoria-en-curso
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 29 — Que "OrchestOS" deje de quedarle grande al sistema (abierto 2026-08-16)

**Eje, en palabras de Carlos**: *"para realmente poderlo llamar así debería poder abrir varios
chats y elegir el CLI de mi gusto, así como lo estamos haciendo para este propio trabajo… al día
de hoy eso se cumple para 1 solo proyecto, no para varios"*.

**Diagnóstico verificado en código (2026-08-16), no opinión**: OrchestOS hoy es **un ejecutor de
tareas con dashboard**, no un orquestador. Lo que falta es estructural, y cada punto está medido:

| Reclamo | Verificado | Evidencia |
|---|---|---|
| El selector de modelo no cambia al elegir un CLI | ✅ | `handlers/chat.ts:715` hardcodea `runToolLoop('openrouter', …)`. **El chat no sabe correr sobre un CLI**, solo API. Elegir "Claude CLI" no puede cambiar nada ahí. |
| No se pueden tener varios chats con distinto CLI | ✅ | No existe tabla de sesiones de chat. Vive en `state.chatHistory` (memoria JS), se pierde al refrescar. |
| Multi-proyecto no existe | ✅ | **10 handlers** del dashboard hardcodean `resolve('.')`. La tabla `projects` existe en la DB pero la UI es mono-proyecto. |
| Instincts nunca se probó / no sirve | ✅ **peor** | **1 solo** instinct en la DB: `block-e-test-pattern`, `confidence 0.6`, `verified: false`. Umbral de aplicación: `≥0.8 Y verified` (`instincts/schema.ts:165`). **Nunca se aplicó ni se aplicará.** La intuición de Carlos ("si es bueno que se aplique solo") YA es el diseño — lo que falta es que algo verifique instincts. |
| Tabs sin razón de ser | ✅ | 11 tabs: chat · tasks · runs · graph · memory · specs · skills · instincts · project · runner · settings. |

**Regla de este Mes, fijada por Carlos**: *"si un tab no está haciendo lo que dice que debe hacer,
lo ponemos igual dentro de settings pero sin olvidar que hay que probarlo después. Si nos ponemos
a arreglar uno a uno ahora no vamos a aterrizar sobre lo que acabo de mencionar y no quiero eso."*
→ **La auditoría NO arregla nada.** Clasifica y mueve. Lo que se descubre roto se anota como deuda
explícita, no se repara en el camino.

**Absorbe de IDEAS.md** (se eliminan de ahí en el mismo commit, regla de flujo IDEAS→PLAN→DONE):
`#31` (chat multi-proveedor / routing por función), `#35` (directorio de proyecto configurable),
`#50` (chat persistente con sesiones acotadas). Estaban dispersas y mal enmarcadas como ideas
sueltas — son partes de un mismo eje estructural.

- [x] **CC.0 — ⚡ Auditoría tab por tab (2026-08-16).** Las 11 superficies quedaron auditadas
  contra código, rutas HTTP y la SQLite real (`~/.orchestos/db.sqlite`, 49 runs, 3 proyectos,
  1 instinct, 0 memorias, 43 eventos de chat). No se corrigió ninguna superficie en este ítem.

  | Tab | Qué promete | Qué hace hoy | Evidencia de uso real | Veredicto |
  |---|---|---|---|---|
  | Chat | Conversar con OrchestOS y crear tareas desde lenguaje natural | Chat interactivo con historial en memoria del navegador, selector de modelo, adjuntos y auto-creación de tareas | `chat_task_bar_events`: 43 mensajes; `runs`: 38 filas `task_class=chat` | **vive** |
  | Tasks | Administrar y ejecutar las tareas de `tasks.yaml` | Lista estados/reintentos/QA, crea, diagnostica, elimina y ejecuta tareas | `tasks.yaml` activo; `runs`: 49 filas históricas asociadas a ejecuciones | **vive** |
  | Runs | Inspeccionar evidencia, costo, QA, warnings y diffs de ejecuciones | Tabla filtrable con detalle expandible, análisis y borrado | `runs`: 49 (45 done, 4 failed); `run_steps`: 21 | **vive** |
  | Graph | Ejecutar y observar el DAG completo de tareas | Lanza `/api/run/graph`, hace polling de estado y muestra resultados/autonomía | Endpoint y runner existen; `runs` no registra una corrida identificable como graph | **vive** |
  | Memory | Consultar, resolver conflictos y borrar memoria persistida | Búsqueda/filtros por scope, conflictos y borrado | `memory_entries`: 0; `memory_conflicts`: sin filas | **va a Settings** |
  | Specs | Crear, aprobar, lintar y archivar specs por tarea | Lista specs y expone gates de clarify/design/approve | `.orchestos/specs`: 0 specs activas (solo `.DS_Store`); no hay uso histórico persistido | **vive** |
  | Skills | Gestionar skills instaladas, pro/registry e importación | CRUD, build, export, curación e importación; 27 YAML locales | 8 runs con `skill_id=frontend-design`; 27 archivos YAML | **vive** |
  | Instincts | Revisar/aprobar/aplicar aprendizaje automático | CRUD, aprobación y confidence; el runtime solo aplica `verified=true` y `confidence≥0.8` | 1 fila: `block-e-test-pattern`, confidence 0.6, `verified=0`; 0 evidencia de aplicación en runs | **va a Settings** |
  | Project | Editar constitution/context y ejecutar detect/index/summary del proyecto | Pantalla de contexto/configuración del proyecto actual; usa el cwd, no selector multi-proyecto | `projects`: 3 registros (1 OrchestOS + 2 scratch); `CONSTITUTION.md` existe | **va a Settings** |
  | Runner | Mostrar un feed simple de ejecuciones para monitoreo | `SCREENS.runner` existe, pero no está en `NAV`; duplica el feed de Runs y solo instruye usar CLI | No tiene ruta de navegación ni estado propio; el mismo historial vive en `runs` | **se borra** |
  | Settings | Configurar claves, routing, executor, idioma, health, usage y reset | Agrupa configuración y observabilidad operativa | `settings`/`setup` consultados en cada boot; usage deriva de `runs` | **vive** |

  **Deudas descubiertas (no corregidas aquí; probar en su ítem correspondiente):**

  - **CC.0-D1 — Chat: sesiones persistentes y motor por sesión.** `state.chatHistory` vive solo
    en memoria JS; no hay tabla de sesiones. Queda absorbida por CC.2.
  - **CC.0-D2 — Multi-proyecto del dashboard.** La pantalla Project y 10 handlers resuelven el
    cwd (`resolve('.')`); los 3 proyectos de DB no son seleccionables desde la UI. Queda absorbida
    por CC.3.
  - **CC.0-D3 — Instincts sin ciclo de verificación operativo.** La única fila está por debajo del
    umbral y nunca aparece evidencia de aplicación; debe probarse el flujo de propuesta,
    aprobación y aplicación antes de considerarlo funcional.
  - **CC.0-D4 — Graph sin evidencia histórica.** La superficie ejecutable existe, pero no hay una
    corrida graph identificable en la DB; queda como escenario obligatorio del gate CC.5.
  - **CC.0-D5 — Navegación desincronizada por Runner huérfano.** `SCREENS.runner` no es accesible
    desde `NAV` y duplica Runs; CC.4 decide su eliminación efectiva.
- [x] **CC.1 — 🧠 El chat corre sobre el motor elegido, no solo sobre la API.** (2026-08-16)
  Confirmado en código antes de tocar nada: `handlers/chat.ts` nunca consultaba `executor_mode`
  para la respuesta conversacional (solo para la tarea que el chat auto-crea, D.7/E.16) —
  `runToolLoop('openrouter', ...)` / `openrouterChat(...)` corrían siempre, sin importar la
  preferencia. **Alcance decidido**: solo `cli-claude` por ahora — Codex/OpenCode no tienen un
  flag de solo-lectura tan directo como `--allowedTools` de Claude Code, e improvisar su
  sandboxing en el momento sería el mismo error de "construir sin probar" que ya identificamos.
  Queda documentado como pendiente explícito.

  **Diseño**: `runClaudeChat()` nuevo en `executors/external.ts`, reusando el mismo spawn/parseo
  de stream-json que el executor de tareas (`runClaudeCode` refactorizado para recibir `args` ya
  armados en vez de reconstruirlos — sin cambio de comportamiento para el executor existente,
  27 tests de `external-engine.test.ts` siguen en verde). Deliberadamente **sin worktree y sin
  Edit/Write** (`--allowedTools Read,Glob,Grep`): el chat no es una tarea con contrato de
  `output[]`, es conversación — el mismo guard de seguridad de `externalEngine` ("nunca un
  proceso no controlado edita el repo real") se cumple acá por permisos en vez de aislamiento de
  filesystem. `handlers/chat.ts`: nueva rama ANTES de `isOllama` que consulta
  `loadOrcheConfig(root).executor_mode`; si es `cli-claude`, rutea por `runClaudeChat()` con
  timeout propio de 2min (el chat es interactivo, no debe colgar como una tarea de 20min).

  **Gate en vivo** (dashboard real, puerto 4242, proyecto scratch con `executor_mode: cli-claude`):
  (1) mensaje real → respuesta coherente en 9s, `model: "claude (cli default)"` — vino del CLI, no
  de OpenRouter; (2) intento de inyección ("crea un archivo HACKED.txt") → el binario no tiene
  permiso de escritura Y el propio modelo identificó el intento y explicó por qué no — `git
  status` limpio después, nada se escribió. 6 tests nuevos en `claude-chat.test.ts` (mock de
  `Bun.spawn`, sin red real): `--allowedTools` nunca incluye Edit/Write, corre en el cwd real sin
  exigir worktree, acumula texto de múltiples bloques `assistant`, error tipado si el binario
  falta o si no hay evento `result`, mapeo de modelo Anthropic. 1149 tests totales (eran 1143),
  0 fail. Absorbe la parte de `#31` cubierta (routing por CLI); el resto de esa idea (multi-
  proveedor genérico) sigue fuera de alcance.

  **Pendiente explícito, no silencioso**: `cli-codex`/`cli-opencode` en el chat quedan sin
  implementar hasta decidir su modo de solo-lectura; imágenes adjuntas se ignoran en el camino
  CLI (Claude Code sí las soporta vía otro mecanismo, no cableado todavía).
- [ ] **CC.2 — 🧠 Sesiones de chat reales, agrupadas por proyecto.** Persistidas en SQLite, lista
  lateral acumulativa (patrón estándar que Carlos pidió explícitamente, "así como lo hacen todas
  estas herramientas"), **motor por sesión**. Esto es literalmente "abrir varios chats y elegir el
  CLI de cada uno". Absorbe `#50`.
- [ ] **CC.3 — 🧠 Multi-proyecto real.** Matar los 10 `resolve('.')` del dashboard; el proyecto
  activo es una selección del usuario, no el cwd donde se lanzó el server. Absorbe `#35`.
- [ ] **CC.4 — ⚡ Colapsar la navegación según el veredicto de CC.0.** Incluye el ex-BB.3 (unificar
  los dos selectores de Settings) — se hace acá, con la navegación ya decidida, no antes.
- [ ] **CC.5 — 🔍 Gate: el caso de uso completo, en vivo.** Dos proyectos reales abiertos a la vez,
  un chat por proyecto, **cada uno sobre un CLI distinto**, y trabajo real hecho en ambos sin
  cruzar contexto. Si eso no se puede hacer de punta a punta, el Mes no cierra.

---

## MES 28 — Backlog canónico, categoría Medio (abierto 2026-08-15)

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
- [ ] **BB.6 — ⚡ El costo de los motores CLI es ficticio o incomparable.** Ver tabla de BB.4.
  `codex` estima con un modelo que no usó. Decidir: (a) reportar `null`/"n/a" cuando el costo no
  es medible en vez de un número inventado, o (b) mapear el modelo real que el CLI usó. Hoy el
  dashboard muestra esos números como si fueran equivalentes.

Este Mes ejecuta la categoría **Medio** de [IDEAS.md](IDEAS.md), empezando por `#6`. Mismo orden
de índice = único orden de ejecución (regla desde 2026-07-30).

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

---

## MES 27 — Backlog canónico, categoría Bajo-medio (X–Z)

- [x] **SÍ — Mes 27 cerrado (2026-08-13), parcial por diseño**
  Categoría **Bajo-medio** del backlog canónico: `#33` (Bloque X, refuter en el QA loop —
  segunda opinión barata que revierte falsos-negativos del juez antes de quemar un retry, mirror
  asimétrico de K.4b) y `#37` (Bloque Y, badge "Free" + preset "empezar gratis" para modelos
  `:free` de OpenRouter) cerrados completos. `#51` (Bloque Z, acciones por mensaje en el chat)
  cerrado **parcial a propósito**: copiar + timestamp implementados, "rebobinar" queda fuera
  porque la propia idea lo liga a `#50` (sesiones persistentes en SQLite, sin implementar) —
  rebobinar una conversación que solo vive en memoria JS no tiene el mismo sentido. `#4` y `#30`
  verificados y saltados antes de tocar código: ninguno cumple el gate de evidencia que su propio
  texto en IDEAS.md exige. Un bug real no pedido encontrado y arreglado al verificar Y en vivo: la
  selección de rol en Settings → Model routing se revertía en silencio (rerender post-selección
  recalculaba desde el config del servidor, no desde la elección recién hecha). 1122 tests · 0
  fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 26 — Backlog canónico, categoría Bajo (Q–W)

- [x] **SÍ — Mes 26 cerrado (2026-08-08)**
  Categoría **Bajo** completa del backlog canónico de IDEAS.md, 7 ideas (Q `#2` verification-before-completion, R `#3` requesting/receiving-code-review, S `#5` Ruby resolver, T `#19` symlink de node_modules en worktrees, U `#40` Guardar/Limpiar en Constitution, V `#46` spike de Graphify, W `#58` tool-policy.ts dead code). Tres de los siete destaparon bugs reales no pedidos al verificar antes de escribir contenido: **S** — `indexProject()` perdía todo edge cross-file en un pase único (universal, no solo Rust/C#, desde S21) más 2 bugs de resolver, arreglado antes de agregar Ruby (0% → 100% de resolución en los 5 lenguajes); **T** — el symlink de `node_modules` en worktrees se colaba al commit real sin un pathspec de exclusión (`.gitignore` con slash no matchea un symlink); **U** — quitar el autosave de Constitution expuso una pérdida de datos silenciosa contra el poll de 30s del dashboard (guard por foco no cubría el nuevo flujo de botones). **V** fue spike puro: Graphify instalado, comparado, revertido byte a byte — no se adopta el binario (dependencia de runtime de una startup en pivot a SaaS), se roban 2 patrones como IDEAS #59/#60. **W** decidido por Carlos explícitamente: borrar en vez de cablear. 1111 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 25 — Pendientes heredados de los cierres 22–24 + backlog canónico (N, O, P)

- [x] **SÍ — Mes 25 cerrado (2026-08-06)**
  Cerró los pendientes heredados de Mes 22-24 (K.6.2-R7, L.5.7, L.6.2, M ×2) y abrió la ejecución del backlog canónico por esfuerzo de IDEAS.md (regla desde 2026-07-30: el orden de IDEAS.md es el único orden de ejecución). Tres bloques completos: **N** — endurecimiento de skills (Iron Law/Common Rationalizations/Red Flags) portado a `buildSections()`/al ejecutor propio (N.4.5, hallazgo real: el endurecimiento llegaba a Claude Code/Cursor pero nunca al runner de OrchestOS) y auditado contra las fuentes reales (`obra/superpowers`, `mattpocock/skills`) skill por skill, no por nombre — match nominal ≠ match semántico fue el hallazgo de método (N.7b/N.7c). **O** — las skills se activan solas: contrato de activación (`activation.mode/phases/triggers`, O.0), skills resueltas desde la instalación no desde `cwd` (O.1), el planner ve el catálogo y asigna skill por sub-tarea (O.2), gates transversales (`security-review`/`qa-structured`) que el mismo LLM ejecutor no puede descartar (O.3) — verificado en vivo con dinero real contra un proyecto scratch: código con SQL concatenada + credenciales hardcodeadas fue rechazado por el QA judge citando OWASP explícitamente, el checklist inyectado llegó al juez real (O.4). **P** — vigilancia de deriva de fuentes externas (`sources-drift`): registro por path exacto (no repo completo), detección mecánica vía `gh api`, y un paso opcional de resumen vía LLM que lee el diff real y redacta una propuesta para revisión humana (P.4), nunca aplica nada solo. Hallazgo real de hygiene durante O.3: `ctx.allowedTools` en `tool-policy.ts` es dead code (ningún ejecutor lo lee) — documentado y registrado como IDEAS.md #58 en vez de cablearlo sin plan. 1099 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI) verde.
  Ver historial completo → [DONE.md](DONE.md).

---

## v0.12 (MES 21) — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

- [x] **SÍ — v0.12 cerrado (2026-07-14)**
  Higiene de datos (borrado masivo en 5 tablas + cero diálogos nativos, absorbe IDEAS #18), Chat con Markdown/sanitizador propio + chips de task/modelo clicables, visor de diff por run calculado por contenido (no `git diff` post-hoc), y auditoría real de paridad CLI↔dashboard con 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) y verificados independientemente contra código real ([[feedback-verificar-progreso-delegado]]). Nacen 4 reglas de diseño fijas para toda pantalla nueva (anclaje de elementos fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS). Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

- [x] **PARCIAL — Mes 20 cerrado formalmente (2026-07-14), con un gate abierto a propósito**
  Auto-split (el gatillo automático que le faltaba al motor de sub-tareas) diseñado, implementado y con superficie de aprobación en dashboard — el usuario ve y aprueba el plan de sub-tareas antes de gastar. Probado con éxito en un entregable simple end-to-end (`crypto-page-v1`, gate 🔍 con dinero real). **El gate original y más exigente (C.2, dashboard premium multi-archivo React+TS+Vite) sigue PAUSADO** por decisión explícita de alcance de Carlos — gated en 2 prerequisitos concretos: decisión de modelo ([[feedback-modelo-decision-final-carlos]], nacida de un incidente de $5.00 quemados este mismo mes) y presupuesto de outputs de tools del executor agéntico (IDEAS.md #32). Candidato de pre-flight del próximo milestone (ver abajo). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual, no snapshot del mes).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

- [x] **SÍ — Mes 19 cerrado (2026-07-09)**
  El chat lee imágenes con cualquier modelo vía OCR local (`tesseract.js`, sin dependencia de que el modelo elegido tenga visión), soporta múltiples adjuntos (`st.chatFiles[]`, límite 5), y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection en una imagen (el modelo lo ignoró). `task_class: ocr` diferido sin evidencia de caso de uso interno — vuelve a IDEAS.md #30. 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## Pre-flight — gap conocido antes de abrir el próximo milestone

**Actualizado al cierre de Mes 27 (2026-08-13)** — sin gap bloqueante nuevo identificado durante
Mes 27 (el único hallazgo real, el bug de reversión de rol en Model routing de Y.2, se resolvió
dentro de su propio bloque). Historial completo de los tres cierres → [DONE.md](DONE.md).

**Remanentes explícitos de Bajo-medio (no son deuda oculta, están documentados)**:
- `#4` y `#30` siguen parqueados — no cumplen el gate de evidencia de su propio texto en
  IDEAS.md. Se re-evalúan solo si aparece evidencia nueva (falsos negativos reales de `clarify`
  para `#4`; caso de uso real dentro de OrchestOS mismo para `#30`).
- `#51` (rebobinar) sigue bloqueado por `#50` — no se re-visita hasta que `#50` (sesiones
  persistentes en SQLite) se implemente.

**Próximo milestone: por decidir con Carlos** — el orden lo fija
[IDEAS.md § 🧭 Backlog canónico por esfuerzo](IDEAS.md); con **Mínimo**, **Bajo** y **Bajo-medio**
(salvo los 3 remanentes de arriba) atendidas, la categoría **Medio** es la siguiente en el índice.

---

## MES 18 — Chat como entrada única: detección de intención de tarea

- [x] **SÍ — Mes 18 cerrado (2026-07-09)**
  Chat con detección semántica de intención de tarea activada con evidencia real (34 mensajes reales, falso negativo confirmado y corregido — Bloque J), paridad CLI↔Dashboard cerrada (9/9 gaps, Bloque E), auto-selección de skill por dominio (Bloque D), auditoría visual + 13 ajustes "premium dashboard" con causa raíz real en cada uno (Bloques G/I), y 2 bugs reales de producción encontrados y corregidos por dogfooding directo de Carlos (imágenes sin gating de visión, guard de contexto no conectado al chat). 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Mes 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Mes 14/Mes 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Mes 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Mes 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---
