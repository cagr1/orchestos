/**
 * Superficie que el vanilla expone al shell React (UI.3, Mes 30).
 *
 * Las ACCIONES no se reimplementan en React: navegar, colapsar el riel, abrir la paleta o
 * cambiar de pestaña ya tienen dueño en `app.js`, y ese dueño además persiste en
 * `localStorage` y coordina cosas que viven fuera del shell (por ejemplo, salir de una
 * pantalla de operador al apagar el modo avanzado). Duplicar esa lógica acá crearía una
 * segunda fuente de verdad de la navegación — justo lo que UI.7 va a tener que reordenar.
 * React dibuja y avisa; el vanilla decide y persiste, hasta que UI.7 mueva esa frontera.
 */

export interface NavEntry {
  id: string
  /** SVG ya resuelto: los ítems de `NAV` traen el markup, no el nombre del ícono. */
  icon: string
  /** Clave de i18n del label. */
  key: string
  badge?: boolean
  operator?: boolean
}

export interface ShellApi {
  nav: NavEntry[]
  icons: Record<string, string>
  go: (id: string) => void
  toggleSidebar: () => void
  toggleAdvanced: () => void
  openCommandPalette: () => void
  toggleRightPanel: () => void
  setRightPanelTab: (tab: string) => void
}

export function shellApi(): ShellApi | null {
  return (window as unknown as { OrchestOS?: ShellApi }).OrchestOS ?? null
}
