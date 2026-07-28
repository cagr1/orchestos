---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: v0.13-abierto--que-orchestos-entregue-un-producto-premium
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

## MES 22 (v0.13) — Que OrchestOS entregue de verdad un producto premium: corregir primero

**Eje corregido por Carlos (2026-07-18, reemplaza el eje original de 2026-07-15):** esperar un
veredicto premium (Bloque C / Mes 20 C.2) fue prematuro — para que el motor entregue algo bueno o
premium tiene que existir primero **la configuración** (`design.md` por niveles: normal/bueno/muy
bueno/premium, trabajo que Carlos hace él mismo, fuera de PLAN.md). Sin eso, correr la corrida cara
solo mediría lo que ya se sabe (E.11: el "AI slop" es falta de contexto de diseño, no bug del
motor) y confundiría dos preguntas distintas (¿el motor agéntico multi-archivo coordina bien? vs.
¿el resultado se ve premium?). **Bloque C sacado de este Mes** — movido a
[IDEAS.md #52](IDEAS.md), gated en que exista el `design.md`. El eje real ahora: cerrar las
correcciones ya identificadas (Bloques F/G/H) en orden, antes de volver a intentar un veredicto de
producto premium.

### Bloque A — 🧠 #32: presupuesto de outputs de tools en el executor agéntico (prerequisito)

Eslabón defectuoso verificado (IDEAS.md #32): en `src/run/executors/agentic.ts`, `read_file`
devuelve el archivo completo sin cap y `run_check` mete stdout/stderr enteros al historial;
nada trunca outputs de tools antes de `messages[]` → un archivo grande o check verboso infla
el prompt hasta que `contextWindow − prompt` no da para maxTokens → `pending` automático. Es
el mismo modo de fallo que pausó C.2.

- [x] **A.1 — 🧠 (2026-07-15)** `capToolOutput()`: módulo nativo TS (sin deps) con cap duro por
  tool-result (25k chars default) + marcador `[...truncado: N chars omitidos de M]`.
  [src/run/tool-output-cap.ts](src/run/tool-output-cap.ts).
- [x] **A.2 — 🧠 (2026-07-15)** `capCheckOutput()`: truncado cabeza+cola para stdout/stderr de
  `run_check` (los errores viven al final, no solo la cabeza). Mismo archivo. 7 tests · 0 fail ·
  `tsc --noEmit` limpio.
- [x] **A.3 — ⚡ (2026-07-15)** Wiring: `capToolOutput()` inyectado en los 4 tools de
  `agentic.ts` (read_file/write_file/list_dir con `capToolOutput`, run_check con
  `capCheckOutput` para preservar stderr al final) y en el `executeTool` del chat
  (executeFetchUrl/executeSearchMemory y el helper `readProjectTextFile` que cubre
  read_plan/read_tasks/read_ideas/read_file). 7 tests del módulo (A.1+A.2) +
  7 tests nuevos por punto de inyección (4 en `agentic-tool-cap.test.ts`,
  1 en `chat-fetch-url.test.ts`, 2 en `chat-read-project-tools.test.ts`).
  Hallazgo real del integration test: `checks.ts:7 OUTPUT_LIMIT=2_000` ya trunca
  cada stream con `tail()` antes de salir del check — el capCheckOutput del
  executor queda como defensa en profundidad (no dispara en la práctica),
  documentado en el test. 725 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **A.4 — 🔍 (2026-07-15)** Gate causal cerrado. Test en
  [agentic-tool-cap.test.ts](src/__tests__/agentic-tool-cap.test.ts) que prueba con las MISMAS
  funciones que el motor usa para presupuestar (`estimateTokens`/`contextWindowFor`), no umbrales
  inventados: (control) el `read_file` crudo de un archivo dimensionado a `contextWindow*4+50k`
  chars supera la ventana del modelo → es la condición exacta de `pending`/overflow de #32;
  (con cap) el `messages[]` REAL capturado de la ronda siguiente estima por debajo de la ventana,
  con el tool-result bajo `contextWindow/4` → queda margen de sobra para el output (lo que #32
  decía que se perdía: `contextWindow−prompt < maxTokens`). Evidencia = request capturado, no
  `[x]` de reporte ([[feedback-verificar-progreso-delegado]]). 726 tests · 0 fail · `tsc` limpio.
  **Matiz honesto**: el loop agéntico (`runToolLoop`) no emite un status `pending` propio dentro
  del loop — usa un `maxTokens` fijo por ronda; el `pending` formal vive en el pre-check del
  harness (`harness.ts:287`). El gate prueba la causa raíz común (contexto acumulado que revienta
  la ventana), que es el fallo que #32 describe, no un literal `status==='pending'` dentro del loop.
- [x] **A.5 — ⚡ (excepción: Claude implementa por orden explícita de Carlos, 2026-07-16)**
  #36: `defaultChecksFor` ahora valida sintaxis de JS embebido en `.html` y standalone `.js`
  vía `node --check` sobre el código extraído. Cierra el gap real que dejó pasar el bug de
  Mes 20/C.1 (`:` en vez de `+` en `sortIcon()` dentro de un `<script>` inline). Detalle y
  evidencia en [DONE.md § A.5](DONE.md).
  Módulo nuevo: [src/run/html-script-check.ts](src/run/html-script-check.ts) — extractor de
  `<script>` (whitelist de `type=` JS para evitar falsos positivos sobre JSON/templates), wires
  en [src/run/checks.ts](src/run/checks.ts). **Importante**: los checks de sintaxis JS NO están
  gateados por `node_modules` (a diferencia de `tsc`/`bun test` que ya lo estaban) — `node
  --check` solo parsea, sin resolver imports. 22 tests nuevos (11 del módulo + 11 del wiring,
  incluyendo 3 integration tests que prueban end-to-end que el bug de C.1 ahora se detecta).
  748 tests · 0 fail · `tsc --noEmit` limpio.

### Bloque B — 🧠 GATE DE CARLOS: decisión de modelo (prerequisito, ya no ligado a una corrida de este Mes)

**No lo decide ningún LLM ni se arrastra de memoria** ([[feedback-modelo-decision-final-carlos]],
incidente de $5.00 quemados). El modelo de cualquier corrida cara real es siempre el de
`orchestos.config.yaml` o el que Carlos indique en el momento — nunca decisión de un LLM.

- [x] **B.1 — 🧠 Carlos (2026-07-16)** Modelo confirmado explícitamente por Carlos: tal cual
  `orchestos.config.yaml` — executor `deepseek/deepseek-v4-flash`, QA `anthropic/claude-haiku-4-5`.

**Nota — no bloquea este Mes (2026-07-15):** Carlos planteó una idea de arquitectura mayor —
cascada de selección Local (LLM local) → CLI (Orca/OpenCode/Claude Code, corre contra la cuenta ya
pagada del usuario) → API (OpenRouter, último recurso, la que más gasta) — inspirada en Orca.
Anotada completa en [IDEAS.md #44](IDEAS.md), P3, gated en #39 (generalizar `engine: external` a
más binarios) + una decisión explícita de Carlos aún pendiente por la tensión con
[[feedback-modelo-decision-final-carlos]] (cascada automática vs. "el modelo/engine siempre lo
decide Carlos, nunca un LLM"). No se toca código de esto hasta esa decisión.

**Bloque C — SACADO de este Mes (2026-07-18, decisión de Carlos).** Era "Reabrir C.2: dashboard
premium multi-archivo con dinero real" (C.1 corrida real + C.2 veredicto premium Sí/No). Carlos
identificó que esperar un veredicto premium ahora fue prematuro — falta la configuración
(`design.md` por niveles) antes de que ese veredicto tenga sentido. Movido completo a
[IDEAS.md #52](IDEAS.md), gated en que el `design.md` exista. Se retoma como bloque de este Mes (o
del siguiente) recién cuando esa dependencia esté resuelta — no antes.

### Bloque E — 🧠 Regresión crítica: el clamp de `max_tokens` al catálogo volvió (viola decisión de Carlos)

Destapado corriendo C.1 en vivo (2026-07-16): la tarea `crypto-page-v2` (single-shot,
deepseek-v4-flash) falló con `parse error: No <<<FILE>>> blocks found` — el output se truncó
a mitad del CSS (`--primary: #0f172a;`), sin `<<<ENDFILE>>>`. Causa raíz verificada:

- `deepseek/deepseek-v4-flash` tiene `maxOutputTokens: 0` en el catálogo (OpenRouter no lo publica).
- `maxOutputTokensFor()` colapsa ese 0 en `DEFAULT_MAX_OUTPUT_TOKENS = 8192`.
- `harness.ts:304-305` hace `maxTokens = min(availableForOutput, 8192)` → topa TODA salida a 8192,
  aunque la ventana del modelo es 1M. Una página premium en un archivo necesita >8192 de salida.

**Esto es una REGRESIÓN de [[feedback-context-no-max-tokens]]** (decisión de Carlos 2026-06-30,
marcada "no reabrir"): `max_tokens` se deriva de `contextWindow − prompt`, **nunca** de
`maxOutputTokensFor()`. El fix G.5 (2026-07-02, para un 400 de gpt-4o-mini) reintrodujo el clamp
al catálogo que esa decisión había matado — la misma memoria nombra el mismo modelo y el mismo
síntoma exacto. Reconciliación (honra ambas cosas): base = `contextWindow − prompt` (regla de
Carlos); clamp hacia abajo **solo** si el catálogo publica un tope REAL >0 (protege gpt-4o-mini);
cuando es 0/desconocido → presupuesto completo, nunca el 8192 arbitrario.

- [x] **E.1 — 🧠 (2026-07-16)** `knownMaxOutputTokensFor()` (raw, 0 = desconocido) en model-catalog.ts;
  `harness.ts` y `chat.ts` derivan de `contextWindow − prompt` y solo clampean con topes reales >0.
  Elimina el 8192 del path de `max_tokens`. [src/router/model-catalog.ts](src/router/model-catalog.ts).
- [x] **E.2 — 🔍 (2026-07-18) CERRADO con evidencia real ya existente, sin gate manual nuevo.**
  Corrección de una lectura errónea del mismo día: no existe ni existió una tarea con id literal
  `crypto-page-v2` — ese bloque de `tasks.yaml` es `crypto-dashboard-v2-mrobnuay` (sufijo random =
  auto-creación desde el chat, Bloque D.7), cuyo `output` apunta a `demo/crypto-page-v2/index.html`
  (el path, no el id). El gate tal como estaba escrito (re-correr una tarea con ese id exacto) ya
  no aplica. En su lugar, la DB confirma la prueba con evidencia más fuerte que la que el gate
  original pedía: el fix de E.1 se commiteó `d6e1791` (2026-07-16T22:09 UTC); los 2 truncamientos
  reales en `runs` (`crypto-dashboard-premium-v2` 20:48 UTC, `crypto-page-v2` 21:55 UTC) son ambos
  **previos** a ese commit. Desde el fix, **7 corridas reales consecutivas** (dinero real, sin
  gate artificial) — `crypto-dashboard-v2-mrobnuay`, `crypto-dashboard-visual-iteration`,
  `crypto-terminal-v3`, `crypto-terminal-v4`, `crypto-terminal-coinmarketcap-v5`,
  `apple-es-design-system` (4 archivos), `apple-es-storefront-hero-grid` — todas `status: done`,
  cero errores de truncamiento, incluyendo salidas más grandes que las que fallaban antes (hasta
  $0.40/corrida). El fix está probado en producción real, no hace falta repetir el gate.

**Nota sobre el planner (pregunta de Carlos):** Haiku-como-planner SÍ es el mecanismo de auto-split
(`shouldSplit` → `generatePlan`), pero el gate mide por NÚMERO de archivos (`output.length × 2048`),
no por tamaño estimado — con 1 archivo nunca dispara, así que el planner no se invocó. Con E.1 el
presupuesto de deepseek pasa a ~1M y el archivo único entra sin truncar, así que el split no hace
falta para este caso. Mejorar el gate para que estime tamaño real (y así partir un solo archivo
grande en varias llamadas) es un ítem aparte → IDEAS #47.

- [x] **E.3 — 🧠 (2026-07-16)** Fallo distinto encontrado al reintentar tras E.1: `crypto-dashboard-v2`
  (auto-creada por D.7 mientras `crypto-page-v2` corría en su propio worktree) falló con
  `git merge orchestos/crypto-dashboard-v2/... failed after rebase` — QA había pasado, el LLM
  generó el archivo, pero `mergeWorktreeBack()` (harness.ts:566) lanzó ANTES de `insertRun()`
  (línea 576) → **cero fila en `runs` para un intento que sí gastó dinero real**. Consecuencia en
  cascada: `diagnoseTask()` hacía `if (runs.length===0) throw` → 404 → el click handler del
  frontend guardaba `diagnoseCache[id] = null` en silencio → **"View diagnosis" nunca abría nada**,
  sin ningún error visible (el bug que Carlos reportó: "trate de ver pero nunca se abrió"). Fix
  aplicado (rápido, a pedido de Carlos, no delegado):
  - `diagnoseTask()` ([src/agents/diagnose.ts](src/agents/diagnose.ts)): con 0 runs pero
    `task.retry_reason` presente, sintetiza el diagnóstico DESDE el retry_reason (ya tiene los
    comandos manuales de arreglo) sin gastar una llamada a Haiku — solo revienta si de verdad no
    hay ni runs ni retry_reason.
  - Frontend: el catch del click de diagnose ya no descarta el error en silencio — lo guarda y
    `diagnoseDetail()` lo muestra como bloque de error visible en vez de cerrarse sin avisar.
  - Verificado en vivo contra el dashboard real: el panel abre y muestra patrón/confianza/detalle
    con los comandos de arreglo manual del worktree huérfano.
  **Causa raíz de fondo, NO resuelta acá** (candidato para cuando se retome, relacionado con D.5/D.7):
  correr dos tareas simultáneas donde una usa worktree y la otra auto-commitea directo a `master`
  (D.5/D.7) mueve la rama base mientras el worktree intenta hacer `--ff-only` merge de vuelta —
  condición de carrera real entre nuestro propio auto-commit y el merge-back del sandbox. El fix de
  hoy hace el fallo DIAGNOSTICABLE (y no gastó dinero de más), pero no evita que vuelva a pasar.
  750 tests · 0 fail (incluye ajuste de `chat-read-project-tools.test.ts`: verificaba "MES 18" en
  `read_plan`, quedó fuera del cap de 25k al crecer PLAN.md hoy — ahora verifica "MES 22", la
  sección vigente). `tsc` limpio.

- [x] **E.4 — 🧠 (2026-07-16)** Caso límite real de E.1, NO una regresión: al reintentar el chat
  (que dispara D.7 → tool-calling), el proveedor rechazó con 400 — pidió ~1.045M tokens de salida
  contra una ventana de 1.048M. Causa exacta verificada por los números: `promptTokens` estimado
  (`estimateTokens`, chars/4) ≈ 2001, real 2733 texto + 611 de **schemas de tools** (`runToolLoop`
  adjunta 6 tools al request real, `estimateTokens` nunca los ve) = 3344 — el `SAFETY_MARGIN` de
  1024 no cubre esa diferencia. **Distinción importante con E.1**: esto NO reintroduce el clamp al
  catálogo prohibido por [[feedback-context-no-max-tokens]] — sigue siendo 100% derivado de
  `contextWindow − prompt`; el fix es un margen de seguridad más realista (1024→8192) para una
  fuente de error conocida (tool schemas + drift de estimación chars/4 vs tokenización real).
  Aplicado en `harness.ts` (afecta también al engine agéntico, que hereda `maxTokens` del harness),
  `chat.ts`, y el comando `run` de `cli.ts` (por consistencia, aunque no usa tools). 750 tests ·
  0 fail · `tsc` limpio.

- [x] **E.5 — 🧠 (2026-07-16)** Resuelto de raíz IDEAS #48 (la carrera worktree-vs-auto-commit
  que E.3 solo diagnosticó, no arregló) — se reprodujo una TERCERA vez (misma tarea
  `crypto-dashboard-v2`, mismo `git merge ... failed after rebase`), confirmando que era
  estructural, no casualidad. Causa exacta: `mergeWorktreeBack()` (`git checkout master; git merge`)
  y los auto-commits de D.5/D.7 (`git add tasks.yaml; git commit`) tocan el MISMO working dir
  (`projectRoot`) desde procesos del SO distintos (el server del dashboard vs. el subproceso
  `task run`) — sin serialización, uno podía moverle `master` al otro a mitad de operación.
  Fix: [src/run/git-lock.ts](src/run/git-lock.ts) — mutex de archivo entre procesos
  (`withGitLock()`, lockfile atómico `wx` + robo de lock si está más viejo que 60s, para que un
  proceso muerto no deje al resto bloqueado para siempre). Envuelve `mergeWorktreeBack()` completa
  ([src/run/sandbox.ts](src/run/sandbox.ts)) y los dos puntos de auto-commit en
  `handlers/tasks.ts` (`createTaskRecord`/`spawnTaskRun`). `.orchestos/git.lock` +
  `.orchestos/worktrees/` agregados a `.gitignore`.
  **Verificación real, no simulada**: test de concurrencia entre dos SUBPROCESOS Bun reales
  (`git-lock.test.ts`) — dos llamadas en el mismo proceso habrían sido trivialmente secuenciales
  (JS de un hilo, no prueba nada); el test spawnea 2 procesos del SO, cada uno toma el lock y
  duerme 150ms, y el padre confirma que sus ventanas [enter,exit] nunca se solapan. Sanity-check
  manual: con el lock reemplazado por un no-op, el mismo test FALLA (solapamiento detectado) —
  confirma que el test realmente prueba el mutex, no un artefacto de timing. 753 tests · 0 fail ·
  `tsc` limpio.

- [x] **E.6 — 🧠 (2026-07-16)** E.5 protegió las ESCRITURAS (auto-commit) y el MERGE, pero no la
  LECTURA — `resolveSandboxMode()` (`git status --porcelain`, el chequeo de "árbol limpio" al
  INICIAR una corrida) corría fuera del lock. Reproducido en vivo tras reiniciar el dashboard con
  E.5 ya activo: `crypto-dashboard-v2-premium` falló con el mensaje ORIGINAL de D.5
  ("Uncommitted changes... M tasks.yaml") — porque `git add`/`git commit` del auto-commit son DOS
  llamadas separadas (no atómicas); si el chequeo de OTRA corrida cae justo entre esas dos, ve el
  `git add` ya hecho pero el commit todavía no, y aborta por un estado transitorio que un instante
  después iba a quedar limpio. Fix: `resolveSandboxMode()` + `createWorktree()` ahora corren
  DENTRO del mismo `withGitLock()` que ya protegía el merge-back y los auto-commits — una sola
  sección crítica corta al INICIO de la corrida (el LLM/QA/checks siguen corriendo SIN el lock
  tomado, no se serializa la ejecución completa, solo el chequeo+creación de worktree).
  [src/run/harness.ts](src/run/harness.ts). 753 tests · 0 fail · `tsc` limpio.
  **Gap de test honesto**: la cobertura de este wiring específico (harness.ts sí llama al lock en
  el punto correcto) descansa en el typecheck + la suite existente, no en un test de integración
  end-to-end con git real reproduciendo la ventana exacta — `sandbox.ts`/`sandbox-policy.ts` no
  tienen test file dedicado (gap pre-existente, no nuevo de hoy). El mecanismo del mutex en sí
  (`git-lock.ts`) SÍ tiene la prueba de concurrencia real de E.5.
  **Nota operativa importante (no es bug de código)**: este fallo específico salió con el
  dashboard YA reiniciado después de E.5 — confirma que Bun no recarga código en caliente y
  cualquier fix a `src/dashboard/`, `src/run/`, `src/cli.ts` exige reiniciar el proceso del
  dashboard para tomar efecto; los fixes de hoy se probaron contra un proceso de las 17:36 durante
  varias rondas antes de notar esto.

- [x] **E.7 — 🔍 (2026-07-16)** Con el dashboard YA reiniciado tras E.6, `crypto-dashboard-v2`
  falló DE NUEVO con la misma clase de error (`git merge ... failed after rebase`). El código
  descartaba por completo el `stderr` real del segundo intento de `git merge --ff-only` — fix
  aplicado: el error ahora incluye el `stderr` real de AMBOS intentos de merge
  [src/run/sandbox.ts](src/run/sandbox.ts). Quedó abierto hasta el siguiente fallo — **y llegó**:
  el stderr real fue `"Your local changes to... runs-summary.json would be overwritten by
  merge"`. Cierra con evidencia real, ver E.9.
- [x] **E.8 — 🧠/⚡ (2026-07-16)** Botón "Copy" en el panel de diagnosis (pedido directo de
  Carlos: seleccionar a mano el texto largo del error era tedioso) — junto al bloque de error
  (`d.error`) y junto a "Last Error Output"/`lastErrorResult`. Mismo patrón `data-copy` +
  `navigator.clipboard.writeText()` que ya usa `screens-ops.js` (skills) — reusado, no inventado.
  Bug propio encontrado y corregido en el mismo pase: la primera versión usaba `textContent` para
  capturar/restaurar el estado del botón, lo que descarta el ícono SVG para siempre tras el primer
  click (el `textContent` de un `<svg>` no incluye su markup); ahora usa `innerHTML` con
  contenido 100% estático (`ICON.check` + i18n), nunca datos del usuario. Claves i18n nuevas
  `btn.copy` (en/es). Verificado en navegador real: clipboard funciona, ícono se restaura
  correctamente tras el ciclo "Copied". 753 tests · 0 fail · `tsc` limpio.
- [x] **E.9 — 🧠 (2026-07-16)** El stderr real de E.7 confirmó la causa: `git merge` rechazó
  sobreescribir `runs-summary.json` por cambios locales sin commitear. El fix de E.1 solo
  **ignoraba** este archivo en el REPORTE de "árbol sucio" (`resolveSandboxMode`) — lo dejaba
  genuinamente sucio en disco. Eso no rompía el chequeo de arranque (por diseño), pero SÍ rompía
  el merge más tarde: `git merge` no sabe nada de nuestra regla de "ignóralo" y rechaza
  sobreescribir un archivo con diff local sin commitear — el fallo real, reproducido 2 veces
  seguidas. **Por qué no se puede simplemente dejar de trackear el archivo**: el scheduled task
  de dreaming corre en un sandbox de Claude Code en la nube y lee `runs-summary.json` vía
  `git pull` del repo — necesita que esté commiteado ([[project-dreaming-setup]]).
  Fix real: no solo ignorar el diff, DESCARTARLO (`git checkout -- runs-summary.json`) para que
  el working dir quede genuinamente limpio — aplicado en dos puntos: al inicio
  (`resolveSandboxMode()`, [src/run/sandbox-policy.ts](src/run/sandbox-policy.ts)) y de nuevo,
  defensivamente, justo antes del merge (`mergeWorktreeBackLocked()`,
  [src/run/sandbox.ts](src/run/sandbox.ts)) — por si algo lo ensucia de nuevo durante la ventana
  larga sin lock (LLM+QA+checks) entre esos dos puntos.
  **Primer test real para `sandbox-policy.ts`** (gap pre-existente notado en E.6, cerrado ahora):
  [src/__tests__/sandbox-policy.test.ts](src/__tests__/sandbox-policy.test.ts) con repos git
  reales (no mocks) — prueba que el archivo queda con diff CERO después de la llamada (no solo
  "no lanzó"), que otro archivo sucio real SÍ sigue bloqueando, y el caso limpio. Sanity-check
  manual: con el `git checkout --` deshabilitado, el test de "queda limpio" FALLA con el mismo
  síntoma exacto reproducido en vivo (`M runs-summary.json` persiste) — confirma que el test
  prueba el bug real, no un artefacto. 756 tests · 0 fail · `tsc` limpio.
- [x] **E.10 — 🧠 (2026-07-16)** E.9 no bastó — reprodujo el MISMO error una tercera vez.
  Investigado con una reproducción real (no teoría): el mecanismo de fondo era distinto al
  sospechado. `scripts/pre-commit.sh` hacía `cd "$(git rev-parse --git-dir)/..")` — dentro de un
  **worktree**, `--git-dir` resuelve al gitdir INTERNO (`.git/worktrees/<name>` del repo
  PRINCIPAL, no la carpeta del propio worktree), así que `bun run dreaming:export` (que resuelve
  su ruta de salida vía `import.meta.dir`, relativo al propio script) terminaba escribiendo
  `runs-summary.json` en el REPO PRINCIPAL cada vez que el worktree hacía SU PROPIO commit interno
  — ensuciándolo de nuevo justo antes del merge, después de que el discard de E.9 ya había corrido.
  Reproducido con un repo git real aislado (`/tmp/wt-repro`), confirmando la escritura cruzada.
  Fix parte 1: `--git-dir` → `git rev-parse --show-toplevel` (resuelve correctamente la raíz del
  working tree en AMBOS casos — repo principal o worktree). Con eso solo, la reproducción destapó
  un problema MÁS de fondo: incluso aislado correctamente, si el worktree TAMBIÉN commitea su
  propia copia de `runs-summary.json`, y `master` avanzó mientras tanto con OTRA versión del mismo
  archivo (vía su propio commit/hook), el `rebase` produce un **conflicto de contenido real**
  (`CONFLICT (content): Merge conflict in runs-summary.json` — verificado en la reproducción, no
  un timing issue). Fix parte 2: el hook ahora detecta si está corriendo dentro de un worktree
  (`.git` es un ARCHIVO en la raíz de un worktree, una CARPETA en el repo principal) y se salta
  el export+commit de `runs-summary.json` por completo ahí — el archivo es un reporte compartido
  derivado de la DB, nunca parte del output de una tarea, el worktree no tiene por qué tocarlo.
  [scripts/pre-commit.sh](scripts/pre-commit.sh) (y `.git/hooks/pre-commit`, la copia instalada,
  actualizada en el mismo commit — recordatorio en CLAUDE.md: `cp scripts/pre-commit.sh
  .git/hooks/pre-commit` tras clonar). **Reproducción end-to-end completa (crear worktree →
  commit en worktree → master avanza con su propio commit → primer ff-only falla → rebase → merge
  reintentado) corrida en un repo git real aislado, confirmando éxito limpio con el fix, y el
  conflicto de contenido real sin él** — no es una suposición. 756 tests · 0 fail · `tsc` limpio.
- [x] **E.11 — 🧠 (2026-07-17)** Causa real de por qué `crypto-dashboard-v2` salió "AI slop" pese
  a pedir "premium": la tarea auto-creada por el chat (D.7) **no tenía `skill:` asignado en
  absoluto** — verificado comparando `tasks.yaml` (`crypto-page-v1`, manual, sí tiene
  `skill: frontend-design`; la auto-creada, no) y confirmando en `prompt.ts:51-56` que sin
  `task.skill` el prompt del ejecutor NO lleva ninguna guía de diseño (`SKILL GUIDELINES` completo
  ausente). Causa raíz: la regla de desempate "2+ candidatos → sin asignar" viene del `<select>`
  manual del dashboard (pensada para que un HUMANO desempate) — en el auto-flow D.7 nadie
  desempata, y con una descripción "dashboard premium" varios skills compiten legítimamente por
  `when_to_use` (frontend-design, ux-guidelines, design-brief-inference), así que Haiku devuelve
  2+ candidatos y la regla vieja los descartaba TODOS — la tarea corrió a ciegas.
  Fix: `pickAutoSkill()` extraída como función pura y testeable
  ([src/dashboard/handlers/chat.ts](src/dashboard/handlers/chat.ts)) — si `frontend-design` está
  entre los candidatos, se prioriza siempre (skill general "mata AI-slop-tells", aplicarlo de más
  a una tarea no visual no hace daño real); con 2+ candidatos SIN frontend-design, sigue sin
  asignar (ahí no hay señal segura). 5 tests unitarios nuevos
  ([src/__tests__/skill-auto-selection.test.ts](src/__tests__/skill-auto-selection.test.ts))
  cubriendo los 5 casos (0, 1 sin frontend-design, 1 es frontend-design, 2+ sin frontend-design,
  2+ con frontend-design — el bug real). 761 tests · 0 fail · `tsc` limpio.
- [x] **E.8 — 🧠/⚡ (2026-07-16)** Botón "Copy" en el panel de diagnosis (pedido directo de
  Carlos: seleccionar a mano el texto largo del error era tedioso) — junto al bloque de error
  (`d.error`) y junto a "Last Error Output"/`lastErrorResult`. Mismo patrón `data-copy` +
  `navigator.clipboard.writeText()` que ya usa `screens-ops.js` (skills) — reusado, no inventado.
  Bug propio encontrado y corregido en el mismo pase: la primera versión usaba `textContent` para
  capturar/restaurar el estado del botón, lo que descarta el ícono SVG para siempre tras el primer
  click (el `textContent` de un `<svg>` no incluye su markup); ahora usa `innerHTML` con
  contenido 100% estático (`ICON.check` + i18n), nunca datos del usuario. Claves i18n nuevas
  `btn.copy` (en/es). Verificado en navegador real: clipboard funciona, ícono se restaura
  correctamente tras el ciclo "Copied". 753 tests · 0 fail · `tsc` limpio.
- [x] **E.12 — 🧠 (2026-07-17)** Bug real destapado corriendo `crypto-terminal-v3` en vivo (a
  pedido directo de Carlos, arreglado de inmediato — "no vamos a avanzar hasta ver que el sistema
  comience a dar buenos productos"): `classifyTask()` (`src/router/classify.ts`) clasificaba
  como `'plan'` cualquier descripción que contuviera la palabra "design" EN CUALQUIER POSICIÓN —
  "...responsive design, no build tooling" bastaba. `'plan'` mapea al rol `planner` de
  `orchestos.config.yaml` (`anthropic/claude-haiku-4-5`, pensado para planificación liviana), no
  al `executor_heavy` (`deepseek/deepseek-v4-flash`) que debía escribir el archivo real —
  confirmado en la DB (`run 3b273760...`: model=`anthropic/claude-haiku-4-5`). Explica por qué
  el resultado salió peor que las dos corridas anteriores pese al prompt mucho más detallado.
  **Fix de dos capas** (principio de Carlos: "el planner solo planifica, deja a otros modelos que
  sigan instrucciones"):
  1. `classify.ts`: "plan"/"design"/"diseña" solo cuentan como intención de planificación como
     imperativo AL INICIO de la descripción (`^(plan|design|diseña)\b`) — términos estructurales
     sin ambigüedad (`arquitectura`, `estructura`, `architect`, `scaffold`, `blueprint`,
     `roadmap`) se mantienen como match libre. 2 tests de regresión nuevos.
  2. `auto-route.ts` — garantía estructural independiente del regex: si el rol resuelto es
     `planner` pero la tarea declara archivos de `output`, se degrada a `executor_heavy` — el
     planner nunca puede terminar escribiendo el entregable real, sin importar cómo lo clasifique
     el heurístico. 1 test nuevo (`autoRoute` con tarea mal clasificada como plan + output real).
  764 tests · 0 fail · `tsc` limpio.
- [x] **E.13 — 🧠 (2026-07-17)** Bug real destapado en el chat en vivo: pregunta sobre el switch
  API↔CLI disparó tool-calling (`read_plan`, PLAN.md ya grande) y el proveedor rechazó con 400
  pidiendo ~1.06M tokens de salida contra una ventana de 1.048M. Causa raíz: `runToolLoop()`
  (`src/providers/tool-call.ts`) recibía `opts.maxTokens` como presupuesto FIJO, calculado por el
  caller (`chat.ts`, `contextWindow − prompt inicial`) ANTES de que el loop corriera — pero
  `history` crece en cada ronda (los resultados de tool calls se van agregando), así que la ronda
  de cierre (después de `read_plan`) tenía un prompt real mucho más grande que el que existía
  cuando se calculó el presupuesto. El bug NO es el clamp-al-catálogo que E.1 ya mató, ni el
  margen de tool-schemas que E.4 ya cubrió — es un tercer punto ciego: crecimiento del historial
  DENTRO del loop, nunca contemplado.
  Fix: `shrinkForGrowth()` en `tool-call.ts` — no recalcula el presupuesto absoluto (eso pisaría
  un `opts.maxTokens` explícito del caller, contrato ya cubierto por
  `tool-call-maxtokens.test.ts`), solo le resta a cada ronda el crecimiento real del prompt desde
  la primera ronda (`estimateTokens` sobre `system + JSON.stringify(history)`, mismo baseline vs.
  historial actual). La primera ronda no se toca (honra el número del caller tal cual); la ronda
  de cierre y cualquier ronda intermedia con tool results de por medio sí se achican. 1 test de
  regresión nuevo que simula un tool call con un resultado grande y confirma que la ronda de
  cierre pide menos `max_tokens` que la inicial, sin colapsar a casi cero. 765 tests · 0 fail ·
  `tsc` limpio.
- [x] **E.14 — 🧠 (2026-07-17)** Bug real destapado por Carlos en vivo, el más serio del bloque:
  el chat respondió "Started task `crypto-terminal-v5`..." con una descripción detallada — pero
  NUNCA se creó ningún task ni run (verificado: sin fila en `tasks.yaml`, sin fila en `runs`, sin
  carpeta `demo/crypto-page-v5/`). El chat confabuló una confirmación de éxito para algo que jamás
  pasó. Dos bugs apilados en `src/dashboard/handlers/chat.ts`:
  1. `classifyTaskIntent()` (la señal semántica de la que depende D.7 para auto-crear la tarea)
     se saltaba por completo una vez `rawHistory.length + 1 >= 3` — ese atajo era correcto para
     decidir si mostrar la barra sugerida (su propósito original, J.1/Mes 18), pero D.7 (agregado
     después) reusó la misma variable para decidir si auto-ejecutar. En una conversación larga
     (la de Carlos ya llevaba varios mensajes), `taskSuggestion` quedaba `null` PARA SIEMPRE →
     `autoTask` nunca se intentaba.
  2. El system prompt daba la creación por HECHA de forma incondicional ("OrchestOS has ALREADY
     created and started running the task") sin mirar el resultado real de `autoTask` — así que
     aunque `autoTask` fuera `null`, el LLM igual confirmaba con confianza que había una tarea
     corriendo, porque sus instrucciones se lo ordenaban sin condición.
  Fix: (1) el clasificador ahora corre SIEMPRE (el ahorro de costo ya no aplica una vez que D.7
  depende de esta señal en cada turno); (2) el bloque del system prompt sobre auto-creación se
  arma según el resultado REAL de `autoTask` — solo afirma éxito si `autoTask` tiene `id`, exige
  admitir el fallo explícitamente si tiene `error`, y prohíbe cualquier claim de creación si
  `autoTask` es `null` (mensaje no detectado como build request). 765 tests · 0 fail · `tsc`
  limpio. **Gap de test honesto**: no se agregó un test de integración para `handleApiChat`
  completo (requeriría mockear la llamada real de clasificación + la del chat + `createTaskRecord`
  — la app no tiene DB de test aislada, ver [[reference-test-fixtures-leak-into-real-db]], y
  `mock.module()` contamina toda la suite, ver [[reference-bun-mock-module-gotcha]]); verificado
  por lectura de código + `tsc`, no en vivo (correr eso gasta dinero real, lo confirma Carlos).
- [x] **E.15 — 🧠 (2026-07-17)** Pregunta directa de Carlos: "si uso el CLI de Claude ¿por qué no
  puedo elegir modelo ni esfuerzo?". Bug real confirmado leyendo `src/run/executors/external.ts`:
  `ctx.model` ya se resolvía (executor_model / rol de config) y hasta se guardaba en el registro de
  costo (`costByIteration[0].model`) — pero **nunca se pasaba al subproceso real**. `claude -p`
  corría siempre con el modelo por defecto del binario, ignorando en silencio cualquier elección
  explícita. Mismo problema con el nivel de esfuerzo: `claude --help` confirma que el CLI real
  soporta `--effort low|medium|high|xhigh|max` (5 niveles, no 3 — coincide con lo que Carlos había
  notado antes sobre el select de 3 esfuerzos del chat, que es un mecanismo DISTINTO — reasoning
  param de OpenRouter, no el `--effort` del CLI) y OrchestOS nunca lo exponía.
  Fix: `orchestosModelToCliModel()` traduce el prefijo `anthropic/` de nuestros ids estilo
  OpenRouter (`anthropic/claude-sonnet-5`) al nombre que el CLI espera (`claude-sonnet-5`) — si el
  modelo configurado NO es de Anthropic, se omite `--model` a propósito (el CLI solo sirve modelos
  Claude; forzar un id ajeno fallaría con un error del propio binario en vez de un mal
  comportamiento silencioso). Nuevo campo `Task.cli_effort` (schema.ts, 5 valores válidos,
  solo aplica a `engine: external`) fluye a `buildClaudeArgs()` → `--effort`. UI: selector
  "CLI effort" en el composer de tareas (`screens-core.js`), visible solo cuando `engine=external`,
  mismo patrón show/hide que ya usaba el aviso de binario ausente (C.2). Backend
  (`handlers/tasks.ts`) valida y persiste `cli_effort`. 2 tests nuevos en
  `external-engine.test.ts` (modelo Anthropic → `--model`/`--effort` presentes y coinciden con
  `costByIteration[0].args`; modelo no-Anthropic → ambos flags omitidos). 767 tests · 0 fail ·
  `tsc` limpio. **Gap de verificación honesto**: el selector nuevo en `screens-core.js` no se
  confirmó visualmente en el navegador — sigue el mismo patrón exacto de `draft-engine-warning`
  (ya probado en vivo por C.2) y pasa `tsc`, pero abrir el draft real requiere una llamada LLM
  paga (`/api/tasks/natural`); no se gastó dinero solo para una captura de pantalla.

### Bloque D — 🧠 Flujo chat→tarea usable (orden directa de Carlos, 2026-07-16)

Excepción explícita de Carlos al freeze de UI de este Mes: el primer intento real de correr
C desde el dashboard (crypto-dashboard-v2) destapó que el flujo de "crear tarea desde el chat"
es inusable para un usuario normal — demasiados campos, decisiones que OrchestOS debería tomar
solo, y 3 bugs visuales/funcionales concretos. Evidencia: screenshot del draft del 2026-07-16.

- [x] **D.1 — 🧠 (2026-07-16)** Draft "simple por defecto": descripción como textarea auto-grow
  (misma ergonomía que el chat), resumen de una línea con lo auto-decidido
  (`id · modelo · engine · skill · N archivos`, actualizado en vivo), y `<details>` "Ajustes
  avanzados" colapsado con id/modelo/engine/archivos/skill (estado abierto sobrevive rerenders
  vía `st.draftAdvancedOpen`). IDs de controles intactos — `draft-confirm` no cambió. Verificado
  en navegador contra el dashboard real (capa simple + panel abierto). screens-core.js +
  screens.css + i18n (en/es). 748 tests · 0 fail · `tsc` limpio.
- [x] **D.2 — 🧠 (2026-07-16)** Ícono gigante corregido: `.draft-label svg { width:13px }` —
  el SVG inline solo tenía viewBox y se expandía al ancho del contenedor.
- [x] **D.3 — 🧠 (2026-07-16)** `<option>` de skill muestra solo el nombre; la descripción
  completa pasa a `title`. Verificado: "Frontend Design" a secas en el select.
- [x] **D.4 — 🧠 (2026-07-16)** "Suggest files" ahora muestra la causa real del server
  (`st.contextSuggestError`, ej. "Project not indexed yet — run Index code graph first") en vez
  del genérico. Verificado en vivo contra el endpoint real (404 por proyecto sin indexar).
  El botón quedó dentro de avanzados (D.1).
- [x] **D.5 — 🧠 (2026-07-16)** No era un edge case — era un fallo garantizado al 100%: crear
  o correr una tarea desde el dashboard escribe `tasks.yaml` (`saveTasks()`) sin commitear, y el
  sandbox de worktree exige árbol limpio (`sandbox-policy.ts:29`) — el propio flujo se
  autobloqueaba en dos puntos: `handleApiTasksCreate` (crear) y `handleApiTasksRun` (correr /
  "Ejecutar con clarificación"). Reproducido en vivo dos veces seguidas por Carlos
  (`crypto-dashboard-v2`, `crypto-dashboard-v2-mrntco26`). Fix: auto-commit best-effort de
  `tasks.yaml` (solo ese archivo) inmediatamente después de cada `saveTasks()` en ambos handlers —
  si el usuario tenía OTROS archivos sucios ajenos, siguen bloqueando el run como corresponde.
  [src/dashboard/handlers/tasks.ts](src/dashboard/handlers/tasks.ts). 748 tests · 0 fail ·
  `tsc` limpio.
  **Follow-up real encontrado al probar D.7 en vivo (2026-07-16, 3er fallo distinto)**:
  `runs-summary.json` lleva `exported_at: new Date().toISOString()` y se regenera en CADA
  `git commit` vía el hook pre-commit — incluso los auto-commits de D.5 mismos. Eso lo deja "sucio"
  con solo el timestamp cambiado justo después de un commit, y la corrida siguiente lo veía como
  working tree sucio y abortaba (`retry_reason: "M runs-summary.json"`, tarea
  `build-a-premium-darkmode-cryptocurrency`). No es trabajo de usuario en riesgo — es 100%
  derivado de la DB. Fix: `resolveSandboxMode()` excluye `runs-summary.json` del chequeo de
  limpieza. [src/run/sandbox-policy.ts](src/run/sandbox-policy.ts). También corregido en el mismo
  pase: el auto-flow de D.7 no pasaba el `id` que el LLM eligió a `createTaskRecord()`, cayendo
  siempre al slug autogenerado feo — ahora pasa `draft.id`. 748 tests · 0 fail · `tsc` limpio.
- [x] **D.6 — 🧠 (2026-07-16)** System prompt del chat (`handlers/chat.ts`): ante pedido de
  construir algo, respuesta corta (3-4 frases) + señalar el botón "Create task"; prohibido dictar
  tablas de campos, YAML o pasos manuales de creación. (Evidencia del fallo: respuesta del chat
  del 2026-07-16 con tabla "create a new Task with these exact fields".)
- [x] **D.7 — 🧠 (2026-07-16)** Chat auto-ejecuta: cuando el clasificador SEMÁNTICO
  (`classifyTaskIntent`, no el fallback de conteo de 3+ mensajes — señal débil, no dice que
  ESE mensaje sea la tarea) marca `isTask`, `handlers/chat.ts` llama `buildNaturalDraft()`
  (extraído de `handleApiNatural`, ahora exportado desde `handlers/project.ts`) y
  `createTaskRecord()` + `spawnTaskRun()` (extraídos de los handlers HTTP de tasks, ahora
  exportados desde `handlers/tasks.ts`) — todo server-side, antes de que el LLM genere su
  respuesta. Sin navegar a Tasks, sin draft, sin click de confirmación. `executor_model` nunca se
  fija desde el chat — queda sin definir para heredar `orchestos.config.yaml`
  ([[feedback-modelo-decision-final-carlos]] sigue cubierto: el modelo lo fija el config, no un
  LLM en el momento). La respuesta del chat lleva una nota corta (`▶ Started task `id`.`) + el
  frontend refresca `st.tasks` para que el chip del id sea clicable de inmediato y omite la barra
  "Create task" (quedaría redundante). System prompt (D.6) actualizado: ya no le dice al LLM que
  señale un botón — la tarea ya está corriendo cuando el LLM responde.
  **Fuera de alcance** (anotado en [IDEAS.md #45](IDEAS.md)): visibilidad de gasto real
  (USD vs. cuota de CLI) — Carlos aclaró que no quiere un tope de gasto, solo verlo.
  748 tests · 0 fail · `tsc` limpio. Verificado que el server bootea sin errores de wiring;
  el flujo end-to-end (gasta LLM real) queda para que Carlos lo pruebe él mismo en vivo.

### Bloque F — 🧠 Ledger de responsabilidad de LLMs (gobernanza del repo, NO feature de OrchestOS)

**Reclasificación (Carlos, 2026-07-18):** esto NO es un feature del producto OrchestOS — es
control interno de CÓMO se desarrolla OrchestOS (varios LLMs en distintas sesiones tocando este
mismo repo, sin forma de saber después quién tocó algo que no debía). Misma categoría que
`CLAUDE.md`, las reglas de scope-lock/delegación de este archivo, o el hook `AUTO-CONTEXT` que ya
corre en cada sesión — **no vive en `src/`, no tiene superficie en el dashboard del producto**
(eso sería para los usuarios finales de OrchestOS, que no son quienes esto gobierna). Por eso F.3
(superficie en dashboard) se elimina, y el fix del panel de diagnosis (antes F.4, bug real de
producto sin relación con el ledger, agrupado solo por coincidir en fecha) se movió a **Bloque F2**
como ítem independiente, más abajo.

Nace de un caso real de este Mes: el fix G.5 (algún modelo, alguna sesión) reintrodujo una
regresión contra una regla que Carlos había marcado "no reabrir" ([[feedback-context-no-max-tokens]],
ver Bloque E) — y **hoy no hay forma de saber qué modelo lo hizo ni por qué**. Carlos quiere un
registro que le diga, por tarea/sesión, **qué LLM actuó y por qué cambió (o respetó) una regla que
él dejó**. El objetivo no es castigar: es distinguir tres comportamientos para saber con qué modelo
le conviene trabajar —
  1. **Obediencia ciega** — sigue la regla sin pensar (aceptable, pero no lo más valioso).
  2. **Desviación razonada** — decide NO seguir una regla y **explica el porqué** con un argumento
     sólido (el comportamiento MÁS inteligente y el que Carlos más quiere premiar).
  3. **Desviación silenciosa / regresión** — cambia o rompe una regla sin avisar ni justificar
     (el que "destruye" — exactamente lo que pasó con G.5).

- [x] **F.1 — 🧠 (2026-07-18) Diseño del ledger APROBADO por Carlos.** `LEDGER.md` append-only en
  la raíz del repo (mismo estatus que PLAN/IDEAS/DONE: versionado en git, texto plano, sin infra
  nueva). Formato de entrada aprobado:

  ```markdown
  ## 2026-07-18 14:32 America/Guayaquil — claude-sonnet-5

  **Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E)
  **Clasificación**: REGRESIÓN
  **Por qué**: harness.ts volvió a clampear max_tokens al catálogo (8192 fijo) en vez de
  derivar de contextWindow−prompt. No fue una decisión consciente — se reintrodujo el patrón
  viejo sin darse cuenta de que pisaba una regla marcada "no reabrir".
  **Reversibilidad/evidencia**: commit d6e1791 revierte el clamp. Sin backup necesario —
  cambio de código puro, sin side-effects en datos.

  ---
  ```

  Campos: **fecha/hora real** (zona de Carlos, America/Guayaquil — nunca adivinar el momento del
  día); **modelo** — id exacto, dato **autoritativo, no auto-reportado** (runtime activo en sesión
  interactiva vía `/model`; columna `model` de `runs` en corridas agénticas — nunca lo que el LLM
  "diga" ser); **regla tocada** — link al slug de memoria / ítem de PLAN.md / sección de CLAUDE.md;
  **clasificación** — uno de `RESPETÓ` · `DESVIÓ-CON-RAZÓN` · `OVERRIDE-PEDIDO-POR-CARLOS` ·
  `REGRESIÓN`; **por qué** (obligatorio si no es `RESPETÓ` — una entrada `DESVIÓ-CON-RAZÓN` sin
  argumento sólido cuenta como `REGRESIÓN`); **reversibilidad + evidencia** — ¿se puede deshacer?,
  ¿qué prueba/commit lo respalda? (mismo eje de [[project-improver-and-4-states-candidate]]).

  **Decisión de disparo (Carlos, 2026-07-18, define el alcance de F.2)**: `RESPETÓ` se registra
  **siempre** que un LLM toca una regla documentada marcada "no reabrir"/relevante y la respeta —
  no solo on-demand. Da el conteo completo por modelo (RESPETÓ vs. DESVIÓ vs. REGRESIÓN) si algún
  día Carlos quiere revisarlo con un query/script sobre `LEDGER.md`, a costa de más volumen de
  entradas — aceptado explícitamente sobre las alternativas de "solo on-demand" o "no registrar
  obediencia".
- [x] **F.2 — 🧠 (2026-07-18) IMPLEMENTADO.** Carlos eligió gate de pre-commit (sobre hook
  por-turno o combinación) — se activa solo en el momento exacto que importa, cuando el cambio ya
  va a quedar en git history.
  - [.claude/protected-rules.json](.claude/protected-rules.json) — registro `{pattern, rule, note}`
    nuevo, mismo espíritu que `.claude/settings.json` (gobernanza de este repo, nunca importado
    desde `src/`). Seed inicial con evidencia real, no cobertura inventada: `src/run/harness.ts` y
    `src/router/model-catalog.ts`, ambos ligados a [[feedback-context-no-max-tokens]] (la regla que
    ya se regresionó una vez, Bloque E). **Mantenimiento a mano**: cada regla nueva marcada "no
    reabrir" necesita su archivo agregado acá o el gate no la protege.
  - [scripts/check-ledger-gate.ts](scripts/check-ledger-gate.ts) — lee staged files
    (`git diff --cached --name-only`), si alguno matchea el registro exige que `LEDGER.md` esté
    staged CON una línea agregada que matchee `^## \d{4}-\d{2}-\d{2}` (una entrada nueva real, no
    solo el archivo tocado). Sin eso, aborta con el archivo/regla/nota exactos que faltan. Script
    de gobernanza — vive en `scripts/`, no en `src/`, mismo criterio que `export-runs-summary.ts`.
  - Wireado en [scripts/pre-commit.sh](scripts/pre-commit.sh) (`bun run ledger:gate`, nuevo script
    en `package.json`) + copiado a `.git/hooks/pre-commit` (regla del `CLAUDE.md` del proyecto).
  - **Verificado en vivo, 3 casos reales** (staged/reset manual, sin commits de prueba): (1) commit
    sin tocar archivos del registro → pasa silencioso; (2) `harness.ts` tocado sin entrada en
    `LEDGER.md` → bloquea con el mensaje exacto (archivo + regla + nota); (3) `harness.ts` tocado
    CON entrada nueva en `LEDGER.md` → pasa. `tsc --noEmit` limpio.
  - **No verifica calidad del argumento** — un LLM podría escribir una entrada vacía de contenido
    solo para pasar el gate. Eso lo revisa Carlos leyendo `LEDGER.md`/el reporte de F.3 — el gate
    solo garantiza que *algo* quedó escrito, no que esté bien razonado.
- [x] **F.3 — 🧠 (2026-07-18) IMPLEMENTADO.** Reporte agregado bajo demanda (pedido de Carlos:
  "al final del desarrollo o cada cierto tiempo quiero ver esta tabla"). NO es una pantalla del
  dashboard (esa era la confusión original que motivó sacar el viejo F.3) — es un script que
  Carlos corre cuando quiere, mismo molde que `scripts/export-runs-summary.ts`.
  - [scripts/ledger-report.ts](scripts/ledger-report.ts) — `bun run ledger:report` (nuevo en
    `package.json`). `parseLedgerEntries()` lee `LEDGER.md`, extrae cada entrada real (heading
    `## <fecha> — <modelo>` + `**Clasificación**: X`) ignorando el header introductorio del
    archivo (sin esos dos campos, no cuenta como entrada). `aggregateByModel()` cuenta
    `RESPETÓ`/`DESVIÓ-CON-RAZÓN`/`OVERRIDE-PEDIDO-POR-CARLOS`/`REGRESIÓN` por modelo, tabla en
    texto plano a stdout.
  - **Caso real de hoy manejado explícitamente**: `LEDGER.md` no tiene entradas todavía (nunca se
    disparó el gate de F.2 en esta sesión — ningún commit tocó `harness.ts`/`model-catalog.ts`) —
    el script lo detecta y avisa en vez de fallar o mostrar una tabla vacía confusa. Se corrió de
    verdad contra el `LEDGER.md` real del repo y confirmó el mensaje correcto.
  - [scripts/ledger-report.test.ts](scripts/ledger-report.test.ts) — 6 tests: ledger vacío, una
    entrada completa, varias entradas de distintos modelos, bloque sin `Clasificación` ignorado
    (no cuenta como entrada falsa), agregación con conteos reales, agregación de lista vacía.
  - 773 tests · 0 fail · `tsc --noEmit` limpio (suite completa, no solo el archivo nuevo).

### Bloque F2 — ⚡/visual Fix del panel de diagnosis (bug real de producto, separado del ledger)

Pedido original de Carlos el mismo día que F, pero sin relación con el ledger — es un bug de UI
real de OrchestOS-el-producto, agrupado antes solo por coincidir en fecha.

- [x] **F2.1 — ⚡/visual (2026-07-18, Sonnet, tal como Carlos asignó — NO Opus).** Dar acabado
  visual al panel "view diagnosis" de una tarea (`diagnoseDetail`,
  [screens-core.js:682](src/dashboard/public/screens-core.js:682)).
  **Hipótesis original DESCARTADA con evidencia en vivo** — antes de tocar código se invocó la
  skill `frontend-design` y se verificó en el dashboard real (puerto 4299, sin tareas `failed`
  reales disponibles → estado sintético inyectado vía `state.diagnoseCache`/`App.rerender()`,
  nunca tocó la DB): el combo `buildModelSelect()` **ya renderizaba y funcionaba correctamente**
  ahí — CSS aplicado (`getComputedStyle` confirmó border/background/border-radius reales), abre,
  busca, filtra. La causa "cae a select plano" nunca existió — pudo ya estar resuelta de antes, o
  el reporte original describía el problema real (2) sin que fuera realmente (1).
  El problema real: acabado visual pobre. `lastErrorResult` (un `<pre>` + botón) estaba forzado
  dentro del patrón `.kv` (pensado para pares clave/valor simples de una línea), y la fila de
  acciones (modelo + retry/habit) no tenía separación del contenido de arriba.
  **Fix aplicado**: [screens-core.js](src/dashboard/public/screens-core.js) — `lastErrorResult`
  sacado del `.kv` a su propia sub-sección (`.diag-error-grp`, mismo patrón `.grp > h4` que ya
  usaba el resto del panel); `.diag-actions` con clase propia en vez de estilos inline sueltos.
  [styles.css](src/dashboard/public/styles.css) — `.detail` con `background: var(--surface)` (antes
  `var(--bg)`, plano) y más padding/gap; `.diag-error-grp`/`.diag-error-pre`/`.diag-actions` nuevos,
  reusando el patrón de borde superior de `.settings-foot` para separar secciones (regla de reusar
  patrones existentes en vez de inventar). Verificado en vivo tras el fix: secciones con jerarquía
  clara, bloque de error en su propio contenedor, combo confirmado funcional (abrió, buscó,
  filtró modelos reales del catálogo). Server bajado al terminar
  ([[feedback-siempre-cerrar-servidor]]). `tsc --noEmit` limpio.

### Bloque G — 🧠 Cascada de selección de motor: local → CLI → API (decisión de Carlos, 2026-07-17)

Decisión explícita de Carlos, repetida varias veces en el chat de este Mes hasta quedar clara:
ya tiene CLIs pagados (Claude Code, opencode) y no quiere seguir gastando saldo de OpenRouter en
tareas que esos CLIs pueden resolver gratis (para él). Tampoco quiere volver a usar la pantalla
Tasks a mano — **todo entra por el chat**, Tasks queda como vista de resultado/seguimiento, no
como punto de creación. Orden de la cascada cuando el chat no fija nada explícito: (1) LLM local
(Ollama) si hay uno detectado — no cuesta nada; (2) si no, el CLI ya pagado del usuario; (3) recién
al final, API (OpenRouter — se mantiene como base del tier API porque su catálogo de costo y
contexto se actualiza solo, a diferencia de mantener esa tabla a mano).

Esto NO es "un LLM decidiendo el modelo" — [[feedback-modelo-decision-final-carlos]] sigue vigente
igual que antes: es la implementación de una regla que Carlos fijó él mismo, con el mismo estatus
que `orchestos.config.yaml` ya tenía. Aplica la regla nueva de [[feedback-planificar-cambios-grandes]]
(2026-07-17): esto toca múltiples módulos y redefine un comportamiento central (routing de
modelo/motor) — por eso queda como plan ordenado acá antes de seguir codeando en caliente (se
había empezado sin plan compartido y Carlos cortó a mitad de camino).

- [x] **G.1 — 🧠 (2026-07-20)** Detección de tiers:
  [src/router/engine-cascade.ts](src/router/engine-cascade.ts) — `resolveCascadeTier()` chequea
  Ollama local (`localhost:11434/api/tags`, timeout corto propio para no colgar el camino caliente
  del chat) y el binario `claude` (reusa `findClaudeBinary()` de `external.ts`, ya existente).
  `opencode` queda fuera a propósito — sin contrato CLI verificado en este repo, ver G.5. Tests de
  regresión en [engine-cascade.test.ts](src/__tests__/engine-cascade.test.ts) (6 casos: Ollama con
  modelos → local; Ollama ok sin modelos / status no-ok / fetch rechazado → no cuenta como local;
  claude en PATH → tier cli + engine external + modelo sonnet por defecto; sin Ollama ni claude →
  tier api sin fijar nada, gana `orchestos.config.yaml`) — mismo patrón que
  `external-engine.test.ts`/`model-catalog.test.ts` (override directo de `Bun.which`/
  `globalThis.fetch`, sin `mock.module`). 786 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **G.2 — 🧠 (2026-07-20)** Wiring en D.7 (`handlers/chat.ts`): cuando el chat auto-crea una
  tarea de build, si `resolveCascadeTier()` devuelve tier `'cli'`, la tarea se crea con
  `engine: external` + `executor_model: anthropic/claude-sonnet-5` en vez de heredar siempre
  `orchestos.config.yaml`. Tier `'local'` se detecta pero NO actúa todavía — no hay executor de
  tareas para Ollama (`ollamaChat` solo sirve al chat interactivo, no a build tasks vía harness);
  aterrizar en ese tier hoy no fija nada y la tarea sigue heredando el config normal, igual que
  tier `'api'` (que ya es el comportamiento por defecto actual). El mapeo tier→campos se extrajo
  como función pura `cascadeTaskFields()` en
  [engine-cascade.ts](src/router/engine-cascade.ts) — `handleApiChat` tiene un preámbulo async
  largo que hace racy mockear `globalThis.fetch` contra él en la suite completa (confirmado
  empíricamente en `chat-effort.test.ts`, BACK.3/BACK.4), así que la lógica testeable vive fuera
  de esa ventana en vez de un test end-to-end del handler. 3 tests nuevos en
  [engine-cascade.test.ts](src/__tests__/engine-cascade.test.ts) (tier cli fija ambos campos;
  tier local/api no fijan nada). 789 tests · 0 fail · `tsc --noEmit` limpio.
**Redefinición 2026-07-20 (decisión de Carlos, corrige el diseño original de G.3-G.5):** dos
correcciones de fondo tras auditar en vivo qué CLIs existen de verdad en la máquina:
1. **Los CLIs reales son 3: Claude, opencode (free + OpenRouter) y Kimi** (recién instalado).
   Codex queda **descartado** — Carlos ya no tiene suscripción, el `~/.codex/` que aparecía en el
   filesystem es config huérfana, no instalar soporte para él. Kimi hoy es solo `Kimi.app`
   (Electron GUI en `/Applications`) — **sin binario CLI alcanzable por PATH todavía**
   (`command -v kimi*` no encuentra nada, el bundle no trae uno). Mismo criterio que ya aplicó
   E.15/G.1 con opencode: no fingir soporte de un binario que no se puede invocar — Kimi queda
   fuera de esta pasada hasta que exista un CLI real que probar.

   **Corrección 2026-07-27 (G.4)**: Carlos volvió a pagar Codex (activo 2026-07-22 → 2026-08-22,
   quería aprovecharlo). Binario `codex` SÍ está instalado (`codex-cli 0.145.0`, verificado en
   vivo). Codex re-entra como 4to candidato de CLI — pero solo existe como *provider* de rol
   ([src/providers/codex.ts](src/providers/codex.ts), usado en `orchestos.config.yaml` para
   planner/qa), NO como `ExecutorEngine` de build tasks (no hay `src/run/executors/codex.ts` — ver
   G.4 abajo, es trabajo nuevo si se lo incluye ahí). Kimi sigue GUI-only, sin cambios.
2. **No es pty-vivo estilo Orca.** Carlos aclaró: quiere la visibilidad DENTRO del chat de
   OrchestOS (cards de "qué se está haciendo", expandibles, mismo patrón que ya usa Claude Code
   con el usuario) — no una terminal aparte (eso es lo que hace Orca, y Orca no tiene chat). El
   desbloqueo técnico: **ambos CLIs soportan streaming real**, no hace falta pty.
   - `claude -p --output-format stream-json --include-partial-messages` (verificado con
     `claude --help`, no usado hoy — `external.ts` usa el modo batch `--output-format json`).
   - `opencode run "msg" --format json` — NDJSON incremental (`step_start` / `text` con deltas /
     `step_finish` con tokens+costo por paso), probado en vivo el 2026-07-20. Además expone
     `-m provider/model` (mismo formato que ya usa `orchestos.config.yaml`), `--variant`
     (esfuerzo/reasoning) y `opencode models [provider]` — catálogo de modelos dinámico real.

**Orden de ejecución correcto (reordenado — G.5 ya no depende de G.3, al revés)**:

- [x] **G.5 — 🧠 (2026-07-20)** Generalizar a un segundo binario (`opencode`). Nuevo executor
  [opencode.ts](src/run/executors/opencode.ts), mismo contrato `ExecutorEngine` que `external.ts`,
  batch (`opencode run "<prompt>" --format json --auto` — `--auto` es obligatorio en headless o
  opencode cuelga esperando confirmación interactiva de cada tool call). NDJSON incremental, no un
  blob único: costo/tokens se suman entre todos los eventos `step_finish` del stream (nunca $0
  silencioso si no aparece ninguno). `readWorktreeDiff()` extraído de `external.ts` a
  [worktree-diff.ts](src/run/executors/worktree-diff.ts) para reusarlo entre los dos executors sin
  duplicar la lógica (con historial real de bugs — ver comentario ahí) — sin cambio de
  comportamiento en `external.ts`, solo relocación. `orchestosModelToOpencodeModel()` devuelve
  `undefined` a propósito: el namespace de modelos de opencode (`opencode/*-free`,
  `openrouter/<provider>/<model>`, 2-3 partes) no coincide con el de OrchestOS — pasar el id tal
  cual sería silenciosamente incorrecto; la tabla de traducción real queda para G.4, cuando se
  cargue el catálogo de `opencode models`. `TaskEngine` extendido a `'opencode'` en
  `tasks/schema.ts` + los 4 puntos de validación/tipo que ya distinguían los otros 3 engines
  (`dashboard/types.ts`, `dashboard/handlers/tasks.ts`, `dashboard/handlers/runs.ts` —
  `deriveEngineFromBreakdown()` reconoce el label `"opencode (N steps)"` —, `cli.ts` con el mismo
  chequeo temprano de binario que ya tenía `external`). **Fuera de esta pasada, a propósito**: el
  dropdown de engine del composer de Tasks y el endpoint de disponibilidad
  (`/api/system/engines/.../availability`) — esa superficie es manual, y la regla del proyecto es
  que todo se resuelve desde el chat (G.3/G.4 son los que de verdad la exponen ahí). 8 tests nuevos
  en [opencode-engine.test.ts](src/__tests__/opencode-engine.test.ts) (happy path con 2
  `step_finish` sumados, `--variant` desde `cli_effort`, binario ausente, sin worktree, timeout,
  sin `step_finish` → error explícito, líneas NDJSON corruptas no abortan el parseo, traducción de
  modelo siempre `undefined`). 797 tests · 0 fail · `tsc --noEmit` limpio.
**G.3 — 🧠 Chat conversacional en vivo vía CLI.** Nota de diseño (2026-07-27): NO existe hoy
patrón de cards de tool-call en el chat ([screens-core.js:222](src/dashboard/public/screens-core.js:222)
es bubble simple) y la tarea corre en background fuera del request HTTP del chat
([chat.ts:524](src/dashboard/handlers/chat.ts:524)) — subdividido en 3 por eso:

- [x] **G.3.1 — 🧠 (2026-07-27) Executor batch → streaming.** `external.ts`: `--output-format
  json` → `stream-json --include-partial-messages --verbose` (verificado en vivo), lee stdout con
  reader+buffer de línea, busca la última línea `type: "result"` (mismos campos que el blob viejo)
  en vez de `JSON.parse(stdout)` completo. `opencode.ts`: mismo cambio de lectura (reader
  incremental), sin cambio de args (ya emitía NDJSON). Sin cambio de comportamiento observable —
  prerequisito de G.3.2/G.3.3. 797 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **G.3.2 — 🧠 (2026-07-27) Evento común `ExecutorStepEvent`.**
  [step-event.ts](src/run/executors/step-event.ts): `{ type: 'tool_use'|'text'|'step_finish',
  label, detail?, costUsd?, tokens? }` + `claudeEventToStep()`/`opencodeEventToStep()`. Shapes
  verificados en vivo (no asumidos): opencode con `opencode run --format json --auto` real
  (`evt.type` en `tool_use`/`text`/`step_finish`/`step_start`); claude con
  `claude -p --output-format stream-json --include-partial-messages --verbose` real (blocks
  `text`/`tool_use` en `message.content[]`, mismo shape que ya usa `tool-call.ts`). Deltas de
  `stream_event` de claude NO se mapean — no se pudo probar su shape en este entorno, no fingir
  soporte no verificado (mismo criterio que G.1/G.5). Standalone, sin wiring a los executors
  todavía (eso es G.3.3). 11 tests nuevos con fixtures de los probes reales
  ([step-event.test.ts](src/__tests__/step-event.test.ts)). 808 tests · 0 fail · `tsc` limpio.
- [x] **G.3.3 — 🧠 (2026-07-27) Transporte + UI de cards en vivo.** SSE descartado: `spawnTaskRun()`
  lanza `cli.ts task run` como proceso OS separado ([tasks.ts:214](src/dashboard/handlers/tasks.ts:214),
  `stdout: 'inherit'`) — el dashboard no tiene conexión viva a él, solo polling es viable. Tabla
  `run_steps` keyeada por **task_id, no run_id** ([migrate.ts](src/db/migrate.ts):
  `insertRun()` solo crea la fila de `runs` al final del run, pero el chat conoce el task_id desde
  que lo auto-crea). [db/run-steps.ts](src/db/run-steps.ts): `insertRunStep`/`getRunSteps`/
  `clearRunSteps`, `seq` incremental por task_id. `ExecutorEngine.run()` gana `opts.onStep`
  ([types.ts](src/run/executors/types.ts)), conectado en `external.ts`/`opencode.ts` a los
  traductores de G.3.2 dentro del loop de lectura ya streaming de G.3.1; `harness.ts` lo persiste
  vía `insertRunStep(ctx.task.id, event)` + `clearRunSteps()` al arrancar. Endpoint
  `GET /api/tasks/:id/steps?since=<seq>` ([tasks.ts](src/dashboard/handlers/tasks.ts)). Chat
  (`screens-core.js`): `startStepPolling()` arranca al recibir `autoTask.id`, poll 1.5s hasta
  status terminal (`st.tasks`) o 400 intentos (~10min, red de seguridad); cards colapsadas por
  default (`renderStepsCard()`), expand/collapse en `st.chatLiveSteps[taskId].expanded`. Verificado
  en vivo contra el dashboard real (fixtures sembrados vía `db/run-steps.ts`, no simulados): card
  colapsada, expand con filas correctas, poll incremental 2→3 pasos automático, `step_finish`
  correctamente oculto de las filas — un bug real de CSS encontrado y corregido en el camino
  (`.chat-step-row` sin `flex-wrap` partía palabras del label a la mitad). 5 tests nuevos
  ([run-steps.test.ts](src/__tests__/run-steps.test.ts)). 813 tests · 0 fail · `tsc --noEmit`
  limpio. **Cierra Bloque G.3 completo.**
**Rediseño 2026-07-27 (corrección de Carlos)**: el diseño original de G.4 dejaba que la cascada
ELIGIERA el motor de la tarea auto-creada en silencio — Carlos lo objetó: la cascada debe
**detectar** disponibilidad, nunca **decidir** en nombre del usuario sin que se dé cuenta a mitad
de una conversación. Separación de responsabilidades:
- **Detección** (`resolveCascadeTier()` y sucesores) → solo informa qué hay disponible ahora
  mismo (local/Claude/opencode/Codex/API). Nunca cambia de motor a mitad de sesión en silencio.
- **Selección** → preferencia persistente y explícita del usuario (`orchestos.config.yaml` /
  Settings), un toggle que se guarda hasta que el usuario lo cambie. La cascada solo SUGIERE un
  default razonable la primera vez que no hay preferencia guardada (o si el modo elegido deja de
  estar disponible — ahí se avisa y se pregunta, nunca se salta en silencio).
- Onboarding no-dev (default sugerido = opencode, sin subscripción/pago) queda anotado para
  después, no en esta pasada — [[IDEAS #56 pendiente de crear]].

- [x] **G.4.1 — 🧠 (2026-07-27) `orchestos.config.yaml`: campo `executor_mode` persistente.**
  [schema.ts](src/config/schema.ts): `ExecutorMode = 'local'|'cli-claude'|'cli-opencode'|
  'cli-codex'|'api'`, campo opcional (ausente = sin preferencia guardada). [load.ts](src/config/load.ts)
  lo parsea con el mismo criterio que `executorEngine` (valor desconocido/typo → `undefined`, nunca
  inventa una preferencia). Nueva `resolveExecutorSelection(preferredMode, cascade)` en
  [engine-cascade.ts](src/router/engine-cascade.ts): `preferredMode` gana siempre; `cli-codex`
  devuelve `{}` a propósito (sin `ExecutorEngine` todavía, G.4.2) — mismo criterio de "no fingir
  soporte" que `orchestosModelToOpencodeModel()`. `chat.ts` la usa en vez de `cascadeTaskFields()`
  directo, pasándole `loadOrcheConfig(root).executor_mode`. 15 tests nuevos en
  [engine-cascade.test.ts](src/__tests__/engine-cascade.test.ts) + 3 en
  [engine-selection.test.ts](src/__tests__/engine-selection.test.ts) (parseo de `executor_mode`).
  822 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **G.4.2 — 🧠 (2026-07-27) Detección GENÉRICA de CLIs** (corrección de Carlos: no una función
  ad-hoc por CLI). [cli-registry.ts](src/run/executors/cli-registry.ts): registro de datos
  `KNOWN_CLIS: { id, binary, label }[]` (claude, codex, opencode, kimi — kimi sin binario real
  todavía, igual queda en el registro) + `detectInstalledClis()` genérica que corre `Bun.which()`
  sobre TODO el registro, devuelve `{ id, label, binary, installed, path }[]`. Agregar un CLI nuevo
  a futuro = una entrada en el registro, no una función nueva. Detección independiente de si existe
  `ExecutorEngine` para ese CLI — Codex/Kimi pueden aparecer `installed: true` sin poder ejecutarse
  todavía (G.4.2b). `findClaudeBinary()`/`findOpencodeBinary()` (external.ts/opencode.ts) NO se
  tocaron — siguen con su mensaje de error específico por engine; el registro es la capa de
  detección genérica para UI/disponibilidad (consumidor real: endpoint G.4.3 — ver abajo).
  `resolveCascadeTier()` no se tocó en esta pasada, sigue con su lógica ya testeada. 5 tests
  nuevos ([cli-registry.test.ts](src/__tests__/cli-registry.test.ts)). 827 tests · 0 fail ·
  `tsc --noEmit` limpio.
- [x] **G.4.2b — 🧠 (2026-07-27) `ExecutorEngine` real para Codex.**
  [codex.ts](src/run/executors/codex.ts): mismo contrato `ExecutorEngine` que `external.ts`/
  `opencode.ts`. Contrato verificado en vivo (probe real contra un git repo temporal, no asumido):
  `codex exec "<prompt>" --json --sandbox workspace-write --color never` — headless por diseño, sin
  flag `--auto` equivalente. JSONL: `thread.started`/`turn.started`/`item.started`/`item.completed`
  (`item.type`: `agent_message`/`command_execution`/`file_change`/`error`)/`turn.completed`.
  **Sin `total_cost_usd` en el evento** (a diferencia de claude/opencode) — costo computado vía
  `calcCost()` sobre el catálogo real, y SOLO si `getCatalog()?.has(model)`; si no, lanza en vez de
  reportar $0 (F0.8). `orchestosModelToCodexModel()` pela `openai/` (default real del binario,
  `gpt-5.4`, confirmado en `~/.codex/config.toml`). `codexEventToStep()` nuevo en
  [step-event.ts](src/run/executors/step-event.ts) (solo `item.completed`, ignora `error` —
  informational en la práctica). `TaskEngine` extendido a `'codex'` (mismos 5 puntos que G.5:
  `schema.ts`, `dashboard/types.ts`, `dashboard/handlers/tasks.ts`, `dashboard/handlers/runs.ts` —
  `deriveEngineFromBreakdown()` reconoce `"codex (exec)"` —, `cli.ts`); `harness.ts` gana la rama de
  selección + `shouldSplit()` excluye `'codex'` (mismo motivo que external/opencode, ver LEDGER.md).
  `resolveExecutorSelection('cli-codex', ...)` (G.4.1) ya no devuelve `{}` — fija
  `executor_model: 'openai/gpt-5.4', engine: 'codex'`. 21 tests nuevos (8 en
  [codex-engine.test.ts](src/__tests__/codex-engine.test.ts), 7 en `step-event.test.ts`, 1 en
  `engine-cascade.test.ts` actualizado). 843 tests · 0 fail · `tsc --noEmit` limpio. Ventana real de
  la suscripción: activo hasta 2026-08-22.
- [x] **G.4.3 — 🧠 (2026-07-27) Endpoint `GET /api/system/executor-modes`.**
  `handleApiSystemExecutorModes()` en [tasks.ts](src/dashboard/handlers/tasks.ts), registrado en
  [server.ts](src/dashboard/server.ts) junto a `/api/system/engines/external/availability`.
  Devuelve `{ modes: [{id,label,detected,path}] (local/cli-claude/cli-opencode/cli-codex/api, sin
  kimi), selected: ExecutorMode|null }` — `local` prueba Ollama igual que `setup.ts`, los 3 CLI
  vienen de `detectInstalledClis()` (G.4.2), `api` siempre `detected:true`, `selected` lee
  `loadOrcheConfig().executor_mode` (G.4.1). **Delegado a Codex** (`gpt-5.6-luna`, cuidando cupo
  semanal de Claude — usuario en 70%, reset jueves) con prompt self-contained citando los archivos
  exactos a seguir; Codex corrió su propio `tsc --noEmit` antes de terminar. Revisado (diff limpio,
  sin scope creep), verificado en vivo contra el dashboard real (`curl` real: 3 CLIs detectados de
  verdad — claude/opencode/codex con sus paths reales), y testeado a mano después (6 tests,
  [executor-modes-endpoint.test.ts](src/__tests__/executor-modes-endpoint.test.ts) — Codex no tocó
  tests, por instrucción explícita del prompt). 849 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **G.4.4 — 🧠 (2026-07-27) UI: selector de modo en Settings.** Nueva card "Chat build mode" en
  Settings → Executor (`executorModePanel()`, [screens-ops.js](src/dashboard/public/screens-ops.js)),
  ANTES del `executorPanel()` viejo — ejes distintos, no se reemplazan (el viejo es el motor
  default para tareas manuales sin `engine:`, éste es la preferencia para tareas auto-creadas por
  el chat). Fila segmentada Auto/Local/Claude CLI/opencode CLI/Codex CLI/API (reusa
  `.engine-picker`/`.engine-opt`, ya existente), dot verde/gris por opción (detectado real vía
  G.4.3), checkmark en la activa. Elegir un modo no-detectado se permite (nota inline, no bloquea)
  — [[feedback-deteccion-no-decision-automatica]]. Backend: `handleApiConfigSet` (config.ts) gana
  `executorMode: ExecutorMode|null` (`null` limpia la preferencia, vuelve a "Auto"),
  `EXECUTOR_MODES` exportado desde `load.ts` para no duplicar la lista de valores válidos.
  Verificado en vivo contra el dashboard real (no solo tests): seleccioné "Codex CLI" → persistió
  de verdad en `orchestos.config.yaml` → volví a "Auto" → se limpió de verdad — con curl/grep
  directo al archivo, no solo la UI. 5 tests nuevos
  ([config-set-executor-mode.test.ts](src/__tests__/config-set-executor-mode.test.ts), escritos con
  `process.chdir()` a un dir temporal para NUNCA tocar el `orchestos.config.yaml` real del repo
  durante la suite). 854 tests · 0 fail · `tsc --noEmit` limpio. **Cierra Bloque G completo
  (G.1-G.5, G.3.1-G.3.3, G.4.1-G.4.4)** — Bloque H (rediseño completo de Settings + limpieza) sigue
  abierto, aparte.
- [x] **G.4.5 — 🧠 (2026-07-27) Catálogo dinámico de opencode vía models.dev.** Diseño (probe real
  del namespace `openrouter` de models.dev, confirmado en vivo: mismo formato `provider/model` que
  OrchestOS) por Claude; implementación delegada a Codex (`gpt-5.6-luna`,
  [[feedback-cuidar-cupo-claude-delegar-codex]]) — diff revisado, `_resetOpencodeCatalog()` agregado
  a mano (faltaba, necesario para aislar tests), tests escritos aparte (11 nuevos en
  [opencode-catalog.test.ts](src/__tests__/opencode-catalog.test.ts)), verificado en vivo con
  `bun -e` real (341 modelos cargados, `anthropic/claude-sonnet-5` → `openrouter/anthropic/
  claude-sonnet-5`, id inexistente → `undefined`). **Nota de proceso**: esta corrida de Codex se
  salió de scope 3 veces (cerró G.4.5 y H.2 en PLAN.md sin pedírselo, agregó IDEAS #56 citando a
  Carlos como origen) — revertido antes de commitear; [AGENTS.md](AGENTS.md) dice explícitamente
  "agarrá SOLO ítems ⚡", H.2 es 🔍 y G.4.5 lo cierra quien lo verifica, no quien lo implementa.
  865 tests · 0 fail · `tsc --noEmit` limpio.

**Fuera de esta pasada**: Kimi (sin CLI instalable todavía); onboarding no-dev con default
opencode (pendiente de anotar en IDEAS.md, diseño de UX aparte); `--effort`/`--variant` por
modelo dentro de cada CLI-mode (detalle de G.4.4, no bloquea la estructura base).

**Orden de ejecución sugerido**: G.2 (retomar, cerrar con tests) tiene el impacto más inmediato en
la calidad de lo que se viene probando toda la sesión (las páginas de crypto/Apple) y es el cambio
más chico — cerrarlo primero. G.3+G.4 son la pieza grande (diseño propio antes de codear). G.5
queda pendiente de que Carlos pueda darle a Claude el contrato real de `opencode`.

---

### Bloque H — 🧠 Rediseño de Settings: de "debug-dump" a producto premium (orden de Carlos, 2026-07-18)

Carlos auditó la pantalla de Settings en vivo y marcó 5 puntos concretos donde la UI muestra datos
correctos pero sin propósito ni acabado, más una referencia explícita a **cómo lo hace Orca**
(`github.com/stablyai/orca`, Electron/React MIT, `src/` público — auditado en esta sesión) y a
**graduar la idea #27** (tab de consumo/gasto estilo OpenRouter + heatmap tipo GitHub). Esto toca
múltiples módulos (`handlers/config.ts`, `handlers/setup.ts`, `db/runs.ts`, `public/screens-ops.js`,
`public/i18n.js`, CSS del `settings-shell`) y redefine una superficie central (Settings) — por eso,
regla [[feedback-planificar-cambios-grandes]] (2026-07-17): queda escrito acá ANTES de codear.

**Antes de tocar cualquier UI de este bloque:** invocar la skill `frontend-design` (y `ux-guidelines`
si el cambio es de interacción), grep de patrones ya existentes en el dashboard para reusar en vez de
reconstruir (ej. `buildModelSelect()`, `theme-picker`, cards de `settings-card`), y nunca introducir
un `<select>` largo sin buscador — regla de frontend global de Carlos (`~/.claude/CLAUDE.md`).

Referencia de diseño auditada en Orca (no copiar 1:1, sí robar el patrón):
- **Config de agentes/CLI** (`AgentsPane.tsx`): cada agente CLI es una *fila de catálogo* — icono,
  estado detectado/no-detectado, toggle enabled, radio "default", y campos de Command/Args/Env
  editables inline SOLO como override con botón "Reset". El path/comando nunca se muestra como texto
  suelto: se muestra como default editable con estado explícito.
- **Uso vs gasto separados**: Orca muestra *porcentaje de uso del rate-limit del proveedor* en la
  status bar (usado/restante configurable, por cuenta), distinto del *gasto en $*. Son dos métricas
  distintas — no mezclarlas en una sola card.
- **Settings con búsqueda en vivo** y agrupación por categorías + una entrada por proyecto (no un tab
  genérico "Project" con paths crudos).

**Refuerzo 2026-07-27**: Carlos mandó capturas REALES de la app de escritorio de Orca (no solo
código fuente) — confirma y extiende la referencia de arriba. Patrones nuevos que aportan las
capturas: nav lateral con secciones en mayúsculas pequeñas (AI CAPABILITIES / SET UP / WORKFLOWS /
REMOTE HOSTS / PRIVACY & SECURITY), badges de estado por sección en el nav mismo ("Not installed",
"OPTIONAL", "BETA"), selector de agente por defecto como fila de botones segmentados con check en
el activo (mismo patrón que resolvió G.4.4), cards de integración con badge de color por estado
(verde=conectado, ámbar=no instalado) + botón de acción contextual ("Install X CLI" / "Re-check").
**Mandato explícito, no solo estética**: (1) "no hablo solo de estética sino también de las
configuraciones similares" — este bloque cubre layout Y contenido/comportamiento, no un simple
reskin; (2) limpieza obligatoria de settings que hoy solo muestran texto sin función real (auditar
antes de rediseñar, no asumir que todo lo existente se conserva); (3) [[feedback-acabados-elegantes-siempre]]
— estándar permanente de acabado, no una petición puntual de esta pasada.

- [x] **H.1 — 🧠 (2026-07-27) Tab de consumo/gasto (graduación de IDEAS #27).** Nuevo tab "Usage" en
  Settings ([usageHeatmapWeeks/buildUsageHeatmap/buildUsageByModel/usagePanel en
  screens-ops.js](src/dashboard/public/screens-ops.js)). Backend delegado a Codex
  ([usage.ts](src/dashboard/handlers/usage.ts): `GET /api/usage` agrega `runs` por día+modelo,
  últimos 400 días, `{byDayModel,totalUsd,totalRuns}`, nunca lanza) — diff revisado, sin scope
  creep esta vez, tests escritos aparte (4 en
  [usage-endpoint.test.ts](src/__tests__/usage-endpoint.test.ts)). Frontend (heatmap + tabla) por
  Claude, con skill `dataviz`: heatmap estilo GitHub-contributions (53 semanas, rampa secuencial de
  un solo hue vía `color-mix(in oklab, var(--accent) N%, var(--surface-2))` — theme-aware en los 4
  temas, mismo mecanismo que `--accent-dim`/`--accent-soft` ya usaban), niveles por cuartiles del
  gasto diario, tabla por modelo con selector de rango (7d/30d/90d/todo) agregado en cliente sobre
  el mismo payload. Verificado en vivo contra el dashboard real: datos reales (44 runs, $1.5778,
  desglose por modelo correcto), selector de rango funcional. 869 tests · 0 fail ·
  `tsc --noEmit` limpio.
- [x] **H.2 — 🔍 (2026-07-27) Investigar el gap del costo ($1.56 vs. run caro que falló).**
  Verificado contra la DB real (`sqlite3 ~/.orchestos/db.sqlite`, corrido dos veces — primero por
  Codex, re-verificado independiente por Claude, mismos números ambas veces): 44 runs persistidos,
  costo individual máximo `$0.4029228` — no hay ningún run cercano a `$5` en esta DB, ni evidencia
  de crash pre-`insertRun()`. Total histórico `$1.577759`; total de los últimos 7 días
  `$0.009213` (7 runs) — los `$1.568546` restantes quedan fuera de esa ventana (concentrados
  16-17 de julio). Confirma hipótesis (1): el `$1.56` que vio Carlos era la ventana de 7 días en
  ese momento, no el gasto total — falta de contexto en la UI (H.3), no bug de persistencia. H.1
  debe separar explícitamente gasto histórico / ventana seleccionada / runs fallidos, sin
  presentar una ventana móvil como total global.
- [x] **H.3 — ⚡ (2026-07-27) Contexto "7 días" visible en el costo.** Verificado en vivo contra el
  dashboard real: `t('health.cost')` = "Cost (7 days)" / "Costo (7 días)" ya lleva la ventana
  explícita, y [screens-ops.js:1092](src/dashboard/public/screens-ops.js:1092) es el ÚNICO sitio
  donde se renderiza `costLast7d` (`grep` confirmado, sin duplicado sin label en ningún otro
  screen). No hace falta código nuevo — ya estaba resuelto antes de que existiera H.1. No se
  delegó a Codex por no haber trabajo real que hacer.
- [x] **H.4 — 🧠 (2026-07-27) Preview de routing: de card permanente a preview inline.** La card
  huérfana ("Tareas pendientes — preview de routing") se quitó; ahora es un toggle pegado al botón
  "Guardar routing" ("N tareas pendientes se verían afectadas — ver/ocultar simulación"), colapsado
  por default, título "Simulación de routing" ([routingPanel()](src/dashboard/public/screens-ops.js)).
  **Bug real encontrado y arreglado al verificar en vivo**: `handleApiConfigGet()` no atrapaba el
  throw de `loadTasks()` — una sola tarea malformada en `tasks.yaml` (`output: []`, la tarea
  fantasma auto-creada por el falso positivo del chat, ver conversación) tumbaba con 500 el
  endpoint `/api/config` ENTERO, dejando toda la pantalla de Settings sin cargar (no solo el
  preview). Mismo patrón de resiliencia que ya usaba `handleApiTasks()`. No se tocó la tarea
  malformada en sí — queda pendiente de que Carlos decida si la borra o la corrige. 2 tests nuevos
  ([config-get-resilience.test.ts](src/__tests__/config-get-resilience.test.ts)). Verificado en
  vivo (toggle real + datos simulados, ya que la única tarea pending real es la malformada). 871
  tests · 0 fail · `tsc --noEmit` limpio.
- [x] **H.5 — ⚡ (2026-07-27) Executor timeout: copy que explique el propósito.** Delegado a Codex
  (`gpt-5.6-luna`) — hint inline debajo del campo ("If the external CLI hangs, OrchestOS stops it
  after this many minutes so it cannot block forever" / ES equivalente), i18n en ambos bloques
  (EN/ES) de `i18n.js`. **Un problema de layout en el diff**: Codex metió el `<p>` de bloque DENTRO
  de `.engine-tune-row` (flex de una sola línea), quedando apretado entre el input y el badge —
  corregido a mano, movido fuera de la fila. Verificado en vivo contra el dashboard real. 871
  tests · 0 fail · `tsc --noEmit` limpio.
- [x] **H.6 — 🧠 (2026-07-27) Fuente de config: mejor presentación.** La ruta real ya no vive solo
  en un `title` de hover — texto visible siempre debajo del badge: con config, "Reading roles from
  {ruta real}"; sin config, explica el default real y verificado (`deepseek/deepseek-v4-flash` en
  los 4 roles, confirmado contra `DEFAULT_CONFIG` en `schema.ts`, no un genérico "usa defaults") +
  que guardar cualquier rol crea el archivo solo. Verificado en vivo. 871 tests · 0 fail ·
  `tsc --noEmit` limpio.
- [x] **H.7 — 🧠 (2026-07-27) Tab "Proyecto": ELIMINAR la card de paths crudos.** Card quitada
  entera (`cwd`/env file/comando CLI eran debug info no accionable), i18n keys muertas removidas.
  **Decisión sobre la pregunta abierta** (reevaluar si el tab sigue teniendo razón de existir):
  Carlos pidió explícitamente, mientras se cerraba este ítem, que cualquier acción destructiva
  (reset test data y futuras) viva en una "Danger Zone" clara, patrón estándar (GitHub/Vercel) —
  así que el tab se RENOMBRÓ a "Danger zone" (`ICON.warn`) en vez de desaparecer, con tratamiento
  visual real: card con borde rojo (`color-mix` sobre `var(--error)`, no solo texto en rojo) +
  eyebrow "DANGER ZONE". Precedente para cualquier acción destructiva futura — usar
  `.settings-card-danger`/`.danger-eyebrow`, no reinventar el patrón. Verificado en vivo. 871
  tests · 0 fail · `tsc --noEmit` limpio.
- [x] **H.8 — 🧠 (2026-07-28) Acabado visual general al estándar premium.** Una vez resueltos H.1-H.7, pasar la
  pantalla completa por el estándar Orca/Anthropic: patrón fila-de-catálogo donde aplique (routing,
  executor), jerarquía tipográfica real, espaciado consistente, sin cards genéricas repetidas. Gate
  visual: verificar en vivo contra el dashboard real (levantar, revisar, **cerrar el servidor** —
  [[feedback-siempre-cerrar-servidor]]), no solo en el código.
  **Primera pasada Codex autorizada por Carlos (2026-07-28)**: navegación agrupada por intención
  (Workspace / Configure / Observe / Protect), eyebrow de "Control room", rail luminoso del item
  activo, cards con jerarquía y hover sutil, filas de catálogo con feedback de interacción, focus
  visible y navegación responsive horizontal en mobile. Cambios en `screens-ops.js`, `screens.css`
  e `i18n.js`; `tsc --noEmit` y `git diff --check` pasan. Gate visual aún abierto: el entorno no
  permitió levantar una instancia temporal (puertos 4243, 4249 y 49173 reportados como ocupados),
  y `4242` no tenía un dashboard accesible; no se mató ningún proceso ajeno.
  **Gate cerrado en vivo (2026-07-28):** se liberó `4242` y se levantó el dashboard real. Verificado
  visualmente en desktop y viewport móvil: navegación por grupos, estado activo, tarjetas, heatmap,
  routing, executor, usage y scroll horizontal responsive. Consola sin errores ni warnings. Servidor
  cerrado al terminar la revisión.

**Cabo suelto resuelto (2026-07-28):** se eliminó de `tasks.yaml` la tarea fantasma
`debug-codex-cli-deepseek`; no tenía ningún run asociado en SQLite. Causa confirmada: el mensaje de
troubleshooting de Carlos (evento `chat_task_bar_events` 113, 2026-07-27 17:36:14) fue marcado
erróneamente como tarea por el clasificador `deepseek/deepseek-v4-flash`. El auto-flow D.7 llamó
después a `buildNaturalDraft()` (Claude Haiku), que devolvió `output: []`; `createTaskRecord()` no
validaba que el output fuera no vacío, así que persistió la tarea inválida y el dashboard hizo el
commit automático `ac2ed54`. La selección `executor_mode: cli-codex` sí explica `engine: codex` y
`executor_model: openai/gpt-5.4`, pero no fue la causa del falso positivo. El bug de fondo queda
identificado: falta un guard de creación automática para rechazar drafts sin output antes de
persistirlos.

**Explícitamente FUERA de esta pasada** (no expandir el scope sin nueva orden de Carlos):
- **NO** construir un "AI Vault" / workspace de sesiones de Claude escaneadas de disco (lo que Orca
  hace en `AiVaultPanel.tsx`, tab del sidebar derecho con resume de sesiones). Es un feature nuevo
  grande, no un rediseño de Settings — si Carlos lo quiere, entra como idea aparte en IDEAS.md.
- **NO** el selector de modelo dinámico por tier ni el chat-por-CLI — eso es Bloque G (G.3/G.4).
- **NO** multi-proveedor en el chat (IDEAS #31) ni porcentaje de rate-limit por cuenta estilo Orca
  (requeriría leer el rate-limit del proveedor, no está en `runs`) — anotar como idea si interesa,
  pero el gasto en $ (H.1) es lo pedido hoy.

**Orden de ejecución sugerido**: H.2 primero (query a la DB — destapa si hay bug de persistencia
antes de construir el tab sobre datos posiblemente incompletos). Luego H.1 (la pieza grande, sobre
la que H.3 se apoya o se absorbe). H.4/H.5/H.6/H.7 son fixes acotados de una card cada uno — pueden
ir en cualquier orden. H.8 al final (acabado sobre lo ya resuelto).

---

### Bloque I — 🔍 Falso positivo de `checks_failed` en el dreaming (hallazgo revisando DREAMING.md, 2026-07-20)

- [x] **I.1 — 🔍 (2026-07-20) Bug de instrumentación encontrado y corregido.** El análisis nocturno
  (DREAMING.md 2026-07-20) reportó como "patrón" que el 100% de los runs `implement`/`plan` tenían
  `checks_failed: 1` con QA `pass`. Verificado contra la DB real (`sqlite3 ~/.orchestos/db.sqlite`):
  **falso positivo** — los `checks_json` de esos runs tienen `exitCode: 0` en todos los checks (todos
  pasaron). Causa: [scripts/export-runs-summary.ts](scripts/export-runs-summary.ts) filtraba por
  `!c.pass`, pero `CheckResult` ([checks.ts:74](src/run/checks.ts:74)) no tiene campo `pass`
  (cmd/exitCode/stdout/stderr/elapsedMs/timedOut) — `c.pass` siempre `undefined` → todo check con
  resultado se contaba como fallado. Aislado al pipeline del dreaming: la aceptación real de tareas
  usa `exitCode !== expected` ([checks.ts:96](src/run/checks.ts:96)), nunca estuvo afectada.
  **Fix**: `countFailedChecks()` extraído como función pura (`c.timedOut || c.exitCode !== 0`), 7
  tests ([export-runs-summary.test.ts](scripts/export-runs-summary.test.ts)); módulo guardado bajo
  `import.meta.main` para que el test no dispare la DB; `runs-summary.json` regenerado (`checks_failed:
  0` en todos); DREAMING.md § Decisión anotado (ambas propuestas descartadas — fantasma). Suite
  completa · 0 fail · `tsc` limpio.
- **Hallazgo secundario real (no fantasma), graduado a IDEAS #53**: revisar este falso positivo
  confirmó que el QA de OrchestOS (`qa.ts`) **lee el código, no lo ejecuta** — verifica por lectura,
  no por corrida real. Candidato del vault: `fable-judge` (Fable Method — verificación adversarial
  que re-corre cada check reclamado). Adopción = cambio grande multi-módulo → **graduado a Bloque K**
  (spec completo, 2026-07-27), ya no vive en IDEAS.md.

---

### Bloque J — ⚡ Coverage gate en CI: medir y trinquetear la cobertura (hallazgo del vault, 2026-07-27)

**Origen**: consulta al vault sobre mutation testing / coverage gate / QA-por-ejecución
(`MemoriesMD/outputs/2026-07-27-mutation-testing-coverage-gate-qa-ejecutando.md`). Al verificar
contra el repo real salió que **la cobertura nunca se había medido**: no existe `bunfig.toml` y
`ci.yml` corre `bun test` sin `--coverage`.

**Medición base (2026-07-27, suite completa 797 tests / 75 archivos / 13.6s / 0 fail):**

```
Coverage global: 69.41% funcs · 69.44% líneas   (125 archivos fuente, 19.269 líneas)
```

No es cobertura pareja, es **bimodal** — y eso decide dónde vale la pena invertir:

| Zona | Líneas |
|---|---|
| `src/run/*` (executors, middleware, contract, checks) | 76–100%, mayoría >95% |
| `src/spec/*`, `src/skills/*` | 90–100% con huecos puntuales (`skills/fetch.ts` 13%, `spec/draft.ts` 6.7%) |
| `src/dashboard/handlers/*` | 6–42% |
| `src/cli.ts`, `src/agents/sub-agent.ts`, `src/context/compress.ts` | 1.8–17% |

El núcleo del motor está bien testeado. Lo flojo es periferia (dashboard, CLI).

- [ ] **J.1 — ⚡ Coverage gate con umbral-trinquete en el número actual.** Crear `bunfig.toml` con
  `[test] coverage = true` + `coverageThreshold = 0.69` (el valor medido HOY, no uno aspiracional), y
  cambiar `bun test` → `bun test --coverage` en
  [.github/workflows/ci.yml](.github/workflows/ci.yml). Bun trae el umbral nativo — no hace falta
  Stryker, nyc ni ninguna dependencia nueva. **Validación**: el CI falla si la cobertura baja del
  umbral; con el árbol actual, pasa verde sin tocar un solo test.
- **Regla de trinquete (por qué 0.69 y no 0.80)**: el umbral se fija en el número real y solo sube
  cuando la cobertura sube de verdad — nunca se pone una meta aspiracional. Un 80% "porque lo
  recomienda ECC" rompe el CI al día siguiente y termina desactivado, que es peor que no tenerlo.
  Mismo espíritu que [scripts/check-ledger-gate.ts](scripts/check-ledger-gate.ts): gate barato que
  no bloquea salvo regresión real.
- **Nota de alcance (NO es un ítem, no lo adelantes)**: los módulos de 6–42% (`dashboard/handlers/*`,
  `cli.ts`) necesitan tests, no métricas. Se cubren **cuando se toquen por otra razón**, subiendo el
  umbral en el mismo commit. No se abre un bloque de "subir cobertura" por sí solo — sería trabajo
  sin producto detrás.

---

### Bloque K — 🧠 QA que verifica ejecutando, no leyendo (gradúa IDEAS #53, spec escrito 2026-07-27)

**Por qué este bloque es el CORE del producto, no una mejora más.** Carlos fijó la tesis (2026-07-27,
citando a Uncle Bob): *"no leo nada del código de mis agentes; en su lugar los rodeo de restricciones
externas — tests, QA, métricas, mutation testing, cobertura"*. Esa es exactamente la apuesta de
OrchestOS y lo que lo separa de Orca/Hermes (que asumen un humano supervisando en vivo). Auditoría
honesta de hoy: de las 6 restricciones de esa cita, OrchestOS tiene **3**. La que falta y rompe la
premisa entera es que **`qa.ts` LEE el código y opina; no ejecuta nada**. Mientras siga así, el
usuario tampoco puede dejar de leer — evidencia real de esta misma semana: el 500 de `/api/config`
(H.4) y el `<p>` dentro del flex (H.5) los atrapó un humano mirando, no el sistema.

**Estado real del pipeline hoy** (verificado leyendo el código, no asumido):
- `runChecks()` ([checks.ts:83](src/run/checks.ts:83)) SÍ ejecuta (`tsc`, `bun test`, `node --check`)
  y corre ANTES del QA — si falla, el QA nunca gasta tokens. Ese carril está bien.
- `runQA()` ([qa.ts:75](src/run/qa.ts:75)) recibe `description` + `acceptance_criteria` + el
  **contenido de los archivos** y devuelve `{verdict, reason, criteria[]}`. Nunca ve los resultados
  de los checks, nunca ejecuta nada, y su "pass" por criterio es una opinión sin evidencia forzada.
- `defaultChecksFor()` ([checks.ts:32](src/run/checks.ts:32)) puede devolver **cero checks**
  (sin `node_modules`, o outputs que no son `.ts/.js/.html`) — y en ese caso el QA-LLM es el ÚNICO
  gate, sin que el juez sepa que nada se verificó mecánicamente.

**Referencia**: `fable-judge` (Fable Method, github.com/Sahir619/fable-method) — verificación
adversarial de trabajo terminado. Hallazgo de diseño directamente aplicable: **"artefacto forzado en
punto de decisión, no regla en prosa"** — los modelos económicos cumplen una regla cuando es un
campo OBLIGATORIO del reporte, no cuando es una viñeta en el prompt.

**Orden deliberado**: K.1→K.3 son baratos, independientes entre sí y no tocan el flujo del harness —
cada uno cierra solo. K.4 es el cambio grande y va al final, con su propio gate.

- [x] **K.1 — ⚡ (2026-07-28) Evidencia forzada por criterio en el veredicto QA.** Hoy cada entrada de
  `criteria[]` es `{text, pass}` — una opinión sin respaldo. Extender `QACriterionResult` a
  `{text, pass, evidence}` donde `evidence` es una **cita literal** (`file` + `excerpt`) de los
  archivos escritos que respalda el veredicto de ESE criterio. Reglas duras en el prompt del system
  (`qa.ts`, rama `hasCriteria`): (a) `evidence` es obligatorio cuando `pass: true`; (b) si el juez no
  puede citar una porción real del archivo que satisfaga el criterio, **debe** marcar `pass: false`;
  (c) en `parseVerdict()`, un criterio con `pass: true` y `evidence` ausente/vacío se fuerza a
  `pass: false` (mismo mecanismo defensivo que ya existe ahí: "if any criterion failed, force verdict
  to fail regardless of what LLM said"). Persistir la evidencia en `qa_reason`/`criteria` como ya se
  hace. **Validación**: un test donde el juez mockeado devuelve `pass:true` sin evidencia → el
  veredicto final debe ser `fail`. Implementado en [qa.ts](src/run/qa.ts): `QACriterionResult`
  admite `{file, excerpt}`, el prompt lo exige para todo `pass: true`, y `parseVerdict()` fuerza
  el criterio a `pass: false` si la evidencia falta o está vacía. Tests de regresión en
  [qa-judge.test.ts](src/__tests__/qa-judge.test.ts): evidencia ausente falla y evidencia literal
  válida se conserva. 9 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **K.2 — ⚡ (2026-07-28) Los resultados de checks entran al prompt del QA.** Hoy el juez no sabe qué se
  ejecutó. Pasar `checksResults: CheckResult[]` a `runQA()` (el harness ya los tiene en
  `checksResults` justo antes de llamarlo) y renderizarlos en el `userContent` como un bloque
  `## Checks executed` con `cmd` + `exitCode` de cada uno. **Lo importante es el caso vacío**: cuando
  la lista está vacía, el bloque debe decir explícitamente que **NINGUNA verificación mecánica corrió**
  y el system prompt debe instruir que en ese caso el juez sea máximamente escéptico (sin checks, un
  `pass` se apoya solo en lectura). No cambia el flujo: los checks ya corren antes y ya cortan si
  fallan; esto solo deja de ocultarle al juez lo que el sistema ya sabe. **Validación**: dos tests —
  con checks y sin checks — asertando que el `userContent` enviado al provider contiene el bloque
  correcto en cada caso (mockear el provider vía el parámetro `opts.provider`, que ya existe).
  Implementado: `runQA()` recibe `checksResults` desde el harness y agrega `## Checks executed`
  con comando + `exitCode`; si está vacío, declara explícitamente que **NINGUNA verificación
  mecánica corrió** y el system prompt ordena máxima cautela. Tests en [qa-judge.test.ts](src/__tests__/qa-judge.test.ts).
  11 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **K.3 — ⚡ (2026-07-28) Gate anti-test-vacío.** Un `.test.ts` que no asevera nada pasa `bun test` igual —
  es la trampa más barata para un executor económico, y `defaultChecksFor()` hoy la premia (corre
  `bun test <archivo>` y da verde). Nuevo check en `checks.ts`: para cada output `*.test.ts`/`*.test.tsx`
  que el agente escribió, contar aserciones reales (`expect(`, `assert`, `.toBe`, `.toEqual`, etc. —
  búsqueda textual, no AST: barato y suficiente). **Cero aserciones → el check falla** con mensaje
  explícito ("test file has no assertions — passing vacuously"). Emitirlo desde `defaultChecksFor()`
  junto a los que ya genera. **Validación**: fixture con un test vacío (`it('x', () => {})`) → check
  falla; fixture con un test real → pasa. Implementado con búsqueda textual barata en
  [check-test-assertions.ts](scripts/check-test-assertions.ts), conectado desde [checks.ts](src/run/checks.ts)
  y cubierto en [checks.test.ts](src/__tests__/checks.test.ts). 19 tests · 0 fail · `tsc --noEmit`
  limpio.
- [x] **K.4a — ⚡ (2026-07-28) Cita literal obligatoria en la evidencia del criterio.** Auditoría
  del K.4 original (2026-07-28, [[feedback-planificar-cambios-grandes]]): la premisa de que "el juez
  re-corre checks sobre el estado final" ya estaba resuelta — `runChecks()` (harness.ts:528-533) YA
  corre sobre `ctx.effectiveRoot` real, post-`enforceContract()`, y nada muta el estado entre eso y
  el merge; re-correrlos de nuevo hubiera sido puro gasto redundante. El contenido que ve el QA
  también es ya el real (`contractResult.written`, único punto de escritura a disco — el motor
  agéntico solo bufferea en memoria). El hueco real y concreto: K.1 forzaba `pass:false` solo si
  `evidence` venía vacía/ausente, nunca verificaba que el excerpt fuera una cita LITERAL del
  archivo — un juez puede alucinar una cita plausible que no existe. Fix en `parseVerdict()`
  ([qa.ts](src/run/qa.ts)): un criterio con `pass:true` cuyo `evidence.excerpt` no es substring
  literal del contenido real de `evidence.file` (vía `written: FileChange[]`, ya disponible) se
  fuerza a `pass:false` — mismo mecanismo defensivo de K.1, sin LLM adicional. Cierra la parte
  mecánica de K.4 con costo cero. Test de regresión en
  [qa-judge.test.ts](src/__tests__/qa-judge.test.ts): excerpt fabricado → verdict forzado a `fail`.
  878 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **K.4b — 🧠 (2026-07-28) Segundo juez adversarial, opt-in.** Gate destrabado con evidencia
  concreta antes de arrancar (no "adelantarlo igual"): 3 tests adversariales sintéticos
  (`qa-judge.test.ts`, "K.4a limitation") probaron que K.4a deja pasar `pass:true` con evidencia
  LITERAL pero de contexto equivocado, código muerto/inalcanzable, o contradictoria — confirma que
  K.1/K.4a solo garantizan presencia del string, no validez semántica. Implementado
  `runAdversarialQA()` ([qa.ts](src/run/qa.ts)): re-evalúa desde cero (sin ver el veredicto/evidencia
  del primer QA, para no anclarse) con framing explícitamente adversarial, devuelve
  `VERIFIED`/`CAVEATS`/`REFUTED`. Wireado en [harness.ts](src/run/harness.ts) entre
  `qa.verdict === 'pass'` y `mergeWorktreeBack()`, sobre el mismo `ctx.effectiveRoot` (sin copia
  limpia — el worktree ya es el estado real aislado, decisión (a)). `REFUTED` downgradea
  `qa.verdict` a `'fail'` y reusa EXACTAMENTE el path de revert/retry/exhaución existente, sin
  contador de retry paralelo (decisión (c)). `CAVEATS` no bloquea ni consume retry, solo se
  persiste en 2 columnas nuevas (`adversarial_verdict`, `adversarial_reason`, migración segura vía
  `safeAddColumn`) para que un humano lo vea (decisión (b) — bloquear reintroduciría la clase de
  bug que D3 ya arregló). **Opt-in** vía `orcheConfig.adversarialQA: true` (default: desactivado,
  cero cambio de comportamiento ni de costo si no se activa) — dobla el gasto de QA por tarea que
  pasa, costo real documentado en el schema y en `orchestos.config.yaml` scaffold. 5 tests nuevos en
  [harness-adversarial-qa.test.ts](src/__tests__/harness-adversarial-qa.test.ts) cubriendo
  desactivado/REFUTED/CAVEATS/VERIFIED/no-corre-si-QA-ya-falló. 886 tests · 0 fail · `tsc --noEmit`
  limpio.
- [x] **K.5 — ⚡ (2026-07-28) Spike de mutation testing (medición, NO adopción).** Gradúa SOLO la parte de
  medición de [IDEAS #54](IDEAS.md) — la adopción como gate sigue siendo backlog ahí. Verificar los
  dos supuestos que hunden o salvan el cálculo, y **reportar números, no instalar nada permanente**:
  (1) ¿StrykerJS puede correr contra `bun test` vía su runner `command`? (sus runners nativos son
  Jest/Mocha/Jasmine/Karma/Vitest — `bun test` NO está); (2) con el runner `command` (que re-corre la
  suite COMPLETA por cada mutante, sin `coverageAnalysis`), ¿cuánto tarda una corrida acotada a
  `src/run/` solamente? Medir con la suite real (~15s hoy). **Entregable**: un comentario en este
  ítem con los dos números reales medidos, no una implementación. Si el costo resulta inviable
  (probable: se mide en horas), decirlo con el número medido y parar ahí.
  **Resultado medido, sin cambios permanentes en el repo**: StrykerJS `0.35.1` sí puede invocar
  `bun test` mediante `testRunner: 'command'` + `commandRunner.command` en un config temporal. La
  suite normal completa pasó `747/747` en `5.747 s` (`5.668 s` dentro de la copia inicial de
  Stryker tras excluir las 3 pruebas de integración A.5 incompatibles con su copia temporal). La
  corrida completa no produjo mutation score: abortó después de la suite inicial porque el mutador
  ES5 incluido por defecto no puede parsear los 33 archivos TypeScript de `src/run/` (`Unexpected
  token`). Una comprobación temporal del mutador moderno sugerido por Stryker (`stryker-javascript-mutator`)
  tardó `458.7 s` resolviendo dependencias y terminó sin ejecutable utilizable vía `bunx`; no se
  instaló en el proyecto. Conclusión: el runner es compatible, pero medir `src/run/` requiere una
  toolchain/mutador TS permanente y una revisión de compatibilidad de tests; el coste real de la
  corrida completa no es medible honestamente con este spike y no se adopta mutation testing.

### Cadena K.6 — Integración correcta de mutation testing con StrykerJS + Bun (orden obligatorio, 2026-07-28)

**Propósito**: el K.5 anterior fue un spike válido sobre el paquete antiguo `stryker@0.35.1`,
pero no es el veredicto final sobre StrykerJS moderno. Este encadenamiento queda documentado para
TODOS los LLM (Claude, Codex, DeepSeek y cualquier otro): no se salta un paso, no se instala una
toolchain permanente antes de validar el paso anterior y no se convierte mutation testing en gate
global sin evidencia de costo y estabilidad.

**Decisión técnica de partida**:
- StrykerJS moderno para TypeScript, no el paquete antiguo `stryker@0.35.1` usado en K.5.
- Runner `command` con Bun, porque Bun no tiene runner nativo de Stryker ni emite TAP documentado.
- `coverageAnalysis: off` durante el piloto: el runner command no puede mapear cobertura por test.
- TypeScript checker oficial activado para descartar mutantes que solo rompen tipos.
- Mutación por módulo y test dedicado, no `bun test` completo desde el primer intento.

**Regla de cadena**: cada paso debe dejar evidencia en este bloque antes de abrir el siguiente.
Si un paso falla, se documenta la causa y se detiene la cadena; no se compensa ampliando el alcance,
ocultando tests, bajando thresholds ni instalando otra herramienta por intuición.

- [x] **K.6.1 — ⚡ Inventario y selección de toolchain (2026-07-28).** Inventario local confirmado:
  Bun `1.3.14`, Node `v22.23.1`, TypeScript `6.0.3` en `node_modules` y `tsconfig.json` con
  `moduleResolution: bundler`, `strict`, `noEmit` y `allowImportingTsExtensions`. El test piloto
  `bun test src/__tests__/qa-judge.test.ts --timeout 30000` pasó con `15 pass`, `0 fail` y
  `33 expect() calls`.

  **Selección:** StrykerJS moderno `@stryker-mutator/core@9.6.1` y
  `@stryker-mutator/typescript-checker@9.6.1`. Ambos declaran Node `>=20.0.0`, por lo que el runtime
  disponible es compatible. No se añade un paquete mutador separado: StrykerJS moderno muta
  JavaScript/TypeScript integrado. No hay runner Bun nativo documentado; se usará `testRunner: command`
  y Bun como proceso hijo. El checker oficial usará `checkers: ['typescript']` y `tsconfigFile`.

  **Config propuesta para K.6.2 (todavía no creada):**
  `mutate: ['src/run/qa.ts']`, `commandRunner.command: 'bun test src/__tests__/qa-judge.test.ts --timeout 30000'`,
  `coverageAnalysis: 'off'`, `checkers: ['typescript']`, `tsconfigFile: 'tsconfig.json'`,
  `concurrency: 1`, `timeoutMS: 120000` y reporter `clear-text`. Se omite `buildCommand` inicialmente
  porque el proyecto usa Bun JIT y `tsconfig.json` tiene `noEmit: true`; se reconsiderará solo si el
  piloto demuestra que el checker necesita una compilación previa.

  **Paquetes planificados:** mover/asegurar `typescript` como `devDependency` del proyecto e instalar
  los dos paquetes Stryker anteriores. **No se modificó `package.json`, `bun.lock` ni la configuración
  permanente en este paso.** Resultado: toolchain seleccionada y lista para K.6.2; la compatibilidad
  completa del ciclo Stryker↔Bun queda deliberadamente pendiente de la ejecución real del piloto.
- [x] **K.6.2 — ⚡ Piloto mínimo en `qa.ts` (2026-07-28).** Toolchain instalada:
  `@stryker-mutator/core@9.6.1`, `@stryker-mutator/typescript-checker@9.6.1` y TypeScript `6.0.3`
  como `devDependencies`. Configuración en `stryker.config.mjs`; comando reproducible:
  `bun run mutation:qa` (`stryker run stryker.config.mjs`). Alcance exacto: solo `src/run/qa.ts`,
  solo `src/__tests__/qa-judge.test.ts`, `testRunner: command`, Bun `1.3.14`,
  `coverageAnalysis: off`, checker TypeScript y `concurrency: 1`.

  **Resultado:** `275` mutantes totales; `32 killed`; `145 survived`; `98 CompileError`; `0 timeout`;
  score Stryker `18.08%` (`32 / 177` mutantes ejecutables); duración `2m26s`. El dry run pasó y el
  test base fue `15 pass`, `0 fail`, `33 expect() calls`; después del proceso completo,
  `tsc --noEmit` también pasó. El reporte JSON se genera en `reports/mutation/mutation.json` y su
  directorio está ignorado por Git.

  **Sobrevivientes por mutador:** `StringLiteral` 66, `Regex` 21, `ConditionalExpression` 20,
  `BlockStatement` 10, `MethodExpression` 7, `ArrowFunction` 5, `EqualityOperator` 5,
  `ArrayDeclaration` 4, `BooleanLiteral` 3, `ArithmeticOperator` 2 y `LogicalOperator` 2.
  La lista completa (IDs y ubicaciones) queda en el JSON del reporte; no se oculta detrás del score.
  Los `98 CompileError` son mutantes que el checker TypeScript rechazó y no se cuentan como
  sobrevivientes. El primer comando probado con `--config` falló por opción CLI inválida; se corrigió
  usando el archivo como argumento posicional, sin cambiar el alcance.

  **Decisión:** K.6.2 es técnicamente viable, pero el score es bajo y el costo por ejecución es alto;
  no se establece threshold ni gate. K.6.3 queda pendiente de revisión y autorización explícita.

### Cadena K.6.2-R — Hacer representativo el score de `qa.ts` (orden obligatorio, 2026-07-28)

**Motivo:** el `18.08%` no debe interpretarse todavía como calidad final de `qa.ts`. El test usado
(`src/__tests__/qa-judge.test.ts`) cubre principalmente `runQA` y la resolución del juez, pero el
módulo también contiene snapshot/restore, cálculo de diffs y el juez adversarial. Por eso muchos de
los `145 survived` pueden ser código exportado sin tests, no mutantes que revelen un bug real.

**Regla para todos los LLM:** no corregir producción solo para matar mutantes, no excluir mutantes
sin justificar equivalencia y no fijar un threshold antes de completar esta cadena. Cada paso debe
dejar tests, resultado de Bun y evidencia de mutation testing en este bloque antes de abrir el siguiente.

**Orden de trabajo:**

- [x] **K.6.2-R1 — Mapa de superficie (2026-07-28).** Comando de evidencia:
  `jq` sobre `reports/mutation/mutation.json`, complementado con `nl -ba src/run/qa.ts` y
  `rg -n "it\\(" src/__tests__/qa-judge.test.ts`. Superficie y estado:

  | Función | Tests directos actuales | Sobrevivientes asignados |
  |---|---:|---:|
  | `snapshotContents` | 0 | 8 |
  | `restoreContents` | 0 | 8 |
  | `computeFileDiffs` | 0 | 1 |
  | `runQA` | 7 | 35 |
  | `parseVerdict` | 0 (solo indirectos vía `runQA`) | 25 |
  | `runAdversarialQA` | 0 | 46 |
  | `parseAdversarialVerdict` | 0 (solo indirectos, actualmente ninguno) | 22 |
  | **Total** | **7 directos sobre `qa.ts`** | **145** |

  `MAX_RETRIES` no genera mutantes sobrevivientes. Diagnóstico: el test piloto no representa toda la
  superficie de `qa.ts`; R2 debe comenzar por snapshots, R3 por diffs y R5 debe crear cobertura para
  el juez adversarial. No se modificó producción ni se excluyó ningún mutante.
- [x] **K.6.2-R2 — Tests de snapshots (2026-07-28).** Se creó
  `src/__tests__/qa-core.test.ts` con cobertura directa para `snapshotContents` y `restoreContents`:
  archivo existente, archivo ausente, restauración de contenido, eliminación de archivo creado y
  archivo ausente que no debe intentar eliminarse. Comandos ejecutados:
  `bun test src/__tests__/qa-core.test.ts --timeout 30000`,
  `bun test src/__tests__/qa-core.test.ts src/__tests__/qa-judge.test.ts --timeout 30000`,
  `bun run typecheck` y `bun run mutation:qa`.

  Resultado final: `3 pass` en el test R2, typecheck limpio, `44 killed`, `133 survived`,
  `98 CompileError`, `0 timeout`, score `24.86%` y duración `2m29s`. Frente al baseline de K.6.2
  (`32 killed`, `145 survived`, `18.08%`), R2 mató `12` mutantes adicionales y elevó el score
  `6.78` puntos. Los mutantes de `snapshotContents` y `restoreContents` sobrevivientes quedaron en
  `0`; permanece `1` mutante de `computeFileDiffs`, reservado para R3. No se modificó producción.
- [x] **K.6.2-R3 — Tests de diff (2026-07-28).** Se amplió
  `src/__tests__/qa-core.test.ts` con cuatro casos directos de `computeFileDiffs`: archivo agregado,
  archivo modificado, contenido idéntico y diff unificado con ruta/contenido correcto. La aserción
  del archivo agregado también verifica que no se invente contenido previo.

  Comandos ejecutados: `bun test src/__tests__/qa-core.test.ts --timeout 30000`,
  `bun run typecheck` y `bun run mutation:qa`. Resultado: `7 pass`, `0 fail`, `19 expect() calls`,
  typecheck limpio, `45 killed`, `132 survived`, `98 CompileError`, `0 timeout`, score `25.42%`
  y duración `2m24s`. Frente a R2 (`44 killed`, `24.86%`), R3 mató `1` mutante adicional.
  Verificación específica: `0` sobrevivientes en las líneas de `computeFileDiffs`; no se modificó
  producción.
- [x] **K.6.2-R4 — Tests completos de `runQA` (2026-07-28).** Se añadieron tests directos en
  `src/__tests__/qa-core.test.ts` para: ejecución sin criterios con múltiples archivos, JSON inválido
  (fail-closed), JSON fenced, criterio pass con evidencia literal y múltiples criterios donde una
  evidencia apunta a una ruta incorrecta. Los casos de evidencia ausente, excerpt falso y criterios
  pass/fail ya existentes en `qa-judge.test.ts` quedaron incluidos en el mismo piloto.

  Comandos ejecutados: `bun test src/__tests__/qa-core.test.ts --timeout 30000`,
  `bun run typecheck` y `bun run mutation:qa`. Resultado: `11 pass`, `0 fail`, `30 expect() calls`,
  typecheck limpio, `53 killed`, `124 survived`, `98 CompileError`, `0 timeout`, score `29.94%`
  y duración `2m24s`. Frente a R3 (`45 killed`, `25.42%`), R4 mató `8` mutantes adicionales.
  No quedan sobrevivientes en snapshots, restauración ni diffs; los restantes se concentran en
  formatting/prompts de `runQA` (`34`) y parsers aún no cubiertos (`parseVerdict: 22`, juez
  adversarial: `46` y su parser: `22`). No se modificó producción.
- [x] **K.6.2-R5 — Tests de `runAdversarialQA` (2026-07-28).** Se añadieron cuatro casos directos
  en `src/__tests__/qa-core.test.ts`: estados `VERIFIED`, `CAVEATS` desde JSON fenced, `REFUTED` y
  respuesta no parseable con fail-safe a `REFUTED`.

  Comandos ejecutados: `bun test src/__tests__/qa-core.test.ts --timeout 30000`,
  `bun run typecheck` y `bun run mutation:qa`. Resultado: `15 pass`, `0 fail`, `38 expect() calls`,
  typecheck limpio, `59 killed`, `118 survived`, `98 CompileError`, `0 timeout`, score `33.33%`
  y duración `2m23s`. Frente a R4 (`53 killed`, `29.94%`), R5 mató `6` mutantes adicionales.
  La cobertura funcional del parser quedó verificada; los `46` sobrevivientes asignados a la
  construcción de prompt de `runAdversarialQA` no se consideran automáticamente defectos: los tests
  actuales verifican el veredicto observable, no cada string interno. Quedan para el triage R6 junto
  con los equivalentes de formato. No se modificó producción.
- [x] **K.6.2-R6 — Repetición y triage (2026-07-28).** Se ejecutaron `bun test --timeout 30000`
  (con acceso ampliado porque el harness usa `~/.orchestos/db.sqlite`), `bun run typecheck` y
  `bun run mutation:qa`. La suite completa terminó con `903 pass`, `0 fail` y `2044 expect() calls`;
  el typecheck quedó limpio. La integración específica de harness cubrió `14 pass`, `0 fail` y
  `76 expect() calls`, incluyendo `harness.ts` → `runQA`, provider fallido, respuesta malformada,
  retry, criterios múltiples, `VERIFIED`, `CAVEATS`, `REFUTED` y propagación del veredicto.

  Stryker (`@stryker-mutator/core` `9.6.1`): `275` mutantes, `84 killed`, `93 survived`,
  `98 CompileError`, `0 timeout`, score `47.46%`, duración `2m28s`. No quedan sobrevivientes en
  `snapshotContents`, `restoreContents` ni `computeFileDiffs`. Los sobrevivientes restantes se
  clasifican así: `55` `StringLiteral` de prompts/formato, `22` `Regex` y `16` mutantes de
  expresiones/arrays/operadores; los primeros son contrato interno solo si un consumidor exige el
  texto exacto, y los demás fueron revisados contra los caminos observables de parseo y se consideran
  equivalentes o no críticos para este baseline. Los `98 CompileError` fueron auditados por muestra:
  son mutantes que producen tipos inválidos y son rechazados por el checker oficial de TypeScript,
  no fallos de configuración. No se cambió producción, no se excluyeron mutadores y no se fijó
  threshold/gate. La decisión de ampliar cobertura o aceptar/documentar equivalentes queda para R7.
- [ ] **K.6.2-R7 — Endurecimiento de comportamientos críticos (cadena obligatoria, iniciada
  2026-07-28).** El objetivo no es perseguir `100%`, sino matar mutantes que representen regresiones
  reales en la decisión de QA. No se añadirá cobertura solo para strings internos de prompts, formato
  equivalente o mutantes que el checker de TypeScript ya invalida.
  - [x] **R7.1 — Parsers de veredictos (2026-07-28).** Se añadió en `src/__tests__/qa-core.test.ts`
    la prueba de respuesta sin `criteria` y respuesta truncada cuando hay múltiples criterios. Se
    corrigió `parseVerdict` para exigir exactamente un resultado por criterio; si falta el array o no
    coincide su cardinalidad, fuerza `fail` aunque el proveedor declare `pass`. Esto cierra una vía de
    falso positivo real, no un detalle de formato.

    Verificación: `bun test src/__tests__/qa-core.test.ts --timeout 30000` (`22 pass`, `0 fail`,
    `57 expect() calls`), `bun test src/__tests__/harness-adversarial-qa.test.ts
    src/__tests__/harness-evidence.test.ts src/__tests__/harness-retry.test.ts --timeout 30000`
    (`14 pass`, `0 fail`, `76 expect() calls`), `bun run typecheck` limpio y `bun run mutation:qa`
    (`285` mutantes, `87 killed`, `94 survived`, `104 CompileError`, `0 timeout`, score `48.07%`,
    `2m31s`). Los mutantes adicionales corresponden a la nueva lógica; los sobrevivientes restantes
    siguen concentrados en prompts/formato y equivalentes de parseo ya clasificados en R6.
  - [x] **R7.2 — Ejecución QA (2026-07-28).** Se reforzaron `runQA` y `runAdversarialQA` para
    rechazar de forma segura JSON válido que no sea un objeto (`null` o array), además de conservar
    la cobertura de criterios vacíos/múltiples, archivos escritos, respuestas inválidas y estados
    `PASS`, `FAIL`, `VERIFIED`, `CAVEATS` y `REFUTED`. El provider fallido, el retry y la propagación
    del veredicto quedaron verificados en la integración existente del harness.

    Verificación: `bun test src/__tests__/qa-core.test.ts --timeout 30000` (`24 pass`, `0 fail`,
    `63 expect() calls`), `bun test src/__tests__/harness-adversarial-qa.test.ts
    src/__tests__/harness-evidence.test.ts src/__tests__/harness-retry.test.ts --timeout 30000`
    (`14 pass`, `0 fail`, `76 expect() calls`), `bun run typecheck` limpio y `bun run mutation:qa`
    (`313` mutantes, `103 killed`, `96 survived`, `114 CompileError`, `0 timeout`, score `51.76%`,
    `2m46s`). El aumento de sobrevivientes absolutos proviene del crecimiento del conjunto mutado;
    las ramas nuevas de validación de forma fueron cubiertas. No se añadieron exclusiones ni threshold.
  - [x] **R7.3 — Integración del harness (2026-07-28).** La auditoría confirmó que `harness.ts`
    revierte/reintenta ante QA fallido, degrada el resultado ante adversarial `REFUTED`, permite
    `CAVEATS` sin bloqueo, persiste `VERIFIED`/`CAVEATS` y registra fallos de provider, parseo,
    contrato y checks. No faltó una prueba de integración nueva: los casos existentes cubren estos
    caminos y se ejecutaron tras los cambios de R7.2.

    Evidencia: `bun test src/__tests__/harness-adversarial-qa.test.ts
    src/__tests__/harness-evidence.test.ts src/__tests__/harness-retry.test.ts --timeout 30000`:
    `14 pass`, `0 fail`, `76 expect() calls`; `bun run typecheck` limpio.
  - [x] **R7.4 — Medición y triage final (2026-07-28).** Se ejecutaron la suite completa, typecheck
    y mutation QA después de R7.1-R7.3. Resultado de suite: `910 pass`, `0 fail`, `2060 expect() calls`
    en `86` archivos; `tsc --noEmit` limpio. Resultado Stryker vigente sobre `src/run/qa.ts`:
    `313` mutantes, `103 killed`, `96 survived`, `114 CompileError`, `0 timeout`, score `51.76%`,
    duración `2m46s`.

    Triage: los mutantes funcionales de cardinalidad de criterios y forma JSON quedaron cubiertos;
    los `96` sobrevivientes restantes siguen concentrados en strings/formato de prompts, regex y
    equivalentes de parseo ya revisados, mientras que los `114 CompileError` son mutantes rechazados
    por TypeScript. No se añadieron exclusiones, no se cambió producción fuera de las validaciones
    fail-safe y no se fijó threshold/gate.
  - [ ] **R7.5 — Decisión.** Con la evidencia de R7.1-R7.4 decidir si el baseline es suficiente o si
    se continúa con K.6.3 para `checks.ts`, `sandbox-policy.ts` y `graph-runner.ts`. La decisión debe
    ponderar riesgo cubierto, estabilidad integrada y costo medido, no el porcentaje bruto.

    Auditoría previa (2026-07-28): se revisaron individualmente los `41` sobrevivientes que no son
    `StringLiteral`. Los `Regex` de las dos funciones parser son variantes equivalentes del extractor
    JSON en los casos soportados; los operadores de arrays/numeración afectan solo la construcción del
    prompt; `trim`/`slice` afectan mensajes o entradas que ya fallan; y las condiciones restantes no
    permiten convertir una respuesta inválida en un veredicto aprobado. No queda evidencia de un
    sobreviviente que altere `pass/fail`, `VERIFIED/CAVEATS/REFUTED`, retry, rollback o persistencia.
    Los `55` `StringLiteral` restantes tampoco justifican snapshots de cada prompt salvo que se defina
    explícitamente el texto como contrato externo. Esta auditoría no cierra R7.5: Carlos debe decidir
    si acepta el baseline funcional de QA o continúa con la expansión por módulos de K.6.3.

**Memoria obligatoria:** al cerrar cada R1-R7 escribir fecha, comando exacto, conteos, tests creados,
mutantes afectados, sobrevivientes restantes y decisión. El resumen final debe permanecer aquí para
Claude, Codex y cualquier otro LLM; no depender de la conversación.
- [ ] **K.6.3 — ⚡ Expansión controlada por módulo.** Repetir el patrón, uno por uno y sin paralelizar,
  para `checks.ts`→`checks.test.ts`, `sandbox-policy.ts`→`sandbox-policy.test.ts` y
  `graph-runner.ts`→`graph-runner.test.ts`. Cada módulo debe tener su propio resultado; no aceptar
  un score agregado que oculte qué módulo tiene tests débiles.
- [ ] **K.6.4 — ⚡ Benchmark acotado de `src/run/`.** Solo después de que K.6.2 y K.6.3 pasen,
  medir el conjunto completo de `src/run/` con `concurrency` controlada. Entregable: duración real,
  cantidad de mutantes, score global y proyección del costo en CI. Si la corrida es inviable, queda
  como métrica manual/nocturna y no se implementa como gate de commit.
- [ ] **K.6.5 — 🔍 Decisión de adopción.** Revisar evidencia de K.6.1-K.6.4 y decidir entre:
  (a) comando manual, (b) nightly/CI, (c) gate solo para módulos críticos, o (d) no adoptar todavía.
  Esta decisión no la toma un LLM por su cuenta y no se gradúa a IDEAS #54 como gate hasta que Carlos
  la confirme explícitamente.

**Memoria obligatoria para cualquier LLM**: cuando un paso se cierre, actualizar aquí el checkbox
con fecha, comando exacto, versión, números medidos, fallos y decisión. Al cerrar K.6.5, copiar el
resumen final a `DONE.md` y a la memoria compartida del proyecto; no dejar la cadena solo en una
conversación.

**Nota de delegación para esta pasada (Carlos, 2026-07-27)**: por cupo semanal de Claude (74% un
lunes, reset el jueves), Carlos va a trabajar hoy/mañana principalmente con Codex. K.1, K.2, K.3 y
K.5 están escritos como spec ejecutable a propósito — el diseño ya está decidido acá, son mecánicos,
y Codex puede tomarlos sin Claude en el loop. **K.4 NO**: es el diferenciador central del producto y
tiene 3 decisiones de diseño sin resolver; si sale mal diseñado, sale mal el CORE.

---

## MES 23 — L: línea base profesional de seguridad (nuevo, 2026-07-28)

**Motivo:** seguridad no se ha tratado todavía como un frente propio. OrchestOS no es solo un
dashboard: lee y escribe archivos del usuario, ejecuta comandos, crea worktrees, invoca CLIs/LLMs,
recibe contenido externo y almacena API keys/configuración. Por lo tanto, el límite de confianza no
es únicamente la UI: una tarea, archivo, skill, respuesta de modelo o URL puede ser entrada hostil.

**Estado verificado antes de abrir este bloque:** ya existen controles puntuales para SSRF
([src/dashboard/ssrf.ts](src/dashboard/ssrf.ts)), sandbox/worktrees, límites de tools, sanitización
de HTML/XSS y separación de datos externos en OCR. También existe [sandbox-policy.test.ts](src/__tests__/sandbox-policy.test.ts)
y [ssrf.test.ts](src/__tests__/ssrf.test.ts). Eso es una base útil, pero no equivale todavía a una
auditoría de seguridad: no hay threat model formal, matriz de activos/amenazas, revisión completa de
autenticación/exposición de red, ni gate repetible para secretos/dependencias.

**Objetivo:** establecer una baseline de seguridad adecuada para una herramienta local de desarrollo,
sin fingir que eso la convierte automáticamente en un servicio multiusuario o en un producto con
certificación. Si algún día el dashboard se expone fuera de localhost o se vuelve multiusuario, se
debe abrir un bloque separado de seguridad de producción; no ampliar estos controles por intuición.

### L.0 — 🧠 Threat model y límites de confianza (prerequisito)

- [ ] Identificar activos y daños: API keys/tokens, código fuente, archivos fuera del proyecto, DB,
  prompts/contexto, costos, historial de runs y capacidad de ejecutar comandos.
- [ ] Documentar actores y entradas no confiables: usuario local, proceso local comprometido,
  tarea/skill importada, contenido web, imagen/OCR, salida de LLM y CLI externo.
- [ ] Dibujar los límites entre dashboard HTTP, CLI, filesystem, SQLite, subprocesses, proveedores
  externos y worktrees. Para cada límite, registrar autorización, validación, aislamiento y logging.
- [ ] Entregable: `docs/security-threat-model.md` con riesgos clasificados por impacto/probabilidad,
  controles existentes, gaps y decisión explícita de qué queda fuera de alcance.

### L.1 — ⚡ Inventario de superficie y secretos

- [ ] Inventariar endpoints del dashboard, comandos CLI, tools del chat, subprocesses, rutas de
  filesystem, variables de entorno y archivos de configuración que puedan contener secretos.
- [ ] Añadir un check automatizado que detecte secretos accidentales en archivos generados/diffs
  (API keys conocidas, tokens, private keys y credenciales), con fixtures positivos y negativos; no
  imprimir el valor encontrado en logs ni en el mensaje de error.
- [ ] Verificar que logs, `runs`, diagnósticos, errores de proveedores y exports no persistan ni
  expongan API keys, headers `Authorization`, prompts sensibles o contenido fuera de scope.
- [ ] Documentar rotación/revocación y manejo local de keys. No inventar cifrado propio: si se
  requiere protección en reposo, dejar explícita la decisión de keychain del sistema o mecanismo
  equivalente antes de implementarlo.

### L.2 — 🧠 Autenticación, exposición de red y CSRF

- [ ] Confirmar y documentar el modelo de despliegue: dashboard solo localhost y usuario único, o
  accesible desde LAN/internet. Si el proceso escucha fuera de loopback, exigir decisión explícita
  de autenticación antes de habilitarlo.
- [ ] Para el modelo local: bind explícito a loopback, advertencia visible si se cambia el host,
  rechazo de configuración insegura y pruebas que confirmen que no queda expuesto accidentalmente.
- [ ] Para cualquier exposición no-local: autenticación fuerte, autorización por operación, protección
  CSRF para mutaciones, cookies/headers seguros, rate limits y auditoría de acciones. Este ítem no se
  considera cerrado con un simple token fijo en la URL.
- [ ] Tests negativos: endpoint mutador sin credencial, credencial inválida, origen no permitido,
  replay de petición y usuario sin permiso para proyecto/ruta.

### L.3 — ⚡ Filesystem, worktrees y ejecución de comandos

- [ ] Crear una matriz de rutas permitidas por operación y probar traversal (`../`, rutas absolutas,
  encoded traversal), symlinks, junctions, paths fuera del proyecto, archivos especiales y cambios
  de `cwd`.
- [ ] Verificar que contract, sandbox y tools aplican la misma política; ningún path declarado por
  una tarea o devuelto por un LLM debe ampliar silenciosamente el alcance autorizado.
- [ ] Auditar cada `Bun.spawn`/CLI: argumentos como arrays (sin shell interpolation), `cwd` validado,
  entorno mínimo, timeout, límites de stdout/stderr, señales y limpieza de procesos hijos.
- [ ] Tests de regresión para command injection, variables de entorno heredadas, escape del worktree,
  proceso que no termina y race conditions de cleanup. El test debe demostrar el rechazo observable,
  no solo inspeccionar strings del código.

### L.4 — ⚡ SSRF, contenido externo y prompt injection

- [ ] Mantener SSRF como defensa en profundidad: bloquear loopback, redes privadas/link-local,
  metadata endpoints, esquemas no HTTP(S), redirecciones peligrosas y resolución DNS que cambie de
  destino entre validación y conexión.
- [ ] Añadir casos para IPv6, DNS rebinding, redirects, puertos no estándar, credenciales embebidas,
  URLs con encoding ambiguo y límites de tamaño/tiempo/respuesta.
- [ ] Tratar web, OCR, archivos importados y outputs de herramientas como **datos**, nunca como
  instrucciones con autoridad. Probar inyección en cada canal que alimenta prompts y verificar que
  no puede cambiar tools, paths, modelo, permisos ni criterios de aceptación.
- [ ] Definir allowlist/origen y límites de fetch antes de añadir nuevas fuentes externas.

### L.5 — ⚡ SQLite, configuración y privacidad

- [ ] Probar migraciones desde DB vacía, DB de cada versión relevante, columnas faltantes,
  constraints, índices/FTS y rollback ante fallo; nunca borrar datos como estrategia de migración.
- [ ] Auditar queries para confirmar parametrización, límites de tamaño, manejo de corrupción y
  concurrencia entre dashboard/CLI/subprocesos. Añadir backup/export y procedimiento de recuperación
  documentado antes de declarar la DB confiable.
- [ ] Clasificar qué datos se guardan (código, prompts, resultados, costos, errores) y ofrecer una
  política clara de retención/borrado. Los exports y diagnósticos deben respetar esa clasificación.

### L.6 — 🔍 Gate de seguridad y operación

- [ ] Ejecutar la matriz completa de pruebas negativas, typecheck, suite, coverage y auditoría de
  dependencias desde un comando reproducible; el gate debe fallar ante una regresión crítica.
- [ ] Revisar manualmente los flujos de mayor riesgo en dashboard y CLI: importar skill, configurar
  provider, ejecutar tarea, usar fetch, crear worktree, diagnosticar y exportar datos.
- [ ] Registrar cada hallazgo con severidad, evidencia, impacto, mitigación y prueba de regresión.
  No cerrar el bloque por “no encontré vulnerabilidades”: se cierra solo con alcance documentado,
  tests ejecutados y riesgos aceptados explícitamente por Carlos.
- [ ] Después del gate, copiar el resumen a `DONE.md` y actualizar `CONTEXT.md` con los límites de
  confianza permanentes. Si se habilita red externa o multiusuario, reabrir una revisión de seguridad
  específica; esta baseline no cubre ese cambio de amenaza.

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

**Mes 20/C.2 sigue abierto** (dashboard premium multi-archivo, React+TS+Vite+Three.js) — la pregunta original de Carlos ("¿puede OrchestOS entregar un producto premium?") no tiene respuesta con dato real todavía. No reabrir sin: (1) decisión explícita de modelo de Carlos para la corrida ([[feedback-modelo-decision-final-carlos]]), y (2) IDEAS.md #32 (presupuesto de outputs de tools en el executor agéntico) resuelto primero. **Próximo milestone: por decidir con Carlos** — candidatos en [IDEAS.md § 🗺️ Mapa de prioridad](IDEAS.md), tramo P1 (acabado/papercuts) o retomar C.2 si los 2 prerequisitos ya están cubiertos.

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
