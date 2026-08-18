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

## MES 30 — Dejar de reinventar la UI: React + Tailwind + shadcn/ui (PLANIFICADO 2026-08-18, NO ABIERTO)

> **Estado: NO ARRANCA hasta cerrar el Mes 29.** Decisión de Carlos (2026-08-18): primero se
> termina Mes 29, después se abre este bloque. Ningún ítem `UI.*` se toca antes de eso.

### Decisión y por qué (2026-08-18, NO RE-LITIGAR)

Carlos decide adoptar el estándar de facto de la industria para la UI del dashboard. La decisión
**está tomada y no se vuelve a discutir** — ningún LLM debe re-proponer "hacerlo a mano en vanilla",
pedir que se re-justifique, ni volver a plantear el trade-off. Si un LLM cree que hay un problema
técnico concreto en la *ejecución*, lo dice; la *dirección* no se re-abre.

**La evidencia que motivó la decisión sale de este mismo archivo:**

- v0.12 (Mes 21) tuvo que **inventar 4 reglas de diseño propias desde cero** (anclaje de elementos
  fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS) — ver línea del cierre de
  v0.12 más abajo. Son problemas que Radix UI resuelve de fábrica hace años.
- Mes 21 registró **13 ajustes "premium dashboard"** con causa raíz individual cada uno.
- El patrón `render()` → `innerHTML` → `wire()` (62 `innerHTML` + 186 `addEventListener`) **es** un
  mini-framework escrito a mano. La pregunta nunca fue "¿meto un framework?" sino "¿mantengo el mío
  o uso el que ya resolvió esto?".
- Costo real medido por Carlos: horas por un `<select>`. Meses de "hacerlo sencillo" salieron **más
  caros en tiempo** que adoptar la librería.

**Verificación externa (2026-08-18)**: Claude Desktop es Electron; el combo dominante en apps de
este tipo es React + Vite/Bun + Tailwind + shadcn/ui. Codex integra shadcn/ui vía MCP como registry
de referencia. shadcn/ui está construido sobre **Radix Primitives** (accesibilidad, foco, teclado,
overflow, z-index ya resueltos) + Tailwind. No hay equivalente igual de maduro para vanilla JS.

### Estado inicial medido (2026-08-18, no estimado)

| Pieza | Números reales |
|---|---|
| Pantallas en `window.SCREENS` | **11** — chat, runner, tasks, memory, project, instincts, runs, graph, settings, specs, skills |
| JS de frontend | **~8.300 líneas** — `app.js` 2612, `screens-ops.js` 2408, `screens-core.js` 1647, `i18n.js` 1618, `data.js` 184, `theme.js` 31 |
| CSS | **~2.043 líneas** — `screens.css` 1193, `styles.css` 850 |
| Framework casero | 62 `innerHTML` + 186 `addEventListener`, patrón `render()`/`wire()` |
| Build step | **Ninguno** — `<script src>` globales en `index.html`, sin módulos ES, sin bundler |
| Tests de frontend | **Cero** — los 13 de `src/dashboard/__tests__/` son de handlers/API |
| Tokens de diseño | **30 CSS vars** ya definidas (`--bg`, `--surface`, `--accent`, `--radius`, …) |
| Bun | 1.3.14 — **transpila TSX nativo y tiene bundler propio** |

### Stack elegido

**React 19 + TypeScript + Tailwind v4 + shadcn/ui (sobre Radix), bundleado con `bun build`.**

**No Vite, no Rollup, no webpack, no esbuild.** El punto no obvio que abarata toda la migración:
Bun 1.3.14 ya hace TSX nativo y bundlea. El build es una línea, en el runtime que el repo ya usa.
Tailwind v4 entra por `bun-plugin-tailwind` dentro del mismo `Bun.build()`.

### Costos reales — declarados ANTES, no descubiertos después

1. **Aparece un build step donde hoy no hay ninguno.** Hoy: editar `.js` → recargar. Después:
   `bun run build:ui` (o watch). Toca el flujo de desarrollo y probablemente `scripts/pre-commit.sh`.
   Es el precio real de la decisión y no es negociable.
2. **Coverage gate.** Los umbrales de `scripts/check-coverage.ts` (72.98% / 59.71%) miden
   `src/**/*.ts`. Meter `.tsx` mueve el número. Decidir **explícitamente**: excluir el UI del
   coverage o recalibrar **contra el log de CI, nunca contra el Mac**
   (ver regla "Verificar contra CI" en CLAUDE.md y `reference-ci-host-environment-drift`).
3. **i18n NO se migra.** 223 llamadas a `t()` solo en `app.js`, sistema propio con `window.t`.
   React sigue llamando `window.t()`. Migrar i18n está **fuera de alcance de todo el Mes 30**.
4. **Las 4 reglas de diseño de v0.12** se verifican una por una contra Radix, en vivo. Radix las
   resuelve — pero eso **se comprueba, no se asume** (regla cero de CLAUDE.md: nada se entrega sin
   verificar contra el dashboard real corriendo, no mocks).
5. **11 pantallas.** No es un fin de semana. Carlos asume ese costo explícitamente (2026-08-18).

### Ítems

- [ ] **UI.0 — 🧠 Andamiaje (ninguna pantalla migrada).**
  `public-src/` con React+TS; `bun build` → `public/dist/`; script `build:ui`;
  `bun-plugin-tailwind`. Mapeo de las **30 CSS vars actuales** a tokens shadcn
  (`--background`, `--foreground`, `--border`, `--primary`, `--muted`, `--destructive`, `--radius`)
  — **shadcn adopta la paleta existente, no al revés**: el look actual se preserva.
  Convivencia: React monta en contenedores dentro del DOM vanilla; nada existente se rompe.
  **Validación**: el dashboard actual sigue funcionando idéntico + pipeline de build listo.

- [ ] **UI.1 — 🔍 GATE DE ABORTAR: el combobox de modelo.**
  Una sola isla React dentro del dashboard vanilla actual: reemplazar `buildModelSelect()` por
  shadcn `Command` + `Popover` (patrón combobox buscable — que es literalmente lo que exige
  `reference-model-combo-pattern`, resuelto de fábrica).
  **Es el componente exacto que costó horas.** Si en ~1 día queda mejor que lo actual y se comporta
  bien **verificado en vivo** (dashboard real corriendo), la tesis quedó probada y se sigue.
  Si no, **se aborta acá** habiendo perdido un día en vez de meses.

- [ ] **UI.2 — 🧠 Design system: los 6 componentes que se repiten.**
  Button, Input/Search, Select/Combobox, Dialog, Toast (reemplaza `showToast`), Tabs.
  Más primitives del shell (`cn()`, variantes). Todo shadcn, cero CSS a mano.

- [ ] **UI.3 — 🧠 Shell: sidebar + header + rightpanel + search.**
  El navbar/toolbar/panel colapsable — donde viven las 4 reglas de diseño descubiertas a los golpes.
  Va **después** del design system, no antes, porque toca las 11 pantallas a la vez.

- [ ] **UI.4 — 🧠 Pantallas, en orden de valor.**
  `specs` y `skills` primero (las más chicas — validan el patrón de migración de pantalla completa),
  después `chat` (la home, mayor valor visual), `tasks`, `runs`, `graph`, y `settings` al final
  (la más grande, ~900 líneas).
  **Una pantalla = un commit = verificación en vivo.** Sin acumular (regla de cadencia de commits).
  **Migrar ≠ rediseñar**: primero paridad funcional, las mejoras visuales vienen después.

- [ ] **UI.5 — 🧠 Limpieza.**
  Borrar el `render()`/`wire()` muerto; `screens.css`/`styles.css` reducidos a tokens;
  `index.html` con un solo `<script>`.

- [ ] **UI.6 — 🧠 La UI de sesiones y proyectos (backend ya listo por CC.2/CC.3).**
  Absorbida desde el Mes 29 el 2026-08-18: CC.2 y CC.3 entregan schema + endpoints + tests, y toda
  su superficie visual se construye acá, en React, **nunca en vanilla**.
  Sidebar izquierdo: **toggle Chat | Code** arriba (shadcn `Tabs`), y debajo el árbol de proyectos
  como carpetas colapsables (shadcn `Collapsible`/`Sidebar`) con sus sesiones. En `Code` se ven los
  proyectos con sus agentes; en `Chat` se ven las conversaciones — incluidas las "generales"
  (`project_id NULL`). Cada sesión muestra su agente (inmutable) y su modo (mutable).
  El picker de agente de CC.D2 se reconstruye acá apuntando a `PATCH /api/chat/sessions/:id`,
  ya no a `PUT /api/config`.

- [ ] **UI.7 — 🧠 Navegación nueva: muere "modo avanzado", nace "Observabilidad".**
  Absorbe el ex-CC.4 y el ex-BB.3. Elimina `navModeBtn` y el flag
  `localStorage['orchestos-mode']` (`app.js:1593`, `2263`, `2286-2337`) — el eje deja de ser
  normal/avanzado y pasa a ser Chat/Code.
  En el lugar exacto que ocupaba "modo avanzado" (abajo de todo, justo arriba de Settings) va el
  grupo colapsable **Observabilidad**: Tasks · Runs · Graph · Specs · Skills.
  Memory · Instincts · Project van dentro de Settings (veredicto de CC.0).
  `SCREENS.runner` se borra (deuda CC.0-D5).
  **Gate 🔍 en vivo**: es el equivalente visual de CC.5 — dos proyectos, una sesión por proyecto,
  cada una con un CLI distinto, verificado con navegador real.

