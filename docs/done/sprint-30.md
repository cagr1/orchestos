# Sprint 30 — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="sprint-30-ui-0"></a>
### UI.0 — 🧠 Andamiaje (ninguna pantalla migrada).
 (cerrado 2026-08-25)
  `public-src/` con React+TS; `bun build` → `public/dist/`; script `build:ui`;
  `bun-plugin-tailwind`. Mapeo de las **30 CSS vars actuales** a tokens shadcn
  (`--background`, `--foreground`, `--border`, `--primary`, `--muted`, `--destructive`, `--radius`)
  — **shadcn adopta la paleta existente, no al revés**: el look actual se preserva.
  Convivencia: React monta en contenedores dentro del DOM vanilla; nada existente se rompe.
  **Entregables adicionales, cerrados el 2026-08-22 al auditar el plan** (no descubrir después):
  (a) `public/dist/` en `.gitignore` — el bundle no se versiona (ver Costo 1);
  (b) `build:ui` cableado en `install.sh`/`install.ps1`/`install.bat` y README, o un clone fresco
  sirve un dashboard roto;
  (c) **el puente de i18n decidido e implementado** (ver Costo 3) — cómo un `setLang()` llega a
  las islas React, que hoy no se enteran.
  **Validación**: el dashboard actual sigue funcionando idéntico + pipeline de build listo +
  cambio de idioma verificado en vivo sobre una isla React de prueba.

  **Cerrado el 2026-08-25.** Entregado: `src/dashboard/public-src/` (React 19 + TS + Tailwind 4),
  `bun run build:ui` (`scripts/build-ui.ts`, con `--watch`), `@theme inline` mapeando los tokens
  shadcn a las CSS vars existentes, `src/dashboard/public/dist/` en `.gitignore`, `build:ui`
  cableado en `install.sh`/`install.ps1` + README, y el puente de i18n implementado.
  **Evidencia:** `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, gate
  73.94%/62.90% sobre 69/57 — el ratchet NO se movió, confirmando empíricamente el Costo 2).
  **Gate en vivo:** navegador real (Playwright sobre Chromium) contra el dashboard corriendo en
  `localhost:4319`, **16/16 PASS** — script versionado en `scripts/ui-gates/ui0-islands.mjs`.
  Verifica que sin `?island-probe=1` el dashboard queda idéntico (cero islas, cero errores de
  consola, sidebar y `#main` vanilla intactos), que `bg-card`/`border-border` resuelven a
  `--surface`/`--border`, que el preflight de Tailwind no se coló, que el idioma cambia en vivo
  conservando el estado local de la isla, y que tras 6 `rerender()` + navegación no hay islas
  duplicadas ni roots React leakeados.

  **Tres correcciones de rumbo, encontradas al implementar — ninguna estaba en el plan:**

  1. **La ruta era otra.** El plan decía `public/dist/`; `public/` en la raíz **no existe**.
     El `STATIC_DIR` real es `src/dashboard/public/` (`src/dashboard/types.ts:437`), así que el
     bundle va a `src/dashboard/public/dist/`. Lo verificado el 2026-08-22 sigue en pie: no hizo
     falta tocar **nada** de `src/dashboard/*.ts` para servirlo.
  2. **El problema no era i18n, era el ciclo de vida de las islas** — y es más grande.
     `App.rerender()` hace `main.innerHTML = sc.render(state)` (`app.js:432`): eso **destruye**
     cualquier isla React montada dentro de `#main`, sin avisarle a React, que sigue suscrito a
     stores y timers mientras su nodo quedó huérfano. Y `rerender()` no corre solo al navegar: lo
     dispara el **poll de 30s**, el cambio de idioma y el de tema. Sin resolverlo, cada isla
     acumulaba un leak por poll y una copia duplicada por repintado — o sea, UI.1 en adelante
     habría sido inviable. Resuelto con un registro de islas (`public-src/lib/islands.ts`) que
     desmonta → repinta → remonta en el orden correcto, envolviendo `rerender()` una sola vez.
     El puente de i18n quedó como lo que siempre debió ser: `setLang()` emite
     `orchestos:langchange` (dentro de `i18n.js`, la fuente única) y `useT()` se suscribe con
     `useSyncExternalStore`, así las islas **se repintan sin remontarse** y conservan su estado
     local. El remount es solo la red de seguridad. El gate verifica las dos cosas por separado.
  3. **`window.App` no existía y el orden de arranque estaba invertido.** `const App` en el top
     level de un script clásico **no** crea propiedad global (const/let no lo hacen), y un
     `<script type="module">` se ejecuta **antes** de que dispare `DOMContentLoaded`, que es
     cuando `app.js` corre su `boot()`. O sea: al cargarse, el bundle no tenía a quién envolver y
     `#main` estaba vacío — las islas se montaban y el primer repintado del boot vanilla las
     borraba. `app.js` ahora expone `window.App` y emite `orchestos:ready` al terminar su boot;
     el bundle espera ese evento. Los dos síntomas se vieron en el navegador, no en los tests:
     es exactamente el tipo de bug que un mock hubiera escondido.

  **Dos decisiones que UI.1–UI.7 heredan y no deben deshacer:**
  - **El preflight de Tailwind queda fuera, a propósito.** `@import "tailwindcss"` arrastra un
    reset que despinta las ~2.000 líneas de CSS vanilla que hoy funcionan; por eso `ui.css`
    importa `theme.css` y `utilities.css` por separado. El gate lo verifica midiendo que un `<h1>`
    conserve su margen de UA. Si alguien "simplifica" ese import, el dashboard entero se despinta.
  - **`--accent` significa cosas distintas en cada lado**: en shadcn es el color de hover/selección
    de ítems; en OrchestOS es el azul de marca. Mapeo: `--color-primary` ← `--accent` (marca),
    `--color-accent` ← `--surface-hi` (hover real del dashboard).

  **Un costo que el plan no había previsto y sí existe:** arrancar el dashboard por fuera de los
  instaladores (`bun run src/cli.ts dashboard`, la ruta más común en desarrollo) también servía un
  dashboard sin islas. Resuelto con un guard en `src/cli.ts` que construye el bundle si falta,
  mismo patrón que el auto-`bun install` que ya estaba ahí — verificado en vivo borrando
  `dist/` y arrancando.

