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
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { registerIsland, mountIslands, installIslandBridge, startIslandObserver } from './lib/islands.ts'
import { LangProbe } from './islands/LangProbe.tsx'
import { ModelCombo } from './islands/ModelCombo.tsx'
import { Toaster } from './islands/Toaster.tsx'
import { UiKitProbe } from './islands/UiKitProbe.tsx'
import { pushToast } from './lib/toast-store.ts'

registerIsland('lang-probe', LangProbe)
registerIsland('model-combo', ModelCombo)
registerIsland('ui-kit-probe', UiKitProbe)

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
  for (const [flag, island] of [['island-probe', 'lang-probe'], ['ui-probe', 'ui-kit-probe']] as const) {
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
