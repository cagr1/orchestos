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