### Fuera de alcance del Mes 30 (explícito)

- Migrar i18n a una librería.
- Tocar handlers, endpoints o cualquier cosa de `src/dashboard/*.ts` que no sea servir el bundle.
- Cambiar navegación, rutas o comportamiento funcional — **este mes es puramente visual/estructural**.
- Rediseñar pantallas mientras se migran.

### Riesgo principal

No es React. Es que **a mitad de camino queden dos sistemas conviviendo indefinidamente.**
Por eso UI.1 es un gate de abortar real, y por eso el orden es shell→pantallas y no al revés.

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

- [x] **CC.1b — 🧠 El modelo/esfuerzo reales, no genéricos.** (2026-08-16) Hallazgo real de
  Carlos el mismo día del gate de CC.1: la respuesta decía `"claude (cli default)"` — no
  reflejaba qué modelo ni qué esfuerzo corrió de verdad, y el selector de esfuerzo (3 niveles,
  hardcodeado para el `reasoning` param de OpenRouter) le quedaba chico a Claude Code CLI, que
  `claude --help` confirma con **5 niveles reales**: `low, medium, high, xhigh, max`.

  **Causa raíz**: `runClaudeChat()` no recibía `model`/`effort` en absoluto — la primera versión
  de CC.1 corría siempre con el default del binario. Y `VALID_EFFORTS` (3 niveles) era el único
  set de validación en `handlers/chat.ts`, sin distinguir motor.

  **Fix**: `CLAUDE_CLI_EFFORTS` (5 niveles) exportado desde `executors/external.ts`, reusado por
  el validador de `handlers/chat.ts` — el body acepta los 5 niveles solo cuando
  `executor_mode: cli-claude`, sigue rechazando los ajenos a OpenRouter en modo API (verificado
  en vivo: `xhigh` → 400 en modo API, 200 en modo CLI). `runClaudeChat()` ahora recibe y pasa
  `--effort`/`--model` reales; el label devuelto ya no es genérico:
  `"anthropic/claude-haiku-4-5 via Claude Code CLI (effort: xhigh)"`, verificado en vivo con ese
  valor exacto. Sin modelo Anthropic explícito, el label dice honestamente "claude (cli default
  model)" en vez de inventar uno.

  **Frontend**: `orcheConfig` ahora se carga en el boot general (`fetchAll()`, antes solo se
  cargaba al abrir Settings) — el chat necesita saber el motor activo sin que el usuario haya
  visitado Settings antes. El menú de esfuerzo del composer (`buildChatModelFx`) ofrece 5
  opciones cuando `executor_mode: cli-claude`, 3 si no — la disponibilidad ya no depende solo de
  `modelSupportsReasoning` (concepto por-modelo de OpenRouter, no aplica al CLI).

  4 tests nuevos en `claude-chat.test.ts` (30 pass entre ambos archivos tocados): `--effort` se
  pasa al binario y se refleja en el resultado; sin effort explícito no se manda la flag (el
  binario usa su propio default); label honesto sin modelo Anthropic. 1152 tests totales (eran
  1149), 0 fail.

- [x] **CC.1c — 🧠 Bug real: `GET /api/config` nunca devolvía `executor_mode`.** (2026-08-17)
  Reporte de Carlos: reinició el dashboard varias veces y el selector de esfuerzo seguía en 3
  niveles — no era caché del navegador. Verificado con Playwright contra un navegador limpio
  (sin ningún caché previo) para descartar bug propio antes de culpar al cliente: el **label** de
  la respuesta del chat SÍ reflejaba `via Claude Code CLI` (ese código lee `loadOrcheConfig()`
  directo en el servidor), pero el **selector de esfuerzo** seguía en 3 — confirmó que el bug
  estaba en el frontend, no en caché.

  **Causa raíz**: `handleApiConfigGet()` (`handlers/config.ts`) construye la respuesta a mano,
  campo por campo, y `executor_mode` nunca estuvo en esa lista — el `PUT` (mismo archivo) sí lo
  escribe al YAML, pero el `GET` nunca lo leía de vuelta. `buildChatModelFx` (frontend) depende
  100% de `GET /api/config` para saber el motor activo, así que el campo llegaba `undefined`
  sin importar cuántas veces se reiniciara el servidor — no era un problema de caché en absoluto.
  **Fix de una línea**: agregar `executor_mode: cfg.executor_mode ?? null` a la respuesta.

  **Gate en vivo, esta vez completo (Playwright, no `curl`)**: navegador limpio → abrir menú de
  esfuerzo → **5 opciones reales** (`low/medium/high/xhigh/max`) → elegir `xhigh` → mandar
  mensaje → pill del composer dice "Extra high" y la respuesta real llega con ese esfuerzo.
  2 tests nuevos (`config-executor-mode.test.ts`, vía `route()` real): `executor_mode` presente
  cuando está fijado, `null` explícito (no ausente) cuando no. 1154 tests totales (eran 1152),
  0 fail.

  **Lección de proceso**: el gate de CC.1b se había verificado con `curl` directo al backend
  (`handleApiChat`) y con revisión de código del frontend, pero nunca con un navegador real
  ejecutando el flujo completo end-to-end — por eso este bug (puramente de un endpoint distinto,
  `/api/config`) pasó el gate anterior sin detectarse. Confirma
  [[feedback-verificar-gates-en-vivo]]: un gate 🔍 debe correr contra el sistema real completo,
  no contra la pieza que se acaba de tocar.

### CC.D — 🧠 Decisión de arquitectura: un solo eje "agente", guiado por el estándar (ACP)

**Cómo llegamos acá**: al intentar arreglar "el selector dice deepseek aunque corrió Claude CLI",
Carlos pidió explícitamente **parar y averiguar cómo lo resolvieron otras herramientas antes de
escribir el plan** — *"no quiero pedir algo y después crear un caos interno… tu deber también es
precautelar que no se dañe el sistema, incluso cuando yo me equivoco"*. Cumple
[[INS-2026-007]] (activar conocimiento antes de decidir), que se había salteado.

**Lo investigado (fuentes primarias, 2026-08-17)**: Zed —el caso más cercano: un editor que corre
Claude Code, Codex y Gemini CLI lado a lado— creó el **Agent Client Protocol (ACP)**, hoy estándar
adoptado por varios editores. Su decisión es explícita y textual:

> *"External Agents usually own its own runtime, auth, **model selection**, tools, and native
> configuration."* · *"Model/provider config [is] **Usually owned by the External Agent**"*

Y la consecuencia de UI: **Zed no tiene selector unificado de modelos para agentes externos.** El
usuario elige **el agente** (por thread, desde el botón `+`), y el agente elige su modelo. El
protocolo ni siquiera define model selection — define *session modes* (Ask/Architect/Code), donde
**el agente publica sus modos y el cliente solo los muestra**. Capturado en el vault:
[[wiki/concepts/agent-client-protocol]] + [[INS-2026-015]].

**Lo que esto REFUTA de la propuesta original** (mía y de Carlos): la idea de *"si elijo Claude, el
select muestra los modelos de Claude; si elijo Codex, los de Codex"* exige que OrchestOS mantenga
un catálogo hardcodeado por CLI. Verificado en la máquina real: **ningún CLI publica un catálogo
consultable** — Claude no lo expone, Codex acepta `-m` sin listar, OpenCode tiene catálogo (vía
models.dev) pero sin curar. Mantenerlo a mano = queda desactualizado en silencio con cada modelo
nuevo. Es exactamente el "caos interno" que Carlos quería evitar, y la razón por la que el
estándar no lo hace.

**Lo que VALIDA del instinto de Carlos** (coincide con el estándar en 3 puntos):
1. *"con que se elija el CLI es más que suficiente"* → ACP: se elige el agente, punto.
2. *"debo poder elegir el CLI desde el chat"* → Zed: por thread, no config global.
3. *"Orca solo muestra los CLI que detecta, no se complica con API"* → mismo patrón.

**Decisión final (Carlos, 2026-08-17)**: seguir el estándar. Un solo eje `agent`; bajo un CLI el
selector de modelo **desaparece** y se muestra "modelo: lo decide <agente>". Sin catálogos
hardcodeados. Lo que sí se expone es lo verificable por flag real (`--effort` de Claude, 5 niveles
confirmados con `claude --help`). **"Speed" NO se implementa** — ningún motor expone un toggle de
velocidad real hoy; fabricar el botón sin mecanismo atrás sería la misma clase de mentira que
`/api/config` con `executor_mode` faltante (CC.1c).

