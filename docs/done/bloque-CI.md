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

> **Observaciones de Carlos (2026-09-16), pendientes de incorporar a un spec; no añadirlas al alcance de UI.9.5 sin planificar:** al seleccionar distintos proyectos, la interfaz no debe hacer parecer que todos comparten el mismo workspace; cada proyecto debe conservar y mostrar su propio contexto y datos (Settings, tasks/runs, etc.). Al pasar el cursor por la fila de un proyecto, mostrar a la derecha un botón de tres puntos con acciones de proyecto como `Project settings` y `Delete project`. Incluir también un control claro para expandir/colapsar los agentes de ese proyecto. Al diseñarlo, volver a mirar las capturas de Orca citadas en `docs/ui-reference-patterns.md` (A.1–A.3) y respetar su jerarquía de proyectos/agentes; Carlos señala que esta referencia visual no se está reflejando suficientemente.

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
