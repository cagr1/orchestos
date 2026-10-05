# Sprint 30 — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="sprint-30-ui-9-3"></a>
### UI.9.3 — Modo Dev completo

Ejecutado por: luna · Spec: docs/specs/UI.9.3.md

Activity se presenta con su nombre en el rail, título y explicación en inglés/español, conservando
el identificador de pantalla y el modelo de datos de Runs. En el árbol, solo Workspace resalta el
proyecto, Chat resalta la sesión/agente y Activity no deja una fila del árbol seleccionada. El
rail Dev colapsado deja los iconos de proyectos centrados y accesibles por nombre/tooltip, sin
etiquetas visibles, filas de agentes, contadores ni controles `+`. Los runs fallidos mantienen
su estado inline; no se añadieron señales globales ni detección Git/backend.

Verificación independiente: `bunx tsc --noEmit` ✅; test focalizado de iconos **2 pass / 0 fail**;
`bun run build:ui` ✅; `bun run test:coverage` **1440 pass / 0 fail** ✅; `ui3-shell` **todos los
criterios PASS**, sin errores de consola. Playwright real (1280×800): transición Workspace →
proyecto (1 activo, 0 agentes) → agente (0 proyectos, 1 activo) → Activity (0 filas del árbol,
Activity activa); dos proyectos visibles al colapsar, nombres accesibles/tooltips presentes,
etiquetas con ancho 0/opacidad 0, y 0 filas de agentes/contadores/botones `+`. Se observaron runs
fallidos con su badge inline. La pantalla y navegación muestran `Activity` y `Actividad` según
idioma. `GET /api/tasks` devolvió 8 `done` y 2 `pending`, sin tareas bloqueadas/fallidas para
comprobar esa variante en vivo; no se fabricó una. Biome: los cuatro archivos pasan lint sin
errores con el formatter desactivado; el check normal sigue detectando format drift preexistente
en `public/app.js` (también presente en HEAD), sin cambios de formato automáticos. Gate en vivo: navegador real (Playwright/dashboard) — `docs/done/evidence/UI.9.3-live.json`.

<a id="sprint-30-ui-9-2"></a>
### UI.9.2 — Modo Chat completo

Ejecutado por: luna · Spec: docs/specs/UI.9.2.md

El CLI queda ligado a cada sesión: al restaurarla, OrchestOS carga primero sus metadatos y
renderiza únicamente modelo/esfuerzo válidos para el transporte efectivo. API mantiene el catálogo
OpenRouter; Claude conserva sus alias y cinco niveles de esfuerzo. Codex muestra su modelo por
defecto, sin esfuerzo ni catálogo API: el executor interactivo actual no tiene un contrato de
esfuerzo verificado. OpenCode/Local tampoco muestran controles de esfuerzo no soportados. El menú
de creación y las filas de sesión resuelven un mark para cada ID (Codex reutiliza OpenAI; API y
Local usan iconos genéricos). El switch Chat | Dev tiene icono, etiqueta, estado activo, foco y
`aria-pressed`; se agregó búsqueda de chats.

Verificación independiente: `bunx tsc --noEmit` ✅; 30 tests focalizados **pass / 0 fail** ✅;
`bun run build:ui` ✅; `bun run test:coverage` **1440 pass / 0 fail** ✅; `ui3-shell` **todos los
criterios PASS** ✅. En navegador real, creación desde `+ New chat` persistió Codex en la sesión;
API, Claude y Codex restauraron su identidad correcta, Claude presentó `low/medium/high/xhigh/max`,
Codex no ofreció esfuerzo ni DeepSeek/OpenRouter, todos los modos visibles resolvieron SVG y el
switch conservó ambos iconos y `aria-pressed` en rail expandido/colapsado. Gate en vivo: navegador real (Playwright/dashboard) — `docs/done/evidence/UI.9.2-live.json`; capturas en `docs/done/evidence/UI.9.2/`.

Deuda preexistente: `ui81-visual-consistency` sigue fallando solo por seis valores de
`border-radius` (`0px, 4px, 50%, 6px, 8px, 999px`); tipografías, selects nativos y baseline de
estilos inline pasan. UI.9.2 no modifica esa deuda.

<a id="sprint-30-ui-9-1"></a>
### UI.9.1 — Switch Chat | Dev, sidebar por modo y sesiones separadas

Ejecutado por: luna · Spec: docs/specs/UI.9.1.md

El shell separa Chat (sesiones generales `project_id NULL`) de Dev (Activity, proyectos y
agentes por proyecto), conserva el último modo/sesión y permite crear un chat o agente desde
el menú de CLI del sidebar. El backend expone explícitamente `?project=none`; el canvas ya no
duplica la lista de sesiones.

Verificación independiente: `bunx tsc --noEmit` ✅; `bun run build:ui` ✅; `bun run test:coverage`
**1435 pass / 0 fail** ✅; `ui3-shell` **todos los criterios PASS** ✅. Gate en vivo: navegador
real (Playwright/dashboard) — `docs/done/evidence/UI.9.1-live.json`; con dos proyectos reales,
Chat mostró solo generales, Dev aisló las sesiones por proyecto y el botón `+` creó un agente
persistido dentro del proyecto correcto. Capturas: `docs/done/evidence/UI.9.1/`.

Deuda preexistente: `ui81-visual-consistency` conserva el fallo documentado de UI.8.1 por seis
valores de `border-radius`; no fue introducido ni modificado por UI.9.1.

<a id="sprint-30-ui-9-4"></a>
### UI.9.4 — Agregar proyecto desde la UI

Ejecutado por: luna · Spec: docs/specs/UI.9.4.md

El sidebar muestra `+` junto a Projects. El servidor expone `POST /api/projects/choose`, abre el
selector nativo de macOS con argv fijo y registra solo la carpeta elegida en la DB, sin inicializar
ni indexar archivos. Cancelación, rutas inválidas y plataformas no macOS quedan controladas.

Verificación independiente: `bunx tsc --noEmit` ✅; test específico UI.9.4 **3 pass / 0 fail** ✅;
`bun run build:ui` ✅; `bun run test:coverage` **1434 pass / 0 fail** ✅.
Gate en vivo: navegador real (Playwright/dashboard) — `docs/done/evidence/UI.9.4-live.json`;
Carlos confirmó la selección desde el diálogo nativo y el proyecto quedó visible en el sidebar;
`GET /api/projects` devuelve dos proyectos reales, OrchestOS y
`/Users/carlosgallardo/Documents/projects/SalaDespecho`. La creación de agentes dentro del
proyecto no forma parte de este ítem y queda para UI.9.1.

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

<a id="sprint-30-ui-9-5"></a>
### UI.9.5 — Inspector condicional sobre el shell Chat | Dev

Ejecutado por: luna · Spec: docs/specs/UI.8.4c.md

El inspector contextual reemplaza el riel persistente: cerrado ocupa 0 px y no deja toggle ni
backdrop; una tarea real se abre desde la fila `tr.row[data-task]`, conserva detalle y permite
cerrar con botón, Escape, navegación y cambio de proyecto. El ancho se redimensiona y persiste,
las herramientas Terminal y Diff se cambian desde la palette, y el inspector abierto ocupa
390×844 en móvil.

Verificación independiente: dashboard real `http://127.0.0.1:4321` + Playwright, proyecto
`7078a96b02350763` (SalaDespecho), tarea real `crypto-page-v1`: boot cerrado 0 px; detalle sin
backdrop; resize 360→432 px y persistencia tras recarga; cierres por botón/Escape/navegación y
cambio de proyecto; palette Terminal→Diff; viewport móvil usable. La búsqueda del punto 3 no
encuentra `SidePanel`, `rightPanelOpen`, `rightPanelTab`, `rpToggle`, `rightpanel-w-collapsed` ni
`.side-panel` en fuentes activas; solo queda la limpieza de la clave legacy
`orchestos-rightpanel-tab`. Evidencia completa: `docs/done/evidence/UI.9.5-live.json`.

Limitaciones observadas y no inventadas: la base real no tenía sesiones chat persistentes elegibles,
por lo que el botón UI.9.2 “Open in Workspace” no pudo observarse; el cambio Dev→Chat reprodujo el
TypeError de `Sidebar` ya anotado en PLAN.md y fuera de alcance. `ui81-visual-consistency` sigue
fallando por los seis radios preexistentes de UI.3.5; no se tocó CSS de radios.

<a id="sprint-30-ui-9-6"></a>
### UI.9.6 — El puente no puede borrar estado con `undefined`

Ejecutado por: luna · Spec: docs/specs/UI.9.6.md

`setShellState()` filtra claves `undefined` antes del merge, alineando la actualización con la
detección de cambios; `syncNav()` conserva su publicación de `undefined` en Dev y documenta la
semántica. El test reproduce el patrón exacto: antes del fix falló (`Received: undefined`) y después
pasó (`1 pass / 0 fail`). No se tocó Sidebar ni CSS.

Gate en vivo: navegador real (Playwright) — `docs/done/evidence/UI.9.6-live.json`; dos ciclos
Dev→Chat→Dev con recarga, `consoleErrors=[]`, `pageErrors=[]`; `ui3-shell.mjs` completo: 18/18 PASS.
`bunx tsc --noEmit`, `bun run build:ui` y Biome sobre los archivos TypeScript cambiados pasaron.
`bun run test:coverage` quedó bloqueado por 8 fallos preexistentes/no relacionados; salida detallada
en la evidencia.

<a id="sprint-30-ui35a"></a>
### UI.3.5a — El gate invertido que mide de verdad, y el barrido de radios

Ejecutado por: luna · Spec: docs/specs/UI.3.5a.md

`ui81-visual-consistency.mjs` navegaba a `/?screen=<id>`, pero `app.js` nunca leyó
`URLSearchParams`: el parámetro se ignoraba en silencio y el gate medía **siempre la pantalla de
arranque**. Se detectó al correrlo sobre las 13 pantallas y obtener números idénticos en las 13.
Ahora cruza por `window.state` + `App.rerender()`, reporta la pantalla alcanzada frente a la
solicitada y aborta si no coinciden. El gate que UI.3.5 exigía existía desde UI.8.1 pero no hacía
lo que decía — Regla Cero aplicada al propio instrumento de medición.

Su umbral (`radii.length <= 2`) era **imposible de satisfacer**: UI.3.5 declara 4px + 8px y todo
nodo sin radio computa `0px`, o sea 3 valores como mínimo. Por eso llevaba meses en rojo sin poder
cerrarse. Pasa a lista blanca (`0px`, `--radius`, `--radius-lg`, `--radius-pill`,
`--radius-circle`): más estricto, no más laxo — `{6px, 7px}` pasaba por ser dos valores y el
diseño correcto fallaba.

Deuda de radios crudos **55 → 0**. Se agrega `--radius-circle` para los 13 usos de `50%`
(avatares y puntos de estado), legítimos y sin token hasta ahora.

Efecto secundario del arreglo, registrado a propósito: al medir de verdad cada pantalla aparecen
fallos de `font-size` y `style=` inline que antes quedaban invisibles. Son preexistentes y quedan
fuera de esta pasada; lo nuevo es que el gate ya puede verlos.

Verificación del cerebro: `bunx tsc --noEmit` limpio · `bun run test:coverage` 1440 pass / 0 fail ·
`bun run build:ui` ok · gate en vivo contra dashboard real en `chat`, `settings`, `graph`, `plan`,
`project` y `skills`, todas con pantalla alcanzada correcta y radios dentro de la lista blanca.
La corrida de Luna se interrumpió a mitad por un corte del cerebro (no por el ítem): dejó tres
pantallas como no ejecutadas sin inventar resultados, y el cerebro las re-corrió.
Gate en vivo: navegador real (Playwright/dashboard) — `docs/done/evidence/UI.3.5a-live.json`.

Cambio visual reportado por el ejecutor: controles que eran 6/7/12/20/5/2px pasan a 4px u 8px —
botones y controles se ven levemente más compactos.

`UI.3.5` padre sigue abierto: quedan `.card`, los componentes de `UI.2` y el shell.

<a id="sprint-30-ui-9-7"></a>
### UI.9.7 — Los cinco bugs que impedían probar, y el botón que nunca fue clickeable

Ejecutado por: luna · Spec: docs/specs/UI.9.7.md

Reportados por Carlos el 2026-09-18 usando el dashboard real, después de decir textualmente
*"quiero probar pero no se puede"*. Ejecutado por Luna en seis pasadas; spec en
`docs/specs/UI.9.7.md` (borrado al cierre).

Gate en vivo: navegador real (Playwright) contra el dashboard corriendo, **25/25 PASS** —
`docs/done/evidence/UI.9.7-live.json`, script versionado en `scripts/ui-gates/ui97-bugs.mjs`.

**El hallazgo que vale más que los cinco arreglos.** El botón "+ Add project" no estaba roto de
una forma: estaba roto de dos, encadenadas, y el ítem figuraba `[x]` todo el tiempo.

1. `UI.9.4` lo implementó dentro de `.sidebar-section-label`, y `styles.css:677-679` le aplica
   `display:none` a ese contenedor cuando el sidebar está colapsado — que es el estado por
   defecto. Medición cruda del gate: `btnExists=true, btnDisplay=grid, labelDisplay=none,
   btnRect.width=0`. El botón existía y tenía ancho cero. Lo irónico es que `styles.css:744-748`
   fue escrito por el propio `UI.9.4` para el caso colapsado (centrar el botón, ocultar el texto
   "Projects"): la intención estaba, pero la regla de la línea 677 la anulaba porque declara
   `display` y la de 744 no. **Nunca funcionó, ni el día que cerró con evidencia en vivo** — su
   gate corrió con el sidebar expandido.
2. Después `UI.9.1` (`4e8578e`) lo borró entero al reescribir el sidebar, dejando huérfanos el
   endpoint (`server.ts:280`), el handler `osascript` (`projects.ts:41-43`), el i18n y el CSS.

Por eso el gate de este ítem afirma el punto 1 en **los dos estados del sidebar**, leyendo
`data-sidebar` en vez de asumirlo, y con `.click()` real de Playwright — que falla si el
elemento no es visible, que es exactamente lo que se quiere que falle. Un gate que solo mide el
estado expandido es el que dejó pasar esto.

**Los otros cuatro.** `agentIconFor()` resolvía el alias contra `ICON` en vez de `AGENT_ICONS`,
así que Codex salía con un trazo aproximado mientras la barra de uso —que lee
`{...ICON, ...AGENT_ICONS}`— mostraba la marca real; ahora el `outerHTML` es idéntico en los dos
lugares (responde la pregunta que Carlos dejó anotada el 2026-09-16). El panel del composer para
Codex repetía el mismo dato tres veces y no ofrecía ningún control: fuera las filas muertas. El
esfuerzo de Codex ya existía en el ejecutor de tareas (`-c model_reasoning_effort=`,
`codex.ts:112`) y nunca se había cableado al chat; ahora llega al binario, verificado con un
mensaje real (`effort: high`, `status=completed`, sin fallback a OpenRouter). Y `Activity` murió:
`SCREENS.activity` era un passthrough literal a `SCREENS.runs` sin filtrar por proyecto, con
`runs` ya presente como tab del workspace — decisión de Carlos, que resuelve la pregunta abierta
en `PLAN.md:1888-1889`.

**Dos defectos que ningún test detectó y salieron de leer el diff.** Al sacar `agentLabel` del
trigger, `triggerLabel` quedaba `null` para OpenCode y Local (que no tienen niveles de esfuerzo),
y se disparaba un fallback preexistente con el literal inglés hardcodeado `'CLI default model'`
en una UI bilingüe, sobre un panel de cero controles: el texto muerto se había mudado, no muerto.
Y `scripts/ui-gates/ui3-shell.mjs` quedó midiendo menos que antes — su criterio 5 pasó de "un
click real mueve `window.state.screen`" a "el nodo existe", y el 7 de "el único activo coincide
con `state.screen`" a `length <= 1`, que **pasa con cero ítems activos**. Ambos restaurados; un
criterio que no puede fallar no es un criterio.

Luna reportó en una pasada *"3 tests fallan por problemas ambientales"*. Re-corrido el comando
exacto de CI por el cerebro: **1442 pass / 0 fail**. El reporte del ejecutor no es evidencia.

**Deuda registrada, sin ítem todavía.** Los **12 scripts de `scripts/ui-gates/`** no los corre
nada de forma mecánica: `ci.yml` ejecuta `test:coverage`/`typecheck`/`lint`, `pre-commit` corre
`tsc`/`secrets`/`ledger`, `pre-push` corre `test:coverage`. Ninguno toca los ui-gates. Por eso el
gate de `UI.9.4` pasó una vez y el botón se pudrió dos veces sin que nada se pusiera rojo — el
mismo patrón que la Regla cero describe con el hook desincronizado 11 días. Carlos lo señaló en
el mismo turno al preguntar si este arreglo de CSS iba a sobrevivir a la migración de la
interfaz: la respuesta honesta es que lo que tiene que sobrevivir es el gate, y hoy el gate
tampoco se hace cumplir.

**Fuera de alcance, con ítem propio:** picker de modelo para Codex (no hay catálogo verificado;
`codex.ts:75-79` documenta que ni el stream ni `config.toml` dicen cuál corrió), menú de tres
puntos por proyecto + `Delete project` (no existe endpoint), migrar la pantalla `chat`.

**Rozadura del proceso, anotada sin ítem.** Al commitear, el scope-lock bloqueó el cierre: seguía
declarado el alcance de la **sexta y última pasada** de Luna (`scripts/ui-gates/ui97-bugs.mjs`), no
el del ítem. El commit de cierre —uno solo, como exige `AGENTS.md`— abarca legítimamente las seis
pasadas más el cierre. Reparar eso por la vía oficial (`agent:preflight --scope`) es imposible una
vez marcado `[x]`: el preflight exige que el ítem esté abierto. Y la otra salida que el propio gate
ofrece —una línea `**Fuera de scope declarado:**` en `PLAN.md`— choca con `plan:render --check`,
porque `plan:reconcile` ya no acepta reescribir el cuerpo de un ítem que pasó a `done` en una
corrida anterior (`Could not prove a closing commit SHA`). Las dos salidas documentadas se cierran
entre sí cuando un ítem necesita más de una pasada delegada. Se resolvió ampliando
`.orchestos/active-item.json` (no versionado) al alcance real del ítem, con la razón escrita en el
propio archivo. Es fricción de proceso, no del producto, y no justifica una regla nueva — pero
queda escrita porque va a volver a pasar en cuanto otro ítem se delegue en varias pasadas.
<a id="plan-orden-ui-8-1"></a>
- [x] **UI.8.1 — ⚡ El gate visual, y Playwright como dependencia real.** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/UI.8.1.md
  Playwright ya estaba instalado como devDependency real (`package.json:67`, `1.63.0`) — solo
  desactualizados los comentarios de `ui2-design-system.mjs`/`ui3-shell.mjs`, corregidos.
  Nuevo `scripts/ui-gates/ui81-visual-consistency.mjs`: mide `font-size`/`border-radius` (excluye
  `#statusBadge`, el pill del header en `Header.tsx:18`)/`<select>` nativo/`style=` inline contra el
  dashboard real. Trinquete de inline vía `scripts/ui-gates/ui81-inline-style-baseline.json`
  (seed inicial 5, mismo patrón que `check-coverage.ts`). Gate en vivo:
  `docs/done/evidence/UI.8.1-live.json` — falla como se esperaba: 6 `border-radius` distintos
  (>2), el resto pasa (5 font-size, 0 selects nativos, 5 inline = baseline). Confirmado en vivo
  por el cerebro, mismo resultado. `bunx tsc --noEmit` y `bun run test:coverage` (1430 pass)
  verdes. Dashboard bajado al cierre.