- [x] **CC.D1 — 🧠 Consolidar `executor_mode` + `executorEngine` en un solo campo `agent`.** (2026-08-17)
  Hoy son dos enums que se pisan: `ExecutorMode` (`local|cli-claude|cli-opencode|cli-codex|api`) y
  `executorEngine` (`single-shot|agentic|external|opencode|codex`) — donde `cli-claude`↔`external`,
  `cli-codex`↔`codex`, `cli-opencode`↔`opencode` son **el mismo concepto con dos nombres**, y
  `resolveExecutorSelection()` existe solo para traducir entre ellos. Nuevo esquema:
  `agent: claude|codex|opencode|api|local` + `apiMode: single-shot|agentic` (solo aplica cuando
  `agent: api` — **refutación explícita a "meter todo en un campo"**: single-shot vs agentic NO es
  un agente, es cómo se llama a la API propia, y colapsarlo perdería esa distinción real).
  Migración automática de configs existentes al leerlas; `resolveExecutorSelection()` desaparece
  (renombrada `resolveAgentSelection()`).
  **Evidencia**: 12 archivos tocados —
  `config/{schema,load}.ts` (nuevo tipo `AgentChoice`, `AGENT_CHOICES`, `resolveAgent()`/
  `resolveApiMode()` migran los campos legacy en `mergeWithDefaults()`, sin reescribir el YAML),
  `router/engine-cascade.ts` (`resolveAgentSelection()`), `run/harness.ts` (selección de
  `requestedEngine`, protegido — ver entrada LEDGER.md 2026-08-17), `dashboard/handlers/{chat,
  config,tasks}.ts`, `run/executors/external.ts` (comentarios), `dashboard/public/{app,
  screens-core,screens-ops,i18n}.js` (picker de Settings, labels traducidos, chat). De paso se
  encontró y arregló un bug preexistente: `refuterQA` (Bloque X, IDEAS #33) nunca se leía en
  `mergeWithDefaults()` — `refuterQA: true` en cualquier YAML se ignoraba en silencio desde que
  existe el campo. 1154 tests (eran 1152, +6 de tests renombrados/reescritos con los nombres de
  campo nuevos, -4 archivos legacy actualizados) · 0 fail · `tsc --noEmit` limpio en todo el repo.
  Verificado en vivo con Playwright (no solo curl): el `orchestos.config.yaml` real de este repo
  (nunca editado, sigue con `executor_mode: cli-claude` + `executorEngine: external`) resuelve
  `agent: "claude"` / `apiMode: "single-shot"` correctamente vía `GET /api/config`; Settings →
  Executor muestra "Claude CLI" ya seleccionado (con el input de timeout reubicado ahí) y el panel
  "Executor engine" reducido a 2 opciones (sin `external`, que ahora es el agente); el chat sigue
  mostrando los 5 niveles reales de esfuerzo de Claude CLI (Low/Medium/High/Extra high/Max) — cero
  regresión de CC.1/CC.1b/CC.1c.
- [x] **CC.D2 — 🧠 El picker del chat: elegir agente, no modelo.** (2026-08-17; segunda pasada)
  `buildChatModelFx()` ahora agrega la vista root `Agent` y la vista `agent`, alimentada únicamente
  por `state.executorModes` (`GET /api/system/executor-modes`); cada opción usa checkmark y el
  mismo PUT `/api/config` de Settings, con manejo de error y advertencia `notDetected` cuando
  corresponde. `fetchExecutorModes()` quedó incluido en el boot de `fetchAll()` y el estado tiene
  carga explícita. En CLI (`claude`/`codex`/`opencode`) el pill muestra el agente, desaparece el
  combo de modelo y el root dice "Lo decide <agente>"; solo Claude conserva los 5 efforts reales.
  API conserva Model + los 3 efforts de OpenRouter, y Local ofrece únicamente la lista Ollama
  existente, sin effort. Se agregaron las claves i18n inglés/español; no se duplicó ni modificó
  `buildComboOptions()`/el patrón de combo buscable.

  **Gate en vivo:** Playwright + navegador real; dashboard levantado temporalmente en
  `http://localhost:45678` y detenido al terminar. Boot observado con `GET /api/config` 200 y
  `GET /api/system/executor-modes` 200. Con Claude, el pill mostró `Claude CLI · Medium`; al
  abrirlo se vio `Model → Decided by Claude CLI`, `Reasoning effort → Medium` y `Agent → Claude
  CLI`, sin combo de modelo. La vista Agent listó Local, Claude CLI, opencode CLI, Codex CLI y
  API. Se seleccionó opencode y la red mostró `PUT /api/config` 200; el pill cambió a
  `opencode CLI · Medium`, sin Model ni Effort. Se seleccionó API con otro `PUT /api/config` 200;
  el pill volvió a `DeepSeek V4 Flas… · Medium`, el root recuperó Model + Reasoning effort y la
  vista Model mostró el combo buscable con modelos reales. Finalmente se restauró Claude y
  `GET /api/config` confirmó `agent: "claude"`; el YAML se dejó nuevamente con su contenido
  original legacy (`executor_mode: cli-claude` + `executorEngine: external`).

  **Validación:** `bunx tsc --noEmit` + `git diff --check` pasan. `bun run test:coverage` exacto
  se ejecutó dos veces contra el entorno real: 1036 pass / 125 fail por `SQLITE_READONLY` en la
  DB real y `EADDRINUSE` en el test de bind, sin fallos en archivos de CC.D2. Corrida aislada
  reproducible con `ORCHESTOS_HOME` temporal + `bun run db:migrate` + `bun run test:coverage`:
  **1157 pass / 0 fail**, functions 76.81% (mínimo 69%), lines 63.75% (mínimo 57%). Límite:
  el comando CI contra la DB real sigue bloqueado por ese estado externo y queda pendiente
  resolverlo fuera del scope de CC.D2.

  **Segunda pasada (2026-08-17):** se corrigió el hallazgo de Carlos sobre `claude --model`: Claude
  conserva la fila `Model >` y sus 5 efforts, pero su combo usa únicamente `st.orModels` vivo,
  filtrado a `anthropic/*` y sin sufijo `:batch`; no se agregó endpoint ni catálogo hardcodeado.
  Codex/OpenCode mantienen `Lo decide <agente>`. El pill y la vista Agent usan labels orientados
  a pago (`tu suscripción`, `créditos`, `gratis`) solo en este picker; Settings conserva sus
  labels técnicos. Playwright real en `http://localhost:45679`: Claude mostró **17** modelos Anthropic
  reales, se eligió `anthropic/claude-opus-5` y el pill lo reflejó; Codex mostró `Lo decide Codex ·
  tu suscripción` sin selector; API mostró **414** modelos del catálogo completo. El servidor fue
  detenido y la configuración YAML quedó restaurada a su contenido legacy original.
  Gate en vivo: Playwright real en navegador local, con 17 modelos Anthropic de Claude, 414 modelos de API y restauración final a Claude.
  En esta pasada
  `bunx tsc --noEmit` y `git diff --check` pasan; `bun run test:coverage` contra la DB real repitió
  el bloqueo externo (1036 pass / 125 fail: `SQLITE_READONLY` + `EADDRINUSE`) y la corrida aislada
  con DB temporal dio 1156 pass / 1 fail, únicamente el bind `EADDRINUSE` preexistente de
  `csrf-origin` (cobertura 78.53% funciones / 77.96% líneas, sobre los umbrales).

  **Verificación independiente (Claude, 2026-08-17):** ambos fallos (`SQLITE_READONLY` y
  `EADDRINUSE`) reproducidos y descartados como **no reales** — eran colisión de concurrencia
  (dos corridas de `test:coverage` compartiendo el mismo `~/.orchestos/db.sqlite` y el mismo puerto
  fijo de test al mismo tiempo, patrón ya conocido en [[reference-test-fixtures-leak-into-real-db]]).
  Corrida en solitario, sin nada más en paralelo: `bun run test:coverage` → **1157 pass / 0 fail**,
  cero `EADDRINUSE`. `node --check` limpio en los 3 archivos JS tocados
  (`app.js`/`screens-core.js`/`i18n.js`). `GET /api/config` real confirma `agent: "claude"`;
  `GET /api/system/executor-modes` real confirma los 5 agentes con detección correcta (claude/
  opencode/codex detectados vía `Bun.which`, local no detectado, api siempre detectado). Diff de
  `buildChatModelFx()`/`screens-core.js` revisado línea por línea, lógica consistente con el diseño
  acordado. Límite honesto: esta sesión no tiene Playwright/navegador disponible — la verificación
  visual de clicks/render (17 modelos Anthropic, 414 de API, restauración de config) descansa
  únicamente en la corrida de Codex documentada arriba, no fue repetida independientemente.

- [x] **CC.D2 — tercera pasada (2026-08-17), Claude directo sin Codex — bug real de Carlos al usarlo.**
  Eligió "Sonnet 4.6" de la lista de 17 modelos Anthropic vivos de OpenRouter y el CLI
  falló. Reproducido: `claude -p --model claude-sonnet-4.6` → `404 "may not exist or you may not
  have access to it"`. Causa raíz, 3 modos de fallo distintos en el mismo catálogo, no solo uno:
  (1) **formato** — el CLI exige guiones (`claude-sonnet-4-5`), OpenRouter da los ids con punto de
  versión (`claude-sonnet-4.6`); `orchestosModelToCliModel()` solo quita el prefijo `anthropic/`,
  nunca traduce el separador. (2) **SKUs de reventa sin equivalente real** — `claude-opus-4-8-fast`
  (variante "fast" de OpenRouter) también 404: no es un modelo que el CLI reconozca. (3) **modelos
  retirados** — `claude-3-haiku` 404 aunque el formato sea correcto. Verificado en vivo, los tres,
  contra el binario real. Conclusión: no hay forma confiable de saber desde afuera cuál id del
  catálogo de OpenRouter el binario `claude` va a aceptar — exactamente el catálogo frágil que la
  decisión de arquitectura de este Mes (ver más arriba, sección CC.D) ya advertía evitar, solo que
  con fuente viva en vez de hardcodeada. El diseño de la segunda pasada era insuficiente.

  **Fix (definitivo, no parche temporal):** reemplazado el catálogo de OpenRouter para `agent:
  claude` por los alias que el propio binario documenta y promete mantener apuntando al modelo
  vigente — `claude --help`: *"an alias for the **latest** model (e.g. 'fable', 'opus', or
  'sonnet')"*. Agregado `haiku` (no documentado en `--help`, pero verificado funcional en vivo).
  Los 4 — `anthropic/{opus,sonnet,haiku,fable}` — probados uno por uno contra el binario real: los
  4 responden `is_error: false`, salvo `fable` que devolvió un error real y esperado de créditos
  agotados de la cuenta (`"Out of usage credits"` — no un bug, comportamiento correcto). Sin
  traducción de formato, sin SKUs muertos, sin dependencia del fetch de OpenRouter para Claude en
  absoluto — cero mantenimiento futuro, los alias siguen resolviendo solos cuando Anthropic saque
  modelos nuevos. `buildChatModelFx()` (app.js) reemplaza `claudeModels`/combo de OpenRouter por
  una lista fija de 4 botones (sin buscador, sin badges de precio — no aplica a un nivel de
  suscripción); `screens-core.js` agrega el handler `data-modelfx-claude-alias` y limpia el filtro
  de búsqueda muerto que la segunda pasada había dejado condicionado a `agent === 'claude'`.
  `orchestosModelToCliModel()` (`external.ts`, sin tocar) ya traduce `anthropic/opus` → `opus`
  correctamente — verificado con una llamada directa a la función real, los 4 ids resuelven limpio.

  **Límite conocido, no oculto:** `haiku` no está en el contrato documentado del `--help`, solo
  verificado empíricamente — si Anthropic lo retira sin avisar, se rompe. Codex/OpenCode siguen sin
  selector de modelo ("lo decide el agente") — no se investigó si esos CLIs tienen su propio
  mecanismo de alias estables equivalente al de Claude; puede que estemos siendo más restrictivos
  de lo necesario con esos dos. Queda anotado, no es trabajo de esta pasada (evaluar junto a CC.D3).

  **Evidencia:** `node --check` limpio en los 3 JS tocados; `bunx tsc --noEmit` limpio; `bun run
  test:coverage` en solitario → 1157 pass / 0 fail. Verificación end-to-end de la traducción real:
  llamada directa a `orchestosModelToCliModel()` con los 4 ids → `opus`/`sonnet`/`haiku`/`fable`.
  Gate en vivo: sin navegador/Playwright disponible en esta sesión (mismo límite honesto que la
  pasada anterior, no oculto) — dashboard real levantado igual (puerto 4242, arrancado después de
  los cambios, confirmado por timestamp), `GET /api/config`/`GET /api/system/executor-modes`
  reales responden 200 con `agent: "claude"` intacto, `curl` al `app.js`/`screens-core.js`
  servidos confirma que el código nuevo (no una versión cacheada) está en producción del
  dashboard — el click-through visual queda pendiente de una sesión con navegador. Servidor
  detenido al terminar.

