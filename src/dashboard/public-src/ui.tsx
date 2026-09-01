/**
 * Entry del bundle de UI (UI.0, Mes 30).
 *
 * Se carga DESPUÉS de app.js en index.html, por lo que `window.App` ya existe cuando
 * corre esto. Hace tres cosas y nada más:
 *  1. registra las islas disponibles,
 *  2. instala el puente de ciclo de vida sobre `App.rerender()`,
 *  3. monta lo que ya esté en el DOM.
 *
 * Ninguna pantalla está migrada todavía: si el HTML vanilla no declara ningún
 * `data-island`, este archivo no pinta absolutamente nada. Ese es el criterio de
 * UI.0 — el dashboard tiene que quedar idéntico.
 */
import './styles/ui.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { LangProbe } from './islands/LangProbe.tsx'
import { ModelCombo } from './islands/ModelCombo.tsx'
import { SkillsScreen } from './islands/screens/SkillsScreen.tsx'
import { SpecsScreen } from './islands/screens/SpecsScreen.tsx'
import { Header } from './islands/shell/Header.tsx'
import { RightPanelToprow } from './islands/shell/RightPanelToprow.tsx'
import { Sidebar } from './islands/shell/Sidebar.tsx'
import { Toaster } from './islands/Toaster.tsx'
import { UiKitProbe } from './islands/UiKitProbe.tsx'
import { bumpAppState } from './lib/app-state.ts'
import {
  installIslandBridge,
  mountIslands,
  registerIsland,
  startIslandObserver,
} from './lib/islands.ts'
import { setShellState } from './lib/shell-store.ts'
import { pushToast } from './lib/toast-store.ts'

registerIsland('lang-probe', LangProbe)
registerIsland('model-combo', ModelCombo)
registerIsland('ui-kit-probe', UiKitProbe)
registerIsland('shell-sidebar', Sidebar)
registerIsland('shell-header', Header)
registerIsland('shell-rp-toprow', RightPanelToprow)
registerIsland('screen-specs', SpecsScreen)
registerIsland('screen-skills', SkillsScreen)

// A NIVEL DE MÓDULO, no dentro de `boot()`, y el orden importa: un `<script type="module">`
// se ejecuta ANTES de `DOMContentLoaded`, o sea antes del `boot()` de `app.js` — que empuja
// el primer estado del shell JUSTO ANTES de emitir `orchestos:ready`. Si el puente se
// instalara en nuestro `boot()` (que corre AL recibir ese evento), ese primer empujón
// caería en el vacío y el riel pintaría con los valores por defecto hasta el siguiente
// poll: 30 segundos con la pantalla activa mal marcada.
installShellBridge()

type AppLike = { rerender: () => void }

/**
 * Inserta el contenedor de la isla de prueba al tope de `#main`, solo con
 * `?island-probe=1`. Corre después de cada rerender porque `main.innerHTML = …` lo
 * borra: que sobreviva a eso es justamente parte de lo que se está probando.
 */
function ensureProbeContainer(): void {
  const params = new URLSearchParams(location.search)
  const main = document.getElementById('main')
  if (!main) return
  for (const [flag, island] of [
    ['island-probe', 'lang-probe'],
    ['ui-probe', 'ui-kit-probe'],
  ] as const) {
    if (!params.has(flag)) continue
    if (main.querySelector(`[data-island="${island}"]`)) continue
    const host = document.createElement('div')
    host.setAttribute('data-island', island)
    main.prepend(host)
  }
}

/**
 * Monta el host de toasts y toma el control de `showToast()` (UI.2).
 *
 * El host NO va por el registro de islas: las islas viven dentro de `#main`, que
 * `App.rerender()` borra entero cada 30s, y un toast disparado justo antes de un
 * repintado se cortaría a la mitad. Va en un contenedor propio colgado de `<body>`,
 * montado una sola vez para toda la sesión.
 *
 * Sobre reasignar la global: `showToast` está declarada en `app.js` con `function`, y
 * una declaración de función en el scope global SÍ crea una propiedad de `window`
 * (a diferencia de `const`/`let` — el motivo por el que `App` necesitó exponerse a mano).
 * Reasignarla redirige a las 71 llamadas `showToast(...)` que ya existen, sin tocar una
 * sola de ellas: la misma estrategia que UI.1 usó con `buildModelSelect()`.
 *
 * Si el bundle no cargara, `showToast` sigue siendo la implementación vanilla de siempre
 * y el dashboard degrada solo, sin avisos rotos.
 */
/**
 * Publica el empujón de estado del shell (UI.3). `app.js` lo llama a través de
 * `pushShellState()`, que es un no-op si esto no está: el dashboard arranca igual aunque
 * el bundle falte, con el shell vacío en vez de un error.
 *
 * Se instala ANTES de montar las islas, porque `boot()` empuja el primer estado justo
 * antes de emitir `orchestos:ready` — y ese empujón tiene que llegar al store para que el
 * riel pinte de una con los valores correctos, sin parpadeo.
 */
function installShellBridge(): void {
  const w = window as unknown as {
    __orchestosPushShell?: typeof setShellState
    __orchestosBumpState?: typeof bumpAppState
  }
  w.__orchestosPushShell = setShellState
  // UI.4 — la señal de "el estado cambió" para las pantallas migradas.
  w.__orchestosBumpState = bumpAppState
}

function installToaster(): void {
  const host = document.createElement('div')
  host.id = 'orchestos-toaster'
  document.body.appendChild(host)
  createRoot(host).render(createElement(Toaster))

  const w = window as unknown as { showToast?: (msg: string, type?: string) => void }
  w.showToast = (msg: string, type?: string) => {
    pushToast(String(msg), type === 'error' ? 'error' : 'default')
  }
}

function boot(): void {
  const app = (window as unknown as { App?: AppLike }).App
  if (!app) {
    console.warn('[ui] window.App no está disponible: las islas no se remontarán tras rerender()')
  } else {
    installIslandBridge(app, ensureProbeContainer)
  }
  ensureProbeContainer()
  mountIslands(document)
  // Cubre los repintados vanilla que NO pasan por App.rerender() — el Modal, sobre todo.
  startIslandObserver()
  installToaster()
}

/**
 * Cuándo arrancar — verificado en vivo el 2026-08-25, y NO es obvio:
 * un `<script type="module">` corre ANTES de que dispare `DOMContentLoaded`, que es
 * cuando `app.js` ejecuta su `boot()`. Es decir: al cargarse este bundle, `window.App`
 * todavía no existe y `#main` todavía está vacío. Si se montaran las islas acá, el
 * primer `rerender()` del boot vanilla las borraría sin que nadie las remonte.
 * Por eso se espera a `orchestos:ready`, que `app.js` emite al final de SU boot.
 * El chequeo de `window.App` cubre el caso de que el bundle se cargue tarde (recarga
 * en caliente, o alguien moviendo el <script>), donde el evento ya pasó.
 */
if ((window as unknown as { App?: AppLike }).App) {
  boot()
} else {
  window.addEventListener('orchestos:ready', boot, { once: true })
}