<a id="sprint-30-ui-1"></a>
### UI.1 — 🔍 GATE DE ABORTAR: el combobox de modelo.
 (cerrado 2026-08-28 — **APROBADO, el Sprint 30 sigue**)
  Una sola isla React dentro del dashboard vanilla actual: reemplazar `buildModelSelect()` por
  shadcn `Command` + `Popover` (patrón combobox buscable — que es literalmente lo que exige
  `reference-model-combo-pattern`, resuelto de fábrica).
  **Es el componente exacto que costó horas.** Si en ~1 día pasa la lista de abajo **verificada en
  vivo** (dashboard real corriendo, no mocks), la tesis quedó probada y se sigue.
  Si no, **se aborta acá** habiendo perdido un día en vez de meses.

  **Criterio de aprobación — medible, no "queda mejor"** (definido 2026-08-22; la versión anterior
  decía "si se comporta bien", que no es verificable y este ítem decide meses de trabajo):
  1. Las **4 reglas de diseño de v0.12** se comprueban una por una contra Radix — anclaje a borde
     fijo, altura de toprow sin padding vertical, `overflow:hidden` en el nivel interno correcto,
     hover-swap. Radix debería resolverlas de fábrica: **se comprueba, no se asume**
     (`feedback-ui-toprow-alignment-rules`).
  2. El combobox sigue siendo **buscable** y nunca degrada a un `<select>` nativo con la lista
     completa — el contrato duro de `reference-model-combo-pattern`.
  3. Navegación completa por teclado (abrir, filtrar, flechas, Enter, Esc) y foco devuelto al
     trigger al cerrar.
  4. El toprow que lo contiene **no se rompe**: sin scroll horizontal, sin tooltip cortado por
     `overflow` — la regresión real que ya ocurrió antes y que solo se ve en el navegador.
  5. Cambio de idioma en vivo repinta el combobox (valida el puente de i18n de `UI.0`).

  **VEREDICTO (2026-08-28): APROBADO. La tesis quedó probada — el Sprint 30 continúa.**
  Costó **un día**, que era exactamente el presupuesto del gate.

  **Gate en vivo:** navegador real (Playwright sobre Chromium) contra el dashboard
  corriendo, **27/27 PASS** — script versionado en `scripts/ui-gates/ui1-model-combo.mjs`,
  se corre a mano (Playwright no entra a devDependencies por un gate manual).
  `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet sin mover).

  **Los 5 criterios, uno por uno:**
  1. **Las 4 reglas de v0.12 contra Radix: las resuelve, y ahora está medido.** Anclaje: el
     panel mantiene `dx = 0` respecto del trigger aunque se cambie el ancho del contenedor
     (Radix ancla al elemento, no al orden en el DOM). Recorte: el contenido se portalea a
     `<body>` — se midió que **ningún** ancestro tiene `overflow` que pueda cortarlo, que es
     la solución estructural a la regla 3, mejor que moverla al nivel interno correcto a mano.
     Sin scroll horizontal ni en la página ni en `#main`; el label largo corta con ellipsis.
  2. **Sigue buscable, y el filtro replica las reglas del combo vanilla** (match por id **o**
     por nombre, substring, sin reordenar por score): 389 modelos → 33 al escribir "claude".
     Cero `<select>` nativos con lista larga en pantalla.
  3. **Teclado completo**: flechas mueven el resaltado, Enter elige y escribe el hidden input,
     Esc cierra — y en los dos casos el foco vuelve al trigger. Todo de Radix, sin código propio.
  4. **La fila no se rompe**: medido arriba (criterio 1).
  5. **El idioma cambia en vivo con el panel abierto**: "Search models…" → "Buscar modelo…".

  **Cómo se hizo, y por qué el riesgo de migración es menor de lo que parecía:** el único
  punto que cambió es el **cuerpo de `buildModelSelect()`**, que ahora emite
  `<div data-island="model-combo">` en vez de HTML. Los **5 call sites no se tocaron** — ni
  una línea — porque la isla sigue renderizando el mismo `<input type="hidden" id={inputId}>`
  y todos leen el valor con `document.getElementById(id).value`
  ([[reference-model-combo-pattern]], contrato intacto). Esto es la mejor noticia del gate:
  una pantalla se puede migrar por dentro sin tocar a quien la consume.

  **Tres hallazgos reales, ninguno visible sin navegador:**

  1. **El orden del registro de islas de UI.0 estaba mal, y rompía algo.** `pendingVal()`
     (`screens-ops.js:1208`) lee el hidden input **del DOM viejo, durante el render**, para
     conservar una selección de modelo sin guardar a través de un `App.rerender()`. El bridge
     de UI.0 desmontaba antes de repintar, y `root.unmount()` borra el DOM del contenedor de
     forma síncrona: `pendingVal()` encontraba null y la elección se perdía **en cada poll de
     30s**, en silencio. Es literalmente el mismo bug que ya se había arreglado en vanilla el
     2026-08-10. Corregido a repintar → limpiar huérfanos → montar (desmontar un root ya
     detached es legal en React y corre los cleanups igual). El gate lo verifica explícitamente.
  2. **El panel quedaba debajo del scrim del modal.** El portal a `<body>` que resuelve el
     recorte también saca el panel del contexto de apilamiento del modal: con
     `.modal-scrim { z-index: 200 }`, el combo de crear tarea se veía tapado y no se podía
     clickear. El `z-index` va en `[data-radix-popper-content-wrapper]` (el wrapper es quien
     participa del apilamiento de `<body>`; con `auto` pierde contra cualquier ancestro con
     z-index explícito, sin importar el orden en el DOM). Fijado en 300: arriba de modales,
     abajo de los toasts. **Es el precio del portal, y hay que pagarlo una sola vez** — vale
     para todo popover/dropdown/tooltip de UI.2 en adelante.
  3. **Hacía falta un mecanismo general para el DOM que se repinta fuera de `rerender()`.**
     `Modal` arma su contenido con `this.el.innerHTML = …` y no participa de `App.rerender()`,
     y ahí vive uno de los 5 combos. En vez de pedirle a cada sitio vanilla que llame a
     montar/desmontar a mano — la clase de regla que nadie termina cumpliendo (regla cero de
     CLAUDE.md) — se agregó un `MutationObserver` que monta cualquier `[data-island]` que
     aparezca en el DOM y limpia los que se van. Verificado abriendo y cerrando el modal 3
     veces sin acumular islas ni hidden inputs.

  **Lo que se borró, a propósito y no en UI.5:** el wiring delegado de `buildModelSelect()` en
  `boot()` (abrir/cerrar, elegir, filtrar, cerrar-al-click-afuera) y `state.modelComboOpenKey`.
  Dejarlo no era neutro: seguiría escuchando en `document` y compitiendo con Radix por los
  mismos clicks. El pill modelo+esfuerzo del chat **no** usaba ese wiring (tiene el suyo con
  `data-modelfx-*` en `screens-core.js`) y se verificó en vivo que sigue funcionando.

