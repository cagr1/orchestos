# DONE.md — OrchestOS — Registro de trabajo completado

Este archivo es de solo lectura — no se edita a mano.
Se llena moviendo items `[x]` desde PLAN.md e ideas `✅` desde IDEAS.md.

## MES 22 (v0.13) — Que OrchestOS entregue de verdad un producto premium: corregir primero

**Tabla de estado del proyecto al cierre (2026-07-29)**

| Mes | Alcance | Estado |
| --- | --- | --- |
| Mes 22 / v0.13 | Bloques A–K | ✅ Cerrado formalmente, sin pendientes |
| Mes 23 | Bloque L | ✅ Cerrado formalmente; L.5.7 y L.6.2 heredados en Mes 25 |
| Mes 24 | Bloque M | ✅ Cerrado formalmente; dos límites de roadmap pendientes de decisión en Mes 25 |

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

- [x] **J.1 — ⚡ (2026-07-29) Coverage gate con umbral-trinquete en el número actual.** Se creó
  `bunfig.toml` con cobertura habilitada y un gate propio en
  `scripts/check-coverage.ts`: ejecuta la suite, genera LCOV, calcula cobertura agregada de líneas y
  funciones y exige `0.69`. Se evitó `coverageThreshold` nativo de Bun porque hacía fallar CI por
  archivos individuales sin explicar cuál, aunque el agregado superara el umbral. El gate imprime
  ambas métricas, propaga fallos reales de tests y limpia su directorio temporal. No se añadieron
  dependencias. Tests del parser: 2 pass; la suite completa sigue siendo la fuente de la medición.
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
- [x] **K.6.2-R7 — Endurecimiento de comportamientos críticos (cerrado 2026-07-30).** El objetivo no es perseguir `100%`, sino matar mutantes que representen regresiones
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
  - [x] **R7.5 — Decisión (2026-07-28).** Carlos acepta `51.76%` como baseline funcional de `qa.ts`
    y autoriza continuar con K.6.3 para `checks.ts`, `sandbox-policy.ts` y `graph-runner.ts`. La decisión debe
    ponderar riesgo cubierto, estabilidad integrada y costo medido, no el porcentaje bruto.

    Auditoría previa (2026-07-28): se revisaron individualmente los `41` sobrevivientes que no son
    `StringLiteral`. Los `Regex` de las dos funciones parser son variantes equivalentes del extractor
    JSON en los casos soportados; los operadores de arrays/numeración afectan solo la construcción del
    prompt; `trim`/`slice` afectan mensajes o entradas que ya fallan; y las condiciones restantes no
    permiten convertir una respuesta inválida en un veredicto aprobado. No queda evidencia de un
    sobreviviente que altere `pass/fail`, `VERIFIED/CAVEATS/REFUTED`, retry, rollback o persistencia.
    Los `55` `StringLiteral` restantes tampoco justifican snapshots de cada prompt salvo que se defina
    explícitamente el texto como contrato externo.

    **Cierre formal (2026-07-30):** Carlos confirmó la aceptación (ya operativa en la práctica desde
    que K.6.3 se ejecutó sobre 3 módulos más el 2026-07-28) pidiendo re-verificación previa. Claude
    re-corrió `bun run mutation:qa` en limpio (el `reports/mutation/mutation.json` guardado había sido
    sobrescrito por una corrida posterior de `graph-runner.ts`): reproduce exactamente `51.76%`, `96`
    sobrevivientes. Auditoría manual de los `40` no-`StringLiteral` (categorías `Regex`(22, ya
    cubiertos)/`MethodExpression`(6)/`ConditionalExpression`(5)/`ArrayDeclaration`(3)/
    `LogicalOperator`(2)/`ArithmeticOperator`(1)/`EqualityOperator`(1)): confirmado que ninguno altera
    el cómputo de `pass/fail`/`VERIFIED/CAVEATS/REFUTED` — los `ConditionalExpression` sobre
    `typeof obj !== 'object'` (líneas 155/286) quedan protegidos por el fallback seguro de
    `o.verdict === 'pass' ? 'pass' : 'fail'` sobre un primitivo; el de línea 181 es un guard redundante
    ya cubierto por los checks de propiedad siguientes. **Único hallazgo nuevo, no crítico**: línea 256
    de `qa.ts`, si `checksResults` está vacío el mutante hace desaparecer en silencio el texto
    `"NINGUNA verificación mecánica corrió."` del prompt del revisor adversarial (contenido de prompt
    sin test para ese caso puntual, no lógica de veredicto) — anotado, no bloquea el cierre.

**Memoria obligatoria:** al cerrar cada R1-R7 escribir fecha, comando exacto, conteos, tests creados,
mutantes afectados, sobrevivientes restantes y decisión. El resumen final debe permanecer aquí para
Claude, Codex y cualquier otro LLM; no depender de la conversación.
- [x] **K.6.3 — ⚡ Expansión controlada por módulo (cerrada 2026-07-28).** Repetir el patrón, uno
  por uno y sin paralelizar. Cada módulo debe tener su propio resultado; no aceptar un score agregado
  que oculte qué módulo tiene tests débiles.
  - [x] **K.6.3.1 — `checks.ts` → `checks.test.ts` (2026-07-28).** Se añadieron pruebas para
    salida mixta con TypeScript, `.test.tsx`, assertion gate existente, archivos no-HTML con texto
    `<script>`, timeout, `timedOut: false` normal, truncado de salida, argumentos con comillas simples
    y comando vacío. Se creó `stryker.checks.config.mjs` y el script aislado `mutation:checks`.

    Verificación: `bun test src/__tests__/checks.test.ts --timeout 30000` (`28 pass`, `0 fail`,
    `53 expect() calls`), `bun run typecheck` limpio y `bun run mutation:checks`: `127` mutantes,
    `77 killed`, `18 survived`, `32 CompileError`, `0 timeout`, score `81.05%`, duración `1m34s`.
    Los sobrevivientes restantes son equivalentes/no críticos: defaults de `resolve` y timeout,
    guard redundante protegido por `try/catch`, logging, medición de duración, límite exacto de
    `2000` caracteres y valores vacíos de resultados de error. No se cambió producción.
  - [x] **K.6.3.2 — `sandbox-policy.ts` → `sandbox-policy.test.ts` (2026-07-28).** Se añadieron
    pruebas para repositorio inexistente, `preferred: "cwd"`, detached HEAD, nombres similares a
    `runs-summary.json` y diagnóstico con más de diez archivos sucios. Se creó
    `stryker.sandbox-policy.config.mjs` y el script aislado `mutation:sandbox-policy`.

    Verificación: `bun test src/__tests__/sandbox-policy.test.ts --timeout 30000` (`8 pass`, `0 fail`,
    `21 expect() calls`), `bun run typecheck` limpio y `bun run mutation:sandbox-policy`: `83` mutantes,
    `62 killed`, `11 survived`, `10 CompileError`, `0 timeout`, score `84.93%`, duración `1m26s`.
    Los sobrevivientes restantes afectan únicamente formato/recorte del diagnóstico de archivos sucios;
    el branch survivor restante es equivalente en estados reales de Git ya cubiertos. No se cambió
    producción.
  - [x] **K.6.3.3 — `graph-runner.ts` → `graph-runner.test.ts` (2026-07-28).** Se añadieron
    pruebas para wall-clock positivo y cero, límite de `200` iteraciones, graph stalled, task pendiente
    por contexto, task desaparecida, task marcada done externamente, retry con acumulación de tokens/costo,
    requeue único por rate limit y fallo del proveedor de diagnóstico. Se corrigió producción para propagar
    `harnessResult.retryReason` en el `GraphTaskEntry` bloqueado por contexto.

    Verificación final: `bun test src/__tests__/graph-runner.test.ts --timeout 30000` (`21 pass`, `0 fail`,
    `67 expect() calls`), `bun run typecheck` limpio y `bun run mutation:graph-runner`: `360` mutantes,
    `152 killed`, `75 survived`, `132 CompileError`, `1 timeout`, score `67.11%`, duración `7m26s`.
    El timeout corresponde al mutante `iteration--`, que vuelve no terminable el límite de iteraciones;
    es un timeout de Stryker, no un timeout observado en producción. Los `132 CompileError` son mutantes
    rechazados por el compilador TypeScript y no fallos del código base.

    La revisión de sobrevivientes encontró una debilidad real: el mutante que cambiaba la conversión del
    wall-clock de `/ 60_000` a `* 60_000` sobrevivía porque la prueba anterior solo verificaba que un límite
    estrecho disparara el circuit breaker en ambos casos. Se corrigió la prueba para ejecutar una cadena rápida
    con límite amplio (`maxMinutes: 0.1`) y exigir que ambas tareas terminen; el mutante ahora muere.
    Los `75` sobrevivientes restantes se concentran en formato/filtrado del diagnóstico de graph stalled,
    logging, métricas de duración/costo y ramas defensivas de estado externo o payloads de actualización.
    No hay evidencia actual de que cambien outcomes, retries, bloqueo de descendientes o circuit breakers
    bajo el contrato normal probado; las ramas defensivas de concurrencia quedan como riesgo residual de baja
    frecuencia, no como garantía absoluta. No se añadieron exclusiones ni threshold.
  - [x] **K.6.3.4 — Consolidación (2026-07-28).** Se consolidaron los cuatro módulos sin mezclar sus
    resultados durante las corridas:

    | Módulo | Mutantes | Killed | Survived | CompileError | Timeout | Score | Duración |
    | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
    | `qa.ts` | 313 | 103 | 96 | 114 | 0 | 51.76% | 2m46s |
    | `checks.ts` | 127 | 77 | 18 | 32 | 0 | 81.05% | 1m34s |
    | `sandbox-policy.ts` | 83 | 62 | 11 | 10 | 0 | 84.93% | 1m26s |
    | `graph-runner.ts` | 360 | 152 | 75 | 132 | 1 | 67.11% | 7m26s |
    | **Total ponderado** | **883** | **394** | **200** | **288** | **1** | **66.22%** | **13m12s** |

    El total ponderado usa `394 / (883 - 288)` y sirve únicamente como referencia; no sustituye los
    scores por módulo. La duración es el costo operativo medido en ejecución serial; no se estimó costo
    monetario porque no existe telemetría de consumo/precio en estos comandos. Los `200` sobrevivientes
    agregados permanecen clasificados por módulo en las entradas anteriores: predominan formato/logging,
    métricas, diagnósticos y ramas defensivas, con el riesgo real de wall-clock de `graph-runner.ts` ya
    corregido y cubierto.

    Decisión: K.6.3 queda cerrado como expansión de pruebas por módulo. No se añaden exclusiones, threshold
    ni gate de commit; el siguiente paso autorizado por el plan es K.6.4, benchmark acotado de `src/run/`.
- [x] **K.6.4 — ⚡ Benchmark acotado de `src/run/` (2026-07-28).** Se creó
  `stryker.run.config.mjs` y el script `mutation:run`, mutando `src/run/**/*.ts` completo con
  `concurrency: 1` y ejecutando `bun test src/__tests__ --timeout 30000`.

  El `dryRun` validó la configuración con `bunx stryker run stryker.run.config.mjs --dryRunOnly`:
  `33` archivos mutables, `3385` mutantes instrumentados, suite base exitosa en `14s`, `1` test runner
  y `1` checker. La corrida real se inició con `bunx stryker run stryker.run.config.mjs` a las `20:52:13`
  y se detuvo manualmente a las `21:04:41` (`12m28s`) sin producir reporte final ni score; no hubo error
  de la suite, pero tampoco progreso parcial utilizable.

  Decisión: el benchmark monolítico es inviable como ejecución interactiva y no se implementa como gate de
  commit. Se conserva como métrica manual/nocturna de referencia; la adopción operativa se decide en K.6.5.
- [x] **K.6.5 — 🔍 Decisión de adopción (2026-07-29).** Carlos decide adoptar el modelo profesional de
  **nightly/CI no bloqueante**, dividido en cuatro shards con `concurrency: 1`: `orchestration`, `executors`,
  `runtime-boundaries` y `context-routing`. Cada shard ejecuta la suite completa, tiene timeout de workflow
  de `180` minutos y publica su `mutation.json` como artifact durante `14` días.

  El workflow `.github/workflows/mutation-nightly.yml` corre a las `03:00 UTC` (`22:00` Ecuador) y también
  ofrece `workflow_dispatch`. Usa `max-parallel: 2` entre shards para controlar consumo de CI, pero cada
  proceso Stryker mantiene `concurrency: 1`. No se conecta al workflow normal de PR, no bloquea commits,
  no fija threshold y no modifica automáticamente el código. El benchmark monolítico `mutation:run` se
  conserva como referencia manual, no como job de CI.

  Validación local de configuración: los cuatro comandos `bunx stryker run <config> --dryRunOnly` pasaron
  con la suite completa: `orchestration` (`6` archivos, `1205` mutantes, `14s`), `executors` (`9`, `913`,
  `13s`), `runtime-boundaries` (`7`, `634`, `13s`) y `context-routing` (`11`, `633`, `14s`). La suma
  coincide con los `3385` mutantes del benchmark monolítico; todavía no se han ejecutado corridas de mutación
  completas de los shards, por lo que no se inventa score, costo ni clasificación de sobrevivientes.

  Decisión final: opción (b), nightly/CI informativo. La opción (c), gate por módulos críticos, queda
  explícitamente descartada por ahora porque los scores y sobrevivientes todavía requieren observación
  longitudinal; podrá reabrirse con evidencia posterior. No se gradúa a IDEAS #54 como gate.

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

**Tabla de estado de bloques al cierre (2026-07-29)**

| Bloque | Estado |
| --- | --- |
| L.0–L.5.6 | ✅ Cerrado con evidencia en este registro |
| L.5.7 | ✅ Cerrado (2026-07-30) — L.5.7.1–L.5.7.7 documentados y verificados |
| L.6.1 | ✅ Gate reproducible cerrado |
| L.6.2 | ⏳ Pendiente heredado: revisión visual/manual y decisión sobre L62-001/L62-002 |

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

- [x] **L.0 — 🧠 (2026-07-29)** Threat model escrito y verificado contra el código real (no
  asumido): activos (API keys en `~/.orchestos/.env` texto plano, código del usuario, DB SQLite,
  prompts, capacidad de `Bun.spawn`), actores/entradas no confiables (tarea/skill importada,
  contenido web, imagen/OCR, salida de LLM, CLI externo), y límites de confianza verificados
  (bind `127.0.0.1` + `isSameOrigin()` sin auth real en `server.ts`, traversal check en estáticos,
  `enforceContract()` como único punto de escritura, 8 sitios de `Bun.spawn` confirmados con arrays
  de argumentos — sin interpolación de shell, `ssrf.ts` con resolución DNS real, `sandbox-policy.ts`
  exigiendo working tree limpio). Entregable: [docs/security-threat-model.md](docs/security-threat-model.md).
  6 gaps reales documentados para L.1-L.6 (sin auth, API keys sin cifrar, contenido externo
  como dato solo por convención de prompt, sin matriz de path traversal, sin `bun audit`, sin
  retención/backup de la DB), y alcance explícitamente fuera de esta baseline (exposición no-local,
  multiusuario, cifrado completo de DB, compliance formal). No se cambió código de producción.

### L.1 — ⚡ Inventario de superficie y secretos

- [x] **L.1 — Inventario y secretos (2026-07-29).** Se documentó el inventario de dashboard, CLI,
  tools, subprocesses, filesystem, configuración y persistencia en
  [docs/security-secrets-audit.md](docs/security-secrets-audit.md). Se confirmó que las keys de
  proveedores viven en `~/.orchestos/.env` en texto plano y que los datos históricos no se migran
  automáticamente.
- [x] Se añadió `src/security/secrets.ts` y `scripts/check-secrets.ts` con detección de claves
  conocidas, Bearer tokens, private keys y asignaciones de credenciales. `bun run security:secrets`
  revisa líneas añadidas del diff staged sin imprimir valores; `secrets.test.ts` cubre fixtures
  positivos, negativos y redacción en logs/respuestas HTTP.
- [x] Se aplicó `redactSensitive()` antes de persistir logs, `runs`, `run_steps`, errores HTTP y
  exports derivados. Se documentó rotación/revocación y se decidió no inventar cifrado propio;
  keychain del sistema queda como opción futura si el modelo local necesita protección en reposo.
- [x] Verificación: `bun test src/__tests__/secrets.test.ts --timeout 30000` (`4 pass`, `0 fail`,
  `8 expect() calls`) y `bun run typecheck` limpio. La suite completa validada con acceso de escritura
  a SQLite: `938 pass`, `0 fail`, `2125 expect() calls` en `87` archivos; el intento sin acceso elevado
  produjo solo `SQLITE_READONLY` en `~/.orchestos/db.sqlite` y no fue un fallo funcional.
  `bun run security:secrets:tracked` queda listo para CI. No se imprime el valor de ningún hallazgo.

### L.2 — 🧠 Autenticación, exposición de red y CSRF

- [x] **L.2 — 🧠 (2026-07-29)** Modelo de despliegue confirmado como el documentado en
  [docs/security-threat-model.md](docs/security-threat-model.md) §6: **solo localhost, usuario
  único, sin autenticación multiusuario**; no se implementó auth/CSRF-token/rate-limit para
  exposición no-local porque esa exposición no existe hoy y construirla sería diseñar
  especulativamente para una amenaza que no aplica — queda explícitamente gated a que Carlos decida
  exponer el dashboard fuera de loopback, momento en el que se abre una revisión de seguridad aparte
  (ya anotado como límite en L.0).
- [x] **Bind a loopback verificado con test real, no solo lectura de código.** `startServer()`
  (`server.ts`) sigue haciendo bind exclusivo a `127.0.0.1` — no existe ningún flag `--host` en el
  CLI que permita cambiarlo, por lo que "advertencia si se cambia" no aplica todavía (no hay forma de
  cambiarlo). Test de regresión: `src/dashboard/__tests__/csrf-origin.test.ts` levanta el server real
  y confirma `server.hostname === '127.0.0.1'` vía la API de Bun, no un grep de string.
- [x] **Hallazgo real de CSRF corregido, no solo documentado.** `isSameOrigin()` ([http.ts](src/dashboard/http.ts))
  solo comparaba `hostname` (`localhost`/`127.0.0.1`) e ignoraba el puerto (`_port` recibido pero sin
  usar) — cualquier página servida desde OTRO puerto de localhost (ej. un dev server abierto en el
  mismo navegador) pasaba la verificación y podía enviar mutaciones al dashboard. Confirmado
  causalmente: con el código anterior, un origen `http://localhost:9999` contra el dashboard en otro
  puerto devolvía `400` (pasó la verificación de origen, falló después por otra razón), no `403`. Fix:
  ahora exige que el puerto del origen coincida exactamente con el puerto del server.
- [x] **Tests negativos** en `csrf-origin.test.ts` (7 casos): mismo host+puerto → autorizado (2
  variantes, `localhost`/`127.0.0.1`); puerto distinto → `403`; origen remoto arbitrario → `403`;
  sin header `Origin` (cliente no-navegador, ej. CLI/curl) → no bloqueado por origen (comportamiento
  intencional, documentado); `GET` no se filtra por origen (solo POST/PUT/DELETE mutan). Los casos de
  "credencial inválida", "replay" y "usuario sin permiso por proyecto/ruta" del ítem original se
  marcan **not-applicable**: no hay credenciales ni multiusuario en el modelo local confirmado — no
  se inventa un sistema de auth falso para tener algo que testear.
- [x] **Verificación:** `bun test src/dashboard/__tests__/csrf-origin.test.ts --timeout 30000` (`7
  pass`, `0 fail`, `7 expect() calls`), `bun run typecheck` limpio. Suite completa: `944 pass`, `1
  fail`, `2132 expect() calls` en `88` archivos — el único fallo es preexistente y **ajeno a este
  ítem**: `src/__tests__/secrets.test.ts` (L.1, ⚡) falla el caso `private-key` también en HEAD sin
  ningún cambio de L.2 (confirmado con `git stash`). No se tocó por scope-lock — reportado, no
  corregido, porque L.1 es ⚡ y ya está cerrado.

**Cabo suelto para reportar, no para resolver acá:** `secrets.test.ts` (L.1) tiene una regresión real
(`private-key` no detectado) posterior al cierre documentado de L.1 en este mismo PLAN.md. Alguien
debe revisar `src/security/secrets.ts` — no es parte del alcance de L.2.

### L.3 — ⚡ Filesystem, worktrees y ejecución de comandos

- [x] **L.3 — Filesystem y subprocesses (2026-07-29).** Se creó la política común en
  [src/run/path-policy.ts](src/run/path-policy.ts) y la matriz documentada en
  [docs/security-filesystem-policy.md](docs/security-filesystem-policy.md): paths relativos,
  absolutos, `../`, traversal con una y dos capas de encoding, symlinks externos e internos,
  `cwd` fuera del root y archivos no regulares. `enforceContract`, tools, checks y diff de
  worktree usan ahora la misma resolución real del root; un path LLM no puede ampliar
  silenciosamente `output[]`.
- [x] Todos los puntos de CLI auditados mantienen arrays de argumentos sin shell interpolation.
  `runChecks` valida `cwd` y filtra el entorno con `safeChildEnv()`; se mantienen timeouts,
  señales de terminación y límites de salida existentes. Las rutas de executor apuntan al
  worktree ya creado por sandbox y la lectura de diff descarta paths que no resuelven dentro de él.
- [x] Regresión observable en `src/__tests__/path-policy.test.ts`: `36 pass`, `0 fail`, `106
  expect()` calls contando contract/sandbox/path-policy; incluye command injection por metacaracteres,
  variable arbitraria heredada, symlink escape, symlink de escritura, `cwd` y traversal codificado.
  Verificación adicional: `bunx tsc --noEmit` limpio. La terminación de procesos hijos ya existentes
  sigue dependiendo del mecanismo de señal de Bun; no se inventa un process-group portable en esta
  pasada. Junctions y FIFO no aplican al filesystem/runtime soportado en macOS sin añadir un
  fixture dependiente del sistema; quedan explícitamente como gap residual, no como cobertura falsa.

### L.4 — ⚡ SSRF, contenido externo y prompt injection

- [x] **L.4 — SSRF y contenido externo (2026-07-29).** Se reforzó `src/dashboard/ssrf.ts`:
  loopback, RFC1918, link-local, metadata/link-local, IPv6 ULA/link-local/multicast, IPv4-mapped
  IPv6, schemes no HTTP(S), credenciales y puertos no estándar quedan bloqueados. `fetch_url`
  rechaza redirects, respuestas no-2xx, aplica timeout de 10s y lectura incremental de 256 KB;
  skill import remoto aplica la misma política con timeout de 15s y límite de 256 KB. Se añadió
  segunda resolución DNS posterior al fetch para detectar rebinding observable. El límite honesto
  de pinning de socket queda documentado en [docs/security-ssrf-policy.md](docs/security-ssrf-policy.md):
  el fetch global no permite coordinar IP resuelta con SNI/Host; no se declara una garantía que no
  existe.
- [x] Web, OCR, adjuntos, memoria y `read_file` ahora se marcan con
  `<untrusted-data>` y el system prompt prohíbe obedecer instrucciones allí ni permitir que cambien
  tools, paths, modelo, permisos o aceptación. `read_file` también usa la política central de
  paths de L.3, incluida protección contra symlinks.
- [x] Verificación: `bun test src/__tests__/ssrf.test.ts src/__tests__/chat-fetch-url.test.ts
  src/__tests__/chat-read-project-tools.test.ts --timeout 30000` (`57 pass`, `0 fail`, `65
  expect()` calls) y `bunx tsc --noEmit` limpio. Casos incluidos: IPv6, mapped IPv6, DNS rebinding
  con lookup que cambia de público a loopback, credenciales, puertos, scheme, límite de cuerpo,
  contenido con prompt injection y paths de archivo.

### L.5 — ⚡ SQLite, configuración y privacidad

- [x] **L.5.0 — Aislamiento de DB para tests (2026-07-29).** Preflight con `bunx tsc --noEmit`
  pasó, pero 14 tests de persistencia fallaron al intentar escribir en la DB real de
  `~/.orchestos` (readonly en el entorno). Se corrigió [src/db/sqlite.ts](src/db/sqlite.ts) para
  aceptar `ORCHESTOS_HOME`, conservando `~/.orchestos` como default de producción, y se agregó
  [sqlite-path.test.ts](src/__tests__/sqlite-path.test.ts), que lo verifica en un proceso Bun nuevo.
  La suite de DB debe ejecutarse con una raíz temporal/aislada; no se considera aceptable depender de
  cleanup sobre la DB real del usuario. Esto es el primer paso de aislamiento, no cierra todavía la
  cobertura completa de migraciones, corrupción, backup ni recuperación. Verificación aislada:
  `ORCHESTOS_HOME=/private/tmp/orchestos-l5-suite bun test ...` → `33 pass`, `0 fail`, `65 expect()`
  calls en 7 archivos. El `tsc --noEmit` previo detectó un fallo ajeno en
  `src/dashboard/handlers/chat.ts`, dentro de cambios concurrentes de L.4: identificador Unicode
  declarado como `postFetchSsrֆBlock` pero usado como `postFetchSsrфBlock`; no se corrigió por
  scope-lock.
- [x] **L.5.1 — Migraciones reproducibles (2026-07-29).** Se agregó
  [migration.test.ts](src/__tests__/migration.test.ts), con procesos Bun aislados para verificar DB
  vacía, DB legacy con preservación de filas y ejecución idempotente. No se tocó la DB real del
  usuario ni se simuló SQLite. Verificación: `ORCHESTOS_HOME=/private/tmp/orchestos-l5-suite bun test
  src/__tests__/migration.test.ts --timeout 30000` → `3 pass`, `0 fail`, `11 expect() calls`.
- [x] **L.5.2a — Integridad de queries y concurrencia (2026-07-29).** Se verificó persistencia
  parametrizada contra SQL-looking content y se corrigió la carrera real de `run_steps`: la secuencia
  `MAX(seq)+1` ahora está dentro de `BEGIN IMMEDIATE`; SQLite usa `busy_timeout=5000` y el cambio de
  WAL concurrente no rompe el arranque si otro proceso está recuperando la DB. Test con dos procesos
  reales: `40` pasos, secuencia `1..40`, `40` valores únicos. Verificación conjunta con migraciones y
  DB: `7 pass`, `0 fail` para backup/integrity/migrations; `10 pass`, `0 fail` para integridad,
  concurrencia y run-steps. Siguen pendientes límites explícitos de tamaño y un escenario de
  corrupción recuperable; no se declaran cubiertos por estos tests.
- [x] **L.5.3a — Backup y privacidad básica (2026-07-29).** Se agregó
  [src/db/backup.ts](src/db/backup.ts): snapshot consistente con `VACUUM INTO`, escritura temporal
  + rename atómico, permisos `0600` y `PRAGMA integrity_check` sobre el backup. `upsertMemory()` ya
  redacta credenciales antes de persistir contenido. Test real: backup privado e íntegro + secreto
  redacted, incluido en `7 pass`, `0 fail`, `28 expect() calls`.
- [x] **L.5.4a — Detección de corrupción y recuperación segura (2026-07-29).**
  `verifyDatabaseBackup()` ahora falla cerrado (`ok:false`) ante un archivo corrupto y
  `restoreDatabaseBackup()` valida antes de copiar, se niega a sobrescribir destinos existentes,
  escribe temporal + rename y vuelve a ejecutar `integrity_check`. No toca automáticamente
  `~/.orchestos/db.sqlite`. Tests reales: backup válido restaurado a un archivo nuevo y backup
  corrupto rechazado; `bunx tsc --noEmit` limpio y `bun test src/__tests__/db-backup.test.ts` →
  `3 pass`, `0 fail`, `12 expect() calls`.
- [x] **L.5.7 — Linaje versionado y rollback de migraciones (cerrado 2026-07-30).** L.5.1 cubre DB vacía, legacy con
  columnas faltantes, preservación de filas e idempotencia, pero no existe todavía una secuencia
  histórica formal ni un `schema_version`. Cerrar este gap en el siguiente orden:
  - [x] **L.5.7.1 — Baseline de esquema (2026-07-29).** Se creó `schema_migrations` y se registra
    `version=1`, `baseline-current-schema` solo después de completar el esquema actual. DB vacía,
    legacy con fila preservada e idempotencia verificadas; no se borran ni reconstruyen datos.
    Verificación: `bunx tsc --noEmit` limpio y `bun test src/__tests__/migration.test.ts` → `3 pass`,
    `0 fail`, `14 expect() calls`.
  - [x] **L.5.7.2 — Registro de pasos futuros (2026-07-29).** Se añadió `SchemaMigrationStep` y
    `applyMigrationSteps()`: exige secuencia consecutiva desde la baseline, nombre explícito,
    precondición, postcondición y registra `version/name/applied_at` solo después de verificarlas.
    Los pasos ya aplicados se omiten para preservar idempotencia; `FUTURE_MIGRATIONS` queda como
    registro único para las transformaciones reales siguientes. El test ejecuta un paso v2 dos veces,
    preserva una sola evidencia y confirma el postcondition. La transacción y rollback siguen siendo
    deliberadamente L.5.7.3, no se declaran cubiertos aquí.
  - [x] **L.5.7.3 — Transacción y rollback (2026-07-29).** Cada `SchemaMigrationStep` ejecuta
    precondición, transformación, postcondición y registro de evidencia dentro de una transacción
    SQLite; la versión solo se marca cuando todo confirma. La prueba inyecta un fallo después de
    crear una tabla, cierra y reabre la DB, y demuestra `0` tabla parcial y `0` versión v2 marcada.
    No se borra ni se reconstruye la DB activa.
  - [x] **L.5.7.4 — Fixtures y contrato de esquema (2026-07-29).** `migration.test.ts` cubre DB
    vacía, baseline v1 y legacy representativa con fila preservada. Los fixtures validan defaults de
    contadores/costos/tiempo, `NOT NULL` de `runs.status`, tipo nulo de columnas añadidas y rechazo
    de path duplicado por constraint `UNIQUE`, además de la existencia del índice único de `files`.
    Foreign keys, FTS5, triggers y conteos de integridad quedan para L.5.7.5.
  - [x] **L.5.7.5 — Integridad relacional y FTS (2026-07-29).** Se activó `PRAGMA foreign_keys = ON`
    por conexión y se verifican foreign keys, índices requeridos, los tres triggers FTS5 y conteos de
    memoria antes/después. `rebuildMemoryFts()` reporta recuperación exitosa tras borrar el índice y
    `false` ante una tabla FTS incompatible, sin ocultar el resultado ni tocar datos fuente.
  - [x] **L.5.7.6 — Inyección de fallos por etapa (2026-07-29).** Se probaron fallos en precondición,
    transformación y postcondición: cada uno deja `0` artefactos parciales y `0` versión marcada.
    Después de ambos fallos de contrato, una migración válida v2 continúa y registra una sola evidencia.
    El rollback es transaccional; no borra/recrea ni restaura automáticamente la DB activa.
  - [x] **L.5.7.7 — Procedimiento operativo (2026-07-29).** Se documentó en
    [docs/security-migration-recovery.md](docs/security-migration-recovery.md) el flujo backup
    consistente/validado → detener procesos → migrar → `integrity_check` → reabrir. En fallo se
    conserva la DB original, se valida el backup y se restaura solo a un destino nuevo; el reemplazo
    de la DB activa queda como acción manual revisada, nunca automática.
- [x] **L.5.5a — Auditoría de queries y límites (2026-07-29).** Se auditó el inventario completo de
  `bun:sqlite`: valores externos parametrizados, FTS tokenizado, SQL dinámico limitado a identificadores
  constantes y único `VACUUM INTO` con path escapado. Se corrigió el hallazgo real del endpoint de runs:
  `limit` inválido/negativo/0/NaN ya no puede pedir una consulta ilimitada al dashboard; positivos se
  acotan a 200 (1000 en la función DB para callers internos), mientras exportación CLI conserva el
  `listRuns(0)` explícito. Queries FTS públicas se acotan a 256 caracteres. Verificación: `10 pass`,
  `0 fail`, `38 expect()` calls en límites, integridad, concurrencia, migraciones y backup; `bunx
  tsc --noEmit` limpio.
- [x] Evidencia y límites de corrupción/concurrencia quedan documentados en
  [docs/security-db-query-audit.md](docs/security-db-query-audit.md), junto con los controles ya
  implementados por L.5.0–L.5.3a: aislamiento `ORCHESTOS_HOME`, `busy_timeout`, `BEGIN IMMEDIATE`,
  backup consistente, restore no destructivo e `integrity_check`. No se mezclaron cambios concurrentes
  de SQLite; recuperación de la DB viva y rollback/versionado de migraciones siguen abiertos como
  gaps separados, no se declaran cubiertos por esta auditoría.
- [x] **L.5.6 — Clasificación, retención y privacidad (2026-07-29).** Política documentada en
  [docs/security-data-retention.md](docs/security-data-retention.md): credenciales restringidas,
  contenido de trabajo sensible, metadatos internos y derivados separados; runs/memoria no se borran
  automáticamente, mientras `run_steps` y `chat_task_bar_events` tienen purga explícita por defecto
  a 30 días. Se agregó preview + purga transaccional en [src/db/retention.ts](src/db/retention.ts),
  sin invocación automática ni borrado de la DB real. `runs-summary.json` ya exporta solo metadatos;
  el diagnóstico ahora redacta task, resultado, checks y campos de contexto antes de enviarlos al
  proveedor. Verificación: `bunx tsc --noEmit` limpio; `bun test src/__tests__/retention.test.ts
  src/__tests__/diagnose.test.ts --timeout 30000` → `8 pass`, `0 fail`, `27 expect() calls`,
  incluyendo preview, purga selectiva, periodos inválidos y payload sensible sin credenciales.

### L.6 — 🔍 Gate de seguridad y operación

- [x] **L.6.1 — Gate reproducible de seguridad (2026-07-29).** Se implementaron `bun run security:gate` y
  [docs/security-gate.md](docs/security-gate.md): typecheck, DB temporal migrada, matriz completa
  serial/aislada con coverage y `bun audit --audit-level=high`; cualquier salida distinta de cero
  detiene el gate. La matriz final pasó `983 pass`, `0 fail`, `2184 expect()` en `95` archivos y la
  auditoría quedó limpia tras fijar `brace-expansion` en `5.0.8` mediante override. Durante el gate
  se corrigió la clasificación duplicada de credenciales (`provider-key` + `credential-assignment`),
  se ajustaron fixtures de conflictos para foreign keys y se verificó el dashboard fuera del sandbox.
- [x] Revisar manualmente los flujos de mayor riesgo en dashboard y CLI: importar skill, configurar
  provider, ejecutar tarea, usar fetch, crear worktree, diagnosticar y exportar datos.
- [x] Registrar cada hallazgo con severidad, evidencia, impacto, mitigación y prueba de regresión.
  No cerrar el bloque por “no encontré vulnerabilidades”: se cierra solo con alcance documentado,
  tests ejecutados y riesgos aceptados explícitamente por Carlos.
- [x] Después del gate, copiar el resumen a `DONE.md` y actualizar `CONTEXT.md` con los límites de
  confianza permanentes. Si se habilita red externa o multiusuario, reabrir una revisión de seguridad
  específica; esta baseline no cubre ese cambio de amenaza.

**L.6.2 — avance inicial (2026-07-29):** evidencia y hallazgos detallados en
[docs/security-manual-review.md](docs/security-manual-review.md). CLI y superficie HTTP local
verificadas sin gasto ni escrituras sensibles: dry-runs del runner/DAG, ayuda de comandos,
status/list/config, dashboard HTML y GET, CSRF por origen/puerto, SSRF de import, validación de
paths e ids. Hallazgos abiertos: `L62-001` (migración concurrente no serializada) y `L62-002`
(provider key persistida antes de validación). En la continuación del 2026-07-29 tampoco hubo navegador
disponible; además, el dashboard no pudo iniciar en `4243` ni `4343` por `EADDRINUSE`, sin proceso del
dashboard escuchando en esos puertos. No se marca el gate como cerrado. Pendientes: revisión visual,
ejecutar una tarea/worktree/diagnóstico/exportación manual y decidir mitigación/aceptación de ambos
hallazgos.

---

## MES 24 — M: guías reproducibles por lenguaje y ecosistema (nuevo, 2026-07-29)

**Tabla de estado de bloques al cierre (2026-07-29)**

| Bloque | Estado |
| --- | --- |
| M.0–M.5 | ✅ Cerrados con evidencia en este registro |
| Límites de roadmap | ⏳ Decisión pendiente de Carlos, heredada en Mes 25 |

**Motivo:** detectar que un repositorio contiene Rust, Go, Python o TypeScript no significa saber
cómo trabajarlo correctamente. El conocimiento actual de OrchestOS está repartido entre detección de
lenguajes, skills, `AGENTS.md`, comandos descubiertos del proyecto y la intuición del desarrollador.
Eso permite empezar una tarea, pero no garantiza que se hayan considerado toolchain, dependencias,
tests, seguridad, observabilidad, build, despliegue y rollback.

**Decisión de arquitectura:** sí, el conocimiento debe vivir en Markdown versionado, pero en capas.
No se creará un `roadmap.md` monolítico ni se tratará `roadmap.sh` como una autoridad ejecutable.
La fuente de verdad será:

1. `docs/roadmaps/engineering-baseline.md`: orden universal para cualquier proyecto.
2. `docs/roadmaps/languages/<lenguaje>.md`: diferencias de Rust, Go, Python, TypeScript, etc.
3. `docs/roadmaps/project-profile.md`: decisiones y comandos reales del repositorio detectado.
4. `skills/*.yaml`: instrucciones operativas que el agente recibe durante una tarea.
5. `AGENTS.md`/`CONTEXT.md`: reglas y contexto estable del proyecto, no listas genéricas de aprendizaje.

