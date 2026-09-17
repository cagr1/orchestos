/**
 * Fila superior del inspector contextual.
 *
 * El cierre queda anclado al borde derecho de la fila para que siempre sea accesible.
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
  const inspector = shell.inspector
  if (!inspector) return null
  const tool = inspector?.kind === 'tool'

  return (
    <>
      {tool && (
        <>
          <IconBtn
            id="rpTabExplorer"
            icon="folder"
            tip={t('rp.tab.explorer')}
            active={inspector.tab === 'explorer'}
            onActivate={() => api?.openInspectorTool('explorer')}
          />
          <IconBtn
            id="rpTabTerminal"
            icon="term"
            tip={t('rp.tab.terminal')}
            active={inspector.tab === 'terminal'}
            onActivate={() => api?.openInspectorTool('terminal')}
          />
          <IconBtn
            id="rpTabDiff"
            icon="diff"
            tip={t('rp.tab.diff')}
            active={inspector.tab === 'diff'}
            onActivate={() => api?.openInspectorTool('diff')}
          />
        </>
      )}
      {/* SIEMPRE el último: cierre anclado al borde derecho. */}
      <IconBtn
        id="rpClose"
        icon="x"
        tip={t('inspector.close')}
        active={false}
        onActivate={() => api?.closeInspector()}
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
    <button
      id={id}
      className={`header-icon-btn${active ? ' active' : ''}`}
      data-tip={tip}
      type="button"
      aria-label={tip}
      onClick={onActivate}
    >
      <Icon name={icon} />
    </button>
  )
}
