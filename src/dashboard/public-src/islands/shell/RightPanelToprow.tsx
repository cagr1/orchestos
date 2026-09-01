/**
 * Fila superior del aside derecho (UI.3, Mes 30) — reemplaza `buildRightPanelToprow()`.
 *
 * ACÁ VIVE LA REGLA 1 (anclaje a borde fijo), y el porqué es sutil: el toggle va SIEMPRE
 * pegado al borde derecho de la fila (`margin-left:auto`, en el CSS de `#rpToggle`), nunca
 * al izquierdo. El borde derecho del aside es el borde derecho de la PANTALLA, así que no
 * se mueve al expandir o colapsar; el izquierdo sí, porque es por donde el aside crece.
 * Anclarlo al izquierdo —como estaba antes— lo hacía viajar. Los botones de
 * explorer/terminal/diff van ANTES en el DOM, a su izquierda: esos aparecen y desaparecen,
 * el toggle no.
 *
 * Por eso el orden del JSX de abajo NO es cosmético: el toggle tiene que ser el último
 * hijo. Es exactamente el tipo de detalle que se pierde en una migración y que el gate
 * mide (distancia al borde derecho, igual en ambos estados).
 *
 * El CONTENIDO del panel (Explorer, Term, Diff) sigue en vanilla a propósito: es contenido
 * de pantalla, no shell, y le toca en UI.4.
 */

import { useT } from '../../lib/i18n.ts'
import { Icon } from '../../lib/icons.tsx'
import { shellApi } from './shell-api.ts'
import { useShell } from './use-shell.ts'

export function RightPanelToprow() {
  const shell = useShell()
  const t = useT()
  const api = shellApi()
  const open = shell.rightPanelOpen

  return (
    <>
      {open && (
        <>
          <IconBtn
            id="rpTabExplorer"
            icon="folder"
            tip={t('rp.tab.explorer')}
            active={shell.rightPanelTab === 'explorer'}
            onActivate={() => api?.setRightPanelTab('explorer')}
          />
          <IconBtn
            id="rpTabTerminal"
            icon="term"
            tip={t('rp.tab.terminal')}
            active={shell.rightPanelTab === 'terminal'}
            onActivate={() => api?.setRightPanelTab('terminal')}
          />
          <IconBtn
            id="rpTabDiff"
            icon="diff"
            tip={t('rp.tab.diff')}
            active={shell.rightPanelTab === 'diff'}
            onActivate={() => api?.setRightPanelTab('diff')}
          />
        </>
      )}
      {/* SIEMPRE el último: ver la nota de anclaje arriba. */}
      <IconBtn
        id="rpToggle"
        icon="panelRight"
        tip={t(open ? 'rp.toggle.close' : 'rp.toggle.open')}
        active={open}
        onActivate={() => api?.toggleRightPanel()}
      />
    </>
  )
}

function IconBtn({
  id,
  icon,
  tip,
  active,
  onActivate,
}: {
  id: string
  icon: string
  tip: string
  active: boolean
  onActivate: () => void
}) {
  return (
    <div
      id={id}
      className={`header-icon-btn${active ? ' active' : ''}`}
      data-tip={tip}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
    >
      <Icon name={icon} />
    </div>
  )
}
