# Bloque H — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="bloque-h-h-1-1"></a>
### H.1.1 — ⚡ README miente sobre el estado del proyecto.
 (cerrado 2026-09-01) Dice "369 tests · Sprint 8
  complete" cuando hay **1174 tests** y el plan va por **Sprint 30**. Subvalúa el trabajo real 3×
  y es lo primero que lee cualquiera. Actualizar conteo de tests, mes/fase actual y cualquier
  otra cifra obsoleta, tomando los números de una corrida real (`bun test`), no de memoria.
  Gate: `bun test` para obtener el número real + diff acotado a `README.md`.
  **Evidencia:** `bunx tsc --noEmit` ✅ · `bun test` ✅ (1174 pass / 0 fail, 2852 expects,
  120 archivos). `README.md` actualizado a Sprint 30 / Bloque H; el conteo obsoleto de 9
  middlewares se corrigió a los 5 que encadena `src/run/harness.ts`. El conteo de 36 lenguajes
  se verificó contra `SUPPORTED_LANGUAGES` y sigue vigente.

<a id="bloque-h-h-1-2"></a>
### H.1.2 — ⚡ `CONSTITUTION.md` está vacío (0 bytes).
 (cerrado 2026-09-01) Existe `src/spec/constitution.ts`
  implementado al lado. Un archivo raíz vacío es lo primero que abre un externo y sugiere
  abandono donde no lo hay. Redactar el contenido derivándolo de lo que ya implementa
  `src/spec/constitution.ts` — **leer el código como fuente**, no inventar principios nuevos.
  Si el código no alcanza para llenarlo, decirlo y parar: es un 🧠, no un ⚡.
  Gate: diff acotado + coherencia verificada contra `src/spec/constitution.ts`.
  **Evidencia:** se materializó sin alteraciones el contenido de `scaffoldConstitutionMd()`:
  `parseConstitution()` carga 3 reglas `allowed`, 4 `forbidden` y 3
  `require_confirmation` (10 en total). `bunx tsc --noEmit` ✅ · tests relevantes ✅
  (10 pass / 0 fail, 24 expects).

<a id="bloque-h-h-1-3"></a>
### H.1.3 — ⚡ No hay script `test` en `package.json`.
 (cerrado 2026-09-01) `bun test` funciona por convención
  del runtime, pero quien clone y haga `npm test` / `bun run test` no encuentra nada. Agregar
  `"test": "bun test"` sin tocar `test:coverage` (que es el comando exacto de CI y no se
  reemplaza). Gate: `bun run test` corre la suite; `bun run test:coverage` sigue intacto.
  **Evidencia:** antes del cambio, `bun run test` devolvía `a package.json script "test" was
  not found`; después, `bun run test` ✅ (1174 pass / 0 fail, 2852 expects, 120 archivos).
  `bun run test:coverage` permanece como `bun run scripts/check-coverage.ts` y pasa ✅
  (functions 73.96% ≥ 69%; lines 62.91% ≥ 57%). `bunx tsc --noEmit` ✅.

<a id="bloque-h-h-1-4"></a>
### H.1.4 — ⚡ Artefactos de ejecución trackeados en git.
 (cerrado 2026-09-01) 24 archivos entre
  `demo/crypto-page-v*/index.html`, `runs/*.log` y `test-project/`. Son salidas de corridas,
  no fuente. Sacarlos del índice (`git rm --cached`) y agregarlos a `.gitignore`.
  **No borrar del disco** — pueden ser evidencia de gates. Verificar antes si alguno está
  referenciado por un test o por `tasks.yaml`; si lo está, parar y reportarlo.
  Gate: `bun test` sigue verde tras el untrack + diff acotado.
  **Evidencia:** la primera verificación paró correctamente: los 6 HTML de `demo/` estaban
  declarados como outputs en el `tasks.yaml` raíz y dos checks consumían
  `demo/crypto-page/index.html`. Carlos confirmó que eran evidencia exploratoria y autorizó
  continuar el untrack conservando `tasks.yaml` como registro. Los 24 archivos salieron del
  índice, siguen físicamente en disco y `git check-ignore` confirma `demo/`, `runs/*.log` y
  `test-project/`. `bunx tsc --noEmit` ✅ · `bun test` tras el cambio ✅ (1174 pass / 0 fail,
  2852 expects, 120 archivos).