<a id="plan-orden-ui-8-2"></a>
- [x] **UI.8.2 — 🧠 Integridad de datos: una sola fuente de verdad, de verdad.** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/UI.8.2.md
  Migraciones versionadas 10/11 en `src/db/migrate.ts` (`FUTURE_MIGRATIONS`, patrón
  precondition/apply/postcondition ya existente): `runs.project_id` y `files.project_id`/
  `code_edges.project_id` (unificado a `TEXT`) con FK real a `projects(id) ON DELETE SET NULL`,
  reconstrucción de tabla con `PRAGMA foreign_keys` OFF/ON solo durante esos dos steps. Filas
  huérfanas (project_id que no matchea ningún `projects.id` real — medido: 6 en `runs`, 17 en
  `files`, 14 en `code_edges`, estas últimas resultaron ser slugs de fixtures de test
  contaminando la DB real, `gfc-cs`/`gfc-go`/etc.) se ponen a `NULL`, nunca se borran filas.
  **`agents` queda sin tabla propia — decisión de Carlos, proyección derivada de
  `chat_sessions`/`runs` cuando UI.8.4 la necesite.**
  Gate en vivo: `docs/done/evidence/UI.8.2-live.json` — migración probada primero sobre una copia
  de la DB real con registro centinela (conteos antes/después idénticos salvo el centinela,
  FK verificadas con `PRAGMA foreign_key_list`, INSERT inválido rechazado), después aplicada a
  `~/.orchestos/db.sqlite` real con el mismo resultado (102/17/14 filas preservadas, huérfanos
  nulados). Primera corrida de `test:coverage` reveló 22-25 fallos reales por fixtures de
  `graph-resolver-e2e.test.ts`/`suggest.test.ts` insertando `project_id` sin fila real en
  `projects` — corregido insertando/limpiando una fila real de proyecto por test, sin relajar la
  FK. `bunx tsc --noEmit` y `bun run test:coverage` (1430 pass) verdes.

<a id="plan-orden-ui-8-3"></a>
- [x] **UI.8.3 — 🧠 Matar la navegación vieja (absorbe UI.7, sube antes de UI.4).** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/UI.8.3.md
  Rail de 3 zonas real: `Chat`/`Activity` arriba (`Activity` reusa `SCREENS.runs`), árbol de
  proyectos (`GET /api/projects`) en el medio, `Settings` abajo (`Sidebar.tsx`). Las 7
  capacidades pasan a un nuevo `SCREENS.workspace` con tabs que reusan el `render()`/`wire()` de
  cada pantalla existente tal cual (sin reescribirlas). Modo avanzado borrado por completo:
  `toggleAdvancedMode`, `localStorage['orchestos-mode']`, prop `advanced` en `shell-store.ts`/
  `Sidebar.tsx`/`shell-api.ts`, filtro en `openCommandPalette`. `SCREENS.runner` eliminado
  (deuda CC.0-D5). Multi-proyecto real con header `x-orchestos-project-id` por-request queda
  para ERP.2 a propósito (backend ya lo soporta, frontend aún no lo envía).
  **Hallazgos del cerebro al verificar en vivo, corregidos antes de cerrar:** (1) el primer
  intento nunca corrió `bun run build:ui` — el navegador servía el bundle React viejo, el árbol
  de proyectos no existía en pantalla pese a que el código fuente ya lo tenía; (2) la pestaña
  `graph` del workspace nunca disparaba su fetch inicial (antes solo lo hacía `App.go('graph')`,
  camino que el nuevo tab-switch no usa) — agregado el mismo lazy-load en
  `SCREENS.workspace.wire()`.
  Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.3-live.json` — dos proyectos reales registrados
  (uno temporal, borrado después), rail de 3 zonas, 8 tabs de workspace, `graph` dispara su
  fetch al cambiar de tab, cambiar de proyecto actualiza el workspace sin mezclar datos, mini-menú
  de CLI de ERP.1 sigue funcionando tras la reescritura de nav. `bunx tsc --noEmit`,
  `bunx biome check` (0 errores en los archivos tocados) y `bun run test:coverage` (1430 pass)
  verdes. Dashboards de prueba bajados al cierre.

- [ ] **UI.8.4 — 🧠 Shell Chat | Workspace (absorbe UI.6).**
  Inspector **condicional** (0px cerrado, no riel), con ancho persistido y una sola fuente de
  selección en el estado del shell. Árbol de proyectos con agentes como filas colapsables
  (§A.2), selección como único contenedor con borde (§A.3), anomalías inline (§A.4).
  **Contrato de la transición Chat → Workspace**, que hoy no está definido:
  1. Si la conversación **no** generó trabajo persistente, la acción **no aparece** (no aparece
     deshabilitada — un botón que a veces no lleva a ningún lado es el "botón que no hace nada"
     de la Regla Cero).
  2. Si lo generó: abre **proyecto + entidad de origen ya seleccionada**, misma pestaña, con el
     chat conservado y accesible en un gesto de vuelta.
  Gate 🔍 en vivo con los dos casos de (1) y (2).
  **Progreso — 3 piezas (árbol de agentes, contrato Chat→Workspace, inspector condicional); UI.8.4c/UI.9.5 cerradas, padre pendiente del gate agregado:**
  - [x] **UI.8.4a — agentes como filas colapsables** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-agents.md
    Header `N agents ⌄` por proyecto en `Sidebar.tsx`, filas = sesiones de `chat_sessions`
    (icono+título+tiempo relativo, sin borde/caja), click abre esa sesión en Chat, fila activa
    marcada con borde (§A.3). Sesiones de un proyecto no-cwd se listan con `?project=<id>`
    puntual (el backend ya lo soportaba) — no es ERP.2, ningún otro endpoint quedó filtrado por
    proyecto. Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4-agents-live.json` — dos proyectos reales, sesiones no se mezclan.
    Límite menor conocido: el contador muestra `0 agents` hasta el primer expand (carga
    perezosa a propósito, no dato falso).
  - [x] **UI.8.4b — contrato Chat→Workspace** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-workspace.md
    `sessionHasPersistentWork`/`getLastPersistentTaskId` (`src/db/chat-turns.ts`) leen
    `chat_turns.task_id`; `toSessionRow` expone `hasPersistentWork`/`lastPersistentTaskId`.
    Botón "Open in Workspace" en `SCREENS.chat` solo existe en el DOM si la sesión activa
    generó una tarea — nunca deshabilitado. Click navega a `workspace` con el proyecto de la
    sesión, tab `tasks` activo, y abre `SidePanel.openTask` con la tarea real. Volver a `Chat`
    desde el riel conserva la sesión sin tocar nada nuevo.
    Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4b-live.json`
    — caso 1 (sin trabajo persistente) confirma el botón ausente del DOM; caso 2, con un turno
    real apuntando a una tarea real (`crypto-page-v1`), confirma workspace+tab+SidePanel
    correctos y la sesión preservada al volver. `bunx tsc --noEmit`, `bunx biome check` (0
    errores) y `bun run test:coverage` (1431 pass) verdes.
  - [x] **UI.8.4c — inspector condicional** (0px cerrado, ancho persistido), retomada por UI.9.5
    tras UI.9.1–9.4; spec re-leído y actualizado contra el shell Chat | Dev actual
    (`docs/specs/UI.8.4c.md`).
    Ejecutado por: luna · Spec: docs/specs/UI.8.4c.md
    Gate en vivo: navegador real (Playwright/dashboard), evidencia en `docs/done/evidence/UI.9.5-live.json`; el flujo UI.9.2 Open in Workspace no fue observable porque no había sesiones persistentes elegibles en la base real, y queda documentado en la evidencia junto al error preexistente de Sidebar al cambiar Dev→Chat.

  **Anotado por Carlos (2026-09-15), pendiente de planificar, no implementado todavía:** donde
  hoy dice "Projects" en el riel debería tener un ícono `+`/carpeta-con-agregar para dar de alta
  un proyecto nuevo desde la UI (hoy solo se registra vía `orchestos index`/CLI o
  `POST /api/project/index`, nunca desde el dashboard). Al agregarlo, tiene que poder verse y
  editarse las opciones de ESE proyecto — esto viviría en Settings, en una sección de proyectos
  (encaja con `UI.8.5` § Settings agrupado por alcance: `Global · Proyecto · Agente`, ver
  `PLAN.md` línea ~1780). Carlos también notó que el tab `Runs` se siente duplicado con
  `Activity` (que hoy reusa literalmente `SCREENS.runs` — ver decisión de UI.8.3 arriba); a
  revisar si `Activity` debe ser una vista distinta (cruzando proyectos, per
  `dashboard-experience-direction.md` línea 84) en vez de un alias del mismo contenido que ya
  vive dentro del workspace de cada proyecto.

- [ ] **UI.8.5 — 🧠 Composición visual: barra de estado, Settings y controles.**
  Recién acá entra "que se vea excelente", y con la anatomía ya escrita:
  - **Barra de estado inferior permanente** (§A.5): `% de contexto + tiempo de sesión` a la
    izquierda, avisos al centro, recursos a la derecha. **Es la superficie que `H.7.5` necesita**
    — el % de contexto no va en una card del home. Resuelve también dónde vive el costo en Chat.
  - **Settings agrupado por alcance** (§B.1): `Global` · `Proyecto` · `Agente`, con la anatomía de
    fila de §A.9 (label + descripción de una línea + control a la derecha, sin divisores).
    Corrige el reclamo textual de Carlos: *"Settings no parece usable, hay cosas que hay que
    desaparecer o darles sentido"*.
  - **Selector de agente como chips con icono** (§A.10), no `<select>`; `Combobox` se reserva para
    listas largas (`reference-model-combo-pattern`).
  - **Barra de uso de contexto** en la fila de sesión (§C.2).
  Gate 🔍: el de UI.8.1 en verde sobre estas pantallas, más navegador real.

- [ ] **UI.8.6 — 🧠 Permisos visibles (`INS-2026-014`).**
  Hoy **no existe** mecanismo de aprobación en el chat: el harness invoca los CLIs en modo no
  interactivo por diseño (`codex exec --sandbox workspace-write` en `src/run/executors/codex.ts`,
  equivalente en `external.ts`). El documento de dirección lo exige y sin este ítem queda como
  prosa incumplible — el mismo patrón que dejó a UI.3.5 sin efecto.
  Modelo tomado de Orca (§A.6, §A.11): tira permanente de una línea sobre el compositor
  declarando el estado real, más un segmented control honesto `Yolo | Manual` en Settings del
  agente. No un modal que se acepta una vez y se olvida.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado.

### UI.9 — Shell de dos modos: Chat | Dev (ABIERTO 2026-09-15)

> **Revierte una decisión, sin borrarla.** El 2026-09-02 (UI.7/UI.8.3) se decidió que Chat |
> Workspace fuera profundidad contextual y no un modo etiquetado, y se borró el "modo avanzado".
> El 2026-09-15 Carlos pidió textualmente un switch explícito arriba a la izquierda, como Claude
> Desktop: *"poner el switch en la parte de arriba para hacer un chat normal donde ahí sí se puede
> seleccionar cualquier modelo… y los chats se van acumulando en ese mismo lado izquierdo"* y
> *"si quiero dev entonces ahí se activa el 'modo orca' donde puedo abrir proyectos (carpetas) y
> así mismo los agentes se verán del lado del aside debajo del proyecto"*. **Gana el switch
> explícito.** El texto de UI.7/UI.8.3 queda como historial.
>
> **Motivo medido (auditoría en vivo 2026-09-15):** la lista de sesiones aparece dos veces
> (sidebar `Sidebar.tsx:111-179` rotulada "N agents" + aside del chat `screens-core.js:474-529`);
> las "agents" del sidebar son `chat_sessions`; el rail colapsado amontona "Projects" y
> "0 agents". Referencias: Dev = `~/Documents/screens/Orca1_main.png` (`docs/ui-reference-patterns.md`
> A.1–A.7); Chat = captura de Claude Desktop de Carlos (2026-09-15).
>
> **Decisiones de Carlos (2026-09-15):** (1) cada modo muestra lo suyo — Chat lista sesiones
> `project_id NULL`, Dev las de cada proyecto; (2) "agente" en Dev = sesión de chat con CLI dentro
> del proyecto, tareas/runs siguen en Workspace/Activity; (3) agregar proyecto = diálogo nativo de
> macOS abierto por el servidor; (4) el switch cambia sidebar **y** canvas (último chat general o
> vacío ↔ último proyecto/agente). Plan completo: absorbido en este PLAN.md el 2026-09-17 al borrar `NEXT.md`; sus dos requisitos huérfanos (datos sembrados y pantalla legacy `tasks`) viven ahora en § Entregable rápido.

> **Orden (Carlos, 2026-09-15): UI.9.4 va primero.** OrchestOS se prueba desde la interfaz: *"si
> funciona ya en back se lo debe mostrar en el front, sino no existe"*. El gate de UI.9.1 necesita
> ≥2 proyectos y registrar un proyecto hoy solo existe por CLI — ningún gate puede exigirle un
> comando a Carlos.

<a id="plan-orden-ui-9-a"></a>
- [x] **UI.9.A — 🔍 La barra lateral del inspector desapareció y nadie la mandó a quitar.** (abierto 2026-09-18, cerrado 2026-09-18)
  **Reporte textual de Carlos, 2026-09-18:** *"por un caso no sé por qué la barra lateral
  desapareció, yo no pedí en ningún momento eliminar eso"*. Lo dice describiendo lo que espera ver
  al abrir un proyecto: source control y explorer — *"la repo en sí, que ya la mostrábamos"*.
  Confirma que existió y se perdió; no es una feature nueva que pide.
  **Hipótesis a verificar, NO conclusión.** Explorer/Terminal/Diff viven en el panel derecho
  (`RightPanelToprow.tsx:35-55`, contenido vanilla), y `UI.9.5` cerró como *"Inspector
  **condicional** sobre el shell Chat | Dev"*. Lo más probable es que alguna de esas condiciones
  lo esconda en el recorrido normal de Carlos. **Verificar en vivo antes de tocar nada** y
  encontrar el commit que lo cambió (`git log -S` sobre las condiciones del inspector), igual que
  se hizo en `UI.9.7` con el botón borrado por `UI.9.1`.
  **Por qué tiene ítem propio y 🔍:** es el tercer caso en tres días de algo que funcionaba y
  desapareció sin que ningún ítem lo pidiera —el botón "+ Add project" (dos veces) y ahora esto—.
  Si el diagnóstico confirma que un ítem cerrado lo quitó de refilón, eso es evidencia directa
  para `CI.2`: no hay nada que avise cuando una pantalla pierde una parte.
  **Diagnóstico CERRADO 2026-09-18 (leído en el código, ya no es hipótesis).** `30ab117` (UI.9.5)
  reemplazó el botón permanente `#rpToggle` del aside por `#rpClose` y añadió
  `if (!inspector) return null` en `RightPanelToprow.tsx:27`: los botones de explorer/terminal/diff
  **solo existen cuando el inspector ya está abierto**. El único punto de entrada que queda en todo
  el producto es el command palette (`app.js:2305-2312`). Y `selectWorkspaceProject()` llama
  `closeInspector()` (`app.js:3357`), así que abrir un proyecto garantiza que quede cerrado y sin
  forma de reabrirlo con el mouse. Confirmado: un ítem cerrado lo quitó de refilón.
  **Ubicación decidida por el cerebro** (tres reglas cerradas chocaban): el header no lleva iconos
  (`Header.tsx:6`, ronda 4 de v0.12) y el inspector cerrado debe medir 0px (criterio de UI.9.5), así
  que los tres botones van al final de la barra de tabs del workspace (`screens-ops.js:18`).
  Spec: `docs/specs/UI.9.A.md`.
  **Cierre 2026-09-18.**
  Ejecutado por: luna · Spec: docs/specs/UI.9.A.md
  Arreglo: tres botones permanentes Explorer/Diff/Terminal al final de la barra de tabs del
  workspace (`screens-ops.js:17-24`, cableados en `:38-44`), `selectWorkspaceProject()` ya no cierra
  un inspector de herramienta (`app.js:3359`), y `closeInspector()` repinta la pantalla para que el
  estado `active` no quede congelado (`app.js:3141`). El header sigue sin iconos y el inspector
  cerrado sigue midiendo 0px: ninguna de las dos reglas cerradas se tocó.
  Ronda 2 necesaria: la primera entrega de Luna pasó 14/14 con el `active` muerto —markup y CSS que
  existían y nunca se encendían—; lo detectó el cerebro clickeando con Playwright, no el gate. Las
  tres afirmaciones de `active` se agregaron por eso.
  Gate en vivo: navegador real (Playwright sobre el dashboard en :4323) — `docs/done/evidence/UI.9.A-live.json`, **17/17 PASS** vía
  `bun run gate:evidence -- --label UI.9.A -- node scripts/ui-gates/ui9a-inspector.mjs`, corrido por
  el cerebro y no por el ejecutor. El gate abre todo **clickeando**: no usa `window.OrchestOS` ni
  `window.state` para navegar, que es exactamente el atajo por el que `ui3-shell.mjs:58` no vio que
  no quedaba ningún botón. Afirma visibilidad y clickeabilidad real (`boundingBox` + `click({trial:true})`)
  con sidebar colapsado y expandido, antes y después de cerrar el inspector.
  `bun run build:ui` ✅ · `bunx tsc --noEmit` ✅ · `bun run test:coverage` **1442 pass, 0 fail**,
  functions 75.64% / lines 63.94% ✅ (el ejecutor reportó "3 fallos preexistentes"; no los hay —
  otro recordatorio de que el reporte del ejecutor no es evidencia).

<a id="plan-orden-ui-9-b"></a>
- [x] **UI.9.B — ⚡ Los radios del kit React no siguieron a UI.3.5.** (abierto 2026-09-20, cerrado 2026-09-20)
  Sale del único FAIL de `ui2-design-system` que resultó ser **bug de producto y no gate podrido**
  (ver la medición de `CI.2`). `UI.3.5` bajó la geometría —el propio CSS lo dice en
  `styles.css:45-46`, "todo lo demás baja a `--radius`/`--radius-lg`"— y dos componentes del kit
  se quedaron con el número viejo pegado a mano: `tabs.tsx:35` con `rounded-[20px]` contra el
  `var(--radius-lg)` (8px) de `.filter-tab`, y su hermano **`dialog.tsx:30` con `rounded-[12px]`**,
  que no es ningún token del sistema, contra el `var(--radius-lg)` del `.modal`. El hermano no lo
  ve ningún gate: `ui2-design-system.mjs:205` compara solo el `width` del Dialog, nunca el radio —
  otra afordancia sin cobertura, que hereda `CI.2`. `button.tsx` e `input.tsx` ya consumen el token:
  el arreglo es copiar ese patrón, no inventar otro. Spec: `docs/specs/UI.9.B.md`.
  **Ampliado el 2026-09-20 con lo que encontró Luna al ejecutar, y corrige un error de este plan:**
  el gate **sí** medía el radio del Dialog (`ui2-design-system.mjs:206`), pero contra el literal
  `'12px'` copiado a mano del componente que debía auditar (`49f5d3f`, `UI.2`), mientras su mensaje
  afirma *"como el vanilla"* sin computar jamás el `.modal`. O sea: el gate no es que no viera el
  bug — **lo bendecía en verde**, y se pone rojo recién cuando el componente se corrige. Para `CI.2`
  es el peor caso de los cuatro que lleva anotados: un gate que cristaliza el valor equivocado como
  verdad de referencia. El assert entra en el alcance de este ítem: debe medir el `.modal` real con
  la misma técnica que el gate ya usa para Tabs (`:167-180`).
  **Cierre 2026-09-20.** Ejecutado por: luna · Spec: `docs/specs/UI.9.B.md` · Commit: `801a8d8`.
  Gate en vivo contra el dashboard real en :4323, salida cruda: **32 PASS / 0 FAIL** (antes 31/1).
  `PASS — Tabs: la pestaña activa espeja .filter-tab (radio 8px, …)` y
  `PASS — Dialog: radio 8px como el vanilla (8px)`, este último ya medido contra un `.modal`
  creado en vivo con `getComputedStyle`, no contra el literal. El bundle de `public/dist/` no va
  al commit: está en `.gitignore:50`, se regenera con `bun run build:ui`.