<a id="sprint-30-ui-1b"></a>
### UI.1b — 🔍 Cerrar la brecha de evidencia de UI.1: los 2 call sites que faltaban.
  (2026-08-29) Al cerrar UI.1 quedaron 2 de los 5 call sites sin poner en pantalla (`diagnose-model`, que necesita un run fallido con
  diagnóstico, y `draft-model`, que necesita un draft natural activo).
  **Gate en vivo:** navegador real (Playwright sobre Chromium), **9/9 PASS** —
  `scripts/ui-gates/ui1b-remaining-callsites.mjs`. Los 5 call sites quedan verificados.
  Método: sembrar el estado y repintar, que es la técnica que el propio repo ya usó para este
  mismo componente (`screens-core.js:874`, Sprint 22/F2.1). Límite dicho con la misma claridad
  que el original: el estado está sembrado, así que **no** prueba que un run fallido real
  produzca ese diagnóstico — prueba lo que UI.1 necesitaba, que el combo monta y respeta su
  contrato en esos dos lugares.

  **Y cerrar esa brecha encontró un BUG REAL, preexistente y ajeno a React** (por eso valía la
  pena cerrarla en vez de darla por cubierta): elegir un modelo en el draft o en el panel de
  diagnóstico **se revertía solo**. Es EL MISMO bug que se arregló para Settings el 2026-08-10
  (`#37`, documentado en `screens-ops.js:1202`), pero aquel arreglo —el helper `pendingVal`—
  **nunca se aplicó a `screens-core.js`**: quedó solo en `screens-ops.js`. En vanilla la
  selección se perdía **al instante**, porque elegir disparaba `App.rerender()` y el render
  volvía a leer `draft.executor_model`. Con el combo en React el síntoma se volvió más raro y
  no menos grave: la elección aguantaba hasta el siguiente repintado (el poll de 30s o un
  cambio de pantalla), así que el usuario elegía un modelo, se iba a otra cosa, y **la tarea se
  creaba con otro**. Arreglado con el mismo patrón que ya existía para el caso hermano
  (`pendingModelVal()`), aplicado a los dos call sites. Sin regresión: UI.1 27/27, UI.2 32/32,
  UI.3 19/19, y `bun run test:coverage` verde (1174 pass / 0 fail).

  **Aprendizaje de método, no del componente:** un arreglo que se aplica a *un* call site y no
  se busca en los hermanos deja el bug vivo en los otros y encima lo vuelve más difícil de ver,
  porque el caso arreglado "demuestra" que el problema está resuelto.

  **Nota de paridad:** en vanilla el fondo `--accent-soft` significaba a la vez "opción
  elegida" y "opción bajo el mouse". Con cmdk el fondo pasa a ser el ítem **resaltado** (el que
  mueven las flechas) y la opción **elegida** se marca con un check — sin esa separación, el
  criterio 3 (navegación por teclado visible) no se podía cumplir. Es la única diferencia
  visual deliberada; todo lo demás es paridad (grupos, badge `:free` por id y no por precio 0,
  `allowEmpty` del QA judge, carga perezosa del catálogo al abrir).

