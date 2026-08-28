/**
 * Header (UI.3, Mes 30) — reemplaza `App.syncHeader()`, que escribía el DOM a mano.
 *
 * Es deliberadamente mínimo, y esa es su historia: en la ronda 3 del rediseño de v0.12
 * Carlos hizo sacar el contador "N active" (le quitaba espacio al pill) y en la ronda 4 los
 * íconos (el toggle del panel derecho vive DENTRO del aside, nunca acá, y nunca duplicado).
 * Lo que quedó es un spacer y el pill de estado. No agregarle cosas.
 */
import { useShell } from './use-shell.ts'

export function Header() {
  const shell = useShell()
  const running = shell.running

  return (
    <>
      <span className="spacer" />
      <div className="status-badge" id="statusBadge" data-state={running ? 'running' : 'idle'}>
        <span className="dot" />
        <span className="txt">{running ? 'RUNNING' : 'IDLE'}</span>
      </div>
    </>
  )
}
