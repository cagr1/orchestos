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

- [ ] **G.1 — 🧠 EN CURSO (2026-07-17, sin tests todavía — no cerrar como [x] hasta tenerlos)**
  Detección de tiers: [src/router/engine-cascade.ts](src/router/engine-cascade.ts)
  — `resolveCascadeTier()` chequea Ollama local (`localhost:11434/api/tags`, timeout corto propio
  para no colgar el camino caliente del chat) y el binario `claude` (reusa `findClaudeBinary()` de
  `external.ts`, ya existente). `opencode` queda fuera a propósito — sin contrato CLI verificado en
  este repo, ver G.5.
- [ ] **G.2 — 🧠 EN CURSO (2026-07-17, sin commitear, sin tests todavía — no cerrar como [x] hasta
  tenerlos)** Wiring parcial en D.7 (`handlers/chat.ts`): cuando
  el chat auto-crea una tarea de build, si `resolveCascadeTier()` devuelve tier `'cli'`, la tarea
  se crea con `engine: external` + `executor_model: anthropic/claude-sonnet-5` en vez de heredar
  siempre `orchestos.config.yaml`. Tier `'local'` se detecta pero NO actúa todavía — no hay
  executor de tareas para Ollama (`ollamaChat` solo sirve al chat interactivo, no a build tasks
  vía harness); aterrizar en ese tier hoy no fija nada y la tarea sigue heredando el config normal,
  igual que tier `'api'` (que ya es el comportamiento por defecto actual). **Falta**: tests de
  regresión para `resolveCascadeTier()` y para el wiring en `chat.ts` (cortado a mitad por la
  pausa de planificación) — es lo primero para retomar.