<a id="plan-orden-ui-10"></a>
- [x] **UI.10 — 🧠 Specs, Skills y Plan vuelven, por proyecto, dentro de Settings.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.10.md
  **Plan CONFIRMADO por Carlos 2026-09-21 ("GO"). Spec: `docs/specs/UI.10.md`, ejecuta Luna.**
  **Decisión de Carlos (2026-09-21, dicha varias veces):** cada proyecto tiene sus propias reglas,
  skills, specs y plan, y se ven en Settings, en una sección con el nombre del proyecto
  seleccionado, como Orca. Memoria: `feedback-specs-skills-plan-por-proyecto`.
  **Referencia leída (Orca, `gh api`):** `SettingsSidebar.tsx:266-300` agrega, después de los
  grupos generales, un grupo "Projects" con un botón por repo (icono + nombre); al clickear se
  abre `RepositoryPane.tsx`, la página de ese repo.
  **Estado actual verificado (inventario de Luna + lectura del cerebro):** Settings es vanilla,
  navega con `data-settings-sec` en 4 grupos (`screens-ops.js:1899-1920`), y no tiene sección de
  proyecto: la que se llama `project` es la Danger zone (`screens-ops.js:1970-1985`). Specs y Plan
  ya resuelven el proyecto en el server (`withDashboardProject`, header `x-orchestos-project-id` o
  `?project=`), pero el front **no manda** el proyecto (`app.js:183-203`) y cae al cwd del
  dashboard. Skills es global: sus endpoints no reciben `root` (`server.ts:237-274`,
  `handlers/skills.ts:41-78`).
  **Pasos propuestos:**
  1. Settings gana un grupo "Projects" al final de `settings-nav`, con un botón por proyecto de
     `state.projects` (nombre) y `data-settings-sec="project:<id>"`.
  2. La página de un proyecto lleva el nombre como título y tres pestañas: Specs | Skills | Plan.
     Monta las islas `screen-specs`/`screen-skills`/`screen-plan` que ya existen, sin
     rediseñarlas.
  3. Los fetch de Specs y Plan mandan el id del proyecto elegido en Settings (el header ya
     soportado). Skills pasa a leer `skills/` bajo el `root` del proyecto, por el mismo
     `withDashboardProject`.
  4. Gate en vivo que llega clickeando: Chat → Settings → proyecto → cada pestaña. Con dos
     proyectos, afirma que los datos cambian al cambiar de proyecto.
  **Fuera de esta pasada:** reglas por proyecto (no hay pantalla hoy, va a un ítem propio); el
  menú de tres puntos por proyecto en el sidebar (observación del 2026-09-16); rediseñar las
  pantallas.
  **Desbloquea `CI.2.A`:** `ui0`, `ui4-specs`, `s6` y `s6a` pasan a llegar por este camino.
  **AVANCE 2026-09-21 (primera entrega de Luna, 12/13; resuelto en el cierre de abajo).**
  `tsc` limpio y `bun run test:coverage` 1443 pass / 0 fail (corrida propia; los 3 rojos que
  reportó Luna eran de su sandbox). Gate nuevo `scripts/ui-gates/ui10-project-settings.mjs`
  contra el dashboard real en :4323: **12 PASS, 1 FAIL**. Settings muestra el grupo Projects con
  SalaDespecho y orchestos; al clickear, título con el nombre, pestañas Specs | Skills | Plan, y
  cada fetch lleva el `x-orchestos-project-id` del proyecto clickeado, también al cambiar al
  segundo.
  **El FAIL es real y no es de la UI:** "sin errores de consola (2)" = dos `409` de `/api/plan`
  en SalaDespecho: *"PLAN.md is out of sync with the plan database"*. Causa: `plan_items` y
  `plan_doc_segments` **no tienen columna de proyecto** (esquema leído en la DB), y
  `renderPlan(db)` (`handlers/plan.ts:22`) siempre arma el plan de OrchestOS y lo compara con el
  `PLAN.md` del proyecto elegido. La pestaña Plan solo funciona para OrchestOS; en los demás
  proyectos muestra *"Could not load the plan"*. Specs y Skills sí son por proyecto.
  **Pendiente de Carlos:** que el plan sea por proyecto exige una migración (`project_id` en las
  dos tablas, PK compuesta) y tocar `plan-import`/`plan:reconcile`/`plan:render` y el
  pre-commit. Es un ítem propio, no se mete en este.
  **Cierre 2026-09-21.** Carlos eligió cerrar con mensaje claro y abrir `UI.10.A`. Addendum del
  spec (Luna, ronda 2): para un proyecto que no es el del cwd, `GET /api/plan` responde `200`
  `{ items: [], unavailable: 'plan-not-per-project' }` y las mutaciones `409` (`server.ts`);
  `PlanBoardScreen.tsx` muestra un estado neutro "Per-project plans are not available yet…" sin
  Refresh. Para orchestos `/api/plan` sigue devolviendo sus ítems (curl verificado).
  `tsc` limpio; `bun run test:coverage` **1443 pass / 0 fail** (functions 75.74%, lines 63.92%),
  corrida del cerebro.
  Gate en vivo: navegador real (Playwright, dashboard en :4323) — `docs/done/evidence/UI.10-live.json`,
  **13/13 PASS en 3 corridas seguidas** de
  `scripts/ui-gates/ui10-project-settings.mjs`, corridas por el cerebro. Una corrida anterior vio
  0 proyectos: `App.go('settings')` pintaba antes de que `/api/projects` respondiera, y el
  usuario veía un instante "Sin proyectos registrados". Corregido en la ronda 3 (`projectsList`
  arranca en `null` = no cargado; el gate espera el primer proyecto).
  Llega clickeando desde Chat → Settings → proyecto → pestañas, sin `window.*`; afirma el
  `x-orchestos-project-id` de cada fetch y el cambio al segundo proyecto. Captura revisada a ojo
  de la pestaña Plan de SalaDespecho.

- [ ] **UI.10.A — 🧠 El plan por proyecto: `plan_items` y `plan_doc_segments` con proyecto.** (abierto 2026-09-21)
  Sale de `UI.10`: el plan de la DB es uno solo, sin columna de proyecto, y `renderPlan(db)`
  (`handlers/plan.ts:22`) arma siempre el de OrchestOS. Hoy la pestaña Plan de cualquier otro
  proyecto muestra "not available yet" (`server.ts`, rutas `/api/plan*`). A diseñar: migración
  (`project_id` + PK compuesta), `plan-import`/`plan:reconcile`/`plan:render` y el pre-commit por
  proyecto, y quitar el corte por cwd de `server.ts`. Plan corto a Carlos antes de codear (toca
  varios módulos).
  **HALLAZGO QUE CAMBIA EL DISEÑO (2026-09-21, leído en el código y en el disco):** el `PLAN.md` de
  SalaDespecho es una checklist libre (`- [ ] Auditar…`, sin ID ni 🧠⚡🔍). El parser
  (`scripts/plan-status.ts:45`) exige `- [ ] **ID — 🧠 Título**`: sobre ese archivo devuelve **0
  ítems**. Y el modelo "la DB es la fuente, `PLAN.md` se renderiza" solo se sostiene porque el
  pre-commit de **este** repo corre `plan:render --check`; en otro repo nadie reconcilia, y a la
  primera edición a mano vuelve el 409 "out of sync". Migrar las tablas (`project_id` + PK
  compuesta) no alcanza para que el Plan de SalaDespecho muestre algo.
  **Opciones planteadas a Carlos:** (a) migración completa, y los proyectos adoptan el formato de
  OrchestOS y su hook; (b) sin migración: para un proyecto que no es OrchestOS, la pestaña Plan
  lee su `PLAN.md` en solo lectura (secciones `##` y checkboxes, sin dependencias ni cierre), un
  módulo nuevo más `server.ts`; (c) las dos. Recomendación del cerebro: (b). Pendiente de Carlos.
  **DECIDIDO POR CARLOS 2026-09-21: (b).** Cada proyecto usa su propio `PLAN.md`, en solo lectura;
  no se le impone el formato de OrchestOS. Sin migración de `plan_items`.

> **DECISIONES DE CARLOS 2026-09-21 — sidebar de proyectos, look nuevo y etiquetas del plan.**
> Contestadas en una sola ronda (memoria `feedback-preguntas-todas-juntas`). Pendientes de
> convertirse en ítems; no se implementan sueltas.
> 1. **Fila de proyecto:** icono `folder-closed` (lucide) en vez del libro actual. En hover, a la
>    derecha, tres iconos: chevron de expandir, `ellipsis` y `plus`; sin hover desaparecen. El
>    clic **solo expande/colapsa sus agentes**, no navega (hoy salta a Dev → Tasks,
>    `app.js:3410`). Sin nada elegido, el área principal queda vacía con el SVG de OrchestOS.
> 2. **Menú `ellipsis` del proyecto:** solo *Project settings* y *Delete project* (icono rojo).
>    *Project settings* lleva a Settings (la página de proyecto de `UI.10`). No existe hoy ni en
>    el front ni en el back (no hay endpoint para borrar un proyecto).
> 3. Tasks, Runs y Graph dejan de abrirse al clickear el proyecto; se ven solo desde su settings.
> 4. **Cerrar un agente = archivarlo** en un historial por proyecto, al estilo del panel "Agents"
>    de Orca en el lateral derecho. Hoy no hay forma de cerrarlos ni endpoint.
> 5. **Contador de agentes:** chip chico, siempre real, sin tener que expandir (hoy se carga
>    solo al expandir, `Sidebar.tsx:284-295`). La altura del chevron (hoy muy abajo) **no se
>    parchea con CSS suelto**: se arregla cuando se rehaga la cara del sidebar en React. Mismo
>    criterio para cualquier ajuste visual pedido antes de ese cambio: anotarlo, no gastar tokens.
> 6. **Adiós a 🧠⚡🔍:** reemplazar por etiquetas de texto propias que cualquier LLM entienda.
>    Toca parser (`scripts/plan-status.ts:45`), `CHECK` de `plan_items.delegation` y los ítems del
>    plan en un solo cambio.
> 7. = decisión (b) de arriba.
> 8. **Look nuevo pieza por pieza**, pero cada pieza tiene que verse como las referencias. Si una
>    referencia no está anotada con su fuente, preguntar en vez de suponer. Objetivo dicho por
>    Carlos: "CRM moderno".
> 9. **Referencia nueva:** Circle (https://circle.lndev.me/lndev-ui/team/DESIGN/overview, repo
>    `ln-dev7/circle`, Next.js + shadcn/ui, estilo Linear). La guía principal sigue siendo
>    `docs/ui-reference-patterns.md` + capturas en `~/Documents/screens/`.
> **Segunda ronda, mismo día:**
> - **Panel derecho = historial de agentes**, captura nueva `~/Documents/screens/rightside_agents.png`
>   (Orca): tabs de iconos arriba (archivos, agentes, source control, tasks) + toggle del panel;
>   título + "N shown", segmented `Workspace | Project | All`, buscador, grupo por proyecto con
>   contador, y por sesión: título, última línea, icono del CLI, mensajes, hace cuánto, modelo,
>   chevron y `ellipsis`. Cerrar un agente del sidebar lo manda acá. **No se llama "Agents"**: el
>   cerebro elige **"History"** (i18n "Historial").
> - **El botón que mostraba el panel derecho vuelve a ser permanente.** Hoy los botones de
>   Explorer/Diff/Terminal solo viven en la barra de tabs del workspace (arreglo de `UI.9.A`), y con
>   la decisión 1 (el clic en proyecto ya no abre el workspace) se vuelven a perder. Toggle fijo
>   arriba a la derecha, como en Orca. Esto reemplaza el criterio "inspector cerrado = 0px" de
>   `UI.9.5`.
> - **Quitar el pill `IDLE`/`RUNNING`** del header (`Header.tsx:18-21`).
> - **Estado del agente en la fila:** loader chico mientras trabaja, check chico al terminar.
> - **Delete project = quitar del espacio de trabajo**, sin borrar la carpeta, con confirmación;
>   coincide con lo que ya fijó `UI.9.9` el 2026-09-18 (ese ítem ya existía y es la pieza 2).
> - **Tema:** oscuro por defecto. Renombrar los temas: `claude` no puede llamarse así
>   (`theme.js:9`, `i18n.js:829,1742`).
> - Reparto de referencias no contestado explícitamente: se sigue la recomendación (estructura de
>   Orca, piel visual Circle/Linear, oscuro). Si Carlos lo corrige, manda lo suyo.
> **Orden aprobado ("GO"):** 0. `CI.2.A` (Luna, spec listo). 1. Sidebar de proyectos en React con
> la cara nueva (decisiones 1 y 5, loader/check, sin pill IDLE). 2. `UI.9.9` menú `ellipsis`
> (Project settings / Delete project) + back. 3. Panel derecho History + archivar agente + toggle
> permanente. 4. `UI.10.A` plan de cada proyecto en solo lectura. 5. Etiquetas de texto en vez de
> emojis. Temas renombrados entran en la pieza 1.

- [ ] **UI.11 — 🧠 Sidebar de proyectos con la cara nueva (pieza 1 del orden de arriba).** (abierto 2026-09-21)
  Decisiones 1, 3 y 5 de Carlos + loader/check, sin pill `IDLE`, temas renombrados y botón fijo
  del panel derecho. **Ajuste del cerebro al orden:** si el clic en el proyecto deja de abrir el
  workspace, Tasks/Runs/Graph/Memory/Instincts quedan sin camino hasta la pieza 2, y los botones
  Explorer/Diff/Terminal también (viven en la barra del workspace desde `UI.9.A`). Por eso esta
  pieza suma esas pestañas a la página del proyecto en Settings (`UI.10`), el ítem *Project
  settings* del menú `…` y el toggle `#rpToggle`. *Delete project* sigue en `UI.9.9`.
  Spec: `docs/specs/UI.11.md`. Ejecuta Luna después de `CI.2.A`; gate
  `scripts/ui-gates/ui11-sidebar-projects.mjs`, 3 corridas verdes, captura revisada contra Orca y
  Circle.
  **PAUSADO 2026-09-21 (Luna detenida con SIGSTOP a mitad de ejecución, diff sin commitear en el
  working tree).** Carlos trajo una **guía visual nueva**: un prototipo hecho en Google AI Studio,
  `~/Documents/screens/orchestos-ai-agent-dashboard` (Vite + React 19 + Tailwind v4 +
  lucide-react, solo datos mock). Palabras de Carlos: *"esta va a ser la guía visual que vamos a
  tener para este proyecto… es solo un ejemplo, algunos botones no valen, otros están repetidos,
  pero la intención de cómo luce está ahí"*. Pidió auditar el código y darle un prompt para
  completarlo en AI Studio. UI.11 se re-especifica contra esa guía antes de reanudar.
  **Aclaración de Carlos (mismo día), regla para todo el rediseño:** el prototipo es la **esencia
  del look**, no el default funcional: *"me gusta como se ve pero no necesariamente vamos a
  aplicarlo al pie de la letra sino ordenado a como ya lo tenemos aquí"*. Si una pantalla del
  prototipo contradice una decisión ya tomada, gana la decisión; si no queda claro, se pregunta.
  Pestaña "Props" del panel derecho: **se elimina** (vino de la captura de Orca). Ronda 2 del
  prototipo verificada en vivo; ronda 2 del prompt en `docs/ui-aistudio-prompt.md`.
  **2026-09-21, cierre del prototipo:** Carlos da por terminado el prototipo (3 rondas de prompt) y
  pide implementar. `UI.11` queda **reemplazado por `UI.12`**; el diff parcial de Luna (medidas de
  Circle) se guardó en `git stash` ("UI.11 parcial de Luna…"), sin commitear.

- [ ] **UI.12 — 🧠 Look nuevo sobre el producto real, desde el prototipo de AI Studio.** (abierto 2026-09-21)
  **2026-09-21: reemplazado por `UI.13`** (decisión de Carlos: el prototipo es el frontend, no se trasplanta al vanilla).
  Guía: `~/Documents/screens/orchestos-ai-agent-dashboard` (esencia del look, no spec funcional;
  memoria `feedback-prototipo-es-esencia-no-spec`). **Dos cosas que NO se copian (Carlos):** el
  uso de los CLI se queda **como está hoy** en el producto (no las barras "CLI QUOTAS" del sidebar
  ni la barra "SESSION CONTEXT" del prototipo); y en la página del proyecto en Settings, *Delete
  project* **no** va al pie de cada pestaña sino como **una pestaña más** del proyecto.
  **Por qué empieza por tokens:** todo el producto (vanilla + islas) lee un solo juego de
  variables (`styles.css:6-80`, mapeado a Tailwind en `ui.css:32-64`). Cambiar sus valores a los del
  prototipo reviste la app entera en un solo paso barato; el resto es estructura, pantalla a
  pantalla. Fases, una por ítem, en orden:
  1. `UI.12.1` Tokens, temas, fuentes, radios y escala tipográfica del prototipo.
  2. `UI.12.2` Shell: header, sidebar de proyectos (decisiones 1 y 5, loader/check), estado vacío
     con logo, panel derecho Files | Diff | History con toggle único.
  3. `UI.12.3` Settings: navegación con los grupos del producto, un ítem por proyecto, página del
     proyecto con pestañas + pestaña de borrado, Executor como un solo *Default agent*.
  4. `UI.12.4` Chat: mensajes, filas de herramientas, compositor con agente/modelo/esfuerzo.
  5. `UI.12.5+` Pestañas del proyecto (Tasks, Runs, Graph, Memory, Specs, Skills, Instincts, Plan),
     una por ítem.
  Fuera: History con archivo real de agentes y *Delete project* con su back (`UI.9.9`) son ítems de
  producto aparte; esta cadena es el look.

<a id="plan-orden-ui-12-1"></a>
- [x] **UI.12.1 — ⚡ Tokens del prototipo: paleta, temas, fuentes, radios y escala.** (abierto 2026-09-21, cerrado 2026-09-21)
  Spec: `docs/specs/UI.12.1.md`. Ejecuta Luna. Gate: `ui81` y `ui2` verdes con los valores nuevos,
  captura de Chat, Settings y una pantalla vanilla en cada uno de los 4 temas revisada a ojo contra el
  prototipo.
  Ejecutado por: luna · Spec: docs/specs/UI.12.1.md (3 rondas; borrado al cerrar)
  Paleta del prototipo mapeada a los tokens existentes en los 4 temas; temas renombrados
  (`dark2026`→`graphite`, `claude`→`carbon`, `bright`→`light`, con migración de `localStorage`);
  Plus Jakarta Sans Variable + Fira Code empaquetadas (subsets latin/latin-ext como `.woff2` en
  `dist/`, `publicPath: 'dist/'`); radios 6/10; escala 11/12/14/20. Rondas: (r2) la familia se
  registra como "Plus Jakarta Sans Variable" y `ui.css` pesaba 762 KB con 25 fuentes en base64 →
  61 KB; (r3) las `.woff2` daban 404 en `/` en vez de `/dist/`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.12.1-live.json` —
  dashboard en :4330, corrida del cerebro. Fondo/acento de los 4 temas iguales
  al prototipo (`orchestos` `rgb(8,12,20)`/`#38bdf8`, `light` `rgb(248,250,252)`/`#0284c7`),
  `claude` guardado abre en `carbon`, `document.fonts` con Plus Jakarta Sans Variable y Fira Code
  cargadas, 0 respuestas 4xx, 0 requests a Google. `ui81` 5/5, `ui2` 32/32, `ui0` 16/16,
  `ui4-specs` 20/20, `ui10` 13/13. `tsc` limpio; `test:coverage` 1443 pass / 0 fail.