<a id="sprint-30-ui-2"></a>
### UI.2 — 🧠 Design system: los 6 componentes que se repiten.
 (cerrado 2026-08-28)
  Button, Input/Search, Select/Combobox, Dialog, Toast (reemplaza `showToast`), Tabs.
  Más primitives del shell (`cn()`, variantes). Todo shadcn, cero CSS a mano.

  **Cerrado el 2026-08-28, en equipo con Codex.** Reparto: Codex vendorizó Button, Input,
  Tabs y Dialog (mecánico, sin cruce de frontera); Claude hizo el Toast y su puente, extrajo
  el `Combobox` genérico, y revisó el diff de Codex — que es donde aparecieron dos defectos
  reales (abajo).
  **Evidencia:** `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail,
  ratchet sin mover). **Gate en vivo:** navegador real, **32/32 PASS**
  (`scripts/ui-gates/ui2-design-system.mjs`) + el gate de UI.1 sigue **27/27** tras
  refactorizar `ModelCombo` sobre el `Combobox` nuevo, o sea que la extracción no rompió nada.

  **El gate mide contra el CSS vanilla, no contra números copiados a mano**: crea un `.btn`,
  un `.filter-tab` y un input reales en el documento y compara el estilo computado del
  componente React contra ellos. Así "espeja el look vanilla" es verificable, y el día que
  alguien toque `styles.css` el gate lo detecta en vez de quedar desactualizado en silencio.

  **Adopción real, no componentes muertos.** `Toast` reemplaza `showToast()` **con sus 71
  llamadores intactos** — misma estrategia que UI.1 con `buildModelSelect()`: se cambia el
  cuerpo, no los call sites. Funciona porque una `function` declarada en el scope global SÍ
  crea propiedad de `window` (a diferencia de `const`/`let`), así que reasignarla redirige las
  71 llamadas `showToast(...)` sin prefijo. El gate lo verifica resolviendo el identificador
  igual que lo hace `app.js`, no llamando `window.showToast(...)` — que probaría otra cosa.
  `Combobox` sale de extraer la parte genérica de `ModelCombo`, así que también nace con
  consumidor real. `Button`, `Input`, `Tabs` y `Dialog` **no tienen consumidor todavía** (llega
  en UI.3/UI.4): para no entregar cuatro archivos que compilan y que nadie probó, se agregó un
  banco de pruebas tras `?ui-probe=1` (invisible en el dashboard normal) que el gate ejercita.

  **Dos defectos reales en la pasada de Codex, encontrados al revisar el diff** — los dos del
  tipo "compila, carga y no hace nada", que es justo lo que un reporte de "✅ pasa" no detecta:
  1. `Button` usaba `bg-secondary hover:bg-accent`. **Los dos tokens mapean a `--surface-hi`**
     (ver la nota de roles en `styles/ui.css`): el hover compilaba y no cambiaba un solo píxel.
     Corregido a `bg-muted hover:bg-secondary`, que es el salto real del `.btn` vanilla
     (`--surface-2` → `--surface-hi`). Faltaba además la variante `success`, que sí existe en
     el CSS vanilla. El gate ahora exige que **todas** las variantes sean visualmente distintas.
  2. `Dialog` usaba `animate-out`/`fade-out-0`/`zoom-out-95`, clases del plugin
     `tailwindcss-animate`, **que no está instalado**: 0 ocurrencias en el bundle generado.
     Reemplazadas por utilidades que existen. El gate exige ahora que la transición sea real.

  **Y dos correcciones de criterio propias, del mismo tipo:**
  - `Tabs` venía con el segmented control por defecto de shadcn. El dashboard **ya tiene** su
    patrón de pestañas (`.filter-tab`: pills de radio 20px, activa en `--accent` sólido) y el
    default se veía como un injerto. Alineado al patrón existente — el objetivo del Sprint 30 es
    cambiar la tecnología sin cambiar el aspecto, no sumar un segundo lenguaje visual.
  - **No hay variante `outline`.** En shadcn se distingue de `ghost` por no tener borde, pero
    el `.btn.ghost` de OrchestOS **sí lo tiene** (lo hereda de `.btn`): con esta paleta las dos
    daban el mismo botón exacto. Lo detectó el gate al medir que las variantes fueran
    distintas. Se deja una sola, en vez de dos nombres para lo mismo.

  **Nota de mejora deliberada (no rediseño):** el toast vanilla creaba un `div` con
  `position: fixed` en la misma coordenada por cada llamada, así que dos avisos seguidos se
  **superponían**. Radix los apila y expone la región como `aria-live`, o sea que ahora un
  lector de pantalla los anuncia. Nadie decidió que se taparan ni que fueran mudos: es una
  corrección, y el gate verifica el apilado. Las coordenadas y los 3 segundos no se movieron.

<a id="sprint-30-ui-3"></a>
### UI.3 — 🧠 Shell: sidebar + header + rightpanel + search.
 (cerrado 2026-08-28)
  El navbar/toolbar/panel colapsable — donde viven las 4 reglas de diseño descubiertas a los golpes.
  Va **después** del design system, no antes, porque toca las 11 pantallas a la vez.

  **Cerrado el 2026-08-28, con Codex escribiendo el gate.** Reparto nuevo y deliberado: Codex
  escribió el instrumento de verificación (`scripts/ui-gates/ui3-shell.mjs`) a partir del
  enunciado de las 4 reglas, **sin ver la implementación**, mientras Claude implementaba el
  shell. Que el test lo escriba quien no escribió el código encontró cosas (abajo).
  **Evidencia:** `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet
  sin mover).
  **Gate en vivo:** navegador real (Playwright sobre Chromium) contra el dashboard corriendo,
  **19/19 PASS** e idempotente (dos corridas seguidas dan lo mismo), y **sin regresión**:
  UI.1 sigue 27/27 y UI.2 32/32.

  **DECISIÓN DE ALCANCE, y es la más importante del ítem: se migran la estructura y el
  comportamiento; el CSS del shell se queda tal cual.** Las 4 reglas de v0.12 **están
  implementadas en CSS, no en JS** — el hover-swap del logo por el botón panel-left, por
  ejemplo, es `.app[data-sidebar="collapsed"] .sidebar-toprow:hover .sidebar-toprow-logo
  { display: none }`: CSS puro, sin una línea de JavaScript. Reescribir esas ~460 líneas a
  Tailwind **en el componente que está siempre en pantalla y que concentra los bugs históricos
  del proyecto** sería tomar todo el riesgo junto, y encima sin poder distinguir después si algo
  se rompió por React o por el CSS nuevo. Reducir ese CSS a tokens es literalmente el trabajo de
  `UI.5`, donde además ya no habrá vanilla compitiendo por las mismas clases.

  **El puente de estado, tercera aparición del mismo patrón.** `syncNav()`/`syncHeader()`
  escribían el DOM a mano (`classList.toggle('active')`, `badge.textContent = …`) — que es
  exactamente lo que no se le puede hacer a un componente de React, que lo pisa en su siguiente
  render. Ahora **empujan estado** a `lib/shell-store.ts` y el shell se suscribe. Con el store de
  toasts y el puente de i18n, ya son tres: **estado fuera de React + `useSyncExternalStore` es LA
  forma de cruzar la frontera en este proyecto**, no una solución puntual. El store ignora los
  empujones que no cambian nada, así que el poll de 30s no repinta el riel al pedo ni le roba el
  foco a un botón que alguien esté navegando por teclado.
  El sentido inverso **no** pasa por el store: navegar, colapsar y togglear el modo avanzado
  siguen decidiéndose y persistiéndose en `app.js`, porque coordinan cosas fuera del shell (salir
  de una pantalla de operador al apagar el modo avanzado). React dibuja y avisa; el vanilla decide.
  Duplicar esa lógica sería una segunda fuente de verdad de la navegación — justo lo que `UI.7`
  tiene que reordenar.

  **Los íconos NO se portaron.** `ICON` (`data.js`) tiene 36 SVG que las 11 pantallas vanilla
  siguen usando; copiarlos a React crearía dos fuentes de verdad para el mismo dibujo, que es el
  patrón que ya le costó al proyecto 11 días de commits sin chequear. React los lee por el
  puente (`lib/icons.tsx`) hasta que `UI.5` borre el vanilla.

  **SCOPE-LOCK respetado:** el botón de "modo avanzado" y el flag `localStorage['orchestos-mode']`
  se migraron TAL CUAL, aunque `UI.7` los vaya a borrar. `UI.3` tiene prohibido tocar navegación.

  **Lo que encontró el gate escrito por el otro lado — los tres hallazgos:**
  1. **El contrato que Claude le pasó a Codex tenía un id equivocado** (`#rpToggleBtn`; el real es
     `#rpToggle`). Codex **detectó la discrepancia y conservó a propósito el selector del
     contrato para que fallara a la vista**, en vez de adaptarse en silencio al código — que es
     justo lo que debe hacer un test escrito por alguien distinto del autor. Y el id importaba:
     `#rpToggle { margin-left: auto }` (`styles.css:315`) es **el CSS que implementa la regla 1**,
     así que renombrarlo habría roto la regla que el gate mide.
  2. **El gate no era idempotente.** El estado del aside persiste en `localStorage`, así que una
     corrida dejaba el panel abierto y la siguiente medía el ciclo al revés y fallaba sin que
     nada estuviera roto. Ahora normaliza el estado antes de medir, en vez de asumirlo.
  3. **Un defecto cosmético de 1px, preexistente y ajeno a React.** El toggle del aside queda a
     7px del borde con el panel cerrado y a 8px con el panel abierto. Causa medida: con el aside
     cerrado la fila tiene 45px útiles (46 menos el `border-left`) y el botón necesita 30 + 16 de
     padding = 46, así que falta 1px y el padding derecho se come la diferencia. Es aritmética del
     CSS vanilla (`--rightpanel-w-collapsed: 46px`), idéntica antes y después de migrar, y **no es
     lo que la regla previene**: si el botón estuviera anclado al borde móvil, la diferencia sería
     de ~314px, no de uno. El gate lo mide con tolerancia de 1px **explicada**, y verifica aparte
     —sin tolerancia— el eje que la regla sí prohíbe: expandir el sidebar no mueve el botón
     (8px → 8px, exacto). Queda anotado como deuda cosmética; tocarlo es cambiar
     `--rightpanel-w-collapsed`, o sea el ancho del riel, y eso no es trabajo de `UI.3`.

  **Una corrección al propio criterio de la regla 3:** la primera versión subía por los ancestros
  hasta `<body>` y marcaba `.app` como recortador. `.app` es el contenedor de pantalla completa
  (`height: 100vh; overflow: hidden`) y por definición no puede recortar algo que queda dentro
  del viewport. Lo que la regla prohíbe es un `overflow` en el **aside** o en el **riel**, que sí
  recortaría un tooltip que por diseño se sale de su contenedor. La búsqueda ahora corta en
  `.app` y la comprobación geométrica del rectángulo cubre el resto.

  **Fuera de alcance, dicho explícitamente:** el CONTENIDO del panel derecho
  (Explorer / Terminal / Diff) sigue en vanilla. Es contenido de pantalla, no shell, y le toca en
  `UI.4`; las 4 reglas viven en los toprow y el riel, no en el árbol del explorer.

