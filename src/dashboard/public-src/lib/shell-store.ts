/**
 * Store del shell (UI.3, Mes 30) — el puente de estado entre el dashboard vanilla y el
 * sidebar/header/rightpanel de React.
 *
 * POR QUÉ HACE FALTA, y por qué no alcanzaba con lo de UI.0/UI.1. Las islas anteriores
 * recibían su estado por `data-props` en cada repintado: el vanilla armaba el HTML, metía
 * el valor ahí, y React lo leía al montar. Eso funciona para un control que vive dentro
 * de `#main`, que se repinta entero. El shell NO está en `#main` — `sidebar`, `header` y
 * `rightpanel` son hermanos suyos en `index.html`, y `App.rerender()` no los toca. Los
 * mantiene sincronizados `syncNav()`/`syncHeader()`, que hasta ahora **manipulaban el DOM
 * a mano** (`classList.toggle('active')`, `badge.textContent = …`).
 *
 * Un componente React no puede recibir empujones así: si algo de afuera le escribe el DOM,
 * React lo pisa en el siguiente render. Entonces `syncNav()`/`syncHeader()` pasan a
 * EMPUJAR ESTADO acá, y el shell se suscribe. Es el mismo patrón de `toast-store` y del
 * puente de i18n — estado fuera de React + `useSyncExternalStore` — y ya es el tercero,
 * así que es LA forma de cruzar la frontera en este proyecto, no una solución puntual.
 *
 * El sentido inverso (React → vanilla) NO pasa por acá: navegar, colapsar o cambiar de
 * pestaña son acciones que ya tienen dueño en `app.js` (`App.go()`, el toggle del sidebar),
 * y el shell las invoca por `window.OrchestOS`. Duplicar esa lógica en React sería crear
 * una segunda fuente de verdad de la navegación, que es justo lo que UI.7 va a tener que
 * reordenar; mejor que siga habiendo una sola.
 */

export interface ShellState {
  /** Pantalla activa (`state.screen` del vanilla). */
  screen: string
  /** Contador del badge de skills. */
  skillsCount: number
  /** Hay alguna tarea corriendo: pinta el pill del header. */
  running: boolean
  /** Riel izquierdo expandido. */
  sidebarExpanded: boolean
  /** Aside derecho abierto. */
  rightPanelOpen: boolean
  /** Pestaña activa del aside derecho. */
  rightPanelTab: string
  /**
   * Modo avanzado (`localStorage['orchestos-mode']`). SIGUE EXISTIENDO a propósito:
   * UI.7 es el único ítem autorizado a eliminarlo, y UI.3 tiene prohibido cambiar
   * navegación. Se migra el modo tal como está, aunque sea código con fecha de muerte.
   */
  advanced: boolean
}

const initial: ShellState = {
  screen: 'chat',
  skillsCount: 0,
  running: false,
  sidebarExpanded: false,
  rightPanelOpen: false,
  rightPanelTab: 'terminal',
  advanced: false,
}

let state: ShellState = initial
const listeners = new Set<() => void>()

export function subscribeShell(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getShellState(): ShellState {
  return state
}

/**
 * Empujón desde el vanilla. Se ignora si nada cambió: `syncNav()` corre en CADA
 * `App.rerender()`, o sea cada 30 segundos por el poll, y sin este corte el shell entero
 * se repintaría para nada — con el costo de perder el foco de un botón que el usuario
 * esté navegando por teclado.
 */
export function setShellState(patch: Partial<ShellState>): void {
  let changed = false
  for (const key of Object.keys(patch) as (keyof ShellState)[]) {
    if (patch[key] !== undefined && patch[key] !== state[key]) {
      changed = true
      break
    }
  }
  if (!changed) return
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
