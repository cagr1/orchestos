<a id="plan-orden-ci-1"></a>
- [x] **CI.1 — 🔍 Mutation Shards en rojo: no era mutación, era el esquema de la DB.** → [evidencia](docs/done/sprint-30.md#sprint-30-ci-1)

- [ ] **UI.3.5 — 🧠 Sistema visual: que se sienta herramienta, no panel de administración.**
  (EN CURSO, abierto 2026-08-30 — decidido en sesión previa con Opus, retomado y confirmado
  aquí). **Pausa `UI.4`**: las 9 pantallas que faltan no se migran con paridad al look viejo
  para no tocarlas dos veces — nacen ya con el sistema nuevo cuando les toque.

  **Motivo, con Carlos preguntando directo:** "cuando dije cambiar la apariencia no era solo
  usar React sino que el dashboard se sienta como herramienta" — comparando con Claude Code,
  Codex, Orca, Hermes. Medido en el CSS, no opinado: 15 tamaños de fuente + 86 `font-size`
  inline (vs. 4–5 en una herramienta real), 10 radios de borde distintos, 253 `style="..."`
  inline, 33 `.card` (cada cosa en su caja). Eso es lo que lee como "panel de administración":
  no hay sistema, hay 253 excepciones.

  **Decisión (confirmada por Carlos, dos preguntas cerradas):**
  1. El sistema visual entra **ahora**, en una sola pasada — no se migran las 9 pantallas
     restantes con el look viejo para reajustarlas después.
  2. **UI.6** (capas de proyectos/carpetas, sidebar Chat|Code) se queda donde está en el
     roadmap; no se adelanta.
  3. El **carril de estado** (glifo + peso tipográfico en vez de badges de color) — confirmado
     como la pieza más visible del cambio.

  **Qué NO se toca:** los hex base y los 4 temas existentes. El problema medido no es la
  paleta (`#0d1117` + acento azul ya es la familia correcta, tipo GitHub Dark/Zed) sino cómo
  se usa — decorativa en vez de señal.

  **Tokens nuevos:**
  - Tipografía: de 15 tamaños a 5 (`11·12·13·15·19`, 13 = cuerpo, 19 = título de pantalla).
    Regla de reparto explícita: mono para todo dato (id, modelo, costo, fecha, ruta), sans solo
    para prosa y labels — hoy están mezclados sin criterio.
  - Radios: de 10 a 2 (4px controles, 8px contenedores). `999px` sobrevive solo para el pill
    de estado del header — único elemento que debe leerse como pill.
  - Color = señal, nunca decoración: reservado a error, en-ejecución, y acción primaria. Todo
    lo demás vive en la escala de grises.
  - Densidad: altura de fila fija y compacta; muere `.card` como contenedor por defecto — la
    jerarquía pasa a hacerse con línea de 1px + espaciado, no caja con borde+fondo+sombra.
  - Acciones que no compiten: en cards, los botones aparecen en hover (o en menú `⋯` para la
    acción destructiva), no los 5 siempre visibles que tiene `skills` hoy.
  - **Carril de estado** en vez de badges de colores en filas de tabla/lista: un glifo (`●`
    `✗` `○`) + peso tipográfico mono, separador de 1px sin caja. Ej.: `● spec-activa-1  draft
    ok` en vez de `[draft][PASS] sí` con 4 badges de color.

  **Alcance de esta pasada:** tokens en `ui.css`, componentes de `UI.2` reajustados, el shell
  de `UI.3`, y `specs`+`skills` (ya son React — barato reajustarlos). Matar los `style=` inline
  ya introducidos en ese React. **Fuera de alcance, explícito:** las 9 pantallas de `UI.4` que
  faltan (nacen con el sistema nuevo al migrarse) y `UI.6`.

  **Gate, invertido respecto del resto de la migración:** los gates existentes de
  `specs`/`skills` miden *paridad* contra el vanilla — hay que reescribirlos para que midan que
  el look **cambió** de forma consistente: 5 tamaños de fuente, 2 radios, cero `style=` inline
  en el React tocado, carril de estado presente donde antes había badges.

  **Progreso (2026-08-30):**
  - [x] Tokens en `ui.css`/`styles.css`: `--fs-1..5` (11/12/13/15/19), `--radius` 6→4,
    `--radius-lg` 8, `--radius-pill` 999px (única sobreviviente del pill de estado del
    header). Utilidades `.fs-1..5` para reemplazar `font-size` inline en React.
  - [x] **Carril de estado** en `SpecsScreen.tsx`: fusiona las columnas Estado+Lint en una
    (`● draft ok` / `✗ approved 3 findings` / `○ archived —`), clase `.status-rail` nueva en
    `styles.css`. `.badge` no se toca: lo siguen usando las 9 pantallas sin migrar.
    **Gate en vivo:** navegador real (Playwright) contra el dashboard corriendo en :4325 —
    capturas confirman el carril sin la línea de `border-left` que traía por colisión de
    nombre con `.detail` (el span interno se renombró a `.rail-detail` tras verlo en pantalla;
    `.detail` ya era una clase global del panel expandible).
  - [x] **Acciones que no compiten** en `SkillsScreen.tsx`: `.skill-card-actions` pasa a
    `opacity:0` con reveal en `:hover`/`:focus-within` (sin cambiar alto, sin salto de layout).
    **Gate en vivo:** navegador real (Playwright) — captura sin hover no muestra los 5 botones,
    captura con hover sí.
  - [x] `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet sin
    mover).
  - [ ] Pendiente de esta pasada: barrido de `font-size`/`border-radius` en el resto de
    `styles.css`/`screens.css` (vanilla compartido, ~80 sitios — se hará agrupado por pantalla
    para poder verificar en vivo cada tanda, no en un sólo sed masivo); reajuste de
    `Button`/`Input`/`Combobox`/`Dialog`/`Toast`/`Tabs` (`UI.2`) a los tokens nuevos; el shell
    (`UI.3`); reescribir `ui4-specs-screen.mjs`/`ui4-skills-screen.mjs` para medir el look
    nuevo en vez de paridad contra vanilla (quedaron en rojo en las 2 aserciones de paridad de
    columnas/badges — esperado, hay que reemplazarlas, no arreglarlas).

<a id="plan-orden-ci-3"></a>
- [x] **CI.3 — ⚡ CI rojo por lint: arreglado y exigido en pre-push.** (abierto y cerrado 2026-09-22)
  Ejecutado por: luna (pre-push) + biome --write mecánico · Spec: docs/specs/CI.LINT.md (borrado al cerrar)
  CI rojo desde `d388392` (2026-09-15) solo en `bun run lint`: formato de la app copiada de la plantilla e
  imports sin `node:`. `biome check --write`; `noArrayIndexKey`/`noThenProperty`/`useExhaustiveDependencies`
  a warn en `src/dashboard/app` y `public-src` (código literal de la plantilla); `scripts/pre-push.sh` corre lint.
  Gate en vivo: Playwright contra el dashboard real, `docs/done/evidence/CI.3-live.json` — Chat, Dev con consola,
  inspector y Settings renderizan, 0 errores. `test:coverage` 1465 pass / 0 fail.

- [ ] **CI.2 — 🧠 Los 12 ui-gates no los corre nada: hacerlos exigibles.** (abierto 2026-09-18)
  **Medido el 2026-09-18, no estimado:** `ci.yml:15-19` corre `bun install`, `db:migrate`,
  `test:coverage`, `typecheck` y `lint`. `scripts/pre-commit.sh` corre `tsc`, `security:secrets`,
  `ledger:gate`, `plan:render`, `check-live-gate`, `check-ui-copy` y `check-scope-lock`.
  `scripts/pre-push.sh` corre `test:coverage`. **Ninguno toca `scripts/ui-gates/`**, donde hay
  **12 scripts** (`ui0`, `ui1`, `ui1b`, `ui2`, `ui3`, `ui4-specs`, `ui4-skills`, `ui81`, `ui97`,
  `at91`, `s6`, `s6a`). Se corren a mano el día que cierra su ítem y nunca más.
  **Consecuencia ya pagada, no hipotética:** el gate de `UI.9.4` pasó una vez y el botón
  "+ Add project" se pudrió **dos veces** —invisible por CSS con el sidebar colapsado, después
  borrado por `UI.9.1`— sin que nada se pusiera rojo, con el ítem en `[x]` todo el tiempo
  (`UI.9.7`). Es exactamente el patrón de la Regla cero de `CLAUDE.md`: una regla que nadie hace
  cumplir mecánicamente deja de existir.
  **Pregunta que Carlos hizo y que este ítem contesta** (2026-09-18): *"¿este cambio que se hizo
  se lo tomará en cuenta [al cambiar toda la interfaz]?"*. Hoy no. Lo que tiene que sobrevivir a
  `UI.4`/`UI.5` no es el CSS, es el gate — y hoy el gate tampoco se hace cumplir.
  **A resolver en el diseño, no asumir:** los ui-gates necesitan un dashboard corriendo y
  Playwright; medir cuánto tardan los 12 juntos antes de decidir si van a CI, a `pre-push` o a un
  workflow aparte. Si el costo es mayor que el beneficio, decirlo con el número y proponer un
  subconjunto — no meter 12 gates en cada push por principio.
  Relacionado: `bun run lint` está **rojo por 17 hallazgos preexistentes** (`check-coverage.ts`,
  `check-ledger-gate.ts`, `check-secrets.ts`, `check-test-assertions.ts`, `context-adapters.ts`,
  `eval-run.ts`, `check-sources-drift.test.ts`, `tests/run/*.test.ts`, `docs/done/evidence/*.json`),
  todos `FIXABLE`. CI lo ejecuta, así que CI sigue rojo por eso. Un CI que falla siempre deja de
  dar señal — mismo corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01.
  **Hallazgo 2026-09-18 que amplía este ítem: correr los 12 gates NO basta.** El diagnóstico de
  `UI.9.A` mostró que `30ab117` reescribió `scripts/ui-gates/ui3-shell.mjs` en el **mismo commit**
  que cambió la pantalla, y el gate resultante abre el inspector con
  `page.evaluate(() => window.OrchestOS.openInspectorTool('terminal'))` (`ui3-shell.mjs:58`) en vez
  de clickear. Es estructuralmente incapaz de notar que no existe ningún botón: pasaría en verde con
  cero afordancias en pantalla. Los tres casos comparten forma —"+ Add project" invisible por CSS
  (el gate medía existencia en DOM, no visibilidad), "+ Add project" borrado por `UI.9.1` (el gate
  no se volvió a correr), inspector (el gate se reescribió para saltarse la UI)—: **los gates
  afirman sobre estado alcanzable desde JS, no sobre lo que un humano alcanza con el mouse desde un
  arranque en frío, y los escribe el mismo ítem que cambia la pantalla.**
  Dos propiedades que el diseño de `CI.2` tiene que resolver además de la frecuencia:
  1. **Camino clickeable desde frío:** toda función del producto se ejerce clickeando. Prohibido
     `window.OrchestOS`/`window.state` para *llegar* a una pantalla en un gate (sí para *afirmar*
     sobre el estado una vez ahí). Medir cuántos de los 12 gates violan esto hoy.
  2. **Inventario de afordancias:** algo tiene que comparar qué controles clickeables existían antes
     y cuáles después de un commit, y ponerse rojo cuando desaparece uno que nadie mandó quitar. Sin
     esto, un gate reescrito por el mismo ítem que rompe la pantalla nunca da señal.

  **MEDICIÓN EJECUTADA 2026-09-18 (números reales, un dashboard en :4323, `BASE`/`GATE_BASE`
  apuntando ahí; no estimaciones).** Son **13** gates, no 12 — `ui9a-inspector.mjs` se sumó ayer.

  | gate | runtime | tiempo | resultado hoy |
  |---|---|---|---|
  | `at91-format-smoke` | node | 15.4s | verde (formato JSON, sin líneas PASS/FAIL) |
  | `s6-sprint-board` | **bun** | 31.7s | **ROJO — podrido** |
  | `s6a-sprint-board` | **bun** | 31.6s | **ROJO — podrido** |
  | `ui0-islands` | node | 9.3s | ROJO (2 FAIL) |
  | `ui1-model-combo` | node | 15.0s | verde (27 PASS) |
  | `ui1b-remaining-callsites` | node | 8.5s | verde (9 PASS) |
  | `ui2-design-system` | node | 13.2s | ROJO (1 FAIL) |
  | `ui3-shell` | node | 10.0s | verde (20 PASS) |
  | `ui4-skills-screen` | node | 11.4s | verde (22 PASS) |
  | `ui4-specs-screen` | node | 14.4s | ROJO (2 FAIL) |
  | `ui81-visual-consistency` | node | 5.0s | ROJO (1 FAIL) |
  | `ui97-bugs` | node | 11.5s | verde (25 PASS) |
  | `ui9a-inspector` | node | 4.1s | verde (17 PASS) |

  **Serie completa: ~181s (3 min)** con el runtime correcto de cada uno. **6 de 13 están rojos hoy**,
  sin que nadie lo supiera.

  **Paralelizar no es opción — medido, no supuesto.** Los 11 gates de node lanzados a la vez contra
  el mismo dashboard: **98s** (apenas menos que en serie) y **resultados basura** — 9 de 11
  terminaron con 0 PASS / 0 FAIL por `TimeoutError` de contención. Los gates asumen un dashboard
  para ellos solos. Paralelizar exige un dashboard por gate, y ahí el ahorro se lo come el arranque.

  **Dos podridos que la medición destapó, y son la prueba del ítem:**
  - `s6`/`s6a` se importan con `bun:` y **fallan de entrada con `node`**
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). Con `bun` sí arrancan, y ahí mueren en
    `click: Timeout 30000ms exceeded — waiting for locator('#navModeBtn')`: ese botón **ya no
    existe**, lo borró `UI.7` al eliminar el flag de modo. Es el mismo patrón que el "+ Add project":
    el gate quedó en `[x]` mientras la pantalla que medía desapareció.
  - Ni siquiera hay un runtime común: 11 gates son `node`, 2 son `bun`. Nada lo declara en ningún
    lado; se descubre corriéndolos.

  **Propiedad 1 medida (camino clickeable desde frío): 6 de 13 la violan hoy** —
  `ui3-shell.mjs:58` (`window.OrchestOS.openInspectorTool`), `ui1-model-combo.mjs:37`,
  `ui1b-remaining-callsites.mjs:54-118`, `ui4-specs-screen.mjs:58-212`,
  `ui4-skills-screen.mjs:47-204`, `ui81-visual-consistency.mjs:31` (todos siembran o navegan por
  `window.state` en vez de clickear). Los 7 restantes ya llegan clickeando.

  **Veredicto del número, antes de elegir dónde corren:** 3 min descarta `pre-push` (hoy tarda 20s;
  multiplicarlo por 10 lo vuelve un `--no-verify` garantizado) y descarta meterlos en el job de CI
  actual. Y con 6 de 13 rojos, engancharlos hoy a cualquier gate obligatorio los deja rojos
  permanentes — exactamente el corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01 ("un CI que
  falla siempre deja de dar señal"). El orden obligado es: **primero verdes, después exigibles.**

  **DIAGNÓSTICO DE LOS 6 ROJOS (2026-09-18, leído en el código y probado en vivo).** Pedido por
  Carlos antes de decidir. El reparto importa: **5 de 6 son el gate podrido, 1 es un bug real
  del producto.** Eso es el ítem probándose a sí mismo.

  - **`ui2-design-system` — EL PRODUCTO, no el gate.** `.filter-tab` usa
    `border-radius: var(--radius-lg)` (`screens.css:100`) y ese token vale **8px**
    (`styles.css:44`). El componente React tiene `rounded-[20px]` **hardcodeado**
    (`tabs.tsx:35`), con un comentario encima que afirma "Espeja `.filter-tab`: … radio 20px".
    Alguien bajó el token de 20px a 8px y el React quedó atrás: hoy las pestañas React se ven
    distintas de las vanilla en pantalla. Arreglo: consumir el token, no repetir el número.
  - **`ui0-islands` — gate de una fase superada.** Afirma "sin `?island-probe` no se monta
    ninguna isla". Era la regla del Mes 30 mientras React era experimental. Hoy hay **4 islas
    permanentes en producción a propósito**: `model-combo` (`app.js:2675`), `screen-specs`,
    `screen-skills` y `screen-plan` (`screens-ops.js:2352-2388`). El producto está bien; la
    afirmación caducó con `UI.1`/`UI.4`.
  - **`ui4-specs-screen` — dos afirmaciones caducadas.** (a) Exige 5 `<th>` incondicionalmente,
    pero la 5ª columna es el checkbox de bulk y está detrás de `selectable`
    (`SpecsScreen.tsx:178`); el gate nunca entra en modo bulk. (b) Busca `.badge` amber/green,
    pero `UI.3.5` reemplazó los dos badges de color por `StatusRail` —glifo + mono—
    deliberadamente (`SpecsScreen.tsx:292-299`).
  - **`ui81-visual-consistency` — trinquete mal diseñado.** Los 5 `[style]` de Chat son:
    `display:none` del `#chat-file-input`, un `pointer-events:none`, y **3 barras
    `.session-statusbar-cli-fill` con `width:<pct>` dinámico — una por CLI**. El baseline de 4 se
    calibró con menos CLIs. Cuenta atributos `[style]` a ciegas, así que se pone rojo cuando
    cambian los **datos** (cuántos CLI hay configurados), no cuando empeora el código, y mete en
    la misma bolsa el `width` calculado —única forma correcta de pintar una barra— que un estilo
    de maquetación pegado a mano.
  - **`s6` / `s6a` — se reparan, no se borran.** Miden el sprint board y el ciclo `commitPending`,
    y **esa pantalla sigue viva**: es la isla `screen-plan` → `PlanBoardScreen` (`ui.tsx:47`). Lo
    que murió es el camino: `#navModeBtn`, el toggle humano/operador que ambos clickean
    (`s6:98,168`, `s6a:102,157,178,213,254`), lo borró `47b40c6` (`UI.8.3`, "muere el modo
    avanzado"). Mismo patrón que "+ Add project" y que el inspector de `UI.9.A`. Además hay que
    **declarar el runtime**: importan `bun:` y revientan con `node`
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); nada en el repo dice cuál usa cuál.

  **DECIDIDO POR CARLOS 2026-09-18 — dónde corren:** workflow de CI **aparte**, no `pre-push` ni
  el job de `ci.yml`. Levanta el dashboard, corre los 13 en serie (~3 min) y no toca la velocidad
  del push local ni contamina el job de tests. Pendiente de decisión: qué se repara primero.

  **PENDIENTE DE DECISIÓN DE CARLOS (planteado 2026-09-18, sin respuesta todavía):** son dos
  trabajos distintos. El de `ui2` es un fix de producto de una línea (token en vez de `20px`
  hardcodeado). Los otros 5 son reescribir afirmaciones de gates — y cuatro de ellos (`ui0`,
  `ui4-specs`, `s6`, `s6a`) hay que reescribirlos igual bajo la propiedad 1 (llegar clickeando,
  no por `window.state`), así que repararlos ahora por separado es hacer el trabajo dos veces.
  Opciones: (a) un solo ítem "despodrir + reescribir clickeando los 13"; (b) el fix de `ui2` ya,
  suelto, y el resto después. Nadie arranca a reparar hasta que esto se decida.
  **DECIDIDO POR CARLOS 2026-09-21:** `ui2` ya salió suelto (`UI.9.B`); los **5 restantes**
  (`ui0`, `ui4-specs`, `ui81`, `s6`, `s6a`) van en **un solo ítem**, `CI.2.A`: se despudren y se
  reescriben llegando clickeando en la misma pasada. Spec del cerebro, ejecuta Luna.
  **BLOQUEO HALLADO AL PREPARAR EL SPEC (2026-09-21, inventario de Luna, verificado por el
  cerebro en el código):** Specs, Skills y Plan board **no tienen camino clickeable desde frío**.
  `NAV` solo lista `chat` y `settings` (`app.js:144-149`), y el Sidebar solo pinta esos `data-nav`
  (`Sidebar.tsx:354-367`). En todo el front, el único `App.go` a una de esas tres pantallas es
  `App.go('skills')` desde el resultado de búsqueda de una skill en la paleta (`app.js:2335`).
  Specs y Plan board no se alcanzan de ninguna forma. Las islas `screen-specs`/`screen-skills`/
  `screen-plan` (`screens-ops.js:2349-2390`) montan bien, pero **ningún humano llega a ellas**:
  es el mismo patrón que "+ Add project" y el inspector, ahora en tres pantallas enteras, y los
  gates en verde lo tapaban justamente porque navegaban por `window.state`. Esto deja a 4 de los 5
  gates (`ui0`, `ui4-specs`, `s6`, `s6a`) sin camino que clickear. Solo `ui81` (Chat) se puede
  reescribir ya. **Decisión de producto pendiente de Carlos:** dónde vuelven a estar accesibles
  estas pantallas, o si se retiran (y con ellas sus islas y sus gates).

  **Efecto secundario descubierto al medir, a resolver en el diseño:** correr los gates **muta el
  working tree**. `at91-format-smoke` sobreescribió `docs/done/evidence/AT.9.1-live.json` —la
  evidencia de cierre commiteada el 2026-09-15— con la corrida de hoy (revertido a mano), y
  `ui0`/`ui1`/`ui1b`/`ui2`/`ui4-*` dejan PNGs sueltos en la raíz del repo. Un workflow que corre
  los 13 en cada push no puede ir pisando evidencia histórica: los artefactos van a un directorio
  temporal o a artifacts del job, nunca sobre archivos versionados.

  **Y lo más grave, descubierto al intentar commitear esta medición: `s6a` escribe en la DB real
  del usuario.** El pre-commit abortó con `render(DB): "# S.6a fixture"` — `~/.orchestos/db.sqlite`
  había quedado con los **3 ítems del fixture (A, B, C)** en lugar de los **113 de `PLAN.md`**, y
  `plan_doc_segments` con el documento del fixture. `src/db/sqlite.ts:12` congela `DB_PATH` en el
  primer import a partir de `ORCHESTOS_HOME`, y el fixture de `s6`/`s6a` no aísla esa parte. El
  resto de las tablas quedó intacto (projects 2, chat_sessions 11, runs 111, run_steps 45), así
  que el daño fue acotado a `plan_items`/`plan_doc_segments`. Reparado con `bun run plan:reconcile`
  (113 ítems reconciliados desde `PLAN.md`, 3 huérfanos A/B/C borrados; `plan:render --check`
  verde, `bun run next` vuelve a listar los 27 de siempre), con copia previa en
  `~/.orchestos/db.sqlite.pre-reconcile-*`. **Lo salvó que `PLAN.md` es la fuente versionada.**
  Requisito duro para el workflow de `CI.2`: ningún gate corre sin `ORCHESTOS_HOME` aislado, y eso
  se verifica en el propio gate, no se confía. Si esto hubiera pasado en una tabla sin respaldo en
  git —`runs`, `chat_messages`— no había vuelta atrás.
  **Aislamiento de `s6`/`s6a` HECHO 2026-09-21.** Causa: importan `src/db/sqlite.ts` en el mismo
  proceso (`s6a-sprint-board.mjs:79`) sin `ORCHESTOS_HOME`. Ahora cada uno crea un home temporal
  propio, lo fija antes de cualquier import y **aborta si `DB_PATH` no cae dentro** (el requisito
  de arriba, verificado en el gate). Evidencia en vivo: ambos corridos con `bun`; mueren en el
  `TimeoutError` de `#navModeBtn` —después de `importPlan`— y la DB real queda igual antes y
  después (114 `plan_items`, 0 de A/B/C, 225 `plan_doc_segments`). Los otros 11 gates no abren la
  DB: pegan a un dashboard externo (`BASE`), así que su aislamiento depende de cómo se levanta ese
  dashboard — lo resuelve el workflow.

<a id="plan-orden-ci-2-a"></a>
- [x] **CI.2.A — ⚡ Reparar `ui0`, `ui4-specs`, `ui81`, `s6` y `s6a` y reescribirlos para que lleguen clickeando.** (abierto 2026-09-21, cerrado 2026-09-21)
  Sale de `CI.2` (decisión de Carlos del 2026-09-21: los 5 en un solo ítem). El bloqueo de 4 de
  ellos lo levantó `UI.10`: Specs, Skills y Plan se alcanzan por Settings → proyecto → pestaña.
  Spec: `docs/specs/CI.2.A.md`. Ejecuta Luna, verifica el cerebro: 3 corridas verdes seguidas de
  cada gate contra un dashboard real, `git status` limpio después (los gates dejan de pisar la
  evidencia versionada de `S.6`/`S.6a` y de dejar PNGs en el repo) y la DB real sin cambios.
  Fuera: el workflow de CI, el inventario de afordancias y los otros 4 gates que llegan por
  `window.*` (`ui1`, `ui1b`, `ui3`, `ui4-skills`).
  Ejecutado por: luna · Spec: docs/specs/CI.2.A.md (4 rondas; borrado al cerrar)
  Los 5 llegan clickeando (Settings → proyecto → pestaña; `ui81` desde el Chat de arranque),
  declaran runtime, escriben artefactos en un temporal y ya no pisan la evidencia de `S.6`/`S.6a`.
  `s6`/`s6a` registran el fixture con `upsertProject` en su home aislado y afirman el
  `x-orchestos-project-id` de `/api/plan`. `ui81` excluye las barras `width:` por CLI y solo
  reescribe el baseline con `--update-baseline`.
  **Lo que destaparon las rondas:** (r2) `mkdtemp` sin `await` dejaba una carpeta
  `[object Promise]/` en el repo; `ui4-specs` fallaba 2/3 por `waitForTimeout` fijos — (r4) cero
  `waitForTimeout`, esperas por locator, y un `click().catch(() => {})` que clickeaba cualquier
  cosa reemplazado por el botón concreto. (r3) Error del cerebro en r2: `mountedIslandCount()`
  cuenta todas las islas (hoy hay permanentes), así que `=== 1` estaba caducado; se afirma que no
  crece. El probe vive en `#main`, que `App.rerender()` borra por diseño (`ui.tsx:61`): el botón
  real de idioma lo remonta; la supervivencia al repintado de las islas reales la afirma `ui4-specs`.
  Gate en vivo: dashboard real en :4330, corridas del cerebro — `ui0` 16/16, `ui81` 5/5, `s6`
  18/18, `s6a` 22/22, 3 corridas seguidas cada uno; `ui4-specs` 20/20, 5 seguidas. DB real igual
  antes y después (118 `plan_items`), `git status` sin archivos nuevos tras correrlos, grep de
  `App.go|state.screen|navModeBtn|setLang(` vacío. `tsc` limpio; `bun run test:coverage` 1443 pass
  / 0 fail.

> **Observaciones de Carlos (2026-09-16), pendientes de incorporar a un spec; no añadirlas al alcance de UI.9.5 sin planificar:** al seleccionar distintos proyectos, la interfaz no debe hacer parecer que todos comparten el mismo workspace; cada proyecto debe conservar y mostrar su propio contexto y datos (Settings, tasks/runs, etc.). Al pasar el cursor por la fila de un proyecto, mostrar a la derecha un botón de tres puntos con acciones de proyecto como `Project settings` y `Delete project`. Incluir también un control claro para expandir/colapsar los agentes de ese proyecto. Al diseñarlo, volver a mirar las capturas de Orca citadas en `docs/done/ui/ui-reference-patterns.md` (A.1–A.3) y respetar su jerarquía de proyectos/agentes; Carlos señala que esta referencia visual no se está reflejando suficientemente.

> **Observaciones de Carlos (2026-09-16), pendientes de spec separado para cuotas e iconografía:** la barra inferior de uso por CLI debe mostrar únicamente las cuotas de 5 h y 7 d; las cantidades de tokens por modelo pertenecen a Settings, no a esas tarjetas. Reducir el texto redundante dentro de los cuadros de cuota (por ejemplo, no repetir “Codex” en dos niveles). Las cuotas deben refrescarse al abrir el panel, cuando se use el CLI y periódicamente mientras siga abierto. Los iconos de CLI deben conservar sus colores originales. Investigar además por qué el icono/avatar de Codex usado al iniciar un chat nuevo se ve distinto al que aparece en la ventana de uso y unificarlo con el asset correcto.

> **Hallazgo de verificación (2026-09-17), pendiente fuera de UI.9.5:** con OrchestOS iniciado en modo Dev, al cambiar a Chat el componente `Sidebar` puede recibir `generalSessions: undefined` de `App.syncNav()` y lanzar `TypeError` en `generalSessions.filter()` antes de que termine la carga de sesiones. Se reprodujo al recargar en Dev y cambiar a Chat. No corregido aquí: es una regresión del estado del shell Chat | Dev, no del inspector; resolver en un ítem/spec propio.

### Fuera de alcance del Sprint 30 (explícito)

- Migrar i18n a una librería (el **puente** de `UI.0` sí entra; la librería no).
- Tocar handlers, endpoints o cualquier cosa de `src/dashboard/*.ts` — verificado el 2026-08-22:
  ni siquiera hace falta para servir el bundle.
- Cambiar navegación, rutas o comportamiento funcional durante la **migración** (`UI.0`–`UI.6`) —
  esa parte es puramente visual/estructural.
  **Excepción única y explícita: `UI.7`** (resuelto 2026-08-22 — el plan se contradecía a sí
  mismo: prohibía cambiar navegación y a la vez incluía un ítem titulado "Navegación nueva", que
  borra `SCREENS.runner`, elimina el flag `localStorage['orchestos-mode']` y mueve
  Memory/Instincts/Project dentro de Settings). `UI.7` es el **único** ítem autorizado a cambiar
  navegación y comportamiento, corre **al final** y absorbe los veredictos ya decididos en CC.0 y
  el ex-CC.4. Ningún otro ítem toca navegación: si aparece la tentación durante `UI.0`–`UI.6`, se
  anota para `UI.7` y se sigue.
- Rediseñar pantallas mientras se migran.

### Riesgo principal

No es React. Es que **a mitad de camino queden dos sistemas conviviendo indefinidamente.**
Por eso UI.1 es un gate de abortar real, y por eso el orden es shell→pantallas y no al revés.

---

<a id="plan-orden-ci-5"></a>
- [x] **CI.5 — ⚡ CI rojo desde 2026-09-23 02:44: 5 tests que pasan en el Mac fallan en ubuntu.** (abierto 2026-09-24; cerrado 2026-09-24 — CI run 36056206658 verde, `test:coverage` 1533/0)
  Causas (4 reproducidas en local con `env -i`, HOME temporal, sin CLI, `user.useConfigOnly=true`): `session-status`
  llamaba `detectInstalledClis()` real (sin `codex` en CI) → `detectClis` inyectable; `serveStatic` servía el
  `main.js` gitignoreado → `appDir` inyectable; R.6 hacía `process.env.HOME = home`, que **Bun ignora en runtime**
  (`os.homedir()` sigue en el home real: leía el `~/.claude` del Mac) → `HOME` en el env del spawn; borrado de tareas:
  sin identidad git en ubuntu el commit falla y `Bun.spawnSync` **tampoco ve cambios a `process.env`** → identidad en
  el `.git/config` del repo temporal. Entorno limpio tras el arreglo: 28/0.
  Hermano sin arreglar (producto, fuera de alcance): sin identidad git, borrar desde el dashboard responde 200 y deja
  `tasks.yaml` staged (`commitTasksYaml` no mira el exit code, `handlers/tasks.ts:191`).
  Luna hizo 3 de 4 arreglos; el de identidad git vía `process.env` no funcionaba y lo rehizo el cerebro.
  Ejecutado por: luna · Spec: docs/specs/CI.5.md

<a id="plan-orden-ci-4"></a>
- [x] **CI.4 — ⚡ Higiene de gates: Luna 6 en los turnos reales, test inestable y residuo de tests.** (abierto 2026-09-24, pedido de Carlos; Lote L4; cerrado 2026-09-24 — `test:coverage` 5×1533/0)
  Hecho: los 6 flujos con turno real eligen y comparan `gpt-6-luna`; comentarios de `codex.ts` al día;
  `context-adapters.test.ts:187` con `timeoutMs` 5 000 / test 10 000. Dos intermitentes más que salieron al medir 5
  corridas: `harness-retry.test.ts` (301 s: `runTask` real con `globalThis.fetch` compartido podía salir a OpenRouter
  y escribía en la DB real) → prueba pura de `previousFailureForTask` (`src/run/prompt.ts`), se pierde el cableado
  extremo a extremo `runTask`→provider; `roadmap-profile.test.ts` (18 s: sonda real `bunx tsc`) → sonda inyectada.
  Residuo `.orchestos/adversarial-review-state.json`: no se reprodujo en 10 corridas + 2 `gate:all`; sin arreglo.
  Ejecutado por: luna (2 rondas; r1 movía la credencial de `adversarial-review.test.ts` dentro de `root` y rompía el
  test, revertido por el cerebro) · Spec: docs/specs/CI.4.md (borrado al cerrar).
  Gate en vivo: navegador real (Playwright, `bun run ui:gate` 9 flujos, `text-sweep` registra `gpt-6-luna` · medium) — `docs/done/evidence/CI.4-live.json`.
  **Fuera de scope declarado:** `LEDGER.md`, entrada que exige `ledger:gate` por tocar `src/run/harness.ts`.
  Intermitentes vistos, van a CI.2: `project-delete` (404 `/api/tasks` en consola) y `runs-graph` (940 s), verdes en la 2.ª.
  (1) Carlos 2026-09-24: de ahora en adelante Luna = `gpt-6-luna` (ya es el default de `~/.codex/config.toml`); los
  flujos de `scripts/ui-gate/flows/*.mjs` eligen `gpt-5.6-luna` en el selector para su turno real, y fixtures/tests
  lo nombran. (2) `scripts/context-adapters.test.ts:187` (`readCodexRateLimitsLive` con `timeoutMs: 500` contra un
  binario falso en bun) falló 2 de 4 corridas de `test:coverage` el 2026-09-23: el arranque en frío del falso
  supera 500 ms bajo carga. (3) Un test dejó `.orchestos/adversarial-review-state.json` en la raíz del repo real
  durante `gate:all` (`STATE_PATH`, `scripts/adversarial-review.ts:33`); borrado por el cerebro.
  Spec: `docs/specs/CI.4.md`. Gate: flujos con turno real verdes eligiendo `gpt-6-luna`; `test:coverage` 5 corridas
  seguidas verdes; `git status` sin archivos nuevos tras `gate:all`.

<a id="plan-orden-ci-2"></a>
- [x] **CI.2 — 🧠 Los 12 ui-gates no los corre nada: hacerlos exigibles.** (abierto 2026-09-18; cerrado 2026-09-24, Lote L4 — 9 flujos verdes)
  Hecho: los 13 scripts viejos ya no existen (UI.13.3); `CI.2.A` queda sin objeto. Medido: 9 flujos ≈285 s, 7 con turno
  real Codex. `.github/workflows/ui-gate.yml` (workflow aparte) corre los 3 sin turno real (`smoke`, `plan-doc`,
  `project-delete`); `scripts/pre-push.sh` corre los 9 solo si el push toca `src/dashboard/`, `scripts/ui-gate/` o
  `src/run/`. `run.mjs` levanta el dashboard con `ORCHESTOS_HOME` en su tmpdir y aborta si la DB escapa (DB real
  4|26|288 antes y después). `project-delete`: lecturas en vuelo del proyecto borrado → 404 en consola; `App.tsx` las
  cancela y espera antes del purge. `runs-graph`/`tasks`/`project-tabs`: reintentan como una persona y registran el QA
  del intento fallido en `result.json`.
  **Causa real del `runs-graph` intermitente (sin arreglar aquí, pasa al ítem de roles):** el juez de QA es
  `gpt-4o-mini` hardcodeado (`QA_JUDGE_DEFAULTS`, `harness.ts:172`) y a veces reformula los criterios → R.3 lo rechaza
  (`qa.ts:258`). Rojo conocido ~1/3 hasta que cierre ese ítem (decisión de Carlos 2026-09-24).
  Ejecutado por: luna (2 rondas) · Spec: docs/specs/CI.2.md (borrado al cerrar). Inventario de afordancias: fuera.
  Gate en vivo: navegador real (Playwright, `bun run ui:gate` 9 flujos, project-delete 3/3, runs-graph 16/16 tras r2) — `docs/done/evidence/CI.2-live.json`.
  `gate:all` 1533/0; typecheck y biome limpios.
  - [x] **CI.2.B — `ui:gate`: comprobador en vivo de la app React.** (cerrado 2026-09-23, Lote L1) Ejecutado por: luna (5 rondas) · Spec: docs/specs/CI.2.B.md
    `bun run ui:gate <flujo>`: arranca el dashboard en puerto libre, recorre `scripts/ui-gate/flows/<flujo>.mjs` clickeando,
    una línea `PASS`/`FAIL` por flujo, mata por PID; rechaza flujos que naveguen por `window.state`/`window.OrchestOS`.
    `gate:all` = typecheck + lint + test:coverage + build:app + ui:fidelity:jsx. Primer uso halló un bug real:
    Settings abría en blanco (sección por defecto `project_orchestos`, id de mock) → ahora `project_<id actual>` o `general`.
    Gate en vivo: `docs/done/evidence/CI.2.B-live.json` — Playwright en navegador real, `PASS smoke 6/6` (Chat, Dev,
    Settings del proyecto actual, General → Appearance), 0 errores, sin procesos huérfanos. `test:coverage` 1506 pass / 0 fail.
    Pendiente visto: "Loading live settings…" se superpone al título de Settings mientras carga.
  **Medido el 2026-09-18, no estimado:** `ci.yml:15-19` corre `bun install`, `db:migrate`,
  `test:coverage`, `typecheck` y `lint`. `scripts/pre-commit.sh` corre `tsc`, `security:secrets`,
  `ledger:gate`, `plan:render`, `check-live-gate`, `check-ui-copy` y `check-scope-lock`.
  `scripts/pre-push.sh` corre `test:coverage`. **Ninguno toca `scripts/ui-gates/`**, donde hay
  **12 scripts** (`ui0`, `ui1`, `ui1b`, `ui2`, `ui3`, `ui4-specs`, `ui4-skills`, `ui81`, `ui97`,
  `at91`, `s6`, `s6a`). Se corren a mano el día que cierra su ítem y nunca más.
  **Consecuencia ya pagada, no hipotética:** el gate de `UI.9.4` pasó una vez y el botón
  "+ Add project" se pudrió **dos veces** —invisible por CSS con el sidebar colapsado, después
  borrado por `UI.9.1`— sin que nada se pusiera rojo, con el ítem en `[x]` todo el tiempo
  (`UI.9.7`). Es exactamente el patrón de la Regla cero de `CLAUDE.md`: una regla que nadie hace
  cumplir mecánicamente deja de existir.
  **Pregunta que Carlos hizo y que este ítem contesta** (2026-09-18): *"¿este cambio que se hizo
  se lo tomará en cuenta [al cambiar toda la interfaz]?"*. Hoy no. Lo que tiene que sobrevivir a
  `UI.4`/`UI.5` no es el CSS, es el gate — y hoy el gate tampoco se hace cumplir.
  **A resolver en el diseño, no asumir:** los ui-gates necesitan un dashboard corriendo y
  Playwright; medir cuánto tardan los 12 juntos antes de decidir si van a CI, a `pre-push` o a un
  workflow aparte. Si el costo es mayor que el beneficio, decirlo con el número y proponer un
  subconjunto — no meter 12 gates en cada push por principio.
  Relacionado: `bun run lint` está **rojo por 17 hallazgos preexistentes** (`check-coverage.ts`,
  `check-ledger-gate.ts`, `check-secrets.ts`, `check-test-assertions.ts`, `context-adapters.ts`,
  `eval-run.ts`, `check-sources-drift.test.ts`, `tests/run/*.test.ts`, `docs/done/evidence/*.json`),
  todos `FIXABLE`. CI lo ejecuta, así que CI sigue rojo por eso. Un CI que falla siempre deja de
  dar señal — mismo corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01.
  **Hallazgo 2026-09-18 que amplía este ítem: correr los 12 gates NO basta.** El diagnóstico de
  `UI.9.A` mostró que `30ab117` reescribió `scripts/ui-gates/ui3-shell.mjs` en el **mismo commit**
  que cambió la pantalla, y el gate resultante abre el inspector con
  `page.evaluate(() => window.OrchestOS.openInspectorTool('terminal'))` (`ui3-shell.mjs:58`) en vez
  de clickear. Es estructuralmente incapaz de notar que no existe ningún botón: pasaría en verde con
  cero afordancias en pantalla. Los tres casos comparten forma —"+ Add project" invisible por CSS
  (el gate medía existencia en DOM, no visibilidad), "+ Add project" borrado por `UI.9.1` (el gate
  no se volvió a correr), inspector (el gate se reescribió para saltarse la UI)—: **los gates
  afirman sobre estado alcanzable desde JS, no sobre lo que un humano alcanza con el mouse desde un
  arranque en frío, y los escribe el mismo ítem que cambia la pantalla.**
  Dos propiedades que el diseño de `CI.2` tiene que resolver además de la frecuencia:
  1. **Camino clickeable desde frío:** toda función del producto se ejerce clickeando. Prohibido
     `window.OrchestOS`/`window.state` para *llegar* a una pantalla en un gate (sí para *afirmar*
     sobre el estado una vez ahí). Medir cuántos de los 12 gates violan esto hoy.
  2. **Inventario de afordancias:** algo tiene que comparar qué controles clickeables existían antes
     y cuáles después de un commit, y ponerse rojo cuando desaparece uno que nadie mandó quitar. Sin
     esto, un gate reescrito por el mismo ítem que rompe la pantalla nunca da señal.

  **MEDICIÓN EJECUTADA 2026-09-18 (números reales, un dashboard en :4323, `BASE`/`GATE_BASE`
  apuntando ahí; no estimaciones).** Son **13** gates, no 12 — `ui9a-inspector.mjs` se sumó ayer.

  | gate | runtime | tiempo | resultado hoy |
  |---|---|---|---|
  | `at91-format-smoke` | node | 15.4s | verde (formato JSON, sin líneas PASS/FAIL) |
  | `s6-sprint-board` | **bun** | 31.7s | **ROJO — podrido** |
  | `s6a-sprint-board` | **bun** | 31.6s | **ROJO — podrido** |
  | `ui0-islands` | node | 9.3s | ROJO (2 FAIL) |
  | `ui1-model-combo` | node | 15.0s | verde (27 PASS) |
  | `ui1b-remaining-callsites` | node | 8.5s | verde (9 PASS) |
  | `ui2-design-system` | node | 13.2s | ROJO (1 FAIL) |
  | `ui3-shell` | node | 10.0s | verde (20 PASS) |
  | `ui4-skills-screen` | node | 11.4s | verde (22 PASS) |
  | `ui4-specs-screen` | node | 14.4s | ROJO (2 FAIL) |
  | `ui81-visual-consistency` | node | 5.0s | ROJO (1 FAIL) |
  | `ui97-bugs` | node | 11.5s | verde (25 PASS) |
  | `ui9a-inspector` | node | 4.1s | verde (17 PASS) |

  **Serie completa: ~181s (3 min)** con el runtime correcto de cada uno. **6 de 13 están rojos hoy**,
  sin que nadie lo supiera.

  **Paralelizar no es opción — medido, no supuesto.** Los 11 gates de node lanzados a la vez contra
  el mismo dashboard: **98s** (apenas menos que en serie) y **resultados basura** — 9 de 11
  terminaron con 0 PASS / 0 FAIL por `TimeoutError` de contención. Los gates asumen un dashboard
  para ellos solos. Paralelizar exige un dashboard por gate, y ahí el ahorro se lo come el arranque.

  **Dos podridos que la medición destapó, y son la prueba del ítem:**
  - `s6`/`s6a` se importan con `bun:` y **fallan de entrada con `node`**
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). Con `bun` sí arrancan, y ahí mueren en
    `click: Timeout 30000ms exceeded — waiting for locator('#navModeBtn')`: ese botón **ya no
    existe**, lo borró `UI.7` al eliminar el flag de modo. Es el mismo patrón que el "+ Add project":
    el gate quedó en `[x]` mientras la pantalla que medía desapareció.
  - Ni siquiera hay un runtime común: 11 gates son `node`, 2 son `bun`. Nada lo declara en ningún
    lado; se descubre corriéndolos.

  **Propiedad 1 medida (camino clickeable desde frío): 6 de 13 la violan hoy** —
  `ui3-shell.mjs:58` (`window.OrchestOS.openInspectorTool`), `ui1-model-combo.mjs:37`,
  `ui1b-remaining-callsites.mjs:54-118`, `ui4-specs-screen.mjs:58-212`,
  `ui4-skills-screen.mjs:47-204`, `ui81-visual-consistency.mjs:31` (todos siembran o navegan por
  `window.state` en vez de clickear). Los 7 restantes ya llegan clickeando.

  **Veredicto del número, antes de elegir dónde corren:** 3 min descarta `pre-push` (hoy tarda 20s;
  multiplicarlo por 10 lo vuelve un `--no-verify` garantizado) y descarta meterlos en el job de CI
  actual. Y con 6 de 13 rojos, engancharlos hoy a cualquier gate obligatorio los deja rojos
  permanentes — exactamente el corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01 ("un CI que
  falla siempre deja de dar señal"). El orden obligado es: **primero verdes, después exigibles.**

  **DIAGNÓSTICO DE LOS 6 ROJOS (2026-09-18, leído en el código y probado en vivo).** Pedido por
  Carlos antes de decidir. El reparto importa: **5 de 6 son el gate podrido, 1 es un bug real
  del producto.** Eso es el ítem probándose a sí mismo.

  - **`ui2-design-system` — EL PRODUCTO, no el gate.** `.filter-tab` usa
    `border-radius: var(--radius-lg)` (`screens.css:100`) y ese token vale **8px**
    (`styles.css:44`). El componente React tiene `rounded-[20px]` **hardcodeado**
    (`tabs.tsx:35`), con un comentario encima que afirma "Espeja `.filter-tab`: … radio 20px".
    Alguien bajó el token de 20px a 8px y el React quedó atrás: hoy las pestañas React se ven
    distintas de las vanilla en pantalla. Arreglo: consumir el token, no repetir el número.
  - **`ui0-islands` — gate de una fase superada.** Afirma "sin `?island-probe` no se monta
    ninguna isla". Era la regla del Mes 30 mientras React era experimental. Hoy hay **4 islas
    permanentes en producción a propósito**: `model-combo` (`app.js:2675`), `screen-specs`,
    `screen-skills` y `screen-plan` (`screens-ops.js:2352-2388`). El producto está bien; la
    afirmación caducó con `UI.1`/`UI.4`.
  - **`ui4-specs-screen` — dos afirmaciones caducadas.** (a) Exige 5 `<th>` incondicionalmente,
    pero la 5ª columna es el checkbox de bulk y está detrás de `selectable`
    (`SpecsScreen.tsx:178`); el gate nunca entra en modo bulk. (b) Busca `.badge` amber/green,
    pero `UI.3.5` reemplazó los dos badges de color por `StatusRail` —glifo + mono—
    deliberadamente (`SpecsScreen.tsx:292-299`).
  - **`ui81-visual-consistency` — trinquete mal diseñado.** Los 5 `[style]` de Chat son:
    `display:none` del `#chat-file-input`, un `pointer-events:none`, y **3 barras
    `.session-statusbar-cli-fill` con `width:<pct>` dinámico — una por CLI**. El baseline de 4 se
    calibró con menos CLIs. Cuenta atributos `[style]` a ciegas, así que se pone rojo cuando
    cambian los **datos** (cuántos CLI hay configurados), no cuando empeora el código, y mete en
    la misma bolsa el `width` calculado —única forma correcta de pintar una barra— que un estilo
    de maquetación pegado a mano.
  - **`s6` / `s6a` — se reparan, no se borran.** Miden el sprint board y el ciclo `commitPending`,
    y **esa pantalla sigue viva**: es la isla `screen-plan` → `PlanBoardScreen` (`ui.tsx:47`). Lo
    que murió es el camino: `#navModeBtn`, el toggle humano/operador que ambos clickean
    (`s6:98,168`, `s6a:102,157,178,213,254`), lo borró `47b40c6` (`UI.8.3`, "muere el modo
    avanzado"). Mismo patrón que "+ Add project" y que el inspector de `UI.9.A`. Además hay que
    **declarar el runtime**: importan `bun:` y revientan con `node`
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); nada en el repo dice cuál usa cuál.

  **DECIDIDO POR CARLOS 2026-09-18 — dónde corren:** workflow de CI **aparte**, no `pre-push` ni
  el job de `ci.yml`. Levanta el dashboard, corre los 13 en serie (~3 min) y no toca la velocidad
  del push local ni contamina el job de tests. Pendiente de decisión: qué se repara primero.

  **PENDIENTE DE DECISIÓN DE CARLOS (planteado 2026-09-18, sin respuesta todavía):** son dos
  trabajos distintos. El de `ui2` es un fix de producto de una línea (token en vez de `20px`
  hardcodeado). Los otros 5 son reescribir afirmaciones de gates — y cuatro de ellos (`ui0`,
  `ui4-specs`, `s6`, `s6a`) hay que reescribirlos igual bajo la propiedad 1 (llegar clickeando,
  no por `window.state`), así que repararlos ahora por separado es hacer el trabajo dos veces.
  Opciones: (a) un solo ítem "despodrir + reescribir clickeando los 13"; (b) el fix de `ui2` ya,
  suelto, y el resto después. Nadie arranca a reparar hasta que esto se decida.
  **DECIDIDO POR CARLOS 2026-09-21:** `ui2` ya salió suelto (`UI.9.B`); los **5 restantes**
  (`ui0`, `ui4-specs`, `ui81`, `s6`, `s6a`) van en **un solo ítem**, `CI.2.A`: se despudren y se
  reescriben llegando clickeando en la misma pasada. Spec del cerebro, ejecuta Luna.
  **BLOQUEO HALLADO AL PREPARAR EL SPEC (2026-09-21, inventario de Luna, verificado por el
  cerebro en el código):** Specs, Skills y Plan board **no tienen camino clickeable desde frío**.
  `NAV` solo lista `chat` y `settings` (`app.js:144-149`), y el Sidebar solo pinta esos `data-nav`
  (`Sidebar.tsx:354-367`). En todo el front, el único `App.go` a una de esas tres pantallas es
  `App.go('skills')` desde el resultado de búsqueda de una skill en la paleta (`app.js:2335`).
  Specs y Plan board no se alcanzan de ninguna forma. Las islas `screen-specs`/`screen-skills`/
  `screen-plan` (`screens-ops.js:2349-2390`) montan bien, pero **ningún humano llega a ellas**:
  es el mismo patrón que "+ Add project" y el inspector, ahora en tres pantallas enteras, y los
  gates en verde lo tapaban justamente porque navegaban por `window.state`. Esto deja a 4 de los 5
  gates (`ui0`, `ui4-specs`, `s6`, `s6a`) sin camino que clickear. Solo `ui81` (Chat) se puede
  reescribir ya. **Decisión de producto pendiente de Carlos:** dónde vuelven a estar accesibles
  estas pantallas, o si se retiran (y con ellas sus islas y sus gates).

  **Efecto secundario descubierto al medir, a resolver en el diseño:** correr los gates **muta el
  working tree**. `at91-format-smoke` sobreescribió `docs/done/evidence/AT.9.1-live.json` —la
  evidencia de cierre commiteada el 2026-09-15— con la corrida de hoy (revertido a mano), y
  `ui0`/`ui1`/`ui1b`/`ui2`/`ui4-*` dejan PNGs sueltos en la raíz del repo. Un workflow que corre
  los 13 en cada push no puede ir pisando evidencia histórica: los artefactos van a un directorio
  temporal o a artifacts del job, nunca sobre archivos versionados.

  **Y lo más grave, descubierto al intentar commitear esta medición: `s6a` escribe en la DB real
  del usuario.** El pre-commit abortó con `render(DB): "# S.6a fixture"` — `~/.orchestos/db.sqlite`
  había quedado con los **3 ítems del fixture (A, B, C)** en lugar de los **113 de `PLAN.md`**, y
  `plan_doc_segments` con el documento del fixture. `src/db/sqlite.ts:12` congela `DB_PATH` en el
  primer import a partir de `ORCHESTOS_HOME`, y el fixture de `s6`/`s6a` no aísla esa parte. El
  resto de las tablas quedó intacto (projects 2, chat_sessions 11, runs 111, run_steps 45), así
  que el daño fue acotado a `plan_items`/`plan_doc_segments`. Reparado con `bun run plan:reconcile`
  (113 ítems reconciliados desde `PLAN.md`, 3 huérfanos A/B/C borrados; `plan:render --check`
  verde, `bun run next` vuelve a listar los 27 de siempre), con copia previa en
  `~/.orchestos/db.sqlite.pre-reconcile-*`. **Lo salvó que `PLAN.md` es la fuente versionada.**
  Requisito duro para el workflow de `CI.2`: ningún gate corre sin `ORCHESTOS_HOME` aislado, y eso
  se verifica en el propio gate, no se confía. Si esto hubiera pasado en una tabla sin respaldo en
  git —`runs`, `chat_messages`— no había vuelta atrás.
  **Aislamiento de `s6`/`s6a` HECHO 2026-09-21.** Causa: importan `src/db/sqlite.ts` en el mismo
  proceso (`s6a-sprint-board.mjs:79`) sin `ORCHESTOS_HOME`. Ahora cada uno crea un home temporal
  propio, lo fija antes de cualquier import y **aborta si `DB_PATH` no cae dentro** (el requisito
  de arriba, verificado en el gate). Evidencia en vivo: ambos corridos con `bun`; mueren en el
  `TimeoutError` de `#navModeBtn` —después de `importPlan`— y la DB real queda igual antes y
  después (114 `plan_items`, 0 de A/B/C, 225 `plan_doc_segments`). Los otros 11 gates no abren la
  DB: pegan a un dashboard externo (`BASE`), así que su aislamiento depende de cómo se levanta ese
  dashboard — lo resuelve el workflow.

<a id="plan-orden-ci-6"></a>
- [x] **CI.6 — ⚡ Flujos de ui:gate: fin de turno = respuesta de POST /api/chat, no composer vacío.** (abierto 2026-09-28, cerrado 2026-09-28)
  UI.20 vacía el composer al enviar; `chat-roles` y `chat-context` leían SQLite antes de cerrar el turno y fallaban en
  el pre-push de UI.21. Ahora esperan la respuesta del POST y el mensaje visible.
  Ejecutado por: luna (1 ronda; la primera se detuvo en el preflight por falta de ítem) · Spec: docs/specs/CI.6.md
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.6-live.json`: `chat-roles` 11/11, `chat-context` 5/5.

<a id="plan-orden-ci-7"></a>
- [x] **CI.7 — ⚡ Pre-push: 3 flujos fallan por latencia o capricho del modelo, no por la UI.** (abierto 2026-09-28, cerrado 2026-09-28)
  Bloquea el push de UI.20/UI.21/CI.6. Evidencia (`$TMPDIR/ui-gate-*/result.json`, 2026-09-28): `usage-bar` 70 %
  quedó `normal` (el endpoint devuelve la caché vieja si el refresco tarda >3 s,
  `src/dashboard/handlers/session-status.ts:10`); `chat-turn-details` sin bloque de herramienta porque Codex respondió
  "no puedo ejecutar comandos" (captura `tool-and-reasoning.png`); `chat-streaming` "turn 2 sampled while pending"
  cuando el turno 2 terminó antes de muestrear; `chat-streaming`/`chat-context` HTTP 502 de Claude sin el cuerpo.
  Hecho: `usage-bar` reintenta refresh hasta 30 s; `chat-turn-details` hasta 3 intentos y exige el bloque solo si el
  timeline registró `tool_use`; `chat-streaming` hasta 3 turnos largos para muestrear mid-turn; errores HTTP de
  `/api/chat` con cuerpo. Aprendido: biome por defecto no detecta identificadores sin declarar en los flujos —
  `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows` sí (Luna dejó `secondChatPrompt`).
  Ejecutado por: luna (4 rondas; r1 paró en baseline de sandbox, r2 esperaba el POST y mataba el muestreo) · Spec: docs/specs/CI.7.md
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.7-live.json`: 15 flujos (14 verdes + `chat-streaming`
  15/15 tras r4), `test:coverage` 1573/0.

<a id="plan-orden-ci-8"></a>
- [x] **CI.8 — ⚡ codex-live compara markdown crudo contra texto renderizado.** (abierto y cerrado 2026-10-01) Pre-push
  bloqueado: 3 pasos de `codex-live` fallan con el DOM en orden correcto. Spec `docs/specs/CI.8.md`. Arreglo: `plain()`
  normaliza markdown/comillas en ambos lados. Evidencia: `ui:gate codex-live chat-roles` → 14/14 y 11/11 (cerebro, fuera
  del sandbox); pre-push completo en el push de este commit. Sin delegación: no (Luna).

<a id="plan-orden-ci-9"></a>
- [x] **CI.9 — 🔍 La sonda de `--restricted` se envenena dentro de la suite de ui-gates.** (abierto y cerrado 2026-10-03)
  Ejecutado por: Sol (`gpt-6.1-sol`, 3 rondas: CI.9, CI.9.1, CI.9.2) · Spec: docs/specs/CI.9.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.9-live.json`: los 15 flujos del pre-push en verde.
  Pre-push bloqueado 2 de 2: tras 12 flujos verdes, `chat-streaming` y `chat-context` → HTTP 502 "Claude Code no soporta
  --restricted"; solos pasaban. Causa medida (shim de `claude` en /tmp, 15 flujos, 134 `--help`): 131 bajo 0.5 s, pero 3
  encimadas en un pico tardaron 3.09/2.12/1.63 s; con timeout de 2 s la sonda daba `null` y `capabilityCache` guardaba
  ese `false` toda la vida del único dashboard del ui-gate (`scripts/ui-gate/run.mjs:257`). Arreglo en
  `src/run/executors/cli-registry.ts`: no se cachean fallos (sigue fail-closed), timeout 10 s, línea `[cli-capability]`
  en stderr al fallar; 3 tests nuevos. Hermanos cazados al re-correr: CI.9.1 `chat-streaming` tomaba la respuesta
  anterior como burbuja en vivo ("Cuarenta" cierra 1–40 y abre 41–80) → ahora busca después del prompt; CI.9.2
  `text-sweep` ENOTEMPTY al borrar el proyecto temporal → `maxRetries` en los 10 flujos que no lo tenían (precedente
  `codex-live`); CI.9.3 tras recargar leía el DOM antes de que cargara la sesión → espera el último prompt; CI.9.4
  corrige CI.9.1 (si el prompt aún no está pintado, vuelve a muestrear). `test:coverage`: 1604 pass, funciones 75.37 % / líneas 62.28 %. Sin delegación: no (Sol).

<a id="plan-orden-ci-10"></a>
- [x] **CI.10 — ⚡ `chat-streaming` y `codex-live` solo bloquean el push cuando cambia el chat.** (abierto y cerrado 2026-10-03, decisión de Carlos + QA de Sol)
  Ejecutado por: Luna (`gpt-6-luna`, 3 rondas: CI.10, CI.9.5 A-C, CI.9.5 D) · Spec: docs/specs/CI.10.md y CI.9.5.md (borrados al cerrar)
  Medido: con CI.9 aplicado, 6 corridas de los 15 ui-gates; esos dos fallaron 4 veces por latencia del modelo real
  (cada vez un paso distinto), los otros 13 nunca. Primera versión: sacarlos del pre-push. **QA de Sol (`gpt-6.1-sol`),
  1.ª vuelta: RECHAZADO**, 4 hallazgos verificados por el cerebro: (1) tras CI.9 un fallo de la sonda se reintentaba en
  cada consulta, hasta 3 `spawnSync` de 10 s por POST de chat (también de Codex) → ahora timeout 5 s y fallo cacheado
  30 s (`CAPABILITY_FAILURE_RETRY_MS`, reloj inyectable, test); (2) el muestreo de `chat-streaming` pasaba con
  `[prompt, viva]` o con la burbuja viva duplicada → ahora exige la respuesta anterior y `liveCount === 1`; (3) sacarlos
  dejaba el chat sin gate automático → `scripts/pre-push.sh` los corre cuando el diff toca `chat_paths`, con 1 reintento
  (un fallo de latencia pasa, una regresión falla 2 veces); (4) no estaba demostrado que no hubiera bug → CI.11.
  **2.ª vuelta: RECHAZADO** por `chat_paths` incompleto (`App.tsx` `handleSendMessage`, `chat-cli-models.ts`) →
  agregados; comprobado: App.tsx/chat-cli-models.ts → chat, handlers/tasks.ts → no. `test:coverage` 1604 pass,
  funciones 75.37 % / líneas 62.29 %. Hook sincronizado (`diff` vacío). Sin delegación: no (Luna, QA Sol).

<a id="plan-orden-ci-13"></a>
- [x] **CI.13 — ⚡ "Run" en Tasks deja escapar el error de la tarea.** (abierto y cerrado 2026-10-04) `onRunTask`
  (`App.tsx:1234`) llama `runTask` sin `catch`: si la tarea falla, la excepción sale como `pageerror` y la UI no
  muestra nada. Visto en el pre-push de 6432e9c (`project-tabs`: "Retry scheduled: missing declared output(s)").
  Gate: `ui:gate project-tabs` verde y el error visible en `taskError`.
  Ejecutado por: luna · Spec: docs/specs/CI.13.md
  Hecho: `onRunTask` limpia el error, lo captura en `taskRunError` y recarga tareas (patrón de `handleRunNextTask`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.13-live.json`; `project-tabs` 24/24. No
  verificado en vivo: el camino de error (esa corrida la tarea de Codex sí escribió README); solo por lectura.

## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-ci-ci-21"></a>
- [x] **CI.21 — 🔍 El orquestador a veces se niega ("solo lectura") en vez de crear la tarea.** (abierto 2026-10-12)
  `chat-turn-details` falló en el pre-push y 1 de 2 corridas a solas en el paso `held task card visible` (aserción
  real desde R.8.6): al pedido "Modifica README.md…" el CLI respondió "No puedo modificar archivos en este entorno
  porque el acceso al sistema de archivos es de solo lectura" y no puso el marcador. La instrucción del chat
  (`chat.ts:1282`) no dice que su propio sandbox de solo lectura es lo esperado. Candidato a causa de CI.18 (mismo
  paso del marcador en `chat-roles`). Gate: `chat-turn-details` 5 corridas seguidas + `chat-roles`.
  Ejecutado por: gpt-6-luna (rol `mecanico`).
  Hecho: la instrucción del chat pasa a `buildAutoTaskInstruction` (`chat.ts`) y la rama con proyecto añade que el
  chat corre en solo lectura a propósito y que nunca se niegue ni lo mencione: ese pedido es el caso del marcador.
  Test en `chat-task-marker.test.ts` (6/0).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.21-live.json` — `chat-turn-details` 26/26 en 5
  corridas seguidas (antes: 1 fallo en el pre-push y 1 de 2 a solas) y `chat-roles` 11/11. CI.18 sigue abierto: 5
  corridas no prueban que su intermitencia tuviera esta causa.

<a id="bloque-ci-ci-22"></a>
- [x] **CI.22 — 🔍 `usage-bar` falla en el pre-push completo: "Codex: No quota limits reported".** (abierto 2026-10-12)
  Falló 2 veces seguidas dentro del pre-push (pasos `quota is visible without a project session` y `quota remains
  visible after a real turn`) y pasó a solas entre medias. Medido en frío: `readCodexRateLimitsLive` responde en
  0.5–0.8 s (6 lecturas); el tope es 3 s (`scripts/context-adapters.ts:201`) y al vencer devuelve `[]` sin dejar
  rastro. Ya anotado como intermitente en `AGENTS.md:202`. Arreglo: tope de 8 s y una línea de log con el tiempo
  cuando vence. Gate: tests del adaptador + pre-push completo verde.
  Ejecutado por: gpt-6-luna (rol `mecanico`).
  Hecho: `CODEX_RATE_LIMITS_TIMEOUT_MS = 8_000` y una línea `[rate-limits] … tras N ms` cuando no hay respuesta;
  tests con binario falso (`scripts/context-adapters.test.ts`, 15/0); `AGENTS.md` actualizado. El resultado del
  pre-push completo se anota en el commit siguiente.

<a id="bloque-ci-ci-14"></a>
- [x] **CI.14 — 🔍 GitHub Actions deja de fallar por la misma clase de bug.** (abierto 2026-10-06, GO de Carlos)
  Datos 2026-09-05→10-05: CI rojo en 42/73 pushes en 3 rachas (lint 11-22 sep; `process.env`/HOME 23-24 sep; fixture git
  sin identidad 4-5 oct), todas "pasa en el Mac, falla en Linux". Mutation Shards cancelado 4 noches (10-03→10-06):
  cada mutante corre `src/__tests__` entero; R.7 (`934c7b4`) sumó `tasks-concurrency` (9.5 s) y el dry run pasó de 8 s a
  21 s × 2,227 mutantes > 180 min. Partes: (A) cada shard corre solo los tests que alcanzan sus archivos mutados;
  (B) pre-push corre `test:coverage` sin config global de git, con HOME temporal y PATH mínimo; (C) startup-guard avisa
  al arrancar si el último CI/Mutation/Secret Check/UI gate terminó distinto de `success`. Gate: dry run por shard
  medido; contraprueba de (B) con el fixture sin identidad; tests del guard; disparo manual de Mutation Shards.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/CI.14.md
  Cerrado 2026-10-06. (A) Mutation Shards manual `37480050158` verde 4/4: executors 121 min, orchestration 65,
  runtime-boundaries 37, context-routing 26 (antes: 2 shards cancelados a 180 min las 4 noches). Scores más bajos que el
  10-02 porque el 10-02 contaba kills falsos de un test flaky (`enforceContract`): 615 de 1,881 → ahora 1. Evidencia:
  `docs/done/evidence/CI.14-mutation-2026-10-06.md`. (B) pre-push verde con HOME/PATH/gitconfig tipo CI; contraprueba:
  sin `-c user.*` en el fixture de `tasks.test.ts` falla "Author identity unknown" (con `GIT_CONFIG_GLOBAL=/dev/null` NO
  fallaba: git del Mac deduce la identidad). Destapó y arregló un bug real: el perfil Seatbelt de adversarial-review no
  resolvía symlinks (`/var`→`/private/var`) y la regla de credenciales no aplicaba. (C) startup-guard: 4 consultas
  `gh api` en paralelo, 1.3 s, avisó la Mutation cancelada; sin remoto falla abierto. CI/UI gate/Secret Check verdes en `9fda072`.
  Visto sin ítem: `enforceContract` flaky bajo Stryker → CI.15.

<a id="bloque-ci-ci-15"></a>
- [x] **CI.15 — 🔍 `contract.test.ts` falla en el sandbox de Stryker por un tmp fijo compartido.** (abierto 2026-10-06)
  Evidencia (reportes `mutation.json` de `36987578986` y `37480050158`): 189 kills falsos en 10-02 y 1 en 10-06 con la
  misma firma: `ENOENT: realpath '.stryker-tmp/sandbox-*/tmp/contract-a1'` justo después de `mkdirSync` del mismo path,
  a veces en `path-policy.ts:60` y a veces en `:74` (el directorio desaparece en una ventana < 1 ms de código síncrono →
  otro proceso lo borra). 77 de los 189 son mutantes cosméticos (strings de `graph-summary.ts`) donde solo falla
  contract: no lo causa el mutante. No reproduce en el Mac: 5/5 corridas de `bun test src/__tests__` verdes y ningún
  `bun test` anidado al muestrear `ps`. Quién borra en Linux queda sin identificar. Arreglo: `TMP_ROOT` único por test
  con `mkdtempSync(tmpdir())` (convención del repo), sin path compartido en `tmp/` del repo. Gate: `contract.test.ts`
  verde, `test:coverage`, y próxima Mutation Shards sin `contract-a1` en ningún `statusReason`.
  Ejecutado por: Luna (gpt-6-luna) · 2026-10-06: arreglo aplicado; `contract.test.ts` 18/18; `test:coverage` verde 3 de
  4 corridas (la 1.ª: 1 fail + 1 error no capturados; las 3 siguientes 1636/0).
  Cerrado 2026-10-10: Mutation nightly `38040297323` (commit `96446ec`, incluye el arreglo) verde 4/4 y 0 menciones
  de `contract-a1` en los 4 `mutation.json`. Quién borraba el path en Linux sigue sin identificar (ya no afecta).
  Sin delegación: este cierre es solo verificación; el arreglo lo aplicó Luna en `42775b5` (spec no versionado).

<a id="bloque-ci-ci-16"></a>
- [x] **CI.16 — 🔍 `usage-bar` intermitente: la barra muestra la cuota de Claude vieja.** (abierto 2026-10-09)
  Falló 2 de 4 corridas el 2026-10-09 (`an expired Claude window is shown as fully available: Claude Code: 61%`;
  61 % = 100 − 39 del fixture `new-session` anterior). Mecanismo verificado leyendo el código: `handleApiSessionStatus`
  (`src/dashboard/handlers/session-status.ts`) espera el refresco como mucho 3 s y si no, devuelve la caché vieja. El
  refresco (`readActiveSessionStatuses`) incluye la lectura en vivo de la cuota de Codex y tarda 1.5–2.2 s sin carga,
  más de 3 s bajo la carga del gate. La cuota de Claude es una lectura de archivo barata, pero queda atada a la lenta de
  Codex. Es el pendiente anotado "usage-bar falla a veces por `account/rateLimits/read`". Contraprueba: sin la caché de
  R.8.1.1 pasó 1/1, y con ella falló 2 y pasó 2: no lo causa R.8.1.1. Arreglo (GO de Carlos 2026-10-10): separar la cuota de
  Claude (statusline, se lee en cada request) del refresco lento de Codex.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/CI.16.md
  Cerrado 2026-10-10. `withFreshClaudeQuota` en `src/dashboard/handlers/session-status.ts` relee el statusline de Claude
  en las 3 respuestas del GET (la caché sigue para Codex). Tests 6/6; `test:coverage` 1646/0; `gate:evidence
  CI.16-usage-bar` 4 corridas seguidas PASS 18/18 c/u (antes 2/4 fallaban). Sin contraprueba determinista: el fallo
  dependía de que Codex tardara >3 s; queda la serie de 4 verdes como evidencia.

<a id="bloque-ci-ci-12"></a>
- [x] **CI.12 — 🔍 `tasks-concurrency` (5 SIGKILL) falla por timeout del lock dentro de la suite completa.** (abierto 2026-10-03, cerrado 2026-10-14)
  Visto 1 vez en el pre-push: `error: file-lock: timeout waiting for …/.orchestos/tasks.lock` → `(fail) … recovers valid
  YAML after five SIGKILL interruptions and accepts a following mutation quickly [14649.63ms]`. Solo pasa 3/3 y pasó en
  2 `test:coverage` completos del mismo día. Hipótesis sin verificar: bajo carga, un lock que dejó un proceso matado
  tarda más en declararse stale que el plazo del test. Archivo: `src/__tests__/tasks-concurrency.test.ts`.
  **Cierre 2026-10-14:** tumbó CI en `dff365d` (run 38617847158, 30985 ms). Causa: `withFileLock` creaba el candado
  con `openSync('wx')` y escribía `pid:uuid` después; un SIGKILL entre ambos dejaba un candado vacío que solo se
  recupera por mtime (60 s). Arreglo: token en temporal `<lock>.<pid>.<uuid>.tmp` + `linkSync` atómico; limpieza de
  temporales de PIDs muertos. Tests nuevos: token publicado atómico, huérfanos, 20 SIGKILL sin candado vacío.
  Evidencia: `typecheck` y `biome` limpios; `tasks-concurrency.test.ts` 9/9 ×5; `test:coverage` 1770 pass, 1 fail ajeno
  (409 de ERP.4.13 por identidad git global del Mac, NEXT.md:69). Sin contraprueba contra HEAD: la ventana es de µs.
  Ejecutado por: gpt-6-luna (mecanico)

<a id="bloque-ci-ci-17"></a>
- [x] **CI.17 — 🔍 `usage-bar` falla con `ENOTEMPTY` al borrar su tmpdir.** (2026-10-11) 2.ª vez (2026-10-05, 2026-10-11,
  bloqueó un push). `maxRetries: 10, retryDelay: 300` en los 8 `rmSync` de flows que no lo tenían (como chat-context).
  Evidencia: `usage-bar` 18/18, `tasks` 13/13, biome limpio. Sin contraprueba determinista: el fallo es una carrera con
  el dashboard escribiendo tras el purge; la prueba real es que no reaparezca en los pre-push.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/CI.17.md

<a id="bloque-ci-ci-20"></a>
- [x] **CI.20 — 🔍 `chat-continuity` lee la respuesta equivocada del DOM tras recargar.** (2026-10-11) Visto en el pre-push
  (2 de 2): `Claude recalls sentinel after reload` con `API: R82-…` y `DOM: OK`; la captura muestra el centinela bien
  pintado. Causa: `sendTurn` cuenta los `div.prose` antes de que el historial se hidrate tras `reopenSession` y lee
  por índice la respuesta anterior.
  Ejecutado por: gpt-6-luna
  Hecho: `sendTurn` lee la última `div.prose` hasta que contiene el texto de la API. Evidencia: `ui:gate
  chat-continuity` 8/8 en vivo tras el cambio (antes 2 fallos de 2). Mismo patrón por índice en `chat-context`,
  `auto-flow`, `chat-roles` (candidato a causa de CI.18) y `read-boundary`: no recargan antes de enviar; sin tocar.

<a id="bloque-ci-ci-32"></a>
- [x] **CI.32 — 🔍 Cinco ui-gates en vivo rotos en master tras el lote del 2026-10-21 sin pre-push.** (abierto y
  cerrado 2026-10-22) `ui:gate` completo: 26 pasan, 5 fallan, y los 5 se repiten igual al relanzarlos solos
  (deterministas, no intermitentes). Evidencia: `gate:evidence next-2026-10-22-ui-gate-full` y
  `next-2026-10-22-ui-gate-rerun5`. Cerrado con CI.32.a–d.
  Ejecutado por: codex gpt-6-luna (mecanico: a, c) + claude sonnet (criterio: b) · Spec: docs/specs/CI.32.md
  - [x] **CI.32.a — `opencode-terminal`: `POST /api/chat/sessions` con `agent: opencode` responde 400 `chat no
    soportado`.** (cerrado 2026-10-22) Lo trajo AT.11 (`c6014ede`, `chat-sessions.ts:265-270`): crear una sesión
    exige un adaptador de chat, y OpenCode no tiene a propósito (es una ventana libre, no un chat). Arreglo: el
    registro declara la capacidad (`CliChatAdapter.terminal`, `true` solo en `opencode`) y crear sesión acepta `chat`
    o `terminal`; `/api/chat` sigue rechazando a OpenCode. Ronda 1 resolvía con `taskEngine === 'opencode'` (rama por
    marca): devuelta. Evidencia: `gate:evidence CI.32.a-live` → `opencode-terminal` 8/8; `chat-adapters.test.ts` 3/0
    (fixture `terminal: true` → 201, `fixture-no-chat` y desconocido → 400); `test:coverage` 1925/0 (80.02 %/68.02 %).
    Ejecutado por: codex gpt-6-luna (mecanico).
  - [x] **CI.32.b — `chat-followup-task` y `chat-task-undo`: `/api/chat` responde 404 `Project not found`** al
    elegir el proyecto temporal en Dev y volver a Chat. (cerrado 2026-10-22) Causa: carrera. El composer del estado
    vacío ya está visible mientras `createSession` de "Start Chat" no ha vuelto; un envío en ese instante veía
    `activeThreadId=''`, abría una sesión general y la mandaba con `?project=none`, que el servidor buscaba como id
    (404). Existía antes; UI.27 (composer visible desde el inicio) la destapó. Arreglo: el envío espera el New chat
    en vuelo (`threadPendingForSend`); una lectura de sesiones tardía no pisa el hilo recién creado
    (`lib/merge-threads.ts`, limitado a hilos del proyecto leído: la ronda 1 dejaba los hilos de A en la lista de B
    y se devolvió); `?project=none` sin cabecera = sesión general (`isGeneralScopeRequest`). Evidencia:
    `gate:evidence CI.32.b-live` → `chat-followup-task` 8/8, `chat-task-undo` 16/16, `project-tabs` 39/39,
    `project-isolation` 14/14; `merge-threads.test.ts` 6/0, `project-context-general.test.ts`; `test:coverage`
    1938/0; lint sin errores.
    Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.32.b-live.json` (corrida de la ronda 2).
  - [x] **CI.32.c — `auto-flow`: la tarea Codex aprobada se queda en `running` con `pendingApprovals: 1`** hasta
    agotar 10 min (auto-edit, "crea codex-nota.md"). Fase 1 (evidencia, 2026-10-22): cada petición deja
    `[codex-approval] {request|decision|item-started}` en `dashboard.log` (comando redactado, 300 caracteres).
    Corrida `CI.32.c1-live`: la hipótesis del orden `item/started` queda refutada. Codex escribió el archivo con
    `/bin/zsh -lc "cat > codex-nota.md <<'EOF' …"` (`commandExecution`, `commandActions: [unknown]`), no con
    `apply_patch`; auto-edit retiene comandos por diseño (ERP.7.1, `PLAN.md` § ERP.7.1a: solo pregunta `mkdir`).
    Fase 2a (descartada): pedir en el prompt de tareas que edite con su herramienta, no con shell — Codex siguió con
    `cat >` 2 de 2 (`CI.32.c2-live`, `-rerun`); revertido. Probablemente rojo desde ERP.7.1c (2026-10-20, auto-edit
    por defecto): la última evidencia verde de `auto-flow` es UI.24.7 (2026-10-15).
    **Decisión de Carlos 2026-10-22:** en `auto-edit`, Codex corre con su sandbox nativo de escritura en el proyecto
    (su modo "Auto"): los comandos dentro del proyecto pasan solos y solo pregunta lo que sale del proyecto o pide
    red, igual que el CLI directo. Cambia ERP.7.1a para Codex (`mkdir` dentro del proyecto ya no pregunta); `Supervised`
    sigue preguntando todo comando. Fase 2 (cerrada 2026-10-22): `taskTurn` manda `approvalPolicy: 'on-request'` en
    `auto-edit` y `'untrusted'` en `supervised` (`thread/start` y `turn/start`); sandbox `workspaceWrite` sin cambios.
    Evidencia: `gate:evidence CI.32.c-live` → `auto-flow` 33/33, `chat-retry-report` 24/24, `chat-permissions` 9/9,
    sin peticiones `[codex-approval]` (nada salió del sandbox); `tasks` falló en `tasks.yaml` sin commitear (CI.23) y
    pasó 31/31 solo (`CI.32.c-live-tasks`); `codex-task-approvals.test.ts` 6/0 (un caso por modo); `test:coverage`
    1930/0; `bun run lint` sin errores. Ejecutado por: codex gpt-6-luna (mecanico).
  - [x] **CI.32.d — `chat-retry-report`: el primer intento se queda en `running`, `retryCount=0`.** (cerrado
    2026-10-22) Misma causa que CI.32.c: con el sandbox nativo pasa 24/24 (`CI.32.c-live`). Sin cambio propio.

<a id="bloque-ci-ci-33"></a>
- [x] **CI.33 — 🔍 `graph-runner.test.ts` "stops at the maximum graph iterations" roza su límite de 5 s.** (abierto y
  cerrado 2026-10-22) Cadena de 202 tareas con `runTask` simulado: ~5 s aislado; timeout en 2 de 4 `test:coverage`
  del 2026-10-22. Medido: ~4,95 s de 4,97 s son `new RunLogger` por intento (`graph-runner.ts:499` →
  `excludeRuntimeArtifacts` → `git rev-parse`, ~25 ms × 200); el resto suma <20 ms. Costo legítimo y por tarea (en un
  grafo real, ~25 ms frente a minutos de LLM): límite del test a 20 s con la medición en un comentario; producto sin
  tocar. Evidencia: test aislado 3/3 (4,97–5,03 s); `test:coverage` 2/2 verde (1926/0).
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/CI.33.md

<a id="bloque-ci-ci-36"></a>
- [x] **CI.36 — ⚡ `RunLogger.write` nunca tumba la corrida.** (abierto y cerrado 2026-10-22, GO de Carlos)
  `src/run/logger.ts:47-50` hacía `appendFileSync` sin guarda: si `runs/` desaparecía tras el constructor, `ENOENT` subía
  a quien solo anotaba. Arreglo: ante `ENOENT` recrea el directorio y reintenta; si no puede, avisa una vez por instancia
  en stderr (`[run-logger] …`) y sigue. Hermanos: `evals/runner.ts:168` escribe `.gitignore` (persistencia, no log): no se
  traga. Evidencia: `src/run/logger.test.ts` 2/0; contraprueba con el `logger.ts` anterior 0/2; `tsc` y lint limpios.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.36.md

<a id="bloque-ci-ci-37"></a>
- [x] **CI.37 — 🔍 `waitForTaskRun` ante un `pending` con intento fallido: averiguar y corregir.** (abierto y cerrado
  2026-10-22, Carlos: "manda a Sol averiguar y corregir") Causa: desde el dashboard `task run --id` persiste un intento
  fallido como `pending` + `retry_reason` + `retry_count+1` y termina (`src/cli.ts:1343`; no reintenta solo, eso es del
  `graph-runner`). `waitForTaskRun` (`api/chat.ts`) solo salía con estado terminal o árbol sucio: ante ese `pending`
  esperaba los 10 min completos y `Retry`/`Commit & Run` quedaban ocupados. Arreglo: foto de la tarea antes del POST; un
  `pending` con `retryCount`/`runId` distinto termina la espera con `Retry scheduled: <motivo>` (sin acortar el plazo).
  Hermano `api/tasks.ts:runTask` (Settings): devolvía éxito con un `runId` nuevo aún `running` (aprobaciones) y no salía
  ante árbol sucio; corregidos ambos. Evidencia: `task-run-polling.test.ts` 24/0, con el código anterior 12/12;
  `bun test src/dashboard` 419/0; typecheck y lint limpios.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.37-live.json` (`chat-retry-report` 24/24,
  `chat-followup-task` 8/8, `chat-turn-details` 29/29).
  Ejecutado por: codex gpt-6.1-sol (criterio-alt) · Spec: docs/specs/CI.37.md

<a id="bloque-ci-ci-35"></a>
- [x] **CI.35 — 🔍 `chat-streaming` intermitente en `one assistant bubble matches persisted response`.** (abierto y
  cerrado 2026-10-22) 4 fallos el 2026-10-22, pasaba al reintento; existía antes de CI.32.b. Fase 1 (evidencia): en rojo
  el paso vuelca visible y persistido completos, `firstDiff` y relectura a 2 s. Causa (6 corridas, 3 rojas; fallo del
  gate, no del producto): (1) Haiku a veces responde en lista numerada o en bloque ```` ``` ````; el DOM renderizado no
  trae marcadores (`::marker`) ni cercas, y el gate comparaba contra el Markdown crudo (visible 389 vs persistido 540,
  `firstDiff=0`, igual a los 2 s); (2) el front sondea `/timeline` cada 300 ms (`OrchestChatView.tsx:196-220`) y Haiku
  escribía "del 1 al 40" en 1,1-1,6 s → 1 crecimiento visible. Arreglo (`chat-streaming.mjs`): `words()` normaliza ambos
  lados (sin cercas ni marcadores de lista, letras y dígitos, minúsculas) en toda comparación DOM↔mensaje (6 sitios);
  `findBubble` prueba coincidencia exacta antes que `includes`; crecimiento medido con `requestAnimationFrame` en la
  página (coincide siempre con el sondeo: el DOM cambia solo al ritmo de los 300 ms); turno 1 "del 1 al 120" (ventana
  ~3 s, 7-9 crecimientos). Rondas r3/r4 rompieron por spec (solapamiento 1-120/41-80 con `includes`; `words` sin dígitos
  igualaba los prompts): corregidas en r4/r5. Evidencia: r5 6/6 verde (`CI.35-r5-1..6`); lint y `tsc` sin errores.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.35-live.json` (`chat-streaming`).
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.35.md

<a id="bloque-ci-ci-34"></a>
- [x] **CI.34 — 🔍 `chat-attachments` intermitente tras CI.32.b.** (abierto y cerrado 2026-10-22) Pasó 14/14 en la batería de
  la mañana; tras `ec92a168` falló 2 de 3 (`sent message keeps 2 attachments … after the turn: {"names":[]}` y
  `answer contains the token … answer=` vacío). Sospecha: la fusión de hilos de CI.32.b (`lib/merge-threads.ts`)
  reemplaza el mensaje local con adjuntos tras el turno. Primero el experimento HEAD vs `App.tsx` de `143fbce2`.
  Spec: `docs/specs/CI.34.md`. Mismo día, sin ítem propio: `chat-streaming` falló 3 de 4 corridas en `one assistant
  bubble matches persisted response` (pre-push de `143fbce2`, batería `CI.32-close-ui-gate-full`, `CI.34-rerun-2`);
  pasa al reintento. Ya fallaba antes de CI.32.b (pre-push de `143fbce2`): no lo trajo este lote.
  Experimento: HEAD 3 FAIL de 7, `App.tsx` de `143fbce2` 5 PASS de 5. Causa (inferida, no reproducida con
  instrumentación en 12 corridas): `mergeLoadedThreads` solo conservaba el hilo local con mensajes `pending_`; una
  lectura de sesiones iniciada antes del envío resolvía después del turno y reemplazaba el hilo por su versión vieja,
  sin el mensaje enviado ni sus adjuntos. CI.32.b adelantó el envío y agrandó esa ventana. Arreglo: el hilo local gana
  también si tiene mensajes que la lectura no trae (`merge-threads.ts:22-26`). Evidencia: `chat-attachments` 6/6
  seguidas; `merge-threads.test.ts` 8/0 (el caso nuevo falla con el código anterior); `test:coverage` 1940/0; lint
  sin errores. `chat-streaming` falló 1 vez en la batería y pasó 3/3 solo (el intermitente de arriba).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.34-live.json` (`chat-attachments`,
  `chat-followup-task`, `chat-task-undo`, `project-tabs`, `project-isolation`).
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/CI.34.md

<a id="bloque-ci-ci-31"></a>
- [x] **CI.31 — ⚡ El shard `executors` de Mutation Shards pasa el límite de 3 h.** (abierto y cerrado 2026-10-21) Run
  `39566168502` cancelado a 3h0m: 3352 mutantes en 15 archivos con `concurrency: 1` (el 2026-10-20 eran 2627 en 11 y
  tardó 2h37; ERP.7.1a/d1/d2 sumaron `*-approval.ts` y `opencode-server.ts`). Arreglo: partir el shard en dos
  (`executors-codex` = `codex*.ts` + `external.ts`; `executors` = el resto, por exclusión, para que un archivo nuevo
  caiga ahí sin tocar config). Spec: docs/specs/CI.31.md (borrado)
  `scripts/mutation-test-shard.ts` ahora resuelve los `!` de `mutate` en orden, como Stryker (r2 por hallazgo de `qa`:
  r1 aplicaba las exclusiones al final). Evidencia (cerebro): typecheck; `mutation-test-shard.test.ts` 4/4; dry runs
  `executors` 11 archivos/1747 mutantes y `executors-codex` 4/1605 (suma 3352, sin solape). Límite: el tiempo real de
  cada shard se ve en la próxima corrida nocturna.
  Confirmado 2026-10-21 (run manual `39672854539`, success, 2h50m total): `executors` 2h06m, `executors-codex` 1h54m,
  `runtime-boundaries` 55m, `context-routing` 35m. Margen de `executors`: ~54 min; si suma archivos, vigilar.
  Ejecutado por: codex gpt-6-luna (mecanico, r1 y r2) · QA: codex gpt-6.1-sol (qa).

<a id="bloque-ci-ci-24"></a>
- [x] **CI.24 — 🔍 Claude se niega a usar el historial del chat ("untrusted data sources like conversation history").**
  Visto 2026-10-14 en el pre-push de `ec3e309` (`chat-continuity`, intento 1): tras recargar, Claude responde que no
  puede verificar datos de fuentes no confiables y no recuerda el código que el USUARIO le dio. Causa probable:
  `buildChatTranscript` (`src/dashboard/handlers/chat.ts:114`) envuelve las respuestas previas en `<untrusted-data>`
  sin decir qué es el bloque, y Claude extiende la desconfianza a todo el historial. Intento 2: timeout de 180 s
  (otra causa, ver CI.11). Spec: docs/specs/CI.24.md
  (cerrado 2026-10-14) La cabecera del historial dice que es la conversación propia y que lo que dijo el usuario es
  fiable; el envoltorio de las respuestas previas se queda. Ejecutado por: mecanico (delegate).
  Evidencia (cerebro): typecheck, `chat-turns` + `codex-app-server` 17/17.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.24-live.json` — `chat-continuity` 8/8 en 2 de 3
  corridas; la 3.ª cayó por el timeout del turno 1 (→ CI.25). Límite: la negativa se vio 1 vez; que no reaparezca en 2
  corridas es evidencia débil.

<a id="bloque-ci-ci-26"></a>
- [x] **CI.26 — 🔍 `CC.2 — chat sessions backend` llega al timeout de 5 s en `test:coverage` (intermitente).** Visto 2
  veces: 2026-10-13 y pre-push de `8701044` (2026-10-14). El subproceso de `runIsolated` se cuelga tras
  `[chat-turn] received` de la sesión `codex` (`chat-sessions.test.ts:323-326`, espera 502) y muere con 143. A solas
  tarda <1 s, también con el entorno del pre-push y `--coverage`.
  Ejecutado por: sonnet (rol `criterio`, r1) y gpt-6-luna (rol `mecanico`, r2) · Spec: docs/specs/CI.26.md (borrado)
  (cerrado 2026-10-14) **Causa demostrada:** `handleApiChat` hacía `await ensureCatalogLoaded()` en todo turno; sin
  caché fresco eso es un fetch a OpenRouter de hasta 10 s (`router/model-catalog.ts`), también en turnos CLI que no
  usan el catálogo. Con red lenta el turno (y el test, 5 s) quedaba esperando. Arreglo de producto: solo el camino API
  lo espera (`chat.ts:~1284`); el test además siembra un `models.json` fresco en su HOME. r2 (cerebro): la r1 acotaba
  la espera a 1.5 s con `Promise.race`, que en un turno API con red lenta quitaba `reasoning` sin avisar.
  Contraprueba (cerebro, `HTTPS_PROXY` a IP no ruteable): con HEAD fallan 2 tests a ~5001 ms; con solo el arreglo de
  producto 24/24. Evidencia: `typecheck`, `chat-sessions.test.ts` 24/24 con y sin el proxy.

<a id="bloque-ci-ci-28"></a>
- [x] **CI.28 — 🔍 El test de `statusLine` de `session-status` lanza el `codex` real del host.** (abierto y cerrado 2026-10-16)
  Visto 1 vez en `test:coverage` (timeout 5 s, pasó al repetir). Causa leída en el código: el test borra
  `ORCHESTOS_SESSION_TRANSCRIPT` y `readActiveSessionStatuses` (`scripts/session-status.ts:199`) llama
  `readCodexRateLimitsLive` con el `codex` instalado en el Mac; en CI no existe y nunca falla. Arreglo: inyectar
  `detectClis` y `readCodexRateLimits` en el test; afirma 1 lectura falsa de cuota Codex.
  Evidencia (cerebro): `session-status.test.ts` 6/6; `bun run test:coverage` 1821 pass / 0 fail.
  Ejecutado por: codex gpt-6-luna (mecanico).

<a id="bloque-ci-ci-27"></a>
- [x] **CI.27 — 🔍 Un flujo que revienta no dice qué locator falló ni deja captura.** (abierto 2026-10-15)
  El pre-push de `e1d3b12` falló una vez con `FAIL chat-context: flow: locator.click: Timeout 30000ms exceeded.`, al
  pasar de Codex a Claude (`chat-context.mjs`, `startChat`/`selectClaudeHaiku`: 6 clics posibles). A solas pasó
  5/5, y el reintento del push pasó entero. Ni `result.json` ni el log dicen qué locator era, y no quedó captura del
  momento (`ui-gate-28520/chat-context/` solo tiene la de Codex). Primero, evidencia genérica en
  `scripts/ui-gate/run.mjs`: ante la excepción de un flujo, guardar el mensaje completo de Playwright (incluye
  `waiting for <locator>`) y una captura `failure.png`. Sirve también para CI.18, CI.19 y CI.23. Después, la causa.
  (cerrado 2026-10-20) Playwright sí trae el locator (`Call log: waiting for …`), pero con ANSI y en otra línea, y el
  `FAIL` solo mostraba la primera. Ahora `describeFlowError` (`scripts/ui-gate/lib.mjs`) deja una línea
  `<error> [waiting for <locator>]`, `result.errorDetalle` guarda el mensaje completo sin ANSI y el runner toma
  `<flujo>/failure.png` antes de cerrar el navegador (si la captura falla, va a `notes`, no cambia el resultado).
  La causa del fallo de `chat-context` (visto 1 vez) pasa a "Intermitentes vistos una vez" en NEXT.md.
  Evidencia (cerebro): diff leído; `run.test.ts` 11/11; tsc y biome verdes; QA (Sol): sin defectos. Ruta de fallo en
  vivo probada solo por el ejecutor (flujo forzado: `FAIL … [waiting for getByRole(…)]` + `failure.png`); el hook
  `brain-no-code` no deja al cerebro crear el flujo de prueba.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.27-live.json` — `chat-context` 5/5.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.27.md

<a id="bloque-ci-ci-25"></a>
- [x] **CI.25 — 🔍 El turno 1 de Claude (haiku, "Reply only OK") no responde en 180 s, sin rastro.** Visto 2 veces el
  2026-10-14 en `chat-continuity` (pre-push de `ec3e309`, intento 2, y corrida 2 de CI.24). El `dashboard.log` no dice
  nada: el chat no registra spawn, salida ni duración del CLI. Primero que deje evidencia (pid, exit, stderr, ms del
  CLI de chat en `dashboard.log`), luego causa. Posible hermano de CI.11 (turno 2 de Codex lento).
  2026-10-14 tarde: se reproduce siempre (pre-push de `5d67f56` ×2 + a solas ×1) tras actualizarse Claude Code a
  2.1.300; bloquea el push.
  Ejecutado por: criterio (delegate) · Spec: docs/specs/CI.25.md
  (cerrado 2026-10-14) Rastro nuevo: `[cli-spawn]` (agente, pid, entorno, primer byte, ms, exit, stderr) para Claude y
  Codex (`src/run/executors/spawn-trace.ts`) y `[chat-turn] received` al llegar el POST. Con él, en la falla el
  segundo turno (tras recargar) nunca llegó al servidor: `AgentComposer.handleSend` descartaba en silencio el Enter
  mientras cargaban los modelos (el mismo "Loading models…" de R.8.1.1). Ahora el envío se recuerda y sale al
  terminar la carga. Además un `result` con `is_error` del CLI (p. ej. "Not logged in") es error visible del turno.
  **Causa inferida, no demostrada** (sin contraprueba con el arreglo revertido). Visto una vez en la depuración:
  `claude not found in PATH` durante el auto-update de Claude Code (ya sale como 502 visible).
  Evidencia (cerebro): diff leído; typecheck y lint verdes; `chat-continuity` 3/3 seguidas (8/8 cada una).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.25-live.json` — `chat-streaming` 24/24,
  `codex-live` 14/14, `chat-continuity` 8/8, `composer-picker` 5/5.

<a id="bloque-ci-ci-30"></a>
- [x] **CI.30 — ⚡ El pre-push verifica el commit que se empuja, no el árbol de trabajo.** (abierto y cerrado 2026-10-17)
  CI rojo en lint (run 39076415730): un archivo sin formatear en `74afe6d` pasó el pre-push porque el árbol de trabajo
  tenía la versión formateada sin commitear (arreglado en `306c722`). Ahora `test:coverage` y `lint` corren en un
  worktree temporal del SHA empujado (`node_modules` enlazado, borrado por `trap`); ui/chat-gates siguen en el árbol.
  Ejecutado por: mecanico (Luna) · Spec: docs/specs/CI.30.md (borrado al cerrar)
  Evidencia: `bash -n` ok; hook con stdin `74afe6d` → aborta en lint por `docs/done/evidence/CX.6-live.json` (el árbol
  ya lo tenía formateado); `git worktree list` tras la corrida = solo el árbol principal; el push de este commit pasó
  por el hook nuevo sobre HEAD.

<a id="bloque-ci-ci-29"></a>
- [x] **CI.29 — 🔍 El modelo del chat no se entera de que el usuario rechazó una tarea.** (abierto 2026-10-17, cerrado 2026-10-17) El
  pre-push de AT.20 cayó en `chat-turn-details` "second held task card visible": tras Reject (borra la tarea) y repetir
  el pedido, el modelo dice "sigue pendiente" y no llama a `create_task`. 2.ª vez visto. El prompt lista
  "Rejected by the user (deleted, nothing was run)" con la misma regla que el front (`App.tsx:229-238`), máx. 5, y pide
  volver a llamar a `create_task` si se repite el pedido; el cambio de hash llega a Codex/Claude reanudados como
  `<orchestos-context-update>`.
  Ejecutado por: `criterio` (roster.conf) · Spec: docs/specs/CI.29.md (borrado al cerrar)
  Evidencia: typecheck y lint (0 errores) limpios; `test:coverage` 1844/0; `gate:evidence CI.29-chat-turn-details` ×3 →
  `PASS chat-turn-details 29/29` las 3 veces; el pre-push completo la vuelve a correr.