<a id="sprint-30-ci-1"></a>
### CI.1 — 🔍 Mutation Shards en rojo: no era mutación, era el esquema de la DB.
  (cerrado 2026-08-31)

  **Síntoma:** los 4 shards (`runtime-boundaries`, `executors`, `orchestration`,
  `context-routing`) fallaban en ~35s cada uno, todas las noches, desde el 2026-08-27. El
  tablero decía "All jobs have failed", que se lee como si el mutation testing estuviera roto.

  **Causa real:** `SQLiteError: no such table: runs`. Stryker aborta con *"One or more tests
  failed in the initial test run"* cuando la suite normal falla — o sea que ninguna mutación
  llegó a correr nunca. Confirma la nota de `CLAUDE.md`: *"Mutation Shards rojo casi nunca es un
  problema de mutación"*.

  **Por qué solo ahí, y por qué el Mac nunca lo vio.** `src/db/sqlite.ts` congela
  `ORCHESTOS_HOME` en su primer import (es un `const` de módulo), y **nadie corría
  `runMigrations()` en el camino de test**: solo lo hace `cli.ts` en top-level y un puñado de
  archivos de test que lo llaman por su cuenta. Así que un test que usa la DB pasaba solo si
  (a) la DB del host ya tenía las tablas, o (b) otro archivo que sí migra corría antes en el
  mismo proceso. En el Mac de Carlos siempre valía (a) —usa el dashboard a diario—, así que el
  fallo era **invisible en local por definición**. Y (b) depende del orden de archivos, que
  depende del conjunto que se ejecuta:
  · `bun run test:coverage` → `bun test` (repo entero, incluye `src/dashboard/__tests__`) ✅
  · Stryker → `bun test src/__tests__` (subconjunto) ❌
  Con el subconjunto, `engine-selection.test.ts` llegaba a la DB antes que cualquier archivo que
  migra. **Por eso el workflow de Tests estaba verde y Mutation rojo al mismo tiempo**, sin que
  fueran dos bugs distintos.

  **Fix:** `scripts/test-preload.ts` (corre `runMigrations()`, que es idempotente) declarado como
  `preload` en `bunfig.toml`. Se arregla en la infraestructura una vez, en vez de repartir
  `runMigrations()` por cada archivo que toque la DB — eso volvería a depender de que alguien se
  acuerde de agregarlo en el próximo test.

  **Evidencia (reproducido primero, no supuesto):** con `ORCHESTOS_HOME` en un directorio
  limpio, `bun test src/__tests__` daba **985 pass / 2 fail** (`no such table:
  chat_task_bar_events` — misma clase de fallo, otra tabla, porque cambia el orden) y con el fix
  da **986 pass / 0 fail**. Stryker local con home limpio ahora imprime *"Initial test run
  succeeded"*, que es exactamente el punto donde CI abortaba. Sin regresión: `bun run
  test:coverage` 1174 pass / 0 fail, ratchet sin mover.

  **Corolario, mismo patrón que `reference-ci-host-environment-drift`:** el test no afirmaba
  sobre su propio estado sino sobre el del host. Un CI que falla siempre deja de dar señal —
  estos 4 shards llevaban 5 días en rojo y ya se leían como ruido de fondo.