<a id="bloque-h-h-2-1"></a>
### H.2.1 — 🧠 No hay linter ni formatter.
 (cerrado 2026-09-01) Ni eslint, ni biome, ni
  oxlint, ni prettier. En la taxonomía de Fowler (guides/sensors × computacional/inferencial)
  esta es **la casilla feedforward computacional vacía**: la capa más barata, determinista y
  que no consume contexto del agente. Hoy el repo paga con mutation testing —la casilla más
  cara— parte del trabajo que un linter haría gratis y antes de generar.
  Requiere criterio: elegir herramienta (biome = lint+format en un binario, vs oxlint = más
  rápido pero solo lint), definir el set de reglas inicial sin romper 531 archivos de golpe, y
  decidir si entra al pre-commit o solo a CI al principio.
  Gate: la herramienta corre limpia o con un baseline explícito de excepciones documentado;
  `bun run typecheck` y `bun run test:coverage` siguen verdes.
  **Decisión de herramienta:** Biome (lint + format en un binario, tal como enmarca la
  auditoría) sobre oxlint — evita sumar Prettier como segunda pieza. `biome.json` respeta el
  estilo ya existente en el repo (2 espacios, comillas simples, **sin punto y coma** —
  confirmado con grep antes de configurar, no asumido) y `lineWidth: 100` (el default de 80
  generaba wraps artificiales en imports típicos del repo).
  **Baseline de excepciones documentado** (no "limpio de cero", explícito por diseño):
  `noAssignInExpressions` y `useIterableCallbackReturn` off (idioms legítimos: loop de
  `regex.exec()` y `forEach(x => console.log(...))` en scripts CLI), `noControlCharactersInRegex`
  off (regex de saneamiento de texto en `chat.ts` necesita esos rangos a propósito),
  `noGlobalEval` off solo en `scripts/ui-gates/**` (uso de `eval` dentro de
  `page.evaluate()` de Playwright, no del runtime de la app), `noDangerouslySetInnerHtml` off
  solo en `icons.tsx` (renderiza el catálogo interno de SVG, no input de usuario). `a11y` y
  `noImplicitAnyLet` bajados a `warn` — son hallazgos reales (accesibilidad del dashboard,
  gaps de tipado en tests) documentados como IDEAS.md `#61` para limpieza incremental, no
  fixeados en este ítem para no convertir "agregar el linter" en "arreglar 500 archivos".
  CSS (`**/*.css`) y el vendor bundle `marked.umd.js` quedan excluidos — Tailwind-in-CSS no
  lo parsea el CSS parser de Biome, y un bundle minificado de terceros no es código propio.
  **Pre-commit vs CI:** solo CI por ahora (`bun run lint` agregado a `.github/workflows/ci.yml`
  después de `typecheck`) — no se suma al pre-commit todavía, decisión explícita para no
  imponer 800+ warnings visibles en cada commit local antes de que el baseline se limpie.
  **Evidencia:** `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, 2852
  expects, 120 archivos; functions 73.96% ≥ 69%, lines 62.49% ≥ 57%) · `bun run lint` ✅ exit 0
  (0 errores, 835 warnings + 467 infos documentados como baseline). `bunx biome check --write .`
  aplicó fixes de formato/imports en 324 archivos sin cambiar semántica (verificado con la
  suite completa antes/después). `package.json`: agregados `lint` y `lint:fix`.
  **Gate en vivo: verificado con Playwright** (Chromium) contra el dashboard real — el
  reformateo tocó `src/dashboard/**` (incluye el fix de estilo real en `theme.js`, `var v`
  sacado del `try`). `getTheme()`/`setTheme()`/persistencia en `localStorage` siguen
  funcionando después del cambio (`initial: "orchestos" → setTheme("dark2026") → persisted →
  afterReload: "dark2026"`, sin excepciones de página). El único 400 detectado
  (`/api/chat/models`) es preexistente — reproduce igual en un `ORCHESTOS_HOME` limpio sin
  API key configurada, no relacionado con este cambio.

<a id="bloque-h-h-3-1"></a>
### H.3.1 — 🧠 El estado del producto no es machine-readable.
 (cerrado 2026-09-01)
  `PLAN.md` (1003 líneas) es la fuente real, pero ningún script lo parsea salvo
  `findOpenPlanItem()`. `tasks.yaml` sí es estructurado pero contiene tareas de **demo**
  (`crypto-page-v1`), no el backlog del producto. `.orchestos/specs/` está vacío.
  Referencia: Anthropic usa JSON para su feature list **deliberadamente** — *"el modelo es
  menos propenso a cambiar o sobrescribir inapropiadamente archivos JSON"* — con forma
  `{category, description, steps, passes:false}` y la regla explícita *"es inaceptable
  eliminar o editar tests"*.
  Decisión de diseño requerida: si se adopta un `feature_list.json` derivado de `PLAN.md`,
  cuál es la fuente y cuál el derivado — **no puede haber dos fuentes de verdad**. Esa es
  exactamente la trampa que ya costó el bug de `orchestos context update` sobrescribiendo
  `AGENTS.md`.
  **Decisión (confirmada por Carlos antes de codear):** `PLAN.md` sigue siendo la ÚNICA
  fuente de verdad — su prosa, evidencia y links a memoria no se tocan ni se reemplazan.
  `.orchestos/feature-status.json` es **derivado**, regenerado siempre desde `PLAN.md` por
  `scripts/generate-feature-status.ts` (parser en `scripts/plan-status.ts`), nunca editado a
  mano — mismo contrato que `runs-summary.json`. `tasks.yaml` no se toca: la auditoría ya
  documentó que es fixtures de demo/harness, no backlog (Bloque H.6), y esto no cambia esa
  lectura. `.orchestos/specs/` queda fuera de alcance — es para specs por tarea (spec-kit),
  un problema distinto al de rastrear el estado de PLAN.md.
  Discriminador del parser: un ítem de trabajo real es `- [ ] **<ID> — <🧠|⚡|🔍> <título>**`;
  los veredictos de cierre de mes (`**SÍ — Sprint 27 cerrado...**`) no llevan el emoji de
  delegación justo tras el guión largo, así que el regex los excluye sin necesitar una lista
  negra — verificado contra el `PLAN.md` real: captura los 24 ítems de trabajo reales de los
  45 checkboxes en negrita, y ninguno de los 21 veredictos de mes.
  **Gate: pre-commit, no CI.** A diferencia de Biome (H.2.1), acá el costo es ~0 (regex +
  escritura de archivo, sin red ni LLM) y el problema central del ítem es justo que nada se
  mantiene sincronizado solo — un gate en pre-commit lo hace imposible de olvidar. En vez de
  un checker que falla y pide re-correr a mano, `scripts/pre-commit.sh` regenera el JSON y lo
  agrega al commit automáticamente (`bun run plan:status` + `git add`), igual que
  `runs-summary.json` — a diferencia de ese archivo, esto SÍ es seguro en worktrees porque es
  una función pura de `PLAN.md` (mismo input → mismo output), sin el problema de timestamps
  que forzó la excepción de `runs-summary.json`.
  **Evidencia:** `scripts/plan-status.test.ts` (7 tests) + `scripts/generate-feature-status.test.ts`
  (1 test) cubren extracción de ítems, asignación de month/block por header más cercano,
  status/closedDate, delegación, exclusión de veredictos de cierre de mes, y escritura del
  JSON. `bunx tsc --noEmit` ✅ · `bun test` ✅ (1182 pass / 0 fail, 2871 expects, 122
  archivos) · `bun run lint` ✅ exit 0 (se aprovechó para excluir también `runs-summary.json`
  de Biome, generado y con formato propio — hueco que quedó de H.2.1) · `bun run plan:status`
  regenera `.orchestos/feature-status.json` con los 24 ítems reales verificados a mano.

<a id="bloque-h-h-3-2"></a>
### H.3.2 — ⚡ `DONE.md` pesa 540 KB / 5969 líneas.
 (cerrado 2026-09-01) Ningún agente lo lee entero, y no
  tiene índice ni partición. Es el anti-patrón de "instrucciones monolíticas que se pudren"
  aplicado al historial. Partir por mes en `docs/done/sprint-NN.md` dejando `DONE.md` como índice
  con enlaces, **preservando el contenido íntegro** (es historial, no se resume ni se recorta).
  Verificar que ningún script referencie `DONE.md` por ruta antes de partirlo.
  Gate: contenido total preservado (comparar conteo de líneas antes/después) + `bun test` verde.
  **Evidencia:** ningún script lee o parsea `DONE.md` (solo dos comentarios de código citan el
  índice como evidencia). Las 5964 líneas del cuerpo original se distribuyeron entre
  `docs/done/sprint-01.md`–`sprint-29.md` y `ideas-implementadas.md`; sumadas a las 5 líneas de
  encabezado conservadas en el índice representan las 5969 líneas originales completas. La
  reconstrucción devuelve el mismo SHA-256 después de normalizar únicamente el prefijo `../../`
  agregado a 214 enlaces relativos para que sigan resolviendo desde `docs/done/`. `DONE.md` queda
  como índice de 43 líneas, con 30 enlaces verificados en disco. De 244 destinos relativos
  auditados, 242 resuelven; las dos referencias a `src/run/middlewares/tool-policy.ts` ya estaban
  rotas antes de partir el archivo y se preservan como historia, no se corrigen dentro de este
  scope. `bunx tsc --noEmit` ✅ · `bun test` antes y después del cambio ✅ (1182 pass / 0 fail,
  2871 expects, 122 archivos).

<a id="bloque-h-h-4-1"></a>
### H.4.1 — 🧠 El scope-lock es narrativo, no mecánico.
 (cerrado 2026-09-01)
  `agent:preflight` exige `--item <ID>` y valida que esté abierto — eso sí es mecánico. Pero
  **nada compara el diff final contra el scope declarado**: un agente puede tomar `UI.4` y
  tocar cinco módulos ajenos sin que ningún gate lo note. El protocolo lo admite
  honestamente (`docs/agent-work-protocol.md` § Principio, nivel "narrativo"), y ese es
  precisamente el hueco. Diseñar un check de pre-commit que compare los paths tocados
  contra los declarados por el ítem. Requiere decidir dónde se declaran esos paths y qué
  pasa con cambios legítimamente transversales.
  **La auditoría no prescribe el formato** — solo el resultado deseado (cita textual del
  informe fuente): *"Un check de pre-commit que compare los paths tocados contra los
  declarados en el ítem lo vuelve mecánico."* A diferencia de H.3.1 (donde sí había una cita
  directa, el `feature_list.json` de Anthropic), acá no hay un precedente externo citado —
  se investigó antes de diseñar, no se asumió.
  **Investigación contra precedente externo (a pedido explícito de Carlos, antes de
  diseñar):** se revisaron los 9 repos de [[reference-external-repos]] vía `gh api` (código
  real, no README) buscando algo mejor que lo propio. Ninguno resuelve "comparar diff contra
  scope declarado por tarea": ECC (`scripts/hooks/ecc-context-monitor.js`) tiene un "SCOPE
  WARNING" pero es un contador crudo (`files_modified_count > 20` → mensaje informativo, sin
  scope declarado, nunca bloquea) — más débil que lo que necesitamos. OpenSpec
  (`schemas/spec-driven/schema.yaml`, `src/core/working-set.ts`) tiene "capabilities
  contract"/"delta headers", pero son sobre qué archivos de **spec** (`specs/<capability-
  path>/spec.md`) se crean — un problema de organización de documentación, no de diff de
  código vs. scope. DeerFlow, Engram, gentle-ai, Hermes, Orca, fable-method y Graphify no
  tienen nada análogo. Conclusión: no había un "formato correcto" externo que seguir — es
  terreno donde el diseño queda a criterio de ingeniería propio, igual que la auditoría lo
  dejó abierto.
  **Diseño implementado:** declaración OPCIONAL de un glob amplio (no una lista exacta de
  archivos — la mayoría de ítems 🧠 no permite predecir paths antes de investigar el código;
  H.2.1 terminó tocando 328 archivos que nadie podía enumerar de antemano) vía
  `agent:preflight -- --item <ID> --scope "<globs>"`, persistida en
  `.orchestos/active-item.json` (gitignored, estado de sesión efímero — no fuente de
  verdad). El gate de pre-commit (`scripts/check-scope-lock.ts`) es **no-op si nadie
  declaró scope** (mecaniza la disciplina sin forzar retrofits en ítems viejos); si hay
  declaración y el diff staged toca paths fuera del glob, **no bloquea trabajo
  transversal legítimo**: exige una línea `**Fuera de scope declarado:** <por qué>` en el
  mismo commit de `PLAN.md` — mismo patrón exacto que `Gate en vivo:` de H.4.1's hermano
  (`hasLiveGateEvidence`). Al detectar que el ítem declarado se cierra (`[x]` en el diff de
  `PLAN.md`), el gate borra `.orchestos/active-item.json` solo — no tiene sentido que el
  estado sobreviva al ítem que lo declaró.
  **Evidencia:** `scripts/scope-lock.ts` (lógica pura: `parseScopeArg`, `pathsOutsideScope`
  vía `Bun.Glob` nativo — sin dependencia nueva —, `hasOutOfScopeJustification`,
  `planClosesItem`) con `scripts/scope-lock.test.ts` (9 tests, 100% funcs/líneas).
  `scripts/check-scope-lock.ts` (CLI wrapper, sin test dedicado — mismo criterio que
  `check-live-gate.ts`, que tampoco lo tiene: la lógica pura ya está cubierta). Prueba
  end-to-end manual contra un repo git temporal real: caso 1 (fuera de scope sin
  justificación) → exit 1 con el path ofensor listado; caso 2 (con la línea de
  justificación agregada) → exit 0; caso 3 (ítem cerrado) → exit 0 y
  `.orchestos/active-item.json` eliminado. `bunx tsc --noEmit` ✅ · `bun test` ✅ (1191
  pass / 0 fail, 2880 expects, 123 archivos) · `bun run lint` ✅ exit 0. Wireado en
  `scripts/pre-commit.sh` después del gate de H.3.1; `docs/agent-work-protocol.md` § paso 5
  documenta el `--scope` opcional.

<a id="bloque-h-h-4-2"></a>
### H.4.2 — 🧠 Hay clock-in mecanizado pero no hay clock-out.
 (cerrado 2026-09-01)
  `grep -i "handoff|cierre de sesión|checklist"` no devuelve nada en `AGENTS.md`,
  `CLAUDE.md` ni el protocolo. El pre-commit/pre-push cubren parte, pero no existe un
  artefacto de handoff que le diga a la próxima sesión dónde quedó todo. Además
  `.claude/scheduled_tasks.lock` está **stale** (apunta a un pid del 19-ago) — evidencia de
  que nada limpia al cerrar.
  **`.claude/scheduled_tasks.lock` queda fuera de alcance, explícito:** verificado que el
  PID (91448) ya no corre (`ps -p 91448` vacío) y que **ningún archivo de `src/`/`scripts/`
  lo referencia** — es un artefacto propio del CLI de Claude Code (feature de scheduled
  tasks), gitignored (`.claude/*`), no código de OrchestOS. No hay nada que este ítem pueda
  arreglar ahí sin tocar herramienta externa; se documenta en vez de fingir un fix.
  **Investigación de precedente antes de diseñar:** se revisó `obra/superpowers` — tiene
  `finishing-a-development-branch`, pero es sobre decidir merge/PR/worktree al terminar una
  rama; no aplica porque OrchestOS commitea directo a `master` (autorización permanente de
  push, no hay flujo de PR). Se encontró la pieza correcta en `mattpocock/skills`:
  `productivity/handoff` e `in-progress/claude-handoff` (verificado vía `gh api`, código
  real). Cita textual robada, es el principio de diseño central: *"Do not duplicate content
  already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs).
  Reference them by path or URL instead."*
  **Adaptación deliberada (no copia ciega):** mattpocock guarda el handoff en el temp del
  SO porque asume un solo usuario en Claude Code. OrchestOS admite Claude/Codex/DeepSeek/
  OpenCode trabajando el mismo repo, a veces en paralelo
  ([[feedback-codex-sesiones-paralelas-no-preguntar]]) — el handoff vive DENTRO del working
  directory (`.orchestos/handoff.md`, gitignored) para que cualquier próxima sesión, de
  cualquier CLI, lo encuentre sin configuración extra. Tampoco se mecaniza como gate
  bloqueante (a diferencia de H.4.1/H.3.1): no existe un evento "fin de sesión" uniforme
  entre los 4 CLIs para engancharlo a un hook — es un paso narrativo del protocolo (paso 11)
  reforzado por un script que hace el trabajo pesado de recolección, no por un bloqueo.
  **Contenido del handoff, siguiendo el principio robado:** NO repite lo que PLAN.md/
  LEDGER.md/commits ya capturan de forma durable — solo el estado en vuelo: el ítem
  declarado en `.orchestos/active-item.json` (scope-lock de H.4.1) si quedó sin cerrar,
  `git status --porcelain` (cambios sin commitear), y los próximos ítems abiertos leídos de
  `.orchestos/feature-status.json` (H.3.1) — las tres piezas de Bloque H encadenadas, cero
  información nueva que mantener en paralelo. `docs/agent-work-protocol.md` § paso 1 ahora
  lee `.orchestos/handoff.md` primero si existe (cierra el círculo clock-in↔clock-out).
  **Evidencia:** `scripts/handoff.ts` (lógica pura: `gitBranch`, `uncommittedPaths`,
  `renderHandoff`) con `scripts/handoff.test.ts` (8 tests, 100% funcs/líneas).
  `scripts/agent-handoff.ts` (CLI wrapper, `bun run agent:handoff`). Corrido en vivo contra
  este mismo repo: generó `.orchestos/handoff.md` real reflejando los 6 archivos sin
  commitear de esta sesión y los 7 ítems abiertos reales (H.4.2, H.5, UI.3.5, UI.4, UI.5,
  UI.6, UI.7) truncados a 5 con aviso de "+2 más". `bunx tsc --noEmit` ✅ · `bun test` ✅
  (1199 pass / 0 fail, 2893 expects, 124 archivos) · `bun run lint` ✅ exit 0.

<a id="bloque-h-h-5-1"></a>
### H.5.1 — ⚡ Andamiaje de evals: schema + verificador de tasks (cero costo de LLM).
  (cerrado 2026-09-01)
  Es la mitad mecánica y **no ejecuta ni un solo trial contra un modelo** — por diseño, para
  que se pueda construir sin gastar. Alcance exacto:
  1. **Directorio `evals/`** en la raíz, nuevo. **NO usar `tasks.yaml`**: ese archivo son
     fixtures de demo del harness (ya declarado en H.6), no el banco de evals.
  2. **`EvalTask`** (archivo nuevo `src/evals/schema.ts`): reusa `Task` de
     `src/tasks/schema.ts` — no duplicar campos — y agrega:
     `reference_solution: Record<string, string>` (path relativo → contenido exacto del
     archivo que resuelve la task) y `origin: string` (de qué fallo real sale, con la ruta
     `docs/done/sprint-NN.md` o `LEDGER.md` de donde se derivó). Validador al estilo de
     `validateSkill`/`src/tasks/schema.ts`: `reference_solution` no vacío, sus paths ⊆
     `output`, y `checks` no vacío (una eval sin grader no es una eval).
  3. **`scripts/eval-verify-task.ts`**: para cada eval de `evals/`, copia el proyecto base a
     un directorio temporal, **escribe la `reference_solution`** y corre sus `checks` con
     `runChecks(checks, projectRoot, logger)` de `src/run/checks.ts` (ya existe, firma
     verificada). Verde = la task es resoluble y el grader está bien calibrado. Rojo = la
     task o el grader están rotos y **no se debe gastar LLM en ella**. Este script es
     precisamente la defensa contra el anti-patrón "0% de pass@100 = task rota".
  4. **2–3 evals sembradas** derivadas de fallos **reales ya documentados** (hay material de
     sobra: 15 de los `docs/done/mes-*.md` mencionan regresiones/bugs reales). Elegir las que
     tengan un check determinista obvio; si una no se puede graduar con un comando de exit
     code, descartarla y elegir otra — no inventar un grader difuso.
  Fuera de alcance de H.5.1, explícito: correr trials, `pass^k`, persistencia de resultados,
  comparar configuraciones. Nada de eso se toca acá.
  Gate: `bun run eval:verify` en verde para las 2–3 sembradas + `bunx tsc --noEmit` +
  `bun run test:coverage` + tests propios del validador de `EvalTask`.
  **Evidencia:** `src/evals/schema.ts` extiende `Task` sin duplicarlo y falla cerrado ante
  `checks` ausentes/vacíos, `origin` vacío, solución vacía, paths inseguros o paths fuera de
  `output` (aplicación directa de `INS-2026-011`: un grader ausente nunca puede producir verde).
  `scripts/eval-verify-task.ts` copia cada proyecto base a un temporal, aplica la solución de
  referencia y reutiliza `runChecks`; `bun run eval:verify` ✅ para 3 fallos reales / 4 checks:
  sintaxis JS inline (Sprint 20), test vacuo sin assertions y conteo invertido de checks fallidos
  (Sprint 22). Los controles negativos fallan antes de aplicar la referencia; el test vacuo además
  demuestra que `bun test` solo sí daba un falso verde. Los tests negativos usan `.case.ts` y
  ruta explícita para que el banco no contamine el discovery de la suite principal. Cero trials,
  llamadas LLM, persistencia o comparación de configs. `bunx tsc --noEmit` ✅ · validador 7 pass /
  0 fail ✅ · `bun run test:coverage` ✅ (1206 pass / 0 fail; funciones 74.31%, líneas 62.82%).

<a id="bloque-h-h-5-2"></a>
### H.5.2 — ⚡ El runner de evals: la configuración como eje + baseline comparable.
  (cerrado 2026-09-02)
  Depende de H.5.1 (cerrado). **Era 🧠; pasó a ⚡ el 2026-09-02** porque la decisión de diseño
  —la única parte que requería criterio— ya está tomada y escrita abajo. Lo que queda es
  implementación mecánica: delegable a un modelo más barato (Sonnet/Codex), decisión de Carlos
  para cuidar cupo ([[feedback-cuidar-cupo-claude-delegar-codex]]).

  **DECISIÓN TOMADA — dónde vive el registro (NO re-litigar).** Tabla satélite `eval_trials`
  en SQLite con FK a `runs.id`. Se evaluaron tres caminos y se descartaron dos:
  - **Descartado — insertar el run y después borrar la fila de `runs`:** destruye evidencia de
    gasto **real** (los trials cuestan dinero; borrar hace imposible responder después "¿cuánto
    costó medir?"), y es frágil justo donde importa — si el proceso muere entre el insert y el
    delete (Ctrl-C a mitad de k trials es el caso normal, no el raro) queda basura en la tabla
    de producción. Contradice de frente la cultura del repo: `LEDGER.md`, `gate:evidence` y
    `run-evidence-gate.ts` existen todos para NO perder evidencia.
  - **Descartado — columna `is_eval` en `runs`:** obliga a guardar la semántica propia del eval
    (task, índice de trial, configuración medida, veredicto del grader) en archivos sueltos,
    partiendo la data entre SQLite y el filesystem, y contamina el schema de producción con
    columnas NULL en el 99.9% de las filas.
  - **Elegido — `eval_trials` con FK:** el run se inserta **normal** (cero cambios en
    `harness.ts`; costo, `file_diffs` y `qa_reason` quedan disponibles para investigar por qué
    falló un trial) y la semántica de eval vive aparte. Argumento decisivo: el producto de este
    ítem es **comparar configuraciones**, y eso es una consulta agregada — "pass^k de config X
    vs config Y sobre la task T" es una línea de SQL sobre una tabla, y un script que parsea
    directorios si fueran archivos JSON. Elegir archivos acá reintroduciría en la capa de
    medición exactamente el defecto que H.3.1 acaba de cerrar en la capa de estado.
    Precedente en el repo: `run_steps` ya es una tabla satélite de `runs` con el mismo patrón.

  **Alcance exacto:**
  1. **Migración** en `src/db/migrate.ts`, siguiendo el estilo ya presente ahí (`CREATE TABLE IF
     NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`, y el bloque de *ALTER TABLE guards* de la
     línea ~213 si hiciera falta evolucionarla después). Tabla `eval_trials`:
     `id` (PK autoincrement), `run_id TEXT NOT NULL REFERENCES runs(id)`, `eval_task_id TEXT NOT
     NULL`, `trial_index INTEGER NOT NULL`, `batch_id TEXT NOT NULL` (agrupa los k trials de una
     misma corrida), `config_json TEXT NOT NULL` (la configuración **exacta** bajo medición:
     modelo, `engine`, `skill`, `cli_effort`), `passed INTEGER NOT NULL` (veredicto del grader
     —los `checks` de la eval—, **distinto** de `qa_verdict`), `created_at TEXT NOT NULL`.
     Índice por `(eval_task_id, batch_id)`.
  2. **Excluir evals del dashboard de costos** en las 2 queries que hoy agregan sobre `runs` sin
     filtro — son exactamente estas, no hay más:
     `src/dashboard/handlers/usage.ts` (~línea 17, el `SELECT ... SUM(usd_cost) ... FROM runs
     WHERE created_at >= datetime('now','-400 days')`) y `src/dashboard/handlers/setup.ts`
     (~línea 298, `SELECT COALESCE(SUM(usd_cost),0) AS total FROM runs WHERE created_at >= ?`).
     Excluir con `LEFT JOIN eval_trials ON eval_trials.run_id = runs.id WHERE
     eval_trials.run_id IS NULL` (o `NOT EXISTS`). **Gate en vivo obligatorio** para estos dos
     archivos: son superficie de dashboard, el pre-commit lo exige (`agent:live-gate`).
  3. **`scripts/eval-run.ts`** — corre una eval k veces vía `runTask()` real y registra cada
     trial en `eval_trials`. Reporta **`pass^k`** (todos los k trials verdes, la cifra honesta)
     junto a `pass@k` (al menos uno), como pide la auditoría. El registro **se indexa por
     configuración**, no solo por task: dos corridas de la misma task con distinta config son
     dos mediciones comparables entre sí — esa comparación es el producto del ítem.
     Flags: `--task <id> --trials <k>` y overrides de configuración.
  4. **Aislamiento entre trials** — el anti-patrón "estado compartido entre runs" es real acá.
     `src/run/sandbox.ts` ya crea worktrees aislados por tarea: **verificar que aplica y
     reusarlo**, no reimplementar aislamiento.
  5. **Modo seco obligatorio** (`--dry-run`): `runTask()` ya soporta `dryRun` (construye el
     prompt y no llama al LLM, `harness.ts` ~línea 326). Es lo que permite probar todo el
     cableado —migración, inserción en `eval_trials`, cálculo de `pass^k`, exclusión del
     dashboard— **sin gastar un centavo**.

  **Fuera de alcance, explícito:** ejecutar la corrida pagada (eso es H.5.3, gated por Carlos).
  El script queda armado y probado **en seco**.
  Gate: `bunx tsc --noEmit` + `bun run test:coverage` + tests propios del cálculo de `pass^k`
  (función pura, sin DB) + `bun run db:migrate` sobre una DB existente sin pérdida de datos +
  **gate en vivo con navegador** para el cambio de las 2 queries del dashboard.
  **Evidencia:** migración numerada v3 crea `eval_trials` + FK a `runs.id` + índice
  `(eval_task_id, batch_id)`; ejecutada con `bun run db:migrate` sobre una DB preexistente y
  conservó el registro centinela `preserved`. `scripts/eval-run.ts` acepta `--task`, `--trials`,
  `--model`, `--engine`, `--skill`, `--cli-effort` y `--dry-run`; cada trial prepara una copia Git
  temporal y delega el aislamiento al worktree de `runTask()`. Gate seco real: 2 trials, 2 runs
  distintos con costo/tokens cero, 2 filas FK y configuración exacta; `pass^k=false`,
  `pass@k=false`, 0/2 sobre el fixture roto, sin llamada LLM. Los batches históricos se listan por
  configuración para comparación directa. Tests relevantes 17 pass / 0 fail; suite completa y
  cobertura: 1213 pass / 0 fail, funciones 74.15%, líneas 63.28%; `bunx tsc --noEmit` y lint ✅.
  **Gate en vivo:** navegador Chrome contra dashboard real + DB aislada con un run normal de $1.25
  y un eval de $99: Usage mostró $1.2500 / 1 run / solo `live-control-model`; Health mostró
  `Cost (7 days) $1.2500`; `/api/usage` confirmó `hasEvalModel=false`. Temporal eliminado.
  **Fuera de scope declarado:** ninguno. No se ejecutó ninguna corrida pagada; H.5.3 sigue gated
  por modelo y presupuesto elegidos por Carlos.

<a id="bloque-h-h-7-1"></a>
### H.7.1 — ⚡ `scripts/context-budget.ts`: medir el llenado de la ventana.
  (cerrado 2026-09-02)
  Módulo puro + CLI, sin efectos. Alcance exacto:
  1. `readTranscriptUsage(path)`: lee el JSONL, toma el **último** objeto con
     `message.usage`, devuelve `{ used, model }` con
     `used = input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
     Tolerar líneas corruptas (try/catch por línea) — un JSONL a medio escribir es normal.
  2. `contextWindowFor(model)`: resuelve la ventana vía `src/router/model-catalog.ts` (ya
     existe, `contextWindow` se usa en `src/providers/tool-call.ts` y `src/agents/planner.ts`).
     **Ojo con el gotcha ya documentado** ([[reference-model-catalog-cache-path-gotcha]]): el
     loader resuelve a `${ORCHESTOS_HOME}/.orchestos/cache/models.json`, no a
     `${ORCHESTOS_HOME}/cache/models.json`. Si el catálogo no conoce el modelo, devolver
     `null` y que el llamador falle **abierto y en silencio** (sin avisar), nunca inventar una
     ventana por defecto.
  3. `budgetStatus({used, window, thresholds})` → `{ pct, level: 'ok'|'warn'|'critical' }`
     con `warn` a 60% y `critical` a 75%, configurables.
  4. CLI `bun run context:budget -- --transcript <path>` que imprime JSON.
  Tests con fixtures de JSONL (líneas buenas, corruptas, sin `usage`, modelo desconocido).
  **Prohibido** en este ítem: tocar hooks, escribir en `.orchestos/`, o llamar a un LLM.
  Gate: `bunx tsc --noEmit` + `bun run test:coverage` (el comando **exacto** de CI, ver
  `CLAUDE.md` § "Verificar contra CI") + tests propios.
  **Evidencia:** `scripts/context-budget.ts` lee exclusivamente el último `message.usage`
  válido de JSONL y suma `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`;
  las líneas corruptas se ignoran. Aplica `INS-2026-016`: la ventana se toma solo del catálogo
  real en `${ORCHESTOS_HOME}/.orchestos/cache/models.json`; un modelo sin entrada conocida
  devuelve `window/pct/level: null`, sin fallback por familia ni red. `budgetStatus()` clasifica
  60% warn y 75% critical con thresholds configurables. `bun run context:budget -- --transcript
  scripts/fixtures/context-budget/usage.jsonl` ✅ emitió JSON con 84,360 tokens y modelo
  `claude-opus-5`; como no estaba en el catálogo local, devolvió null de forma abierta.
  Tests propios: 5 pass / 0 fail (última línea, corrupción, sin usage, catálogo conocido/desconocido,
  thresholds). `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1218 pass / 0 fail;
  funciones 74.22%, líneas 63.29%) · lint ✅. No se tocaron hooks, `.orchestos` ni proveedores LLM.
  **Fuera de scope declarado:** ninguno.
  **Ajuste H.7.3 (2026-09-02):** un transcript puede guardar el slug sin provider (p.ej.
  `claude-opus-5`) mientras el catálogo publicado usa `anthropic/claude-opus-5`. La resolución
  ahora admite ese slug solo si normalizado (`.`, `_`, `-`) coincide con **una única** entrada
  real del catálogo; match exacto gana, un ID ya calificado sigue exigiendo match exacto y cero o
  varias coincidencias devuelven `null`. Es general para cualquier CLI/proveedor, sin prefijos ni
  ventanas hardcodeadas.

<a id="bloque-h-h-7-2"></a>
### H.7.2 — ⚡ Handoff con la intención, no solo con el estado.
  Depende de H.7.1. Extiende `renderHandoff()` de `scripts/handoff.ts` (no lo reescribe) con
  una sección nueva **"De qué veníamos hablando"**: los últimos N (N=5) mensajes **del
  usuario** del transcript — no los del asistente: la intención vive en los prompts de Carlos,
  las respuestas del asistente son justamente lo que no queremos re-cargar. Truncar cada uno a
  ~400 caracteres. Respetar el principio ya citado en la cabecera del archivo (robado de
  `mattpocock/skills`): *no duplicar lo que ya está en PLAN.md/LEDGER.md/commits, referenciar
  por path*. El transcript no está en ningún otro artefacto, por eso sí entra.
  Gate: tests de `renderHandoff` con transcript fixture + `bun run test:coverage`.
  **Evidencia:** `readRecentUserMessages()` lee JSONL de forma tolerante a líneas truncadas,
  acepta texto y bloques `text`, filtra estrictamente `type/message.role = user`, normaliza
  whitespace, conserva los últimos 5 en orden y limita cada uno a 400 caracteres. `renderHandoff()`
  los muestra bajo **"De qué veníamos hablando"**; sin ruta o transcript, muestra el estado
  explícito sin inventar contenido. `agent:handoff -- --transcript <path>` cablea esa única
  fuente para el hook H.7.3. Fixture cubre mensaje excluido por antigüedad, respuesta de asistente,
  JSON inválido, bloques de texto y truncamiento. `bun test scripts/handoff.test.ts` ✅ (9 pass /
  0 fail) · `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1219 pass / 0 fail) ·
  `bun run agent:handoff -- --transcript
  scripts/fixtures/handoff/transcript.jsonl` ✅ (handoff con los cinco prompts esperados).
  **Fuera de scope declarado:** `runs-summary.json`, regenerado automáticamente por el hook
  pre-commit como reporte derivado; no cambia la lógica de H.7.2.

  **BUG-H.7.2-a (hallado 2026-09-03, CERRADO 2026-09-03).**
  `readRecentUserMessages()` filtra por `type/message.role = 'user'`, y eso **no distingue un
  prompt de Carlos de una inyección automática del sistema**. Evidencia concreta: en el handoff
  generado hoy, 1 de los 5 "últimos mensajes del usuario" era un bloque
  `<task-notification>…Background command completed…</task-notification>`. Doble daño: mete ruido
  en la única sección del handoff cuyo valor es la **intención humana**, y **desplaza** un mensaje
  real de Carlos fuera de la ventana de 5.
  Fix en `scripts/handoff.ts` (`transcriptUserMessage`): descarta el mensaje normalizado si
  empieza por `<task-notification`, `<system-reminder`, `<local-command-` o `<knowledge-radar`,
  **antes** del `slice(-5)` — así una inyección nunca desplaza un prompt humano fuera de la
  ventana, sin importar dónde caiga en el transcript. Test de fixture
  (`scripts/handoff.test.ts`, `scripts/fixtures/handoff/transcript.jsonl`): se insertó una línea
  `<task-notification>` entre dos prompts humanos reales y se verificó que (1) no aparece en el
  resultado y (2) los 5 prompts humanos conservan su orden cronológico intacto. 10/10 tests
  pasan, `tsc --noEmit` limpio.

<a id="bloque-h-h-7-2b"></a>
### H.7.2b — 🧠 Reabrir la fuente del número: registro de adaptadores por CLI.
  (cerrado 2026-09-03)
  **Reapertura autorizada por Carlos el 2026-09-03** tras la investigación de precedente (ver
  § "Investigación de precedente" al final de este bloque, puntos 3 y 6): *"no importa si se
  reabre, desde el inicio debemos hacer las cosas bien hechas"*. No invalida H.7.1/H.7.2 — su
  código se conserva y se degrada a **un adaptador entre otros**.

  **El defecto que corrige.** H.7.1 calcula el % de una sola manera —parsear el JSONL de Claude
  Code y sumar `input + cache_creation + cache_read` sobre la ventana del catálogo— y esa forma
  quedó implícitamente atada a un proveedor. Viola [[feedback-deteccion-generica-no-por-cli]]
  ampliada: *las soluciones se hacen para los LLMs que vengan, no una por modelo*.

  **Alcance:**
  1. **Registro extensible** `{ id, detect, read }[]` con una función genérica que devuelve
     siempre `{ used, window, pct, level, source }` normalizado. Agregar un CLI nuevo = **una
     entrada de datos**, no código nuevo. Mismo patrón que el registro de detección de binarios
     de G.4.2 y que `CLI_EFFORT_LEVELS` de H.8.1 — no inventar uno distinto.
  2. **Adaptador `claude`**: parseo del transcript JSONL — el código que ya escribió H.7.1,
     movido detrás de la interfaz del registro. `message.usage.{input,cache_creation,cache_read}`
     sumados, ventana resuelta por catálogo (el transcript de Claude **no** la trae).

     **PUENTE STATUSLINE — DESCARTADO el 2026-09-03, decisión de Claude, con evidencia.** Lo
     propuse yo en el punto 3 de la investigación y lo retiro tras verificar la máquina:
     el slot `statusLine` de `~/.claude/settings.json:171` **ya está ocupado por Orca**
     (`~/.orca/agent-hooks/claude-statusline.sh`, instalado el 27-jul-2026, software de
     terceros que consume stdin completo y postea a un endpoint local). Tres razones para
     descartarlo, en orden de peso: (a) sustituirlo rompe una herramienta que Carlos usa, y
     encadenarlo obliga a envolver un script ajeno y re-alimentarle stdin —frágil y fuera del
     control del repo—; (b) el statusline **solo existe en Claude Code**: es exactamente la
     clase de atajo por-proveedor que la regla de este bloque prohíbe; (c) la ganancia
     (237 ms → ~2 ms por turno) es real pero no compensa (a)+(b). Si algún día el slot queda
     libre, entra como una fuente más dentro de este adaptador, sin tocar el registro.
  3. **Adaptador `codex` — contrato VERIFICADO EN VIVO el 2026-09-03**, no tomado del issue.
     Sobre `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (128 sesiones en esta máquina), el
     evento `payload.type === 'token_count'` trae:
     `payload.info.last_token_usage.total_tokens` (= 158.198 en la sesión medida) y
     `payload.info.model_context_window` (= 258.400) → 61,2%. **Ojo:** el campo correcto es
     `last_token_usage`, **no** `total_token_usage` — ese último es el acumulado de la sesión
     entera (5.847.113 tokens, 22× la ventana) y usarlo daría un porcentaje absurdo. El issue
     #17618 hablaba de `token_count`: ese es el **nombre del evento**, no del campo. Bonus del
     mismo payload: `payload.rate_limits.primary.used_percent` (45%, ventana de 10.080 min = el
     cupo semanal de Codex que Carlos hoy vigila a mano).

     **Esta asimetría es la prueba de que el registro hace falta:** Claude arma el `used` sumando
     tres campos y resuelve la ventana por catálogo; Codex lo trae ya sumado y publica su propia
     ventana. Dos cálculos distintos, un `{used, window, pct, level, source}` idéntico.
  4. **Umbrales como dato del registro, no constantes**: `warn` 60% / `critical` **65%**
     (decisión de Carlos, ver punto 6 de la investigación). Un CLI con otra ventana o otro
     comportamiento de compactación puede traer los suyos.
  5. **`opencode` fuera de scope explícito**: sin contrato de contexto verificado.

  Gate 🔍: el mismo hook, sin cambios en su interfaz, produce el número correcto con **dos**
  adaptadores distintos — y el test lo demuestra con un tercero falso inyectado (el registro es
  extensible de verdad, no dos `if`). Más `bunx tsc --noEmit` + `bun run test:coverage`.

  **Evidencia (2026-09-03).** `scripts/context-adapters.ts` nuevo: interfaz `ContextAdapter
  { id, thresholds, read }`, `DEFAULT_ADAPTERS = [claudeAdapter, codexAdapter]` y
  `readContextBudget(path, adapters?)` → `{used, window, model, pct, level, source}`. La
  detección es por contenido (`read()` devuelve `null` si el transcript no es suyo), nunca por
  ruta. `scripts/context-budget.ts` conserva `budgetStatus`/`contextWindowFor` y su `main` ya no
  sabe qué CLI escribió el transcript: delega en el registro.

  **Gate 🔍 corrido en vivo, con transcripts reales de las dos máquinas de trabajo — el mismo
  binario del hook, sin recompilar ni reconfigurar nada entre corridas:**

  | Transcript real | `source` | used / window | pct | level |
  |---|---|---|---|---|
  | Claude Code (`b1bb946b…`) | `claude` | 719.355 / 1.000.000 (catálogo) | 71,9% | critical |
  | Codex CLI (`rollout-2026-08-24…`) | `codex` | 158.198 / 258.400 (del transcript) | 61,2% | warn |

  Salida literal del hook con el transcript de Codex: `Contexto alto: 61,2% (codex). / Ventana:
  258.400 tokens.` — **la asimetría es el punto**: Claude resuelve la ventana por catálogo porque
  su transcript no la publica; Codex la trae en el propio archivo. Dos cálculos distintos, una
  salida idéntica.

  **BUG-H.7.3-a arreglado y verificado en vivo:** `warn` turno 1 → avisa; turno 2 misma sesión →
  **silencio**; `critical` → avisa en los dos turnos. El guard de `sessionId` ahora cubre también
  `printWarning`, no solo la escritura del handoff.

  **BUG-H.7.3-b cerrado:** el hook ya tiene test propio (`scripts/context-budget-hook.test.ts`,
  6 casos, invoca el proceso real por stdin con `.orchestos/` redirigido a un temporal).

  **Delegación:** los tests fueron escritos por **Codex** (⚡, mecánico y especificado) mientras
  Claude hizo el diseño del registro y los adaptadores — 19 tests nuevos entre
  `context-adapters.test.ts` (13, incluido el tercer adaptador falso inyectado que exige el gate,
  el que lanza, y los bordes exactos 59,9/60/65) y `context-budget-hook.test.ts` (6).

  **Corrección al reporte de Codex, verificada:** Codex reportó `1234 pass / 1 fail` y atribuyó
  el fallo a un "bug de producción en `startServer(0)`" de
  `src/dashboard/__tests__/csrf-origin.test.ts`. **Es falso.** Ese test aislado da 8 pass / 0
  fail, y el comando exacto de CI da **1235 pass / 0 fail** (funciones 74,37% ≥ 69%, líneas
  63,47% ≥ 57%). La causa real era su entorno: quedaron dos dashboards escuchando (`bun run
  src/cli.ts dashboard --port 4739` y `--port 4740`). No se tocó `server.ts`. Sirve de recordatorio
  de [[feedback-verificar-progreso-delegado]]: un diagnóstico de un agente delegado se comprueba
  antes de anotarlo como hallazgo del repo.

  **Hueco declarado, no disimulado:** ningún test nuevo ejercita el **camino feliz** de
  `claudeAdapter.read()` — requiere sembrar el catálogo de modelos en un `ORCHESTOS_HOME`
  temporal. Sus dos piezas (`readTranscriptUsage` y `contextWindowFor`) sí están cubiertas por
  `scripts/context-budget.test.ts` de H.7.1, y el camino completo se verificó en vivo (fila
  `claude` de la tabla de arriba), pero no hay test automatizado de la composición.

  **Fuera de scope declarado:** el puente statusline (descartado con razón, alcance 2);
  `opencode`; el eje B (contexto de las corridas del harness, que ya tiene sus tokens en la tabla
  `runs`).

> **BLOQUEADOR encontrado implementando H.7.3, sin resolver (2026-09-02, Codex).** No
> implementar H.7.3 hasta que esto se cierre — es 🧠, no delegable sin la decisión de abajo.
>
> **El hecho verificado:** Claude Code escribe `message.model: "claude-opus-5"` en el
> transcript (sin proveedor). `model-catalog.ts` es un `Map<string, ModelInfo>` con **match
> exacto** contra IDs de OpenRouter, que publica `anthropic/claude-opus-5` (con prefijo).
> `contextWindowFor("claude-opus-5")` → `null` siempre. H.7.1 cerró con evidencia de esto
> mismo (`bun run context:budget` sobre el fixture real dio `null` por modelo no encontrado)
> pero se aceptó como "modelo desconocido" genérico — en la práctica **es el caso normal**, no
> el raro: pasa con el modelo real de Claude Code en el 100% de las sesiones. H.7.3 nunca
> avisaría ni con un transcript real al 73-77% (medido dos veces esta sesión).
>
> **Rechazado explícitamente por Carlos:** un parche `claude-* → anthropic/claude-*`
> hardcodeado. Motivo textual: *"que pasa si es otro LLM, no quiero enfocarme solo en OpenAI
> o Anthropic, debe ser una solución general"*. Codex propuso en su lugar, y Carlos no lo
> aprobó todavía (queda para la próxima sesión):
> 1. Match exacto del ID del transcript contra el catálogo (caso feliz, ya existe).
> 2. Si no hay match: comparar el nombre **sin proveedor**, normalizado, contra el **último
>    segmento** de cada ID publicado (`anthropic/claude-opus-5` → `claude-opus-5`).
> 3. Aceptar solo si hay **exactamente una** coincidencia; cero o más de una → `null`, mismo
>    fail-open ya establecido en H.7.1. Nunca una tabla de alias por marca — el catálogo de
>    OpenRouter (~300+ modelos de todos los proveedores) sigue siendo la única fuente.
>
> **Precedente que Carlos recordó y se investigó — no aplica, se descarta explícitamente.**
> Memoria `reference-model-combo-pattern.md` (`buildModelSelect()` en `app.js`): resuelve un
> problema de **UI** (combobox buscable de modelos en el dashboard/chat), no de **resolución
> de IDs entre lo que un CLI reporta y lo que un catálogo externo publica**. Sin código
> reusable de ahí para esto.
>
> **Por qué queda 🧠 y no se implementa ya:** falta decidir el caso ambiguo real — si el
> catálogo publica el mismo nombre de modelo bajo dos proveedores a la vez (ej.
> `openai/gpt-5.6-sol` y `otro-proveedor/gpt-5.6-sol`), la regla de match único da `null` para
> **ambos**, siempre, en cualquier sesión que use ese nombre — no es un edge case raro, es
> estructural. Decidir si ese fail-open es aceptable (probablemente sí, coherente con el resto
> de H.7) o si hace falta una señal de desempate, antes de que Codex/DeepSeek lo codeen.
>
> Gate cuando se cierre: fixture de catálogo con `claude-opus-5` bajo un solo proveedor (match
> único, resuelve) + fixture con el mismo nombre bajo dos proveedores (match ambiguo, `null`).

> **RESUELTO 2026-09-02 (GO de Carlos).** Se investigó si `models.dev` (agregador de 212
> providers) resolvía el caso ambiguo mejor que OpenRouter. Verificado contra el JSON real de
> ambos catálogos (no contra resúmenes de WebFetch, que se contradijeron entre sí):
> - OpenRouter real (421 modelos, el catálogo que ya usa `model-catalog.ts`): **0 colisiones**
>   de "mismo slug sin proveedor bajo dos autores". `claude-opus-5` solo existe como
>   `anthropic/claude-opus-5` (+ `:batch`). El caso ambiguo es teórico hoy, no real.
> - `models.dev` (212 providers agregados): **543 colisiones** de ese tipo — agregar más
>   routers multiplica la ambigüedad, no la resuelve. Sin campo de desambiguación canónico
>   verificable en el JSON crudo. Descartado: no aporta nada y es un cambio de fuente de
>   verdad no pedido.
> **Decisión final:** implementar la propuesta de Codex tal cual — (1) match exacto, (2) si
> no hay match, comparar nombre sin proveedor contra el último segmento de cada ID publicado,
> (3) aceptar solo si hay exactamente una coincidencia; cero o más de una → `null` (mismo
> fail-open de H.7.1). Sin tabla de alias por marca. H.7.3 queda desbloqueado.

<a id="bloque-h-h-7-4"></a>
### H.7.4 — ⚡ `SessionStart`: reanudar sin volver a explicar.
 (cerrado 2026-09-03)
  Depende de H.7.3. Hook `SessionStart` que, si `.orchestos/handoff.md` existe y su `mtime`
  es de menos de 24h, lo inyecta vía `hookSpecificOutput.additionalContext`. Una sola vez por
  sesión, por definición del evento. Si el archivo es más viejo que 24h: no inyectar (estado
  rancio confunde más de lo que ayuda) pero sí imprimir una línea diciendo que existe.
  Este es el ítem que cumple el pedido textual de Carlos: *"si cierro el tab, continuar donde
  me quedé sin que tenga que explicar qué estaba haciendo"*.
  Gate 🔍: abrir un tab nuevo y verificar que el asistente arranca sabiendo el ítem activo sin
  que Carlos escriba contexto.

  **Fuera de scope declarado:** este commit también cierra BUG-H.7.2-a
  (`scripts/handoff.ts`, `scripts/handoff.test.ts`, `scripts/fixtures/handoff/transcript.jsonl`)
  y regenera `.orchestos/feature-status.json` — el scope-lock original solo cubría el hook de
  H.7.4. Se agrupó en el mismo commit por ser el primer ítem abierto de la sesión y tocar el
  mismo archivo `handoff.ts` que ya estaba en juego; no hay riesgo de mezclar trabajo de otro
  agente.

  **Gate 🔍 cerrado 2026-09-03 — tab nuevo real.** Esta misma sesión: al abrirla, el hook
  `SessionStart` inyectó el handoff completo (ítem activo `H.7.4`, working tree, próximos
  ítems) sin que Carlos escribiera contexto — el turno arrancó ya sabiendo por dónde retomar.
  Evidencia es la propia sesión, no un mock.
  `.claude/hooks/session-resume.js` (Node, sin dependencias), registrado en el `settings.json`
  del proyecto con `matcher: "startup|resume|clear|compact"` y timeout 5. Contrato **verificado
  contra la doc oficial**, no supuesto: la salida es
  `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}`. Dato que el
  spec no contemplaba y la doc sí: `SessionStart` acepta además un matcher `fork` (queda fuera a
  propósito — una sesión forkeada ya hereda el contexto) y es uno de los pocos eventos donde el
  **stdout en texto plano también entra como contexto**, así que todo lo que el hook imprima
  cuesta tokens; por eso el camino silencioso es el default.

  Cuatro caminos verificados en vivo: handoff fresco → JSON válido con `additionalContext` de
  1.667 chars; handoff de 30 h → **una línea** de texto, sin inyectar; handoff ausente →
  silencio y exit 0; handoff degenerado de 20.000 chars → truncado a 8.193 con marca explícita
  (`MAX_CONTEXT_CHARS = 8.000`, ~2.000 tokens: un handoff que crece sin control sería un
  impuesto fijo sobre cada sesión nueva).

  **HALLAZGO — `active-item.json` podía mentirle al handoff (arreglado acá).** `--item` y
  `--scope` de `agent:preflight` eran independientes: sin `--scope`, el preflight validaba un
  ítem y dejaba **otro** declarado en `.orchestos/active-item.json`, en silencio. Era cosmético
  hasta hoy; con H.7.4 deja de serlo, porque ese archivo alimenta el handoff que el hook inyecta
  en **cada sesión nueva** — el asistente arrancaría afirmando un ítem activo equivocado, que es
  peor que no inyectar nada. Caso real y concreto: el preflight de H.7.4 corrió con `H.7.3`
  declarado del día anterior, y el handoff decía *"H.7.3 — retomar desde acá"*.
  Fix mínimo en `scripts/agent-preflight.ts`: si el ítem declarado no coincide con `--item`,
  **avisa** (no corrige solo — declarar scope es un acto deliberado del agente, no un efecto
  secundario). Fuera del scope literal de H.7.4, incluido porque sin esto la feature entrega
  información falsa, que es exactamente la "interfaz que no aporta" de la Regla Cero.

  **Delegación:** test por **Codex** — `scripts/session-resume-hook.test.ts`, 7 casos sobre el
  proceso real con copia aislada del hook en un tmpdir (no toca el handoff del repo): fresco,
  rancio, ausente, vacío, truncamiento y JSON estricto con `\n` escapados.

  **Corrección al reporte de Codex, verificada (2ª vez en el bloque).** Reportó `tsc` roto en
  `scripts/agent-preflight.ts:87` y `1120 pass / 126 fail`. Ambos son artefactos de haber corrido
  su gate **mientras Claude editaba esos mismos archivos en paralelo**. Corrida limpia posterior:
  `bunx tsc --noEmit` limpio y **1242 pass / 0 fail** (funciones 74,37%, líneas 63,47%).
  **Regla operativa que sale de acá:** no lanzar a Codex a correr `test:coverage` sobre archivos
  que Claude está editando en el mismo momento — su reporte de fallos no es utilizable. O se
  serializa, o se le acota el gate a los archivos que él creó.

<a id="bloque-h-h-7-5"></a>
### H.7.5 — ⚡ Superficie en el dashboard.
  Depende de **H.7.2b** (no de H.7.1 a secas: la pantalla debe mostrar el `source` del
  adaptador, para que se vea de qué CLI viene el número y no se lea como "el % de Claude").
  Indicador del % de contexto de la sesión activa en el dashboard, no solo
  en el CLI ([[feedback-dashboard-no-solo-cli]]): comando + endpoint + pantalla, las tres
  piezas o no cuenta. Reusar los componentes React del design system del Sprint 30 — no
  inventar un componente nuevo ([[reference-design-system-orchestos]]).
  Gate 🔍: dashboard real corriendo, con el número cambiando entre dos turnos. Y **bajar el
  servidor al terminar** ([[feedback-siempre-cerrar-servidor]]).

  **Ampliación pedida por Carlos (2026-09-03, tras la aclaración de Orca arriba).** No basta con
  el % de contexto: quiere una **barra permanente en la parte inferior del UI**, siempre visible
  (no una card del home — ya está resuelta esa decisión en `UI.8.5` §A.5/§C.2, tomado del layout
  real de Orca — capturas de referencia en `~/Documents/screens/Orca_stats.png` y
  `Orca_general.png`), mostrando **los dos ejes a la vez**: % de ventana de contexto de la sesión
  (H.7.1/H.7.2b) **y** % de cupo/rate-limit de la cuenta (el número que realmente vio en Orca y
  confundió con contexto — ver aclaración arriba en H.7.3). Carlos fue textual en que el pedido
  anterior era sobre lo primero y esto es una ampliación explícita, no una corrección de rumbo.

  **Decisión de arquitectura cerrada (2026-09-03).** `ContextAdapter` puede exponer, además del
  contexto, cero o más ventanas normalizadas de rate-limit mediante
  `readRateLimits(): RateLimitWindow[]`, con contrato `{ id, usedPct, windowMinutes, resetsAt }`.
  `SessionMetrics` mantiene los ejes separados (`context` y `rateLimits`): ausencia es `null`,
  nunca `0` ni una estimación. Codex obtiene ambos del transcript; Claude conserva contexto desde
  transcript y reporta cupo no disponible porque hoy ese dato solo llega por el statusline global
  que ya consume Orca. OrchestOS no modifica Orca ni se acopla a su endpoint privado. Esta decisión
  aplica el insight `INS-2026-016` del vault: ventana de contexto y cupo de cuenta son variables
  distintas y no deben presentarse como si una pudiera inferirse de la otra.

  La sesión se descubre por proyecto entre transcripts de Claude y Codex, validando el `cwd` de
  Codex; `ORCHESTOS_SESSION_TRANSCRIPT`/`--transcript` permite una fuente explícita para gates. Ni
  el endpoint ni la pantalla exponen la ruta o contenido del transcript. El comando
  `bun run context:status -- --project .`, `GET /api/session/status` y la barra React permanente
  de 32 px comparten el mismo resultado normalizado. La barra reutiliza tokens y tipografía del
  design system existente, muestra contexto, todas las ventanas de cupo, fuente y hora observada,
  y refresca cada 5 s; solo el contexto usa color semántico por umbral.

  **Evidencia automatizada:** 17/17 tests relevantes (`context-adapters`, `session-status` y
  handler HTTP), `bunx tsc --noEmit` y `bun run build:ui` limpios. `bun run security:gate`:
  **1250 pass / 0 fail**, funciones 77,59%, líneas 76,71% y audit high+ sin vulnerabilidades.
  El gate destapó que el override previo `fast-uri@3.1.5` acababa de entrar en cuatro advisories;
  se elevó al parche `3.1.6` en `package.json`/`bun.lock`, sin otros cambios de resolución.

  **Gate en vivo:** dashboard real abierto en el navegador Chrome con DevTools en
  `localhost:4742`; dos turnos de observación mostraron `Context 79%` → `80,4%` → `80,8%`, con
  cupos Codex `5h 55→57%` y `7d 39%`.
  Todos los polls a `/api/session/status` respondieron 200, consola sin errores/avisos, barra al
  borde inferior con 32 px exactos y viewport móvil sin overflow horizontal. Se cerró la pestaña,
  se bajó el servidor y `curl` confirmó que el puerto 4742 dejó de responder.

  **Fuera de scope declarado:** `.orchestos/feature-status.json`, regenerado y staged
  automáticamente por el pre-commit al cerrar H.7.5 en `PLAN.md`; no contiene lógica manual.

<a id="bloque-h-h-7-5a"></a>
### H.7.5a — 🧠 Corrección multi-CLI y paridad de métricas.
 (GO explícito de Carlos,
  2026-09-03; solo registrado, implementación pendiente)
  H.7.5 quedó funcional pero tiene dos defectos comprobados. `readActiveSessionStatus()` devuelve
  el primer transcript válido ordenado por mtime, por lo que oculta los demás CLIs: en esta máquina
  había sesiones reales recientes de Codex (58,95% de contexto usado) y Claude (14,24%). Además,
  el transcript de Codex mostraba snapshots de cupo 79%/43% usados, mientras una lectura viva del
  mismo app-server (`account/rateLimits/read`) devolvió 86%/44% usados. La interfaz oficial de
  Codex presenta el complemento —14%/56% restantes—, no `usedPercent` crudo. La fuente primaria y
  el detalle de esta asimetría están en el [app-server oficial](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
  y el [status line oficial](https://github.com/openai/codex/blob/main/codex-rs/tui/src/bottom_pane/status_line_setup.rs).

  **Alcance decidido:** devolver una colección, un elemento por CLI instalado conocido, reutilizando
  `KNOWN_CLIS`; cada elemento muestra icono + barra + porcentaje restante, y un popover Radix al
  hacer clic con contexto, tokens, modelo, cupos, resets, fuente y antigüedad. Un CLI instalado sin
  adaptador verificable aparece como no disponible, nunca con un número inventado. Codex debe leer
  cupos en vivo mediante `account/rateLimits/read`, con cache breve, proceso fijo sin shell,
  argumentos no controlables por el usuario, timeout y salida acotada; esto aplica el límite de
  herramientas de `INS-2026-014`. El rail conserva sus 32 px y tokens actuales. Xirp/Orca, git
  status, graph, worktrees y conversaciones de agentes quedan fuera: son superficies posteriores
  de UI.8, no dependencias privadas de esta métrica.

  **Gate pendiente:** tests de contrato y seguridad, typecheck, y dashboard real en navegador con
  Codex + Claude visibles, popover accionable, números restantes coincidentes con la lectura viva,
  responsive sin overflow y servidor detenido al terminar.

  **Evidencia de cierre (2026-09-03):** `bun test scripts/context-adapters.test.ts
  scripts/session-status.test.ts src/dashboard/__tests__/session-status.test.ts` → 17 pass;
  `bun run build:ui` y `bunx tsc --noEmit` → pass. Dashboard real en `http://localhost:4242/`
  verificado con navegador: cuatro CLI visibles (Claude, Codex, opencode, Kimi), popover de
  Codex accionable con contexto/tokens/cupos/resets, cupos vivos 97% y 54% restantes, consola
  sin errores; viewport 390px → `scrollWidth=390` sin overflow. Servidor detenido al terminar.
  **Gate en vivo:** navegador Chrome DevTools sobre dashboard real (no mock).

#### Investigación de precedente — H.7 no es original, y eso cambia dos decisiones (2026-09-03)

Pedido explícito de Carlos antes de seguir: *"¿alguien ya resolvió esto o qué implica para un
sistema así?"* ([[feedback-investigar-antes-de-refutar]]). Buscado en la doc oficial, el issue
tracker de `anthropics/claude-code` y GitHub. **Conclusión: el problema es real y está bien
identificado, pero la fuente del número que usa H.7.1 es la equivocada.**

**1. El problema es real y masivamente reportado.** Al menos 4 issues abiertos en
`anthropics/claude-code` piden exactamente esto — #27969 ("Expose context window usage
percentage to hooks", **cerrada como duplicada**, sin implementación ni fecha), #25689
("Context usage threshold hook event"), #16988, #32062 — y ≥5 proyectos de terceros lo
implementan por fuera (`who96/claude-code-context-handoff`, `Sonovore/claude-code-handoff`,
`REMvisual/claude-handoff`, `u-ichi/compact-plus`, `thepushkarp/handoff`). H.7 no es
sobreingeniería: es un hueco conocido de la plataforma.

**2. Diferencia deliberada con el precedente: casi todos se enganchan a `PreCompact`** — es
decir, *aceptan* la compactación y la sobreviven. El diseño de Carlos la **rechaza** y corta a
tab nuevo ([[feedback-no-compactar-contexto]]). Es minoría, pero es una postura coherente, no un
descuido: la compactación conserva objetivos y rutas y pierde los snippets exactos, las cadenas
de razonamiento y los mensajes de error concretos.

**3. HALLAZGO QUE INVALIDA LA FUENTE DE H.7.1 — el número ya existe, oficial y gratis.**
Claude Code **ya publica** el uso de contexto, pero **solo al statusline**, no a los hooks
(doc oficial `code.claude.com/docs/en/statusline`, tabla de campos de stdin):
`context_window.used_percentage`, `context_window.remaining_percentage`,
`context_window.context_window_size`, `context_window.total_input_tokens`,
`exceeds_200k_tokens`. `UserPromptSubmit` recibe solo `session_id`, `prompt_id`,
`transcript_path`, `cwd`, `permission_mode` — **sin tokens** (por eso existe #27969).

H.7.1 resolvió esa falta **recalculando** el porcentaje a mano desde el JSONL
(`input + cache_creation + cache_read` ÷ ventana del catálogo). La solución que usa el
precedente es un **puente statusline → archivo → hook**: el statusline (que sí recibe el
número) escribe un `context-{session_id}.json` de ~100 bytes y el `UserPromptSubmit` lo lee.
Tres ventajas concretas y medibles sobre lo que hay hoy:
- Es el número **oficial**, el mismo con el que Claude Code decide compactar. El de OrchestOS es
  un número propio que **puede no coincidir** — y si subestima, el aviso llega tarde.
- **Costo por turno**: el hook actual tarda **237 ms** medidos (spawnea `bun` y parsea un JSONL
  que en este repo llega a **15 MB**). Leer un JSON de 100 bytes son ~2 ms.
- Vienen gratis, en el mismo payload, tres cosas que hoy OrchestOS no tiene y le importan:
  `cost.total_cost_usd`, `rate_limits.five_hour/seven_day.used_percentage` (el cupo semanal que
  Carlos vigila a mano, [[feedback-cuidar-cupo-claude-delegar-codex]]) y `prompt_cache.warm` —
  evidencia directa y en vivo de `INS-2026-016`, el cache que se invalida al cambiar de modelo.

**4. HALLAZGO QUE INVALIDA EL UMBRAL `critical` DE 75%.** El autocompact de Claude Code dispara
a **~78%** y el override no lo sube (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` topa en ~83%);
`autoCompact: false` además es **ignorado** en la práctica (issue #18264). O sea: `critical` en
75% deja **3 puntos porcentuales** de margen. Un solo turno que lea un archivo grande salta de
"todavía no avisó" a "ya compactó" sin que Carlos llegue a ver el aviso — el escenario exacto
que H.7 existe para evitar. El `warn` de 60% **sí** está bien calibrado (coincide con el
precedente de la industria). Propuesta: bajar `critical` a ~70%.

**5. Límite honesto que ningún hook resuelve, y que conviene no prometer.** El aviso es texto
inyectado: el modelo puede ignorarlo, y el autor del precedente más cercano lo admite por
escrito ("no hay garantía de que Claude siga estas instrucciones"). Lo único **mecánico** de
todo H.7 es el handoff escrito por script (H.7.2) — esa es la pieza que de verdad vale, y es la
que ya está cerrada.

**6. CORRECCIÓN DE MI PROPIA PROPUESTA — decisión de Carlos, 2026-09-03.** Lo que propuse en el
punto 3 ("usar el puente statusline") estaba **mal como arquitectura**: el statusline es una
feature **exclusiva de Claude Code**. Carlos lo cortó, textual: *"esto no solo debe aplicar a
Claude sino a cualquier modelo; las soluciones que hacemos no las hacemos una por modelo sino
para los LLMs que vengan"* — es la misma regla de [[feedback-deteccion-generica-no-por-cli]],
ampliada de la detección de binarios a **todo el sistema**. Y: *"no importa si se reabre, desde
el inicio debemos hacer las cosas bien hechas"* → **GO explícito para reabrir H.7.1.**

Verificado que la generalización es real y no una analogía: **Codex CLI también escribe su
contabilidad en su propio session JSONL** — `token_count` y `model_context_window`, confirmado
en `openai/codex` issue #17618 (el indicador "XX% left" dejó de renderizarse en el TUI *aunque
los campos siguen presentes en el JSONL*). Codex además tiene `/status` para la sesión actual.
El patrón "cada CLI lleva su propia contabilidad de contexto en su transcript, con nombres
distintos" es un hecho de los dos CLIs que OrchestOS ya soporta, no una suposición.

**Forma correcta: registro de adaptadores, no un camino por CLI.** Una función genérica
`readContextBudget(cli)` sobre un registro `{ id, detect, read }[]` que devuelve siempre
`{ used, window, pct, level, source }` normalizado. Agregar un CLI nuevo (Kimi, opencode, el que
venga) debe ser **una entrada de datos**, no código nuevo. Dentro del adaptador de Claude Code,
el puente statusline pasa a ser una **fuente preferida** (más barata y oficial) con el parseo de
JSONL de H.7.1 como *fallback* — el trabajo de H.7.1 no se tira, se degrada a un adaptador entre
otros. Los CLIs sin contrato verificado **no se fingen soportados**: quedan fuera del registro
hasta comprobarlos, mismo criterio que `opencode` en H.8.1.

**Dos ejes distintos que este bloque NO debe confundir:**
- **Eje A — la sesión interactiva de Carlos** con un CLI agente (hoy Claude Code, mañana otro).
  Es lo que H.7 mide y avisa. Es donde aplica el registro de adaptadores.
- **Eje B — las corridas del harness** (`runTask()` → `external`/`codex`/`opencode`). Ahí
  OrchestOS **ya** conoce los tokens: los registra en la tabla `runs`. No necesita adaptadores;
  necesita, si acaso, usar ese dato. Fuera de alcance de H.7 salvo que Carlos lo pida.

**Umbrales, decisión de Carlos (2026-09-03): `warn` 60%, `critical` 65%.** El 65% reemplaza al
75% original y a mi propuesta de 70%. Razón: el autocompact dispara a ~78% y no se puede
desactivar de forma fiable (#18264), así que el margen debe absorber al menos un turno pesado
completo. Estos números pasan a ser **datos del registro**, no constantes de Claude: un CLI con
ventana o comportamiento de compactación distinto puede traer los suyos.

**Nota para quien ejecute H.7 (Codex o modelo económico).** H.7.2b es 🧠 (decisión de
arquitectura, ya tomada y escrita arriba — implementarla, no re-diseñarla); el resto son ⚡.
**Regla dura que atraviesa todo el bloque, dicha por Carlos el 2026-09-03:** ninguna pieza de
H.7 puede quedar atada a Claude Code. Si al implementar aparece un camino más corto que solo
sirve para un CLI, ese camino está mal — va detrás del registro de adaptadores de H.7.2b, como
una entrada más ([[feedback-deteccion-generica-no-por-cli]]).
Lo que NO se debe hacer: re-litigar el umbral,
proponer compactación, agregar un LLM al circuito, o "mejorar" el handoff generándolo con un
modelo. Si algo del diseño parece equivocado, anotarlo y preguntar — no cambiarlo en caliente
(scope-lock, `bun run agent:preflight -- --item H.7.N --agent <cli>` antes de tocar código).

<a id="bloque-h-h-8-1"></a>
### H.8.1 — ⚡ Registro de `cli_effort` por engine, no una lista única.
  `src/tasks/schema.ts`: reemplazar `ClaudeCliEffort` (5 niveles fijos, implícitamente solo
  Claude) por un registro `CLI_EFFORT_LEVELS: Partial<Record<TaskEngine, string[]>>` =
  `{ external: ['low','medium','high','xhigh','max'], codex: ['minimal','low','medium','high','xhigh'] }`.
  La validación de `task.cli_effort` depende de `task.engine`, no de una lista global.
  `opencode` queda **fuera de scope, explícito** — sin contrato de effort verificado para ese
  CLI, mismo criterio que el resto del repo ([[feedback-deteccion-generica-no-por-cli]]: no
  fingir soporte).

  **Evidencia de cierre (2026-09-03):** `CLI_EFFORT_LEVELS` quedó tipado en
  `src/tasks/schema.ts` con `external: low|medium|high|xhigh|max` y
  `codex: minimal|low|medium|high|xhigh`; `validateTask` valida según `task.engine` y rechaza
  engines sin contrato declarado. `scripts/eval-run.ts` y `src/evals/runner.ts` consumen el
  tipo genérico `CliEffort`. Tests agregados en `src/__tests__/engine-selection.test.ts` cubren
  ambos contratos, cruce inválido y `opencode` fuera de scope.
  **Comandos:** `bun run agent:preflight -- --item H.8.1 --agent codex --scope
  "src/tasks/schema.ts,src/evals/runner.ts,src/__tests__/engine-selection.test.ts,scripts/eval-run.ts,PLAN.md"` ✅;
  `bunx tsc --noEmit` ✅; `bun test src/__tests__/engine-selection.test.ts` → 20 pass / 0 fail ✅;
  `bun run test:coverage` → 1254 pass / 0 fail, funciones 74.74% (mínimo 69%), líneas 63.60%
  (mínimo 57%) ✅; `git diff --check` ✅.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` es un artefacto derivado que el
  pre-commit regenera obligatoriamente desde `PLAN.md`; se incluye únicamente para mantener el
  estado indexado sincronizado.

<a id="bloque-h-h-8-2"></a>
### H.8.2 — ⚡ Aplicar el effort en el executor de Codex.
  Depende de H.8.1. `src/run/executors/codex.ts`: si `ctx.task.cli_effort` viene seteado,
  agregar `-c model_reasoning_effort=<valor>` al spawn (mismo patrón que `-m` ya usa hoy).
  `external.ts` no cambia (ya hace `--effort`).

  **Evidencia de cierre (2026-09-03):** `buildCodexArgs` y `buildCodexArgsDisplay` agregan
  `-c model_reasoning_effort=<valor>` cuando `ctx.task.cli_effort` está presente. El test happy
  path verifica tanto el comando entregado a `Bun.spawn` como los argumentos persistidos en
  `costByIteration`, manteniendo una sola fuente de verdad para la evidencia del run.
  **Comandos:** `bun run agent:preflight -- --item H.8.2 --agent codex --scope
  "src/run/executors/codex.ts,src/__tests__/*codex*.test.ts,PLAN.md"` ✅;
  `bunx tsc --noEmit` ✅; `bun test src/__tests__/codex-engine.test.ts` → 9 pass / 0 fail ✅;
  `bun run test:coverage` → 1254 pass / 0 fail, funciones 74.74% (mínimo 69%), líneas 63.60%
  (mínimo 57%) ✅; `git diff --check` ✅.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` es un artefacto derivado que el
  pre-commit regenera obligatoriamente desde `PLAN.md`; se incluye únicamente para mantener el
  estado indexado sincronizado.

<a id="bloque-h-h-8-3"></a>
### H.8.3' — ⚡ CERRADO-RECORTADO (2026-09-04): backend de effort genérico; draft visual congelado.
  Depende de H.8.1/H.8.2. `--cli-effort` deja de documentarse como "Claude CLI effort
  override"; valida contra el registro según el `--engine` recibido. En
  `screens-core.js` (~línea 1115), el `<select>` de effort dentro del draft de tarea deja de
  tener los 5 valores de Claude hardcodeados — sus opciones se derivan de `CLI_EFFORT_LEVELS`
  según el `engine` elegido en el draft (hoy el campo entero se oculta si `engine !== 'external'`
  — pasa a mostrarse también para `engine === 'codex'` con sus propios niveles).

  **Corrección de alcance (hallazgo 2026-09-03, verificado en código):** este ítem, tal como se
  escribió el 2026-09-02, era **inejecutable** — asumía que `engine === 'codex'` ya se podía
  elegir en el draft, y no se puede. El `<select>` de engine (`screens-core.js:1107-1112`) solo
  ofrece `single-shot | agentic | external`; `codex` nunca se agregó como opción, aunque el
  engine existe en el schema (`src/tasks/schema.ts:6`), tiene executor propio
  (`src/run/executors/codex.ts`) y es seleccionable como agente **global** en Settings
  (`screens-ops.js:1666`). Es el mismo patrón que la Regla Cero de `CLAUDE.md`: una capacidad
  real del backend que no existe en la práctica porque ninguna superficie la expone
  ([[feedback-dashboard-no-solo-cli]]). Por eso **el primer paso de H.8.3 es agregar la opción
  `codex` a ese `<select>`**, antes de tocar el de effort; sin eso su propio gate 🔍 no se puede
  correr. `opencode` sigue fuera de scope (sin contrato de effort verificado, § "Fuera de scope"
  abajo).

  **Qué se conserva y queda cerrado (ya está hecho y verificado; no se toca):**
  `CLI_EFFORT_LEVELS`, la validación de `--cli-effort` según `--engine` en
  `scripts/eval-run.ts`, y el consumo del registro del schema en `/api/tasks` (persiste
  `codex + minimal` y rechaza `codex + max`). Esto es reproducibilidad de runs y lo consume
  I.3.

  **Qué se congela:** el gate visual 🔍 del draft manual en el dashboard. Motivo doble: (a) estaba
  bloqueado igual porque CUA reportó `browsers: []`, y (b) verificar en vivo una pantalla que el
  Bloque I va a borrar es trabajo que se haría dos veces. No se agrega más superficie de UI al
  draft en este ítem.

  **El congelamiento no es abandono:** I.3 hereda el backend conservado y I.7 lo verifica en el
  flujo final, después de que el Bloque I retire el draft de la pantalla principal.

  **Implementación backend lista; gate visual congelado (2026-09-03):** `scripts/eval-run.ts` ahora usa
  `CLI_EFFORT_LEVELS` y valida `--cli-effort` según `--engine`; el draft agrega `codex`, deriva
  dinámicamente sus opciones y envía `cli_effort` tanto para `external` como para `codex`.
  `/api/tasks` también consume el registro del schema y persiste `codex + minimal`, rechazando
  `codex + max`. `bun run build:ui` ✅; suite relevante → 19 pass / 0 fail ✅; CLI real en
  `--dry-run`: `codex + minimal` ✅ y `codex + max` rechazado con los niveles correctos ✅;
  `git diff --check` ✅. Dashboard real verificado en `localhost:4242` y
  `/api/tasks` respondió, pero el gate visual del draft NO se cierra en esta pasada: CUA reportó
  `browsers: []`, por lo que no fue posible observar el draft en un navegador automatizado — y de
  todos modos queda congelado por el recorte de producto de arriba (el Bloque I retira el draft de
  la pantalla principal, así que verificarlo en vivo ahí sería trabajo tirado).

  **Corrección de una corrida previa contaminada (2026-09-04):** una ejecución anterior de
  `bun run test:coverage` reportó 1133 pass / 126 fail con `SQLITE_READONLY` y puerto `4242`
  ocupado. Investigado y descartado como falso negativo: los fallos venían de un `--sandbox
  workspace-write` mal elegido para ese proceso (los tests escriben en `~/.orchestos/db.sqlite`,
  fuera del repo → read-only) combinado con una sesión de Codex corriendo en paralelo sobre el
  mismo working tree ([[feedback-codex-no-en-paralelo-con-claude]]). Ninguno de los dos motivos es
  un defecto del código.

  **Gate obligatorio, corrida limpia (2026-09-04):** `bun run test:coverage` → **1255 pass / 0
  fail**, 3033 `expect()`, funciones 74.74% (mínimo 69%), líneas 63.63% (mínimo 57%) ✅.

  **Gate en vivo:** Carlos verificó en su propio navegador, contra el dashboard real corriendo
  (`localhost:4242`), la barra de agentes con los iconos reales por marca y el filtrado a solo
  CLIs instalados entregados en este ítem — confirmó que se ve. De esa misma revisión salieron 5
  defectos visuales reales (color de icono no es el de marca, texto duplicado en el popover,
  punto verde sin aporte, popover pegado al borde, refresh sin trigger por evento), registrados y
  agendados dentro de `I.5` para no tocar `SessionStatusBar.tsx` dos veces — no bloquean el cierre
  de este ítem porque son de pulido visual, no de la funcionalidad que H.8.3' entrega.

  H.9.3 (aislamiento de config-home) queda deliberadamente **fuera de esta secuencia**: Carlos
  decidió (2026-09-04) atacarlo más adelante, después de avanzar con el Bloque I — no es parte del
  cierre de H.8.3'.

  **Fuera de scope declarado:** `.orchestos/feature-status.json` es un artefacto derivado que el
  pre-commit regenera desde `PLAN.md`.

**Fuera de scope declarado de H.8:** `opencode`; el switch de Settings para
local/CLI/API que Carlos mencionó de paso (tema aparte, pospuesto explícitamente por él); el
tier API/OpenRouter (`supportsReasoningEffort()` en `model-catalog.ts` ya es genérico vía el
catálogo real, no se toca).

<a id="bloque-h-h-9-2"></a>
### H.9.2 — 🧠 La frontera de lectura es una capability declarada por CLI, verificada, no un prompt.
 (reabierto y cerrado de nuevo 2026-09-06)
  **REABIERTO 2026-09-06.** Se cerró el 2026-09-04 declarando una frontera que **no funciona en
  ninguna de sus dos direcciones**. Verificado con 9 sondas contra el binario real (no asumido, no
  inferido de la doc), a raíz de la auditoría del Bloque R (R.2). Ver `## Bloque R` §R.2-bis abajo
  para la tabla completa. Resumen del fallo:
  - `permissions.deny: ["Read(//*)"]` —lo que escribe hoy `provisionCliConfigHome()`— **bloquea
    todo, incluido el propio proyecto**: un `Read` de un archivo bajo `--add-dir` devuelve *"File
    is in a directory that is denied by your permission settings"*. El chat de proyecto con Claude
    no puede leer **ni un solo archivo**. La feature nunca funcionó.
  - Sin ese deny, **no hay frontera**: el modelo esquiva `--allowedTools 'Read,Glob,Grep'` usando
    `Bash` (`cat`) y lee cualquier path del filesystem con `is_error:false`. `--allowedTools` es
    una lista de *auto-aprobación*, no una lista blanca excluyente.
  - `deny` global + `allow` del proyecto **no** sirve: deny gana sobre allow, siempre.
  - Un hook `PreToolUse` propio **falla abierto**: con el script ausente, la lectura externa pasó
    y devolvió el contenido. Un control que se desactiva solo no es una frontera (INS-2026-014
    llevado a su lectura estricta: tampoco puede ser un hook fail-open).

  Causa raíz del cierre indebido: el gate verificó que el archivo de settings **se escribiera**,
  nunca que la frontera **funcionara** — y su gate visual quedó explícitamente congelado. Es
  exactamente el patrón de la regla cero de `CLAUDE.md` (config entregada sin verificar en vivo
  que hace lo que dice). El `[x]` original y su evidencia se conservan abajo como historial.

  **Mecanismo correcto, verificado 2026-09-06: `--restricted` (requiere Claude Code ≥ 2.1.248).**
  Confina las file tools a los working dirs (`--add-dir` incluido), quita Bash/PowerShell/REPL/
  WebFetch salvo que `--tools` los nombre, **ignora los settings de user/project/local** y rechaza
  `bypassPermissions`. Pasó los 5 fixtures adversariales (dentro ✅ lee; afuera, symlink→afuera,
  directorio con prefijo similar y Grep recursivo ✅ bloqueados, sin filtrar el fixture secreto).
  No tiene modo fail-open porque no hay script externo que pueda faltar: el modo de fallo pasa a
  ser *"¿se pasó el flag?"*, que es código propio y se fija con un test determinista.

  **Alcance del reabierto:** (1) `buildClaudeChatArgs()` agrega `--restricted --strict-mcp-config`
  y cambia `--allowedTools` → `--tools`; (2) `provisionCliConfigHome()` deja de escribir el deny
  que bloqueaba el proyecto; (3) `readBoundary` pasa a ser una capability **verificada contra el
  binario** (soporta `--restricted` o no) y el chat de proyecto se **rechaza** si no la soporta —
  fail-closed, nunca correr sin frontera; (4) gate en vivo con los 5 fixtures + el caso "binario
  viejo → rechaza".

  **Implementación (2026-09-06):**
  - `external.ts` — `CLAUDE_CHAT_BOUNDARY_FLAGS = ['--restricted','--strict-mcp-config']`
    exportado y aplicado en `buildClaudeChatArgs()`; `--allowedTools` → `--tools`. El comentario
    del bloque documenta las 3 configuraciones descartadas **con su evidencia**, para que nadie
    reintroduzca el `deny` por costumbre.
  - `cli-registry.ts` — `CliReadBoundary.project-root` ahora declara `mechanism`, y
    `readBoundaryFor()` devuelve la frontera **efectiva**: degrada a `none` si el binario no
    sostiene el mecanismo. Sonda inyectable (`CliCapabilityProbe`), mismo patrón que
    `ToolchainProbe` — ningún test spawnea el binario del host.
  - `handlers/chat.ts` — `projectChatReadBoundaryError()` consulta la frontera efectiva, no la
    declarada, y cita el motivo concreto del CLI.

  **Bug propio encontrado por el gate en vivo y corregido en el mismo turno:** el cache de
  capability ignoraba la sonda inyectada, así que simular un binario viejo devolvía
  `project-root` (la degradación fail-closed quedaba desactivada en silencio). Ahora solo se
  cachea el resultado de la sonda real. Test dedicado que lo fija.

  **Tests actualizados, no "arreglados para que pasen"** — dos codificaban el comportamiento roto:
  `cli-registry.test.ts` exigía `permissions.deny:['Read(//*)']` (comprobaba que el archivo se
  ESCRIBIERA, nunca que la frontera FUNCIONARA — así se cerró roto el ítem) y
  `chat-read-boundary.test.ts` llamaba sin sonda, lo que ahora spawnearía el binario del host
  (el mismo defecto de [[reference-ci-host-environment-drift]]). Suite: **1285 pass / 0 fail**,
  functions 75.04% / lines 63.68% (mínimos 69/57).

  **Gate en vivo (2026-09-06):** ejecutado con `runClaudeChat()` **del repo** —no flags escritos a
  mano— contra el binario real, sobre un proyecto temporal con 5 fixtures adversariales:
  ```
  capability efectiva: {"kind":"project-root","mechanism":"restricted-flag"}
  ¿la respuesta filtró algún secreto de afuera? ✅ NO
  respuesta: "Solo pude leer dentro.ts (dentro del working directory); las otras 4
             operaciones fueron bloqueadas por la restricción --restricted"
  ```
  Bloqueados: archivo externo, **symlink desde dentro apuntando afuera**, **directorio con prefijo
  similar** (`…/r2-probe-evil` vs `…/r2-probe`) y **Grep recursivo hacia afuera**. Ninguno filtró
  contenido. Caso "binario viejo" verificado por sonda simulada → `none` con motivo accionable.

  **Hueco que este gate dejó a la vista, y que NO se tapa acá:** `filesRead` reportó **4 rutas**
  cuando solo **1** se leyó de verdad — las otras 3 fueron bloqueadas. Es R.2 confirmado en vivo:
  `claudeEventToReadPaths()` registra la *solicitud*, no el *resultado*. **H.9.4 no puede afirmar
  aislamiento con este campo tal como está**; se resuelve en R.2 (correlación por `tool_use_id`).

  <details><summary>Cierre original del 2026-09-04 (historial — su evidencia no acreditaba la frontera)</summary>
  No una lista de agentes permitidos — eso ya se descartó con evidencia
  ([[feedback-no-restriccion-por-identidad-agente]]), y tampoco una `findXBinary()` por CLI
  ([[feedback-deteccion-generica-no-por-cli]]). Cada entrada de `src/run/executors/cli-registry.ts`
  declara **cómo demuestra** su frontera de lectura, y el spawn del chat la aplica:
  - `claude` → settings propio vía `--settings` con `permissions.deny` de los paths fuera del
    root del proyecto, más `--add-dir` acotado. Frontera real.
  - `codex` → **no puede declarar frontera de lectura** (verificado arriba: `--sandbox` no acota
    paths). Declara `none` y el sistema lo trata como tal, en vez de fingir que está aislado.
  - Un CLI que no declara frontera no obtiene el chat de proyecto en silencio: el hueco se dice
    en la UI. La ausencia de control es un "no" explícito, no un "confiemos en el prompt"
    (INS-2026-014: el límite de un tool no puede ser el prompt).

  Esto es 🧠 y no ⚡ porque la decisión de qué hacer con un CLI sin frontera (bloquear el chat vs.
  permitirlo con aviso visible) es de producto, y hay que resolverla con Carlos dentro del ítem,
  no elegirla por conveniencia.

  **Decisión de Carlos (2026-09-04): bloquear.** Un CLI sin frontera declarada (hoy `codex`) no se
  ofrece como agente de **chat de proyecto** — sigue disponible para tareas normales (worktree),
  que es otro eje y no depende de esta frontera. Lectura estricta de INS-2026-014: sin control
  real, no hay chat. Se descartó la alternativa de permitirlo con aviso visible — dejaría usable
  hoy la superficie que H.9 identificó como riesgo de exfiltración.

  **Implementación H.9.2 (2026-09-04, pendiente de gate visual):** `CliDefinition.readBoundary`
  declara `project-root` para Claude y `none` para los demás CLIs. El home de settings Claude
  provisionado por H.9.3 ahora contiene `permissions.deny` y `buildClaudeChatArgs` agrega
  `--add-dir <cwd>`. El endpoint rechaza Codex/OpenCode (y cualquier CLI registrado sin contrato)
  con HTTP 400, sin fallback; `/api/system/executor-modes` y `/api/session/status` exponen el
  descriptor para la UI, cuyo selector deshabilita opciones según el registro.
  Tests relevantes: 23 pass / 0 fail. `bun run security:gate`: PASS.
  Gate live backend contra dashboard real: `/api/chat` con agente Codex respondió 400 con el
  motivo correcto y `/api/system/executor-modes` expuso Claude=`project-root`, Codex/OpenCode=`none`.

  **Decisión de scope (2026-09-04, misma sesión, explícita de Carlos): el front NO se toca acá.**
  Carlos: *"este dashboard tiene que evolucionar o desaparecer... arreglar solo esto ahora solo me
  quita tiempo... hagamos todo lo back y una vez terminado avancemos al front"*. Una primera pasada
  sí había generalizado el selector del chat (`app.js`) para leer `readBoundary` del registro en vez
  del `Set` hardcodeado `CHAT_UNSUPPORTED_AGENTS`, y corrigió un defecto real de copy duplicado que
  Carlos encontró en vivo (el texto de motivo aparecía dos veces: en el `title` y repetido inline en
  la fila y el banner). **Se revirtió esa parte** (`git checkout -- src/dashboard/public/app.js
  src/dashboard/public/i18n.js`) porque: (a) el `Set` hardcodeado que ya existía desde CC.1b
  (2026-08-17) sigue bloqueando `codex`/`opencode` en el selector — no hay regresión funcional, y
  (b) invertir en pulir un componente que el Bloque I va a reemplazar entero es el mismo desperdicio
  que ya motivó congelar el gate visual de H.8.3'. La seguridad real de H.9.2 no depende de esto: el
  backend rechaza con 400 sin importar qué muestre el selector viejo. **Pendiente explícito para
  I.5:** cablear el selector nuevo (React) directo contra `readBoundary`, sin el `Set` duplicado.

  **El control mecánico de copy SÍ se conserva** (lo que Carlos pidió: "control estricto... de ahora
  en adelante", no un parche puntual) — pero reubicado para no depender de tocar UI hoy:
  `src/dashboard/ui-copy-budget.json` (movido fuera de `public/` a propósito: es una herramienta de
  gobierno, no UI en sí, así que no dispara el gate de evidencia en vivo) declara el registro
  extensible de textos compactos por contexto, y `check-ui-copy.ts` valida `en`/`es` contra
  `i18n.js`, con filtro por diff staged en `agent-governance.ts`/`scripts/pre-commit.sh`. Sembrado
  con las claves `chat.modelfx.agentLabel.*` (ya cortas, ya existentes). Cuando I.5 escriba copy
  nueva, cualquier string que se declare "de contexto compacto" y exceda su presupuesto bloquea el
  commit — la regla queda viva antes de que exista la superficie que la va a necesitar más.
  Tests del control: 6 pass / 0 fail. `bunx tsc --noEmit`: PASS. `bun run scripts/check-ui-copy.ts
  --all`: `✓ UI copy budget: en/es dentro del máximo declarado`.

  **Referencia de diseño para I.5 (2026-09-04, aportada por Carlos):**
  `pro.reactbits.dev/docs/app-ui/ai-chat` — catálogo de 9 componentes de chat de IA. Los que mapean
  directo al diseño ya escrito en I.5: `ai-chat-4` (selector de modelo + medidor de contexto/cupo +
  popover de configuración — la píldora compacta ya especificada), `ai-chat-5` (aprobaciones inline
  que bloquean acciones destructivas — exactamente el punto de confirmación de I.2), `ai-chat-6`
  (multi-agente con identidad por agente y un rail de actividad en vivo — el rediseño de la barra de
  usage e I.6/Actividad). No se implementa nada de esto ahora; queda como insumo verificado (no solo
  el nombre de la página, sino qué componente resuelve qué parte ya planificada) para cuando arranque
  el Bloque I.

  Verificación obligatoria final de este ítem (backend + gate de copy, sin tocar `dashboard/public`):
  `bun run test:coverage` → **1265 pass / 0 fail / 3055 expects; functions 75.02%; lines 63.75%**
  (mínimos 69%/57%). Sin cambios en `src/dashboard/public/` en este commit → no aplica gate en vivo
  de navegador ([[feedback-verificar-gates-en-vivo]] sigue vigente para cuando I.5 sí lo toque).
  </details>

<a id="bloque-h-h-9-3"></a>
### H.9.3 — ⚡ Aislamiento de config-home como defensa en profundidad (tercera capa, no primera).
 (cerrado 2026-09-04)
  **Corrección de dependencia (2026-09-03):** la redacción original decía "Depende de H.9.2" y
  contradecía el orden de `I.0`, donde H.9.3 va **primero** por pedido explícito de Carlos (que el
  bug no viaje es su única prioridad declarada). No hay dependencia real: H.9.3 solo necesita **un
  campo nuevo** en `cli-registry.ts` (qué home de config usa cada CLI), no la capability de
  frontera de lectura completa que define H.9.2. Se implementa standalone; H.9.2 después agrega la
  frontera sobre el mismo registro. OrchestOS escribe
  un home propio bajo `.orchestos/agent-home/<cli>/` con un `AGENTS.md`/`CLAUDE.md` **mínimo
  generado por OrchestOS** (reglas del proyecto, cero vault) y lo pasa con los flags ya
  verificados: `--ignore-user-config` + `CODEX_HOME` para Codex, `--settings` para Claude.
  Objetivo declarado: que el chat del producto se comporte **igual en cualquier máquina**, que es
  el riesgo 2 de arriba. No se toca `~/.codex` ni `~/.claude` del usuario
  ([[feedback-avisar-antes-de-crear-estado]] — el home nuevo vive dentro del repo, gitignored).
  **Implementación y evidencia:** `CliDefinition` declara un descriptor extensible de `configHome`;
  `provisionCliConfigHome()` genera en runtime `.orchestos/agent-home/<cli>/` el archivo mínimo
  `AGENTS.md`/`CLAUDE.md` y, para Claude, `settings.json` propio. El chat de Codex pasa
  `--ignore-user-config` y `CODEX_HOME`; el chat de Claude pasa `--settings <settings.json>`.
  `.orchestos/agent-home/` quedó en `.gitignore`. Tests por builders/helpers (sin `mock.module()`)
  verifican flags, env y contenido/path del home: `bunx tsc --noEmit` ✅; suite relevante **27
  pass / 0 fail**. Gate obligatorio exacto `bun run test:coverage` ✅: **1258 pass / 0 fail / 3042
  expects / 134 archivos; functions 74.88% (gate 69%); lines 63.70% (gate 57%)**.
  **Fuera de scope declarado:** `src/dashboard/public*`, `.tsx`, H.9.2/H.9.4, `opencode` y
  cualquier archivo bajo `~/.claude`, `~/.codex` o `~/Documents/MemoriesMD`.

<a id="bloque-h-h-10-1"></a>
### H.10.1 — 🧠 El gate de evidencia exige un artefacto versionado, no una frase.
 Cerrado
  2026-09-08 (Claude).
  `scripts/agent-governance.ts` — `hasLiveGateEvidence(planDiff, stagedPaths)` ahora exige,
  además de la línea "Gate en vivo:" con navegador/browser/Playwright, que esa misma línea cite
  entre backticks un archivo de evidencia (`` `ruta.ts` ``/`.json`/`.log`/`.ndjson`/`.js`/`.mjs`,
  vía `citedEvidenceFiles()`) **y** que ese archivo esté presente en `stagedPaths` — el listado
  real de archivos del commit (`git diff --cached --name-only`), no solo mencionado en prosa.
  `scripts/check-live-gate.ts` pasa `paths` (ya calculado para `requiresLiveGate`) al llamado.
  Sin ambas condiciones, falla igual que antes fallaba la frase ausente.
  **Gate:** `bun test scripts/agent-governance.test.ts` — 5 pass / 0 fail, cubre 3 casos
  sintéticos: (1) frase + archivo citado + archivo en `stagedPaths` → true; (2) regresión
  EXACTA del incidente R.5 — cierre + frase con "navegador", sin ningún archivo citado, la
  forma que el gate viejo aceptaba → ahora false; (3) archivo citado pero ausente de
  `stagedPaths` (citar no es aportar) → false. No requiere navegador: es lógica pura
  determinística sobre texto de diff, no una superficie de dashboard/UI (`scripts/` no está en
  `LIVE_GATE_PATHS`) — el propio ítem no dispara su propio gate.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` — regenerado automáticamente
  por el pre-commit desde este mismo PLAN.md, no se anticipó al declarar el scope-lock.