El Markdown es la memoria durable y revisable; la detección del proyecto y los checks deben convertir
esa memoria en evidencia ejecutable. Una guía que solo se inyecta en el prompt, pero no verifica sus
comandos, es documentación aspiracional y no un control de calidad.

**Secuenciación (2026-07-29):** Bloque L (seguridad) sigue abierto en L.1. M no compite por foco —
M.0/M.1 (diseño + guía universal, baratos) pueden avanzar en paralelo por ser prerequisito de
lectura, pero M.2 en adelante (perfiles por lenguaje, integración) no arranca en serio hasta que
L llegue al menos a L.4 (los ítems ⚡ restantes son mecánicos y baratos). No abrir un cuarto bloque
nuevo mientras K/L/M sigan con ítems sin cerrar.

**Auditoría previa obligatoria, antes de diseñar nada (2026-07-29):** M.0 no empieza por un esquema
en blanco. Antes de escribir `docs/roadmaps/README.md`, grep/leer qué de esto ya existe para no crear
una segunda fuente de verdad — mismo principio que evitó trabajo redundante en K.4a ("la premisa ya
estaba resuelta, reconstruir hubiera sido puro gasto"): qué cubre ya `description` en `skills/*.yaml`
como condición de disparo, qué detecta ya `defaultChecksFor()`/los resolvers multi-lenguaje (Mes 5),
y qué vive ya en `AGENTS.md`/`CONTEXT.md`. El roadmap solo debe cubrir el hueco real: **el orden**
entre esas piezas, que hoy no existe en ningún lado.

**Contrato de evidencia por sección, no opinión de LLM (2026-07-29):** este bloque nace de la misma
tesis que Bloque K — no confiar en que un LLM "lea y sepa". Sería contradictorio que M.1-M.3
terminen siendo exactamente eso al revés: un LLM escribiendo de memoria "así se testea en Go" sin que
nadie lo corra. Ninguna sección de un perfil de lenguaje se marca `verified` sin citar el comando
exacto ejecutado y su salida real (mismo estándar de cita literal que `qa.ts` exige en K.4a); si el
autor no puede correrlo, el estado correcto es `known` (viene de documentación/entrenamiento, no
verificado en este repo), nunca `verified`.

### M.0 — 🧠 Diseño del sistema de roadmaps (prerequisito)

- [x] **M.0 — 🧠 (2026-07-29)** Auditoría previa completada contra el código real (no asumida):
  `skills/*.yaml` solo cubre instrucciones operativas por tarea (`description`/`when_to_use`), los
  resolvers de lenguaje (`src/graph/resolvers/{rust,go,java,csharp}.ts`, Mes 5/S21) solo resuelven
  imports para el grafo de dependencias, `defaultChecksFor()` ([checks.ts](src/run/checks.ts)) hoy
  **no genera ningún check para Rust/Go/Python** (solo `.ts/.tsx/.js/.html`), y `AGENTS.md`/
  `CONTEXT.md` son reglas de colaboración y snapshot de arquitectura de este repo, no una guía
  reutilizable de orden de etapas. Ninguna pieza existente cubre el hueco real: **el orden** entre
  toolchain→build→tests→seguridad→observabilidad→deploy→rollback. Diseño completo, esquema,
  modelo de etapas con prerequisitos (12 etapas, cada una gateada en que la anterior esté
  `verified`/`not-applicable`), 5 estados explícitos (`known/detected/verified/missing/
  not-applicable`) y contrato roadmap↔skill↔checks documentados en
  [docs/roadmaps/README.md](docs/roadmaps/README.md). No se creó todavía ningún perfil de lenguaje
  concreto (M.2) ni se conectó a skills/QA (M.4) — explícitamente fuera de alcance de este ítem.
- [x] **M.0-R1 — 🧠 (2026-07-29) Corrección de eje: disciplina/rol reemplaza a lenguaje como capa
  principal.** Motivo, no preferencia: Carlos alimentó primero el vault privado (`MemoriesMD`) con
  roadmaps por disciplina (`wiki/roadmaps/{frontend,backend,qa-seguridad}.md`), anclados en áreas
  profesionales ya existentes (`design-frontend`, `software-quality`; backend ancló en
  `agent-engineering` a falta de área propia), mientras el conocimiento por lenguaje (TypeScript,
  ASP.NET Core, Node.js, Android/iOS, Software Architect) sigue crudo sin destilar en `Clippings/`
  del vault. El diseño debía seguir el trabajo real, no al revés. Cambio: capa 2 pasa a ser
  `docs/roadmaps/disciplines/<disciplina>.md` (eje principal — espejo de `wiki/roadmaps/*.md` del
  vault, promovido vía `/knowledge-promote`, nunca copiado automático); `languages/<lenguaje>.md`
  baja a capa 3, secundaria y acotada a entorno/toolchain/idiomas dentro de una disciplina ya
  definida (no repite auth/testing/caching). El modelo de 12 etapas, los 5 estados explícitos y el
  contrato roadmap↔skill↔checks **no cambiaron** — la corrección es solo de eje, no de rigor.
  Detalle completo en [docs/roadmaps/README.md §9](docs/roadmaps/README.md). Cierre original de M.0
  preservado arriba, no borrado — mismo criterio que el resto de PLAN.md con reglas que evolucionan.

### M.1 — ⚡ Guía universal de ingeniería

- [x] **M.1 — (2026-07-29) Guía universal de ingeniería.** Se creó
  [docs/roadmaps/engineering-baseline.md](docs/roadmaps/engineering-baseline.md) con el flujo mínimo
  antes de modificar código: dominio/arquitectura, límites de confianza, toolchain, configuración,
  comandos, aceptación, pruebas, datos y deploy. Mantiene los estados `known/detected/verified/
  missing/not-applicable` y exige evidencia de comando para `verified`.
- [x] La guía incluye una matriz mínima de calidad: typecheck/compile, unit, integration, E2E,
  coverage, mutation cuando aplique, seguridad, performance, observabilidad y documentación.
- [x] La guía incluye checklist de cierre: diff/scope, errores/retries, inputs inválidos, secretos,
  migraciones, compatibilidad, logs, rollback y evidencia de comandos ejecutados.
- [x] La guía enseña el orden y permite declarar herramientas inexistentes como `missing` o etapas
  no aplicables como `not-applicable`; no exige que todos los lenguajes usen las mismas herramientas.

### M.2 — ⚡ Perfiles iniciales de disciplina (eje principal, M.0-R1) + lenguaje (secundario)

**Orden actualizado por M.0-R1**: empezar por disciplina, no por lenguaje. La fuente autoral son
los roadmaps ya destilados en el vault (`MemoriesMD/wiki/roadmaps/{frontend,backend,qa-seguridad}.md`)
— promoverlos vía `/knowledge-promote` a `docs/roadmaps/disciplines/*.md`, con propuesta/diff y
confirmación explícita de Carlos por cada uno, no copiarlos automático. Recién después, y solo si
un proyecto concreto lo necesita, crear el perfil de lenguaje angosto correspondiente.

- [x] **M.2.1 — (2026-07-29) Promover roadmaps de disciplina desde el vault.** Se promovieron los
  seis roadmaps ya organizados en `MemoriesMD/wiki/roadmaps/` a
  [docs/roadmaps/disciplines/](docs/roadmaps/disciplines/): `backend`, `frontend`, `qa-seguridad`,
  `architecture`, `devops` y `ai-agents`. La promoción conserva la fuente, fecha y estado global;
  cada contenido entra como `known`, nunca como `verified`, hasta ejecutarse contra un proyecto real.
  Se incorporaron explícitamente buenas prácticas de API/SQL, seguridad, performance, system design,
  AWS/operación y agent loop/tool security. No se promovieron los perfiles de lenguaje secundarios
  ni se conectaron todavía skills/QA (M.2/M.4 restantes).
- [x] **M.2.2 — (2026-07-29) Perfiles secundarios de lenguaje.** Se crearon perfiles versionados y
  angostos para TypeScript/Bun, Rust y Go en
  [docs/roadmaps/languages/](docs/roadmaps/languages/). Cada uno distingue lenguaje, runtime,
  package/dependency manager, framework, persistencia y tipo de entrega sin duplicar las disciplinas.
  TypeScript/Bun queda `detected` con evidencia real; Rust queda `known` y Go `detected` solo por un
  fixture, con las herramientas de producción ausentes marcadas `missing`.
- [x] Rust: el perfil cubre `cargo`/`Cargo.toml`, edición/formato, compilación, tests, documentación,
  errores/resultados, ownership/concurrencia, dependencias y checks de seguridad; `clippy`/auditoría
  no se declaran disponibles sin detección.
- [x] Go: el perfil cubre `go.mod`, formato, `go test`, build, `vet`/static analysis, errores,
  goroutines/race conditions, contexto/timeouts, dependencias y checks de seguridad; herramientas
  ausentes quedan explícitamente `missing`.
- [x] TypeScript/Bun: el perfil cubre runtime/package manager real, typecheck, tests, lint/format,
  bundling, dependencias, secretos, SSRF/XSS y diferencias entre servidor, cliente y scripts.
- [x] Cada perfil incluye sección “No asumir” con comandos alternativos, diferencias entre library/
  service/CLI y qué información debe pedir o detectar OrchestOS.

### M.3 — 🧠 Perfil efectivo del proyecto

- [x] **M.3 — 🧠 (2026-07-29)** Auditoría previa (mismo principio de M.0): `src/detect/{manifest,
  languages,conventions,profile}.ts` YA detecta manifest/runtime/framework/deps, lenguajes políglotas
  con % (`LangStat[]`, top 5) y convenciones — usado hoy por `context update` para AGENTS.md/
  CONTEXT.md. M.3 no reimplementa esto: lo reusa y agrega solo lo que faltaba (disciplina/lenguaje
  de `docs/roadmaps/` aplicable + infraestructura + estado explícito). Nuevo módulo
  [src/detect/roadmap-profile.ts](src/detect/roadmap-profile.ts): `buildRoadmapProfile()` combina
  manifest/languages/conventions/commands existentes con detección de disciplinas (backend por
  framework conocido O servidor custom vía patrón de código como `Bun.serve(`/`createServer(`/
  `express()`; frontend por `.html`; qa-seguridad por conteo real de `*.test.*`/`*.spec.*`; devops
  por `.github/workflows`/`Dockerfile`; architecture/ai-agents sin heurística confiable →
  `not-applicable` explícito, no inventado), CI/Docker/DB (por dependencia conocida O uso real de
  `bun:sqlite` en código fuente) y 4 archivos de instrucciones (AGENTS/CLAUDE/CONTEXT/PLAN.md).
  Estados `known/detected/verified/missing/not-applicable` en cada hallazgo — nunca texto sin estado.
  `verified` solo en toolchain: `Bun.version` (introspección real del runtime) y `bunx tsc --version`
  (comando real ejecutado, cae a omitido si no está disponible, nunca bloquea). Perfiles de lenguaje
  se cruzan contra `docs/roadmaps/languages/` por PREFIJO de slug, no nombre exacto — encontró y
  corrigió en el camino que el perfil real de TypeScript quedó nombrado `typescript-bun.md`, no
  `typescript.md`; una búsqueda por nombre exacto lo hubiera marcado `missing` por error.
  `renderProjectProfileMarkdown()` genera `docs/roadmaps/project-profile.md`. CLI:
  `orchestos roadmap show` (lee el archivo cacheado) y `orchestos roadmap check` (re-detecta,
  regenera el archivo, imprime disciplinas/lenguajes/pendientes). **Dogfooding real, no solo unit
  tests**: correr `orchestos roadmap check` contra OrchestOS mismo destapó un bug de heurística
  (backend salía `not-applicable` porque el dashboard usa `Bun.serve` custom, no un framework npm
  conocido) — corregido agregando detección por patrón de código, no solo por dependencia declarada.
  19 tests nuevos en [roadmap-profile.test.ts](src/__tests__/roadmap-profile.test.ts) (fixtures
  aislados en `mkdtempSync` + 2 casos de dogfooding contra `process.cwd()` real). Verificación:
  `bun test src/__tests__/roadmap-profile.test.ts` (`19 pass`, `0 fail`, `38 expect() calls`),
  `bun run typecheck` limpio, suite completa `1002 pass`, `0 fail`, `2278 expect() calls` en `96`
  archivos. **Limitación honesta, no resuelta**: `ai-agents` sale `not-applicable` para OrchestOS
  mismo (un orquestador de agentes) porque la heurística solo busca SDKs de terceros (`@anthropic-ai/
  sdk`, `openai`, etc.) en dependencias — OrchestOS llama proveedores por HTTP directo, sin SDK
  declarado. Documentado en el código y acá en vez de forzar una heurística débil que invente un
  `detected` sin evidencia real.

### M.4 — ⚡ Integración con skills, prompts y QA

- [x] Hacer que una tarea de implementación cargue el roadmap relevante junto con la skill, sin
  duplicar instrucciones ni inflar innecesariamente el contexto del LLM.
- [x] Convertir los pasos verificables del roadmap en `verifiers`/checks deterministas cuando sea
  posible; registrar el comando, exit code, duración y versión utilizada.
- [x] Si el roadmap declara un check obligatorio no disponible, el resultado debe ser `blocked` o
  `missing`, nunca `pass` por omisión. El QA-LLM puede evaluar calidad, pero no sustituye comandos
  faltantes ni inventa evidencia.
- [x] Añadir tests de selección: proyecto Rust → perfil Rust; proyecto Go → perfil Go; mixto → perfiles
  combinados; comando ausente → estado explícito; override del proyecto → gana al default.

  Implementado en `src/roadmaps/context.ts` y el middleware de enrichment: el roadmap seleccionado
  se inyecta después de la skill, con límites de 4k por perfil, 3k por documento y 12k total. El
  proyecto puede declarar inclusiones/exclusiones en `docs/roadmaps/project-overrides.yaml`; el
  override actual selecciona explícitamente `architecture` y `ai-agents` para OrchestOS porque la
  heurística no puede inferir esas disciplinas con seguridad. `cargo test` y `go test ./...` se
  agregan como checks cuando hay manifiesto y toolchain verificado; cada resultado conserva comando,
  exit code, duración y versión observada. Si falta el toolchain para un output Rust/Go, la tarea
  queda `blocked` antes del LLM y el contexto registra `missing/blocked`, nunca `pass`.
  Tests: `src/__tests__/roadmap-context.test.ts` (4 casos Rust/Go/mix/override/missing), más
  `roadmap-profile.test.ts` y `checks.test.ts`. Verificación M4: `bunx tsc --noEmit` limpio y
  `bun test src/__tests__/roadmap-context.test.ts src/__tests__/checks.test.ts src/__tests__/roadmap-profile.test.ts`
  (51 pass, 0 fail).

### M.5 — 🔍 Gate de onboarding técnico

- [x] **M.5 — 🔍 (2026-07-29)** Flujo completo probado con `orchestos roadmap check` +
  `loadRoadmapContext()` reales (no simulados) contra 3 fixtures: OrchestOS mismo, y dos proyectos
  nuevos creados para este gate —
  [tests/fixtures/roadmap-onboarding/rust-hello](tests/fixtures/roadmap-onboarding/rust-hello)
  (`Cargo.toml` + `src/main.rs` con test inline `#[cfg(test)]`) y
  [.../go-hello](tests/fixtures/roadmap-onboarding/go-hello) (`go.mod` + paquete con `_test.go`
  real). Cada fixture recibió una copia puntual de los docs de disciplina/lenguaje relevantes
  (`qa-seguridad.md` + `rust.md`/`go.md`) para poder probar el flujo de selección/consumo end-to-end
  — no hay todavía un mecanismo que provisione esto automáticamente (hallazgo, ver abajo).

  **Bug real encontrado y corregido por el gate** (el tercero de esta cadena, tras los 2 de M.3):
  la detección de `qa-seguridad` solo reconocía la convención JS/TS (`*.test.ts`/`*.spec.js`) —
  ambos fixtures, con tests reales, salían `missing`. Se agregó reconocimiento de `_test.go` (Go) y
  de `#[cfg(test)]`/directorio `tests/` (Rust) en
  [roadmap-profile.ts](src/detect/roadmap-profile.ts) (`findTestSignals()`). 2 tests de regresión
  nuevos confirman ambas convenciones.

  **Checklist del desarrollador nuevo, verificado contra el contenido real de cada doc** (no
  supuesto): `docs/roadmaps/languages/{rust,go}.md` responden qué instalar (`rustc`/`cargo`,
  `go`/módulos), cómo compilar/formatear, cómo testear (`cargo test`, `go test ./...`), seguridad
  (`cargo audit`/`govulncheck`, con nota explícita de que ausencia = `missing`, no se asume), y cada
  uno tiene sección "No asumir" que impide tratar el lenguaje como garantía de tooling. Deploy/
  rollback viven en la disciplina `devops.md`, no en el perfil de lenguaje — confirmado que no se
  duplica contenido entre capas.

  **Verificación en vivo de que nada se inventa** (sin `rustc`/`cargo`/`go` instalados en esta
  máquina): tanto el CLI como `loadRoadmapContext()` muestran `toolchain Rust`/`toolchain Go` como
  `missing` de punta a punta para ambos fixtures — el sistema completo (detección → selección →
  contexto de tarea) nunca produce un `verified` falso cuando el comando real no existe.

  **2 límites reales encontrados y documentados, NO resueltos en este gate** (decisión pendiente de
  Carlos, no de un LLM): (1) `orchestos init` no provisiona `docs/roadmaps/` en un proyecto nuevo —
  hoy el sistema solo tiene contenido real para OrchestOS mismo; (2) el presupuesto de 12k chars de
  `loadRoadmapContext` (M.4) ya no alcanza para las 6 disciplinas + lenguajes que aplican a
  OrchestOS mismo — se recorta con `missing` visible (nunca en silencio), pero el recorte es real.
  Ambos anotados en [CONTEXT.md § Invariante roadmap](CONTEXT.md).

  Resumen copiado a [DONE.md § Mes 24](DONE.md). Verificación: `bun run typecheck` limpio, suite
  completa `1010 pass`, `0 fail`, `2303 expect() calls` en `98` archivos.

**Regla de evolución:** cuando aparezca un nuevo lenguaje o framework, primero se crea/actualiza su
perfil y fixture; después se permite convertirlo en skill automática. Los hallazgos se documentan en
este bloque antes de modificar el motor. Así OrchestOS aprende de forma acumulativa y no depende de
que Carlos o un LLM recuerden todos los protocolos en cada sesión.

---

## MES 25 — Pendientes heredados de los cierres 22–24

Este mes conserva pendientes reales que no se cierran por arrastre documental (cada uno mantiene su procedencia y evidencia completa en [DONE.md](DONE.md)) **y, desde 2026-07-30, abre la ejecución del backlog canónico por esfuerzo de [IDEAS.md](IDEAS.md)** — el orden ahí es el único orden de ejecución, y al graduar una idea se elimina de IDEAS.md en el mismo commit (regla de flujo IDEAS→PLAN→DONE).

**Tabla de estado del proyecto (2026-08-02)**

| Mes | Bloques | Estado |
| --- | --- | --- |
| Mes 22 / v0.13 | A–K | ✅ Cerrado formalmente, sin pendientes |
| Mes 23 | L | ✅ Cerrado — L.5.7 (2026-07-30) y **L.6.2 (2026-08-02)**, sin pendientes |
| Mes 24 | M | ✅ Cerrado formalmente, sin pendientes (resueltos 2026-07-30) |
| Mes 25 | Pendientes heredados + N, O, P | ⏳ Todos los bloques cerrados (N, O, P — P.4 el 2026-08-06); falta la ceremonia formal de cierre de mes ([[feedback-orden-desarrollo]]) |

**Desglose del Mes 25 (2026-08-02)** — se agrega porque la tabla anterior enterraba una semana
entera de trabajo dentro de "Pendientes heredados" sin decir qué había adentro; Carlos reportó
desorientación real por esto en la revisión del 2026-08-02.

| Bloque | Qué es | Estado |
| --- | --- | --- |
| Pendientes heredados | K.6.2-R7, L.5.7, L.6.2, M ×2 | ✅ **todos cerrados** (L.6.2 el 2026-08-02, era el más viejo) |
| **N** | Endurecimiento de skills (Iron Law / Rationalizations / Red Flags) | ✅ **N.1–N.7c cerrado completo** (N.7c el 2026-08-05) |
| **O** | Skills que se activan solas (el problema de fondo: no invocarlas por nombre) | ✅ **cerrado completo** (O.0–O.4, O.4 el 2026-08-05) |
| **P** | Vigilancia de deriva de fuentes externas (`sources-drift`) | ✅ **cerrado completo** (P.1–P.4, P.4 el 2026-08-06) |

**Estado de CI (2026-08-02)**: verde. Estuvo rojo en el **100%** de los pushes desde 2026-07-29
hasta 2026-08-01 14:01; verde desde 2026-08-01 14:03, 6 pushes seguidos. El hook `pre-push`
(`scripts/pre-push.sh`) corre el comando exacto de CI antes de cada push — ver CLAUDE.md.

### Pendientes explícitos

- [x] **K.6.2-R7 — Endurecimiento de comportamientos críticos (cerrado 2026-07-30).** Carlos aceptó `51.76%` como baseline funcional de `qa.ts`, re-verificado por Claude corriendo `mutation:qa` en limpio: confirma que ningún sobreviviente altera lógica de veredicto. Historial completo: [DONE.md § Mes 22](DONE.md).
- [x] **L.5.7 — Linaje versionado y rollback de migraciones (cerrado 2026-07-30).** L.5.7.1–L.5.7.7 estaban documentados y verificados; solo faltaba marcar el ítem contenedor. Historial completo: [DONE.md § Mes 23](DONE.md).
- [x] **L.6.2 — Gate manual de seguridad (cerrado 2026-08-02).** Procedía de Mes 23 y llevaba 4 días abierto. **El bloqueo era del entorno de la sesión del 2026-07-29, no del producto**: aquella sesión no tenía navegador controlable y el dashboard daba `EADDRINUSE` en los puertos probados. En esta sesión levantó sin problema (`PORT=4311`) y hubo navegador real (Playwright).
  - **Revisión visual en navegador real** (no `route()`/`Request` simulados): home = Chat sin auto-redirect ([[feedback-home-siempre-chat]]), Project con sus 3 pestañas, Runs (45 runs / 41 done / 4 failed, filtros y detalle expandible con ENGINE+PROCESS), Graph Runner con el DAG real, advanced mode. Sin errores de consola ni fallos de render. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).
  - **Exportar**: `GET /api/project/summary` real → HTTP 200, PDF válido de 2 páginas, `strings` sobre el binario no encuentra `sk-or-*`/`sk-ant-*`/`*_API_KEY`.
  - **Diagnosticar**: la propiedad de seguridad (redacción, añadida 2026-07-30) verificada por test — prueba el prompt exacto que sale al proveedor, más riguroso que una llamada en vivo.
  - **Ejecutar tarea / worktree**: decisión de Carlos — cerrar con la cobertura existente (`contract` 18, `sandbox-policy` 8 + mutation testing, `path-policy` 5, `git-lock` 4, más engines externos) en vez de gastar dinero real; las propiedades de *seguridad* están cubiertas, lo que falta es confirmación e2e con dinero, que no es una propiedad de seguridad nueva. **Zona gris documentada explícitamente, no barrida bajo la alfombra.**
  - **Extra no pedido**: `GET /api/runs` sobre 45 runs reales → sin filtración de secretos; el listado ni expone `prompt`/`result` crudos.
  - **`L62-001` (migración concurrente) → ACEPTADO** por Carlos: local, un usuario, sin exfiltración. Documentado como limitación conocida. Si algún día se corrige, el patrón ya existe (`src/run/git-lock.ts`, [[reference-git-lock-worktree-pattern]]) — no hay que diseñarlo.
  - **`L62-002` (key persistida antes de validar) → MITIGADO** en el mismo turno: [setup.ts](src/dashboard/handlers/setup.ts) ahora **valida primero y persiste solo en el camino válido**; ningún camino de fallo escribe (antes, timeout/red/500 dejaban la key sin validar en texto plano y solo el 401 revertía).
  - **Hallazgo colateral corregido:** `settings-store.ts` era el **único** módulo que no honraba `ORCHESTOS_HOME` — apuntaba al `~/.orchestos/.env` REAL, lo que hacía intestable el camino de escritura sin arriesgar las keys de Carlos ([[reference-test-fixtures-leak-into-real-db]]). Alineado con `db/sqlite.ts`/`model-catalog.ts`/`opencode-catalog.ts`, resolviendo la ruta por llamada (no en un `const` de módulo, gotcha ya documentado en `model-catalog.ts:96-99`). `ENV_FILE` → `envFilePath()`.
  - 6 tests de regresión nuevos contra `ORCHESTOS_HOME` temporal; verificado que el `.env` real quedó **byte-idéntico** tras la suite. 1066 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde. Evidencia completa en [docs/security-manual-review.md](docs/security-manual-review.md).
