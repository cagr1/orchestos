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
  shellMode: 'chat' | 'dev'
  generalSessions: SessionRow[]
  sessionsVersion: number
  chatPendingBySession: Record<string, boolean>
  /** Pantalla activa (`state.screen` del vanilla). */
  screen: string
  /** Contador del badge de skills. */
  skillsCount: number
  /** Hay alguna tarea corriendo: pinta el pill del header. */
  running: boolean
  /** Riel izquierdo expandido. */
  sidebarExpanded: boolean
  /** Inspector contextual: tarea, herramienta o cerrado. */
  inspector:
    | null
    | { kind: 'task'; id: string }
    | { kind: 'tool'; tab: 'explorer' | 'terminal' | 'diff' }
  /**
   * Proyecto activo del workspace.
   */
  workspaceProjectId: string | null
  chatSessionId: string | null
  activeProjectName: string | null
}

export interface SessionRow {
  id: string
  agent: string
  title: string | null
  updatedAt: string
  projectId: string | null
}

const initial: ShellState = {
  shellMode: 'chat',
  generalSessions: [],
  sessionsVersion: 0,
  chatPendingBySession: {},
  screen: 'chat',
  skillsCount: 0,
  running: false,
  sidebarExpanded: false,
  inspector: null,
  workspaceProjectId: null,
  chatSessionId: null,
  activeProjectName: null,
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
 * esté navegando por teclado. En este puente, `undefined` significa "no toques esta clave",
 * nunca "borrá esta clave"; para vaciar un valor hay que enviar el vacío explícito.
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
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<ShellState>
  state = { ...state, ...definedPatch }
  for (const listener of listeners) listener()
}
