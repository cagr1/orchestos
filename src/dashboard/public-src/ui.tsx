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
import { registerIsland, mountIslands, installIslandBridge, startIslandObserver } from './lib/islands.ts'
import { LangProbe } from './islands/LangProbe.tsx'
import { ModelCombo } from './islands/ModelCombo.tsx'

registerIsland('lang-probe', LangProbe)
registerIsland('model-combo', ModelCombo)

type AppLike = { rerender: () => void }

/**
 * Inserta el contenedor de la isla de prueba al tope de `#main`, solo con
 * `?island-probe=1`. Corre después de cada rerender porque `main.innerHTML = …` lo
 * borra: que sobreviva a eso es justamente parte de lo que se está probando.
 */
function ensureProbeContainer(): void {
  if (!new URLSearchParams(location.search).has('island-probe')) return
  const main = document.getElementById('main')
  if (!main || main.querySelector('[data-island="lang-probe"]')) return
  const host = document.createElement('div')
  host.setAttribute('data-island', 'lang-probe')
  main.prepend(host)
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