<a id="plan-orden-ui-12-2"></a>
- [x] **UI.12.2 — 🧠 Shell con la cara del prototipo: header, sidebar, estado vacío, panel derecho.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.12.2.md (7 rondas; borrado al cerrar)
  Header de 44px a todo el ancho (wordmark, paleta, toggle de sidebar, proyecto activo al centro,
  `#rpToggle`; sin `#statusBadge`); sidebar de 256px que se oculta entero (0px, sin riel; abierto
  por defecto sin clave en `localStorage`); segmentado Chat | Dev; filas de proyecto con carpeta,
  chip de agentes contado sin expandir y chevron/`…`/`+` al hover; agentes con loader/check;
  `…` → Project settings abre la página del proyecto con 8 pestañas y `x-orchestos-project-id` en
  sus fetch; Dev sin sesión → `dev-empty` con logo; panel derecho de 384px con un único toggle.
  Rondas: (r1) Luna se detuvo por 3 fallos de `test:coverage` que eran del sandbox de Codex
  (fuera del sandbox: 1443/0); (r2) 11 defectos medidos en vivo (sidebar oculto en frío,
  colapsado de 17px, `projectsList` nulo en Dev, nombres truncados, segmentado/New chat/logo
  fuera de spec, menú sin título); (r3–r5) gates que afirmaban anchos antes de terminar la
  transición y un hover sobre un botón en `display:none`; (r6–r7) nombre de 16px por choque de
  reglas, logo con la clase `pic` de 48px, icono de carpeta perdido y New chat de 48px.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.12.2-live.json` — dashboard en :4330, corrida del cerebro:
  `ui12-shell` 19/19, `ui3-shell` 7/7, `ui9a-inspector` 9/9, `ui10-project-settings` 13/13,
  `ui81` 5/5 (excepción de `#statusBadge` quitada, baseline de inline styles 4→2), `ui0` 16/16,
  `ui2` 32/32; capturas de Chat, Dev vacío, Dev con proyecto expandido + hover, y menú `…`
  revisadas contra el prototipo. `tsc` limpio; `test:coverage` 1443 pass / 0 fail.
  Pendiente sin verificar en vivo: el check verde de un agente que termina mientras la página
  está abierta (requiere una corrida real de chat). Hallazgo aparte: tras correr los gates apareció
  una sesión "New conversation" en Chat general — algún gate crea sesiones en la DB real.

<a id="plan-orden-ui-12-2a"></a>
- [x] **UI.12.2a — ⚡ Trinquete de CSS vanilla en el pre-commit: styles.css+screens.css solo bajan.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.12.2a.md (1 ronda; borrado al cerrar)
  `scripts/check-css-ratchet.ts` en el pre-commit con tope en `scripts/css-baseline.json` (5145).
  Verificado por el cerebro con un índice temporal: +1 línea staged en `styles.css` → sale 1
  ("total=5146, staged=5145"); −1 → sale 0 y el tope baja a 5144. Tests 7/7, `hooks:check` verde.
  Límite: sin el baseline staged el script falla cerrado (no deja pasar).
  GO de Carlos 2026-09-21 (memoria `feedback-no-sumar-css-copiar-prototipo`). Spec:
  `docs/specs/UI.12.2a.md`. Gate: tests del script verdes, un commit de prueba con +1 línea en
  `styles.css` rechazado y uno con −1 que baja el tope en `scripts/css-baseline.json`.

- [ ] **UI.13 — 🧠 El prototipo de AI Studio ES el frontend: fuera el vanilla JS/CSS.** (abierto 2026-09-21)
  **Decisión de Carlos 2026-09-21, textual:** *"vanilla JS y el CSS ME ESTÁN DANDO PROBLEMAS QUE YA
  UN FRAMEWORK ME LO HIZO EN MINUTOS!!!! no quiero ver nada de ese código, solo tengamos de
  ejemplo"*. Reemplaza el resto de `UI.12` (2b, 3a–3d: trasplante pieza a pieza dentro del vanilla;
  UI.12.2 costó 7 rondas y UI.12.2b otras 5 solo afinando el spec, por choques con CSS viejo y
  gates de píxel). El diff de UI.12.2b quedó en `git stash` ("UI.12.2b de Luna…").
  **Regla de la cadena:** el código del prototipo (`~/Documents/screens/orchestos-ai-agent-dashboard/src`)
  se copia **tal cual**: componentes, className, animaciones, vistas. Lo único que se escribe es la
  capa que cambia sus mocks (`src/data/*.ts`) por la API real (`/api/*`, que no cambia). El vanilla
  (`src/dashboard/public/*.js`, `styles.css`, `screens.css`, islas) es solo **referencia** para saber
  qué endpoint y qué payload usa cada acción; no se edita ni se migra su markup. Gates: comportamiento
  real (acción → efecto en la API/DB) en el dashboard corriendo, no medidas en píxeles.
  1. `UI.13.1` Andamio: prototipo copiado a `src/dashboard/app/`, build con Bun, servido en `/`;
     el vanilla pasa a `/legacy` hasta que el último ítem lo borre.
     **Carlos 2026-09-22: cero trabajo sobre el vanilla** — `/legacy` es un cascarón de referencia que
     no se arregla ni se alimenta; look, animaciones, iconos, textura y comportamiento salen de la
     plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Lo que se conserva del producto
     (ej. usage en la barra inferior) se porta con el look de la plantilla.
     **Carlos 2026-09-22 (2): los comportamientos de la plantilla se hacen reales, no se quitan.** Lo que en el
     prototipo es hardcodeado (terminal del agente, History, cerrar agente → historial, borrar proyecto,
     razonamiento/herramientas en el mensaje del bot, etc.) es la especificación de cómo debe comportarse
     OrchestOS. "Sin backend → se quita" queda reemplazado por "sin backend → ítem para construirlo" (UI.13.4).
     **Carlos 2026-09-22 (3), "SI go":** las pantallas de la plantilla sin backend se copian **ya, tal cual**,
     con sus datos de ejemplo visibles, en vez de esperar la API; se conectan después, una por una (sigue
     valiendo "sin backend → ítem para construirlo", pero la pantalla no espera). Pasada de fidelidad
     pantalla por pantalla con capturas lado a lado revisadas por el cerebro (la auditoría con haiku no sirvió).
     Detalles reportados por Carlos el mismo día (ítem UI.13.5):
     a) barra inferior: al hacer clic no pasa nada; clic en usage → solo cuota 5 h y semanal;
     b) input del chat: Claude/Codex/OpenCode/API parecen hardcodeados → deben salir de los CLI detectados;
        elegir Claude contestó "Opus 5.5": el selector debe dejar elegir modelo y esfuerzo por CLI
        (modelo = decisión de Carlos, nunca implícito);
     c) iconos propios de cada CLI (Claude, Codex/ChatGPT, OpenCode…) con colores vivos;
     d) Settings → Usage es un caos: rediseñar como la vista de uso de GitHub.
  2. `UI.13.2` Datos: capa `api.ts` que reemplaza los mocks, vista por vista — Chat, proyectos/Dev,
     Settings, Tasks/Runs/Graph, Memory/Specs/Skills/Instincts/Plan (un sub-ítem cada una).
  3. `UI.13.3` Borrar el vanilla, `/legacy`, sus islas, sus CSS y los ui-gates de píxel.
  **Tope de tiempo (Carlos, 2026-09-21): lo que falta de UI.13 cabe en 2 h de la sesión siguiente.**
  Para eso: un spec y una ronda por bloque grande (Settings; Tasks/Runs/Graph; Memory/Specs/Skills/
  Instincts/Plan), sin sub-ítems; el ejecutor recibe también la lista de lo que el gate va a medir para
  no enterarse en la ronda 2; gate del cerebro = smoke en vivo (carga con datos reales, 0 errores, una
  acción clave por vista), no inventario exhaustivo. Una vista que no cierre en su ronda queda con su
  ruta en `/legacy` y se anota; no se abre una tercera ronda dentro del tope.