- [x] **M — Provisioning de roadmaps para proyectos nuevos (cerrado 2026-07-30, decisión Carlos: centralizado, no copiado).** Carlos decidió que `docs/roadmaps/{engineering-baseline,disciplines,languages}` NO viaja copiado a cada proyecto — es conocimiento de OrchestOS, centralizado, y cualquier proyecto que gestione lo lee desde ahí. `project-profile.md` es la única excepción (describe el repo detectado, sigue siendo por proyecto, nunca cae al fallback). Implementado: `src/detect/roadmap-profile.ts` (`findLanguageDoc`/`docExists` ahora prueban `root` primero y caen a `ROADMAP_DOCS_ROOT`, la instalación de OrchestOS vía `import.meta.dir`) y `src/roadmaps/context.ts` (mismo fallback en `readBounded()` para el contenido, nunca para `profilePath`). Verificado en vivo con un proyecto Rust real sin `docs/roadmaps/` propio: `Lenguaje: Rust` pasa a `known`/`selected` con contenido real; `project-profile.md` correctamente ausente. Tests actualizados (2 nuevos, 2 reescritos con C# como caso "verdaderamente missing" ya que Rust/Go/TS ahora resuelven por fallback). 1013 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **M — Presupuesto de contexto de roadmaps (cerrado 2026-07-30).** Verificado en vivo antes de tocar código: `loadRoadmapContext()` corrido contra este mismo repo confirmó que el presupuesto de 12.000 chars SÍ se agotaba en producción (11.781/12.000, omitiendo `architecture`, `ai-agents` y el lenguaje TypeScript — el principal de OrchestOS). El total real necesario sin truncar es ~22.800 chars; los archivos individuales más grandes (`backend.md` 3.407, `typescript-bun.md` 3.711) ya excedían el tope por-documento de 3.000. Subidos `MAX_TOTAL_CHARS` 12.000→26.000 y `MAX_DOC_CHARS` 3.000→4.000 en [src/roadmaps/context.ts](src/roadmaps/context.ts). Reverificado en vivo: 22.962 chars, cero truncado, las 6 disciplinas + TypeScript + Rust entran completos.

### Bloque N — 🧠 IDEAS #1: endurecimiento de skills (Iron Law / Common Rationalizations / Red Flags)

Primer ítem del backlog canónico de IDEAS.md (categoría **Mínimo**, graduado 2026-07-30). Origen:
delta pendiente de [obra/superpowers](https://github.com/obra/superpowers) y
[mattpocock/skills](https://github.com/mattpocock/skills) — el curador + pack "pro" ya está
shipeado (Mes 11). El objetivo real no es "más contenido": es que una skill **se respete bajo
presión** en vez de ignorarse cuando el agente encuentra una excusa para saltársela.

**Corrección de alcance sobre IDEAS #1 (verificada en código, 2026-07-30):** la idea afirmaba
*"Esfuerzo: mínimo — autoría + paso por la puerta importar. Sin código."* — **es falso**.
`buildSections()` ([src/skills/targets/_shared.ts:3](src/skills/targets/_shared.ts)) es el ÚNICO
renderer skill→prompt y solo conoce 6 campos (`instructions`, `when_to_use`, `inputs_required`,
`anti_patterns`, `verifiers`, `examples` + `language_targets`); `SkillDef`
([src/skills/registry.ts:18](src/skills/registry.ts)) tampoco declara los campos nuevos, y
`validateSkill()` no es strict — **un `iron_law:` en el YAML cargaría sin error y jamás llegaría al
LLM**. Autoría sin wiring = contenido muerto. Por eso el bloque arranca por el contrato, no por el
contenido. Sigue siendo un bloque chico, pero no es cero código.

- [x] **N.1 — 🧠** (2026-07-31) Extender el contrato de skill en
  [src/skills/registry.ts](src/skills/registry.ts): `iron_law?: string` (la regla innegociable, una
  sola), `common_rationalizations?: { excuse: string; refutation: string }[]` (la excusa que el
  agente se dice + su refutación — el par es el punto, una lista plana de excusas sin refutar sería
  darle munición), `red_flags?: string[]`. Añadir validación en `validateSkill()` con el mismo
  patrón de los campos existentes (tipos, arrays no vacíos, `excuse`/`refutation` ambos presentes) y
  un cap de longitud para `iron_law` (es una regla, no un párrafo). Tests de validación.
- [x] **N.2 — 🧠** (2026-07-31) Renderizar los 3 campos en `buildSections()`
  ([src/skills/targets/_shared.ts](src/skills/targets/_shared.ts)) con **orden deliberado, no
  append al final**: `iron_law` va **antes** de `instructions` (hoy `sections[0]` es
  `skill.instructions` — cambiarlo afecta el prompt de las 24 skills existentes, es el punto del
  ítem: la regla innegociable se lee primero, no sepultada); `common_rationalizations` y
  `red_flags` van **después** de `anti_patterns` (son su escalón siguiente: anti_patterns dice qué
  no hacer, rationalizations dice con qué excusa te lo vas a permitir). Verificar los 3 targets
  (`claude`/`cursor`/`openai`) — comparten `_shared.ts`, confirmar que ninguno reordene por su
  cuenta. Tests de render.
- [x] **N.3 — 🧠** (2026-07-31) Enseñar los campos nuevos a la **puerta importar del curador**
  ([src/dashboard/prompts/curator.ts](src/dashboard/prompts/curator.ts), líneas ~17 y ~45 describen
  el contrato al LLM): sin esto, toda skill importada de ahora en adelante nace sin `iron_law` y el
  endurecimiento solo aplicaría a lo ya existente — la puerta por la que IDEAS #1 decía que esto
  entra quedaría desalineada del contrato real.
- [x] **N.4 — ⚡** (2026-07-31) Superficie en dashboard (regla [[feedback-dashboard-no-solo-cli]]): los 3 campos
  en el detalle de skill y en el formulario de creación/edición
  ([src/dashboard/public/app.js](src/dashboard/public/app.js) ~936/949/1076/1131/1146/1250) +
  claves i18n **en inglés y español** ([src/dashboard/public/i18n.js](src/dashboard/public/i18n.js)
  ~499/544/1255/1300). `common_rationalizations` se edita como un par `excuse :: refutation`
  por línea (se separa solo en el primer delimitador), no como `listField` plano. La superficie
  también incluye esos campos en el preview de importación y en el preview YAML del formulario.
  Verificado: `bunx tsc --noEmit`, `git diff --check` y 42 tests relevantes pasan.
- [x] **N.4.5 — 🧠 BLOQUEANTE (hallazgo 2026-07-31, cerrado 2026-07-31).** N.1–N.3 endurecieron **solo la vía de
  exportación**. `buildSections()` lo llaman únicamente los 3 targets que OrchestOS *escribe para
  otras herramientas* ([claude.ts:12](src/skills/targets/claude.ts),
  [cursor.ts:12](src/skills/targets/cursor.ts), [openai.ts:10](src/skills/targets/openai.ts)). El
  runner propio **no lo usa**: inyecta `skill.instructions` crudo, duplicado en dos lugares
  ([prompt.ts:58](src/run/prompt.ts) y
  [skill-route.ts:8](src/run/middlewares/skill-route.ts)) — el mismo snippet copiado, divergente del
  renderer canónico. Consecuencia: el `iron_law` llega a Claude Code y a Cursor, **nunca al ejecutor
  de OrchestOS**. Es el mismo fallo de "autoría sin wiring = contenido muerto" que motivó la
  corrección de alcance de este bloque, una capa más abajo. Unificar ambos sitios sobre
  `buildSections()`. Va **antes** de N.5: sin esto el bloque cerraría con 5 skills endurecidas cuya
  regla innegociable no aplica en ninguna corrida real.
- [x] **N.5 — ⚡** Autoría piloto de **5 skills** (decisión Carlos 2026-07-31: las 5, no las 24):
  `tdd-enforcer`, `security-review`, `qa-structured`, `test-writer`, `frontend-design` — las que un
  ejecutor barato tiene más incentivo a esquivar (escribir el test después, "el linter ya lo cubre",
  "se ve bien así"); `test-writer`/`qa-structured` conectan directo con el antipatrón que persigue
  [IDEAS.md #54](IDEAS.md) (tests que pasan vacíamente).
  **Alcance corregido (2026-07-31):** el ítem NO es solo `iron_law` + `common_rationalizations` +
  `red_flags`. El clasificador de selección automática **no lee el `iron_law`** — lee `description`
  + `when_to_use` ([project.ts:143-145](src/dashboard/handlers/project.ts)). Esos dos campos **son
  el criterio de disparo**, y por lo tanto son la parte de este ítem que habilita el Bloque O.
  Verificado 2026-07-31: 21/24 skills tienen `when_to_use`; **sin él están `fix-typescript-errors`,
  `generate-prisma-migration` y `summarize-pr-diff`** — hoy prácticamente inelegibles de forma
  automática. Escribir `description` como condición de disparo ("Use when…"), no como resumen.
  Las 5 piloto deben escribirse ya con el contrato de activación de O.2 definido, para no volver a
  generar contenido que el motor no sabe interpretar.
  **Cerrado 2026-08-02.** Las 5 skills (`skills/*.yaml`) recibieron: `description` reescrita como
  condición de disparo ("Use when…", antes eran resúmenes); `iron_law` (una regla, ≤300 chars);
  3 `common_rationalizations` (excusa real que un ejecutor barato usaría + su refutación, no
  genéricas); 3 `red_flags` observables en el diff/output, no juicios subjetivos; y `activation`
  (O.0) — `security-review`/`qa-structured` en `mode: automatic` + `phases: [review]`
  (`security-review` además con `triggers:` deterministas: auth/secrets/user_input/file_upload/
  api_endpoint — es un gate, no debe depender del juicio semántico del mismo LLM que hace el
  trabajo); `tdd-enforcer`/`test-writer`/`frontend-design` en `mode: suggest` +
  `phases: [implement, fix]` (guían el trabajo, no lo bloquean). Verificado contra el registro real
  (`loadSkill()`/`validateSkill()`, no solo YAML a ojo) y contra `buildSections()`: el `iron_law` de
  `security-review` compila antes de las instrucciones — el gate de N.4.5 funciona con contenido
  real, no solo con el fixture de test. `tsc --noEmit` limpio, `bun run test:coverage` (comando
  exacto de CI): 1044 tests, 0 fail, cobertura sobre el umbral.
- [x] **N.5.1 — 🧠 Corrección de fidelidad contra la fuente real (2026-08-02).** Carlos pidió volver
  a la fuente antes de dar N.5 por bueno — patrón recurrente suyo en otros proyectos ("por escribir
  muy general a veces se pierden detalles"). Auditoría contra el código fuente real (`gh api`, no
  memoria ni suposición) de las 5 skills:
  - **`tdd-enforcer` — hallazgo confirmado, no hipótesis.** `obra/superpowers`
    (`skills/test-driven-development/SKILL.md`, MIT) es el origen literal del patrón "Iron Law /
    Common Rationalizations / Red Flags" que da nombre a este Bloque N — no una inspiración vaga, el
    vocabulario es idéntico. Su tabla real tiene **10** rationalizations con refutación específica y
    **13** red flags verificados en batalla; N.5 había escrito **3+3 genéricas, inventadas**. Corregido:
    las 10+13 ahora viven en [skills/tdd-enforcer.yaml](skills/tdd-enforcer.yaml) copiadas fieles al
    original (excuse/refutation ≈ Excuse/Reality de la fuente), con comentario de atribución en el
    YAML. Recargado contra `loadSkill()` real: 10 rationalizations, 13 red_flags, valida limpio.
  - **`security-review` y `test-writer` — sin fuente 1:1.** Revisada la lista completa de skills de
    `obra/superpowers` (`brainstorming`, `verification-before-completion`, `systematic-debugging`,
    `writing-plans`, etc.) — ninguna es de seguridad OWASP ni de "agregar tests a código existente".
    Según DONE.md (líneas 2263-2265) nacieron directo en S18 (2026-05-27) sin importación. No hay
    pérdida de fidelidad posible porque nunca fueron traducción de nada — contenido propio.
  - **`qa-structured` — prima, no copia.** `verification-before-completion` (superpowers) comparte
    el principio ("evidencia antes que afirmación") pero es una skill distinta (esa es "no digas que
    terminaste sin correr el comando"; la nuestra evalúa contra criterios de aceptación). Sin drift
    porque nunca fue traducción de esa skill.
  - **`frontend-design` — verificado contra `pbakaus/impeccable` (Apache 2.0), fiel.** El YAML ya
    citaba la fuente explícitamente. Se comparó contra el detector mecánico real del plugin
    (`scripts/detector/rules/checks.mjs`, 5580 líneas — el linter real, no solo prosa): contraste
    4.5:1/3:1 coincide exacto (`reference/colorize.md:59-61`), `gradient-text`
    (`background-clip:text`+gradient) coincide exacto (`checks.mjs:175-176`), `eyebrow chip` y
    `round-dot radius` coinciden en concepto. Veredicto: distilación fiel, no genérica — no requiere
    corrección.
  - **Hallazgo adicional, fuera de alcance de N.5, anotado para no perderlo:**
    `VoltAgent/awesome-design-md` (vault:
    `raw/ai/skills/VoltAgentawesome-design-md...md`) es una colección de `DESIGN.md` por marca
    (Stripe, Apple, Linear, etc. — formato Google Stitch) que un agente lee para clonar el lenguaje
    visual de una marca específica. **No es una corrección de `frontend-design`/`design-tokens`** —
    es una capacidad nueva que OrchestOS no tiene (importar un `DESIGN.md` externo para una tarea
    puntual). Candidato de IDEAS.md, no se toca en este ítem.
- [x] **N.6 — 🔍** (cerrado 2026-08-02) Gate: verificar contra el **prompt real compilado**, no
  contra el YAML. Tests nuevos ([src/__tests__/skill-compile-gate.test.ts](src/__tests__/skill-compile-gate.test.ts))
  contra los 3 compiladores reales (`compileClaude`/`compileCursor`/`compileOpenAI`, no solo
  `buildSections()`) usando skills reales del repo, no fixtures: `security-review` (endurecida) —
  `iron_law` antes de `instructions` en los 3 targets; `diagnose` (sin campos nuevos) — cero
  secciones de endurecimiento, cero regresión.
  **Verificación en vivo en el dashboard de N.4** ([[feedback-verificar-gates-en-vivo]]), no solo
  `bun test`: servidor real levantado (`PORT=4310 bun run src/dashboard/server.ts`),
  `POST /api/skills/security-review/build` (el botón Build real de N.4) escribió
  `dist/skills/{claude,cursor,openai}/security-review.{md,mdc,json}` — inspeccionados en disco,
  `## Iron law` aparece antes de la sección OWASP en los 3. Mismo build contra `diagnose`: cero
  secciones nuevas, `instructions` arranca igual que antes de N.1. `GET /api/skills/security-review`
  (el detalle que consume N.4) devuelve `iron_law`/`activation`/`common_rationalizations`/
  `red_flags` reales. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).
  1060 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI)
  verde, cobertura sobre el umbral. **Bloque N cerrado por completo.**

#### ⚠️ Aclaración obligatoria sobre "las 5 piloto" (Carlos, 2026-08-02) — leer antes de tocar skills

**"5 piloto" fue una decisión sobre CUÁNTO CONTENIDO ESCRIBIR, no sobre qué skills usa OrchestOS.**
Si algún LLM (o Carlos en 3 meses) lee N.5 y concluye "OrchestOS ahora usa 5 skills", está mal.
Palabras de Carlos: *"no usar las 24 no significa descartar, significa usar cuando sea el caso de
usar"*.

- **Las 24 siguen activas e instaladas.** 16 en `skills/` + 8 en `skills/pro/`. Ninguna fue
  deprecada, borrada ni despriorizada. Las 19 que no recibieron `iron_law` simplemente **todavía no
  tienen ese contenido escrito** — siguen cargando, compilando y aplicándose exactamente igual que
  antes (verificado en N.6: `diagnose` sin campos nuevos compila idéntico a como compilaba antes de
  N.1, cero regresión).
- **Por qué Carlos quiere muchas skills** (criterio de producto, no colección): que sirvan **tanto a
  un dev como a un no-dev**. No busca acumular — busca "las suficientes para que sea de ayuda para
  el usuario". Una skill de más que nunca se activa no molesta (el Bloque O decide cuál aplica); una
  skill que falta sí deja al usuario sin ayuda en ese caso.
- **Corrección de un número que se cruzó esta semana:** son **24 skills**, no 34. El 34 eran los
  CLIs de agente que detecta Orca (`agent-kind.ts`, investigación de IDEAS #39) — concepto
  distinto, se mezcló en la misma semana.
- **La fuente de skills NO se abandona.** `obra/superpowers`, `mattpocock/skills` y el resto siguen
  siendo fuentes vivas de las que traer skills nuevas cuando haga falta — ver Bloque P
  (`sources-drift`), que existe justamente para no perderlas de vista.

**N.7 — Extender la auditoría de fidelidad (N.5.1) a las 19 skills restantes.** Pedido
  explícito de Carlos (2026-08-02): *"si se hizo con las 5 debe hacerse con el resto en base a las
  repos originales donde viven realmente cada una"*. **Prerequisito real: hoy no existe un registro
  confiable de procedencia por skill** — lo que hay está disperso y en parte es contradictorio.

  **Partido en dos (decisión Carlos, 2026-08-03).** Motivo: la descripción original ("largo y
  mecánico") era imprecisa — N.7 es largo, pero mecánico **solo en parte**. Y hay una ironía a
  respetar: *N.7 existe porque se escribió contenido genérico en vez de ir a la fuente*; delegar la
  parte de fidelidad a un modelo barato corre exactamente el mismo riesgo de parafrasear. Por eso el
  corte deja a Codex **sin poder tocar contenido**.

  Evidencia recogida el 2026-08-02, sin inventar el resto:
  - `skills/pro/` (8) — [DONE.md:3529](DONE.md) dice *"curados desde mattpocock/skills y
    obra/superpowers"* pero **no dice cuál vino de cuál**: `code-review`, `refactor-guided`,
    `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`,
    `doc-gen`. Mapeo probable pero **no verificado**: `code-review` ↔ mattpocock
    `engineering/code-review`; `bug-hypothesis` ↔ mattpocock `engineering/diagnosing-bugs`.
  - `skills/` (16) — [DONE.md:2208](DONE.md) declara nativas de S14.4–S14.8 (2026-05-27):
    `pre-task-alignment`, `diagnose`, `tdd-enforcer`, `context-compression`,
    `improve-architecture`; S18.1–S18.3 nativas: `security-review`, `qa-structured`, `test-writer`;
    [DONE.md:3151](DONE.md) declara 4 de diseño nativas: `frontend-design`, `ux-guidelines`,
    `design-brief-inference`, `design-tokens`.
  - **Contradicción real a resolver, no ignorar:** `improve-architecture` figura como *nativa* pero
    mattpocock tiene `engineering/improve-codebase-architecture` (nombre casi idéntico, y es una de
    las skills que Carlos tiene instaladas en su propio Claude Code). Igual `tdd-enforcer` (nativa)
    vs. mattpocock `engineering/tdd` **y** superpowers `test-driven-development` — de esta última
    sí se confirmó relación en N.5.1. "Nativa" en DONE.md puede significar "escrita acá" o "escrita
    acá inspirándose en X sin anotarlo" — hay que verificar caso por caso contra el upstream real,
    no confiar en la etiqueta.
  - Sin fuente externa conocida: `fix-typescript-errors`, `generate-prisma-migration`,
    `summarize-pr-diff` (además son las 3 sin `when_to_use`, ver N.5).
- [x] **N.7a — ⚡** (2026-08-03) Descubrimiento de procedencia (solo evidencia, NO toca contenido). Para cada una
  de las **24** skills (16 en `skills/` + 8 en `skills/pro/`), buscar en `obra/superpowers`
  (`skills/*/SKILL.md`) y `mattpocock/skills` (`skills/engineering/*`, y las otras categorías) si
  existe un archivo con nombre igual o parecido, vía `gh api`. Producir **una tabla de evidencia**
  en `docs/skills-provenance-audit.md` con, por fila: `skill local` · `candidato upstream (repo +
  path)` · `tamaño` · `primeras ~15 líneas del upstream` · `parecido del nombre (exacto / parcial /
  ninguno)`.
  Verificado contra los árboles completos de ambas repos en los commits consignados en el documento;
  24 skills auditadas, cero YAMLs modificados.
  **Límites duros de este ítem** — están para que la delegación no pueda reintroducir el error que
  motivó N.7: (a) **NO modificar ningún `.yaml` de `skills/`**; (b) **NO decidir** si un parecido es
  copia o coincidencia — solo reportar lo que existe; (c) **NO resumir ni parafrasear** el contenido
  upstream, pegar el fragmento literal; (d) si no hay candidato, escribir *"sin candidato"*, nunca
  inventar uno plausible. El entregable es un documento nuevo, cero cambios en skills.
- [x] **N.7b — 🧠 (2026-08-03) Decisión, porteo y registro para las 16 de `skills/` (sobre la tabla de N.7a).** (1) Decidir caso por caso
  si el parecido es copia derivada o trabajo independiente — es criterio, con el contexto del
  proyecto a la vista (ej. `improve-architecture` vs. mattpocock `improve-codebase-architecture`:
  DONE.md dice "nativa", el nombre dice otra cosa); (2) las que SÍ tengan fuente confirmada →
  portar **verbatim** el contenido rico perdido, como se hizo con `tdd-enforcer` (10
  rationalizations + 13 red flags en vez de 3+3 genéricas); (3) las genuinamente nativas → escribir
  contenido propio o dejarlas sin endurecer, pero **declarándolo**, no por omisión; (4) **cada
  fuente confirmada entra en [docs/sources-registry.yaml](docs/sources-registry.yaml)** (Bloque P)
  para que la deriva futura se detecte sola — hoy el registro solo tiene 5 entradas porque son las
  únicas verificadas; (5) `when_to_use` en las 3 que no lo tienen (`fix-typescript-errors`,
  `generate-prisma-migration`, `summarize-pr-diff`) — **esta parte es prerequisito de O.2**, sin ese
  campo son inelegibles para la selección automática, así que conviene adelantarla aunque el resto
  de N.7b espere.
  Al revisar lo que devuelva N.7a: **un `[x]` de una corrida delegada no es evidencia** — grepear lo
  concreto antes de confiar ([[feedback-verificar-progreso-delegado]]).

  **Resultado (evidencia completa en [docs/skills-provenance-audit.md](docs/skills-provenance-audit.md) § N.7b):**
  - **Verificada la entrega de Codex antes de usarla**: no tocó ningún YAML (commit `4b09004` toca
    solo 3 archivos, ninguno de `skills/`), usó "sin candidato" 14 veces (no inventó), y el
    spot-check de un fragmento contra el upstream real dio **byte-idéntico** (no parafraseó). 24/24
    cubiertas, con los SHA upstream declarados. Respetó los 4 límites duros.
  - **Las 16 de `skills/` son NATIVAS.** Los 4 candidatos con parecido de nombre resultaron
    coincidencias **solo léxicas**, verificado leyendo el contenido: `qa-structured` vs el `qa` de
    mattpocock (el upstream abre issues de GitHub conversando; el nuestro da un veredicto pass/fail
    contra criterios), `security-review` vs `code-review` (OWASP vs Standards+Spec),
    `frontend-design` vs `design-an-interface` (diseño de API de módulo, no visual — su fuente real
    es Impeccable, ya verificada en N.5.1), y `test-writer` vs TDD (opuesto: la implementación ya
    existe). **`improve-architecture` queda resuelto**: el upstream *rechaza explícitamente* las
    heurísticas rígidas que el nuestro usa (>300 líneas, >5 imports) y depende de primitivas de
    Claude Code que OrchestOS no tiene — la etiqueta "nativa" de DONE.md **era correcta**, la
    contradicción marcada en N.7 se cierra. **No había contenido perdido que portar en esta
    carpeta**: el riesgo que motivó N.7 no se materializó acá.
  - **Hallazgo de método — match nominal ≠ match semántico.** N.7a emparejó `diagnose` con
    mattpocock `diagnosing-bugs` por nombre, y esa **no tiene contenido portable**; el match real
    era `obra/superpowers/skills/systematic-debugging` (Iron Law + 8 rationalizations + red flags),
    que una búsqueda por nombre jamás encuentra. **Esto valida el corte N.7a/N.7b**: buscar es
    delegable, *decidir qué es la misma cosa* no.
  - **Porteo aplicado**: `diagnose` recibió `iron_law` + 8 `common_rationalizations` + 7
    `red_flags` casi verbatim de `systematic-debugging`, y la fuente quedó registrada en
    [sources-registry.yaml](docs/sources-registry.yaml) (6 entradas, `sources:drift` verde).
  - **`when_to_use` faltantes: resueltos.** Los 3 escritos y sus `description` reescritas como
    condición de disparo. **0 skills sin `when_to_use`** (eran 3) — **prerequisito de O.2 cerrado**.
  - **Fixture frágil corregido de paso**: el gate de N.6 tenía `diagnose` hardcodeada como "skill
    sin endurecer"; endurecerla puso 4 tests en rojo por un fixture obsoleto, no por una regresión.
    Ahora la elige dinámicamente (con fallback sintético si algún día todas están endurecidas), así
    cada avance de N.7c no vuelve a romperlo.
  - 1073 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **N.7c — 🧠 (2026-08-05) Auditoría de las 8 de `skills/pro/` (sobre la tabla de N.7a).**
  Leído el contenido completo de los 4 candidatos con parecido nominal (`systematic-debugging`,
  `receiving-code-review`, `requesting-code-review` de `obra/superpowers`; `code-review` y
  `request-refactor-plan` de `mattpocock/skills`), no solo el nombre — mismo método que N.7b.

  **Decisiones:**
  - **`bug-hypothesis` vs `systematic-debugging`: coincidencia léxica, no copia.** El upstream
    (Fase 3, "Hypothesis and Testing") pide **una** hipótesis a la vez, root-cause primero; nuestro
    `bug-hypothesis` es lo opuesto a propósito: triage rápido que **rankea 3-5 candidatos** ANTES de
    tocar código, paso previo a un debugging profundo. Además su Iron Law/rationalizations ya están
    portados en `skills/diagnose.yaml` (N.7b) — duplicarlos acá sería redundante, no fidelidad.
    **Nativa, sin porteo.**
  - **`refactor-guided` vs `request-refactor-plan`: coincidencia léxica, no copia.** El upstream es
    una fase de **planificación** (entrevista al usuario, abre un issue de GitHub con plantilla);
    `refactor-guided` es la fase de **ejecución** (pasos chicos, tests verdes en cada uno). Ninguna
    superposición de contenido — el upstream ni siquiera tiene tabla de rationalizations/red_flags
    que portar (confirmado leyendo las 68 líneas completas, no solo el fragmento de N.7a).
    **Nativa, sin porteo.**
  - **`code-review` vs `receiving-code-review`/`requesting-code-review`: coincidencia léxica, no
    copia.** Ambas superpowers skills son sobre **recibir** feedback o **despachar** un subagente
    revisor — actores y mecánica distintos al nuestro (que **da** la revisión, 4 passes sobre un
    diff). `receiving-code-review` no tiene contraparte local (no existe una skill de "cómo
    responder a review" en `skills/pro/`). **Sin porteo de estas dos.**
  - **`code-review` vs mattpocock `engineering/code-review`: SÍ hay contenido portable**, a
    diferencia del veredicto de N.7b para `security-review` contra la misma fuente (ahí era
    coincidencia total). El diseño de 2 ejes con subagentes paralelos no es portable (depende de
    `docs/agents/issue-tracker.md` y de convocar Agent tool en paralelo, que nuestro Pass-based
    review no usa), **pero el catálogo de 12 code smells de Fowler** (*Refactoring* ch.3) que el
    upstream usa como baseline de la Standards axis es contenido genérico y real, no específico de
    su mecánica. Portado a la Pass 2 (Design) de
    [skills/pro/code-review.yaml](skills/pro/code-review.yaml): Mysterious Name, Duplicated Code,
    Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent
    Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest — cada uno con su
    fix de una línea, igual que el upstream. También un `anti_pattern` nuevo ("no saltar review por
    simple"), adaptado del Red Flags de `requesting-code-review`. Registrado en
    [sources-registry.yaml](docs/sources-registry.yaml) (`mattpocock-code-review-smells`).
  - **Las otras 5 (`api-contract`, `db-migration-safe`, `doc-gen`, `perf-profile`,
    `pr-description`): sin candidato en N.7a, confirmado sin overlap conceptual al releerlas.
    Nativas.**

  **Conclusión:** de 8 skills de `skills/pro/`, 7 son nativas y 1 (`code-review`) recibió un porteo
  real y acotado (un catálogo de smells, no una reescritura). Documentado en
  [docs/skills-provenance-audit.md § N.7c](docs/skills-provenance-audit.md). Cierra Bloque N por
  completo (N.1–N.7c).

### Bloque O — 🧠 Skills que se activan solas (decisión Carlos 2026-07-31)

**Problema de raíz, en palabras de Carlos:** *"tengo muchas skills pero tengo que llamarlas — yo,
incluso un usuario avanzado, no me voy a acordar de tantos comandos. Quería traer las skills a
cualquier proyecto como una 'armadura' para ciertas 'batallas', pero no por tenerlas debo usarlas
todas: debe haber un criterio. Y una tarea conlleva varias skills, no una."*

**Hallazgo que redujo el alcance (verificado en código 2026-07-31): el 90% ya existe.** La
intuición de "subdividir la tarea para que cada skill se aplique en su campo" **ya es cómo funciona
OrchestOS**: `planner.ts` descompone en un DAG de sub-tareas, `SubTask` **ya tiene su propio campo
`skill`** ([sub-task-schema.ts:248](src/agents/sub-task-schema.ts)), `subTaskToTask()` lo pasa a
`Task.skill` ([executor.ts:139](src/agents/executor.ts)) y de ahí va al harness → `skillRoute` →
prompt. El límite de "1 skill por tarea" **no es del modelo de datos** — es de la creación manual.
El cable suelto: **`planner.ts` menciona la palabra `skill` cero veces**; su schema JSON obliga
`id`/`description`/`acceptance`/`depends_on`/`allowed_tools` y nunca `skill`. El único componente
que decide cómo se reparte el trabajo es ciego al arsenal.

**Por eso este bloque REEMPLAZA la propuesta N-AUTO.1–5** (contrato de activación / descubrimiento /
activación por fases / evidencia / gate): mezclaba conceptos nuevos con mecanismos que ya existen.
Descartado explícitamente por sobreingeniería: embeddings (24 skills, un clasificador barato contra
lista cerrada alcanza — ver [docs/semantic-skill-selection-design.md](docs/semantic-skill-selection-design.md));
una máquina de fases nueva (`TaskClass = plan|implement|fix|review|doc` ya existe en
[classify.ts:7](src/router/classify.ts) y ya se persiste en `runs.task_class`); y migrar
`Task.skill` a `{primary, gates}` (el DAG ya da la multiplicidad; los gates son transversales, no
van en el `Task`).

Los tres mecanismos se separan a propósito — tratarlos como uno solo es lo que hacía parecer esto
un problema grande: **retrieval** (qué skills son relevantes), **binding** (dónde se engancha cada
una — ya existe, es el DAG) y **enforcement** (cuáles no son negociables).

- [x] **O.0 — 🧠 Contrato de activación mínimo (prerequisito de O.2 y O.3).** (cerrado 2026-08-02,
  adelantado como prerequisito real de N.5 — sin esto, escribir `activation:` en las 5 skills piloto
  habría sido el mismo "contenido muerto" que motivó N.1-N.3). Implementado en
  [src/skills/registry.ts](src/skills/registry.ts): `SkillActivation { mode, triggers?, phases? }`,
  `phases` tipado como `TaskClass[]` (import type de
  [router/classify.ts](src/router/classify.ts), sin taxonomía nueva) y validación en
  `validateSkill()` con el mismo patrón que los campos de N.1 (mode contra allowlist, triggers/phases
  no vacíos y tipados). 12 tests nuevos. `tsc --noEmit` limpio, 1044 tests, cobertura sobre el
  umbral de CI. Consumo real (O.2/O.3: el planner y los gates leyendo este campo) queda para cuando
  se ataque el resto del Bloque O — este ítem es solo el contrato, adelantado.

  Contexto original (2026-07-31), tras contrastar con el análisis de Codex: la primera versión de
  este bloque descartó el contrato
  de activación entero por sobreingeniería y **sobre-corrigió** — O.2 y O.3 dependían en silencio de
  una declaración que **no existe en ningún lado**. Verificado: `activation` / `mandatory` /
  `trigger` dan **cero resultados** en `src/skills/` y en las 24 YAML. Sin esto, "skill obligatoria
  por señal de riesgo" termina hardcodeado en el código y deja de ser portable a otros proyectos
  (contradice O.1). Es un artefacto verificable en el punto de decisión, no prosa (INS-2026-001).
  **Exactamente 3 campos, nada más:**
  - `activation.mode: automatic | suggest | explicit` — resuelve el segundo hueco: hoy **nadie
    construye el modo sugerir para el camino automático**. Ojo, el modo sugerir **ya existe en el
    camino manual**: `renderSkillSuggestion()`
    ([screens-core.js:165](src/dashboard/public/screens-core.js)) ya define la convención (0
    candidatas → sin campo; 1 → precargada; 2+ → "Ninguna" preseleccionada, *"nunca resolver el
    empate a ciegas"*). Esa filosofía conservadora es **la misma** que hace que `pickAutoSkill()`
    devuelva `undefined` con 2+ candidatas. **No es un bug: es una regla deliberada que servía
    cuando había un humano mirando el composer y que, desde que D.7 crea tareas sola, se traduce en
    "no se aplica ninguna skill nunca".** Es el origen concreto del dolor que reporta Carlos.
  - `activation.triggers: string[]` — **solo para gates**, y deterministas/observables (tocó
    archivos de auth, la tarea declara endpoints, hay secretos en el diff). **Distinción
    arquitectónica central del bloque:** una skill de implementación puede activarse por
    clasificador semántico (`when_to_use` en lenguaje natural, tolerante y flexible); **un gate de
    seguridad NO** — si se activa porque a un LLM le pareció que había autenticación, falla
    exactamente cuando el LLM se equivoca, o sea en los casos raros, que son los peligrosos. Un gate
    que depende del mismo juicio probabilístico que puede fallar **no es un gate, es una sugerencia
    con mejor nombre**.
  - Fase de aplicación: **reusar `TaskClass`** (`plan|implement|fix|review|doc`,
    [classify.ts:7](src/router/classify.ts), ya se persiste en `runs.task_class`) — **no** inventar
    un campo `phases`.

  **Descartado explícitamente de la propuesta de Codex** (evaluado con el código a la vista, no por
  capricho): `requires_confirmation` (redundante con `mode: suggest`); `composes_with`, conflictos y
  `confidence` (no hay consumidor — config que nadie lee); `phases` como campo nuevo (`TaskClass` ya
  existe); y la taxonomía de 6 tipos de skill (implementación/análisis/revisión/verificación/
  seguridad/diseño) — **dos categorías alcanzan**: *guía el trabajo* vs *lo bloquea*; seis tipos sin
  diferencia de comportamiento es config decorativa.
- [x] **O.1 — 🧠 (C) Las skills se resuelven desde la instalación, no desde `cwd`.**
  `getSkillsDir()` es `join(process.cwd(), 'skills')` **sin fallback**
  ([registry.ts:47](src/skills/registry.ts)). Cuando OrchestOS gestiona **otro** proyecto, `cwd` es
  ese proyecto, ahí no hay carpeta `skills/`, `listSkillFiles()` devuelve `[]` → cero candidatas →
  **no se activa ninguna skill, jamás**. Sin este ítem, todo el Bloque O funciona solo dentro de
  este repo y no entrega nada en CitasBot / Cisepro / cualquier otro. Aplicar el patrón **idéntico**
  ya decidido para roadmaps (decisión M, 2026-07-30, "centralizado, no copiado"): probar `root`
  primero y caer a la instalación vía `import.meta.dir` — ver `ROADMAP_DOCS_ROOT` en
  [roadmap-profile.ts:16](src/detect/roadmap-profile.ts) y [context.ts:17](src/roadmaps/context.ts).
  Las skills propias del proyecto siguen ganando sobre las centralizadas.

  **CERRADO 2026-08-03.** `SKILLS_INSTALL_ROOT = join(import.meta.dir, '..', '..')` en
  [registry.ts](src/skills/registry.ts), mismo patrón que roadmaps.
  **Lectura y escritura quedaron deliberadamente asimétricas** — es la decisión de diseño del ítem,
  no un detalle: leer cae al fallback (`resolveSkillPath`/`resolveProSkillPath`), pero **escribir
  apunta siempre al proyecto** (`getSkillPath`/`getProSkillPath`), porque crear o editar una skill
  mientras se gestiona otro repo no debe mutar la instalación de OrchestOS. Es la misma excepción
  que `project-profile.md` en la decisión M.
  - `listSkillFiles()`/`listProSkillFiles()` ahora **unen** proyecto + instalación con el proyecto
    ganando ante mismo id. Dedupe por nombre de archivo, no por ruta: cuando `cwd` **es** la
    instalación (OrchestOS trabajando sobre sí mismo) las dos carpetas son la misma y sin dedupe
    cada skill aparecería dos veces — cubierto por test.
  - **Editar** una skill centralizada desde otro proyecto hace **copy-on-write**: escribe una copia
    local que la pisa, nunca toca la central. **Borrar** una skill que solo existe centralmente se
    rechaza con `409` explícito en vez de fallar en silencio o borrarla para todos los proyectos.
  - **Hallazgo colateral — N.4.5 estaba incompleto.** [cli.ts:582](src/cli.ts) era una **tercera
    copia** del snippet que inyecta `skill.instructions` crudo; N.4.5 solo corrigió `prompt.ts` y
    `skill-route.ts`. Y como el CLI pasa `skillGuidelines` explícito a `buildPrompt()`, bypasseaba
    el fallback ya arreglado: **por el camino del CLI el `iron_law` seguía sin llegar al ejecutor**.
    Ahora usa `buildSections()`. Es el mismo fallo de N.4.5, encontrado un mes después en un tercer
    sitio — señal de que el snippet duplicado era el problema real.
  - 7 tests nuevos ([skill-central-resolution.test.ts](src/__tests__/skill-central-resolution.test.ts)),
    incluido el caso que antes era imposible de probar: proyecto ajeno sin `skills/` propia.
    Gotcha anotado: en macOS `tmpdir()` da `/var/...` pero `chdir()` resuelve a `/private/var/...`,
    hay que pasar por `realpathSync` o las comparaciones de ruta fallan.
  - **Verificación en vivo** (no solo tests): directorio vacío en `/tmp`, `chdir`, `listSkillFiles()`
    → **16 skills visibles donde antes eran 0**, y `security-review` resolviendo contra la
    instalación real. 1073 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **O.2 — 🧠 (A) El planner ve el catálogo y asigna skill por sub-tarea.** Agregar `skill` al
  schema JSON de [planner.ts](src/agents/planner.ts) + pasarle la lista resumida (id + description
  + when_to_use, que ya arma `listAllSkillCandidates()`,
  [project.ts:68](src/dashboard/handlers/project.ts)). El resto del camino ya está cableado. Cubrir
  **los dos caminos**, no solo el planner: las tareas chicas que no se descomponen hoy dependen de
  `pickAutoSkill()` ([chat.ts:377-380](src/dashboard/handlers/chat.ts)), que son 3 líneas — si hay
  `frontend-design` gana, si no solo aplica cuando hay **exactamente una** candidata; con 3
  candidatas razonables devuelve `undefined` y la tarea corre **sin ninguna skill**. Es literalmente
  lo contrario del objetivo: hoy la ambigüedad se resuelve descartando todo en silencio — la
  ambigüedad pasa a resolverse según `activation.mode` (O.0), no descartando. Validar
  contra ids reales también en el camino de sub-tareas (`isKnownSkillId` hoy vive solo en el handler
  del dashboard, [tasks.ts:155](src/dashboard/handlers/tasks.ts)) — el planner no debe poder
  inventar un id.

  **CERRADO 2026-08-03.** `planner.ts` mencionaba la palabra "skill" **cero veces** — el único
  componente que decide cómo se reparte el trabajo era ciego al arsenal. Ahora:
  - **Módulo compartido nuevo** [src/skills/catalog.ts](src/skills/catalog.ts):
    `listAllSkillCandidates()` e `isKnownSkillId()` vivían dentro de la capa dashboard
    (`handlers/project.ts` y `handlers/tasks.ts`) y el planner (capa agents) las necesita —
    importar dashboard desde agents habría invertido las capas. Extraídas; los handlers re-exportan
    para no romper su API ni los tests existentes.
  - **El planner ve el catálogo**: `skill` agregado al schema JSON de `create_subtask` y al fallback
    YAML, y `withSkillCatalog()` inyecta el catálogo real en ambos system prompts. Verificado en
    vivo: **24 skills, 9.335 chars** — **solo metadata** (id + description + when_to_use), nunca el
    cuerpo; cargar las 24 completas inflaría el contexto y diluiría las instrucciones que importan.
    El cuerpo se sigue cargando después y solo el de la skill elegida. Sin skills instaladas el
    prompt queda idéntico al de antes (cero regresión).
  - **Fail-safe contra ids inventados en el camino de sub-tareas**: `dropUnknownSkills()` en los dos
    puntos de retorno de `createPlan`. Un id inventado se descarta en silencio y la sub-tarea corre
    sin skill — el comportamiento previo a O.2 — en vez de romper el plan entero.
  - **`pickAutoSkill()` deja de descartar ante ambigüedad** — era el origen concreto del dolor. Eran
    3 líneas: con 2+ candidatas y sin `frontend-design` devolvía `undefined` y **la tarea corría sin
    ninguna skill**. Esa regla venía del camino manual (`renderSkillSuggestion`, "nunca resolver el
    empate a ciegas"), correcta con un humano mirando el composer, pero desde que D.7 crea tareas
    sola se traducía en "no se aplica ninguna skill nunca". Ahora desempata por
    `activation.mode: automatic` (contrato O.0) → `frontend-design`
    ([[feedback-skill-autoselect-tiebreak]], conservado) → candidata única → sin asignar. **Acá
    `activation` deja de ser contenido inerte: es el primer consumidor real de O.0.**
  - 12 tests nuevos ([planner-skill-catalog.test.ts](src/__tests__/planner-skill-catalog.test.ts)),
    incluido el de regresión explícito (`security-review` + `test-writer` ya no devuelve `undefined`)
    y uno que verifica que el cuerpo de las skills **no** se filtra al prompt.
  - 1085 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **O.3 — 🧠 (2026-08-05) (B) Gates transversales que no se pueden perder en silencio.** `security-review` y
  `qa-structured` **no son "una sub-tarea más"**: son transversales al output completo y **no deben
  ser elegibles por el mismo LLM que hace el trabajo** — se autoconvence de saltárselas. Esa es la
  razón de ser de `iron_law`/`common_rationalizations` (N.1–N.3): si el mismo criterio que elige la
  skill puede descartarla, el endurecimiento no sirve de nada. **La condición de gate se declara en
  `activation.mode: automatic` + `activation.triggers` del YAML de la skill (O.0), nunca en un `if`
  del código** — si vive en código no es portable a otros proyectos y contradice O.1. Aplicados
  post-hoc sobre el stage de QA/adversarial que **ya existe** en el harness (no inventar un stage
  nuevo). Si un gate no se ejecuta → `missing`/`blocked`, **nunca
  "listo"** (INS-2026-011). Registrar por corrida: candidatas, aplicadas, rechazadas, motivo de
  activación y resultado de cada gate — hoy `runs.skill_id` es un escalar nullable y **no permite
  distinguir "ninguna skill aplicaba" de "el selector falló en silencio"**; un gate saltado es
  indistinguible de uno que nunca se consideró.
  **Consecuencia de seguridad a resolver dentro de este ítem (INS-2026-014):**
  [tool-policy.ts:5](src/run/middlewares/tool-policy.ts) hace
  `ctx.allowedTools = skill.allowed_tools ?? []`. Hoy es inocuo porque la skill la elige Carlos; con
  selección automática, **elegir una skill pasa a cambiar solo los permisos de herramientas del
  agente** (puede restringirlos y hacer fallar la tarea de forma confusa, o ampliarlos). Debe quedar
  explícito y registrado, nunca silencioso.

  **CERRADO 2026-08-05.**
  - **`resolveGates(taskText, phase)`** nuevo en
    [src/skills/catalog.ts](src/skills/catalog.ts): busca skills con `activation.mode: automatic` +
    `phases` incluye la fase actual. Sin `triggers` → aplica siempre (`qa-structured`). Con
    `triggers` → requiere al menos una coincidencia case-insensitive contra el texto de la tarea
    (`security-review`; `_` también matchea con espacio). La decisión vive 100% en el YAML — cero
    `if` de código, portable a otros proyectos (O.1).
  - **Inyección en el stage existente** ([src/run/qa.ts](src/run/qa.ts)): `runQA()` acepta
    `gateSkills?: SkillDef[]` y agrega un bloque `## GATE: <nombre>` por cada gate aplicada, con el
    texto "this gate is mandatory — it was NOT chosen by you" para que el mismo LLM que revisa no
    se autoconvenza de saltarla. `qa-structured` se excluye a propósito de la inyección: su
    metodología YA es el branch `hasCriteria` que existía antes de O.3 — inyectarla de nuevo sería
    contenido duplicado, no una gate adicional. `runAdversarialQA()` (el segundo juez, opt-in) queda
    fuera a propósito: es una segunda opinión sobre un veredicto que ya pasó, no el punto donde el
    gate debe pesar.
  - **Registro por corrida**: columna nueva `runs.skill_gates_json` (`db/migrate.ts`,
    `db/runs.ts`) — JSON `[{id, candidate, applied, reason}]`, calculado una vez en `harness.ts`
    antes de invocar `runQA()` y persistido en los dos `insertRun()` posteriores al stage de QA.
    Las corridas que fallan ANTES de llegar a QA (checks, contrato) guardan `NULL` — distinto a
    distinguir de un array con `applied: false`, que sí llegó a evaluarse y no aplicaba. Expuesto
    también en el dashboard (`RunRow.skillGates`, `dashboard/handlers/runs.ts`) para que O.4 tenga
    el dato sin tener que releer JSON crudo — sin UI todavía, eso es O.4.
  - **INS-2026-014, hallazgo real al verificar antes de "arreglar"**: `ctx.allowedTools` (seteado
    por `tool-policy.ts`) **no lo lee ningún ejecutor** — `grep -rn ".allowedTools\b" src/` no
    devuelve nada fuera de ese propio middleware. El riesgo literal del ítem (una skill
    auto-elegida restringe permisos en silencio) **no se materializa hoy** porque el campo es dead
    code, no porque esté bien defendido. El mecanismo que sí enforcea de verdad es otro:
    `SubTask.allowed_tools` del planner, requerido y chequeado hard en `agents/executor.ts`.
    Cablear una enforcement real en `tool-policy.ts` redefiniría el modelo de seguridad de 3+
    ejecutores — cambio de comportamiento central, out of scope para este ítem (regla de
    planificar antes de cambios grandes). Documentado con un comentario largo en el archivo y
    registrado como [IDEAS.md #58](IDEAS.md) en vez de improvisar el cableado a mitad de O.3.
  - 8 tests nuevos ([skill-gates.test.ts](src/__tests__/skill-gates.test.ts)): `resolveGates()`
    contra las skills reales del repo (no mocks) — `qa-structured` siempre aplica en `review`,
    `security-review` requiere match de trigger, guión bajo↔espacio, ninguna gate fuera de fase
    `review`, skills sin `activation.mode: automatic` nunca son candidatas — y `runQA()` con
    provider mock que captura el `system` prompt real para confirmar la inyección (y la exclusión
    de `qa-structured`).
  - 1093 tests · 0 fail · `tsc --noEmit` limpio · gate de drift verde (7 fuentes, 0 deriva).
- [x] **O.4 — 🔍 (2026-08-05) CERRADO.** Gate con **casos reales**, no tests unitarios
  ([[feedback-verificar-gates-en-vivo]]): crear una pantalla → sugiere `frontend-design`; endpoint
  con input de usuario → activa `security-review`; feature nueva → sugiere/activa `tdd-enforcer`;
  bug sin tests → sugiere `test-writer`; tarea con criterios de aceptación → ejecuta
  `qa-structured`; tarea documental simple → **no carga ninguna skill de código**. Además: una skill
  irrelevante no aparece en el prompt; una obligatoria no desaparece en silencio; una sugerencia
  ambigua muestra opciones; el usuario puede rechazar una sugerencia; un gate de seguridad no se
  ignora sin evidencia explícita. **Criterio de éxito del bloque** (decisión Carlos): no es
  *"OrchestOS tiene muchas skills instaladas"* sino *"un usuario describe su objetivo normalmente y
  OrchestOS identifica, carga, aplica y verifica las skills pertinentes sin exigir que conozca sus
  nombres"*. Verificar en **un proyecto distinto de este repo** — es la prueba real de O.1.

  **Método**: proyecto scratch nuevo fuera de este repo (sin `skills/` ni `docs/roadmaps/`
  propios — package.json + `tasks.yaml`, git inicializado), `cd` real a ese directorio y llamadas
  reales (nada mockeado): `listAllSkillCandidates()`/`resolveGates()` con `cwd` = scratch,
  `buildNaturalDraft()` (LLM haiku real, el mismo clasificador que usa D.7) para los 6 escenarios
  del checklist, y **dos corridas end-to-end reales** vía `orchestos task run` contra ese
  proyecto (executor `gpt-4o-mini`, costo real ~$0.001 c/u).

  **Resultado — 6 escenarios, cero bugs encontrados:**
  | Escenario | Gates (`resolveGates`, determinista) | `skillOptions` del LLM | `pickAutoSkill()` |
  |---|---|---|---|
  | Crear pantalla nueva | `qa-structured` | ux-guidelines, design-brief-inference, **frontend-design**, design-tokens | **frontend-design** ✅ |
  | Endpoint con user input | `qa-structured`, **security-review** ✅ | pre-task-alignment, api-contract, **security-review** | **security-review** ✅ |
  | Feature nueva (TDD) | `qa-structured` | pre-task-alignment, test-writer, tdd-enforcer | *(sin asignar — 3 candidatas empatadas, ninguna automática/frontend-design)* |
  | Bug sin tests | `qa-structured` | diagnose, **test-writer**, tdd-enforcer, bug-hypothesis | *(sin asignar — mismo empate)* |
  | Con criterios de aceptación | `qa-structured` | qa-structured, ux-guidelines, tdd-enforcer | **qa-structured** ✅ |
  | Doc simple (README) | `qa-structured` | **doc-gen** | **doc-gen** ✅ (no es una skill de código) |

  El "sin asignar" de feature-nueva/bug-sin-tests **no es un bug** — es el desempate documentado en
  O.2 (`activation.mode: automatic` → `frontend-design` → candidata única → sin asignar) operando
  como se diseñó: la skill SÍ aparece en `skillOptions` ("sugiere" del checklist), y para el camino
  manual del composer (`renderSkillSuggestion()`, `screens-core.js`) 2+ candidatos muestran un
  `<select>` con "Ninguna" preseleccionada — el usuario elige o rechaza, nunca se resuelve el
  empate a ciegas ([[feedback-skill-autoselect-tiebreak]]). Cubre "sugerencia ambigua muestra
  opciones" y "usuario puede rechazar" sin tocar código, ya estaba correcto desde el Bloque D
  (Mes 18).

  **Prueba capstone — E2E real con vulnerabilidad de verdad, no simulada**: tarea
  `login-endpoint` ("SQL concatenada, credenciales hardcodeadas, sin input sanitizado") corrida de
  punta a punta. El executor escribió el código pedido (vulnerable, tal como se le pidió); el
  gate resolvió `security-review` aplicada (`trigger match: user_input`) y `qa-structured` siempre
  aplicada; el juez de QA **falló la tarea citando explícitamente OWASP**: *"Code contains multiple
  critical OWASP vulnerabilities: hardcoded credentials, SQL injection risk (concatenation pattern
  established), and lack of cryptographic protections for authentication"* — el checklist inyectado
  por O.3 llegó al juez real y las políticas se hicieron cumplir contra código real. `runs.
  skill_gates_json` quedó `[{"id":"security-review","applied":true,"reason":"trigger match:
  user_input"},{"id":"qa-structured","applied":true,...}]`, confirmando el registro end-to-end.
  **Control negativo**: tarea `docs-update` (README, sin triggers) corrida contra el mismo
  proyecto — `security-review` quedó `applied:false` con el motivo explícito, QA pasó limpio, sin
  ningún checklist de seguridad inyectado. Confirma "skill irrelevante no aparece en el prompt" y
  "obligatoria no desaparece en silencio" simultáneamente (`qa-structured` siempre presente en el
  log de ambas corridas).

  **Limpieza**: los 2 runs reales (`login-endpoint`, `docs-update`) borrados de
  `~/.orchestos/db.sqlite` tras verificar — no quedan filas fantasma en el dashboard real
  ([[feedback-verificar-progreso-delegado]] / precedente IDEAS.md #20). Proyecto scratch borrado.
  Cero código nuevo en este ítem — es puramente el gate de verificación de O.1–O.3, y no encontró
  nada que corregir.

  **Bloque O cierra completo (O.0–O.4).**

### Bloque P — 🧠 Vigilancia de deriva de fuentes externas (`sources-drift`)

**Origen — pregunta de Carlos (2026-08-02), tras el hallazgo real de N.5.1:** *"todas las repos
siempre se actualizan... mi idea es tener una función o agente que observe las repos y si tiene
algo interesante que mejoró justo en la pieza que ocupamos de ese repo, deberíamos aplicar esa
mejora — podría estar anotado en un update.md."* Verificado: **no existe nada así hoy.** Dreaming
(`DREAMING.md`) analiza telemetría propia (`runs-summary.json`), no repos externos — es un
mecanismo hermano, no el mismo.

**Las piezas, deliberadamente separadas** (tratarlas como una sola es lo que hace parecer esto un
proyecto grande):

1. **Qué se vigila no es "un repo completo"** — es un registro explícito de
   `fuente + path exacto + artefacto local que nació de ahí + último commit sincronizado`. Vigilar
   el repo entero genera ruido (un repo cambia por cosas que no importan); acotar por path es lo
   que hace esto barato y preciso.
2. **Detección es mecánica, sin LLM** — `gh api repos/{repo}/commits?path={path}` da el último SHA
   que tocó ese path exacto. Comparar contra el registrado es determinista.
3. **Relevancia SÍ requiere criterio** — que la fuente cambió no dice si el cambio importa. Mismo
   contrato que Dreaming: **propone, nunca aplica.** La primera versión del checker deja la lectura
   del diff a quien revisa `SOURCES_DRIFT.md` (Carlos o Claude en la siguiente sesión) — un paso
   de resumen automático vía LLM queda anotado como mejora futura, no bloqueante para la primera
   corrida real.
4. **Salida separada de `DREAMING.md`** — nombre propio (`SOURCES_DRIFT.md`) para no mezclar
   "cómo se comporta OrchestOS" (Dreaming, hacia adentro) con "cómo cambiaron las fuentes de las
   que robamos" (esto, hacia afuera).
5. **Cadencia baja** — semanal/mensual alcanza (fuentes de inspiración curada, no dependencias que
   rompen builds), muy distinto de los 2am nocturnos de Dreaming. Sin cron nuevo en este ítem —
   correr a mano o vía el mismo mecanismo externo que ya dispara Dreaming (fuera del repo, en la
   máquina de Carlos).

- [x] **P.1 — 🧠** (2026-08-02) Registro [docs/sources-registry.yaml](docs/sources-registry.yaml):
  `id`, `repo`, `path`, `license`, `local_artifact`, `last_synced_sha`, `last_synced_date`, `note`.
  Semilla con las 5 fuentes ya verificadas hoy: `obra/superpowers`
  (`test-driven-development` → `tdd-enforcer`, `verification-before-completion` → relación con
  `qa-structured`, sin ser traducción 1:1), `pbakaus/impeccable`
  (`scripts/detector/rules/checks.mjs` → `frontend-design`), `stablyai/orca`
  (`src/shared/agent-kind.ts` y `src/shared/tui-agent-config.ts` → IDEAS #39/Bloque O). Los
  `last_synced_sha` se fijan al SHA verificado **hoy**, no a un origen histórico desconocido — el
  registro establece línea base limpia desde este punto en adelante.
- [x] **P.2 — 🧠** (2026-08-02) [scripts/check-sources-drift.ts](scripts/check-sources-drift.ts):
  función pura `computeDrift(registry, latestShas)` (testeada, sin I/O) + wrapper que llama
  `gh api` por cada entrada y escribe `SOURCES_DRIFT.md` con lo que cambió desde el último sync
  (repo, path, SHA viejo→nuevo, link de comparación en GitHub). Nunca modifica `local_artifact` ni
  el registro — eso es una decisión humana explícita, mismo gate que rige toda esta conversación
  ("no promover sin propuesta, diff y confirmación explícita").
  `bun run scripts/check-sources-drift.ts` (alias `sources:drift` en `package.json`).
- [x] **P.3 — 🔍** (2026-08-02) **Primera corrida real**, no simulada — pedida explícitamente por
  Carlos en el mismo turno que P.1/P.2. Resultado y hallazgos anotados en el commit y en
  `SOURCES_DRIFT.md`.
- [x] **P.4 — ⚡ (2026-08-06) CERRADO.** Mejora futura, no bloqueante: paso de resumen vía LLM (reusar
  el patrón de `classifyAgainstOptions` de `docs/semantic-skill-selection-design.md` si aplica) que
  lea el diff real entre `last_synced_sha` y el HEAD actual del path y redacte la propuesta en
  `SOURCES_DRIFT.md`, en vez de solo listar "cambió, revisar a mano".

  **Implementado en [scripts/check-sources-drift.ts](scripts/check-sources-drift.ts)**:
  `fetchDiffPatch()` trae el patch real del path vía `gh api compare` (no el repo entero);
  `buildSummaryPrompt()` (pura, testeada) arma el prompt con el artefacto local, la nota del
  registro y el diff literal; `summarizeDrift()` llama un modelo barato (`claude-haiku-4-5`) con
  `chatFn` inyectable para test sin red. **Opt-in a propósito** — mismo patrón que
  `orcheConfig.adversarialQA`: el camino mecánico de P.1-P.3 sigue siendo el default sin costo ni
  LLM; `--summarize` (`bun run sources:drift:summarize`) lo activa. Sigue sin tocar
  `local_artifact` ni el registro — el LLM solo redacta la propuesta que ya requería revisión
  humana, la promoción real sigue pasando por `/knowledge-promote`.

  **Verificado en vivo, no solo con tests**: `last_synced_sha` de `superpowers-systematic-debugging`
  bajado a mano a un commit 2 versiones atrás, corrido `--summarize` de verdad contra el registro
  real. Resultado real del LLM: identificó que el upstream agregó una referencia a
  `verification-before-completion` y **removió la sección "Real-World Impact"** que menciona el
  framing de `iron_law` — exactamente la tabla que la nota del registro marca como portada,
  detectado sin que el prompt se lo dijera explícitamente. Registro restaurado al SHA correcto
  después de verificar, `SOURCES_DRIFT.md` regenerado limpio (0 deriva).
  8 tests nuevos (`check-sources-drift.test.ts`) — `buildSummaryPrompt` puro, `summarizeDrift` con
  `chatFn` fake, `renderReport` con/sin `summaries[]`. `tsc --noEmit` limpio.

  **Bloque P cierra completo (P.1–P.4).**

---

## Sección 1 — Plan ejecutado (S1–S18)

### MES 1 — CLI base + detección de stack

**SEMANA 1 — `orchestos detect` → AGENTS.md**
- S1.1 Bootstrap (bun init, dependencias, IDEAS.md) — 2026-05-26
- S1.2 Stubs: cli.ts, detect/*, generators/* — 2026-05-26
- S1.3 `src/detect/manifest.ts` — 2026-05-26
- S1.4 `src/detect/languages.ts` — 2026-05-26
- S1.5 `src/detect/conventions.ts` — 2026-05-26
- S1.6 `src/generators/agents-md.ts` — 2026-05-26
- S1.7 `src/generators/context-json.ts` — 2026-05-26
- S1.8 `src/cli.ts` con commander — 2026-05-26
- S1.9 Validación: Next.js+Prisma detectado en 182ms, AGENTS.md correcto — 2026-05-26
- S1.10 Repo https://github.com/cagr1/orchestos push `9886d9f` — 2026-05-26

**SEMANA 2 — Persistencia SQLite**
- S2.1 `src/db/sqlite.ts` — 2026-05-26
- S2.2 `src/db/migrate.ts` — 2026-05-26
- S2.3 `src/db/projects.ts` — 2026-05-26
- S2.4 Comandos `init`, `context show/update/list` — 2026-05-26
- S2.5 `src/context/load.ts` + `src/index.ts` — 2026-05-26
- S2.6 Validación: `orchestos init` en 91ms, context show correcto desde DB — 2026-05-26
- S2.7 Commit `e536922` — 2026-05-26

**SEMANA 3 — Compilador de skills (YAML → 3 targets)**
- S3.1 `bun add yaml` + estructura skills — 2026-05-26
- S3.2 Validador YAML con mensajes claros — 2026-05-26
- S3.3 Compilador `claude` → SKILL.md — 2026-05-26
- S3.4 Compilador `cursor` → .mdc — 2026-05-26
- S3.5 Compilador `openai` → JSON tool — 2026-05-26
- S3.6 Comandos `skill add / list / build` — 2026-05-26
- S3.7 Validación: 3 skills × 3 targets = 9 archivos, 0 errores — 2026-05-26
- S3.8 Commit `b725c99` — 2026-05-26

**SEMANA 4 — Router + `orchestos run`**
- S4.1 `src/router/classify.ts` — 2026-05-26
- S4.2 `src/router/models.ts` — 2026-05-26
- S4.3 `src/providers/anthropic.ts` (stub + API key desde `~/.orchestos/.env`) — 2026-05-26
- S4.4 `src/providers/openai.ts` (stub) — 2026-05-26
- S4.5 `src/router/pricing.ts` — tabla USD/1M tokens — 2026-05-26
- S4.6 Tabla `runs` con files_attempted/authorized/blocked/status — 2026-05-26
- S4.7 `run/contract.ts` — enforceContract bloquea writes fuera de `--output` — 2026-05-26
- S4.8 Comando `orchestos run --task --output [--skill] [--file] [--project] [--dry-run]` — 2026-05-26
- S4.9 Validación parcial: dry-run correcto, contexto cargado, 2 providers declarados — 2026-05-26
- S4.10 Commit `593292e` — 2026-05-26

---

### MES 2 — Contract-first workflow con evidencia

**SEMANA 5 — `tasks.yaml` como fuente de verdad**
- S5.1 Schema tasks.yaml: id, description, skill, input[], output[], depends_on[], status, retry — 2026-05-26
- S5.2 `src/tasks/schema.ts` — Task + TasksFile + validateTasksFile — 2026-05-26
- S5.3 `src/tasks/loader.ts` — loadTasks/saveTasks con lock optimista — 2026-05-26
- S5.4 `orchestos task init` — scaffold según stack detectado — 2026-05-26
- S5.5 `orchestos task list` — tabla con icono de status — 2026-05-26
- S5.6 `orchestos task run` — scheduler, enforceContract, persiste run — 2026-05-26
- S5.7 Tabla `runs` extendida: task_id, snapshots, qa_verdict, qa_reason — 2026-05-26
- S5.8 Validación: task init válido, run escribe solo lo declarado, SQLite correcto — 2026-05-26
- S5.9 Commit `a59ed37` — 2026-05-26

**SEMANA 6 — QA stage**
- S6.1 `src/run/qa.ts` — runQA + snapshotContents + restoreContents — 2026-05-26
- S6.2 Prompt QA — JSON {verdict, reason} — 2026-05-26
- S6.3 Integrado en task run: pass → done, fail → revert + pending + retry_count++ — 2026-05-26
- S6.4 MAX_RETRIES=3, failed_permanent bloquea dependientes — 2026-05-26
- S6.5 `orchestos task status` — tabla id|status|retry|qa|cost — 2026-05-26
- S6.6 Validación: QA fail → retry, QA pass → done, 3 fallos → failed_permanent — 2026-05-26
- S6.7 Commit `31b0c6d` — 2026-05-26

**SEMANA 7 — Multi-tarea con dependencias**
- S7.1 Selector de próxima tarea: filtra pending cuyas depends_on estén done — 2026-05-26
- S7.2 `orchestos task run --all` — loop MAX=20, recarga tasks.yaml cada vuelta — 2026-05-26
- S7.3 Halt en fallo: 'failed' corta loop, 'retry' no — 2026-05-26
- S7.4 `orchestos task run --id <task-id>` — salta scheduler — 2026-05-26
- S7.5 `src/run/logger.ts` — RunLogger a disco: runs/YYYY-MM-DD-HH-mm.log — 2026-05-26
- S7.6 Validación: T1→T2 en orden, contract enforcement, log verificado — 2026-05-26

**SEMANA 8 — Observabilidad + README honesto**
- S8.1 `orchestos runs --detail <run-id>` — evidencia completa — 2026-05-26
- S8.2 `orchestos runs --export` — dump a runs-export.json — 2026-05-26
- S8.3 `summary-pdf.ts` — sección Recent Runs con tabla — 2026-05-26
- S8.4 README.md reescrito — honesto, sin claims falsos — 2026-05-26
- S8.5 LIMITATIONS.md — creado con limitaciones reales — 2026-05-26
- S8.6 Validación: runs --detail muestra evidencia real, export correcto — 2026-05-26
- S8.7 Commit `129d317` — 2026-05-26

---

### MES 3 — Reliability + Spec QA

**SEMANA 9 — Extracción de harness**
- S9.1-S9.2 `src/run/harness.ts`: HarnessOpts, TaskResult, runTask() — cli.ts solo orquesta — 2026-05-27
- S9.3 `src/run/prompt.ts`: buildPrompt() extraído del harness — 2026-05-27
- S9.4 Error handling: cualquier excepción → TaskResult{status:'failed'}, harness nunca lanza — 2026-05-27
- S9.6 Validación: harness.ts 191 líneas, typecheck verde — 2026-05-27
  - ⚠️ Desviación: cli.ts=666 líneas (legacy `orchestos run` no migrado, decisión anotada)
- S9.7 Commit `14b0ff8` — 2026-05-27

**SEMANA 10 — acceptance_criteria[] + checks[]**
- S10.1-S10.2 Extender Task: acceptance_criteria?, checks?, Check{cmd,cwd,timeout_ms,expect_exit} — 2026-05-27
- S10.3 `src/run/checks.ts`: runChecks() con Bun.spawn, split cmd respetando comillas, tail 2000 chars — 2026-05-27
- S10.4 Integrar checks en harness: corren ANTES del QA — si falla, revert sin gastar tokens QA — 2026-05-27
- S10.5 QA prompt: path criteria → eval por criterio con criteria[] en respuesta — 2026-05-27
- S10.6 `safeAddColumn checks_json TEXT` en runs — 2026-05-27
- S10.8 Commit `feat(tasks): acceptance_criteria + deterministic checks` — 2026-05-27

**SEMANA 11 — executor field + multi-provider**
- S11.1 Extender Task: executor enum (openrouter|anthropic|openai|codex), default openrouter — 2026-05-27
- S11.2 `src/providers/index.ts`: ProviderClient interface + getProvider() registry — 2026-05-27
- S11.3 `src/providers/anthropic.ts` real: POST api.anthropic.com/v1/messages — 2026-05-27
- S11.4 `src/providers/openai.ts` real: POST /v1/chat/completions — 2026-05-27
- S11.5 Harness usa getProvider(task.executor) — 2026-05-27
- S11.6 executor:codex detrás de OS_ENABLE_EXEC_CODEX=1, Bun.spawn(['codex','exec','--json']) — 2026-05-27
- S11.7 Persistir executor real (no hardcoded) en runs — 2026-05-27
- S11.9 Commits Codex `7dfcdab`–`53f7017` — 2026-05-27

**SEMANA 12 — Code Graph v0 + context suggest**
- S12.1 Tablas SQLite: files(id,project_id,path,language,sha1,size_bytes,indexed_at) + code_edges(from_file_id,to_path,to_file_id,kind,raw) — 2026-05-27
- S12.2 `src/graph/index.ts`: indexProject() — glob TS/JS/Python, regex import, SHA1 dedup, cascade delete — 2026-05-27
- S12.3 `orchestos index [--project]` — imprime `indexed N files, M edges in Xms` — 2026-05-27
- S12.4 indexProject integrado en `orchestos init` — 2026-05-27
- S12.5 `src/graph/suggest.ts`: suggestContext(projectId, taskText) — TOKEN_WEIGHT=3, HOP_WEIGHT=1, 1-hop expansion via code_edges — 2026-05-27
- S12.5 `orchestos context suggest "<texto>" [--top N] [--no-expand]` — 2026-05-27
- S12.6 LIMITATIONS.md — sección Code Graph — 2026-05-27
- S12.7 Validación: 38 files/132 edges en 171ms, suggest correcto, SHA1 dedup, cascade ✅ — 2026-05-27
- S12.8 Commit `58d7f94` — 2026-05-27

**SEMANA 13 — Integración + hardening**
- S13.1 harness.runTask: si input[] vacío → suggestContext(description) top 5 como input implícito — 2026-05-27
- S13.2 `orchestos task run --explain <id>` — dry run: executor/model/suggestions/checks/criteria, 0 tokens — 2026-05-27
- S13.3 `runs --detail` rediseñado: ## Provider / ## Checks / ## Acceptance criteria / ## Files / ## Cost — 2026-05-27
- S13.4 summary-pdf.ts: columna executor + contador checks — 2026-05-27
- S13.5 README: sección ## Reliability features, ejemplo add-payment-service, ## tasks.yaml full reference — 2026-05-27
- S13.6 Validación: --explain correcto (0 tokens), check-fail path verificado, auto-suggest confirmado — 2026-05-27
- S13.7 Commit final Mes 3 — 2026-05-27

**SEMANA 14 — Skills con estructura real**
- S14.1 Schema YAML extendido: SkillExample + campos opcionales (when_to_use, inputs_required, verifiers, anti_patterns, examples) — 2026-05-27
- S14.2 validateSkill retrocompatible — skills sin campos nuevos siguen válidas — 2026-05-27
- S14.3 Compiler targets (claude/cursor/openai) emiten secciones solo si el campo existe — 2026-05-27
- S14.4–S14.8 Skills reales: pre-task-alignment, diagnose, tdd-enforcer, context-compression, improve-architecture — 2026-05-27
- S14.9 Validación: skill list (8), skill build (24 archivos), retrocompatibilidad, typecheck — 2026-05-27
- S14.10 Commit `efb95d5` — 2026-05-27

**Decisiones de diseño Mes 3**
- Checks ANTES del QA — si TS no compila, no tiene sentido el LLM de QA.
- Checks usan exit code, no parseo de stdout — wrapper script si necesitas stdout.
- Graph v0 con regex, no tree-sitter — schema ya soporta más kinds para Mes 4.
- Harness nunca lanza — toda excepción → `TaskResult{status:'failed'}`.
- Codex executor detrás de flag `OS_ENABLE_EXEC_CODEX=1` hasta evidencia real.
- legacy `orchestos run` no migrado al harness — flujo distinto, se depreca si nadie lo usa.
- Two-tier LLM como convención (⚡/🧠), no en tasks.yaml — hasta Mes 4 con evidencia.

**Lista prohibida Mes 3** _(lo que NO se hizo — referencia histórica)_
- Symbols/calls en el graph — solo imports.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado del `executor`.
- Worktrees reales (`git worktree add`).
- Reescribir el scheduler a archivo separado.
- `executor` como string libre — enum cerrado.
- ~~`planner_model` / `executor_model` en tasks.yaml~~ → **implementado en S15 (Mes 4)**.
- Más de 5 skills en S14 — calidad sobre cantidad.

---

### MES 4 — Routing inteligente + skills que se adaptan al proyecto

**SEMANA 15 — Model roles config**
- S15.1 `src/config/schema.ts` + `src/config/load.ts` con fallback chain — 2026-05-27
- S15.2 `src/router/auto-route.ts`: autoRoute(task, config) usando classifyTask existente — 2026-05-27
- S15.3 Extender Task schema: planner_model?, executor_model? opcionales — 2026-05-27
- S15.4 Harness integra autoRoute — executor explícito sigue ganando — 2026-05-27
- S15.5 Comandos `config init` + `config show` — 2026-05-27
- S15.6 Validación: plan-architecture → anthropic/claude-opus-4-7 [planner]; sin config.yaml → legacy path idéntico a Mes 3 — 2026-05-27
- S15.7 Commit `71a05ae` — 2026-05-27

**SEMANA 16 — Language-aware skills**
- S16.1 `LanguageTarget` type + `language_targets` en schema + validateSkill retrocompatible — 2026-05-27
- S16.2 `detectPrimaryLanguage()` exportado desde detect/languages.ts — 2026-05-27
- S16.3 Compilador claude/cursor/openai reciben detectedLanguage, emiten sección correcta — 2026-05-27
- S16.4 `skill build --project` detecta lenguaje del proyecto — 2026-05-27
- S16.5 Actualizar `tdd-enforcer` con language_targets (TS/C#/Python/default) — 2026-05-27
- S16.6 Validación: typecheck verde; build sin --project → idéntico a antes — 2026-05-27
- S16.7 Commit + push — 2026-05-27

**SEMANA 17 — CONSTITUTION.md + modo clarify**
- S17.1 `src/spec/constitution.ts`: loadConstitution + buildConstitutionBlock — 2026-05-27
- S17.2 Harness inyecta constitution block en system prompt si CONSTITUTION.md existe — 2026-05-27
- S17.3 `src/spec/clarify.ts`: needsClarify heurística v0 (verb ambiguo + sin input[]) — 2026-05-27
- S17.4 Harness/cli: --clarify → readline pregunta + appende clarificación a description — 2026-05-27
- S17.5 Comandos `constitution init` + `constitution show` + `task run --clarify` — 2026-05-27
- S17.6 Validación: explain con CONSTITUTION.md → loaded: 10 rules; sin CONSTITUTION.md → (none); typecheck verde — 2026-05-27
- S17.7 Commit `e11cb2a` + push — 2026-05-27

**SEMANA 18 — 3 skills de ciclo de vida + CONTEXT.md**
- S18.1 Skill `security-review` con schema completo — 2026-05-27
- S18.2 Skill `qa-structured` con schema completo — 2026-05-27
- S18.3 Skill `test-writer` con language_targets — 2026-05-27
- S18.4 `src/context/compress.ts`: buildContextMd() — 2026-05-27
- S18.5 `orchestos context compress` comando — 2026-05-27
- S18.6 Harness usa CONTEXT.md si existe, reporta ahorro de tokens en runs --detail — 2026-05-27
- S18.7 README: secciones Model routing, Constitution, Language-aware skills, Context compression — 2026-05-27
- S18.8 LIMITATIONS.md: clarify es heurística v0, no semántico — 2026-05-27
- S18.9 Validación final: typecheck verde; skill list → 11 skills; context compress genera CONTEXT.md; harness usa CONTEXT.md — 2026-05-27
- S18.10 Commit final Mes 4 `cca5f49` — 2026-05-27

**Decisiones de diseño Mes 4**
- `orchestos.config.yaml` vive en el proyecto — routing es por proyecto; config global como fallback.
- `autoRoute` usa `classifyTask` existente — sin clasificador nuevo, deuda cero.
- `executor` por tarea sigue ganando sobre config — compatibilidad total Mes 3.
- CONSTITUTION.md es Markdown parseado con regex — sin DSL nuevo; Mes 5 puede formalizarlo.
- `clarify` es heurística de palabras clave — semántica (LLM call extra) queda para Mes 5.
- CONTEXT.md sustituye AGENTS.md en el prompt — AGENTS.md sigue siendo fuente de verdad para init.

**Lista prohibida Mes 4** _(lo que NO se hizo — referencia histórica)_
- Dashboard / UI de ningún tipo → Mes 6+.
- Sub-agentes con contextos aislados → Mes 5+.
- Sandbox por tarea (`git worktree add`) → Mes 5.
- Spec-kit completo (`orchestos spec <id>`) → Mes 5.
- KuzuDB / upgrade del graph → solo si proyecto llega a 10K nodos.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado.
- Clasificador semántico para clarify.

**Métrica Mes 4 — ✅ SÍ (2026-05-27)**
`orchestos.config.yaml` enruta al modelo correcto, skills compiladas incluyen solo instrucciones del lenguaje del proyecto, CONSTITUTION.md aparece en el prompt sin config adicional, `context compress` produce CONTEXT.md que el harness usa con ahorro de tokens visible en `runs --detail`.

---

### MES 5 — Confiabilidad para uso diario

**SEMANA 19 — Sandbox por worktree + e2e real**
- S19.1 `createWorktree()` en sandbox.ts con cleanup garantizado — 2026-05-27
- S19.2 `mergeWorktreeBack()` — estrategias commit/squash/discard — 2026-05-27
- S19.3 sandbox-policy.ts — fallback a cwd si no es git repo — 2026-05-27
- S19.4 harness integra sandbox, elimina restoreContents() — 2026-05-27
- S19.5 QA→worktree: fail → discard, pass → commit + merge ff-only — 2026-05-27
- S19.6 flag `--keep-worktree` + `--sandbox` en `orchestos task run` — 2026-05-27
- S19.7 examples/e2e/ con tarea mínima hello.txt — 2026-05-27
- S19.8 e2e-smoke.ts + `bun run e2e:smoke` — 2026-05-27
- S19.9 docs/E2E.md — guía API key, smoke, logs, worktree debugging — 2026-05-27
- S19.10 Smoke real con OpenRouter — PASS · 8762ms · QA pass — 2026-05-27
- S19.11 8 tests unitarios sandbox.ts con repo git temporal — 2026-05-27
- S19.12 Validación: 86/86 tests verdes + smoke verde — 2026-05-27
- S19.13 Commit `feat(run): sandbox por git worktree + e2e real verificado` — 2026-05-27

**SEMANA 20 — Spec-Driven flow**
- S20.1 `orchestos spec create <task-id>` — genera plantilla .orchestos/specs/ — 2026-05-27
- S20.2 `orchestos spec show/list` — 2026-05-27
- S20.3 `orchestos spec approve` — status: approved + approvedAt — 2026-05-27
- S20.4 `orchestos spec draft` — LLM genera borrador con CONSTITUTION.md — 2026-05-27
- S20.5 clarify: pending bloquea approve — 2026-05-27
- S20.6 harness gate: requireSpec: true → error si no aprobado — 2026-05-27
- S20.7 validate.ts — criterios vacíos o placeholder → fallo — 2026-05-27
- S20.8 docs/SPEC.md — flujo completo con ejemplo — 2026-05-27
- S20.9 16 tests create/approve/validate/gate — 102/102 verdes — 2026-05-27
- S20.10 Validación: typecheck limpio + 102 tests — 2026-05-27
- S20.11 Commit `feat(spec): flujo Spec-Driven con gate en harness` — 2026-05-27

**SEMANA 21 — Graph multi-lenguaje + autoskills fetch**
- S21.1 resolver-registry.ts con interfaz Resolver pluggable — 2026-05-27
- S21.2 resolver C#: nsCache + using X.Y → archivo con ese namespace — 2026-05-27
- S21.3 resolver Rust: use crate::foo → src/foo.rs|mod.rs — 2026-05-27
- S21.4 resolver Go: go.mod module path → subdirectorio del índice — 2026-05-27
- S21.5 resolver Java: import com.X.Foo → archivo; wildcards → paquete — 2026-05-27
- S21.6 graph/index.ts: to_file_id integra registry C#/Rust/Go/Java — 2026-05-27
- S21.7 12 fixtures en tests/fixtures/graph/ — C#/Rust/Go/Java — 2026-05-27
- S21.8 skills/fetch.ts — fetchSkill + listRemoteSkills + cache local — 2026-05-27
- S21.9 `orchestos skill fetch --language <lang> [--name <name>]` — 2026-05-27
- S21.10 `orchestos skill fetch --list` — lista del registry GitHub — 2026-05-27
- S21.11 Validación: typecheck limpio + 102/102 tests verdes — 2026-05-27
- S21.12 Commit `feat(graph,skills): resolvers multi-lenguaje + autoskills fetch` — 2026-05-27

**SEMANA 22 — Sub-agentes con contextos aislados + hardening final**
- S22.0.1 `allowed_tools?: string[]` en `SkillDef` + validador + 11 skills actualizadas — 2026-05-28
- S22.0.2 `src/agents/sub-task-schema.ts` — `SubTaskDef`, `SubTaskPlan`, `validateSubTaskPlan()`, `topoSort()`, cycle detection (Kahn) — 2026-05-28
- S22.0.3 Migración `memory_entries` + `src/db/memory.ts`: `upsertMemory` / `getMemory` / `listByScope` — 2026-05-28
- S22.1 `src/agents/sub-agent.ts` — `SubTaskStatus`, `SubTask`, `SubagentResult`, `createSubTask`, `applyResult`, `shouldSkip`, `isRetriable` — 2026-05-28
- S22.2 `src/agents/planner.ts` — parser YAML robusto + validación contra schema S22.0.2 — 2026-05-28
- S22.3 `src/agents/context-isolation.ts` — `buildIsolatedContext`, `sliceContext`, `selectMemories`, `extractKeywords`, `MAX_CONTEXT_CHARS=8000` — 2026-05-28
- S22.4 Scheduler: orden topológico por `depends_on`, herencia provider/model del padre, secuencial — 2026-05-28
- S22.5 QA en cascada: sub-task falla → padre `failed`, dependientes → `skipped` con razón explícita — 2026-05-28
- S22.5a apply-progress merge: topic_key existente → instrucción MERGE en prompt + `upsertMemory` post-éxito — 2026-05-28
- S22.6 `orchestos task run --expand <plan-task-id>` — 2026-05-28
- S22.7 4 escenarios de test: linear fail→rollback, DAG no-linear, re-ejecución merge, tool-violation — 2026-05-28
- S22.8 `src/agents/hardening.ts` — `withSubTaskTimeout` (5 min), `ToolCallCounter` (20 calls → `timed_out`), `createWorktreeWithRetry` (exp. backoff), `withRateLimitRetry` — 2026-05-28
- S22.9 `docs/AGENTS.md` — flujo completo + diagrama DAG de una tarea plan — 2026-05-28
- S22.10 Smoke real: write-greeting (428in/269out, 16s) → write-response (430in/152out, 28s) · `memory_entries` escritas · 44s total — 2026-05-28
- S22.11 README + CHANGELOG — resumen Mes 5 con sub-agentes, context isolation, memoria persistente, tool policy — 2026-05-28
- S22.12 Validación: 110 tests · 0 fail · 8 archivos + smoke S22 verde — 2026-05-28
- S22.13 Commit `cd8526e feat(smoke): S22.10 smoke real sub-agentes + cierre S22` — 2026-05-28
- Bug fix: `selectMemories` resuelve `depends_on` IDs → `topic_keys` via `allSubTasks` — 2026-05-28

**Decisiones de diseño Mes 5 (S19–S22)**
- Worktrees reemplazan snapshot/restore — `restoreContents()` eliminado.
- Spec es opcional por defecto, obligatorio si `requireSpec: true` en config — adopción gradual.
- autoskills = HTTP fetch al raw de GitHub — sin npx, sin runtime externo.
- Resolvers de imports son best-effort — `to_file_id = null` sigue siendo válido.
- Sub-agentes solo si S19 cierra limpio — worktrees son prerequisito no negociable.
- Memoria de sub-agentes solo en `memory_entries` — nunca archivos .md — evita race conditions.
- Tool policy es verificación dura en harness, no sugerencia al modelo.
- Dogfooding: 5 tareas reales ejecutadas durante el mes (bitácora en `docs/E2E.md`).

**Métrica Mes 5 — SÍ (2026-05-28)**
Sub-agentes con context isolation + memoria persistente + tool policy funcionando.
5 ejecuciones reales registradas en `docs/E2E.md` (hello-world × 2, bun test suite, smoke-greeting, smoke-response).

---

### MES 6 — IA con ROI demostrable

**SEMANA 23 — Pre-flight Mes 6 + Function calling para el planner**
- S23.0.1 `mergeWorktreeBack`: `--ff-only` falla → intenta `git rebase <base>` + retry; si rebase falla → mensaje claro con instrucción manual. Sin el fix, worktrees quedaban colgados entre sesiones — 2026-05-28
- S23.0.2 `src/hooks/context-monitor.ts`: `checkContextHealth()` retorna warnings estructurados (context_warning <35%, context_critical <25%, cost_notice >$5, loop_detected ≥3 herramienta seguida, scope_creep >20 archivos). `shouldCheck()` con debounce de 5 calls. Integrado en harness post-enforce — 2026-05-28
- S23.1 `CREATE_SUBTASK_TOOL` en `src/agents/planner.ts`: schema estricto con `id`, `description`, `acceptance[]`, `depends_on[]`, `allowed_tools[]`, `topic_key?`, `output?`, `input?`. Validación por SDK antes de llegar al código — 2026-05-28
- S23.2 `generatePlan()`: detecta en runtime si el provider soporta tool calling → function calling; si no → YAML fallback. Transparente para el caller — 2026-05-28
- S23.3 `src/__tests__/planner-fc.test.ts`: plan de 3 sub-tareas via function calling → schema correcto; modelo sin tool support → fallback YAML funcional; schema inválido → error con campo afectado — 2026-05-28
- S23.4 Commit `feat(planner): function calling + YAML fallback` — 2026-05-28

**SEMANA 24 — Embeddings semánticos en `suggestContext`**
- S24.1 Migración SQLite: columna `embedding TEXT` (JSON array float[]) en tabla `files` via `safeAddColumn` — 2026-05-28
- S24.2 `src/providers/embeddings.ts`: `EmbeddingProvider` interface + `embedOpenAI` (text-embedding-3-small, $0.02/1M) + `embedOllama` (nomic-embed-text, local, sin API key) + `getEmbeddingProvider()` registry + `inferEmbeddingProvider()` + `cosine()` utility — 2026-05-28
- S24.3 `indexProject()`: si archivo no tiene embedding o SHA1 cambió → llama provider y guarda. Flag `--no-embed` en `orchestos index` — flujo existente sin API key intacto — 2026-05-28
- S24.4 `suggestContext()`: embedding de la tarea → cosine similarity → re-rank `embed_score×0.6 + keyword_score×0.4`. Razón `embedding` para archivos encontrados solo por coseno. CLI: `◆` para semantic match. `cli.ts` + `harness.ts` pasan `taskEmbedding` con fallback silencioso — 2026-05-28
- S24.5 Columna `embed_hits INT` en tabla `runs`. Harness devuelve `embedHits` en `withSuggestedInput` — 2026-05-28
- S24.6 `src/__tests__/suggest.test.ts` (15 tests): legacy keyword path, cosine path, threshold exclusion, combined score formula, NULL embeddings, topN — 2026-05-28
- Validación final: 194 tests · 0 fail — 2026-05-28
- Commit `feat(graph): embeddings semánticos en suggestContext + embed_hits tracking` — 2026-05-28

**SEMANA 25 — Agente de diagnóstico de fallos**
- S25.1 `src/agents/diagnose.ts`: `diagnoseTask(taskId, root)` — lee últimos 3 runs, construye prompt con runs block (status, model, qa_reason, checks, cost, elapsed), llama a Haiku (barato) para detectar patrón de fallo — 2026-05-28
- S25.2 `DiagnoseResult`: `{taskId, pattern, confidence, suggestion, details}`. 6 patrones: `deterministic_check`, `qa_specific_criterion`, `parse_error`, `rate_limit`, `scope_creep`, `unknown`. Fallback a `unknown` si el LLM devuelve JSON inválido. No ejecuta nada — solo sugiere — 2026-05-28
- S25.3 `orchestos task diagnose <id>` en `cli.ts`. Auto-trigger en `task run --all` cuando `status → failed_permanent`: llama a `diagnoseTask` e imprime diagnóstico en stderr — 2026-05-28
- S25.4 `src/__tests__/diagnose.test.ts` (5 tests): happy path con mock Haiku, task no encontrada, task sin runs, fallback JSON inválido, FailurePattern type. Fix: `mock.module('../db/runs.ts')` incluye `insertRun`/`listRuns`/`getRun` reales para no contaminar otros test files — 2026-05-28
- Validación: 199 tests · 0 fail — 2026-05-28

**SEMANA 26 — Memory conflict detection (patrón Engram BM25)**
- S26.1 `memory_fts` virtual table FTS5 (content='memory_entries') + 3 triggers (INSERT/UPDATE/DELETE) + rebuild en migración. `upsertMemory()` retorna `{id, candidates: ConflictCandidate[]}`. `CONFLICT_THRESHOLD=0.5` (|bm25|). `findCandidates()` LIMIT 5. 199 tests · 0 fail — 2026-05-28
- S26.2 `src/memory/judge.ts`: `judgeConflict()` llama Haiku vía OpenRouter. 6 relaciones: `conflict_with | supersedes | compatible | scoped | related | not_conflict`. Parseo JSON con fallback a `not_conflict`/`low`. 6 tests — 2026-05-28
- S26.3 Tabla `memory_conflicts(id, entry_a_id, entry_b_id, relation, confidence, resolved_at, created_at)` + FK + índices. `insertConflict` / `listConflicts(projectId?)` / `resolveConflict` CRUD. 7 tests — 2026-05-28
- S26.4 CLI: `orchestos memory conflicts [--project]` — tabla formateada ID/relation/confidence/created_at — 2026-05-28
- S26.5 13 tests nuevos (S26.2 judge + S26.3 CRUD). 212 tests · 0 fail. Commits `2caf365` + `b9d968d` + `88e0ab4` — 2026-05-28

**Decisiones de diseño Mes 6**
- BM25 en SQLite FTS5 — sin dependencia nueva, nativo en SQLite.
- LLM judge solo si hay candidato > threshold — no corre en cada upsert.
- Context monitor no bloquea — warnings estructurados con debounce de 5 calls.
- Embeddings opt-in (`--no-embed`) — proyectos sin API key no se rompen.
- Function calling con fallback YAML — providers sin tool support siguen funcionando.
- Diagnóstico nunca ejecuta — solo sugiere. El usuario aplica.

**Lista prohibida Mes 6** _(lo que NO se hizo — referencia histórica)_
- Dashboard web, UI gráfica, TUI interactiva.
- Nuevos providers de LLM — se mantuvieron los 4.
- Reescritura del scheduler.
- Plugin system, extensiones de terceros.
- Paralelismo entre tareas — sigue secuencial.
- KuzuDB — sin evidencia de escala real (10K+ nodos).

**Métrica Mes 6 — SÍ (2026-05-28)**
`embed_hits > 0` en 12 runs reales (todos `status: done`, `embed_hits: 3`). Planner sin errores YAML en 100% de los planes del mes (function calling elimina el problema estructuralmente). 212 tests · 0 fail.

---

### MES 7 — Observabilidad activa + calidad del pipeline

**SEMANA 27 — Context monitor wired en executor**
- S27.1–S27.3 `context_warnings_json TEXT` en tabla `runs` vía `safeAddColumn`. `InsertRunRecord` y `RunRecord` actualizados. Harness colecciona `contextWarnings[]` localmente y los persiste en todos los paths de `insertRun` — 2026-06-02
- S27.4 `TaskResult.contextWarnings` — harness retorna los warnings al caller — 2026-06-02
- S27.5 `runs --detail <id>` muestra sección `## Context monitor warnings` cuando el run disparó alguno — 2026-06-02
- S27.6 `src/__tests__/context-monitor-db.test.ts`: 5 tests (column exists, null default, single warning, multiple warnings, loop_detected) — 2026-06-02
- Validación: typecheck limpio · 218 tests · 0 fail — 2026-06-02

**SEMANA 28 — WHEN/THEN en acceptance_criteria (OpenSpec pattern)**
- S28.1 `spec draft` system prompt: criterios DEBEN estar en formato WHEN/THEN; template actualizado con ejemplo `WHEN <trigger> THEN <result>` — 2026-06-02
- S28.2 `src/spec/lint.ts`: `lintSpec(spec)` → `LintResult` con `findings[]` (criterio + suggestion), `structuredCount`, `freeFormCount`. Detecta WHEN/THEN case-insensitive — 2026-06-02
- S28.3 `orchestos spec lint <task-id>` — imprime criterios sin formato + sugerencia de conversión; exit 1 si hay findings — 2026-06-02
- S28.4 QA system prompt: añadida instrucción explícita para evaluar escenarios WHEN/THEN completamente — 2026-06-02
- S28.5 `src/__tests__/spec-lint.test.ts`: 12 tests (structured, lowercase, mixed-case, free-form, solo WHEN, solo THEN, texto en finding, suggestion con WHEN/THEN, 4 edge cases) — 2026-06-02
- Validación: typecheck limpio · 230 tests · 0 fail — 2026-06-02

**SEMANA 29 — Spec archive**
- S29.1 `SpecFrontmatter.status` amplía a `'draft' | 'approved' | 'archived'` + `archivedAt?: string`. `parseSpec` + `serializeSpec` actualizados — 2026-06-02
- S29.2 `src/spec/archive.ts`: `archiveSpec(root, taskId)` mueve spec a `.orchestos/specs/archive/YYYY-MM-DD-{id}.md`, actualiza `status: archived` + `archivedAt` — 2026-06-02
- S29.3 `listSpecs(root, includeArchived=false)`: por defecto filtra archived; `--all` carga también el directorio `archive/` — 2026-06-02
- S29.4 `orchestos spec archive <task-id>` + `orchestos spec list --all` — 2026-06-02
- `src/__tests__/spec-archive.test.ts`: 10 tests (archive moves file, date prefix, status archived, idempotence, list defaults, list --all includes archived) — 2026-06-02
- Validación: typecheck limpio · 240 tests · 0 fail — 2026-06-02

**SEMANA 30 — `runs analyze` — aprendizaje continuo v1**
- S30.1 `src/analyze/patterns.ts`: `groupRunsByOutcome(runs)` → `RunOutcomeGroups` (qaPass, qaFail, blocked, parseError, failReasons, topModels, avgCost, avgElapsed). Pure function, 0 dependencias externas — 2026-06-02
- S30.2 `analyzeRunPatterns(groups, model?)` → `PatternSuggestion[]` via Haiku. `parsePatternSuggestions(raw)` como parser puro testable — 2026-06-02
- S30.3 `orchestos runs --analyze [--last <n>]` — imprime patrones con frecuencia, confidence, fix_hint — 2026-06-02
- S30.4 Hook post-completion en `task run`: si `qaFail > 1` en últimos 20 runs → corre `analyzeRunPatterns` en background, imprime sugerencias si las hay. Best-effort (catch silencioso) — 2026-06-02
- S30.5 `src/__tests__/patterns.test.ts`: 16 tests (groupRunsByOutcome: empty, pass/fail/blocked/parse_error, model tracking, cost/elapsed averages, mixed; parsePatternSuggestions: valid JSON, markdown fences, empty, skip invalid items, default confidence, non-array) — 2026-06-02
- Validación: typecheck limpio · 256 tests · 0 fail — 2026-06-02

**Decisiones de diseño Mes 7**
- Context monitor: advisorio puro — nunca bloquea, solo persiste. Valor en observabilidad post-hoc.
- WHEN/THEN: lint no bloquea `spec approve` — opcional, informativo. Pressure sin enforcement duro.
- Archive: mueve archivo (no marca en DB) — specs activos/archivados son carpetas distintas.
- `runs analyze`: hook es best-effort con catch silencioso — nunca puede romper `task run`.
- Pattern analysis solo si `qaFail > 1` — no molesta en proyectos sin historial de fallos.

**Lista prohibida Mes 7** _(lo que NO se hizo — referencia histórica)_
- Dashboard web, UI gráfica de ningún tipo.
- Middleware chain ordenado (DeerFlow) — complejidad no justificada aún.
- Instincts / confidence scoring (ECC) — Mes 8+.
- Continuous learning v2 (hooks → instincts) — necesita más historial real primero.
- KuzuDB — sin evidencia de escala.

**Métrica Mes 7 — SÍ (2026-06-02)**
256 tests · 0 fail. `orchestos spec lint` detecta criterios sin WHEN/THEN en proyectos reales. `runs --analyze` pide Haiku y devuelve sugerencias estructuradas. Context monitor visible en `runs --detail`.

---

### MES 8 — Pipeline robusto + aprendizaje activo

**SEMANA 31 — Middleware chain (DeerFlow)**
- S31.1 (🧠 Claude) `src/run/middleware.ts`: `MiddlewareFn<TCtx>`, `RunContext`, `MiddlewareChain`, `createChain()`, `createRunContext()`, `ENRICHMENT_MIDDLEWARE_ORDER` (10 slots). Scope: enrichment-only — la fase de ejecución (LLM → contract → QA → revert) permanece orquestada por harness — 2026-06-02
- S31.2–S31.5 (⚡ DeepSeek) `src/run/middlewares/`: context-inject, memory-fetch, skill-route, tool-policy, instinct-apply (slot noop hasta S33). Cada middleware es una función pura que mutar `ctx` y llama `next()` — 2026-06-02
- S31.6 (⚡ DeepSeek) `harness.ts` refactorizado: reemplaza pipeline inline por `chain.run(ctx)`; el harness construye la chain y delega la fase de enrichment — 2026-06-02
- S31.7 (⚡ DeepSeek) 15 tests unitarios por middleware: context-inject, memory-fetch, skill-route, tool-policy con ctx mock — 2026-06-02
- Validación: 329 tests · 0 fail — 2026-06-02

**SEMANA 32 — Capabilities contract + Delta headers (OpenSpec)**
- S32.1 (🧠 Claude) Diseño de extensión del schema de spec: campo `capabilities: { added, modified, removed }` en frontmatter — contrato explícito entre draft y specs — 2026-06-02
- S32.2 (⚡ DeepSeek) `spec draft` actualizado: prompt genera bloque `capabilities` investigando specs existentes antes de rellenar `modified`/`removed` — 2026-06-02
- S32.3–S32.4 (⚡ DeepSeek) `spec lint` extendido: detecta specs con `modified`/`removed` sin delta headers (`## ADDED`, `## MODIFIED`, `## REMOVED`); valida que `## MODIFIED` tiene el bloque completo del requisito anterior — 2026-06-02
- S32.5 (⚡ DeepSeek) Tests: spec válido con deltas, spec inválido sin headers, spec inválido con MODIFIED parcial — 2026-06-02
- Validación: `spec lint` detecta los 3 casos · 0 regresiones — 2026-06-02

**SEMANA 33 — Instincts con confidence scoring (ECC)**
- S33.1 (🧠 Claude) Schema `instinct`: `id`, `trigger`, `action`, `confidence: 0–1`, `source: manual|auto`, `verified`, `created_at`. Umbrales: `< 0.6` = no aplicar sin revisión · `>= 0.8` = aplicar automáticamente — 2026-06-02
- S33.2–S33.3 (⚡ DeepSeek) `src/instincts/schema.ts` validador Zod + `src/instincts/store.ts` CRUD sobre tabla `instincts` en SQLite — 2026-06-02
- S33.4–S33.6 (⚡ DeepSeek) CLI: `instinct list`, `instinct add` (manual, confidence=1.0, verified=true), `instinct set-confidence <id> <value>` — 2026-06-02
- S33.7 (⚡ DeepSeek) Middleware `instinct-apply` activo en harness: aplica solo instincts `confidence >= 0.8` y `verified: true` — 2026-06-02
- S33.8 (⚡ DeepSeek) Tests: schema válido/inválido, CRUD store, middleware filtra por threshold — 2026-06-02
- Validación: instinct manual aplicado en run real · 0 regresiones — 2026-06-02

**SEMANA 34 — Continuous learning v2: runs → instincts (ECC)**
- S34.1 (🧠 Claude) Diseño del flujo: `runs --analyze` → threshold ≥ 3 runs con mismo patrón → `instinct propose` → instinct `unverified` esperando aprobación humana — 2026-06-02
- S34.2–S34.3 (⚡ DeepSeek) `analyze/propose.ts`: extiende `runs --analyze` con detección de threshold; `instinct propose` crea instinct `source: auto`, `confidence: 0.6`, `verified: false` — 2026-06-02
- S34.4–S34.5 (⚡ DeepSeek) CLI: `instinct review` (lista unverified), `instinct approve <id>` (verified=true, confidence+=0.1), `instinct reject <id>` (elimina) — 2026-06-02
- S34.6 (⚡ DeepSeek) Hook post-`task run`: si `runs --analyze` devuelve proposals nuevos, los muestra al finalizar. Best-effort — catch silencioso — 2026-06-02
- S34.7 (⚡ DeepSeek) Tests: threshold dispara proposal, approve/reject, hook no bloquea sin proposals — 2026-06-02
- Validación: flujo end-to-end · patrón detectado → proposal visible en `instinct review` — 2026-06-02

**SEMANA 35 — Cost tracker via transcript parsing (ECC)**
- S35.1 (⚡ DeepSeek) `src/run/transcript-parser.ts`: extrae `usage.input_tokens`, `usage.output_tokens` y modelo de cada mensaje del transcript JSON — 2026-06-02
- S35.2 (⚡ DeepSeek) Costo por sub-agente usando `src/router/pricing.ts` actualizado con modelos faltantes — 2026-06-02
- S35.3–S35.4 (⚡ DeepSeek) `runs.cost_usd` recalculado como suma total + columna `cost_breakdown_json`. `runs --detail` muestra tabla sub-agente | modelo | tokens | cost — 2026-06-02
- S35.5 (⚡ DeepSeek) Tests: parser extrae tokens de transcript mock, suma total correcta — 2026-06-02
- Validación: cost_usd total y breakdown verificados · 0 regresiones — 2026-06-02

**SEMANA 36 — Dashboard local**
- S36.0 (🔍 Claude) Precondición: lectura de `src/db/migrate.ts` + tipos de cada comando + formato `cost_breakdown_json` antes de escribir código — 2026-06-02
- S36.1 (🧠 Claude) Diseño de la UI: rutas `/runs`, `/tasks`, `/instincts`, `/specs`; contrato API interna — 2026-06-02
- S36.2 (⚡ DeepSeek) `src/dashboard/server.ts`: Bun.serve con rutas REST que leen SQLite y devuelven JSON — 2026-06-02
- S36.3–S36.6 (⚡ DeepSeek) Vistas: `/runs` (cost breakdown + warnings), `/tasks` (status + QA verdict), `/instincts` (approve/reject desde UI), `/specs` (lint badge) — 2026-06-02
- S36.7–S36.8 (⚡ DeepSeek) CLI `orchestos dashboard [--port 4242]`; HTML/JS estático en `src/dashboard/public/` — vanilla JS, sin bundler, sin dependencias externas — 2026-06-02
- Validación: 4 vistas navegadas con datos reales · approve/reject instinct desde UI funciona · 369 tests · 0 fail — 2026-06-02

**Decisiones de diseño Mes 8**
- Middleware chain scope: enrichment-only. La fase de ejecución (LLM → contract → checks → QA → revert → insertRun) es una máquina de estados con flujo de error complejo — moverla a middlewares oscurece sin beneficio. Los middlewares son los pasos de preparación que son independientes entre sí.
- Instincts conviven con skills, no las reemplazan. Skills = comportamiento declarativo por dominio. Instincts = comportamientos atómicos granulares aprendidos. Ambos alimentan el system prompt.
- Continuous learning: proposals nunca se auto-aplican. Confidence 0.6 + verified:false es el estado inicial. El humano decide siempre antes de que un instinct auto llegue al harness.
- Dashboard: vanilla JS + Bun.serve, cero dependencias externas. Lee SQLite directamente — no hay capa de API adicional. `--port` configurable, sin auth (tool local).
- Delegación Claude/DeepSeek documentada en PLAN.md: 🧠 para diseño de contratos y arquitectura, ⚡ para implementación especificada, 🔍 para gates de validación obligatorios.

**Lista prohibida Mes 8** _(lo que NO se hizo — referencia histórica)_
- Onboarding adaptativo (wizard primera vez).
- KuzuDB — sin evidencia de escala todavía.
- Clasificador semántico para `needsClarify`.
- Resolución de imports relativos para lenguajes no-JS.
- autoskills registry.
- Memoria en capas (DeerFlow) — SQLite + topic_key actual es suficiente.

**Métrica Mes 8 — SÍ (2026-06-02)**
369 tests · 0 fail. Harness refactorizado con middleware chain. Instincts con confidence activos en runs. Continuous learning cierra loop runs→instincts. Cost breakdown por sub-agente en `runs --detail`. Dashboard local sirve 4 vistas desde SQLite real.

---

### MES 9 — Dashboard usable: de observador a orquestador

**BLOQUE A — Navegación y estructura**
- A1 (🧠) Reordenar nav: Tasks primero, Runner eliminado, pantalla por defecto = Tasks. Nav final: Tasks → Runs → Memory → Instincts → Specs → Settings — 2026-06-03

**BLOQUE B — Runner / entrada principal**
- B1 (🧠) Barra de composición en Tasks: textarea lenguaje natural → "Crear y ejecutar" → crea task + lanza CLI en background. Botón "Avanzado" abre modal completo — 2026-06-03

**BLOQUE C — Tasks (UX)**
- C1 (⚡) Ordenar columnas al hacer click en el header (status, retries, qa) — 2026-06-03
- C2 (⚡) Filtrar por status con tabs: Todos · Pending · Running · Done · Failed — 2026-06-03
- C3 (🧠) New Task — eliminar campo "Task ID": slug kebab-case automático desde las primeras 4–5 palabras de la descripción — 2026-06-03
- C4 (🧠) New Task — "Output files" → "Archivos a crear o modificar (opcional)" — 2026-06-03
- C5 (⚡) Executor con nombres humanos en Compose modal: "Rápido (DeepSeek)" · "Preciso (Claude)" · "Económico (OpenAI)" — 2026-06-03

**BLOQUE D — Memory**
- D1 (⚡) Barra de búsqueda en Memory — filtra por topic_key o contenido, client-side — 2026-06-03

**BLOQUE E — Instincts (UX para no-devs)**
- E1 (🧠) Pantalla Instincts reescrita con lenguaje humano: "Hábitos del agente" · "Enseñar un hábito nuevo" · confianza Alta/Media/Baja · secciones propuestos/activos/inactivos — 2026-06-03

**BLOQUE F — Runs**
- F1 (⚡) Auto-refresh en Runs cada 5s + indicador "● actualizando" / "● en espera" — 2026-06-03
- F2 (⚡) Filtro por status en Runs: Todos · Running · Done · Failed — 2026-06-03

**BLOQUE G — Specs**
- G1 (🧠) Banner explicativo "¿Qué es una Spec?" siempre visible + empty state guiado — 2026-06-03
- G2 (⚡) Botón "Nueva Spec" → modal (selector de tarea + desc auto-rellena) → `POST /api/specs/draft` → CLI en background — 2026-06-03

**BLOQUE H — Input natural (visión)**
- H1 (🧠) `POST /api/natural` → claude-haiku con contexto del proyecto → `TaskDraft {id, description, output[], executor}`. Compose bar en dos fases: escribe → IA genera borrador editable → confirmar y ejecutar. Fallback gracioso si falla IA — 2026-06-03

**BLOQUE I — Setup automático (onboarding)**
- I1 (🧠) Comando `orchestos setup` — checklist pre-flight: Bun · bun install · API keys · tasks.yaml · DB · índice de código — 2026-06-03
- I2 (⚡) Pantalla "Setup" en dashboard — misma checklist visual, auto-mostrada si falta prerequisito crítico. Settings fusionado con Setup — 2026-06-03
- I3 (⚡) Auto-run `bun install` al iniciar `orchestos dashboard` si falta node_modules. Sin preguntar, con fallback de error — 2026-06-04
- I4 (🧠) Installer de un solo archivo: `install.bat` (doble-click Windows) + `install.ps1` + `install.sh` (Mac/Linux). Detecta/instala Bun, `bun install`, crea `~/.orchestos/.env` con comentarios, pausa interactiva si falta API key, abre dashboard — 2026-06-04

**BLOQUE J — i18n + bugs de UI**
- J1 (🧠) i18n completo: `i18n.js` con diccionarios `en`/`es` + `t(key, ...args)` global en `window`. Selector de idioma en Settings → `localStorage('orchestos-lang')`. Todas las pantallas usan `t()`. Fix bug memory search: `requestAnimationFrame` restaura foco — 2026-06-03

**No planificado — shipeado durante el mes**
- Chat panel con selector de modelo universal — envía mensajes al LLM con contexto del proyecto, respuesta en streaming. Selector de modelo aplica globalmente al panel — 2026-06-03 (af7c65c)
- Ops screen con assets de branding (logo, mark, favicon SVG) — 2026-06-03 (757a4f2)
- Fix: system prompt del chat refleja el modelo real seleccionado, no el hardcoded — 2026-06-03 (d77847f)

**Decisiones de diseño Mes 9**
- Compose bar de dos fases (escribe → borrador IA → confirma) no interrumpe el flujo si la IA falla — fallback a slug simple. El error de IA nunca bloquea la creación de tareas.
- Slug auto desde descripción: kebab-case de primeras 4–5 palabras. Elimina fricción sin perder trazabilidad (el ID sigue siendo legible).
- i18n como ciudadano de primera clase desde el inicio del dashboard — `t()` global en lugar de strings hardcodeados en cada pantalla. Coste de adopción: cero si se hace antes de escalar pantallas.
- Installer con pausa interactiva en la API key: la herramienta no arranca si el prerrequisito crítico no está. Evita confusión del no-dev ante un dashboard roto.
- Chat panel shipeado fuera de plan porque el modelo base ya existía (`/api/natural`) — reutilizar sin añadir dependencias nuevas.
- Instincts con lenguaje humano: los nombres internos (`confidence`, `verified`, `source`) nunca aparecen en la UI de no-devs. La abstracción es "hábito" con tres estados comprensibles.

**Lista prohibida Mes 9** _(lo que NO se hizo — referencia histórica)_
- Micrófono / dictado — análisis hecho, gap es `STTProvider` abstraction, pospuesto.
- Files como input en Chat — entrada conversacional bien definida, pospuesto.
- Arquitectura humano/operador (toggle "modo avanzado") — Mes 10+, necesita dashboard estable primero.
- VISION.md — brújula del producto, pospuesto.
- Control Center (salud continua) — delta sobre I2 Setup, pospuesto.
- Landing page — precisa VISION.md primero.
- KuzuDB — sin evidencia de escala.

**Métrica Mes 9 — SÍ (2026-06-04)**
Dashboard convertido en interfaz principal de trabajo: 10 bloques cerrados (A–J), 16 items `[x]`. Input de lenguaje natural operativo con preview de IA. i18n en/es completo. Instalador de un solo archivo para Windows y Mac/Linux. Chat panel + modelo selector shipeado fuera de plan. 369 tests · 0 fail mantenidos.

---

### MES 10 — El producto que alguien que nunca programó puede usar

**BLOQUE A — Diagnóstico de fallos en el dashboard**
- A1 (🧠) Diseño: endpoint `GET /api/tasks/:id/diagnose` → `DiagnoseResult`, on-demand con botón "Ver diagnóstico" — no auto-call en background — 2026-06-04
- A2 (⚡) `GET /api/tasks/:id/diagnose` en `server.ts` — llama `diagnoseTask(id, root)`, devuelve JSON — 2026-06-04
- A3 (⚡) Panel inline en Tasks: chip "Ver diagnóstico" en fila `failed` → expand con pattern · confidence (Alta/Media/Baja) · suggestion · details — 2026-06-04
- A4 (⚡) Botón "Reintentar" → `POST /api/tasks/:id/run`; botón "Convertir en hábito" → `POST /api/instincts` con trigger+action del diagnóstico — 2026-06-04
- A5 (🔍) Gate: 3 defectos corregidos — pattern crudo→humano (7 valores `FailurePattern`), `patternLabels` incompleto (faltaban `context_overflow` y `unknown`), `habitTrigger` genérico→incluye ID de tarea — 2026-06-04

**BLOQUE B — Vista editable de "lo que OrchestOS sabe del proyecto"**
- B1 (🧠) Diseño: textarea libre con helper text, auto-save debounce 1s, CONTEXT.md read-only + botón Regenerar — 2026-06-04
- B2 (⚡) `GET/PUT /api/project/constitution` · `GET /api/project/context` · `POST /api/project/context/regenerate` — 2026-06-04
- B3 (⚡) Pantalla "Proyecto": tabs "Guía del agente" / "Contexto comprimido", auto-save + indicador idle/saving/saved/error, Regenerar con re-fetch 1.5s — 2026-06-04
- B4 (⚡) Nav actualizado (entre Memory e Instincts), i18n 13 claves en/es, CSRF guard extendido a PUT, `ICON.project` — 2026-06-04
- B5 (🔍) Gate: PUT escribe a `join(resolve('.'), 'CONSTITUTION.md')` (mismo path que usa el harness), auto-save ✓, regenerate ✓, typecheck verde — 2026-06-04

**BLOQUE C — Control Center: Setup → salud continua**
- C1 (🧠) Diseño 5 secciones: sistema (prerequisitos), tareas bloqueadas, aprobación pendiente, costo 7d, últimos aprendizajes. Contratos de 5 endpoints — 2026-06-04
- C2 (⚡) `GET /api/health` — 5 bloques desde SQLite: checklist, `failed_permanent` no diagnosticados, unverified+draft, `sum(cost_usd 7d)`, últimos 5 instincts auto — 2026-06-04
- C3 (⚡) I2/Setup extendida: checklist superior + 5 bloques de salud con semáforo + auto-refresh 30s + links directos a pantalla relevante — 2026-06-04
- C4 (⚡) Pantalla de inicio adaptativa: `attentionCount > 0 || cost > threshold` → settings; sin atención + `advanced` → runs; normal → tasks — 2026-06-04
- C5 (🔍) Gate: 1 defecto corregido (auto-refresh 30s faltaba en C3). 5 bloques + semáforo + `data-nav+data-filter` + i18n en/es ✓ — 2026-06-04

**BLOQUE D0 — Detección de modelos locales (Ollama)**
- D0-1 (🧠) Diseño: `GET /api/providers/local`, `state.localModels`, prefijo `ollama/`, executor `'ollama'`, warning dismissible `sessionStorage`, system prompt diferenciado — 2026-06-04
- D0-2 (⚡) `GET /api/providers/local` — probe `localhost:11434/api/tags` con AbortSignal 1s, devuelve `{ available, models }` — 2026-06-04
- D0-3 (⚡) Selector: `loadLocalModels()`, optgroup "Local (Ollama)", warning dismissible. i18n 3 claves en/es — 2026-06-04
- D0-4 (⚡) `inferExecutorFromModel` rama `/^ollama\//`, `ollamaChat()` → `localhost:11434/v1/chat/completions`, `handleApiChat` ramifica por executor — 2026-06-04
- D0-5 (🔍) Gate: `/api/providers/local` devuelve modelos ✓, chat via `ollama/qwen2.5-coder:7b` funcional ✓, cloud sin cambios ✓ — 2026-06-04

**BLOQUE D0-ext — Mejoras UX al selector y Settings Ollama**
- D0-ext-1 (⚡) Locales primero en selector + buscador en tiempo real `buildModelOpts()` con `withSearch=true` solo en chat. XSS seguro — 2026-06-04
- D0-ext-2 (⚡) Settings Ollama: badge "Detected/Not detected" por probe real (no por env var), input "Override URL (opcional)" para Ollama remoto — 2026-06-04

**BLOQUE D — Archivos como input en Chat**
- D1 (🧠) Diseño: FormData multipart, pipeline por tipo (imagen→base64, PDF→texto regex, texto→directo), límite 10MB, fallback si provider sin visión — 2026-06-04
- D2 (⚡) `POST /api/chat/upload` — almacenamiento en memoria (expira al cerrar sesión), PDF→texto con regex sobre buffer, imagen→base64 — 2026-06-04
- D3 (⚡) Botón clip 📎 en chat, chip del archivo sobre input, `fileId` en POST, backend inyecta como `image_url` o bloque de texto precediendo la pregunta — 2026-06-04
- D4 (⚡) "Crear tarea desde esta conversación" tras 3+ mensajes, pre-fill con últimos 3 mensajes del usuario (no el volcado completo) — 2026-06-04
- D5 (🔍) Gate: PDF 2 páginas extraído ✓, imagen descrita por visión ✓, seed 152 chars accionables vs 236 del volcado ✓ — 2026-06-04

**BLOQUE E — Wizard API key: resolver el muro del cold-start**
- E1 (🧠) Diseño: trigger desde checklist ("Configurar ahora") + Settings ("Cambiar clave"), `Modal.openWizard()`, 3 pasos, rollback solo en 401, key nunca en logs ni response — 2026-06-04
- E2 (⚡) `POST /api/setup/api-key` — `writeEnv` existente (merge), test call `max_tokens:1`, errores→mensajes humanos, rollback 401, tipo `ApiKeyValidationResponse` — 2026-06-04
- E3 (⚡) `Modal.openWizard()` + `Modal._renderWizard()` — 3 pasos, dots indicator, toggle ver/ocultar, spinner. i18n 24 claves en/es — 2026-06-04
- E4 (⚡) Trigger desde I2 (action `open-wizard`) + Settings (botón "Cambiar clave"). Éxito: `App.fetchAll()` + toast — 2026-06-04
- E5 (🔍) Gate: wizard 3 proveedores ✓, 3 pasos ✓, wire `data-open-wizard` → `Modal.openWizard()` ✓, i18n en/es ✓ — 2026-06-04

**BLOQUE F — Superficie humano vs operador**
- F1 (🧠) Diseño: `operator:true` en runs/memory/specs, `localStorage('orchestos-mode')`, `buildNav()`, `ICON.sliders`, `.nav-mode-btn`, badge `adv`, transición opacity 250ms, redirect al desactivar desde pantalla operador — 2026-06-04
- F2 (⚡) `buildNav()` extraída de `boot()`: filtra por modo, badge `adv`, botón toggle, fade-in 250ms en ítems operator, redirect a Tasks al volver a normal desde pantalla operador — 2026-06-04
- F3 (⚡) i18n: `nav.mode.enable` / `nav.mode.disable` en/es. Banners `.spec-explainer` en Runs y Memory con texto humano. 8 claves i18n — 2026-06-04
- F4 (🧠) Banners explicativos "What are Runs?" y "What is Memory?" — aparecen en todos los estados (loading/error/empty/populated) — 2026-06-04
- F5 (⚡) Pantalla de inicio: `advanced` sin atención → runs; normal sin atención → tasks. Fusionado con C4 en `fetchAll()` — 2026-06-04
- F6 (🔍) Gate: modo normal ✓ · avanzado con Runs/Memory/Specs y badge `adv` ✓ · persistencia tras reload ✓ · redirect a Tasks al desactivar desde Runs ✓ — 2026-06-04

**Decisiones de diseño Mes 10**
- Diagnóstico on-demand — LLM call solo cuando el usuario lo pide; no en background al cargar Tasks.
- `PUT /api/project/constitution` escribe al mismo path que usa el harness — una sola fuente de verdad, sin sincronización.
- Control Center extiende I2, no es pantalla nueva — reutiliza checklist + infraestructura existente.
- Ollama como ciudadano de primera clase: prefijo `ollama/` + optgroup separado + probe automático. Sin API key.
- Archivos en Chat son input conversacional (no `context authorize`) — dos superficies con propósito diferente.
- Wizard: rollback solo en 401 (key claramente inválida). 402/timeout/5xx no hacen rollback.
- `buildNav()` re-renderiza el DOM en cada toggle — simplicidad sobre complejidad. Fade-in vía `requestAnimationFrame`.
- Stacking context del sidebar: `z-index:1` para que los tooltips escapen el CSS Grid.

**Lista prohibida Mes 10** _(lo que NO se hizo — referencia histórica)_
- Autoría de skills con curador (normalizador de intención) — prerequisitos listos, scope grande para Mes 11.
- Pack curado de skills de ingeniería "pro" — espera al curador.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 10 — SÍ (2026-06-04)**
Wizard API key completo: 3 proveedores, validación real, rollback en 401, i18n 24 claves. Toggle humano/operador navegable con persistencia y redirect automático. Diagnóstico en Tasks con "Reintentar" + "Convertir en hábito". Archivos (imagen/PDF) en Chat + "Crear tarea desde conversación". Control Center con 5 bloques + semáforo + auto-refresh 30s. Ollama auto-detectado. 369 tests · 0 fail.

---

### MES 11 — OrchestOS como experto: autoría de skills con curador

**BLOQUE A — API backend de skills**
- A1 (⚡) `GET /api/skills` — lee `skills/*.yaml`, valida con `validateSkill()`, devuelve lista — 2026-06-09
- A2 (⚡) `GET /api/skills/:id` — devuelve un skill o 404 — 2026-06-09
- A3 (⚡) `POST /api/skills` — valida, escribe `skills/{id}.yaml`, rechaza duplicados — 2026-06-09
- A4 (⚡) `PUT /api/skills/:id` — sobreescribe YAML existente, revalida antes de persistir — 2026-06-09
- A5 (⚡) `DELETE /api/skills/:id` — requiere `{ confirm: true }` en el body — 2026-06-09
- A6 (⚡) `POST /api/skills/:id/build` — ejecuta `compileSkill()`, devuelve paths de artefactos — 2026-06-09

**BLOQUE B — Pantalla Skills en el dashboard**
- B1 (⚡) Ruta `/skills` en el nav con badge de conteo — 2026-06-09
- B2 (⚡) Vista lista: cards con nombre, descripción, targets como badges, botones Editar/Exportar/Borrar — 2026-06-09
- B3 (⚡) Modal de detalle con todos los campos del `SkillDef` (instrucciones, verifiers, examples…) — 2026-06-09
- B4 (⚡) Confirmación de borrado inline (no prompt del browser) — 2026-06-09
- B5 (⚡) Botones flotantes "Nueva skill" e "Importar" en la cabecera — 2026-06-09

**BLOQUE C — Curador LLM**
- C1 (🧠) System prompt del curador: extrae `id`, `name`, `description`, `instructions`, `targets`, `when_to_use`, `anti_patterns`, `verifiers` desde lenguaje natural — 2026-06-09
- C2 (⚡) `POST /api/skills/curate` — `{ text }` → LLM (Haiku) → `SkillDef` parcial sin guardar — 2026-06-09
- C3 (⚡) Gate de validación: hasta 2 reintentos si `validateSkill()` falla — 2026-06-09
- C4 (🔍) Review: 5 descripciones (técnica, vaga, es, en, multi-paso) — 5/5 útil sin editar, iter=1 en todos, encoding UTF-8 correcto — 2026-06-09

**BLOQUE D — Puerta Escribir**
- D1 (⚡) Textarea "Describe tu skill en lenguaje natural" + botón "Curar con IA" — 2026-06-09
- D2 (⚡) Pre-rellena formulario editable con los campos generados por el curador — 2026-06-09
- D3 (⚡) Preview del YAML resultante antes de guardar — 2026-06-09
- D4 (⚡) "Guardar" → `POST /api/skills`, cierra modal, refresca lista — 2026-06-09

**BLOQUE E — Puerta Importar**
- E1 (⚡) Sub-tab URL: fetch del YAML crudo → normaliza con curador si faltan campos → preview — 2026-06-09
- E2 (⚡) Sub-tab YAML pegado: `validateSkill()` → curador normaliza si falla → preview — 2026-06-09
- E3 (⚡) Preview compartido con warnings de normalización — 2026-06-09
- E4 (⚡) "Importar" → `POST /api/skills`, maneja conflicto de id (ofrece renombrar) — 2026-06-09

**BLOQUE F — Puerta Exportar**
- F1 (⚡) Botón "Exportar YAML" → `GET /api/skills/:id/export`, descarga `{id}.yaml` — 2026-06-09
- F2 (⚡) Botón "Copiar YAML" al portapapeles (mismo contenido que F1) — 2026-06-09
- F3 (⚡) `GET /api/skills/:id/export` — devuelve YAML con `Content-Disposition: attachment` — 2026-06-09

**BLOQUE G — Pack "pro" de ingeniería**
- G1 (🧠) Selección y escritura de 8 skills "pro": `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen` — 2026-06-10
- G2 (🧠) Cada skill validado con `validateSkill()` y probado en una tarea real — 8/8 OK — 2026-06-10
- G3 (⚡) Sección "Skills recomendados" en la pantalla Skills con botón "Importar" — 2026-06-10
- G4 (⚡) YAMLs en `skills/pro/` (separado de `skills/`) — `listSkillFiles()` no recorre subdirectorios, sin colisión — 2026-06-10
- G5 (🔍) Review del pack: `/api/skills/pro` y `/api/skills/pro/:id/import` probados (list, import, conflicto 409); `code-review` importado y ejecutado en `run --dry-run`, guidelines inyectadas correctamente; 369 tests · 0 fail · tsc sin errores — 2026-06-10

**BLOQUE H — CLI: curate e import**
- H1 (⚡) `orchestos skill curate "<descripción>"` — llama al curador vía API, imprime YAML draft; `--save` guarda directamente — 2026-06-10
- H2 (⚡) `orchestos skill import <url>` — fetch + normalización + guarda en `skills/`, reusa el endpoint E1 — 2026-06-10
- H3 (⚡) Tests unitarios de los comandos CLI con mock de la API — 2026-06-10

**BLOQUE I — Tests y cierre**
- I1 (⚡) Unit tests del curador con LLM mockeado: happy path (iter=1), JSON inválido en los 3 intentos (422), recuperación en retry (iter=2), error/timeout (502), `text` faltante (400) — 2026-06-10
- I2 (⚡) Integration tests A1-A6, F3 y pack pro (`GET /api/skills/pro`, `POST /api/skills/pro/:id/import`) vía `route()` exportado de `server.ts`, fixtures temporales limpiadas en `afterEach` — 2026-06-10
- I3 (⚡) 402 tests · 0 fail — incluye fix de mock incompleto en `diagnose.test.ts` que rompía `saveTasks` al cargar `server.ts` — 2026-06-10
- I4 (🔍) Gate final: dashboard up (`/` 200), `GET /api/skills/pro` 200 (8 skills), export 200 con `Content-Disposition: attachment`, `skill curate` contra dashboard real produjo YAML válido sin `--save`, servidor detenido sin artefactos sueltos, tsc sin errores — 2026-06-10

**Decisiones de diseño Mes 11**
- `SkillDef` YAML propio sigue siendo la fuente de verdad — agentskills.io es puerto de entrada/salida en el borde, nunca formato central.
- Curador único con tres puertas (escribir/importar/exportar) — un solo pipeline de normalización a `SkillDef`, no tres distintos.
- Pack "pro" vive en `skills/pro/` (no `skills/`) para no colisionar con las skills del usuario; `listSkillFiles()` no recorre subdirectorios.
- `description`/`when_to_use` como condiciones de disparo ("Use when…"), nunca workflow — disciplina heredada de superpowers/mattpocock.
- Curador con hasta 2 reintentos antes de fallar — balance entre robustez y costo de LLM calls.

**Lista prohibida Mes 11** _(lo que NO se hizo — referencia histórica)_
- Endurecimiento "Iron Law / Common Rationalizations / Red Flags" en skills existentes — espera evidencia de uso del pack pro.
- `brainstorming`/planning socrático (superpowers `writing-plans` + mattpocock `grill-me`) — candidato fuerte para Mes 12.
- `verification-before-completion` y par `requesting/receiving-code-review` — quedan en backlog.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 11 — SÍ (2026-06-10)**
Pantalla Skills completa en el dashboard (galería + crear + importar + exportar). Curador LLM (`/api/skills/curate`) normaliza lenguaje natural a `SkillDef` válido con retry — 5/5 descripciones de prueba útiles sin editar. Tres puertas operativas: escribir (curador + preview), importar (URL/YAML + normalización + warnings), exportar (download/copiar con `Content-Disposition`). Pack "pro" de 8 skills de ingeniería en `skills/pro/`, importables con un click, 8/8 validados y probados. CLI `skill curate`/`skill import` con paridad del dashboard. 402 tests · 0 fail · tsc sin errores.

---

### MES 12 — Endurecimiento: red de seguridad antes de la autonomía

Origen: auditoría de seguridad/testing/backend/frontend (2026-06-19) — calificación de entrada Seguridad B · Testing B+ · Backend A- · Frontend C+/B-. Eje: convertir la disciplina manual en garantías automáticas, hardening previo al runner de grafo autónomo (ver IDEAS.md § Largo plazo).

**BLOQUE A — Red de seguridad del motor crítico**
- A1 (⚡) Tests de `enforceContract`/`parseLLMResponse` (`src/run/contract.ts`) — write autorizado, write bloqueado fuera de `allowedPaths` con `CONTRACT VIOLATION` y cero escritura, parseo de bloques `<<<FILE:...>>>`, traversal `../` bloqueado — 2026-06-19
- A2 (⚡) Tests de `executePlan` (`src/run/scheduler.ts`) con `executeOne` mockeado — orden topológico, cascada de `skipped` por dependencia fallida, `timed_out`, agregación de cost/tokens/ms, `all_passed` — 2026-06-19
- A3 (🔍) Gate de mutación: comentado el `throw` del guard de `enforceContract` — 3 tests se pusieron rojos y el path traversal `../outside-project.txt` se materializó en disco, confirmando que el test detecta la regresión real. Revertido: 19/19 verde — 2026-06-19

**BLOQUE B — Guardarraíles automáticos: CI + pre-commit**
- B1 (⚡) `.github/workflows/ci.yml` — `bun install` + `bun test` + `bun run typecheck` en push/PR a `master` — 2026-06-19
- B2 (⚡) `scripts/pre-commit.sh` instalado en `.git/hooks/pre-commit` — `tsc --noEmit` antes de cada commit — 2026-06-19
- B3 (⚡) `noUnusedLocals`/`noUnusedParameters` activados en `tsconfig.json` + limpieza de código muerto en `planner.ts`, `harness.ts`, `server.ts`, `registry.ts`, `embeddings.ts`, `cli.ts`, `archive.ts` y otros — 2026-06-19
- B4 (🔍) Gate: PR #2 con test roto a propósito (`expect(1+1).toBe(999)`) — CI lo bloqueó en 10s. Rama eliminada, master limpio: 421 pass · 0 fail — 2026-06-19

**BLOQUE C — Cierre del XSS latente del dashboard**
- C1 (⚡) Auditoría de los ~30 `innerHTML` del front — los que renderizan datos dinámicos (skills, tareas, memoria, instincts, contenido importado) pasan por el helper `esc()` o se migraron a `textContent`; los que solo insertan constantes `ICON.*` se dejaron intactos — 2026-06-19
- C2 (🔍) Gate con payload real: skill creado vía `POST /api/skills` con `name`/`description` conteniendo `<img src=x onerror=alert(1)>` y `<script>alert()</script>` — verificado en vivo con Chrome DevTools MCP en la pantalla Skills: cero `alert()` disparado, cero nodos `<script>`/`<img>` inyectados en el DOM, texto visible escapado literalmente. Skill de prueba borrado tras verificar — 2026-06-19

**BLOQUE D — Split del god-file `server.ts`**
- D1 (🧠) Diseño documentado en `docs/dashboard-server-split.md` — mapa símbolo→archivo, grafo de dependencias sin ciclos, orden de extracción por riesgo. `route()` se mantiene como única export que consume `skills-api.test.ts` — 2026-06-19
- D2 (⚡) Extracción ejecutada siguiendo D1 — 13 módulos nuevos (`http.ts`, `settings-store.ts`, `llm/clients.ts`, `prompts/curator.ts`, 9 handlers de dominio en `handlers/`), comportamiento idéntico — 2026-06-19
- D3 (🔍) Gate re-verificado de forma independiente (sin confiar en el self-check de DeepSeek): `tsc --noEmit` limpio, 421 pass · 0 fail, lectura línea por línea de los 13 archivos contra el original — CSRF same-origin check, containment de `serveStatic`, `confirm:true` obligatorio en delete, rollback de API key en 401 y masking de keys, todos idénticos. `server.ts` quedó en 159 líneas (vs. 1727 original) — 2026-06-19

**Decisiones de diseño Mes 12**
- El hardening (Bloques A-C) precede a cualquier autonomía — no se construye un runner que se conduce solo encima de un motor sin red de tests.
- Los gates de seguridad (A3, C2) verifican que el test detecta la regresión real, no solo que "pasa" — mutación deliberada del guard, payload XSS real en vivo.
- D1 es la única pieza con criterio arquitectural del mes (Claude); D2/D3 son ejecución mecánica y verificación, delegables.
- `route()` se preserva como single entry point del routing tras el split — ningún test de integración necesitó reescritura.

**Lista prohibida Mes 12** _(lo que NO se hizo — referencia histórica)_
- Runner de grafo autónomo (el loop que se conduce solo) — deliberadamente fuera de alcance hasta que A-D cerraran. Candidato directo para Mes 13 (ver IDEAS.md § Largo plazo).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 12 — SÍ (2026-06-19)**
Motor crítico (`contract.ts` + `scheduler.ts`) con tests y gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2). Pre-commit hook con `tsc --noEmit`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail · tsc sin errores.

---

### MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

Origen: sesión de uso real 2026-06-23 + items pendientes de IDEAS.md (web fetch en chat, autoskills). Eje: romper el aislamiento — traer conocimiento externo por las vías donde el usuario interactúa (chat, skills, modelos), reusando infraestructura existente (tool-calling S23, curador/`normalizeImport` Mes 11) en vez de reconstruirla.

**BLOQUE S13.0 — Pre-flight: pulido de UI detectado en uso real**
- S13.0.1 (⚡) Edición de skills real — el botón "Editar" abría el modal read-only; ahora abre formulario editable con `PUT /api/skills/:id`, con `GET /api/skills/:id` previo (la lista trunca `instructions` a `instructionSummary`) y `id` bloqueado en modo edición — 2026-06-23
- S13.0.2 (⚡) Ícono "YAML Preview" gigante — `ICON.chev` sin regla CSS de tamaño; clase `.m-details` + `width:12px;height:12px` — 2026-06-23
- S13.0.3 (⚡) Caché de modelos OpenRouter sin invalidación — `loadOrModels()` se congelaba en la primera carga; TTL de 1h + botón Refresh manual — 2026-06-23
- S13.0.4 (🔍) Gate: `glm-5.2` apareció en el selector sin recargar la página; Refresh disparó fetch real (`orModelsLastFetch` avanzó); skills/ícono confirmados en vivo — 2026-06-23

**BLOQUE A — Web fetch real en el Chat**
- A1 (🧠) Diseño documentado en `docs/chat-web-fetch-design.md`. Hallazgo que cambió el alcance: `callWithTools()` (S23) es de un solo turno (así lo usa el planner) — no soporta conversación multi-turno ni texto+tool-call mixto. Se decidió implementar `runToolLoop()` como capa nueva, sin tocar `callWithTools`/el planner — 2026-06-23
- A2 (⚡) `runToolLoop()` en `tool-call.ts` (historial multi-turno Anthropic `tool_result` / OpenAI `role:'tool'`) + `FETCH_URL_TOOL` + wiring en `handleApiChat`, fallback intacto para Ollama/modelos sin tool-calling — 2026-06-23
- A3 (⚡) Guard SSRF (`src/dashboard/ssrf.ts`): localhost, 5 rangos privados, dominios `.local`/`.localhost`, resolución DNS de todas las IPs; cap 256 KB, timeout 10s, content-type allowlist — 2026-06-23
- A4 (🔍) Gate — **2 bugs reales encontrados solo al verificar en vivo, no por los 27 tests que ya pasaban**: (1) `checkSsrSafe` usaba `dns.resolve4()` — consulta DNS directa que falla `ECONNREFUSED` en redes que la restringen, aunque la resolución normal (la de `fetch()`) funcione ahí mismo; bloqueaba dominios públicos legítimos. Fix: `lookup(hostname, {all:true, family:4})`. (2) `executeFetchUrl` tenía un solo parámetro pero `ToolExecutor` la invoca con 2 (`toolName, input`) — JS ignoraba el extra, `input` real era el string `'fetch_url'`. Los mocks de los tests ya usaban la firma correcta, por eso ocultaban el bug. Verificado en vivo: URL real trae contenido exacto carácter por carácter, `localhost` bloqueado con mensaje verbatim, payload de prompt injection vía httpbin.org no fue obedecido por el modelo. 468 tests · 0 fail — 2026-06-23

**BLOQUE B — autoskills: skill fetch desde un registry**
- B1 (🧠) Decisión de arquitectura en `docs/autoskills-registry-design.md`: consumir el índice real de `cdn.jsdelivr.net/npm/autoskills/skills-registry/index.json` + `raw.githubusercontent.com` para contenido — `normalizeImport()` (Mes 11) ya es agnóstica al formato de entrada, se reusa sin tocar — 2026-06-23
- B2 (⚡) `orchestos skill fetch --list/--name <id>` — `fetchRegistryList()`/`fetchRegistrySkillContent()` aisladas en `src/skills/fetch.ts` — 2026-06-23
- B3 (⚡) `GET /api/skills/registry` + `POST /api/skills/registry/:id/import`, sección "Discover skills" en el dashboard con botón Import por card — 2026-06-23
- B4 (🔍) Gate — **1 bug real encontrado**: `Bun.serve()` usa `idleTimeout` de 10s por defecto; el import (fetch + normalización LLM, hasta 3 reintentos) tarda 6-14s — la conexión se cortaba antes de entregar la respuesta aunque el archivo ya se hubiera escrito (confirmado: segundo intento devolvió "Skill already exists"). Fix: `idleTimeout: 60`. Verificado en vivo: 217 skills reales listadas, `svelte5-best-practices` (description original 591 chars) importada con éxito normalizada a 97 chars, flujo completo desde la UI (Discover → Import → badge del nav 12→13) — 2026-06-23
- B5 (🧠) Fix del prompt del curador — `CURATOR_SYSTEM`/`IMPORT_SYSTEM` decían "truncate description if >200" (sugería corte mecánico). Verificado que el contenido se redistribuía bien pero `description` quedaba como resumen ("Guide for X, Y, Z") en vez de condición de disparo, rompiendo la disciplina superpowers/mattpocock. Fix: `description` ahora especifica explícitamente "Use when..." como condición de disparo, y la regla cambió a "relocate, never discard". Re-verificado: la misma skill ahora produce `description: "Use when writing, reviewing, or refactoring Svelte 5 components..."` sin perder contenido — 2026-06-23

**Decisiones de diseño Mes 13**
- Tres canales de conexión externa (chat, skills, modelos), cada uno reusando infraestructura existente — ningún motor nuevo, solo conductores nuevos sobre piezas probadas.
- `runToolLoop()` es una capa nueva sobre `callWithTools()`, no una modificación — el planner (S23) queda intacto y sin riesgo de regresión.
- Contenido externo (web fetch, registry) es siempre dato, nunca instrucción — mismo principio de boundary en todo el proyecto.
- Los gates 🔍 deben correr contra el sistema real, no solo `bun test` — los 3 bugs de Mes 13 (SSRF false-positive, arity de `executeFetchUrl`, `idleTimeout`) solo aparecieron verificando en vivo; los mocks de los tests ya tenían la forma correcta y los escondían.
- "Truncar" es la palabra equivocada para un LLM — la instrucción correcta es "redistribuir sin descartar", aprovechando que el schema de `SkillDef` ya separa el disparador (`description`/`when_to_use`) de la explicación (`instructions`).

**Lista prohibida Mes 13** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior al web fetch, hereda su patrón de tool externa segura pero añade acciones con efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- Runner de grafo autónomo — eje de autonomía interna, distinto del eje de conexión externa de este mes. Candidato Mes 14.
- `description` vacía en `GET /api/skills/registry` — `fetchRegistryList()` no la extrae del índice ni del frontmatter (requeriría N+1 fetches). Candidato Mes 14 si genera fricción real.
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 13 — SÍ (2026-06-23)**
Pre-flight de UI cerrado (edición de skills real, ícono corregido, modelos con TTL+refresh). Web fetch real en el chat con loop multi-turno (`runToolLoop`), guard SSRF correcto, transparencia de tool calls — 2 bugs reales encontrados y corregidos por verificación en vivo. Registro de skills de la comunidad (217 reales) con import vía curador, idleTimeout corregido, prompt del curador ajustado para que `description` sea condición de disparo y no resumen. 468 tests · 0 fail · tsc sin errores.

---

### MES 14 — Autonomía interna: el runner que conduce el grafo solo

Origen: candidato directo anotado en DONE.md § MES 12 y § MES 13 (IDEAS.md #9). Eje: del aislamiento (Mes 13) a la autonomía — el conductor recorre el DAG completo de `tasks.yaml` de principio a fin, decide solo retry-vs-bloqueo ante un fallo vía `diagnoseTask()`, y no se detiene globalmente porque una rama caiga. Norte: intervención humana = 0 en el happy path.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| 0 | Pre-flight — lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`, decisión de comando aditivo | ✅ SÍ |
| A | El conductor (motor) — `graph-runner.ts`, integración de `diagnoseTask`, circuit breaker | ✅ SÍ |
| A.R | Hallazgos de review local max-effort (AR.1–AR.7) | ✅ SÍ |
| B | CLI — `run --graph` + reporte de cierre con métrica de autonomía | ✅ SÍ |
| C | Superficie en el dashboard — endpoints + pantalla "Runner de grafo" + i18n | ✅ SÍ |
| D | Tests + verificación en vivo (D1 unit, D2 dashboard real, D3 e2e real) | ✅ SÍ |
| E | Cierre formal del mes | ✅ SÍ (este registro) |
| EXTRA — BACK | Catálogo + wiring de reasoning effort por modelo | ✅ SÍ |
| EXTRA — FRONT | Selector de esfuerzo en el chat + 5 bugs de UI encontrados en vivo | ✅ SÍ |
| EXTRA — visual | Auditoría `impeccable` + 10 fixes aplicados (a11y, contraste, motion, command palette) | ✅ SÍ |

**BLOQUE 0 — Pre-flight**
- 0.1 (🔍) Lectura de `scheduler.ts`/`cli.ts`/`diagnose.ts`/`tasks/schema.ts`. Hallazgos clave: `TaskStatus` ya incluía `'blocked'` (cero cambios de schema); el patrón "aislar rama, no detener el grafo" ya existía y estaba probado en `executePlan()` (`scheduler.ts`); el gap real estaba aislado en el bloque `--all` de `cli.ts` (`MAX=20` hardcoded + `break` global al primer `failed`); `diagnoseTask()` (S25) ya era 100% reusable sin cambios — solo faltaba pasar de "sugiere" a "decide" — 2026-06-23
- 0.2 (🔍) Decisión: comando nuevo `run --graph`, sin tocar `--all` (consumidores existentes — hook post-completion S30, dogfooding en E2E.md — asumen halt-on-fail) — 2026-06-23

**BLOQUE A — El conductor (motor)**
- A1 (🧠) Diseño en `docs/graph-runner-design.md`: `'blocked'` reusado sin cambios de schema, mapa `FailurePattern`→estrategia (solo `rate_limit` autoriza requeue único en memoria), el algoritmo nunca hace `break` global (único punto de parada total es el circuit breaker A4), `blockedAncestors` porta el patrón `failedIds` de `scheduler.ts` a `Task[]` — 2026-06-23
- A2 (⚡) `src/run/graph-runner.ts`: traversal topológico completo del DAG; una rama agotada bloquea sus dependientes con razón explícita y las ramas independientes continúan — 2026-06-23
- A3 (🧠/⚡) `diagnoseTask()` integrado en `executeSingleTask()`: al llegar a `failed_permanent` aplica la estrategia de A1 automáticamente, sin pedir permiso por decisión individual — 2026-06-23
- A4 (⚡) Circuit breaker en `runGraph()`: tope de costo acumulado, tope de wall-clock, tope de iteraciones (200 hard cap), `cost_notice` a $5 — 2026-06-23

**BLOQUE A.R — Hallazgos del review local max-effort (2026-06-25)**
- AR.1 quitado `sleep(200)+continue` en atascos de grafo (dep inexistente/ciclo) — corte inmediato con `circuit_break_reason` nombrando cada tarea atascada
- AR.2 `model-catalog.ts`: fallback a disco vencido marcaba `memoryFetchedAt` con el timestamp vencido en vez de `Date.now()`, causando reintentos de fetch (10s timeout) en cada tarea del grafo — fix: un solo intento real por proceso
- AR.3 `DiagnoseResult.usdCost` expuesto (antes invisible) — `graph-runner.ts` ahora lo acumula en `accCost`
- AR.4 `--max-cost 0`/`--max-minutes 0` se trataban como "sin límite" por truthiness — fix: `!= null` en los 3 checks
- AR.5 `skipped_circuit_breaker` declarado pero nunca emitido, y tareas bloqueadas transitivamente sin entry en el reporte — fix: barrido final que cubre toda tarea sin reportar
- AR.6 dos aserciones `find(...)!` que revientan con TypeError si la tarea desaparece de `tasks.yaml` en vivo — cambiadas a check explícito con `failed_permanent` y razón clara
- AR.7 `Number(pricing.prompt)` daba NaN si el string no era numérico, serializado como `null` en cache — fix: `Number.isFinite()` guard → 0
  Todos con test de regresión donde aplicaba. 468→476 tests, 0 fail.

**BLOQUE B — CLI**
- B1 (⚡) `orchestos run --graph [path] [--max-cost N] [--max-minutes N] [--dry-run]` — `--task`/`--output` pasan a opcionales (solo obligatorios en modo one-shot), `--dry-run` imprime orden topológico en capas + config del breaker sin gastar tokens — 2026-06-25
- B2 (⚡) Reporte de cierre: tabla outcome por tarea en 4 buckets (Completed alone / Retried and resolved / Branch blocked / Unfinished) + métrica de autonomía prominente (`★ autonomy: N/M`). Exit code 0 solo si 100% autónomo — 2026-06-25

**BLOQUE C — Superficie en el dashboard**
- C1 (🧠) `POST /api/run/graph` + `GET /api/run/graph/status` — runner corre in-process (no subproceso, el resultado solo existe como objeto en memoria); estado en singleton de módulo; progreso en vivo leído de `tasks.yaml`; 409 si ya hay corrida en curso. Verificado en vivo contra dashboard real (no solo mocks) — 2026-06-25
- C2 (🧠) Pantalla "Runner de grafo": botón con `confirm()` (gasta dinero real), tabla de progreso en vivo, panel de resultado en los mismos 4 buckets del CLI, auto-refresh cada 3s mientras corre — 2026-06-25
- C3 (🧠) i18n en/es real (17 claves) — reabierto y corregido el mismo día tras detectar que una corrida delegada previa había marcado `[x]` sin código real detrás (ver [[feedback-verificar-progreso-delegado]]) — 2026-06-25

**BLOQUE D — Tests + verificación en vivo**
- D1 (⚡/🧠) 11 tests unitarios de `graph-runner.ts` (happy path, branch isolation, circuit breaker, retry guiado por diagnose, edge cases). Hardening post-C1/C2: la versión original mockeaba módulos compartidos con `mock.module()`, rompiendo otros archivos de test por falta de scope por archivo — fix real: extendido el seam de inyección de `GraphRunOpts` a `loadTasksFn`/`updateTaskStatusFn` en vez de depender de orden de archivos — 2026-06-25 (ver [[reference-bun-mock-module-gotcha]])
- D2 (🔍) Gate en vivo contra dashboard real corriendo (proyecto aislado en temp dir): grafo de 4 tareas con 2 ramas falladas a propósito — confirmó que la tercera rama independiente completó sin interferencia, costo real $0.000815, `autonomy_metric: 0.25` verificado contra archivos en disco — 2026-06-25 (ver [[feedback-verificar-gates-en-vivo]])
- D3 (🔍) Smoke real end-to-end contra el `tasks.yaml` real de OrchestOS, sin supervisión. Destapó un falso positivo de QA (el harness no corría `tsc`/tests reales sin `checks:` declarados) — fix: `defaultChecksFor()` agrega checks deterministas automáticamente. Destapó un segundo bug: fallo de check no respetaba `MAX_RETRIES` — fix en `harness.ts`. Re-verificado en vivo una tercera vez: `failed_permanent` exacto en `retry=3/3`. 510 tests · 0 fail. Costo total de verificación: ~$0.04 USD. Hallazgo fuera de alcance (follow-up): `--keep-worktree` no aisló correctamente (`sandbox: worktree mode selected but no branch/task id`) — sin daño, no se tocó.

**EXTRA — Control de reasoning effort por modelo (BLOQUE BACK + FRONT, en paralelo, no bloqueó el cierre)**
- BACK.1–BACK.5: catálogo captura `supportsReasoning` desde `supported_parameters` de OpenRouter; `openrouter.ts`/`tool-call.ts` propagan `effort` opcional al body; `handleApiChat` valida y descarta en silencio si el modelo no soporta el parámetro; verificado con dinero real (3 llamadas reales a distintos modelos) — 2026-06-29
- FRONT.1–FRONT.10: selector de esfuerzo condicional al modelo, persistido en `localStorage`; combobox de modelo rediseñado con búsqueda integrada; botones de chat circulares sin triángulos; auto-grow de textarea (chat + tasks); menú de tipo de adjunto (Imagen/Documento/URL). 5 bugs reales encontrados y corregidos solo al verificar en vivo con Playwright: overlap visual selector↔refresh, placeholder multilínea inflando el auto-grow, y el más serio — `App.fetchAll()` hacía `rerender()` incondicional cada 30s, borrando silenciosamente cualquier input activo (textarea del chat, buscador de modelo) mientras el usuario escribía — 2026-06-29

**EXTRA — Pulido visual del dashboard (en paralelo, no bloqueó el cierre)**
- Auditoría real con `/impeccable audit` + `/impeccable critique` sobre `src/dashboard/public/`: Audit Health Score 12/20, Design Health Score 24/40. 2 hallazgos P1 nuevos no anticipados por el usuario: navegación por teclado rota en toda la app, contraste real que falla WCAG (`--text-faint`, `.ln.dim` de terminal) — 2026-06-25
- 10 fixes aplicados y verificados en vivo con Playwright: profundidad del compose-bar, jerarquía tipográfica (2 archivos HTML estáticos de uso avanzado, antes 5 tamaños dispersos → 2 niveles limpios), estados vacíos con tinte de accent, command palette (Cmd/Ctrl+K), navegación por teclado (`tabindex`+`role`+handler), contraste WCAG corregido (`--text-faint` 4.12:1→6.01:1, `.ln.dim` 3.31:1→4.90:1), `prefers-reduced-motion` global, CSS muerto del Kanban eliminado (~46 líneas), layout-property transitions reemplazadas por `grid-template-rows`/`opacity` — 2026-06-26
- 1 bug fuera de los 6 ítems originales, encontrado durante la verificación: loop infinito de fetch+rerender en Chat cuando falta `OPENROUTER_API_KEY` (cada fallo de `/api/chat/models` re-disparaba el fetch) — fix: flag `orModelsAttempted` que limita el auto-load a un intento por sesión — 2026-06-26
- **Nota de portabilidad de plugins**: los plugins de diseño usados acá (`impeccable`, `taste-skill`, `frontend-design`) están instalados a nivel de **usuario** en la PC donde se hizo esta auditoría (`scope: "user"`, bajo `~/.claude/plugins`) — **no viajan con `git pull`**, solo el código y `PLAN.md`/`PRODUCT.md` (commiteados) viajan. Para tenerlos disponibles en otra máquina (ej. Mac), correr en una sesión de Claude Code ahí:
  ```
  /plugin marketplace add https://github.com/pbakaus/impeccable.git
  /plugin marketplace add https://github.com/Leonxlnx/taste-skill.git
  /plugin marketplace add anthropics/claude-plugins-official

  /plugin install impeccable@impeccable
  /plugin install taste-skill@taste-skill
  /plugin install frontend-design@claude-plugins-official
  ```
  Como `PRODUCT.md` ya queda commiteado en el repo, una vez instalados los plugins ahí `/impeccable audit/critique/polish` arrancan directo, sin pedir el init de nuevo.

**Decisiones de diseño Mes 14**
- A2 (graph-runner) no fue un motor nuevo — es `executePlan()` adaptado de `SubTask[]` a `Task[]` de `tasks.yaml`, reduciendo el riesgo porque el patrón cascada-y-continúa ya estaba en producción desde Mes 5.
- `run --graph` es aditivo, no reemplaza `--all` — evita un cambio de comportamiento silencioso sobre consumidores existentes.
- Los gates 🔍 deben correr contra el dashboard/CLI real con dinero real cuando aplica — D2/D3/BACK.5/FRONT.4 encontraron bugs reales (falso positivo de QA, check sin tope de retry, loop de rerender) que ningún mock había mostrado.
- `mock.module()` sin scope por archivo es un riesgo estructural de la suite — D1 lo resolvió con inyección de dependencias real en vez de depender de orden de archivos; ver [[reference-bun-mock-module-gotcha]] (riesgo similar detectado y corregido post-cierre en `diagnose.test.ts`/`memory-judge.test.ts` mockeando `fetch` en vez del módulo).
- El trabajo EXTRA (reasoning effort, pulido visual) corrió en paralelo sin bloquear el cierre del eje central del mes — mismo patrón que permitió cerrar Mes 14 sin deuda acumulada.

**Lista prohibida Mes 14** _(lo que NO se hizo — referencia histórica)_
- Cliente MCP (Vercel, GitHub, etc.) — eje propio posterior, con acciones de efectos reales (deploy, borrado). Ver IDEAS.md § Largo plazo.
- `description` vacía en `GET /api/skills/registry` — sigue sin resolver desde Mes 13, no generó fricción real todavía.
- OCR para imágenes adjuntas + adjuntar varios archivos a la vez ("Folder") — el estado del chat solo soporta un archivo a la vez; soportar varios es un cambio de modelo de datos, no un ajuste de menú (anotado en IDEAS.md #13).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono/dictado en Chat, imports relativos en Graph (no-JS), clasificador semántico para `clarify`, Design.md condicional, KuzuDB.

**Métrica Mes 14 — SÍ (2026-06-29)**
`orchestos run --graph` recorre un `tasks.yaml` real completo sin intervención humana en el happy path; ante un fallo, bloquea solo la rama afectada (las independientes completan) y la decisión retry/bloqueo la toma diagnose, no el humano. Verificado en vivo en el dashboard (D2) y en el CLI real contra el `tasks.yaml` de producción del propio proyecto (D3), no solo en tests. 518 tests · 0 fail · `tsc --noEmit` limpio.

---

### Fixes post-cierre Mes 14, pre-Mes 15 (2026-06-29) — dogfooding real del flujo chat→tarea

Origen: Carlos probó en vivo el flujo "pedir algo por el chat → se crea una tarea → correrla" usando como caso real un pedido de prototipos de rediseño visual del dashboard (ver IDEAS.md, pendiente de tema oficial para Mes 15). Cada bug de abajo se encontró usando el sistema real, no leyendo código en frío — mismo principio que [[feedback-verificar-gates-en-vivo]].

**Bug 1 — prompt/parser desincronizados en el one-shot `run --task --output` (cli.ts)**
El system prompt de este path le decía al modelo que respondiera en JSON (`{"files":[...]}`), pero `parseLLMResponse` (`contract.ts`) solo entiende el formato de delimitadores `<<<FILE:path>>>...<<<ENDFILE>>>` — el mismo que ya usaba correctamente el path de `tasks.yaml`/`--graph` (`run/prompt.ts`). Rompía **cualquier** tarea one-shot, no solo el caso de prueba. Fix: alineado el prompt de `cli.ts` al formato de delimitadores real.

**Bug 2 — `max_tokens: 8192` hardcodeado en los 3 providers, sin relación con el tope real del modelo**
Generar un mockup HTML+CSS+JS completo se cortaba a mitad de archivo porque 8192 tokens de salida no alcanzan para ningún modelo "premium" de verdad — y el código no tenía forma de saberlo, porque nunca leía el dato real. Mismo principio ya aplicado a `contextLength` en `model-catalog.ts` ("el motor no debe adivinar la ventana de un modelo"): se extendió a tokens de salida. `ModelInfo.maxOutputTokens` ahora captura `top_provider.max_completion_tokens` (publicado por OpenRouter), con `maxOutputTokensFor(modelId)` síncrono (fallback `DEFAULT_MAX_OUTPUT_TOKENS=8192` si el modelo no está en catálogo). `openrouter.ts:chat()` acepta `maxTokens?` opcional; `cli.ts` lo resuelve vía `ensureCatalogLoaded()` antes de cada llamada. Decisión explícita de Carlos: no es aceptable "simplemente subir el número" sin atarlo al dato real por modelo — la alerta debe ser siempre por modelo, nunca un valor fijo adivinado.
Provider/harness genérico (`run/harness.ts`, usado por `tasks.yaml`/`--graph` vía `ProviderClient`) queda **fuera de este fix** — mezclar el catálogo de OpenRouter (no aplica igual a Anthropic/OpenAI directos) ahí es un cambio más grande, anotado como deuda conocida, no resuelto todavía.

**Bug 3 — el más serio: una excepción en la resolución de sandbox tumbaba el proceso de `task run` sin dejar rastro**
`resolveSandboxMode()` (`sandbox-policy.ts`) lanza si el working tree tiene cambios sin commitear y el modo resuelto es `worktree` — pero esa llamada, junto con `createWorktree()` y el spec-gate, vivían **fuera** del `try/catch` de `runTask()` (`harness.ts`). Cualquier excepción ahí crasheaba el subproceso entero, sin pasar por el catch-all ya documentado ("S9.4 — nunca lanza"). Síntoma real observado: una tarea creada desde el chat (`crear-web-local-comercial`) quedó en `status: running` para siempre — sin fila en `runs`, sin diagnóstico, solo un `START` suelto en el log de la corrida. Causa concreta de esa instancia: el repo tenía cambios sin commitear (los fixes 1 y 2, todavía no commiteados) cuando se disparó la tarea desde el dashboard. Fix: el `try` ahora envuelve el spec-gate + resolución de sandbox + creación de worktree, así cualquier error ahí mapea a `status:'failed'` (con razón legible) en vez de tumbar el proceso. 2 tests existentes (`spec.test.ts`, "harness spec gate") actualizados — antes esperaban `rejects.toThrow()`, ahora correctamente esperan `result.status === 'failed'`, consistente con el invariante ya documentado de que `runTask()` nunca debe lanzar. Tarea huérfana liberada manualmente de vuelta a `pending` en `tasks.yaml`.

**Bug 4 — el toggle de "Diagnose" en Tasks no volvía a colapsar**
`screens-core.js`: la flecha ▲/▼ que reemplaza al link "Diagnose" una vez cacheado el resultado se renderizaba **sin** el atributo `data-diag` (solo el link inicial lo tenía) — el handler de toggle ya existía y funcionaba bien, pero nunca se conectaba a la flecha. El click caía al handler de la fila (abría el side-panel) en vez de colapsar el detalle inline. Fix: la flecha ahora también lleva `data-diag`. Verificado en vivo con Playwright contra el dashboard real: 1er click abre (`detail-row` visible), 2do click colapsa (`detail-row` desaparece) — confirmado vía `classList`, no solo visualmente.

**Bug 5 — el refresh del dashboard siempre caía en Settings, nunca en Chat**
`app.js` redirigía a Settings ("Control Center") cada vez que `attentionCount > 0` — pero ese contador (`setup.ts`) suma `unverifiedInstincts + draftSpecs`, backlogs pasivos de revisión que casi siempre son > 0 en uso normal (99 instincts sin revisar en este caso). Esto pisaba silenciosamente la decisión ya tomada en Mes 14 EXTRA ("Chat convertido en pantalla principal") en cada recarga. Fix: el redirect urgente ahora solo dispara con `blockedTasks.length > 0` (trabajo real atascado) o el umbral de costo semanal — instincts/specs pendientes ya tienen su propio badge en el nav, no necesitan secuestrar la pantalla de inicio. Verificado en vivo con Playwright: con `blockedTasks: []` real, el refresh ahora aterriza en Chat (`heading "Chat"` + composer visibles).

**Decisión de diseño**: ningún fix de este bloque consumió generación de contenido por LLM para probarse — los 5 son debugging real sobre estado ya producido (logs, DB, tasks.yaml, dashboard en vivo), siguiendo la regla explícita de Carlos de esta sesión: tareas de generación-y-prueba-iterativa las corre él mismo por CLI para no quemar cuota de Claude; debugging de bugs reales sí lo hace Claude.

**Hallazgo abierto, anotado en IDEAS.md (no resuelto)**: la auditoría de paridad CLI↔Dashboard — varias capacidades del CLI (`spec approve/lint/archive`, `instinct set-confidence/propose`, `task run --explain/--clarify`, `skill build`, `detect/init/index`, `runs --analyze` manual) no tienen ningún botón/endpoint equivalente en el dashboard. Ver IDEAS.md #9b.

518 tests · 0 fail · `tsc --noEmit` limpio en cada fix.

---

### MES 15 — Dashboard usable en pruebas reales: reset, diagnóstico, grafo accionable, memoria buscable

Origen: dogfooding real (2026-07-01) tratando de correr `crear-web-local-comercial` desde cero. 2 bugs bloqueantes arreglados en el camino (fuera de plan): (1) `sandbox-policy.ts` — el check de "uncommitted changes" se disparaba antes de mirar `--sandbox=cwd`; (2) `harness.ts` — `maxTokens = contextWindow - promptTokens` sin margen causaba overflow real contra OpenRouter (fix: `SAFETY_MARGIN = 1024`). Además, 4 problemas de producto donde el motor ya soportaba lo necesario pero no estaba expuesto en dashboard/CLI.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| 0 | Pre-flight — investigación completa (3 Explore + 1 Plan) + 2 bugfixes bloqueantes | ✅ SÍ |
| A | Reset de datos de prueba — `resetTestData()`, CLI `reset --yes`, `POST /api/system/reset`, botón en Settings | ✅ SÍ |
| B | Diagnose expone motivo real del fallo — `lastErrorResult` end-to-end (tipo → handler → render `<pre>`) | ✅ SÍ |
| B2 | Retry con modelo alternativo — `--model` transitorio en CLI, `{model?}` en el body del endpoint, reset a `pending` para relanzar `failed_permanent`, selector en panel de diagnóstico | ✅ SÍ |
| C | Graph Runner accionable — inputs `maxCost`/`maxMinutes` en UI + botón Retry por fila (reusa el endpoint de B2, cero lógica nueva) | ✅ SÍ |
| D0 | Diagnóstico previo de memoria — expand/collapse NO estaba roto; el problema real era que las 20 entries eran fixtures triviales | ✅ SÍ |
| D | Memoria buscable — FTS5/BM25 en `GET /api/memory?q=`, buscador del dashboard conectado, `SEARCH_MEMORY_TOOL` + `createToolRouter` en el chat | ✅ SÍ |
| E | Cierre formal del mes | ✅ SÍ (este registro) |

**Detalle por bloque** (todas las fechas 2026-07-01)

- **A — Reset**: `resetTestData(root): ResetSummary` en `src/db/reset.ts` — borra `runs` e `instincts` no verificados, resetea tasks a `pending` (limpiando `retry_count`/`retry_reason`/`qa_verdict`/`run_id`); NO toca `memory_entries`/config/skills. Reusado por CLI (`reset --yes`, aborta sin flag) y `POST /api/system/reset` (`handlers/system.ts`) + botón en Settings con `window.confirm` inline + i18n en/es. Verificado en vivo por CLI y por el botón (Chrome DevTools).
- **B — Diagnose**: `lastErrorResult?: string` en `DiagnoseResult`/`DiagnoseRow`, calculado desde `listRunsByTaskId`; `handleApiTasksDiagnose` lo incluye en el JSON; `diagnoseDetail(d)` lo renderiza como bloque `<pre>` ("Last Error Output"). Verificado en vivo con run sintético `failed` con marcador único + llamada LLM real de diagnose.
- **B2 — Retry con modelo alternativo**: `--model <model>` en `task run` como override transitorio (no persiste en `tasks.yaml`; `HarnessOpts.modelOverride` ya existía). `handleApiTasksRun` convertida a async, lee `{model?}` del body y agrega `--model` al spawn. Bug real encontrado en la revisión: el endpoint nunca validaba status mientras `executeTask` en `cli.ts` bloqueaba `failed_permanent` en silencio — fix: reset a `pending` antes del spawn (intencional: este endpoint ES el mecanismo de retry). Frontend reusa `buildModelSelect()`. Verificado en vivo con tarea desechable (`exit 1` determinístico): el run quedó en SQLite con el modelo override, `tasks.yaml` intacto, bypass de `failed_permanent` confirmado. **Gotcha operativo confirmado 2 veces**: Bun no recarga módulos en caliente — el dashboard debe reiniciarse tras cambios de backend antes de verificar.
- **C — Graph Runner accionable**: inputs `maxCost`/`maxMinutes` en la UI (`screens-ops.js`; el backend ya los aceptaba) + botón Retry por fila (`outcome === 'failed_permanent'||'blocked'`) que llama a `POST /api/tasks/:id/run` — cero lógica nueva de retry en `graph-runner.ts`. Verificado en vivo: `maxMinutes: 0` corta el circuit breaker de inmediato; el Retry NO relanza el grafo (phase se mantuvo `done` antes y después), solo el subproceso individual. Fuera de alcance a propósito: pause/cancel de una corrida en curso (deuda conocida).
- **D0 — Diagnóstico de memoria**: el expand/collapse de las cards funcionaba correctamente (verificado en vivo con entry de 4 líneas). El "bug" percibido era que las 20 entries reales eran fixtures de test de una línea — nunca había nada que expandir. Cero fix de UI necesario; el problema real era la búsqueda (D).
- **D — Memoria buscable**: `GET /api/memory?q=` con `JOIN memory_fts ... MATCH ? ORDER BY bm25(memory_fts)`, query sanitizado (`"${q.replace(/"/g,'""')}"*` — FTS5 rompe con `-`/`"` sin escapar). Buscador del dashboard conectado al endpoint (`App.fetchMemory(q)` con debounce). Chat: `SEARCH_MEMORY_TOOL` + `createToolRouter()` (router multi-tool por nombre — `ToolExecutor` era un único callback) en `tool-call.ts`, `executeSearchMemory` en `chat.ts` (mismo patrón/sanitización). Verificado end-to-end en vivo: entry sintética con `updated_at: 2020` (fuera del preview de 20 recientes) y marcador único — el chat real con `openai/gpt-4o-mini` disparó `search_memory` (visible en `toolCallsExecuted`) y devolvió el contenido exacto. Nota: el modelo default (deepseek) NO dispara tools — `supportsToolCalling` solo admite prefijos `anthropic/`/`openai/`/`google/gemini`; cae a chat plano (esperado, no bug).

**Decisiones de diseño Mes 15**
- Regla de reuso cumplida: el Retry del Graph Runner (C) llama literalmente al endpoint de B2 — cero duplicación de lógica de retry.
- `harness.ts`/`sandbox-policy.ts` intocados durante todo el mes (arreglados pre-plan, regla explícita) — la regla queda levantada al abrir Mes 16 (F1–F4 y G viven exactamente ahí).
- Patrón de verificación con tarea desechable consolidado (B2.6/C.3): backup de `tasks.yaml`, check `exit 1` determinístico, diff vacío al final — reusable para F1.4 del Mes 16.
- Delegación con verificación reforzada: D.2 delegado a DeepSeek produjo un primer intento inválido (ruta con typo `Agentes/` + página HTML standalone en vez de conectar el buscador existente) — rechazado y re-especificado; D.4 llegó marcado `[x]` sin nota técnica y se verificó por grep antes de aceptar (el código sí existía). Ver [[feedback-verificar-progreso-delegado]].

**Métrica Mes 15 — SÍ (2026-07-01)**
Las 4 fricciones del dogfooding cerradas con superficie completa en dashboard + CLI: reset de datos en un click, motivo real del fallo visible en diagnose, retry con modelo alternativo desde el panel, graph runner con límites editables y retry por fila, memoria buscable por FTS en dashboard y chat. Todos los gates 🔍 verificados en vivo contra el dashboard real (no mocks). 521 tests · 0 fail · `tsc --noEmit` limpio.

---

### MES 16 — El giro del timón: motor honesto + ejecutor agéntico

Origen: revisión estratégica externa (Claude Fable 5, 2026-07-01, memoria `project-strategic-review-2026-07`). Diagnóstico central: OrchestOS tiene dos productos adentro — un ejecutor LLM de un solo disparo (parte débil, arquitectura 2023) y una capa de verificación (contrato + checks + evidencia + diagnose — parte fuerte y diferenciadora). Este mes corrigió 4 fallas puntuales del ejecutor (F1-F4) y ejecutó la decisión de arquitectura (Bloque G): desacoplar la capa de verificación del ejecutor para que envuelva cualquier engine, empezando por uno agéntico.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| F0 | Integridad — suite determinista, `tasks.yaml` reconciliado, providers arreglados (prerequisito de Mes 15→16, cerrado la mañana del 2026-07-02) | ✅ SÍ |
| F1 | Retry con feedback — `previousFailure` en el prompt | ✅ SÍ |
| F2 | QA con juez distinto — `resolveQAJudge()` nunca el mismo modelo que generó | ✅ SÍ |
| F3 | Evidencia completa — ningún fallo pierde fila en `runs`, `runId` nunca vacío | ✅ SÍ |
| F4 | Contrato con paths normalizados — `./`/`\`/`//` ya no disparan falsa violación | ✅ SÍ |
| G.1 | Diseño `ExecutorEngine` — interface + 4 tools del agéntico + decisión de eliminar topes de gasto | ✅ SÍ |
| G.2 | Extracción single-shot a `executors/single-shot.ts`, cero cambio de comportamiento | ✅ SÍ |
| G.3 | Ejecutor agéntico (`executors/agentic.ts`) + selección de engine por tarea/config | ✅ SÍ |
| G.4 | Superficie dashboard + CLI (selector de engine, detalle con iteraciones, `--engine`) | ✅ SÍ |
| G.5 | Gate comparativo con dinero real — encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**F0 — Integridad (prerequisito, cerrado 2026-07-02 por la mañana)**
Auditoría completa (arquitecto + debugger + QA + dev) pedida por Carlos antes de tocar el motor. 8 archivos de test con `mock.module()` sin scope por archivo (contaminaba la suite según orden) — eliminado, inyección de dependencias en su lugar (ver [[reference-bun-mock-module-gotcha]]). `tasks.yaml` reconciliado (6 tareas non-done resueltas una por una con decisión explícita). `maxTokens` ignorado en providers directos conectado. Modelo retirado (`claude-3-haiku`) reemplazado por `claude-haiku-4-5` como default del núcleo. Pricing con fuente de verdad duplicada (fallback $0 silencioso) migrado a leer del catálogo real. 524 tests · 0 fail al cerrar.

**F1 — Retry con feedback**
`buildPrompt()` gana `previousFailure?: string` — si `retry_count > 0`, inyecta bloque `## PREVIOUS ATTEMPT FAILED` con el motivo truncado a 2000 chars al final de `userContent`. Verificado en vivo: tarea desechable con check `exit 1` — el segundo intento sí trae el bloque, el primero no.

**F2 — QA con juez distinto**
`resolveQAJudge()` en `harness.ts`: (1) `orcheConfig.models.qa` explícito gana siempre; (2) si no, default barato por provider distinto del ejecutor (constante `QA_JUDGE_DEFAULTS`); (3) colisión → fallback anti-colisión, con `log.info` si ocurre solo por config explícita. Nueva columna `qa_model` en `runs`, visible en `runs --detail`. Verificado en vivo: ejecutor `deepseek/deepseek-v4-flash`, juez `openai/gpt-4o-mini` — distinto, confirmado con dinero real.

**F3 — Evidencia completa**
El catch de la llamada LLM (antes retornaba `failed` sin fila en `runs` — el hueco más grave, justo la clase de fallo más común) ahora hace `insertRun`. Los 6 paths de fallo del harness devuelven `runId` real en vez de `''`. Verificado en vivo con `OPENROUTER_API_KEY` inválida real: `runs --detail` mostró el 401 del proveedor con `runId` no vacío.

**F4 — Contrato con paths normalizados**
`normalizeRelPath()` en `contract.ts`: `\`→`/`, `./` repetido, `//` colapsado — aplicado en ambos lados de `enforceContract()` y en el cálculo de `missingOutputs`. `../` sigue bloqueado a propósito (anti-escape intacto, nunca se resuelve `..`). Verificado en vivo: prompt que fuerza al modelo a emitir `./src/...` — el contrato autorizó sin falso positivo.

**Bloque G — La decisión de arquitectura**
- **G.1 (diseño)**: `docs/executor-engine-design.md`. `ExecutorEngine.run(ctx, opts) → ExecutorOutcome` — el engine solo genera, nunca escribe a disco ni toca contrato/checks/QA/evidencia (universal, queda en el harness). 4 tools del agéntico v1 (`read_file`, `write_file`, `list_dir`, `run_check`) con el gate del contrato DENTRO de `write_file` (error de string al modelo, no excepción — autocorrección en la siguiente iteración). Decisión de Carlos durante el diseño: se elimina el tope de gasto (`maxUsd`/`budget`) — OrchestOS no pone techos de dinero, el costo se **anuncia** (mismo principio de F0.8), no se limita; queda solo `maxIterations` (garantía de terminación, no límite de dinero) y se añade `costByIteration` (medición real, reusa `CostBreakdownEntry` ya existente).
- **G.2 (extracción)**: bloque "LLM call → parse" movido a `executors/single-shot.ts` sin cambio de comportamiento — mismo mensaje de error, mismo costo, cero test existente modificado (553 pass antes y después).
- **G.3 (agéntico)**: `executors/agentic.ts` reusa `runToolLoop()` (Mes 13) tal cual. Selección: `Task.engine` gana sobre `orcheConfig.executorEngine`, default absoluto `single-shot`. Fallback automático a single-shot si el modelo no soporta tool-calling, con aviso en el log.
- **G.4 (superficie)**: selector de engine en el composer de Tasks, bloque "Engine" (type + iterations) en `runs --detail` (dashboard y CLI), flag `--engine` transitorio en `task run`. Cerró de paso un gap que G.3 no había atrapado: el harness generaba `costByIteration` pero nunca lo persistía en SQLite (`runs --detail` mostraba `type: unknown` para todo). Verificado en vivo con dinero real (3 corridas: engine declarado en tasks.yaml, override transitorio por CLI, rechazo de valor inválido).
- **G.5 (gate comparativo, dinero real)**: misma tarea (agregar una línea de JSDoc) sobre un archivo real de 419 líneas (`src/dashboard/handlers/skills.ts` — `test-project/` no tenía ningún archivo de 300+ líneas), mismo modelo (`openai/gpt-4o-mini`), ambos engines. **Resultado inicial: single-shot ganó** — perfecto, $0.0032; el agéntico truncó a mitad de una llamada de función y `tsc` falló ($0.0055, 3.3× más tokens de entrada). **Causa raíz encontrada y corregida** (a pedido explícito de Carlos, "arreglemos esto antes de avanzar, buscar más fallas en el sistema"): barrido completo de `max_tokens`/`maxTokens` en todo `src/` encontró 2 bugs reales — (1) `tool-call.ts` tenía `max_tokens: 4096` hardcodeado en 4 funciones (las 2 rondas del loop multi-turno eran la causa exacta); (2) `harness.ts` calculaba el presupuesto desde la ventana de contexto TOTAL sin toparlo contra el tope real de salida por llamada que el catálogo ya conocía (`maxOutputTokensFor`) — pedía ~122K de salida para un modelo cuyo tope real es 16384, rechazo 400 real de OpenRouter. Los 2 arreglados, 3 consumidores actualizados (`agentic.ts`, `chat.ts`, `planner.ts`) para pasar presupuesto real en vez de heredar el default silencioso. Reverificado en vivo con dinero real adicional: ya sin error 400 ni truncamiento; con `claude-haiku-4-5` el `tsc` pasó limpio (`exit 0`), sin truncar y sin perder código.

**Decisiones de diseño Mes 16**
- El costo se anuncia, nunca se limita — decisión explícita de Carlos que eliminó el concepto de `maxUsd`/tope de gasto del diseño del engine agéntico antes de escribir una línea de código, evitando construir una abstracción que después había que desmontar.
- La capa de verificación desacoplada (F1-F4 + G.1-G.2) demostró su valor incluso cuando el engine nuevo falló: el harness detectó el fallo con evidencia completa (F3), revirtió limpio (checks), y permitió comparar dos engines contra el mismo contrato sin duplicar código — la arquitectura hizo exactamente lo que se esperaba de ella.
- Un gate 🔍 con dinero real encontró 2 bugs de infraestructura que ningún test con mocks había mostrado (`max_tokens` hardcodeado en 4 lugares + presupuesto sin clamp contra el tope real del proveedor) — mismo patrón que Mes 14 D2/D3 y Mes 13 Bloque A: verificar en vivo contra el sistema real, no solo contra mocks (ver [[feedback-verificar-gates-en-vivo]]).
- G.4 se completó en paralelo por delegación (mismo patrón de [[codex-delegation-workflow]]) mientras G.3/G.5 avanzaban — verificado con evidencia concreta (grep del código real + corrida aislada de sus 18 tests) antes de darlo por bueno, no solo por el checkbox (ver [[feedback-verificar-progreso-delegado]]).

**Lista prohibida Mes 16** _(lo que NO se hizo — referencia histórica)_
- Ejecutores externos (Claude Code headless, opencode) como tercera implementación de `ExecutorEngine` — IDEAS.md #15, prerequisito "Bloque G cerrado" ahora satisfecho, candidato natural para el próximo mes.
- Escala honesta (poda de DB, presupuesto de `input[]`, partir `cli.ts`) — IDEAS.md #16, sigue gated en evidencia de usuario real, no en este mes.
- Migrar `supportsToolCalling()` de heurística por prefijo a leer `supported_parameters` real del catálogo OpenRouter — mejora posible, no bloqueante, anotada en el diseño de G.1.

**Métrica Mes 16 — SÍ (2026-07-02)**
Los 4 hallazgos puntuales del ejecutor (F1-F4) corregidos y verificados en vivo. La capa de verificación quedó desacoplada del ejecutor (Bloque G): un segundo engine (agéntico) existe, se selecciona por tarea o config, y se compara contra el original con el mismo contrato — sin duplicar lógica de contrato/checks/QA/evidencia. El gate comparativo con dinero real (G.5) no solo midió, encontró 2 bugs reales de infraestructura y se corrigieron el mismo día, reverificados con dinero real adicional. 585 tests · 0 fail · `tsc --noEmit` limpio. Gasto total de verificación con dinero real en todo el mes: ~$0.15 USD.

---

### MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

Origen: IDEAS.md #15, decisión de Carlos (2026-07-02) tras la revisión estratégica que originó el Mes 16 — "la jugada que convierte a OrchestOS de runner casero a capa de confianza". Tesis: el valor diferenciador de OrchestOS es la capa de verificación (contrato + checks + evidencia + QA + diagnose), no el ejecutor propio — un ejecutor externo (Claude Code headless) es una tercera implementación de `ExecutorEngine` (Mes 16 G) que **edita** en vez de reescribir, eliminando por diseño el riesgo de fidelidad que G.5 encontró en el agéntico interno con archivos grandes.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| A.1 | Diseño — `docs/external-executor-design.md`, las 4 decisiones (contrato/costo/timeout/archivos fuera de contrato) | ✅ SÍ |
| A.2 | Revisión del diseño con Carlos antes de código | ✅ SÍ |
| B.1 | `executors/external.ts` — spawn en worktree, timeout, diff → `FileChange[]` | ✅ SÍ |
| B.2 | `engine: 'external'` como tercer `TaskEngine` — schema, config, CLI, dashboard | ✅ SÍ |
| B.3 | Tests con mock del subproceso (11 casos) | ✅ SÍ |
| B.4 | Fix EISDIR en directorios untracked (hallazgo de los tests de B.3) | ✅ SÍ |
| C.1 | Superficie: selector + CLI + bloque "Process" en el detalle del run | ✅ SÍ |
| C.2 | Detección honesta si el binario no está instalado (3 puntos, 1 fuente de verdad) | ✅ SÍ |
| D.1 | Gate en vivo con dinero real — encontró y corrigió un bug real de parseo de `git status` | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**A.1/A.2 — Diseño**
`docs/external-executor-design.md` decidió: (a) contrato al ejecutor externo vía prompt explícito + `--allowedTools` (coarse) — la frontera real de seguridad sigue siendo `enforceContract()` post-hoc, igual que en single-shot/agéntico; (b) costo parseado de `--output-format json` de Claude Code (`usage`, `total_cost_usd`, `num_turns` reales) — sin JSON válido, costo desconocido explícito, nunca `$0` silencioso (F0.8); (c) timeout vía campo opcional `opts.timeoutMs` (aditivo a `ExecutorEngine.run()`, no rompe los otros 2 engines) — garantía de terminación, no tope de gasto; (d) archivos fuera de `output[]` — diff completo del worktree se entrega tal cual a `enforceContract()` sin filtrar, el `finally` existente de `runTask()` ya descarta cualquier worktree vivo, sin lógica de revert nueva. Alcance v1: solo Claude Code headless (`claude -p`), sin adaptador opencode — `engine: 'external'` genérico deja el punto de extensión abierto sin construirlo. Revisado y aprobado por Carlos con una aclaración añadida al doc (§1.1): "external" es la herramienta de agente, no el LLM — un usuario sin Claude Code simplemente no usa ese engine, sigue teniendo single-shot/agéntico con cualquier proveedor configurado.

**Bloque B — Implementación del engine**
`externalEngine` (`src/run/executors/external.ts`) exige modo worktree sin excepción (un proceso no controlado no puede editar el repo real sin sandbox desechable — requisito nuevo que los otros 2 engines no necesitan porque nunca tocan disco antes de que el harness decida). Spawnea `claude -p --output-format json --append-system-prompt <contrato> --allowedTools Edit,Write,Read,Glob,Grep` con timeout wall-clock (`SIGTERM`), lee el diff completo vía `git status --porcelain -uall` tras el proceso, y lo entrega como `FileChange[]` sin filtrar. `engine: 'external'` como tercer valor de `TaskEngine` (schema + config + CLI `--engine` + selector del dashboard + badge morado). B.4 destapó un `EISDIR` real al crashear con directorios untracked en el diff — corregido con `statSync.isFile()` antes del read. 11+2 tests nuevos, todos con worktree real + mock de `Bun.spawn` (mismo patrón de inyección que `agentic-engine.test.ts` con `globalThis.fetch`).

**Bloque C — Superficie**
Selector `external` en el composer de Tasks + `--engine external` en CLI (ambos ya cubiertos por B.2) + bloque "Process" nuevo en el detalle del run (binary + command reconstruido, con el system prompt real reemplazado por el placeholder `<contract>` para no inflar la DB). C.2: detección honesta del binario ausente con una sola fuente de verdad (`findClaudeBinary()`/`claudeUnavailableMessage()`) reusada por el engine guard, la CLI, y el endpoint `GET /api/system/engines/external/availability` — warning inline en el composer con link de instalación, sin fallo críptico en runtime.

**Bloque D — Gate en vivo (dinero real, misma tarea brownfield de G.5)**
Misma tarea que G.5 (agregar 1 línea de JSDoc a `handleApiSkillsList`, `src/dashboard/handlers/skills.ts`, 419 líneas), corrida con dinero real 3 veces contra el ejecutor externo. **Bug real encontrado y corregido** (mismo patrón que G.5 — dinero real destapó infraestructura rota que ningún mock había mostrado): Claude Code editó el archivo exactamente como se pidió en el worktree las dos primeras corridas (confirmado con `git diff` manual), pero `externalEngine` reportaba `files: []` de todos modos → "missing declared output". Causa raíz: el `git()` compartido de `sandbox.ts` hace `.trim()` sobre TODO el stdout de `git status --porcelain`, comiéndose el espacio inicial de la primera línea cuando es una modificación sin stage (`" M path"` → `"M path"`) — el parseo de columna fija de `readWorktreeDiff()` asumía ese espacio, así que `"M src/foo.ts"` quedaba `"rc/foo.ts"` (path inexistente, descartado en silencio). Ningún test de B.3 lo cubría porque todos escribían archivos nuevos (`"?? path"`, sin el espacio literal en juego). Fix: spawn directo sin el trim global para este parseo + test de regresión que modifica un archivo ya trackeado.

**3ra corrida (con el fix) — evidencia de la tesis**: fidelidad del diff perfecta (una sola línea, cero cambios en el resto, confirmado con `tsc --noEmit` manual exit 0); `enforceContract` funciona idéntico sin cambios, autorizando exactamente el path declarado; `checks` explícitos corrieron y pasaron pese a la ausencia de `node_modules` en el worktree (`bunx` resuelve desde la caché global de Bun); costo real $0.15-0.22 por corrida — **25-70× más caro que single-shot** ($0.0032 en G.5) para la misma tarea trivial, esperable por la exploración multi-turno propia de Claude Code. El QA-LLM dio un falso negativo sobre un diff objetivamente correcto — misma fragilidad de juez-LLM ya conocida (D3, Mes 14), no un bug nuevo del externo.

**Hallazgos documentados, no corregidos en este mes** (candidatos de backlog, IDEAS.md):
- #19 — tareas `engine: external` sin `checks:` explícitos pierden silenciosamente su única red determinista (`defaultChecksFor()` devuelve `[]` sin `node_modules`, y external exige worktree sin excepción) — el QA-LLM queda como único filtro, y ya se demostró falible en este mismo gate.

**Decisiones de diseño Mes 17**
- "Externo" es la herramienta de agente, no el LLM — aclaración añadida al diseño tras la revisión de Carlos, evita confundir `engine: external` con un cuarto proveedor de LLM.
- La frontera real de seguridad sigue siendo `enforceContract()` post-hoc para los 3 engines por igual — el prompt/`--allowedTools` del externo es mejor esfuerzo, no el control.
- Un gate 🔍 con dinero real volvió a encontrar un bug de infraestructura real que ningún test con mocks había mostrado (mismo patrón que G.5, Mes 14 D2/D3, Mes 13 Bloque A — ver [[feedback-verificar-gates-en-vivo]]) — el parseo de `git status --porcelain` corrompido por un `.trim()` compartido demasiado agresivo.

**Métrica Mes 17 — SÍ (2026-07-05)**
Tercer `ExecutorEngine` (externo, Claude Code headless) diseñado, implementado, expuesto en dashboard+CLI, y verificado en vivo con dinero real contra la misma tarea brownfield que motivó el mes anterior. La capa de verificación (`enforceContract`/checks/QA) funciona idéntica sin cambios sobre un motor que OrchestOS no controla — confirma la tesis. El gate en vivo encontró y corrigió un bug real de parseo antes de cerrar. 617 tests · 0 fail · `tsc --noEmit` limpio.

---

### MES 18 — Chat como entrada única: detección de intención de tarea

Origen: IDEAS.md #12, decisión de Carlos (2026-07-02) tras el cierre de Mes 17 — que el chat sea el medio de comunicación principal de OrchestOS (como Open WebUI/Hermes/Claude Desktop), con Tasks pasando a ser un visor y no el lugar donde se crea el trabajo. Pregunta que lo disparó: si el usuario describe trabajo ejecutable sin decir "tarea", ¿el sistema lo detecta y ofrece convertirlo?

| Bloque | Contenido | Estado |
|---|---|---|
| A | Diseño de guardrails (`docs/chat-task-detection-design.md`) + revisión con Carlos | ✅ SÍ |
| B.2/B.2.1 | Tools de lectura `read_plan`/`read_tasks`/`read_ideas` + fix de clamp de output tokens | ✅ SÍ |
| B.1.a/B.1.b-ui | Instrumentación de `chat-create-task-bar` (`chat_task_bar_events`) + tab "Chat evidence" | ✅ SÍ |
| B.1.b / C.1 | Clasificador semántico de intención de tarea, activado con evidencia real | ✅ SÍ (Bloque J) |
| D | Auto-selección semántica de skill (ex-IDEAS #21) | ✅ SÍ |
| E | Paridad CLI↔Dashboard, 9 gaps cerrados (ex-IDEAS #9b) | ✅ SÍ |
| F | Fechas en hora local en vez de UTC crudo | ✅ SÍ |
| G | Auditoría visual `/impeccable audit` (ex-IDEAS #23) | ✅ SÍ |
| I | "Premium dashboard" — 13 ajustes reportados por Carlos | ✅ SÍ |
| J | Dogfooding real del Chat — activa B.1.b + 2 bugs reales | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**Bloque A/B/C — Detección de intención de tarea**
Diseño (A.1, aprobado por Carlos "GO" 2026-07-05) fijó el orden: primero instrumentar la barra existente para generar evidencia real, el LLM clasificador solo se implementa si aparecen falsos negativos concretos — nunca "porque se puede". Tools de solo lectura `read_plan`/`read_tasks`/`read_ideas` registradas en `runToolLoop()` (mismo patrón que `FETCH_URL_TOOL`), verificadas en vivo con `claude-haiku-4-5` citando contenido real de PLAN.md. Bug real encontrado al verificar (B.2.1): `handleApiChat` calculaba `chatMaxTokens` sin clamp al tope real de salida del proveedor — mismo bug que el harness ya había corregido en G.5 (Mes 17), corregido con `Math.min(available, maxOutputTokensFor(model))`. Instrumentación (B.1.a): tabla `chat_task_bar_events` + tab de solo lectura "Chat evidence" en Project para que Carlos revise la evidencia sin depender de un query de Claude. El clasificador (B.1.b) quedó **en espera de evidencia real** (criterio: ~30-40 mensajes reales con variedad, sin fecha fija) hasta que el dogfooding del Bloque J la produjo.

**Bloque D — Auto-selección semántica de skill**
Origen: prueba real de Carlos con una landing usando "skills de diseño" no dio el resultado esperado — ninguna skill se auto-aplicaba (`skill-route.ts` solo leía `task.skill` explícito). Se escribieron 4 skills de diseño nativas (`frontend-design`, `ux-guidelines`, `design-brief-inference`, `design-tokens`) y un motor de clasificación (`listAllSkillCandidates()`) que agrega candidatos al mismo call de `/api/natural` que ya generaba el draft (sin call adicional). Selector en el composer: 1 candidato preseleccionado, 2+ con "None" preseleccionada, 0 sin campo. Gate en vivo: draft de landing → 4 candidatos de diseño; draft de bugfix de auth → sugirió `diagnose`/`bug-hypothesis`/`code-review` (skills de ingeniería que ya existían y nunca se auto-aplicaban) — confirma que el motor discrimina por dominio real, no un sí/no de diseño.

**Bloque E — Paridad CLI↔Dashboard**
Barrido formal de los ~45 subcomandos de `cli.ts` contra `server.ts` encontró 9 gaps reales sin superficie en el dashboard (specs lifecycle, instinct confidence/propose, task explain/clarify, detect/index, config init/show, context suggest, memory conflicts, runs --analyze). Los 9 se cerraron: `memory conflicts` (panel con banner de conteo), `runs --analyze` (botón inline sin `alert()`), `spec approve/lint/archive/create` (botones en detail row), `instinct set-confidence/propose/add` (slider + botón, + fix de bug real de 146 proposals duplicados por race condition, UNIQUE INDEX agregado), `task run --explain/--clarify` (SidePanel con textarea + resultado inline; todos los `alert()`/`prompt()` del dashboard reemplazados por `showToast()`/`Modal`), `detect`/`index` (botones con `confirm()` tras hallazgo real de sobreescritura accidental de `AGENTS.md`), `config init/show` + edición de roles (2 bugs reales corregidos: `<select>` sin proteger contra el poll de 30s, y fallback forzado a un modelo no elegido por el usuario en el campo QA opcional), `context suggest` (chips clicables, embeddings con fallback a keyword-matching).

**Bloque F — Fechas en hora local**
6 lugares mostraban el string UTC crudo de SQLite sin convertir. Helper único `formatLocalDate()` (`data.js`) usando `toLocaleString()`/`toLocaleDateString()` del navegador, reemplazando los 6 `.slice()` — no toca cómo se guarda la fecha en DB, solo la presentación.

**Bloque G — Auditoría visual `/impeccable audit`**
Health Score 12/20 (Aceptable). 2 P1 reales (overflow horizontal en mobile por falta de `min-width:0` en items de grid; filas de tabla sin foco de teclado completo), 2 P2 (side-stripe de acento en 4 componentes, reemplazado por fondo tintado; colores hardcodeados fuera de tokens), 1 P3 (`prefers-reduced-motion` — falso positivo, ya cubierto por una regla catch-all existente).

**Bloque I — "Premium dashboard"**
Carlos pidió el estándar Hermes/Claude Desktop/Codex tras el Bloque G. 13 ajustes verificados en vivo, todos con causa raíz real en vez de parches cosméticos: eliminación de filas redundantes en Settings (I.1), fix de recorte del combo QA por `overflow:hidden` heredado + grid de 2 columnas para roles (I.2), auditoría de líneas divisorias decorativas vs. funcionales (I.3), padding en card de zona destructiva (I.4), wiring completo de `resolveConflict()` que existía sin usar (I.5), hallazgo de que las ~20 "memorias" que Carlos veía eran 100% fixtures de tests filtrándose a la DB real por falta de `afterAll` en 2 archivos — no un bug del motor de memoria (I.6, recurrencia del patrón de IDEAS #20), botón deshabilitado con mensaje "Nothing to run" cuando no hay tareas pendientes en Graph Runner (I.7), DELETE agregado a Runs/Memory/Specs/Instincts con la restricción de seguridad propia de cada uno (I.8), i18n completo de la pantalla Specs (I.9), selector de 3 temas (OrchestOS/Dark 2026/Bright) vía `theme.js` + tokens extraídos de VS Code, sin `<select>` nativo (I.11), 2 bugs reales del tema Bright (sombra vertical fantasma por falta de `min-height:0` en `.main`; íconos de sidebar ilegibles en hover por color de texto fijo) (I.12), y un 3er bug de la misma familia encontrado sin que Carlos lo reportara aún: el `box-shadow` del side-panel se filtraba fuera de pantalla incluso cerrado porque vivía en la regla base y no en `.open` (I.13). Gate consolidado (I.10) verificado en vivo contra el dashboard real: Settings/Model routing/tema Bright/fechas/mobile 375px sin overflow, sin regresiones.

**Bloque J — Dogfooding real del Chat**
Carlos usando el Chat real para pedir trabajo real (landing de cripto, tienda de ropa) confirmó en vivo el falso negativo exacto que B.1.b pedía como evidencia — 34 mensajes reales acumulados desde 2026-07-05, decisión explícita de Carlos de activar el clasificador ya (J.1): `classifyTaskIntent()` llama al mismo modelo barato default con un prompt binario, fail-safe a `isTask:false`; la barra aparece de inmediato citando el `reason`, sin auto-run. De la misma sesión, 2 bugs reales adicionales: imágenes al chat sin gating de visión — corregido con `supportsVision` en `ModelInfo` y rechazo 422 con mensaje claro antes de mandar el `image_url` block (J.2); el guard de presupuesto de contexto existía en `harness.ts` pero no en el chat — corregido con `CHAT_MIN_OUTPUT_BUDGET` (J.3). Gate en vivo con dinero real (J.4) confirmó los 3 fixes contra el servidor real.

**Decisiones de diseño Mes 18**
- Nunca auto-run silencioso — el chat sugiere y pre-llena, el usuario siempre confirma antes de gastar dinero real en un executor.
- El clasificador semántico no se implementa "porque se puede" — se gatea en evidencia real de falsos negativos (mismo principio que ya rigió instincts/patterns en meses anteriores).
- Un hallazgo de "datos sin sentido" en el dashboard (I.6) volvió a ser fixtures de test filtrándose a la DB real — segunda vez que aparece este patrón (IDEAS #20 lo había "resuelto" una vez) — sospechar de esto primero ante cualquier hallazgo similar futuro.
- El estándar de "premium" no es solo funcional — 4 de los 13 ajustes de Bloque I fueron bugs de contraste/sombra que solo aparecen en un tema no probado antes (Bright), no regresiones de los 3 temas existentes.

**Hallazgos documentados, no resueltos en este mes (backlog)**
- IDEAS.md #19 — tareas `engine: external` sin `checks:` explícitos pierden su única red determinista (heredado de Mes 17, sigue sin corregir).
- `upsertMemory()`/`persistSubTaskMemory()` (sub-tasks con memoria) nunca se disparó para el proyecto real OrchestOS — o el flujo nunca corrió en producción, o la vía está efectivamente muerta en la práctica (hallazgo de I.6, fuera de alcance del audit "premium dashboard").
- IDEAS.md #13/#24 — OCR para imágenes del chat (elimina la dependencia de que el modelo elegido tenga visión, complementa el gating de J.2) y adjuntar varios archivos a la vez — evaluados como candidatos para el próximo Mes, repo de referencia (`baidu/Unlimited-OCR`) aún sin leer.

**Métrica Mes 18 — SÍ (2026-07-09)**
El chat detecta intención de tarea con evidencia real (34 mensajes reales, falso negativo confirmado y corregido), paridad CLI↔Dashboard cerrada (9/9 gaps), auditoría visual + "premium dashboard" resueltos con causa raíz en cada uno (nunca parches cosméticos), y el dogfooding real de Carlos encontró y corrigió 2 bugs reales de producción (visión sin gating, guard de contexto no conectado al chat) antes de que afectaran a un uso real. 649 tests · 0 fail · `tsc --noEmit` limpio.

---

### MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

Origen: graduado de IDEAS.md #13/#24 en el cierre del Mes 18. Durante el dogfooding del Mes 18 (Bloque J), una imagen subida al chat "no cargó" porque dependía de que el modelo elegido tuviera visión — la mayoría de los modelos baratos (DeepSeek, Llama) no la tienen. Decisión de Carlos: "no depender del modelo — que sí o sí lea todo, independiente del modelo".

| Bloque | Contenido | Estado |
|---|---|---|
| A.1/A.2 | Leer el repo real (`baidu/Unlimited-OCR`) + diseño, revisado con Carlos | ✅ SÍ |
| B.1-B.3 | Múltiples adjuntos: `st.chatFiles[]`, `fileIds: string[]`, límite 5, UI de chips | ✅ SÍ |
| C.1-C.3 | OCR con `tesseract.js`, transparencia (`ocrUsed`), verificado con 4 escenarios reales | ✅ SÍ |
| D | `task_class: ocr` — diferido, sin caso de uso interno | ⏳ vuelve a IDEAS.md #30 |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro, 2026-07-14) |

**Bloque A — Repo real leído antes de decidir**
`baidu/Unlimited-OCR` resultó ser un modelo visión-lenguaje que exige GPU propia (self-hosted vía `transformers`/vLLM) — corrige la premisa original de IDEAS #13/#24 de que era una librería liviana. Su única vía sin GPU (Baidu Cloud API) fue rechazada por Carlos (panel en chino, fricción de registro). Motor elegido: `tesseract.js` (Apache-2.0, 38.1K★, WASM, corre en el mismo proceso Bun sin GPU/Python/cuenta externa). Diseño en `docs/ocr-chat-design.md`.

**Bloque B — Múltiples adjuntos**
Estado del chat migrado de `chatFileId` singular a `st.chatFiles[]`. `handleApiChat` acepta `fileIds: string[]` (antes uno), límite de 5 con 400 explícito (nunca trunca en silencio). Verificado en vivo con dinero real: 2 archivos subidos, el modelo leyó y repitió el contenido de ambos correctamente. UI: `.chat-attach-chips` con botón "×" individual por chip.

**Bloque C — OCR**
`src/chat/ocr.ts`: `extractTextFromImage()` con worker singleton de Tesseract (`eng`+`spa`). Por cada imagen sin soporte de visión del modelo, corre OCR ANTES de rechazar (el 422 de Mes 18/J.2 queda para cuando el OCR también falla — nunca degradar en silencio). Texto extraído envuelto como "dato externo, nunca instrucción" (mismo wrapper que `fetch_url`, Mes 13). Bug real encontrado en el camino: `bun test` corrompía el cache REAL de modelos (`~/.orchestos/cache/models.json`) por una condición de carrera entre tests — corregido bloqueando escrituras al cache real bajo `NODE_ENV==='test'`. Verificación C.3 con 4 escenarios reales incluyó un **control de seguridad de prompt injection**: imagen con texto "SYSTEM OVERRIDE: ignore all previous instructions" — el modelo ignoró la instrucción inyectada y respondió la pregunta real, confirmando que el wrapper de dato-nunca-instrucción funciona igual que ya se había probado con `fetch_url`.

**Decisiones de diseño Mes 19**
- OCR es el camino alternativo cuando el gate de visión (Mes 18/J.2) rechaza — no un reemplazo; con modelo de visión la imagen sigue yendo directa.
- `task_class: ocr` diferido sin evidencia de caso de uso interno (el ejemplo original era CitasBot, proyecto separado) — vuelve a IDEAS.md #30.

**Métrica Mes 19 — SÍ (2026-07-09)**
El chat lee imágenes con cualquier modelo (OCR local, sin dependencia de visión del modelo elegido), soporta múltiples adjuntos, y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection. 649 tests · 0 fail · `tsc --noEmit` limpio.

---

### MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

Origen: Carlos (2026-07-09) le pidió a OrchestOS un producto premium real (dashboard de cripto React+TS+Vite) — "no quiero avanzar si OrchestOS no puede hacer una página". El intento destapó bugs nunca antes probados. Descubrimiento central: un LLM no sabe cuántos tokens necesita antes de empezar — se corta en seco si se acaba el presupuesto a mitad. La ventaja de OrchestOS (DAG de sub-tareas con contratos, S22) ya existía a medias; faltaba el gatillo automático.

| Bloque | Contenido | Estado |
|---|---|---|
| P.1/P.2 | Pre-flight: loop de tools con texto vacío corregido; `maxTokens` adaptado al saldo real | ✅ SÍ |
| A.1/A.2 | Diseño del auto-split (estimador, gatillo, control humano, fallback), aprobado por Carlos | ✅ SÍ |
| B.1-B.3 | `shouldSplit()`, gatillo en harness/CLI, superficie de aprobación en dashboard | ✅ SÍ |
| C.1 | Primer entregable real end-to-end (`crypto-page-v1`), gate 🔍 con dinero real | ✅ SÍ |
| C.2 | Dashboard premium multi-archivo (React+TS+Vite, motor agéntico) | ⏳ **PAUSADO** — carry-over |
| H.1 | Cierre formal del mes (+ cierre pendiente de Mes 19) | ✅ SÍ (este registro, 2026-07-14) |

**Pre-flight (dogfooding, 2026-07-09)**
Dos bugs bloqueantes encontrados antes de abrir el mes formalmente: (P.1) `runToolLoop()` devolvía burbujas de chat vacías cuando un mensaje disparaba más de `maxTurns` rondas de tool calls — fix con ronda final sin tools + mensaje explícito. (P.2) `maxTokens` pedía el techo absoluto del modelo (128K) sin ver el saldo real disponible — OpenRouter pre-autoriza contra el peor caso, bloqueando cuentas con saldo bajo aunque el gasto real fuera centavos; fix con `parseAffordableTokens()` que reintenta con el presupuesto real que el 402 reporta.

**Bloque A/B — Auto-split**
Diseño resolvió 4 decisiones: estimador barato (`output.length × 2048 > maxTokens × 0.7`, sin dinero real), gatillo que reusa el generador function-calling existente de `planner.ts` (sin motor nuevo), control humano obligatorio (el usuario aprueba el plan de sub-tareas antes de gastar — mismo principio "nunca auto-run silencioso" del chat), fallback documentado. Implementado en `harness.ts`/`scheduler.ts` sin construir motor nuevo. Superficie en dashboard: `GET /api/tasks/:id/split-plan` + `POST /api/tasks/:id/approve-split` + badge "⚡ Split".

**Bloque C — Gate de verificación real**
C.1: tarea `crypto-page-v1` (HTML+CSS+JS autocontenido, datos live de CoinGecko) corrida real ($0.19, QA pass). Hallazgo real: ni los checks deterministas ni el QA-LLM detectaron un error de sintaxis JS (`:` en vez de `+` en una concatenación) que rompía el script entero — encontrado abriendo la página de verdad en el navegador, no por ningún check automático (gap documentado en IDEAS.md #36, sigue abierto). C.2 (dashboard premium multi-archivo) quedó **pausado**: 2 intentos fallidos por configuración de modelo llevaron a la regla [[feedback-modelo-decision-final-carlos]] (incidente de $5.00 quemados); reintentar C.2 está gated en (1) decisión explícita de modelo por Carlos y (2) el presupuesto de outputs de tools del executor agéntico (IDEAS.md #32, prerequisito). v0.12 se priorizó por delante de C.2.

**Decisiones de diseño Mes 20**
- Ningún LLM decide el modelo de una corrida real por su cuenta ni lo arrastra de memoria de otra sesión — siempre `orchestos.config.yaml` o instrucción explícita de Carlos en el momento (regla nacida de este mes, [[feedback-modelo-decision-final-carlos]]).
- Auto-split: el usuario ve y aprueba el plan de sub-tareas antes de gastar, nunca corre solo.

**Hallazgos documentados, no resueltos en este mes (backlog)**
- IDEAS.md #36 — `defaultChecksFor` no valida sintaxis de JS embebido en HTML/`.js` (el gap real que dejó pasar el bug de C.1).
- IDEAS.md #32 — presupuesto de outputs de tools en el executor agéntico, prerequisito para reabrir C.2.
- **C.2 sigue abierto** — dashboard premium multi-archivo, la pregunta original de Carlos ("¿puede OrchestOS entregar un producto premium?") sigue sin responder con dato real. Candidato a pre-flight del próximo milestone.

**Métrica Mes 20 — PARCIAL (2026-07-14, cierre formal diferido)**
Auto-split diseñado, implementado y con superficie en dashboard; el mecanismo end-to-end se probó con éxito en un entregable simple (C.1). El gate original y más exigente (C.2, dashboard premium) queda pausado por decisión explícita de alcance de Carlos, no por falla — gated en dos prerequisitos concretos (modelo + #32). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual del repo, no snapshot del mes).

---

### MES 21 / v0.12 — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

Origen: eje decidido por Carlos (2026-07-13). Con el motor probado end-to-end (Mes 20/C.1), el norte cambió de "¿puede el motor?" a "¿se siente terminado y confiable?". Regla dura del milestone: cero features nuevas en el motor — solo pulir lo que ya existe.

| Bloque | Contenido | Estado |
|---|---|---|
| A | Borrado masivo en las 5 tablas del dashboard + 9 `confirm()`/`alert()` nativos eliminados (absorbe IDEAS #18) | ✅ SÍ |
| B | Chat renderiza Markdown (`marked` + sanitizador propio) + chips de task/modelo clicables | ✅ SÍ |
| C | Visor de diff por run (contenido, no `git diff` post-hoc) | ✅ SÍ |
| D | Auditoría real de paridad CLI↔dashboard + 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) | ✅ SÍ |
| E | Papercuts del aside derecho, 2 rondas + 4 reglas de diseño fijas para toda pantalla nueva | ✅ SÍ |
| F.1 | Cierre formal del milestone (este registro) | ✅ SÍ (2026-07-14) |

**Bloque A — Borrado masivo**
Componente reusable (`state.bulkSelected`, `wireBulkSelect()`, `renderBulkBar()`, `Modal.confirm()`) sobre `POST /api/<recurso>/bulk-delete` en las 5 tablas (runs/tasks/instincts/memory/specs). De paso, cerrado IDEAS #18 completo: los 9 `confirm()`/`alert()` nativos que quedaban en `public/` reemplazados por modales propios — cero diálogos nativos en el dashboard, verificado por grep. Verificado en vivo contra el dashboard real (borrado de tarea confirmado en disco, no solo en memoria).

**Bloque B — Markdown en el Chat**
`marked` v18.0.6 (MIT, UMD, sin build step) + sanitizador DOM propio inline (allow-list de tags, strip de `on*`/`javascript:`). Solo mensajes del asistente — el usuario sigue en texto plano. Chips clicables de `task_id` y modelo dentro de la respuesta (índice construido desde `state.tasks`/catálogo de modelos, longest-first, sin superficie de inyección — `data-*` vienen del state controlado, no del LLM). Hallazgo fuera de scope corregido en el camino (B.3): `state.chatDraft` sobrevive un re-render forzado (mismo patrón que `composeDraft`, Mes 20/C).

**Bloque C — Visor de diff por run**
Diseño decidido: diff calculado por CONTENIDO (`beforeContent`+`contractResult.written` que el harness ya captura), no por `git diff` post-hoc — el worktree se destruye siempre al terminar un run del dashboard. Librería `diff` (jsdiff, MIT). `computeFileDiffs()` en `qa.ts`, columna `file_diffs` persistida, `parseUnifiedDiff()` en frontend con colapso a 15 líneas (nunca trunca datos). Verificado en vivo con una tarea disposable corrida de punta a punta vía CLI real, no seed manual.

**Bloque D — Paridad CLI↔dashboard**
Auditoría real (no asumida) de ~40 subcomandos de `cli.ts` contra `server.ts`/`public/*.js`, verificando invocación real (`fetch()`), no solo existencia de endpoint. Refutó parte de la hipótesis original del bloque: `context compress`/`detect`/`index`/`spec draft` sí tienen paridad real (el dashboard invoca al propio CLI vía `Bun.spawn`). 3 gaps reales cerrados: `task init` (scaffold de `tasks.yaml` extraído a `src/tasks/init.ts`, reusado por CLI y endpoint nuevo `POST /api/tasks/init`), `constitution init` (el editor arranca con el scaffold real en vez de vacío, banner de preview), `summary` PDF (`GET /api/project/summary`, mismo flujo que el CLI). CLI-only intencional documentado sin implementar: `context list` (multi-proyecto), `skill scaffold`/`skill languages`, `runs --export`, `setup`, `run --dry-run`, `context update`, `instinct add` manual. Cierre verificado independientemente ([[feedback-verificar-progreso-delegado]]): código real confirmado en disco, 711 tests · 0 fail.

**Bloque E — Papercuts del aside derecho**
2 rondas sobre feedback puntual de Carlos. Ronda 1 atacó 6 síntomas pero 2 fixes tocaron el síntoma equivocado; ronda 2 (disparada por screenshot real) encontró la causa raíz de cada uno. Nacen 4 reglas de diseño fijas para toda pantalla nueva del dashboard: (1) un elemento fijo dentro de un contenedor que cambia de ancho se ancla al borde que NO se mueve (`margin-left:auto`, nunca orden-en-el-DOM); (2) las filas "toprow" comparten altura exacta y cero padding vertical propio, ni en la fila ni en overrides de estado; (3) un tooltip nunca vive dentro de un contenedor con `overflow:hidden` si su apertura puede escapar esos límites; (4) un riel colapsado que muestra contenido distinto al hover usa swap CSS puro (`display:none`+`:hover`), nunca JS. Verificado en vivo con `getBoundingClientRect()` real y hover por `ref` (no coordenada cruda).

**Decisiones de diseño v0.12**
- Cero features nuevas en el motor durante todo el milestone — disciplina explícita para que el producto "se sienta terminado" antes de seguir agregando capacidad.
- Un `[x]` de una corrida delegada no es evidencia por sí solo — Bloque D verificado independientemente contra código y tests reales antes de darlo por cerrado ([[feedback-verificar-progreso-delegado]]).

**Hallazgos documentados, no resueltos en este milestone (backlog)**
- IDEAS.md #40 — editor de Constitution sigue con auto-save silencioso por tecla (el scaffold de D.1.b resolvió el *contenido* inicial, no el auto-save en sí); Carlos pidió además revisar cuáles tabs del panel Project vale la pena conservar antes de invertir más ahí.
- Mes 20/C.2 sigue pausado (dashboard premium multi-archivo) — candidato de pre-flight del próximo milestone.

**Métrica v0.12 — SÍ (2026-07-14)**
Higiene de datos (borrado masivo, cero diálogos nativos), Markdown+chips en el Chat, visor de diff por run, y paridad CLI↔dashboard auditada con 3 gaps no-dev reales cerrados y verificados independientemente. Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.

### MES 22 / v0.13 — Que OrchestOS entregue de verdad un producto premium: cerrar C.2 (parcial)

Origen: Carlos (2026-07-15) reabrió la pregunta original de Mes 20 — *"¿puede OrchestOS entregar un producto premium?"* — y puso el eje en **entregar primero**, las modificaciones de UI (P1: #43/#40/#36/#27/#14) explícitamente pospuestas hasta después de C.2. Prerequisitos duros para la corrida C.2 (Bloque C): #32 resuelto + decisión de modelo de Carlos.

| Bloque | Contenido | Estado |
|---|---|---|
| A.1 — 🧠 | `capToolOutput()`: cap duro por tool-result (25k chars) | ✅ SÍ (2026-07-15) |
| A.2 — 🧠 | `capCheckOutput()`: truncado cabeza+cola para stdout/stderr de `run_check` | ✅ SÍ (2026-07-15) |
| A.3 — ⚡ | Wiring de `capToolOutput`/`capCheckOutput` en los 4 tools de `agentic.ts` + helpers de chat | ✅ SÍ (2026-07-15) |
| A.4 — 🔍 | Gate causal: prueba que el cap resuelve el modo `pending` real de #32 | ✅ SÍ (2026-07-15) |
| **A.5 — ⚡ (excepción: Claude por orden explícita de Carlos, 2026-07-16)** | `defaultChecksFor`: sintaxis JS en `<script>` inline y `.js` standalone vía `node --check` | ✅ SÍ (2026-07-16) |
| B.1 — 🧠 Carlos | Decisión de modelo para C.2 | ⏳ pendiente |
| C.1 — 🔍 | Corrida real del entregable premium multi-archivo, gate con dinero real | ⏳ gated por A.5 verde + B.1 |
| C.2 — 🔍 | Verdicto de producto premium end-to-end | ⏳ gated por C.1 |

**Bloque A.5 — `defaultChecksFor` valida sintaxis JS embebida (2026-07-16)**
IDEAS #36, etiquetado ⚡ en PLAN.md (DeepSeek-implementa). Implementado por **Claude por orden explícita de Carlos en el turno de A.4** — quedó registrado como excepción en el commit del propio ítem y al cierre de este mes, **no escala como precedente**. Sin la excepción, A.5 se habría delegado a DeepSeek (regla de scope-lock del PLAN.md § "Regla de alcance").

Bug original que cierra (Mes 20/C.1, 2026-07-13): el archivo `.html` generado tenía un error de sintaxis JS real (`:` suelto donde iba `+` en una concatenación dentro de `sortIcon()`) que rompía el script entero. Ni `tsc` (no cubre `.html`/`.js`) ni el juez QA-LLM lo detectaron — solo abriendo la página de verdad en el navegador.

**Diseño**: 
- **Módulo nativo nuevo** [`src/run/html-script-check.ts`](src/run/html-script-check.ts) (sin deps) con tres building blocks: `extractInlineScripts(html)` devuelve `{code, startLine, endLine}[]` filtrando por whitelist de `type=` JS ejecutable (excluye `application/json`/`text/template` para evitar falsos positivos de `node --check`), `jsCheckTempPath(sourceAbsPath)` genera path determinístico en `os.tmpdir()` (sha1 del abs-path), `jsSyntaxCheckForJsFile` y `jsSyntaxCheckForHtmlFile` construyen los `Check` con `node --check <path>`.
- **Wiring** en [`src/run/checks.ts:32`](src/run/checks.ts): el guard `node_modules` se reduce de early-return global a scope-local (solo afecta `tsc`/`bun test`). Los checks de sintaxis JS corren **sin** `node_modules` — `node --check` solo parsea, no resuelve imports. Si el `.html`/`.js` declarado en `output[]` no existe en disco, no se emite check (el contrato ya cubre el caso por otra vía; no ruido doble).

**Tests (22 nuevos, todos en `bun test`):**
- [`src/__tests__/html-script-check.test.ts`](src/__tests__/html-script-check.test.ts) — 11 tests del módulo: extracción básica, múltiples scripts, skip de `<script src>`, skip de `application/json`/`text/template`, inclusión de `type="module"`/`type="application/javascript"`, `=>` arrows sin romper el regex, números de línea 1-indexados, vacío, `<script>` sin cerrar (graceful stop).
- [`src/__tests__/checks.test.ts`](src/__tests__/checks.test.ts) — 11 tests del wiring: emite check para `.js` y `.html` con script, no emite si no existe, no depende de `node_modules`, coexiste con `tsc`/`bun test` cuando están, **3 integration tests** que corren `runChecks` end-to-end y prueban: (a) el bug de C.1 (`"a" : "b"`) ahora se detecta con exit≠0 y stderr conteniendo `Unexpected token ':'`, (b) un script válido pasa, (c) un `.js` standalone con el mismo bug se detecta.

**Resultados**: 726 → 748 tests · 0 fail (estado del repo al cerrar A.5) · `tsc --noEmit` limpio · 0 archivos `orchestos-jscheck-*.js` huérfanos tras `afterEach`.

**Decisiones de implementación que vale la pena tener registradas:**
- **Por qué `node --check` y no un parser dedicado (acorn, esprima)**: dependencia nativa en cualquier máquina con Node ≥ 18 (la cual ya está implícita porque el ecosistema la usa), sin lock-in a una versión de gramática, mismo binario que el LLM habría usado para validar. Cambio de versión de Node rotaría el comportamiento — aceptable.
- **Por qué `os.tmpdir()` y no al lado del `.html`**: deja el árbol del proyecto limpio (importante para git status / revisores) y la purga es responsabilidad del SO; el path con hash del abs-path permite `cleanupJsCheckTemp(source)` deterministico cuando se necesita (en tests).
- **Por qué whitelist de `type=` y no blacklist**: hay más tipos no-JS (JSON, templates, LD+JSON, vtt, webdata…) que JS; blacklisting dejaría huecos.

---

## Sección 2 — Ideas implementadas (provenientes de IDEAS.md)

### planner_model / executor_model por tarea — S15 (2026-05-27)
Graduado de "lista prohibida Mes 3" a implementado.
`Task.planner_model?` y `Task.executor_model?` como override por tarea en tasks.yaml.
Gana sobre `orchestos.config.yaml`. Harness los respeta vía `autoRoute`.

### Model roles config — S15 (2026-05-27)
`orchestos.config.yaml`: models{planner, executor_heavy, executor_light, default}.
`loadOrcheConfig` con fallback chain: proyecto → global → defaults.
`autoRoute(task, config)` usa `classifyTask` existente.
Comandos `config init` + `config show`.

### Language-aware skills — S16 (2026-05-27)
`LanguageTarget` type en schema. Compilador emite solo la sección del lenguaje detectado.
`skill build --project <path>` detecta lenguaje del proyecto.
`tdd-enforcer` actualizado con targets TS/C#/Python/default.

### CONSTITUTION.md + clarify — S17 (2026-05-27)
`loadConstitution(projectPath)` + inyección en system prompt.
`needsClarify(task)`: heurística v0 con verbos ambiguos + sin input[].
`--clarify` en task run: readline pregunta antes de gastar tokens.

### Context compression — S18 (2026-05-27)
`buildContextMd(projectId)`: AGENTS.md + archivos frecuentes del graph + últimos 5 runs.
`orchestos context compress` genera CONTEXT.md (~500 tokens vs ~2000 AGENTS.md).
Harness usa CONTEXT.md si existe; `runs --detail` reporta ahorro.

### Code Graph v0 — S12 (2026-05-27)
`files` + `code_edges` en SQLite. Regex import extraction para TS/JS/Python.
`orchestos index` + `orchestos context suggest`. SHA1 dedup. 1-hop neighbor ranking.
`src/graph/index.ts` y `src/graph/suggest.ts`.

### Extracción de harness — S9 (2026-05-27)
`src/run/harness.ts`: `runTask(HarnessOpts): Promise<TaskResult>`.
cli.ts solo orquesta. Harness nunca lanza — toda excepción → `status: 'failed'`.

### acceptance_criteria[] + checks[] — S10 (2026-05-27)
`checks[]` = comandos deterministas (exit code) que corren ANTES del QA LLM.
`acceptance_criteria[]` = criterios evaluados per-item por el LLM de QA.
Si check falla → revert + retry sin gastar tokens de QA.

### Multi-provider executor — S11 (2026-05-27)
Campo `executor: openrouter | anthropic | openai | codex` por tarea.
`ProviderClient` interface. `getProvider(name)` en `src/providers/index.ts`.

### Skills de ciclo de vida — S18 (2026-05-27)
Provenientes de IDEAS.md "Skills de ciclo de vida".
`security-review`: OWASP Top 10 basics, antes de mergear código que toca auth/inputs/SQL.
`qa-structured`: cómo evaluar después de implementar (≠ acceptance_criteria que define qué).
`test-writer`: agregar tests a código existente con language_targets multi-lang.

### Expansión de lenguajes (36 langs) + skill scaffold — 2026-05-27
Proveniente de IDEAS.md y petición de cobertura real de lenguajes.
`languages.ts`: EXT_MAP expandido a 36 lenguajes (VB, F#, R, Dart, Svelte, Elixir, Haskell,
Lua, Perl, OCaml, Scala, Julia, Shell, PowerShell, SQL, Go, Rust, Swift, Kotlin, etc.)
`SUPPORTED_LANGUAGES` exportado para uso en CLI.
`src/skills/scaffold.ts`: `scaffoldSkillYaml(lang)` con 25+ perfiles reales (verifiers,
anti_patterns específicos). `yamlItem()` helper para quoting correcto.
Comandos: `orchestos skill scaffold --language <lang>` + `orchestos skill languages`.

### Graph multi-lenguaje — 2026-05-27
Expansión de Code Graph v0. Proveniente de IDEAS.md "Multi-lenguaje en Code Graph".
`INDEX_GLOB` expandido: C#, Rust, Go, Java, Kotlin, Ruby, PHP, Swift, Elixir, Haskell, Lua, Perl.
Extractores de imports por lenguaje: `extractCSharpImports`, `extractRustImports`,
`extractGoImports` (single + block), `extractJvmImports` (Java/Kotlin/Scala + wildcards),
`extractRubyImports`, `extractPhpImports`, `extractSwiftImports`, `extractElixirImports`.
Pendiente: resolución de paths relativos para lenguajes no-JS.

### Test suite (78 tests) — 2026-05-27
Primera suite de tests automatizados del proyecto.
`languages.test.ts`: detectLanguages, detectPrimaryLanguage, SUPPORTED_LANGUAGES.
`graph-imports.test.ts`: extractores JS/TS, C#, Rust, Go, JVM (wildcards), Ruby.
`skill-scaffold.test.ts`: YAML validity para 10+ lenguajes, verifiers específicos.
`router.test.ts`: classifyTask (15 casos EN/ES), autoRoute con prioridades.
`clarify.test.ts`: needsClarify, clarifyReason heurística v0.
Bug encontrado + corregido: JVM wildcard regex (`java.util.*`), YAML quoting para `[Ignore]`.

### Two-tier LLM convention — Mes 3 (2026-05-27)
Convención `⚡` / `🧠` activa en PLAN.md para delegar entre modelos.
`executor` field en tasks.yaml es el primer eslabón concreto.
`planner_model` / `executor_model` en tasks.yaml → implementado en S15.

### Sub-agentes con contextos aislados — S22 (2026-05-28)
Proveniente de IDEAS.md "Sub-agentes con contextos aislados".
Tarea "plan" genera sub-tareas via `src/agents/planner.ts`. Cada sub-tarea recibe
contexto aislado (slice de CONTEXT.md + memories filtradas por topic_key + spec propio).
Sub-agentes ejecutan en worktrees hijos. QA en cascada: un fallo cancela dependientes.
Smoke real: write-greeting→write-response (depends_on), ambas pasaron, memory_entries escritas.

### allowed_tools en SkillDef — S22.0.1 (2026-05-28)
Proveniente de inspiración DeerFlow (skills con tool policy) en IDEAS.md.
Campo `allowed_tools?: string[]` en `SkillDef` (`src/skills/registry.ts`).
Validador rechaza tools no en la lista — política dura en el harness, no sugerencia al modelo.
Las 11 skills existentes actualizadas con sus listas.

### Tabla memory_entries + topic_key upsert — S22.0.3 (2026-05-28)
Proveniente de patrón Engram (topic_key upsert) en IDEAS.md sección "Inspiración externa".
`src/db/memory.ts`: `upsertMemory()` / `getMemory()` / `listByScope()`.
`UNIQUE(project_id, topic_key)` — re-ejecución actualiza en lugar de duplicar.
Scope: `session | project | global`. Índice por `(project_id, scope)`.

### selectMemories: resolución ID→topic_key — S22 (2026-05-28)
Bug corregido antes de Mes 6: `depends_on` contiene IDs de sub-tasks (e.g. "write-greeting"),
no topic_keys (e.g. "smoke-greeting"). Fix: mapear via `allSubTasks.find(t => t.id === depId)?.topic_key`.
Sin el fix, los sub-tasks que dependen de un predecessor nunca recibían su memory en contexto.

### Function calling para el planner — S23 (2026-05-28)
Proveniente de IDEAS.md "Function calling para planner".
`planWithFunctionCalling()`: LLM llama `create_subtask` N veces, cada call validada por el SDK
antes de llegar al código — elimina errores de indentación YAML estructuralmente.
`generatePlan()`: auto-detect en runtime; providers sin tool support → YAML fallback transparente.
`src/providers/tool-call.ts`: `callWithTools()` + `supportsToolCalling()` registry.

### Context monitor — S23.0.2 (2026-05-28)
Proveniente de IDEAS.md "Context monitor" (patrón ECC ecc-context-monitor.js).
`src/hooks/context-monitor.ts`: 5 señales de salud (context%, cost, loop, scope_creep).
No bloquea — emite warnings estructurados. Debounce de 5 calls para no saturar logs.
21 tests. Integrado en harness post-`enforceContract`.

### Agente de diagnóstico de fallos — S25 (2026-05-28)
Proveniente de IDEAS.md "Agente de diagnóstico de fallos".
`diagnoseTask()` lee los últimos 3 runs de un task `failed_permanent` y consulta a Haiku
para clasificar el patrón de fallo y generar una sugerencia accionable.
Auto-trigger en `task run --all`. Nunca ejecuta — solo sugiere. El usuario aplica.

### Embeddings semánticos en suggestContext — S24 (2026-05-28)
Proveniente de IDEAS.md "Embeddings semánticos en suggestContext".
`EmbeddingProvider`: OpenAI text-embedding-3-small + Ollama nomic-embed-text (local, sin API key).
`suggestContext()` con re-rank `embed×0.6 + keyword×0.4`. Files encontrados solo por coseno → reason=`embedding`.
`--no-embed` en `orchestos index` — proyectos sin API key no se rompen.
Columna `embed_hits` en `runs` para medir ROI real en producción.

### BM25 conflict detection en memoria — S26 (2026-05-28)
Proveniente de patrón Engram (IDEAS.md sección "Inspiración externa").
`memory_fts` FTS5 virtual table + 3 triggers. `upsertMemory()` retorna `{id, candidates: ConflictCandidate[]}`.
`judgeConflict()` Haiku clasifica relación en 6 categorías: `conflict_with | supersedes | compatible | scoped | related | not_conflict`.
Tabla `memory_conflicts` con CRUD completo. CLI: `orchestos memory conflicts [--project]`.
212 tests · 0 fail.

### Middleware chain (enrichment phase) — S31 (2026-06-02)
Proveniente de patrón DeerFlow `_build_middlewares()` en IDEAS.md.
`MiddlewareFn<TCtx>` + `RunContext` + `createChain()` en `src/run/middleware.ts`.
10 middlewares en orden canónico: spec-gate → sandbox-setup → classify-route → memory-fetch → skill-route → tool-policy → constitution-load → context-source → instinct-apply → prompt-build.
`harness.ts` refactorizado: construye la chain y ejecuta `chain.run(ctx)` para la fase de enrichment. La fase de ejecución permanece inline.

### Capabilities contract + Delta headers — S32 (2026-06-02)
Proveniente de patrones OpenSpec (capabilities contract + delta headers) en IDEAS.md.
`spec draft` genera bloque `capabilities: { added, modified, removed }` en frontmatter.
`spec lint` detecta: specs con `modified`/`removed` sin headers delta, y secciones `## MODIFIED` con contenido parcial.
Headers delta: `## ADDED`, `## MODIFIED`, `## REMOVED` — para specs brownfield con cambios incrementales.

### Instincts con confidence scoring — S33 (2026-06-02)
Proveniente de patrón ECC (instincts atómicos con confidence) en IDEAS.md.
`src/instincts/schema.ts` + `src/instincts/store.ts` (SQLite tabla `instincts`).
Umbrales: `< 0.6` no aplica · `>= 0.8` aplica automáticamente. `source: manual | auto`. `verified: boolean`.
CLI: `instinct list | add | set-confidence`. Middleware `instinct-apply` en harness.
Convive con skills — no las reemplaza.

### Continuous learning v2: runs → instincts — S34 (2026-06-02)
Proveniente de patrón ECC (continuous learning v2) en IDEAS.md.
`analyze/propose.ts`: si patrón ≥ 3 runs → `instinct propose` crea instinct `source:auto`, `confidence:0.6`, `verified:false`.
CLI: `instinct review | approve | reject`. Hook post-`task run` muestra proposals nuevos.
Cierra el loop S30→S33→S34: runs → analizar → proponer → revisar → aplicar.

### Cost tracker via transcript parsing — S35 (2026-06-02)
Proveniente de patrón ECC (cost tracker via transcript parsing) en IDEAS.md.
`src/run/transcript-parser.ts`: extrae tokens por sub-agente del transcript JSON.
`runs.cost_usd` recalculado como suma total. Columna `cost_breakdown_json` con desglose por sub-agente.
`runs --detail` muestra tabla sub-agente | modelo | input_tokens | output_tokens | cost_usd.
`src/router/pricing.ts` actualizado con nuevos modelos.

### Dashboard local — S36 (2026-06-02)
`orchestos dashboard [--port 4242]`: Bun.serve + HTML/JS vanilla en `src/dashboard/public/`.
4 vistas: `/runs` (cost breakdown + context warnings), `/tasks` (status + retries + QA verdict),
`/instincts` (approve/reject desde UI), `/specs` (lint badge activo/archivado).
Cero dependencias externas. Lee SQLite directamente. Sin auth (tool local).

### Diagnóstico de fallos en el dashboard — A1-A5 (2026-06-04)
Motor S25 (`diagnoseTask`) expuesto en la UI de Tasks. Chip "Ver diagnóstico" en filas `failed` → panel inline con pattern (lenguaje humano), confidence (Alta/Media/Baja), suggestion, details. Botones "Reintentar" y "Convertir en hábito" directamente desde el diagnóstico. 3 defectos de UX corregidos en el gate A5.

### Vista editable "lo que OrchestOS sabe del proyecto" — B1-B5 (2026-06-04)
`CONSTITUTION.md` y `CONTEXT.md` accesibles desde el dashboard. Pantalla "Proyecto" con tabs "Guía del agente" (editable, auto-save debounce 1s) y "Contexto comprimido" (read-only + Regenerar). Escribe al mismo path que usa el harness — una sola fuente de verdad sin sincronización.

### Control Center — salud continua del proyecto — C1-C5 (2026-06-04)
I2/Setup extendida de checklist estático a dashboard de salud vivo. 5 bloques con semáforo: sistema, tareas bloqueadas, revisiones pendientes (instincts+specs), costo 7 días, últimos aprendizajes. Auto-refresh 30s. Links directos a la pantalla relevante. Pantalla de inicio adaptativa según atención + modo.

### Detección de modelos locales (Ollama) — D0+D0-ext (2026-06-04)
Probe automático a `localhost:11434` al arrancar. Modelos Ollama en el selector marcados "Local (Ollama)" con precio "local". Buscador en tiempo real. Chat vía `localhost:11434/v1/chat/completions` sin API key. Warning dismissible por sesión. Settings Ollama con badge "Detected/Not detected" por probe real.

### Archivos como input en Chat — D1-D5 (2026-06-04)
Input conversacional externo (distinto de `context authorize` que es del proyecto). Botón clip → imagen (vision), PDF (texto extraído), .txt/.md. Límite 10MB. Chip del archivo sobre el input. Botón "Crear tarea desde esta conversación" tras 3+ mensajes — pre-fill con últimos 3 mensajes del usuario.

### Wizard API key: muro del cold-start — E1-E5 (2026-06-04)
Wizard 3 pasos dentro del producto: qué es una API key → instrucciones por provider → pegar + verificar con llamada real. 3 proveedores (OpenRouter, Anthropic, OpenAI). Trigger desde checklist de salud y desde Settings. Rollback solo en 401. Key nunca en logs ni en respuesta. i18n 24 claves en/es.

### Superficie humano vs operador (toggle modo avanzado) — F1-F6 (2026-06-04)
Nav con dos niveles: modo normal (Tasks · Proyecto · Hábitos · Chat + toggle + Settings) y modo avanzado (+ Runs · Memory · Specs con badge `adv`). Toggle con `ICON.sliders` persistido en `localStorage`. Fade-in 250ms al activar. Redirect a Tasks al desactivar si se está en pantalla operador. Banners explicativos en Runs y Memory para el no-dev.

### Autoría de skills con curador — Bloques C-F (2026-06-10)
Curador LLM (Haiku) normaliza texto libre a `SkillDef` validado, con hasta 2 reintentos. Tres puertas en la pantalla Skills: escribir (textarea + preview editable), importar (URL o YAML pegado + normalización + warnings), exportar (download/copiar YAML con `Content-Disposition: attachment`). Paridad CLI: `orchestos skill curate "<descripción>" [--save]` y `orchestos skill import <url>`.

### Pack curado de skills de ingeniería "pro" — Bloque G (2026-06-10)
8 skills curados desde mattpocock/skills y obra/superpowers, normalizados al `SkillDef` propio: `code-review`, `refactor-guided`, `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`, `doc-gen`. Viven en `skills/pro/` (separado de `skills/` del usuario). Sección "Skills recomendados" en el dashboard con botón "Importar" vía la puerta importar del curador. 8/8 validados y probados en tareas reales.

### Web fetch real en el Chat — Bloque A (2026-06-23)
El chat puede ahora traer contenido real y actual de una URL en vez de responder de memoria. `runToolLoop()` añade conversación multi-turno (LLM → `fetch_url` → resultado → respuesta final) sobre la capa de tool-calling existente (S23), sin tocar el planner. Guard SSRF resuelve DNS antes de fetch (mismo resolver que usa `fetch()`, no consulta DNS directa) y bloquea localhost/rangos privados. Contenido externo siempre se envuelve como dato, nunca instrucción — verificado en vivo con un payload de prompt injection real que el modelo no obedeció. Transparente: la respuesta del chat incluye qué URLs se fetchearon.

### autoskills — registry de skills de la comunidad (2026-06-23)
`orchestos skill fetch --list/--name <id>` y sección "Discover skills" en el dashboard — 217 skills reales del índice `cdn.jsdelivr.net/npm/autoskills`, importables con un click. Cada skill pasa por el mismo `normalizeImport()` del curador (Mes 11), sin parser de frontmatter propio. Resuelve la decisión pendiente de "¿registry propio o wrappear autoskills?" — se consume directo el índice + contenido raw de GitHub, sin intermediario propio que mantener.

### Higiene de tests — fugas a la `runs` real (2026-07-05)
8 archivos de test (`harness-evidence.test.ts`, `engine-selection.test.ts`, `cli-runs-detail-engine.test.ts`, `harness-engine-persistence.test.ts`, `harness-retry.test.ts`, `spec.test.ts`, `context-monitor-db.test.ts`, `suggest.test.ts`) escribían en `~/.orchestos/db.sqlite` — la misma DB que lee el dashboard real — sin limpiar en `afterAll`/`afterEach`. Detectado por Carlos viendo filas raras ("Recent Runs" repitiendo el mismo timestamp). Corregido con cleanup por `task_id`/`prompt`+`provider`/`project_id` según cada caso; purgadas 1800 filas sucias acumuladas de meses de `bun test` local. Recurrió parcialmente en Mes 18 (I.6, memory_entries) — ver [[reference-test-fixtures-leak-into-real-db]].

### CI en rojo desde Mes 17 C.2 — 4 causas encontradas y corregidas (2026-07-06)
Todo commit desde el fix de detección honesta de Claude Code (Mes 17 C.2) fallaba en CI. Causa 1: ~17 tests de `external-engine.test.ts`/`engine-selection.test.ts` dependían sin querer de que la máquina real tuviera el binario `claude` en PATH — solo 3 mockeaban `Bun.which`; mock global agregado. Causa 2: 2 tests nuevos de `skill-auto-selection.test.ts` (Mes 18 Bloque D) pasaban en local solo porque la máquina de Carlos tiene `OPENROUTER_API_KEY` real — CI no la tiene (correctamente); fix con `sk-test-or-key` explícito por test, mismo patrón que `harness-evidence.test.ts`. Causa 3: `chat-read-project-tools.test.ts` comparaba por substring `"not found"` contra un sentinel, y la prosa real de IDEAS.md documentando la Causa 2 contenía esa misma frase — coincidencia, no bug; fix con comparación exacta contra el sentinel real. Verificado en verde en GitHub Actions (run 28808032085).