- [x] **CC.D2 — cuarta pasada (2026-08-17), Carlos al probarlo — segundo bug real, más de fondo.** el label
  post-respuesta seguía diciendo "Sonnet" sin decir qué versión concreta corrió (4.6, 5, la que
  sea) — un alias resuelve a "lo último" por diseño, pero la UI nunca revelaba a qué resolvió.
  Causa raíz: `runClaudeChat()` (`external.ts:309-317`, previo al fix) devolvía `model: model!` —
  hacía eco del alias PEDIDO, nunca leía lo que el CLI REALMENTE resolvió. Verificado contra el
  binario real: `--model sonnet --output-format stream-json` incluye en el evento `result` un
  campo `modelUsage` con el nombre canónico exacto (`{"claude-sonnet-5": {"canonicalModel":
  "claude-sonnet-5", ...}}`) — dato que `ClaudeCodeJson` ni siquiera declaraba, así que se
  descartaba en silencio.

  **Fix:** `ClaudeCodeJson.modelUsage` agregado al tipo; nueva `resolvedCliModel(parsed)` lee la
  primera key de `modelUsage` (el nombre canónico real); `runClaudeChat()` usa ese valor con
  prioridad, cayendo al alias pedido solo si el evento no trae `modelUsage` (defensivo, nunca
  inventa nada). `handlers/chat.ts:702` no cambió — ya construía el label desde `result.model`,
  así que el fix es transparente a esa capa: el label ahora dice `claude-sonnet-5 via Claude Code
  CLI` en vez de `Sonnet via Claude Code CLI`.

  **Evidencia:** test nuevo en `claude-chat.test.ts` (mock con `modelUsage` en el evento result,
  confirma que gana sobre el alias pedido) + el test existente de CC.1 sigue verde como caso de
  fallback (evento sin `modelUsage` → usa el alias pedido, comportamiento intacto). 10/10 pass en
  el archivo, `bun run test:coverage` → **1158 pass / 0 fail** (era 1157). Verificación end-to-end
  contra el binario real, sin mocks: `runClaudeChat(cwd, sys, msg, 30000, 'anthropic/sonnet')` →
  `result.model === 'claude-sonnet-5'` (confirmado, no simulado). Gate en vivo: sin navegador en
  esta sesión (mismo límite ya declarado), la ruta HTTP completa (`handlers/chat.ts` → dashboard →
  pill del composer) no se re-verificó con Playwright — la corrección se probó contra la función
  real del backend y el binario real, no contra el click-through de la UI.

- [x] **CC.D2 — quinta pasada (2026-08-17), Carlos al probarlo — el selector, no el label post-respuesta.**
  El fix de la cuarta pasada corrige el tag DESPUÉS de la respuesta; Carlos señaló que el problema
  real era el SELECTOR de antes de mandar: sigue diciendo solo "Sonnet"/"Opus"/etc., sin versión.
  Límite estructural confirmado (no hay forma de evitarlo del todo): nadie puede saber a qué
  versión concreta resuelve un alias hasta que el CLI la resuelve — ni Anthropic lo publica por
  adelantado (`claude doctor` verificado, no lo dice; no existe comando de resolución sin gastar
  una llamada real).

  **Solución honesta implementada**: cada respuesta YA trae la resolución real (fix de la cuarta
  pasada) — se persiste por alias en `localStorage` (`rememberResolvedClaudeModel()`, app.js) justo
  donde llega `data.model` (`screens-core.js`, tras el `fetch('/api/chat')`), y el selector la lee
  de vuelta (`getResolvedClaudeModel()`) tanto en el trigger/root ("Sonnet (claude-sonnet-5)") como
  en cada opción de la lista de 4 alias. Nunca inventa nada: si todavía no hay una respuesta previa
  para ese alias en esta máquina, el selector simplemente no muestra el paréntesis — no hay
  "prospectivo" honesto posible, solo "última vez que lo usaste, resolvió a esto".

  **Evidencia:** `node --check` limpio en `app.js`/`screens-core.js`; `bunx tsc --noEmit` limpio;
  `bun run test:coverage` → 1158 pass / 0 fail (sin regresión, la lógica nueva es frontend puro sin
  test unitario dedicado — el codebase no tiene suite de frontend, solo backend/integración).
  Parseo de `resultLabel` verificado con 3 casos (con effort, sin effort, fallback "cli default
  model" → no persiste nada falso). Gate en vivo: sin navegador en esta sesión (mismo límite
  declarado en las pasadas anteriores) — verificado que el servidor real que Carlos ya tenía
  corriendo (archivos estáticos, sin build step) sirve el código nuevo sin reiniciar: `curl
  127.0.0.1:4242/app.js` y `/screens-core.js` confirman las funciones nuevas presentes en lo que el
  navegador de Carlos está cargando ahora mismo. El click-through real (elegir alias, mandar
  mensaje, volver al selector y ver el paréntesis) queda pendiente de que Carlos lo confirme.