- [ ] **G.3 — 🧠 Chat conversacional en vivo vía CLI:** que las respuestas normales del chat (no
  solo las tareas de build de G.2) también puedan correr por `claude -p` cuando la cascada aterrice
  en tier `'cli'`. Es el ítem más grande del bloque — `chat.ts` hoy solo sabe hablar con Ollama u
  OpenRouter (`ollamaChat` / `openrouterChat` / `runToolLoop`); correr una conversación interactiva
  por el CLI headless es un camino nuevo (continuidad de turnos, costo por mensaje, sin streaming
  real como hoy). Diseñar antes de tocar código — no reusa la lógica actual de `tool-call.ts`.
  **Insumo de diseño real (Orca, investigado 2026-07-18 a pedido de Carlos, ver
  [[reference-external-repos]] #9)**: Orca acopla sus agentes CLI como sesiones de terminal
  **pty reales** (usuario ve la salida en vivo, puede escribirle) — no como llamadas headless de
  una sola vuelta. Decisión de diseño pendiente antes de codear G.3: ¿imitar el modelo pty-vivo
  (más caro, resuelve IDEAS #49 de raíz — visibilidad en vivo del agente) o quedarse con el
  headless-batch actual de `external.ts` (más simple, sin streaming real)? No decidir a ciegas —
  es la misma pregunta de fondo que IDEAS #49 dejó abierta, ahora con un ejemplo real de cómo lo
  resuelve otro producto.
- [ ] **G.4 — 🧠 Selector de modelo dinámico en el chat:** el dropdown de modelo debe reflejar
  SOLO los modelos del tier activo — si la cascada aterrizó en `'cli'`, mostrar los alias del CLI
  (sonnet/opus/haiku/fable), no el catálogo completo de OpenRouter (que no tiene sentido ahí, y es
  exactamente el tipo de "select largo sin filtrar" que la regla de frontend global de Carlos
  prohíbe). Depende de G.3 (necesita que el chat pueda correr por CLI para que el selector tenga
  sentido).
- [ ] **G.5 — BLOQUEADO — 🧠 Generalizar `external.ts` a más binarios (`opencode`):** Carlos
  mencionó tener también `opencode` como CLI. No se implementa a ciegas — no hay contrato de
  invocación verificado (flags reales, formato de salida, manejo de costo) para ese binario en
  este repo, a diferencia de Claude Code (`claude --help` ya se verificó en E.15). Mismo criterio
  que ya aplicó E.15/G.1: no fingir soporte de algo no probado. Reevaluar cuando haya forma real
  de probar el contrato de `opencode` (ej. Carlos lo tiene instalado y puede correr `opencode
  --help` para documentar los flags reales antes de codear contra ellos).

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

- [ ] **H.1 — 🧠 Tab de consumo/gasto (graduación de IDEAS #27) — la pieza grande.**
  Tab nuevo en Settings, agregación **pura** sobre `runs` (SQLite ya tiene `usd_cost`, `model`,
  `task_class`, `created_at` por corrida — incluye chat desde `logChatRun()`, `handlers/chat.ts`).
  NO crear tabla nueva. Mostrar: (a) gasto en $ por día/semana/mes con desglose **por modelo** estilo
  openrouter.ai; (b) conteo de mensajes/tokens por día; (c) **heatmap tipo GitHub contributions** de
  actividad diaria — es la parte más nueva visualmente, el resto reusa patrones ya probados. Endpoint
  nuevo de agregación (`GET /api/usage` o similar), reusando la lógica de suma que hoy vive suelta en
  `costLast7d` ([setup.ts:221](src/dashboard/handlers/setup.ts:221)). Esfuerzo real: bajo-medio en
  backend (SQL), medio en frontend (heatmap + desglose).
- [ ] **H.2 — 🔍 Investigar el gap del costo ($1.56 vs. run caro que falló).** Carlos vio ~$1.56 en
  "estado del proyecto" cuando una corrida anterior costó casi $5. Dos hipótesis a verificar contra
  la DB real (`sqlite3 .orchestos/db.sqlite "select id,created_at,usd_cost,status from runs order by
  created_at desc limit 20"`): (1) el run caro cayó **fuera de la ventana de 7 días** de `costLast7d`
  — no es bug, es falta de contexto en la UI (ver H.3); (2) el proceso murió **antes de llegar a
  `insertRun()`** — sería un bug de persistencia real. Nota: el executor externo ya rechaza reportar
  $0 silencioso ([external.ts:262](src/run/executors/external.ts:262)), así que un timeout normal SÍ
  persiste con costo conocido — un gap apunta a crash pre-persistencia, no a timeout. Gate 🔍: no
  cerrar H.1 declarando "el costo ya se ve bien" sin haber corrido este query y explicado el número.
- [ ] **H.3 — ⚡ Contexto "7 días" visible en el costo.** El health panel dice "Costo (7 días)"
  ([screens-ops.js:1092](src/dashboard/public/screens-ops.js:1092)) pero la card de "estado del
  proyecto" que ve Carlos pierde ese marco y el número se lee como "gasto total". Fix chico: rótulo
  explícito de ventana temporal donde se muestre el costo. Reemplazado en gran parte por H.1 si el
  tab de consumo pasa a ser la fuente canónica de gasto.
- [ ] **H.4 — 🧠 Preview de routing: de card permanente a preview inline.** Hoy "Tareas pendientes —
  preview de routing" es una card aislada al fondo que **duplica la lista de Tasks** sin aportar más
  que el modelo resuelto ([config.ts:32-41](src/dashboard/handlers/config.ts:32),
  [screens-ops.js:1175](src/dashboard/public/screens-ops.js:1175)). El propósito real es válido
  (simular qué modelo le tocaría a cada tarea pending con los roles actuales vía el mismo `autoRoute()`
  del harness), pero mal enmarcado. Moverlo a preview inline pegado al botón "Guardar routing"
  ("guardar esto afecta a N tareas pendientes — ver") en vez de tabla huérfana permanente. Título que
  comunique "simulación", no "lista de tareas".
- [ ] **H.5 — ⚡ Executor timeout: copy que explique el propósito.** El campo de minutos
  ([screens-ops.js:1213](src/dashboard/public/screens-ops.js:1213)) es una salvaguarda técnica del
  proceso hijo cuando `engine: external` (CLI headless que puede colgarse), NO un límite arbitrario
  de ejecución. Agregar copy que lo explique (helper text / tooltip) para que no se lea como una
  decisión de producto sin origen.
- [ ] **H.6 — 🧠 Fuente de config: mejor presentación.** El badge `configFound` (custom vs defaults,
  [config.ts:44](src/dashboard/handlers/config.ts:44), [screens-ops.js:1130](src/dashboard/public/screens-ops.js:1130))
  muestra el dato correcto pero como `<span>` suelto con tooltip. El archivo NO es obligatorio (si
  falta, `loadOrcheConfig()` cae a defaults, por eso hay botón "Crear config"). Mejorar: explicar qué
  defaults se usan cuando falta, y por qué el archivo importa cuando existe. Sí tiene sentido mostrar
  la fuente — el problema es la presentación, no el dato.
- [ ] **H.7 — 🧠 Tab "Proyecto": ELIMINAR la card de paths crudos (decisión de Carlos, 2026-07-18).**
  `cwd`, `~/.orchestos/.env` y el comando `orchestos dashboard --port 4242`
  ([screens-ops.js:1354-1360](src/dashboard/public/screens-ops.js:1354)) son texto plano no accionable
  — debug info de dev expuesta al usuario final. Carlos decidió **quitar la card entera** (no volverla
  accionable ni fusionarla). El bloque "danger zone" (system reset) de ese mismo tab SÍ se queda —
  reevaluar entonces si el tab "Proyecto" sigue teniendo razón de existir con solo el danger zone, o
  ese reset se reubica (ej. en General) y el tab desaparece.
- [ ] **H.8 — 🧠 Acabado visual general al estándar premium.** Una vez resueltos H.1-H.7, pasar la
  pantalla completa por el estándar Orca/Anthropic: patrón fila-de-catálogo donde aplique (routing,
  executor), jerarquía tipográfica real, espaciado consistente, sin cards genéricas repetidas. Gate
  visual: verificar en vivo contra el dashboard real (levantar, revisar, **cerrar el servidor** —
  [[feedback-siempre-cerrar-servidor]]), no solo en el código.

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