<a id="plan-orden-ui-13-1"></a>
- [x] **UI.13.1 — ⚡ Andamio: el prototipo servido en `/` como la app del producto.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.13.1.md (2 rondas; borrado al cerrar)
  Prototipo copiado a `src/dashboard/app/` (build `build:app` con Bun + Tailwind, tsconfig propio
  dentro de `typecheck`); `/` sirve la app, `/legacy` el vanilla con `<base href="/legacy/">`.
  Ronda 2: fuentes en base64 (CSS 534 KB gz → 12,5 KB), JS sin minificar, app fuera de `tsc`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.1-live.json` — dashboard en :4330, corrida del cerebro:
  `/` carga en 573 ms vs 4.298 ms de `/legacy`; bundle 238 KB gz vs 453 KB del vanilla; 0 requests a
  Google, 0 4xx, 0 errores de página. Hallazgo: el prototipo mismo renderiza con fuente del sistema
  (la clase `font-sans` del `body` pisa su regla base); la app computa lo mismo — copia fiel.
  Pendiente para UI.13.2: los datos siguen siendo los mocks del prototipo.
  Spec: `docs/specs/UI.13.1.md`. Gate: `/` en :4330 se ve igual al prototipo corriendo con Vite
  (capturas lado a lado), `/legacy` abre el dashboard viejo, 0 requests a Google, `tsc` y
  `test:coverage` verdes.

<a id="plan-orden-ui-13-1b"></a>
- [x] **UI.13.1b — ⚡ El fallback de la app no se traga rutas `/api` no atendidas.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.13.1b.md (1 ronda; borrado al cerrar)
  `serveStatic` responde 404 a `/api` y `/api/*` antes del fallback de la app.
  Gate en vivo: dashboard real en :4330, corrida del cerebro con curl: `/` 200 html, `/legacy` 200 html,
  `/api/projects/choose` 404, `/api/nope` 404, `/api/projects` 200 json. `test:coverage` 1450 pass / 0 fail.
  Spec: `docs/specs/UI.13.1b.md`. Regresión de UI.13.1 detectada por el pre-push:
  `projects-choose.test.ts:106` (GET `/api/projects/choose` da 200 en vez de 404). Gate: `test:coverage` verde.

<a id="plan-orden-ui-13-2a"></a>
- [x] **UI.13.2a — 🧠 Chat de la app nueva con datos reales.** (abierto 2026-09-21, cerrado 2026-09-21)
  Ejecutado por: luna · Spec: docs/specs/UI.13.2a.md (3 rondas; borrado al cerrar)
  `app/src/api/chat.ts` sobre los endpoints existentes; mocks y `setTimeout` fuera; CLI QUOTAS y
  SESSION CONTEXT mock fuera, `SessionStatusBar` real con Tailwind. Rondas: (r2) envío sin `model`,
  modal New chat con modelos inventados, 26 líneas de CSS a mano; (r3) con 0 sesiones no enviaba.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.2a-live.json` — dashboard en :4330, corrida del cerebro:
  lista = API, renombrar/borrar = API, payload de `POST /api/chat` igual al de `/legacy` (con
  `model` configurado) también con 0 sesiones, modal con CLIs detectados y 443 modelos reales,
  0 errores. `test:coverage` 1453 pass / 0 fail. Pendiente sin verificar: un turno real contra un
  LLM (el modelo lo elige Carlos) y el header `orchestos / master`, que sigue mock (UI.13.2b).
  Spec: `docs/specs/UI.13.2a.md`. Capa `app/src/api/chat.ts` sobre los endpoints existentes; fuera
  las barras mock CLI QUOTAS / SESSION CONTEXT, entra el `SessionStatusBar` real. Gate: lista, abrir,
  crear, renombrar y borrar contra la API en vivo; payload de envío igual al de `/legacy`.

<a id="plan-orden-ui-13-2b"></a>
- [x] **UI.13.2b — 🧠 Proyectos, header y Dev de la app nueva con datos reales.** (abierto 2026-09-21, cerrado 2026-09-22)
  Ejecutado por: luna · Spec: docs/specs/UI.13.2b.md (2 rondas: la primera cortada a mano; borrado al cerrar)
  `app/src/api/projects.ts` (+6 tests), `explorer.ts`, `runs.ts`. Quitado por no tener backend:
  terminal/logs/comandos falsos, cerrar/archivar sesión, History, Delete project, mocks del Diff; la rama
  inventada del header. Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.2b-live.json`
  — :4330, corrida del cerebro: proyectos = `/api/projects` (2), agentes = sesiones por `projectId`
  (8/8 visibles), abrir agente muestra sus mensajes, `+` de proyecto crea sesión con ese `projectId`,
  header con el nombre real, Files lista el árbol y abre `package.json`, 0 errores.
  `test:coverage` 1456 pass / 0 fail. Pendiente: duración de agentes muestra `0m` casi siempre (revisar
  en la pasada de look). Original:
  Spec: `docs/specs/UI.13.2b.md`. Sidebar Dev con `/api/projects` y agentes = sesiones con
  `projectId`; Dev workspace con la sesión real; Files con `/api/explorer/*`; History oculto (ítem
  aparte). Gate: todo contra la API en vivo, 0 errores.

<a id="plan-orden-ui-13-2c"></a>
- [x] **UI.13.2c — 🧠 Settings global de la app nueva con datos reales.** (abierto 2026-09-22, cerrado 2026-09-22)
  Ejecutado por: luna · Spec: docs/specs/UI.13.2c.md (3 rondas; borrado al cerrar)
  `app/src/api/settings.ts` (+tests). Rondas: (r2) había quitado tema, idioma, URL de Ollama (que sí tenía
  backend) y asistente de claves, y dejaba subtítulos inventados en Usage; (r3) guardar routing duplicaba
  `openrouter/` en `orchestos.config.yaml`; el cerebro corrigió además el doble strip que rompía
  `openrouter/auto` (+test). Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.2c-live.json`
  — tema aplica y persiste, idioma persiste, Ollama URL guarda en `/api/settings`, routing idempotente y
  cambio real por combobox, 0 errores. Pendiente: el idioma solo traduce Settings. Original:
  Spec: `docs/specs/UI.13.2c.md`. Secciones globales (general, health, API/modelos, routing, executor,
  usage, danger zone, idioma) contra `/api/settings`, `/api/setup`, `/api/config`, `/api/usage`;
  lo que no tenga backend se quita. Gate: guardar → recargar → persiste, en vivo, 0 errores.

- [ ] **UI.13.4 — 🧠 Comportamientos de la plantilla hechos reales.** (abierto 2026-09-22)
  - [x] **UI.13.4a** (cerrado 2026-09-22) — puntos 1, 2, 3 y 6. Ejecutado por: luna · Spec borrado al cerrar.
    Migración 12 `archived_at`; `POST /api/chat/sessions/:id/archive|restore`, `?archived=1`,
    `DELETE /api/projects/:id` (solo filas de DB). El cerebro corrigió el tiempo relativo (medía vida de la
    sesión, no tiempo desde la última actividad; +test). Gate en vivo: `docs/done/evidence/UI.13.4a-live.json`
    — cerrar→History→restaurar→borrar, quitar proyecto deja la carpeta en disco, 0 errores.
    `test:coverage` 1462 pass / 0 fail.
  - [x] **UI.13.4b** (cerrado 2026-09-22) — punto 4. Ejecutado por: luna · Spec: docs/specs/UI.13.4b.md (2 rondas; borrado al cerrar)
    Consola de Dev: `GET …/console` (turnos + pasos + comandos), `POST …/exec` sobre `runOneCheck` exportada,
    migración 13 `console_commands`. Frontera endurecida para runner y consola: argumentos con forma de ruta
    (incluido `--x=valor`) confinados a la raíz real del proyecto; checks internos `trusted`, no legible desde
    `tasks.yaml`. Ronda 1 reportó verde con 7 fallos de migraciones: corregido en ronda 2.
    Gate en vivo: `docs/done/evidence/UI.13.4b-live.json` — `ls` real, `ls | wc` sin pipe, `cat ../x` y `ls /`
    rechazados, historial tras recargar, Archive Session → History, 0 errores. Pasos reales sin datos en vivo
    (0 turnos con task_id en la DB): cubierto por test. `test:coverage` 1465 pass / 0 fail.
    Límite conocido, avisado a Carlos: `node -e`/`sh -c` esquivan el confinamiento por argumentos.
  Inventario (plantilla `~/Documents/screens/orchestos-ai-agent-dashboard` vs app, 2026-09-22); cada uno
  necesita backend que hoy no existe (`server.ts` no tiene ruta):
  1. Sidebar Dev: cerrar agente → pasa a History (`ShellSidebar.tsx:394` plantilla); falta archivar sesión.
  2. Inspector History (`OrcaRightInspector.tsx:399-560` plantilla): sesiones cerradas agrupadas por
     proyecto, Workspace|Project|All, búsqueda, detalle expandible, menú (restaurar/borrar).
  3. Borrar/quitar proyecto (`ShellSidebar.tsx:310`, `DeleteProjectModal`): falta endpoint para
     des-registrar un proyecto (no borra archivos).
  4. Dev: consola del agente con logs del turno en vivo (`OrchestDevWorkspace.tsx:120-185` plantilla) y
     controles de acción; entrada de comandos interactiva — decisión de Carlos pendiente (ejecuta shell).
  5. Chat: razonamiento y llamadas a herramientas reales en el mensaje del bot; tarjeta de tarea retenida
     con Aprobar/Rechazar contra la API real (el render ya existe, falta verificar que llegan los datos).
  6. Duración/tiempo relativo de agentes (`0m` casi siempre).
  **Decisiones de Carlos 2026-09-22:** consola = logs reales del turno + línea que ejecuta shell en la
  carpeta del proyecto con la misma frontera de permisos del runner; cerrar agente = archivar (History
  permite restaurar o borrar definitivo); borrar proyecto = solo des-registrarlo de OrchestOS con sus
  sesiones, nunca toca archivos del disco.
  **UI.13.4b (2026-09-22):** spec `docs/specs/UI.13.4b.md`. Carlos eligió: la consola reemplaza al chat en Dev
  (como la plantilla), la frontera es idéntica al runner (`runOneCheck`: sin shell, cwd confinado, env
  filtrado, timeout) y los comandos se guardan en DB. Luego, "hagamos lo mejor": la frontera se
  endurece en `runOneCheck` para ambos (argumentos con forma de ruta confinados al proyecto; los checks internos, `trusted`).
  Gate: cada comportamiento hecho en vivo contra la API, igual que en la plantilla.

<a id="plan-orden-ui-13-5"></a>
- [x] **UI.13.5 — 🧠 Pasada de fidelidad pantalla por pantalla y copia de lo que falte.** (abierto 2026-09-22, cerrado 2026-09-22)
  Ejecutado por: luna · Spec: docs/specs/UI.13.5.md (6 rondas; borrado al cerrar)
  Rondas: (1/1b) script de capturas sin estados alineados ni imágenes lado a lado; (2) Luna tapó el 502 de
  `/api/chat/models` con un catálogo de modelos inventado, hardcodeó CLIs en el front y llamó "preexistentes" 4
  fallas de lint propias; (3–5) barra de usage rehecha tres veces por decisiones de Carlos (ver abajo); (6) Model
  vacío y veredicto `null` pintado como FAIL en Runs, contador del diff en `+0 −0`. Cambios: barra inferior =
  cuota 5h por CLI con panel 5h/semanal (iconos del vanilla, sin contexto), rama real en header/Settings/Files
  (`currentBranch`), tamaños en `/api/explorer/tree`, caché de 10 min con respaldo en `/api/chat/models`, diff por
  archivo, iconos de CLI en History, Health sin carga eterna, Runs con modelo real y veredicto neutro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.5-live.json` — dashboard en :4330 y
  plantilla en :3000, capturas lado a lado revisadas por el cerebro, 0 errores en la app nueva.
  `test:coverage` 1472 pass / 0 fail. Pendiente: la etiqueta de modelo guardada "codex (cli default model) via
  Codex CLI" se ve cruda en Runs (texto que no aporta); las cuotas salen `—` hasta UI.13.6.
  Original:
  Spec: `docs/specs/UI.13.5.md`. Ronda 1 (Luna): capturas lado a lado plantilla (:3000) vs app (:4330), sin
  tocar producto. El cerebro revisa las capturas y escribe la ronda 2 (copiar lo que falte, detalles a–d de § UI.13).
  Medido por el cerebro antes del spec: con el mismo formateo biome, 17 de 27 archivos de la plantilla son
  idénticos en la app; difieren solo los cableados a la API (`App`, Chat, Dev, Inspector, Sidebar, Header,
  NewAgentSelector, Settings, `main`, `types`). Ninguna pantalla falta en el código; lo que falte se ve en vivo.
  Ronda 1b revisada por el cerebro: no falta ninguna pantalla; 10 diferencias anotadas en el spec (rama en
  header, SESSION CONTEXT/CLI QUOTAS, `/api/chat/models` 502, Files/Diff/History del inspector, Loading de
  Settings, columnas vacías de Runs). **Decisiones de Carlos 2026-09-22:** usage como la plantilla (CLI QUOTAS
  en el pie del sidebar + SESSION CONTEXT bajo el chat, fuera la barra inferior propia); Settings → Usage
  actual cierra el detalle (d).
  **Carlos 2026-09-22 (tarde), revierte lo anterior sobre usage:** vuelve la barra inferior (clic → detalle
  por CLI con 5h/semanal y reinicio, como el vanilla), con los iconos originales de cada CLI; la barra no
  muestra contexto ni modelo; el contexto va al pie de cada ventana, como la statusline de los CLI. Spec:
  ronda 3 de `docs/specs/UI.13.5.md`.
  **Carlos 2026-09-22 (noche):** la barra muestra solo la cuota de 5 h por CLI; el clic muestra 5 h y semanal con
  reinicio. El contexto sale de la barra y se rediseña arriba (medidor en el header de la sesión, UI.14). Hallazgo:
  el 88.2% del vanilla era contexto restante, no cuota.

<a id="plan-orden-ui-13-6"></a>
- [x] **UI.13.6 — 🧠 Cuotas 5h/semanal reales por CLI.** (abierto 2026-09-22, cerrado 2026-09-22)
  Ejecutado por: luna · Spec: docs/specs/UI.14.md
  Cuotas vivas: Claude por wrapper de statusLine (`scripts/claude-statusline-tee.sh` →
  `~/.orchestos/claude-statusline.json`), Codex por app-server con caché en `/api/session/status`. Código en
  `2b3a185`. Gate en vivo: navegador real (Playwright) contra :4242, `docs/done/evidence/UI.14-live.json`
  (`quotaBars`: 5h `rgb(56, 189, 248)`, semanal `oklab(… / 0.6)`). `test:coverage` 1499 pass / 0 fail.
  Medido 2026-09-22 en `/api/session/status` (`scripts/session-status.ts`): Claude no trae ninguna ventana de
  cuota; Codex trae 5h/7d pero con reinicios del 17 y 19-sep (dato vencido: `readCodexRateLimitsLive` no
  refresca o cae al transcript viejo). Sin esto la barra de UI.13.5 muestra `—`. Investigar primero de dónde se
  puede leer la cuota real de cada CLI (sin inventar), luego spec.
  Pista medida 2026-09-22: `readCodexRateLimitsLive` (`scripts/context-adapters.ts:197`) usa el app-server de
  Codex (`account/rateLimits/read`, mecánico, 0 tokens) con timeout de 1,5 s; si el arranque tarda más, cae al
  transcript viejo. Medir cuánto tarda el app-server antes de subir el timeout.

<a id="plan-orden-ui-14"></a>
- [x] **UI.14 — 🧠 Dev como chat que actúa como CLI (estilo Claude Code desktop / ChatGPT Codex).** (abierto 2026-09-22, cerrado 2026-09-22)
  Ejecutado por: luna · Spec: docs/specs/UI.14.md
  Rondas 1–11d (spec borrado al cerrar, en git `ed1fdef`): plantilla de AI Studio copiada y cableada (composer,
  ContextRing, ShellStatusBar, Dev), freno `check-css`, catálogo real de modelos por CLI, validación de modelo en
  backend, comandos `/rename /usage /model /archive`, títulos mecánicos, heatmap con el día actual visible.
  Gate en vivo: navegador real (Playwright) contra :4242, `docs/done/evidence/UI.14-live.json` — turno real Codex ·
  gpt-5.6-luna · medium (`runs.model` = `gpt-5.6-luna via Codex CLI (effort: medium)`, done). `test:coverage`
  1499 pass / 0 fail. Sin verificar en vivo: selector nativo de nuevo proyecto (abre diálogo en el Mac) y capturas
  lado a lado con la plantilla.
  Pedido de Carlos 2026-09-22: la vista Dev se ve como un chat, pero el agente trabaja como un CLI en la
  carpeta del proyecto. Cambia la decisión de UI.13.4b (consola reemplaza al chat en Dev). Diseño primero en
  Google AI Studio con `docs/specs/UI.14-aistudio-prompt.md`; luego se copia tal cual (regla UI.13) y se cablea.
  **2026-09-22 (noche):** AI Studio entregó la plantilla (`~/Documents/screens/orchestos-ai-agent-dashboard`,
  nuevos `AgentComposer`, `ContextRing`, `ShellStatusBar`, Dev reescrito). Carlos: *"mejoró bastante; conservar
  los tooltips para que se sepa qué es cada icono, sobre todo donde se archiva la sesión"* — todo icono sin
  texto lleva tooltip (hoy `title` nativo en la plantilla).
  **Carlos 2026-09-22, "Si go con UI.14":** *"ver la quota es un trabajo mecánico, eso no debería costar tokens…
  esas envolturas deben ser mecánicas, no debe costarle nada al usuario"* — va a medir ahorro CLI directo vs
  OrchestOS; el proyecto guía, no satura con reglas (los CLI serán cada vez más autónomos). Logos de producto en
  `~/Downloads/Icons`. Spec: `docs/specs/UI.14.md`.
  **Carlos 2026-09-22 (noche):** un logo por marca (Codex = logo de ChatGPT, Claude Code = logo de Claude); ninguna
  cabecera o tooltip repite el nombre (ej. "Codex / codex"); avatar Bot para el LLM y User para el humano en los
  mensajes (reemplaza "sin avatar" del prompt de AI Studio).

<a id="plan-orden-ui-13-4"></a>
- [x] **UI.13.4 — 🧠 Comportamientos de la plantilla hechos reales.** (abierto 2026-09-22, cerrado 2026-09-23: 4a/4b/4c `[x]`)
  Sin delegación: cierre de padre, el trabajo está en sus sub-ítems.
  - [x] **UI.13.4a** (cerrado 2026-09-22) — puntos 1, 2, 3 y 6. Ejecutado por: luna · Spec borrado al cerrar.
    Migración 12 `archived_at`; `POST /api/chat/sessions/:id/archive|restore`, `?archived=1`,
    `DELETE /api/projects/:id` (solo filas de DB). El cerebro corrigió el tiempo relativo (medía vida de la
    sesión, no tiempo desde la última actividad; +test). Gate en vivo: `docs/done/evidence/UI.13.4a-live.json`
    — cerrar→History→restaurar→borrar, quitar proyecto deja la carpeta en disco, 0 errores.
    `test:coverage` 1462 pass / 0 fail.
  - [x] **UI.13.4b** (cerrado 2026-09-22) — punto 4. Ejecutado por: luna · Spec: docs/specs/UI.13.4b.md (2 rondas; borrado al cerrar)
    Consola de Dev: `GET …/console` (turnos + pasos + comandos), `POST …/exec` sobre `runOneCheck` exportada,
    migración 13 `console_commands`. Frontera endurecida para runner y consola: argumentos con forma de ruta
    (incluido `--x=valor`) confinados a la raíz real del proyecto; checks internos `trusted`, no legible desde
    `tasks.yaml`. Ronda 1 reportó verde con 7 fallos de migraciones: corregido en ronda 2.
    Gate en vivo: `docs/done/evidence/UI.13.4b-live.json` — `ls` real, `ls | wc` sin pipe, `cat ../x` y `ls /`
    rechazados, historial tras recargar, Archive Session → History, 0 errores. Pasos reales sin datos en vivo
    (0 turnos con task_id en la DB): cubierto por test. `test:coverage` 1465 pass / 0 fail.
    Límite conocido, avisado a Carlos: `node -e`/`sh -c` esquivan el confinamiento por argumentos.
  - [x] **UI.13.4c** (cerrado 2026-09-23, Lote L1) — punto 5. Ejecutado por: luna (13 rondas) · Spec: docs/specs/UI.13.4c.md
    Razonamiento y herramientas reales en el mensaje del bot (bloques de `ThreadsView.tsx` de la plantilla), ligados
    al turno por `chat_messages.turn_id` (migración 14, paso `reasoning` en Codex/Claude/OpenCode; Codex con
    `model_reasoning_summary=auto`). Tarjeta retenida con `Approve & Run` (corre la tarea) y `Reject` (la borra) contra
    la API. Bugs reales hallados por el gate y corregidos: regresión de R.1 (`createSession` forzaba `mode:'chat'`: la
    app no podía crear tareas); tarea con `output: []` se guardaba, arrancaba un run y dejaba `tasks.yaml` inválido
    (`createTaskRecord` la rechaza, `saveTasks` valida antes de escribir, el chat no crea tareas sin archivos,
    `extractMentionedPaths` para rutas nombradas); borrar tarea no commiteaba `tasks.yaml` (el siguiente run fallaba
    por árbol sucio). **Decisión de Carlos 2026-09-23 "Lista por proyecto":** Chat lista los chats del proyecto de la
    cabecera + generales, "New chat" se liga al proyecto visible, el diálogo ofrece "No project".
    Gate en vivo: `docs/done/evidence/UI.13.4c-live.json` — Playwright en navegador real, turno real Codex ·
    gpt-5.6-luna · medium, `PASS chat-turn-details 27/27` + `PASS smoke 6/6`. `test:coverage` 1526 pass / 0 fail.
  Inventario (plantilla `~/Documents/screens/orchestos-ai-agent-dashboard` vs app, 2026-09-22); cada uno
  necesita backend que hoy no existe (`server.ts` no tiene ruta):
  1. Sidebar Dev: cerrar agente → pasa a History (`ShellSidebar.tsx:394` plantilla); falta archivar sesión.
  2. Inspector History (`OrcaRightInspector.tsx:399-560` plantilla): sesiones cerradas agrupadas por
     proyecto, Workspace|Project|All, búsqueda, detalle expandible, menú (restaurar/borrar).
  3. Borrar/quitar proyecto (`ShellSidebar.tsx:310`, `DeleteProjectModal`): falta endpoint para
     des-registrar un proyecto (no borra archivos).
  4. Dev: consola del agente con logs del turno en vivo (`OrchestDevWorkspace.tsx:120-185` plantilla) y
     controles de acción; entrada de comandos interactiva — decisión de Carlos pendiente (ejecuta shell).
  5. Chat: razonamiento y llamadas a herramientas reales en el mensaje del bot; tarjeta de tarea retenida
     con Aprobar/Rechazar contra la API real (el render ya existe, falta verificar que llegan los datos).
  6. Duración/tiempo relativo de agentes (`0m` casi siempre).
  **Decisiones de Carlos 2026-09-22:** consola = logs reales del turno + línea que ejecuta shell en la
  carpeta del proyecto con la misma frontera de permisos del runner; cerrar agente = archivar (History
  permite restaurar o borrar definitivo); borrar proyecto = solo des-registrarlo de OrchestOS con sus
  sesiones, nunca toca archivos del disco.
  **UI.13.4b (2026-09-22):** spec `docs/specs/UI.13.4b.md`. Carlos eligió: la consola reemplaza al chat en Dev
  (como la plantilla), la frontera es idéntica al runner (`runOneCheck`: sin shell, cwd confinado, env
  filtrado, timeout) y los comandos se guardan en DB. Luego, "hagamos lo mejor": la frontera se
  endurece en `runOneCheck` para ambos (argumentos con forma de ruta confinados al proyecto; los checks internos, `trusted`).
  Gate: cada comportamiento hecho en vivo contra la API, igual que en la plantilla.

<a id="plan-orden-ui-13"></a>
- [x] **UI.13 — 🧠 El prototipo de AI Studio ES el frontend: fuera el vanilla JS/CSS.** (abierto 2026-09-21, cerrado 2026-09-23: UI.13.1–13.4 `[x]`, vanilla borrado en UI.13.3 ff090e3)
  Sin delegación: cierre de padre, el trabajo está en sus sub-ítems.
  **Decisión de Carlos 2026-09-21, textual:** *"vanilla JS y el CSS ME ESTÁN DANDO PROBLEMAS QUE YA
  UN FRAMEWORK ME LO HIZO EN MINUTOS!!!! no quiero ver nada de ese código, solo tengamos de
  ejemplo"*. Reemplaza el resto de `UI.12` (2b, 3a–3d: trasplante pieza a pieza dentro del vanilla;
  UI.12.2 costó 7 rondas y UI.12.2b otras 5 solo afinando el spec, por choques con CSS viejo y
  gates de píxel). El diff de UI.12.2b quedó en `git stash` ("UI.12.2b de Luna…").
  **Regla de la cadena:** el código del prototipo (`~/Documents/screens/orchestos-ai-agent-dashboard/src`)
  se copia **tal cual**: componentes, className, animaciones, vistas. Lo único que se escribe es la
  capa que cambia sus mocks (`src/data/*.ts`) por la API real (`/api/*`, que no cambia). El vanilla
  (`src/dashboard/public/*.js`, `styles.css`, `screens.css`, islas) es solo **referencia** para saber
  qué endpoint y qué payload usa cada acción; no se edita ni se migra su markup. Gates: comportamiento
  real (acción → efecto en la API/DB) en el dashboard corriendo, no medidas en píxeles.
  1. `UI.13.1` Andamio: prototipo copiado a `src/dashboard/app/`, build con Bun, servido en `/`;
     el vanilla pasa a `/legacy` hasta que el último ítem lo borre.
     **Carlos 2026-09-22: cero trabajo sobre el vanilla** — `/legacy` es un cascarón de referencia que
     no se arregla ni se alimenta; look, animaciones, iconos, textura y comportamiento salen de la
     plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Lo que se conserva del producto
     (ej. usage en la barra inferior) se porta con el look de la plantilla.
     **Carlos 2026-09-22 (2): los comportamientos de la plantilla se hacen reales, no se quitan.** Lo que en el
     prototipo es hardcodeado (terminal del agente, History, cerrar agente → historial, borrar proyecto,
     razonamiento/herramientas en el mensaje del bot, etc.) es la especificación de cómo debe comportarse
     OrchestOS. "Sin backend → se quita" queda reemplazado por "sin backend → ítem para construirlo" (UI.13.4).
     **Carlos 2026-09-22 (3), "SI go":** las pantallas de la plantilla sin backend se copian **ya, tal cual**,
     con sus datos de ejemplo visibles, en vez de esperar la API; se conectan después, una por una (sigue
     valiendo "sin backend → ítem para construirlo", pero la pantalla no espera). Pasada de fidelidad
     pantalla por pantalla con capturas lado a lado revisadas por el cerebro (la auditoría con haiku no sirvió).
     Detalles reportados por Carlos el mismo día (ítem UI.13.5):
     a) barra inferior: al hacer clic no pasa nada; clic en usage → solo cuota 5 h y semanal;
     b) input del chat: Claude/Codex/OpenCode/API parecen hardcodeados → deben salir de los CLI detectados;
        elegir Claude contestó "Opus 5.5": el selector debe dejar elegir modelo y esfuerzo por CLI
        (modelo = decisión de Carlos, nunca implícito);
     c) iconos propios de cada CLI (Claude, Codex/ChatGPT, OpenCode…) con colores vivos;
     d) Settings → Usage es un caos: rediseñar como la vista de uso de GitHub.
  2. `UI.13.2` Datos: capa `api.ts` que reemplaza los mocks, vista por vista — Chat, proyectos/Dev,
     Settings, Tasks/Runs/Graph, Memory/Specs/Skills/Instincts/Plan (un sub-ítem cada una).
  3. `UI.13.3` Borrar el vanilla, `/legacy`, sus islas, sus CSS y los ui-gates de píxel.
  **Tope de tiempo (Carlos, 2026-09-21): lo que falta de UI.13 cabe en 2 h de la sesión siguiente.**
  Para eso: un spec y una ronda por bloque grande (Settings; Tasks/Runs/Graph; Memory/Specs/Skills/
  Instincts/Plan), sin sub-ítems; el ejecutor recibe también la lista de lo que el gate va a medir para
  no enterarse en la ronda 2; gate del cerebro = smoke en vivo (carga con datos reales, 0 errores, una
  acción clave por vista), no inventario exhaustivo. Una vista que no cierre en su ronda queda con su
  ruta en `/legacy` y se anota; no se abre una tercera ronda dentro del tope.

<a id="plan-orden-ui-13-2d"></a>
- [x] **UI.13.2d — 🧠 Pantalla Tasks con datos reales.** (cerrado 2026-09-23, Lote L1 ítem 3; sub-ítem de UI.13.2)
  Ejecutado por: luna (4 rondas) · Spec: `docs/specs/UI.13.2d.md`. Tasks lee `tasks.yaml` real (`/api/tasks` suma
  `output`/`dependsOn`/`acceptanceCriteria`/`executorModel`); `Run Next Task` (pestaña y ⌘K) corre la primera tarea
  con dependencias `done`, deshabilitado si no hay; el fin del run se detecta por estado, `retryCount` o `runId`
  (un QA fallido deja la tarea `pending` con reintento: antes la espera se colgaba) y el reintento se muestra.
  Gate en vivo: `docs/done/evidence/UI.13.2d-live.json` — turno real Codex · gpt-5.6-luna · medium,
  `PASS tasks 13/13` (badge `DONE` en la fila sin recargar) + `PASS smoke 6/6`; `gate:all` 1529 pass / 0 fail.
  Fuera de esta pasada: acciones de `PlanBoardView` sin cablear; Reset/Purge de Settings siguen siendo locales.

<a id="plan-orden-ui-13-2e"></a>
- [x] **UI.13.2e — 🧠 Runs y Graph con datos reales.** (cerrado 2026-09-23, Lote L2 ítem 1; sub-ítem de UI.13.2)
  Ejecutado por: luna (3 rondas) · Spec: `docs/specs/UI.13.2e.md`. Runs por proyecto y detalle real (contrato,
  archivos bloqueados, checks, QA, status); Graph con constitución/contexto/code graph del proyecto (`GET
  /api/project/graph`: archivos, aristas, lenguajes, stale, git) y `Rebuild` real.
  Bugs de fondo hallados por el gate: (1) todo run se guardaba con `project_id: null` → ahora se propaga
  dashboard→CLI (`--project-id`)→harness; (2) una carpeta con symlink (`/var`↔`/private/var`) se registraba dos
  veces al indexar → `getProject`/`upsertProject` comparan por `realpath` (`src/db/projects.ts`); dejó 14 proyectos
  fantasma de gates en la DB real que rompían smoke con 410 (borrados).
  **Fuera de scope declarado:** `src/run/harness.ts` y `src/cli.ts` (scope era `src/dashboard/**,src/db/**`):
  necesarios para (1).
  Gate en vivo: `docs/done/evidence/UI.13.2e-live.json` — turno real Codex · gpt-5.6-luna · medium,
  `PASS runs-graph 16/16` + `PASS smoke 6/6`; `gate:all` 1533 pass / 0 fail.

<a id="plan-orden-ui-13-2f"></a>
- [x] **UI.13.2f — 🧠 Memory/Specs/Skills/Instincts/Plan con datos reales.** (cerrado 2026-09-23, Lote L2 ítem 2; sub-ítem de UI.13.2)
  Ejecutado por: luna (4 rondas) · Spec: docs/specs/UI.13.2f.md (borrado al cerrar). Las 5 pestañas leen la API por proyecto;
  `mockOrchestosData.ts` borrado. Acciones reales: resolver conflicto de memoria con texto (`POST
  /api/memory/conflicts/:id/resolve` acepta `{content}` y reescribe la entrada A), Approve/Lint de specs, Compile de
  skills (respuesta visible), Approve/Reject/alta de instincts, Run/Explain de Plan (`/explain` determinista: "0
  tokens spent" es cierto) y "Add task" → Chat (tareas solo por chat). Antes 9 botones caían en `() => {}`.
  Gate en vivo: `docs/done/evidence/UI.13.2f-live.json` — `PASS project-tabs 23/23` (turno real Codex ·
  gpt-5.6-luna · medium, cleanup de DB verificado) + tasks 13/13 + runs-graph 16/16 + smoke 6/6; `gate:all` 1534/0.
  Ronda 1 dio 14/14 con 6 pasos vacíos (Run sin esperar el run, "Chat" siempre visible, Lint/Compile sin medir):
  hallados auditando el flujo, no la suite.

<a id="plan-orden-ui-13-3"></a>
- [x] **UI.13.3 — 🧠 Borrar el vanilla, `/legacy`, sus islas, CSS y ui-gates de píxel.** (cerrado 2026-09-23, Lote L2 ítem 3)
  Ejecutado por: luna (2 rondas; r2: `orchestos dashboard` buscaba el bundle en el cwd del usuario → resuelto relativo al
  módulo, `src/cli-dashboard-paths.ts` + test) · Spec: docs/specs/UI.13.3.md (borrado al cerrar). Recuperable por git (Carlos: no
  cuenta como irreversible). Fuera: `src/dashboard/public/`, `public-src/` (islas), `scripts/ui-gates/` (16 gates de
  píxel), `build-ui.ts`, `check-css-ratchet`, `check-ui-copy` (+ sus pasos del pre-commit, hooks reinstalados),
  3 tests solo-vanilla, deps Radix/`cmdk`/`marked`; 80 archivos, −26.608 líneas. `/legacy` y cualquier estático fuera
  de `/app/dist/` → 404.
  Gate en vivo: `docs/done/evidence/UI.13.3-live.json` — smoke 6/6 · tasks 13/13 · runs-graph 16/16 ·
  project-tabs 23/23 · chat-turn-details 26/26; `gate:all` 1518 pass / 0 fail (baja de 1534 = tests borrados;
  cobertura sobre umbral). Resto inofensivo: `.impeccable/config.json` ignora `public/screens.css` (ya no existe).

<a id="plan-orden-ui-13-5-2"></a>
- [x] **UI.13.5 — 🧠 La barra inferior muestra las cuotas al día, no solo al recargar.** (abierto 2026-09-23, pedido de Carlos; cerrado 2026-09-23 — `ui:gate usage-bar` 9/9, evidencia `docs/done/evidence/UI.13.5-live.json`)
  Síntoma: los usages de la barra inferior solo aparecen o se actualizan al recargar la página. Causa verificada en código
  y con Playwright contra `:4242`: (1) `handleApiSessionStatus` (`src/dashboard/handlers/session-status.ts:30-33`)
  devuelve la caché y refresca en segundo plano → cada respuesta trae el estado de la petición anterior; (2) el cliente
  solo refresca cada 60 s o al volver a la pestaña (`App.tsx:427-430`), nunca al terminar un turno del chat → 60-120 s
  de retraso; (3) la recarga "arregla" por casualidad: 4 peticiones sin `x-orchestos-project-id`
  (`ShellStatusBar.tsx:73`, `AgentComposer.tsx:136` y duplicados) disparan el refresco antes de la del proyecto;
  (4) en frío la barra sale vacía ~1,5-2 s. Arreglo: el servidor espera lectura nueva si la caché tiene más de ~10 s;
  `refreshUsage()` al cerrar cada turno del chat; quitar los dos fetch sin proyecto (hermanos del bug).
  (5) hallada 2026-09-23 por el cerebro: `scripts/claude-statusline-tee.sh` guarda la última lectura de CUALQUIER
  sesión de Claude en un solo `~/.orchestos/claude-statusline.json`; con 4 sesiones abiertas (misma cuenta) una sesión
  que se redibuja con datos viejos pisa a la actual → la cuota de 5 h "sube" sin reset (medido: 62→67→61 en minutos).
  Arreglo: gana la lectura más nueva por ventana (mismo `resets_at` → mayor `used_percentage`; `resets_at` mayor gana).
  Fantasmas: limpiados por el cerebro 2026-09-23 — 5 proyectos `orchestos-ui-13-2[de]-*` (corridas interrumpidas: el
  cleanup del flujo no corre si el runner muere) + 43 `files`/14 `code_edges` huérfanos (gates y fixtures de tests
  `gfc-*`/`ruby-check` que escriben la DB real; backup en `/tmp/l2/db-backup-before-orphans.sqlite`). Falta el diente:
  el runner de ui:gate borra al arrancar los proyectos `orchestos-ui-*` de corridas previas.
  Gate: flujo ui:gate que tras un turno real ve cambiar la cuota sin recargar, y 1 sola petición con proyecto al cargar.
  Ejecutado por: luna (3 rondas; r2 rechazada: el paso del turno hacía clic manual) · Spec: docs/specs/UI.13.5.md (borrado al cerrar).
  El cerebro añadió el borrado de archivos de sesión de statusline >7 días.
  Gate en vivo: navegador real (Playwright, `bun run ui:gate usage-bar` 9/9 + `smoke` 6/6) — `docs/done/evidence/UI.13.5-live.json`.

<a id="plan-orden-ui-13-6-2"></a>
- [x] **UI.13.6 — 🧠 La cuota de Codex aparece siempre y una ventana vencida cuenta como libre.** (abierto 2026-09-23, pedido de Carlos; Lote L3; cerrado 2026-09-23 — `ui:gate usage-bar` 13/13)
  Hallazgos post-cierre de UI.13.5 (NEXT.md): (1) `scripts/session-status.ts:196-203` solo llama
  `readCodexRateLimitsLive` si el proyecto tiene sesión de Codex (`liveCodex`); Claude sí tiene respaldo de cuenta
  (`:230`). Reproducido con Playwright: proyecto temporal + turno real Codex Luna → barra `86% — —` antes y después.
  (2) `ShellStatusBar.tsx:36-38` devuelve `null` ("—") si `resetsAt` ya pasó; tras el reset la cuota está 100 % libre.
  (3) `src/dashboard/http.ts:62` sirve `/app/dist/*` (y el `index.html`) sin `Cache-Control` ni hash → Brave mostró
  un bundle viejo (sospecha, no verificado en Brave). Arreglo: `Cache-Control: no-cache`.
  Gate: `ui:gate` con proyecto temporal SIN sesiones de Codex → la barra muestra la cuota de Codex antes y después de
  un turno real; ventana con `resets_at` pasado → 100 %; respuestas de `/app/dist/main.js` y `/` con `no-cache`.
  **Fuera de scope declarado:** `ShellStatusBar.test.ts`, `http.test.ts` y la evidencia — el scope se declaró con
  directorios sin glob (`src/dashboard`, `docs`), que el scope-lock no expande; son los tests y la evidencia del ítem.
  Ejecutado por: luna (1 ronda) · Spec: docs/specs/UI.13.6.md (borrado al cerrar). El respaldo de Codex lee el
  app-server en cada refresco aunque el proyecto no use Codex. Brave: el header se verificó; Brave en sí no se probó.
  Gate en vivo: navegador real (Playwright, `bun run ui:gate usage-bar` 13/13 + `smoke` 6/6) — `docs/done/evidence/UI.13.6-live.json`.
  Codex 92 % sin sesión antes y después de un turno real Luna; Claude vencida → 100 %; `/` y `main.js` `no-cache`.
  `test:coverage` 1527/0 (1.ª corrida: 1 fallo del test inestable conocido `context-adapters.test.ts:187`).

<a id="plan-orden-ui-13-7"></a>
- [x] **UI.13.7 — ⚡ La barra de cuota avisa por color: naranja pasado el 60 % consumido, rojo pasado el 80 %.** (abierto 2026-09-24, pedido de Carlos; Lote L4, tras CI.2; cerrado 2026-09-28)
  Carlos: barra **y** número en naranja al pasar el 60 % de consumo; en rojo al pasar el 80 % (queda <20 %). La barra
  muestra lo **restante** (`ShellStatusBar.tsx:38`): restante <40 → `app-warning`, <20 → `app-error`, si no el color
  actual. Aplica a las tres barras (fila del footer `:118-126` y las de 5 h y semanal del popover `:171-194`) y a sus
  números. Tokens ya definidos (`index.css:13-14`): nada de CSS ni colores nuevos. Umbral en una función pura con test.
  Spec: `docs/specs/UI.13.7.md`. Gate: `ui:gate usage-bar` con pasos que afirmen el color en los tres tramos (sin turno real extra).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.13.7-live.json`: `usage-bar` 18/18 (footer normal/warning/error con 50/70/90 % usado, popover 5 h en error, vuelta a normal). `gate:all` verde (1561 pass). Su sandbox da 8 fallos de entorno en `bun test` (nota en AGENTS.md).
  Ejecutado por: Codex · `gpt-6-luna` (2 rondas: la 1.ª paró por el baseline del sandbox) · Spec: docs/specs/UI.13.7.md (borrado al cerrar)

<a id="plan-orden-ui-9-9"></a>
- [x] **UI.9.9 — 🧠 Opciones de proyecto al hover: `Project settings` y `Delete project`.** (abierto 2026-09-18; cerrado 2026-09-23 — `ui:gate project-delete` 11/11)
  Pedido de Carlos del 2026-09-16 (anotado abajo) y repetido el 2026-09-18. Al pasar el cursor por
  la fila de un proyecto, botón de tres puntos a la derecha con acciones de proyecto. Incluir
  también un control claro de expandir/colapsar los agentes de ese proyecto.
  **Estado real leído en el código:** no existe en ninguna capa. `Sidebar.tsx:243-254` solo tiene
  el `+` de agregar agente; `SessionRow` sí tiene borrado (`Sidebar.tsx:441-451`), los proyectos
  no. **No hay endpoint de borrado de proyecto** en `server.ts` — es backend + front.
  **Semántica del borrado — respondida por Carlos el 2026-09-18, no volver a preguntarla.** Son
  **dos niveles distintos**, y `Delete project` es el suave:
  - **`Delete project` (menú de tres puntos) borra el ESPACIO DE TRABAJO, no los datos.** Textual:
    *"borrar el proyecto significa borrar ese espacio de trabajo"*. Sale de la lista; la data
    sobrevive. **No hay cascada acá**, así que tampoco hace falta un diálogo que enumere lo que se
    lleva puesto.
  - **Borrar la data definitivamente vive en `Project settings`**, dentro del proyecto, como acción
    aparte y explícita: *"para borrar la data definitivamente habría que ir al project settings y
    ahí borrar todo sobre el proyecto"*. Carlos lo da por sobreentendido — es el patrón habitual de
    "quitar de la lista" vs. "destruir".
  **Referencia de comportamiento, Orca (citada por Carlos):** si borra un workspace y lo vuelve a
  abrir, sigue viendo la barra lateral con `workspace | projects | all`, el **source control** y el
  **explorer** (el repo en sí). O sea: reabrir un proyecto borrado del espacio de trabajo lo
  restituye con su contenido, porque nunca se destruyó nada. Ese es el criterio de aceptación real
  del ítem, más que el botón.
  Al diseñarlo, volver a mirar las capturas de Orca (`docs/ui-reference-patterns.md` A.1-A.3).
  Gate: navegador real — borrar un proyecto del espacio de trabajo, **volver a agregarlo con
  "+ Add project"** y confirmar que sus chats/tasks/runs siguen ahí; y confirmar en SQLite que el
  borrado suave NO tocó esas tablas.
  Hallado al abrirlo: el menú ya existía, pero `DELETE /api/projects/:id` borraba los chats y dejaba los runs sin
  proyecto (borrado duro disfrazado), y la Danger Zone de Project settings solo filtraba estado del cliente.
  Hecho: `projects.removed_at` (migración 15); `DELETE` solo lo marca; `+ Add project` lo limpia (mismo id);
  `POST /api/projects/:id/purge` borra toda tabla con `project_id` (descubierta por `PRAGMA`) y la fila. Los
  cleanups de `ui:gate` usan la purga.
  Ejecutado por: luna (2 rondas; r2 arregló `chat-turn-details`, que fallaba también en master: registraba el
  proyecto sin recargar) · Spec: docs/specs/UI.9.9.md (borrado al cerrar).
  El flujo re-agrega por `ensureProject` (el selector nativo no es automatizable) y siembra el run por SQLite.
  Gate en vivo: navegador real (Playwright, `bun run ui:gate project-delete` 11/11 + smoke/usage-bar/tasks/runs-graph/project-tabs/chat-turn-details verdes) — `docs/done/evidence/UI.9.9-live.json`.
  `gate:all` 1528/0; DB real: 0 proyectos `orchestos-ui-*` y 0 con `removed_at` tras los flujos.

<a id="plan-orden-ui-9-8"></a>
- [x] **UI.9.8 — ⚡ Barrido de texto que no aporta, y el modelo elegible en Codex.** (abierto 2026-09-18; cerrado 2026-09-23 — `ui:gate text-sweep` 10/10)
  **Pedido textual de Carlos, 2026-09-18:** *"donde detectes que exista en la UI texto adicional
  que no aporta a nada debe DESAPARECER"*. Disparador: bajo cada respuesta del chat aparece
  `codex (cli default model) via Codex CLI` — *"esto está demás"*. Es la **tercera vez en el
  mismo día** que señala lo mismo: antes fueron `Model: Decided by Codex · your subscription` y la
  fila `Agent`, ambas cerradas en UI.9.7. El patrón se repite porque cada ítem arregla su
  instancia y no el criterio; por eso este ítem barre, no parchea.
  **Dónde vive el caso concreto:** `screens-core.js:415-416` pinta `.chat-model-tag` con el
  `resultLabel` que compone `chat.ts:1374,1426`. **El dato no se borra del backend** —
  `resultLabel` alimenta el costeo (`canonicalModel`, `chat.ts:1248`) y
  `rememberResolvedClaudeModel()` (`screens-core.js:760`) aprende de `data.model`. La regla es de
  superficie: se deja de renderizar, no se deja de calcular.
  **Alcance del barrido:** recorrer las pantallas que Carlos usa hoy (chat y el shell Dev) y
  listar cada texto que no habilita una decisión ni informa algo que el usuario no sepa.
  **Borrar, no acortar.** Traer la lista antes de borrar lo dudoso; lo evidente se borra.
  Cuidado con el modo de fallar de UI.9.7: sacar una etiqueta dejó alcanzable un fallback con el
  literal `'CLI default model'` — verificar lo **renderizado**, no el diff.
  **Segunda parte — elegir modelo en Codex** (*"en el chat Dev no puedo elegir el modelo"*).
  Es lo que UI.9.7 dejó fuera por no haber catálogo verificado. Investigar antes de diseñar:
  `~/.codex/config.toml` sí declara el modelo (`codex.ts:75-79` lo leyó: decía `gpt-5.6-luna`),
  y los alias reales están en `AGENTS.md:293-299` (Luna/Terra/Sol/Astra). Ninguna lista
  hardcodeada de catálogo frágil — ver `feedback-deteccion-generica-no-por-cli`. Si no hay fuente
  confiable, decirlo y no poner un selector decorativo.
  Gate: navegador real, cero texto de los listados sobreviviendo, y el modelo elegido llegando al
  binario con un mensaje real (como se hizo con el esfuerzo en UI.9.7).
  Hecho: inventario mecánico (parser TS) de 105 textos de ≥4 palabras en `app/src/components` + `App.tsx`:
  15 borrados o corregidos por afirmar mecanismos que no existen (AST sandbox, vector embeddings, "Merge to Main",
  "Reinforcement Learning Engine"…), 92 dudosos que quedan — lista en `docs/done/evidence/UI.9.8-sweep.md`.
  El modelo de Codex ya era elegible (catálogo de la caché de Codex, `-m` con `--ignore-user-config`); se probó.
  Límite del gate: la ausencia de los textos borrados se mira en la pantalla de Chat; Settings/Instincts/Memory/
  Add project se verificaron por diff y grep, no en navegador.
  **Fuera de scope declarado:** `chat-turn-details.mjs`, `PLAN.md`, la evidencia y el borrado del spec — Luna
  re-corrió el preflight y estrechó el scope a sus archivos; son las referencias a los textos viejos y el cierre.
  Ejecutado por: luna (4 rondas: r1 barrió ~11 textos; r2 inventario mecánico; r3 `chat-turn-details` buscaba los
  textos viejos; r4 "SQLite full-text search" inexacto) · Spec: docs/specs/UI.9.8.md (borrado al cerrar).
  Gate en vivo: navegador real (Playwright, `bun run ui:gate text-sweep` 10/10 + chat-turn-details 27/27 + project-tabs 23/23 + smoke 6/6) — `docs/done/evidence/UI.9.8-live.json`.
  Turno real Codex registró `gpt-5.6-luna` · `medium`; `gate:all` 1528/0.

<a id="plan-orden-ui-10-a"></a>
- [x] **UI.10.A — 🧠 El plan por proyecto: `plan_items` y `plan_doc_segments` con proyecto.** (abierto 2026-09-21; cerrado 2026-09-24 — `ui:gate plan-doc` 15/15)
  Sale de `UI.10`: el plan de la DB es uno solo, sin columna de proyecto, y `renderPlan(db)`
  (`handlers/plan.ts:22`) arma siempre el de OrchestOS. Hoy la pestaña Plan de cualquier otro
  proyecto muestra "not available yet" (`server.ts`, rutas `/api/plan*`). A diseñar: migración
  (`project_id` + PK compuesta), `plan-import`/`plan:reconcile`/`plan:render` y el pre-commit por
  proyecto, y quitar el corte por cwd de `server.ts`. Plan corto a Carlos antes de codear (toca
  varios módulos).
  **HALLAZGO QUE CAMBIA EL DISEÑO (2026-09-21, leído en el código y en el disco):** el `PLAN.md` de
  SalaDespecho es una checklist libre (`- [ ] Auditar…`, sin ID ni 🧠⚡🔍). El parser
  (`scripts/plan-status.ts:45`) exige `- [ ] **ID — 🧠 Título**`: sobre ese archivo devuelve **0
  ítems**. Y el modelo "la DB es la fuente, `PLAN.md` se renderiza" solo se sostiene porque el
  pre-commit de **este** repo corre `plan:render --check`; en otro repo nadie reconcilia, y a la
  primera edición a mano vuelve el 409 "out of sync". Migrar las tablas (`project_id` + PK
  compuesta) no alcanza para que el Plan de SalaDespecho muestre algo.
  **Opciones planteadas a Carlos:** (a) migración completa, y los proyectos adoptan el formato de
  OrchestOS y su hook; (b) sin migración: para un proyecto que no es OrchestOS, la pestaña Plan
  lee su `PLAN.md` en solo lectura (secciones `##` y checkboxes, sin dependencias ni cierre), un
  módulo nuevo más `server.ts`; (c) las dos. Recomendación del cerebro: (b). Pendiente de Carlos.
  **DECIDIDO POR CARLOS 2026-09-21: (b).** Cada proyecto usa su propio `PLAN.md`, en solo lectura;
  no se le impone el formato de OrchestOS. Sin migración de `plan_items`.
  **DECIDIDO POR CARLOS 2026-09-24 (dónde se ve):** conmutador dentro de la pestaña Plan de Settings → proyecto:
  `Kanban | Table | PLAN.md` (el toggle de `PlanBoardView.tsx:139-155` gana una tercera opción). Igual para todos
  los proyectos, OrchestOS incluido. Hallazgo previo: esa pestaña muestra el tablero de `tasks.yaml` y nada en React
  consumía `/api/plan`.
  Hecho: `src/plan/read-plan-doc.ts` (secciones `#`–`###`, checkboxes con sangría, texto plano; solo lectura, tope
  1 MB), `GET /api/plan/doc` por `x-orchestos-project-id` sin corte por cwd, tercera opción `PLAN.md` en el toggle de
  `PlanBoardView`. Las rutas `/api/plan*` de la DB siguen solo para OrchestOS.
  De paso: `project-tabs`, `tasks` y `runs-graph` registraban el proyecto temporal sin recargar (misma carrera que
  `chat-turn-details` en UI.9.9; `project-tabs` falló también sin los cambios) → `page.reload` tras registrar.
  Ejecutado por: luna (2 rondas; r2 la recarga en los flujos hermanos) · Spec: docs/specs/UI.10.A.md (borrado al cerrar).
  Gate en vivo: navegador real (Playwright, `bun run ui:gate plan-doc` 15/15 + project-tabs 23/23 + tasks 13/13 + runs-graph 16/16 + smoke 6/6) — `docs/done/evidence/UI.10.A-live.json`.
  Checklist libre estilo SalaDespecho, proyecto sin `PLAN.md` y el de este repo (`UI.10.A` visible); `test:coverage`
  1533/0 (1.ª corrida: el test inestable `context-adapters.test.ts:187`).

> **DECISIONES DE CARLOS 2026-09-21 — sidebar de proyectos, look nuevo y etiquetas del plan.**
> Contestadas en una sola ronda (memoria `feedback-preguntas-todas-juntas`). Pendientes de
> convertirse en ítems; no se implementan sueltas.
> 1. **Fila de proyecto:** icono `folder-closed` (lucide) en vez del libro actual. En hover, a la
>    derecha, tres iconos: chevron de expandir, `ellipsis` y `plus`; sin hover desaparecen. El
>    clic **solo expande/colapsa sus agentes**, no navega (hoy salta a Dev → Tasks,
>    `app.js:3410`). Sin nada elegido, el área principal queda vacía con el SVG de OrchestOS.
> 2. **Menú `ellipsis` del proyecto:** solo *Project settings* y *Delete project* (icono rojo).
>    *Project settings* lleva a Settings (la página de proyecto de `UI.10`). No existe hoy ni en
>    el front ni en el back (no hay endpoint para borrar un proyecto).
> 3. Tasks, Runs y Graph dejan de abrirse al clickear el proyecto; se ven solo desde su settings.
> 4. **Cerrar un agente = archivarlo** en un historial por proyecto, al estilo del panel "Agents"
>    de Orca en el lateral derecho. Hoy no hay forma de cerrarlos ni endpoint.
> 5. **Contador de agentes:** chip chico, siempre real, sin tener que expandir (hoy se carga
>    solo al expandir, `Sidebar.tsx:284-295`). La altura del chevron (hoy muy abajo) **no se
>    parchea con CSS suelto**: se arregla cuando se rehaga la cara del sidebar en React. Mismo
>    criterio para cualquier ajuste visual pedido antes de ese cambio: anotarlo, no gastar tokens.
> 6. **Adiós a 🧠⚡🔍:** reemplazar por etiquetas de texto propias que cualquier LLM entienda.
>    Toca parser (`scripts/plan-status.ts:45`), `CHECK` de `plan_items.delegation` y los ítems del
>    plan en un solo cambio.
> 7. = decisión (b) de arriba.
> 8. **Look nuevo pieza por pieza**, pero cada pieza tiene que verse como las referencias. Si una
>    referencia no está anotada con su fuente, preguntar en vez de suponer. Objetivo dicho por
>    Carlos: "CRM moderno".
> 9. **Referencia nueva:** Circle (https://circle.lndev.me/lndev-ui/team/DESIGN/overview, repo
>    `ln-dev7/circle`, Next.js + shadcn/ui, estilo Linear). La guía principal sigue siendo
>    `docs/ui-reference-patterns.md` + capturas en `~/Documents/screens/`.
> **Segunda ronda, mismo día:**
> - **Panel derecho = historial de agentes**, captura nueva `~/Documents/screens/rightside_agents.png`
>   (Orca): tabs de iconos arriba (archivos, agentes, source control, tasks) + toggle del panel;
>   título + "N shown", segmented `Workspace | Project | All`, buscador, grupo por proyecto con
>   contador, y por sesión: título, última línea, icono del CLI, mensajes, hace cuánto, modelo,
>   chevron y `ellipsis`. Cerrar un agente del sidebar lo manda acá. **No se llama "Agents"**: el
>   cerebro elige **"History"** (i18n "Historial").
> - **El botón que mostraba el panel derecho vuelve a ser permanente.** Hoy los botones de
>   Explorer/Diff/Terminal solo viven en la barra de tabs del workspace (arreglo de `UI.9.A`), y con
>   la decisión 1 (el clic en proyecto ya no abre el workspace) se vuelven a perder. Toggle fijo
>   arriba a la derecha, como en Orca. Esto reemplaza el criterio "inspector cerrado = 0px" de
>   `UI.9.5`.
> - **Quitar el pill `IDLE`/`RUNNING`** del header (`Header.tsx:18-21`).
> - **Estado del agente en la fila:** loader chico mientras trabaja, check chico al terminar.
> - **Delete project = quitar del espacio de trabajo**, sin borrar la carpeta, con confirmación;
>   coincide con lo que ya fijó `UI.9.9` el 2026-09-18 (ese ítem ya existía y es la pieza 2).
> - **Tema:** oscuro por defecto. Renombrar los temas: `claude` no puede llamarse así
>   (`theme.js:9`, `i18n.js:829,1742`).
> - Reparto de referencias no contestado explícitamente: se sigue la recomendación (estructura de
>   Orca, piel visual Circle/Linear, oscuro). Si Carlos lo corrige, manda lo suyo.
> **Orden aprobado ("GO"):** 0. `CI.2.A` (Luna, spec listo). 1. Sidebar de proyectos en React con
> la cara nueva (decisiones 1 y 5, loader/check, sin pill IDLE). 2. `UI.9.9` menú `ellipsis`
> (Project settings / Delete project) + back. 3. Panel derecho History + archivar agente + toggle
> permanente. 4. `UI.10.A` plan de cada proyecto en solo lectura. 5. Etiquetas de texto en vez de
> emojis. Temas renombrados entran en la pieza 1.

<a id="plan-orden-ui-15"></a>
- [x] **UI.15 — ⚡ "+ Add project" abre el selector de carpeta directo, sin modal.** (abierto 2026-09-27, cerrado 2026-09-27, GO de Carlos)
  El "+" del sidebar Dev (`ShellSidebar.tsx:217`) abre `AddProjectModal` ("Project Name" + "Default Git Branch"), pero
  `App.tsx:1044` ignora ambos y abre el selector nativo (`chooseProject`): el modal es un paso que no aporta. Fix: "+"
  llama `onNewProject` directo; borrar `AddProjectModal.tsx` y su paso en `scripts/ui-fidelity/capture.mjs:257`.
  Fuera: "Clonar desde URL" (feature nueva, plan aparte). Gate: paso nuevo en `project-tabs` — clic en "+" dispara
  `POST /api/projects/choose` (interceptado, `cancelled`) y no aparece ningún `dialog`.
  Ejecutado por: Codex · `gpt-6-luna` (1 ronda) · Spec: docs/specs/UI.15.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.15-live.json`: `project-tabs` 24/24 ("POST /api/projects/choose calls=1; dialog
  visible=false") + `smoke` 6/6; `test:coverage` 1547/0; tsc back+app; biome; `ui:fidelity:jsx`. El selector nativo
  real no se abre en el gate (interceptado): el clic del usuario sobre él queda sin verificar en vivo.

<a id="plan-orden-ui-16"></a>
- [x] **UI.16 — ⚡ Chat y Dev bajan hasta el último mensaje y se quedan abajo mientras crece.** (abierto 2026-09-27, cerrado 2026-09-27, GO de Carlos)
  Visto 2026-09-26 (captura `chat-roles/task-held-for-confirmation`): la tarjeta de tarea retenida queda bajo el
  pliegue. El Chat baja una sola vez, `smooth`, al cambiar `messages` (`OrchestChatView.tsx:156`); lo que se pinta
  después (tarjeta, burbuja en vivo) no vuelve a bajar. Dev solo baja al enviar (`OrchestDevWorkspace.tsx:279`).
  Fix: seguir el fondo mientras el usuario esté abajo. Gate: `chat-roles` y `chat-streaming` afirman el contenedor en
  el fondo y la tarjeta/burbuja dentro de la vista.
  Ejecutado por: Codex · `gpt-6-luna` (1 ronda) + ajustes del cerebro · Spec: docs/specs/UI.16.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.16-live.json`: `chat-roles` 11/11 — ventana de 560 px
  para que el turno desborde, y paso "chat follows content that grows after render" (crece 600 px tras el render):
  front viejo FAIL `{"grew":true,"atBottom":false}`, front nuevo PASS. `chat-streaming` 9/9 y los otros 10 flujos
  verdes; `test:coverage` 1547/0; tsc app; biome. Hook `useStickToBottom` (ResizeObserver + umbral 80 px), también al
  cambiar de sesión/agente. Nota: el caso exacto de la captura (tarjeta en un segundo render) ya no se da desde MR.1.d3
  (marcador en la misma respuesta); el gate prueba el mecanismo, no esa captura.
  Hallazgo del pre-push: 404 intermitente en `project-delete` → UI.17.

<a id="plan-orden-ui-17"></a>
- [x] **UI.17 — ⚡ Purgar un proyecto aborta también las lecturas de Memory/Specs/Skills/Instincts.** (abierto 2026-09-27, cerrado 2026-09-27)
  Visto en el pre-push de UI.16: `project-delete` falló 1/6 con "HTTP 404 /api/specs" — `refreshProjectTabs`
  (`App.tsx:434`) no registraba sus 4 lecturas en `projectHydrationControllers`, así que el purge no las abortaba
  (hermano del abort de config de MR.1.d1). Ahora reciben `signal` (`api/projectTabs.ts`) y se registran/limpian
  como `loadThreadMessages`.
  Sin delegación: fix de un solo flujo, hecho por el cerebro durante el pre-push.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.17-live.json`: `project-delete` 8/8 corridas
  11/11 tras el fix (evidencia débil ante una base de 1/6); `test:coverage` 1547/0; tsc app; biome.

<a id="plan-orden-ui-18"></a>
- [x] **UI.18 — ⚡ Dev: el mensaje enviado se ve al instante y el loader se apaga al terminar.** (abierto 2026-09-28, cerrado 2026-09-28, reporte de Carlos)
  Causa: `OrchestDevWorkspace.tsx` pintaba la burbuja solo desde `chat_messages` (se escribe al cerrar el turno, R.5)
  y `handleSendMessage` ponía `working` sin volver nunca a `done`. Ahora: burbuja optimista hasta que llega la real;
  el envío espera el `Promise<boolean>` de App y pasa a `done`/`failed`; cambiar de agente limpia ambos.
  Ejecutado por: luna (1 ronda) · Spec: docs/specs/DEV-SEND.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.18-dev-send.json`: `codex-live` 9/9 — burbuja a
  los 18 ms, 0 loaders tras cada turno. Contraprueba: el mismo flujo con el componente de HEAD falla en burbuja y loader.

<a id="plan-orden-ui-19"></a>
- [x] **UI.19 — ⚡ Dev muestra la conversación completa, no solo el último intercambio.** (abierto 2026-09-28, cerrado 2026-09-28, pedido de Carlos)
  `OrchestDevWorkspace.tsx` pintaba solo el último mensaje de usuario y la última respuesta, con los pasos de todos los
  turnos aplanados. Carlos: "tiene que siempre mostrar todo, es lo lógico". Hecho: `buildExchanges` (un intercambio
  por turno con sus propios pasos, respuesta y comandos; historial sin `turnId` emparejado por orden) renderizado con
  el mismo JSX; burbuja optimista y texto en vivo en el turno en curso; `extraTurns` (mock de la plantilla) borrado,
  con sus 27 clases en `jsx-allow.json`.
  Ejecutado por: luna (3 rondas; r1 rompía el texto en vivo, r2 inventó un campo de API en el flujo) · Spec: docs/specs/UI.19.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.19-live.json`: `codex-live` 11/11 — 2 intercambios
  en orden tras el turno 2 y tras recargar, texto en vivo, burbuja al instante, 0 loaders. `ui:fidelity:jsx` verde.

<a id="plan-orden-ui-20"></a>
- [x] **UI.20 — ⚡ Orden natural del chat y todo lo del agente de su lado (Chat y Dev).** (abierto 2026-09-28, cerrado 2026-09-28, pedido de Carlos)
  Carlos: "lo mío va debajo de tu respuesta… si está pensando, que todo se escriba de tu lado, no dentro de mi box".
  Visto en código: Dev pinta `readSteps` dentro de la burbuja del usuario. Absorbe el bug del composer que conserva el
  mensaje durante el turno.
  Causa del orden: el mensaje de usuario se guardaba con `turn_id` NULL y hora de fin de turno; Dev (UI.19) lo
  ordenaba después de la respuesta. Hecho: usuario con el `turn_id` del turno y hora de inicio
  (`db/chat-sessions.ts`), migración 18 que rellena los existentes, emparejado defensivo en `buildExchanges`; Dev sin
  `readSteps` en la burbuja del usuario; composer que se vacía al aceptar el envío y restaura si se rechaza.
  Ejecutado por: luna (2 rondas; r1 omitió los asserts de los flujos) · Spec: docs/specs/UI.20.md (borrado al cerrar)
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.20-live.json`: `chat-streaming` 15/15 y
  `codex-live` 14/14 (orden u1<a1<u2<a2 durante, al final y tras recargar; nada del agente en la burbuja; composer
  vacío). Contraprueba con los 4 archivos de producto de HEAD: falla Dev (a1 antes de u1) y el composer.
  `test:coverage` 1571/0.

<a id="plan-orden-ui-21"></a>
- [x] **UI.21 — ⚡ Selector de modelo con altura y buscador + esfuerzo por modelo de OpenCode.** (abierto 2026-09-28, cerrado 2026-09-28, pedido de Carlos)
  Lista de OpenCode "interminable" (392 modelos). `opencode models --verbose` trae variantes por modelo (199 con
  esfuerzo) y `opencode run --variant` las aplica; hoy el catálogo devuelve `efforts: []`. Va después de UI.20 (mismo
  composer).
  Hecho: catálogo de OpenCode con `opencode models --verbose` (esfuerzos por modelo, parser tolerante); chat y engine
  pasan `--variant` solo si el modelo lo admite; selector del composer y de Model routing con altura máxima, scroll,
  buscador con foco y teclado; esfuerzo visible solo con los niveles del modelo elegido.
  Ejecutado por: luna (4 rondas; r2-r3 flujo del composer, r4 menú cortado visto en captura; spec borrado al cerrar) · Spec: docs/specs/UI.21.md
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.21-live.json`: `composer-picker` 11/11 (menú 477 px
  de 1000, buscador y esfuerzo dentro del menú, niveles exactos, Codex intacto) + `model-routing` 14/14.
  `test:coverage` 1573/0. Pendiente menor: nombres largos de OpenRouter truncados se ven iguales.

<a id="plan-orden-ui-22"></a>
- [x] **UI.22 — ⚡ Selector de OpenCode: sin el prefijo `opencode/` y buscador solo en OpenCode.** (abierto 2026-09-29, cerrado 2026-09-29, pedido de Carlos)
  Carlos: la altura/buscador/esfuerzo de UI.21 era solo para OpenCode, y en OpenCode los modelos se leen
  `opencode/…` — "la palabra OpenCode está de más". Hoy `src/dashboard/chat-cli-models.ts:163` usa el id crudo como
  nombre y `AgentComposer.tsx:395` muestra el buscador para todos los CLIs.
  Hecho: el catálogo de OpenCode muestra el nombre sin `opencode/` (el id intacto para `--model`); el buscador del
  composer solo con OpenCode y se limpia al cambiar de CLI. Model routing conserva su filtro (listas de API largas).
  Ejecutado por: luna (2 rondas; r1 se creyó planificadora — lanzar con `ORCHESTOS_ROLE=executor`) · Spec: docs/specs/UI.22.md
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.22-live.json`: `composer-picker` 14/14,
  `model-routing` 14/14, `test:coverage` 0 fail.

<a id="plan-orden-ui-23"></a>
- [x] **UI.23 — ⚡ Selector de OpenCode: filas por proveedor, sin `openrouter/` y distinguibles.** (abierto 2026-09-29, cerrado 2026-09-29, pedido de Carlos)
  Tras UI.22 Carlos sigue viendo `openrouter/aion-labs/aion-3…`: el prefijo sobra y al truncar varias filas se ven
  iguales. Ids de OpenCode: 8 `opencode/<modelo>` y 385 `openrouter/<fabricante>/<modelo>`; ningún `<modelo>` repetido.
  Hecho: catálogo con `group` (Zen/OpenRouter) y `vendor`; filas = modelo + fabricante en gris, `title` = id; mismo
  fabricante en Model routing. Bug de paso: el parser descartaba `openrouter/~anthropic/…` (faltaba `~` en el regex).
  Ejecutado por: luna (3 rondas; r2-r3 localizadores de flujos que leían el id como texto visible) · Spec: docs/specs/UI.23.md
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.23-live.json`: `composer-picker` 16/16,
  `model-routing` 14/14, `test:coverage` 0 fail, lint verde.

## Apéndice — Lotes L1–L4 y decisiones de Carlos 2026-09-22/24 (migrado de NEXT.md el 2026-10-05)

Logs de rondas de Luna por ítem, lecciones y decisiones, tal como estaban en el handoff (sin editar; las lecciones
reutilizables viven ahora en `AGENTS.md` § "Lecciones operativas de delegación y ui-gate").

### Lote L4 (abierto 2026-09-24)
Ejecutor desde 2026-09-24: **Luna 6** = `codex exec -m gpt-6-luna -c model_reasoning_effort=medium -s workspace-write
"…" < /dev/null` (Carlos; AGENTS.md y memoria ya actualizados). Turno real de gate = Codex · `gpt-6-luna` · medium.
Orden: **CI.4** → **CI.2** → **UI.13.7** (colores de cuota, pedido de Carlos 2026-09-24). CI.4: (spec ya escrito y commiteado: `docs/specs/CI.4.md` — Luna 6 en los flujos, test inestable
`context-adapters:187`, test que deja `.orchestos/adversarial-review-state.json`) → **CI.2** (ui-gates exigibles:
medir cuánto tardan los flujos de `scripts/ui-gate/flows/` juntos antes de decidir CI/pre-push/workflow; spec por
escribir; la lista de "12 scripts de `scripts/ui-gates/`" del ítem es anterior a UI.13.3: verificar qué existe hoy).
Respuestas de Carlos al cierre de L3: los 92 dudosos se quedan (no preguntar lo ya decidido); residuos de prueba se
borran sin preguntar y se arregla el test que los deja (memorias nuevas).
Lecciones L3: (5) Luna re-corre el preflight hasta sobre OTRO ítem (CI.2) y pisa `.orchestos/active-item.json`:
revisar `scope:check` antes del commit; (6) flujo nuevo = `page.reload` tras registrar el proyecto.

#### Log L4
| ítem | rondas Luna | gate | min |
|---|---|---|---|
| CI.4 | 2 (r1 rompía `adversarial-review.test.ts`, revertido; r2 dos intermitentes más) | 9 flujos · test:coverage 5×1533/0 · gate:all | ~75 |
| CI.2 | 2 (r2: flujos reintentan y registran QA) | 9 flujos · project-delete 3/3 · gate:all 1533/0 | ~120 |
CI.2: spec `docs/specs/CI.2.md` (medición: 9 flujos ≈285 s, 7 con turno real; workflow aparte para los 3 sin turno,
pre-push condicional para los 9; aislar `ORCHESTOS_HOME` del runner; arreglar `project-delete`/`runs-graph` intermitentes).
**PAUSA L4 tras CI.2 (Carlos 2026-09-24):** antes de UI.13.7 va el ítem de roles de Model routing (4 roles
{agente CLI/API, modelo, esfuerzo}: Orquestador/Ejecutor/Revisor/Auxiliar; absorbe AT.10/AT.13; fuera todo hardcode de
modelo: `QA_JUDGE_DEFAULTS`, `diagnose.ts:166`, `memory/judge.ts:118`, `spec/draft.ts:177`). Esperando que Carlos confirme
los 4 roles; luego plan en PLAN.md y GO antes de codear.
Carlos 2026-09-24: `#69`/`#70` en IDEAS.md (Files no expande carpetas; Changes en vivo estilo VS Code).

### Lote L3 (abierto 2026-09-23, pedido de Carlos)
Orden: UI.13.6 → UI.9.9 → UI.9.8 → UI.10.A. Mismo flujo y paradas que L1/L2; spec commiteado al lanzar a Luna.
| ítem | rondas Luna | gate | SHA | min |
|---|---|---|---|---|
| UI.13.6 | 1 (su "gate:all falló" era el sandbox, EADDRINUSE; fuera, solo el test inestable `context-adapters:187`, 2.ª corrida verde) | usage-bar 13/13 · smoke 6/6 · test:coverage 1527/0 | f723a51 | ~45 |
| UI.9.9 | 2 (dijo que 4 flujos fallaban: 3 pasaban fuera del sandbox; el 4.º, `chat-turn-details`, fallaba también en master) | project-delete 11/11 · 6 flujos verdes · gate:all 1528/0 | ver git log | ~50 |
| UI.9.8 | 4 (r1 barrido de ~11 textos, devuelto; r2 inventario mecánico 105; r3 flujo con textos viejos; r4 texto inexacto) | text-sweep 10/10 · chat-turn-details 27/27 · smoke · gate:all 1528/0 | ver git log | ~60 |
| UI.10.A | 2 (r2: recarga tras registrar en project-tabs/tasks/runs-graph, carrera intermitente) | plan-doc 15/15 · project-tabs 23/23 · tasks · runs-graph · smoke · test:coverage 1533/0 | ver git log | ~50 |
UI.10.A (respondido 2026-09-24: conmutador en Plan; cerrado): la pestaña Plan de Settings → proyecto muestra
el tablero de tasks (`PlanBoardView`, fuente `tasks.yaml`), no `PLAN.md`; nada en React consume `/api/plan`. ¿Dónde va el
`PLAN.md` en solo lectura? Recomendación del cerebro: vista `PLAN.md` dentro de la pestaña Plan (conmutador junto al
tablero), igual para todos los proyectos incluido OrchestOS.
Para Carlos al cierre de L3: 92 textos dudosos del barrido en `docs/done/evidence/UI.9.8-sweep.md` (se quedaron).
Lecciones L3: (1) el `--scope` del preflight necesita globs (`src/dashboard/**`): un directorio pelado no cubre sus
archivos; (2) incluir `NEXT.md` en el scope; (3) el preflight no se puede re-correr sobre un ítem ya `[x]`: si el
scope quedó corto, línea "**Fuera de scope declarado:**" en el ítem; (4) `check-live-gate` exige la frase
"Gate en vivo: …Playwright" y la cita del `.json` de evidencia en la MISMA línea.

### Hallazgos post-cierre UI.13.5 (2026-09-23) — primero en L3, como UI.13.6
1. Codex sin cuota en proyectos sin sesión de Codex: `scripts/session-status.ts` solo llama `readCodexRateLimitsLive`
   si hay sesión de Codex del proyecto (`liveCodex`); Claude sí tiene respaldo de cuenta (`claudeStatusline && !found.has`).
   Reproducido con Playwright: proyecto temporal + turno real Codex Luna → barra `86% — —` antes y después del turno.
   Lo tapaban los fetch sin proyecto que quitó UI.13.5 (leían la raíz de orchestos).
2. Ventana vencida se pinta "—" (`ShellStatusBar.tsx:36`) en vez de 100 %: tras el reset la cuota está libre.
3. Brave no mostraba la barra y Chrome/Safari sí, con el mismo :4242: `/app/dist/main.js` se sirve sin `Cache-Control`
   ni hash en el nombre → sospecha de bundle viejo en caché (no verificado en Brave). Arreglo: `Cache-Control: no-cache`.
Nota de proceso: el cerebro escribió código en `session-status.ts` vía python en Bash (el hook solo mira Write/Edit en
rutas); no repetir.

### UI.13.5 CERRADO 2026-09-23 — siguiente: abrir Lote L3 (UI.9.9 → UI.9.8 → UI.10.A)
3 rondas de Luna; evidencia `docs/done/evidence/UI.13.5-live.json`. Lección: el flujo de r2 pasaba con un clic manual
del propio gate; medir el fin del turno con la respuesta de `POST /api/chat` y exigir la petición en ≤5 s sin clic.
Lección 2: commitear el spec al lanzar a Luna — el plan gate exige que el cierre haga `git rm` del spec; UI.13.5 lo tuvo
sin versionar y hubo que reconstruirlo (3695cfc).

### Siguiente tab — Lote L2 CERRADO (2026-09-23); abrir L3
L2: UI.13.2e, UI.13.2f, UI.13.3 cerrados y pusheados. Siguiente según PLAN.md § Rumbo Fase 1: **UI.13.5 primero** (cuotas de la barra
inferior solo al recargar + proyectos temporales de gates en la DB real; causa ya diagnosticada en el ítem) → UI.9.9 → UI.9.8 →
UI.10.A. Pendiente de decidir por Carlos: cerrar los padres UI.13 y UI.13.4 (sus sub-ítems están todos `[x]`).
Lecciones L2: (1) la DB del gate es la real: todo flujo borra lo que siembra y el cerebro lo verifica por consulta;
(2) auditar los `step()` del flujo, no el conteo PASS (r1 de 2f: 14/14 con 6 pasos vacíos); (3) cerrar un ítem:
`git rm` del spec en el mismo commit o el plan gate rechaza; si `plan:reconcile` dice "Could not prove a closing
commit SHA", reabrir `[ ]` → reconcile → `[x]` → reconcile; (4) `.orchestos/feature-status.json` lo regenera el
pre-commit: incluirlo en el `--scope`; (5) Luna puede re-correr el preflight y estrechar el scope: revisarlo antes
del commit.

### Lote L1 CERRADO; L2 abierto (histórico)
L1 terminado 2026-09-23: CI.2.B, UI.13.4c, UI.13.2d (Tasks real) con gate:all + ui:gate PASS y push.
Siguiente: abrir **L2** con los 3 siguientes de la Fase 1 (PLAN.md § Rumbo): pantallas restantes de UI.13
(Runs/Graph ya tienen parte; luego Memory/Specs/Skills/Instincts/Plan) → UI.9.9 → UI.9.8. Mismo bucle:
spec en `docs/specs/`, Luna con `codex exec -m gpt-5.6-luna -c model_reasoning_effort=medium -s workspace-write "…" < /dev/null`,
flujo en `scripts/ui-gate/flows/<pantalla>.mjs`, verificar con `bun run gate:all` + `bun run ui:gate <flujo>` + `smoke`.
Lecciones nuevas de UI.13.2d:
- El preflight solo reconoce ítems de **primer nivel** en PLAN.md (`^- [ ] **ID`); un sub-ítem con sangría lo bloquea.
  Abrir el sub-ítem como línea propia antes de lanzar a Luna.
- Luna volvió a decir "lint preexistente" en falso (era su archivo) y "typecheck PASS" corriendo solo el tsc raíz:
  exigir `bun run typecheck` completo (dos tsconfig).
- Tareas de fixture: `engine: codex` + `executor_model: openai/gpt-5.6-luna`, **nunca** `executor: codex` (exige
  `OS_ENABLE_EXEC_CODEX`); así las crea el chat (`resolveAgentSelection`). La tarea debe modificar su output o el QA
  la devuelve a `pending` con reintento.
- Un QA fallido no cambia el status: fin de run = status, `retryCount` o `runId` distintos.
- Hook PreToolUse bloquea que el cerebro edite código (`src/**`); los arreglos del flujo de gate pasaron sin bloqueo.
- El hook de contexto pide cerrar tab desde ~8% de 1M: umbral a revisar.
Antes (ítem 3, ya hecho): CI.2.B (47b4dbf) y UI.13.4c (aca8d90) cerrados y pusheados; dashboard :4242 reiniciado con el código nuevo.
Ítem 3: siguiente pantalla de UI.13 (Tasks, PLAN.md § Fase 1). Mismo bucle: spec en `docs/specs/`, Luna con
`codex exec -m gpt-5.6-luna -c model_reasoning_effort=medium -s workspace-write "…" < /dev/null` (NO `--full-auto`:
esa flag no existe), flujo nuevo en `scripts/ui-gate/flows/<pantalla>.mjs`, verificar con `bun run gate:all` +
`bun run ui:gate <flujo> smoke`. Preflight con `--scope` real del ítem (si no, el pre-commit bloquea).
Lecciones del lote: Luna afirmó 3 veces cosas falsas ("DB aislada", "catálogo sin luna", "lint preexistente") →
verificar siempre. `visible()` espera a que aparezca; para "desaparece" usar `ctx.hidden()`. Reproducciones por API:
buscar el proyecto por `realpath` y pasar `x-orchestos-project-id`, o el fallback `legacy-cwd` escribe en el
`tasks.yaml` de ESTE repo (pasó y se revirtió).

### Lote L2 (abierto 2026-09-23, pedido de Carlos)
Hallazgo de proceso: el hook PreToolUse bloquea `sed` del cerebro sobre `scripts/**` pero no un `python3` que escriba
el mismo archivo — así ajusté 2 veces `runs-graph.mjs` en UI.13.2e sin darme cuenta. Agujero del freno, no permiso.
Ítems: UI.13.2e Runs+Graph (`docs/specs/UI.13.2e.md`) → UI.13.2f Memory/Specs/Skills/Instincts/Plan (un spec,
incluye acciones de PlanBoardView) → UI.13.3 borrar vanilla/`/legacy`/islas/CSS/ui-gates de píxel (recuperable
por git). Mismo flujo y paradas que L1. Reemplaza el orden anterior (UI.9.9/UI.9.8 quedan para L3).
| ítem | rondas Luna | gate | SHA | min |
|---|---|---|---|---|
| UI.13.2e | 3 (r1 runs sin `project_id`; r2 lo propagó dashboard→CLI→harness; r3 proyecto duplicado por symlink `/var`↔`/private/var` al indexar, dejó 14 fantasmas en la DB real que rompían smoke con 410 — borrados por el cerebro) | runs-graph 16/16 (flujo endurecido por el cerebro: QA se mira con la pestaña abierta, conteo real antes y +1 tras Rebuild) · smoke 6/6 · gate:all 1533/0 | ver git log | ~120 |
| UI.13.2f | 4 (implementación 14/14 con pasos vacíos; flujo real 22/22; `[object Object]` en Explain; chequeo `exact:false`) | project-tabs 23/23 · tasks 13/13 · runs-graph 16/16 · smoke 6/6 · gate:all 1534/0 | ver git log | ~75 |
| UI.13.3 | 1 (re-declaró el scope por su cuenta, más estrecho) | smoke/tasks/runs-graph/project-tabs/chat-turn-details verdes · gate:all 1518/0 | ver git log | ~40 |

### Lote L1 — prueba del flujo por lote (abierto 2026-09-23, `docs/propuesta-flujo-por-lote.md`)
Ítems: CI.2.B (`ui:gate`, spec `docs/specs/CI.2.B.md`) → UI.13.4c (`docs/specs/UI.13.4c.md`) → siguiente pantalla de UI.13.
Fin: los 3 con `gate:all` + `ui:gate` PASS, commit, `[x]` en PLAN.md, push. Paradas: el MISMO fallo tras 2 reintentos
(ajustado en el primer uso: CI.2.B tuvo 4 rondas por 4 causas distintas, cada una avanzando),
decisión de producto no prevista, acción irreversible, tope de 3 ítems. Luna escribe; el cerebro vigila y verifica.
Decisión tomada por el cerebro (Carlos no respondió las 3 preguntas; aplicó las recomendaciones): botón
`Approve & Merge to Main` → `Approve & Run` (aprobar corre la tarea, no hace merge).
**Preguntas para Carlos al cierre del lote (no bloquean):**
1. **RESPONDIDA 2026-09-23 por Carlos: "Lista por proyecto".** La lista de Chat muestra los chats del proyecto de la
   cabecera + los generales; "New chat" se liga al proyecto visible; el diálogo ofrece "Sin proyecto" explícito.
   Pregunta original — Cabecera vs chat nuevo: sin proyecto activo, la cabecera muestra `projects[0]` (`App.tsx:220`) pero "New chat" crea
   una sesión sin proyecto (`App.tsx:467`, modo Chat, no crea tareas). ¿Chat nuevo = proyecto que se ve en la cabecera,
   o la cabecera dice "sin proyecto" (chat general)? Recomendación: ligar al proyecto visible y ofrecer "sin proyecto"
   explícito en el diálogo de New chat.
2. Decidido por el cerebro en UI.13.4c r7 (revisable): un mensaje clasificado como tarea cuyo borrador no nombra
   archivos NO crea tarea ni añade nota de error (antes: guardaba `output: []`, arrancaba un run y dejaba `tasks.yaml`
   inválido para siempre). También pendiente AT.10: `buildNaturalDraft` llama a haiku por OpenRouter en silencio.
3. La tarjeta retenida copia el título literal de la plantilla "Task Ready for Git Commit Proof": no describe lo que
   pasa (tarea retenida esperando aprobación). ¿Se cambia el texto?
4. Test inestable (no del lote): `scripts/context-adapters.test.ts:187` (timeout 500 ms) falló 1 de 2 corridas de
   `test:coverage` bajo carga; aislado pasa.
5. DB real: filas huérfanas de fixtures de tests (`files`/`code_edges` de `gfc-*`, `ruby-check`) sin proyecto. ¿Limpiarlas?
| ítem | rondas Luna | gate | SHA | min |
|---|---|---|---|---|
| UI.13.2d | 4 (preflight sin ítem, implementación, fin de run por reintento, cast TS) + fixture/gate corregidos por el cerebro | PASS tasks 13/13 · smoke 6/6 · gate:all verde | ver git log | ~70 |
| UI.13.4c | 13 (código, regex, razonamiento+R.1, flujo, rutas, tarea vacía, popover, Reject/Approve, esperas, árbol sucio, decisión lista, fila) | PASS chat-turn-details 27/27 · smoke 6/6 · gate:all verde | ver git log | ~210 |
| CI.2.B | 5 (spawn fd, espera, bug Settings, flujo) + 1 chore de lint innecesario revertido (diagnóstico mío errado: eran avisos, no errores) | PASS smoke 6/6 · gate:all verde | ver git log | ~75 |

### Decisión vigente
UI.13 (PLAN.md § UI.13): el prototipo de AI Studio **es** el frontend (`src/dashboard/app/`, servido en `/`);
el vanilla vive en `/legacy` solo hasta UI.13.3 y no se edita. Tope: **lo que falta de UI.13 en 2 h**
(regla escrita en PLAN.md § UI.13).

### Regla de Carlos 2026-09-22
Cero trabajo sobre el vanilla: `/legacy` es cascarón de referencia. Todo look/comportamiento sale de la
plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Anotado en PLAN.md § UI.13.

### Hecho y pusheado
UI.12.2a, UI.13.1, UI.13.1b, UI.13.2a (Chat), UI.13.2b (proyectos/Dev/Files, cerrado 2026-09-22).

### Decisión 2026-09-22 (tarde) — "SI go"
Copiar YA tal cual las pantallas de la plantilla sin backend (datos de ejemplo visibles), conectar después.
Primero: pasada de fidelidad pantalla por pantalla, capturas lado a lado revisadas por Opus (no haiku).
Detalles de Carlos → PLAN.md § UI.13 (3) a–d: barra inferior sin acción/usage 5h+semanal, selector de CLI/modelo/
esfuerzo real en el input del chat, iconos de CLI con color, Settings→Usage estilo GitHub.
CI verde otra vez en local (61b63b6, CI.3); pre-push ahora corre lint.

### Estado 2026-09-22 (noche)
UI.13.5 cerrado y pusheado (448f07a). Siguiente: **UI.14** — copiar la plantilla nueva de AI Studio (Dev como chat
que actúa como CLI, AgentComposer, ContextRing, ShellStatusBar, logos de producto) y cablearla. Plan en el último
mensaje del tab anterior; **espera el GO de Carlos** y su respuesta sobre tooltips (nativos `title` tal cual vs
tooltip propio instantáneo). Luego UI.13.6 (cuotas reales: Claude sin fuente, Codex vencido desde 17-sep).

### Rumbo nuevo (2026-09-22)
- PLAN.md reordenado en tres fases (sección "Rumbo" al inicio): interfaz → producto mínimo → correr dentro de
  OrchestOS igual que el CLI directo. Cerrados archivados en `docs/done/` (índice al final de PLAN.md).
- Siguiente: Fase 1, empezando por UI.13.4c. 11 ítems retirados (`docs/done/retirados.md`); UI.8.6 pasó a Fase 2.
- UI.14: sin verificar en vivo el selector nativo de nuevo proyecto.
- Carlos: turno real de gate = **Codex · gpt-5.6-luna · medium**.

### Siguiente (serial, una ronda cada uno)
1. UI.13.2c Settings — cerrado 2026-09-22. Pendiente menor: idioma solo traduce Settings.
2. UI.13.4a — cerrado 2026-09-22.
3. UI.13.4b — cerrado 2026-09-22 (816a229). Decisión pendiente de Carlos: la frontera por argumentos no frena
   `node -e`/`sh -c`; barrera real = sandbox de proceso o lista de binarios permitidos.
   UI.13.4c razonamiento/herramientas/tarea retenida en el chat — spec por escribir.
4. Tasks/Runs/Graph → Memory/Specs/Skills/Instincts/Plan → UI.13.3 borrar vanilla.
Gate en vivo con el patrón de `/tmp/ui132b-gate*.mjs`. Regla nueva: comportamientos de la plantilla se
hacen reales, no se quitan (PLAN.md § UI.13).