- [x] **CC.D2 — sexta pasada (2026-08-17), Carlos confirmó la quinta funciona pero pidió más:
  "sin poder elegir".** Verificado en vivo por Carlos: eligió "Sonnet", la respuesta vino etiquetada
  "sonnet 5" — el fix de la 4ta/5ta pasada funciona. Pero el pedido real es más profundo: quiere
  poder ELEGIR esa versión concreta a propósito, no solo verla después de que ya resolvió sola.

  **Diseño**: el binario acepta el nombre canónico completo directo, no solo el alias — ya
  verificado en la investigación original de esta tarea (`claude --model claude-sonnet-5` funciona
  igual que `claude --model sonnet`). Así que cualquier versión ya vista una vez (via
  `getResolvedClaudeModel()`, las 4 keys de alias en localStorage) se ofrece como opción "fija"
  aparte, en una segunda sección de la lista de modelo bajo Claude: "Siempre la última" (los 4
  alias, como antes) + "Versión fija" (aparece solo cuando ya se conoce al menos una versión real,
  ej. "claude-sonnet-5"), cada una con su propio id `anthropic/<canonical>`. `getKnownClaudePinnedModels()`
  (app.js) junta y deduplica lo aprendido de los 4 alias. Reusa el mismo handler de clic
  `data-modelfx-claude-alias` que ya existía (mismo dataset, sin wiring nuevo en screens-core.js) —
  el value que setea `st.chatModel` ahora puede ser un alias o un id fijo, ambos pasan igual por
  `orchestosModelToCliModel()` sin cambios de backend. `modelLabel`/`claudePinnedLabel` detectan
  cuándo `val` es una versión fija (no matchea los 4 alias, empieza con `anthropic/`) y muestran el
  nombre canónico directo. CSS: `.chat-modelfx-group-label`, mismo patrón visual que
  `.model-combo-group-label` (mayúsculas chicas, separador). i18n nuevo:
  `chat.modelfx.claudeAuto`/`.claudePinned` (en/es).

  **Evidencia:** `node --check` limpio en `app.js`/`i18n.js`; `bunx tsc --noEmit` limpio; `bun run
  test:coverage` → 1158 pass / 0 fail. Verificación end-to-end contra el binario real, sin mocks:
  `runClaudeChat(cwd, sys, msg, 30000, 'anthropic/claude-sonnet-5')` → `result.model ===
  'claude-sonnet-5'` (el id fijo se traduce y corre igual que el alias).
  Gate en vivo: sin navegador/Playwright en esta sesión (mismo límite declarado) — confirmado por
  `curl` que el servidor real que Carlos ya tenía corriendo sirve `app.js`/`i18n.js` con las
  funciones y claves nuevas, sin
  reiniciar. El click-through de la sección "Versión fija" apareciendo tras un uso previo queda
  pendiente de confirmación de Carlos.

- [x] **CC.D2 — séptima pasada (2026-08-17), Carlos pidió investigar afuera antes de seguir
  parchando: "alguna otra herramienta en internet resuelve esto de mejor manera?"** Investigación
  externa real (WebSearch + docs oficiales `code.claude.com/docs/en/model-config`), no otra
  adivinanza: **ninguna herramienta, incluido el propio picker nativo `/model` de Claude Code
  (interactivo, first-party de Anthropic), muestra un catálogo completo de versiones.** Usa el
  mismo patrón de alias (`default/best/fable/sonnet/opus/haiku/sonnet[1m]/opus[1m]/opusplan`) y la
  documentación oficial dice textual: *"Aliases point to the recommended version for your provider
  and update over time. To pin to a specific version, use the full model name, for example
  `claude-opus-5`."* — es EXACTAMENTE el diseño de alias+fijar-versión ya implementado en la pasada
  anterior. La tabla oficial confirma además la resolución actual documentada por Anthropic mismo
  (Anthropic API: `opus`→Opus 5, `sonnet`→Sonnet 5). Un WebSearch adicional sobre Haiku dio un dato
  viejo/contradictorio (mezclaba Haiku 3.5 con 4.5) — descartado, no se usa nada de eso; se
  reverificó contra el binario real en su lugar.

  **El hueco real, ahora sí identificado con precisión**: la sección "Versión fija" (pasada
  anterior) solo se llena con USO real — vacía hasta que Carlos gastara al menos un mensaje por
  alias. No estaba roto, estaba vacío por diseño (nunca inventa nada), pero eso generaba la
  sensación de "no funciona".

  **Fix**: `CLAUDE_SEED_RESOLVED_2026_08_17` (app.js) — 3 valores (`opus`→`claude-opus-5`,
  `sonnet`→`claude-sonnet-5`, `haiku`→`claude-haiku-4-5-20251001`) verificados en vivo contra el
  binario real en el momento de este commit (`claude -p --model <alias> --output-format json`,
  leyendo `modelUsage`), NO sacados de la búsqueda web. `fable` deliberadamente excluido — no se
  pudo confirmar (la cuenta se quedó sin créditos de usage al probarlo, error real y esperado, no
  un bug). La semilla se usa como fallback SOLO cuando no hay valor aprendido en `localStorage`
  (`getResolvedClaudeModel(id) || CLAUDE_SEED_RESOLVED_2026_08_17[id]`) — en cuanto Carlos use un
  alias de verdad, ese valor real gana y sobreescribe la semilla.

  **Evidencia:** `node --check`/`tsc --noEmit` limpios; `bun run test:coverage` → 1158 pass / 0
  fail (sin cambio, misma lógica frontend sin suite dedicada). Verificación end-to-end contra el
  binario real, sin mocks, de los 3 valores sembrados: `runClaudeChat(..., 'anthropic/claude-opus-5')`
  y `'anthropic/claude-haiku-4-5-20251001'` ambos devuelven exactamente esos ids de vuelta (además
  de `claude-sonnet-5` ya confirmado en la pasada anterior) — los 3 nombres canónicos sembrados
  corren de verdad, no son un placeholder. Gate en vivo: sin navegador en esta sesión (mismo
  límite ya declarado) — `curl 127.0.0.1:4242/app.js` confirma que el servidor real que Carlos ya
  tenía corriendo sirve el código nuevo sin reiniciar.

- [x] **CC.D2 — octava pasada (2026-08-17), Carlos: "no podemos llamar a un modelo
  claude-haiku-4-5-20251001" + "faltan modelos" + "cambio de modelo si o no."** Dos hallazgos
  reales, no adivinanzas nuevas:

  1. **Id crudo mostrado sin formatear.** El id que devuelve el binario (`claude-haiku-4-5-20251001`,
     con sufijo de fecha de snapshot) se mostraba tal cual en la UI — ilegible. `claudeHumanModelLabel()`
     (app.js) nuevo: separa familia + versión, descarta el sufijo de fecha (regex `\d{8}`, formato
     `YYYYMMDD`) que el binario agrega a algunos snapshots pero no aporta nada al usuario. Verificado
     con los 4 casos reales: `claude-opus-5`→"Opus 5", `claude-sonnet-5`→"Sonnet 5",
     `claude-haiku-4-5-20251001`→"Haiku 4.5", `claude-fable-5`→"Fable 5". Aplicado en los 3 puntos
     donde antes se mostraba el id crudo (fila del alias, lista de "Versión fija", label del pill
     cuando hay una versión fija seleccionada).
  2. **Fable faltaba en la semilla** (pasada anterior lo excluyó por no poder probarlo — créditos
     agotados). Encontrado: el id real (`claude-fable-5`) YA estaba disponible como dato provisto
     directo por el propio harness de Claude Code en el contexto del sistema de esta sesión
     ("Model IDs — Fable 5: 'claude-fable-5'") — fuente autoritativa que no requería adivinar ni
     reintentar contra la cuenta sin créditos. Agregado a `CLAUDE_SEED_RESOLVED_2026_08_17`.

  **Sobre "cambio de modelo sí o no"**: no, no era un límite de capacidad — fue no pensar la capa
  de presentación antes de implementar (mostrar el id técnico tal cual) y no revisar el propio
  contexto disponible antes de declarar un dato "no confirmable". Ambos son procesos corregibles,
  no una limitación del modelo usado en esta sesión.

  **Evidencia:** `node --check`/`tsc --noEmit` limpios; `bun run test:coverage` → 1158 pass / 0 fail
  (sin cambio, mismo motivo de siempre — frontend puro sin suite dedicada); formateador probado con
  los 4 casos reales conocidos (ver arriba), resultado exacto esperado en los 4.
  Gate en vivo: sin navegador/Playwright en esta sesión (mismo límite declarado en todas las
  pasadas) — `curl
  127.0.0.1:4242/app.js` confirma el código nuevo servido sin reiniciar por el servidor real que
  Carlos ya tenía abierto.

- [x] **CC.D2 — CIERRE FINAL (2026-08-17).** Decisión explícita de Carlos: alias + versión fija
  (lo ya construido) es el diseño definitivo, sin API key de Anthropic — investigado y descartado:
  mostrar el catálogo de OpenRouter bajo Claude reabriría el bug original del día (ids que el CLI
  rechaza), y no hay otra fuente confiable sin esa key. **No se vuelve a tocar "mostrar más
  versiones históricas" sin una decisión nueva de Carlos.**

  Último hallazgo real, encontrado por Carlos al cambiar a Codex desde el nuevo picker de agente:
  `handlers/chat.ts` solo tiene rama especial para `agent === 'claude'` (decisión de alcance de
  CC.1, documentada — Codex/OpenCode no tienen flag de solo-lectura confirmado). Elegir "Codex"
  desde el picker de CC.D2 dejaba el agente del proyecto en `codex`, pero el chat caía en silencio
  al camino de OpenRouter (el label de la respuesta sí decía la verdad, "via OpenRouter", pero el
  SELECTOR prometía algo que el chat no puede cumplir). Fix: `codex`/`opencode` aparecen
  deshabilitados en el picker de AGENTE del chat (con nota "sin cablear para el chat todavía — cae
  a OpenRouter"), y un aviso visible en la fila raíz del menú si el agente activo del proyecto ya
  es uno de esos dos (por ejemplo, quedado de antes de este fix). Siguen siendo agentes válidos
  para tareas en Settings — esto es solo el picker del chat. Coincide con lo que CC.D4 (más abajo,
  todavía abierto) ya preveía hacer ("Codex/OpenCode visibles pero marcados 'no disponible para
  chat'"); adelantado acá porque el bug ya era visible en vivo.

  **Evidencia:** `node --check`/`tsc --noEmit` limpios; `bun run test:coverage` → 1158 pass / 0
  fail. Gate en vivo: sin navegador en esta sesión (mismo límite declarado en todas las pasadas) —
  `curl 127.0.0.1:4242/api/config` confirma `agent: "claude"` en el servidor real que Carlos ya
  tenía corriendo (no se tocó su config), `curl .../app.js` confirma el código nuevo servido sin
  reiniciar.

  **Balance honesto de esta tarea, para no repetir el patrón**: 8 pasadas para lo que debió ser 1–2.
  Causa de fondo, no las herramientas usadas: reaccionar a cada síntoma con código nuevo en vez de
  parar a investigar el límite real (formato del CLI, luego versión resuelta, luego catálogo
  completo) antes de la primera implementación. La octava pasada solo costó tiempo porque la
  séptima ya tenía la respuesta (ninguna herramienta muestra catálogo completo sin key) y no se
  aplicó hasta que Carlos lo señaló de nuevo.
- [x] **CC.D1c — ⚡ `PUT /api/config` reescribe TODO el YAML, migra campos legacy sin que se pida.** (2026-08-18)
  Hallazgo real reproducido 2 veces en esta misma sesión (2026-08-17): `orchestos.config.yaml` de
  este repo se dejó deliberadamente con `executor_mode`/`executorEngine` (formato legacy) como
  fixture vivo de que la migración de CC.D1 funciona en lectura sin reescribir. Pero
  `handleApiConfigSet()` (`handlers/config.ts:158`) hace `writeFileSync(configPath,
  yamlStringify(newConfig))` **incondicional**, y `newConfig` parte de `current = loadOrcheConfig()`
  — que YA migró los campos legacy a `agent`/`apiMode` en memoria. Resultado: cualquier PUT, aunque
  sea guardar un valor sin relación (ej. tocar el selector de agente en el chat, aunque sea al MISMO
  agente que ya tenías), reescribe el archivo completo al formato nuevo — silencioso, sin flag, sin
  aviso. No corregido acá (fuera de alcance de la sesión); revertido a mano las 2 veces que apareció.
  Fix mínimo cuando se tome: no reescribir campos que el body no pidió cambiar, o al menos no
  "limpiar" el formato legacy salvo que el usuario haya tocado ese campo específico.

  **Resolución:** `handleApiConfigSet()` ahora carga el documento YAML existente y aplica cambios
  únicamente en las rutas solicitadas (`models.*`, `apiMode`, `agentic.maxIterations`,
  `external.timeoutMs`, `agent`). Conserva comentarios, campos desconocidos y los aliases
  `executor_mode`/`executorEngine` cuando el PUT no toca `agent`; al editar `agent` explícitamente,
  elimina esos aliases porque la migración ya fue solicitada por el usuario. Si el YAML existente
  es inválido, conserva el fallback anterior: escribe la configuración validada y resuelta.

  **Evidencia:** `bun run agent:preflight -- --item CC.D1c --agent codex` ✅; baseline
  `bunx tsc --noEmit` + `bun run test:coverage` (1158 pass, 0 fail) ✅; tests específicos después
  del fix (9 pass, 0 fail) ✅; `bun run test:coverage` final (1160 pass, 0 fail) ✅. Los tests prueban
  preservación real del comentario, campos legacy y desconocidos ante un PUT ajeno, además de la
  limpieza intencional al editar `agent`. No se modificó el `orchestos.config.yaml` del repo:
  ya tenía un cambio ajeno (`agent: codex`) al iniciar esta tarea.

  **Gate en vivo: Playwright (2026-08-18):** dashboard real en `http://localhost:4244` sobre un
  fixture temporal: página cargó con contenido (`bodyText: 1112`); `PUT /api/config` devolvió
  `200 {ok:true}`; `GET /api/config` confirmó `apiMode: agentic` y `agent: api`; consola del
  navegador registró 0 errores y 0 warnings. El YAML del repo no participó en la mutación.
- [x] **CC.D1b — ⚡ `orchestos context update` sobreescribe `AGENTS.md` a ciegas.** (2026-08-18) Hallazgo real
  (2026-08-17), no en camino de CC.D: `ctx.command('update')` (`src/cli.ts:154-169`) corre
  `buildProfile(root)` (auto-detección genérica) → `generateAgentsMd(profile)` → **escribe
  `AGENTS.md` sin fusionar con el contenido existente**, borrando reglas escritas a mano (identidad
  git, hooks, invariantes, estado de seguridad). Confirmado en vivo: una corrida redujo este
  `AGENTS.md` de 92 líneas con reglas reales a 19 líneas de plantilla ("Stack/Conventions/Notes for
  AI agents" genérico). Distinto de `context compress` (línea ~224), que SÍ es seguro — solo lee
  AGENTS.md y escribe CONTEXT.md, nunca al revés. Fix mínimo: `update` debe fusionar/preservar
  secciones manuales o, si es solo para proyectos nuevos sin AGENTS.md propio, negarse a
  sobreescribir uno que ya exista sin `--force`. Restaurado a mano vía `git checkout -- AGENTS.md`
  + re-aplicación del invariante perdido; sin pérdida real porque no había commit de por medio.

  **Resolución:** `orchestos context update [path]` ahora se niega con código de salida 1 cuando
  `AGENTS.md` ya existe y no se pasa `--force`; no ejecuta detección, no actualiza la DB y no crea
  `context.json` en ese caso. `--force` es el opt-in explícito para reemplazar las reglas manuales;
  conserva el flujo anterior de detección, generación y persistencia cuando se solicita.

  **Evidencia:** `bun run agent:preflight -- --item CC.D1b --agent codex` ✅; `bunx tsc --noEmit` ✅;
  tests específicos (7 pass, 0 fail) ✅; `bun run test:coverage` final (1162 pass, 0 fail, 117
  archivos) ✅. La prueba de proceso confirma que el rechazo conserva `AGENTS.md` y evita
  `context.json`; el caso `--force` confirma el reemplazo explícitamente autorizado.
- [x] **CC.D3 — ⚡ Nombres de modelo legibles.** Reclamo de Carlos: *"algunos modelos tienen el
  nombre muy largo, no se alcanza a leer cuál es"*. Truncado con el nombre completo accesible
  (tooltip/`title`), sin romper [[reference-model-combo-pattern]] (el combo sigue siendo buscable).
  **Evidencia:** `node --check src/dashboard/public/app.js` ✅; `bunx tsc --noEmit` ✅; suite
  `src/dashboard/__tests__/chat-md-highlight.test.ts` (20 pass, 0 fail) ✅. El renderer conserva
  el ID completo para búsqueda/selección y añade `title`/`aria-label`; el CSS agrega `min-width: 0`
  para que la elipsis funcione dentro de flex. **Gate en vivo:** navegador real Playwright ✅:
  dashboard en `http://localhost:4244`, picker Chat abierto, buscador presente, opción larga
  inspeccionada con `text-overflow: ellipsis` y tooltip/aria con el nombre completo; consola actual
  sin errores.
- [x] **CC.D4 — 🔍 Gate en vivo, con navegador real.** Aprendizaje de CC.1c: `curl` al backend no
  alcanza. Playwright: cambiar de agente desde el chat, verificar que el label refleja el agente
  real, que bajo CLI no hay selector de modelo fantasma, y que bajo API sigue funcionando igual
  (cero regresión). Codex/OpenCode visibles pero marcados "no disponible para chat" —
  **verificado en vivo que `codex exec --sandbox read-only` NO impide escribir** (creó
  `HACKED.txt` en la prueba), así que ofrecerlos para chat sería inseguro hasta resolverlo.
  **Evidencia:** `bun run agent:preflight -- --item CC.D4 --agent codex` ✅; `bunx tsc --noEmit` ✅;
  suites de governance/config/engines (9 pass, 0 fail) ✅. **Gate en vivo:** navegador real
  Playwright ✅ en `http://localhost:4245`: API → Claude → API, `/api/config` devolvió
  `agent: api` y el valor sobrevivió una recarga; Claude mostró aliases/versiones sin buscador;
  API conservó el buscador y filtró `dots-studio/dots-3-note-preview:free`; Codex/OpenCode
  aparecieron deshabilitados con "Not wired for chat yet" y sin `data-modelfx-agent` ni selector
  de modelo; consola posterior a la recarga: 0 errores.
### CC.2 — Sesiones de chat reales: diseño cerrado (2026-08-18)

**Regla de frontend para todo el resto del Mes 29 (decisión de Carlos, 2026-08-18):**
**NO se escribe UI nueva en JS vanilla.** Ni "mínima", ni "provisional", ni "para el gate".
Toda superficie visual nueva se construye en el Mes 30 con React+shadcn. Textual de Carlos:
*"YA NO RECOMENDAR vanilla, eso lo vamos a cambiar; insistir en lo mismo es caer en un loop"*.
Consecuencia directa: **CC.2 y CC.3 son backend puro** (schema + endpoints + tests), y todo lo
visual de sesiones/navegación son ítems del Mes 30 (`UI.6`, `UI.7`). Ver
[[feedback-no-reinventar-ui-usar-libreria]].

**Verificación externa (2026-08-18, fuentes primarias)** — se investigó en vez de opinar, a pedido
de Carlos (*"como lo están resolviendo aquí herramientas similares"*):

| Fuente | Hallazgo textual | Consecuencia para OrchestOS |
|---|---|---|
| **Orca** (docs oficiales) | *"An agent session is one CLI agent running in one terminal in one worktree."* Sin cambio de agente a mitad de sesión — si querés otro, es otra sesión o un fork. | `agent` es columna de la sesión e **INMUTABLE** tras crearla. |
| **ACP** (spec de session modes) | 3 modos: `Ask` (permiso antes de cambiar), `Architect` (diseña sin implementar), `Code` (acceso completo). *"The current mode can be changed at any point during a session."* | `mode` es columna de la sesión y **MUTABLE en caliente**. Agente y modo son **dos ejes distintos** — confundirlos sería el mismo error que `executor_mode`+`executorEngine` (CC.D1). |
| **Claude Code** (docs de permission modes) | `plan` es read-only **para toda la sesión** (lee y explora, nunca escribe ni ejecuta); `acceptEdits` escribe. Se togglea en caliente (Shift+Tab). | El toggle Chat\|Code **no es cosmético: es la frontera de permisos**. Ya está a medias implementado en CC.1 (`--allowedTools Read,Glob,Grep`). |
| **Zed** (profiles del agente propio) | Separa `Ask` (read-only tools) de `Minimal` (**no tools, pure chat**). | El chat "general" que pidió Carlos es el `Minimal` de Zed. **No hace falta un tercer modo**: una sesión sin `project_id` no tiene repo que leer, así que degrada sola a chat puro. |

**Decisiones cerradas (Carlos, 2026-08-18)** — no re-preguntar:

1. **Un agente por sesión, inmutable.** *"No podemos mezclar agente dentro de un chat."* Coincide
   1:1 con Orca. El picker de agente del chat (CC.D2) **deja de hacer `PUT /api/config`** — escribe
   en la sesión. El `agent` de `orchestos.config.yaml` queda como **default al crear sesión nueva**,
   nada más.
2. **`mode: 'chat' | 'code'`**, mutable en caliente (ACP). `chat` = read-only (`Read,Glob,Grep`, lo
   que ya hace CC.1); `code` = worktree + escritura. Es una frontera de seguridad real y auditable
   — cumple [[INS-2026-014]] (declarar explícitamente qué puede tocar cada agente, no confiar en el
   prompt).
3. **`project_id` NULLABLE.** *"No necesariamente trabajar en algo significa un proyecto de
   desarrollo, puede ser algo sencillo"* — ese es el chat "general". El schema lo soporta desde el
   día uno para no rediseñarlo después. Qué más significa "general" se decide en el Mes 30.
4. **Desaparece el botón "modo avanzado"** (`navModeBtn`, `app.js:2286-2337`, flag
   `localStorage['orchestos-mode']`). Lo reemplaza el toggle **Chat | Code**.
5. **Grupo "Observabilidad"** en el sidebar, **en el lugar exacto donde estaba "modo avanzado"**:
   abajo de todo, justo arriba de Settings (`app.js:2316`, entre `<div class="grow">` y
   `bottomNav`). Al presionarlo se despliegan Tasks/Runs/Graph/Specs/Skills. Memory, Instincts y
   Project sí van a Settings (veredicto de CC.0, sin cambios).
   *Nota: Carlos escribió "lado lateral derecho" pero describió la posición de "modo avanzado",
   que vive en el sidebar IZQUIERDO — se asume izquierdo; corregir si era literal.*

- [ ] **CC.2 — 🧠 Sesiones de chat reales (BACKEND PURO — cero frontend).** Absorbe `#50` y
  la deuda CC.0-D1. Hoy `state.chatHistory` vive solo en memoria del navegador
  (`screens-core.js:288-528`) y se pierde en cada reload; el run que el chat crea guarda
  `project_id: null` a propósito (`chat.ts:273`).
  **Schema** (`src/db/migrate.ts`):
  `chat_sessions(id, project_id NULL→projects, agent, mode, title, created_at, updated_at)` +
  `chat_messages(id, session_id→chat_sessions, role, content, model, task_id, ocr_used, created_at)`.
  **Módulo** `src/db/chat-sessions.ts` (mismo patrón que `db/runs.ts`).
  **Endpoints**: `GET/POST /api/chat/sessions`, `GET /api/chat/sessions/:id/messages`,
  `PATCH /api/chat/sessions/:id` (solo `mode` y `title` — `agent` rechaza 400, es inmutable),
  `DELETE /api/chat/sessions/:id`.
  `POST /api/chat` acepta `sessionId` **opcional**: si viene, persiste y aplica el `agent`/`mode`
  de la sesión; si no viene, comportamiento actual intacto — **cero regresión** del chat efímero
  que ya funciona y de CC.1/CC.D2.
  **Validación**: tests de endpoints + inmutabilidad de `agent` + que `mode: chat` nunca habilite
  Edit/Write. Sin Playwright — no hay UI nueva que mirar.

- [ ] **CC.3 — 🧠 Multi-proyecto real (BACKEND PURO).** Matar los 10 `resolve('.')` del dashboard;
  el proyecto activo es una selección del usuario, no el cwd donde se lanzó el server.
  Absorbe `#35` y la deuda CC.0-D2. La UI de selección va en `UI.6` (Mes 30).

- [ ] **CC.4 — ABSORBIDO por el Mes 30 (2026-08-18).** "Colapsar la navegación" era un rediseño
  de navegación en vanilla; ahora la navegación entera se reconstruye en React (`UI.3` + `UI.7`).
  El ex-BB.3 (unificar los dos selectores de Settings) viaja con él.

- [ ] **CC.5 — 🔍 Gate: el caso de uso completo, por API.** Dos proyectos reales, una sesión por
  proyecto, **cada una sobre un CLI distinto**, trabajo real hecho en ambas sin cruzar contexto —
  verificado contra los endpoints reales y la SQLite real, **no por click-through** (no hay UI
  nueva en este Mes). El gate visual equivalente es `UI.7` en el Mes 30. Incluye el escenario de
  graph pendiente (deuda CC.0-D4). Si esto no se puede hacer de punta a punta, el Mes no cierra.

### Nota de estado — ¿se está perdiendo la esencia? (2026-08-18)

Carlos preguntó, al cerrar el diseño de CC.2, si tanto mirar a otras herramientas (ACP, Orca,
shadcn) estaba desviando a OrchestOS de su objetivo. Se midió antes de opinar. **Queda anotado
como criterio de contraste, no como veredicto** — incluido el error de medición que cometí.

**Números reales de este día** (`~/.orchestos/db.sqlite` + `git`):

| Métrica | Valor |
|---|---|
| Commits | 515 · costo acumulado **$1.58** en toda la historia |
| Runs en la DB | 64 — de los cuales **53 son `task_class=chat`** |
| Ejecución de tareas | 11 (implement 6 · plan 3 · fix 1 · doc 1) |
| Último run de tarea **en la DB principal** | 2026-07-20 |
| Runs con QA | 9 de 64 (7 pass · 2 fail) · con checks ejecutados: 6 |
| Runs de agosto | 19 — **todos `chat`** |

**Mi lectura inicial fue incorrecta y Carlos la refutó.** Yo concluí "el harness lleva 29 días sin
encenderse". Falso: BB.4 (2026-08-16) corrió los **3 motores CLI** sobre la misma tarea con
resultados documentados, y los gates en vivo de CC.D corrieron el 17 y 18. Lo que pasa es que
**todas esas corridas usan `ORCHESTOS_HOME` temporal y su evidencia se borra con el tmpdir** —
verificado: existe una sola DB en el sistema (`~/.orchestos/db.sqlite`), y los scratch de
`/private/tmp/orchestos-*` no dejan filas. La DB principal solo ve el chat.

**Hallazgo real, que vale más que la observación original:** *no existe una serie de tiempo del
uso del harness.* Ni Carlos ni un LLM pueden responder "¿cuánto se ha ejercitado de verdad?" con
datos, porque la instrumentación mide el chat y descarta justamente las corridas que importan.
Es el mismo patrón que motivó el **Mes 15.F0** ("los instrumentos de medición deben decir la
verdad antes de tocar el motor"), reaparecido en otra capa. **No se corrige acá** (regla del Mes:
la auditoría clasifica, no repara) — queda como deuda `CC.0-D6`.

**Respuesta de Carlos (2026-08-18), aceptada:** *"aún no se ha probado porque aún no está listo,
lo seguimos desarrollando"*. Es consistente con los datos: el chat recién sabe correr sobre un CLI
desde CC.1 (2026-08-16) y las sesiones no existen todavía. Probar "como es debido" antes de eso
habría medido un producto que no estaba.

**Lo que sí queda como criterio permanente:**

1. **Imitar el estándar no diluye la esencia.** Las 3 investigaciones externas de este Mes (ACP en
   CC.D, Orca hoy, shadcn ayer) dieron el mismo resultado: el instinto de Carlos ya coincidía con
   el estándar, y lo caro era demostrarlo desde cero. Copiar lo resuelto libera tiempo para lo
   diferencial — no lo reemplaza.
2. **El diferencial de OrchestOS es el harness de verificación, y sigue intacto.** Orca es un
   cockpit de terminales paralelas (agentes lado a lado + diff, **cero verificación**); Claude Code
   tiene permission modes, que no son un contrato de `output[]` + checks + QA. `enforceContract`,
   `checks`, QA, ledger y spec-driven no existen en ninguna de las dos. Mes 17 ya demostró que
   funcionan sobre un motor que OrchestOS no controla.
3. **La vara se movió a favor, no en contra.** Que los CLI agénticos hayan resuelto *ejecutar* mata
   a OrchestOS-como-ejecutor, pero hace más valioso a OrchestOS-como-harness: hay más agentes que
   nunca escribiendo código y nadie verificando la salida. El diferencial se corrió de "ejecutar" a
   "verificar lo que otro ejecutó".
4. **"Usable por personas comunes" no cambió, y los datos lo confirman.** 53 de 64 runs son chat
   (83%). Un no-dev no va a abrir `tasks.yaml` ni leer un `qa_verdict`. La forma que el propio uso
   está dictando es: **el chat es la puerta, el harness corre detrás sin que se vea.** Coherente con
   todo lo decidido en CC.2 y en el Mes 30.

- [ ] **CC.0-D6 — ⚡ El uso real del harness no es medible.** Las corridas de verificación
  (BB.4, gates en vivo) usan `ORCHESTOS_HOME` temporal y no dejan filas en la DB principal, así que
  la única serie de tiempo disponible mide solo el chat y subestima el uso del motor. Decidir:
  (a) que los gates en vivo escriban en la DB real con una marca `task_class` distinguible, o
  (b) exportar la evidencia del tmpdir al ledger antes de borrarlo. Sin esto, cualquier pregunta
  futura de "¿esto se está usando?" se responde con datos incompletos — que es exactamente el error
  que se cometió al escribir esta nota.

---

## MES 28 — Backlog canónico, categoría Medio (abierto 2026-08-15, cerrado 2026-08-18) → [DONE.md](DONE.md)

Bloque BB (2026-08-16): un solo selector real de "cómo corre OrchestOS" (`executor_mode` unificado,
5 motores, artefactos del host filtrados, comparación medida de los 3 CLIs). Bloque AA: IDEAS `#6`
graduada (`design.md` condicional vía OpenSpec, con gate CLI+dashboard). **11/11 ítems cerrados** —
BB.6 (costo ficticio de `codex`) quedó abierto del 16 al 18 y se cerró con un guard antes del
spawn, sin fabricar el número ni tocar schema. La categoría Medio de IDEAS.md NO se agotó a
propósito (decisión de Carlos: idea por idea, no toda la categoría de una vez). Detalle completo,
diagnóstico de BB.6 y evidencia de los 11 ítems → [DONE.md § Mes 28](DONE.md).

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

## Knowledge promotions

<!-- knowledge-promotion:KP-20260817-102752-93e4d5 -->
### Planificar antes de cambios multi-módulo

- Insight: `INS-2026-005` (adopted/high)
- Razón: El incidente del hook desincronizado y las entregas de UI/configuración sin wiring demuestran que las reglas narrativas no bastan; se necesita un protocolo universal con gates mecánicos y evidencia en vivo para cualquier LLM.
- Acción propuesta: Agregar al Mes 29 un bloque de gobernanza cross-LLM: orden obligatorio de preflight, verificación de scope y trabajo paralelo, doctor de hooks, gates de seguridad/typecheck/tests y prohibición de cerrar UI/configuración sin prueba real de navegador y backend.
- Regla: Si una modificación cambia arquitectura o atraviesa varias capas, presentar alcance, pasos, validación y exclusiones antes de editar.
- Evidencia en vault: projects/orchestos/decisions, projects/orchestos/aprendizajes
<!-- /knowledge-promotion:KP-20260817-102752-93e4d5 -->

- [x] **GOV.1 — 🧠 Protocolo universal y verificable para cualquier LLM.** (2026-08-17) Una sola fuente de
  verdad define el orden obligatorio antes de editar, los límites de alcance, los gates por tipo
  de cambio y qué hacer cuando falta evidencia. `AGENTS.md` y `CLAUDE.md` deben apuntar al mismo
  protocolo; un preflight debe validar ítem abierto + hooks sin drift; pre-commit debe impedir
  cerrar cambios de dashboard/configuración sin evidencia explícita de navegador real. El gate
  debe distinguir con honestidad lo mecánicamente verificable de lo que sigue requiriendo criterio.

  **Implementado:** `docs/agent-work-protocol.md` es la fuente común; `AGENTS.md`/`CLAUDE.md`
  obligan a ejecutar `bun run agent:preflight -- --item <ID> --agent <nombre>`; el preflight
  valida ítem abierto, muestra cambios ajenos y bloquea hooks ausentes/con drift usando
  `git rev-parse --git-path hooks` (portable a worktrees). `agent:live-gate` bloquea commits que
  toquen dashboard/config sin un `[x]` y una línea `Gate en vivo:` con navegador/browser/Playwright
  en el diff staged de `PLAN.md`. El protocolo declara honestamente que el hook verifica que la
  evidencia esté documentada, no que sea verdadera: observar el flujo sigue siendo gate humano/LLM.

  **Evidencia:** `bun run agent:preflight -- --item GOV.1 --agent codex` ✅; `bun run hooks:check`
  ✅; `bunx tsc --noEmit` ✅; `bun test scripts/agent-governance.test.ts` (3 pass) ✅;
  `bun run test:coverage` (1157 pass, 0 fail) ✅. `bun run security:gate` llegó al audit y bloqueó
  por dos vulnerabilidades transitivas preexistentes; quedan registradas en GOV.2, no ocultas ni
  corregidas fuera de alcance. Insight decisivo: `INS-2026-005`; `INS-2026-004` evitó confundir
  coverage con capacidad real de detectar regresiones.

- [x] **GOV.2 — 🔍 Resolver audit de dependencias high sin actualización ciega.** (2026-08-17) Hallazgo del gate
  GOV.1: `bun audit` reporta `fast-uri >=3.0.0 <3.1.5` vía Stryker/Ajv y
  `brace-expansion >=4.0.0 <5.0.9` vía Stryker/minimatch y glob/minimatch. Evaluar actualización
  compatible y correr suite + mutation shards relevantes; no usar `bun update --latest` a ciegas.

  **Resolución mínima:** no se actualizaron Stryker, Ajv, Glob ni Minimatch. `package.json` fija
  overrides de `fast-uri: 3.1.5` y `brace-expansion: 5.0.9`; ambos permanecen dentro de los rangos
  que sus padres ya aceptaban (`ajv@8.18.0` → `fast-uri ^3.0.1`; `minimatch@10.2.5` →
  `brace-expansion ^5.0.5`). `bun.lock` confirma únicamente esos dos saltos de parche. Advisories
  cerrados: `GHSA-7p8r-x3mc-p8w7` y `GHSA-rgw5-rvv9-x895`.

  **Evidencia:** `bun pm ls --all` → `fast-uri@3.1.5`/`brace-expansion@5.0.9`; `bun audit
  --audit-level high` ✅; `bunx tsc --noEmit` ✅; `bun run test:coverage` (1157 pass, 0 fail) ✅;
  `bun run security:gate` completo ✅; `bun run mutation:qa` arrancó Stryker, ejecutó 429 mutantes
  y terminó en 4m01s con score 46.79% ✅. La fuente primaria (GitHub Advisory Database) y el
  registry npm confirman las primeras versiones corregidas. Insight aplicado: `INS-2026-005` —
  cambio acotado, sin actualización multi-capa.

- [x] **GOV.3 — 🔍 Evaluar advisory moderate de `qs` sin mezclar alcance.** (2026-08-17) El audit total posterior
  a GOV.2 conserva `GHSA-q8mj-m7cp-5q26`: `qs@6.15.1` llega fijado exactamente por
  `typed-rest-client@2.3.1` dentro de Stryker. No bloquea `security:gate` (`high+`), pero debe
  evaluarse por separado antes de forzar un override sobre una dependencia con versión exacta.

  **Resolución mínima:** `package.json` añade `qs: 6.15.3` a los overrides existentes. Se conserva
  `@stryker-mutator/core@9.6.1` y `typed-rest-client@2.3.1`: actualizar este último a `3.x` rompería
  el rango `~2.3.0` declarado por Stryker y ampliaría el alcance. `bun.lock` cambia únicamente
  `qs 6.15.1 → 6.15.3`, sus dependencias internas (`side-channel ^1.1.1` y
  `es-define-property ^1.0.1`) y el registro del override. El override corrige la resolución de este
  repositorio, pero no modifica el manifest upstream de `typed-rest-client`; debe reevaluarse al
  actualizar Stryker o cuando ese cliente publique/adopte una versión compatible sin el pin vulnerable.

  **Evidencia:** `bun run agent:preflight -- --item GOV.3 --agent codex` ✅; baseline
  `bunx tsc --noEmit` ✅; `bun pm ls --all` → `typed-rest-client@2.3.1` y `qs@6.15.3`; `bun audit`
  → cero vulnerabilidades ✅; `bun run security:gate` completo (1157 pass, 0 fail, audit limpio) ✅;
  `bun run mutation:qa` ejecutó el consumidor real Stryker, 429 mutantes en 4m00s, score 46.79% ✅.
  Knowledge radar: sin insights aplicables; no se promovió ni inventó conocimiento.
