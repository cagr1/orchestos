/** Header (UI.12.2) — la barra global del shell. */
import { useShell } from './use-shell.ts'
import { Icon } from '../../lib/icons.tsx'
import { shellApi } from './shell-api.ts'

export function Header() {
  const shell = useShell()
  const api = shellApi()

  return (
    <div className="shell-header-inner">
      <div className="shell-header-left">
        <div className="shell-wordmark" aria-label="OrchestOS">
          <span>Orchest</span><span>OS</span>
        </div>
        <HeaderButton id="navSearchBtn" icon="search" onClick={() => api?.openCommandPalette()} />
        <HeaderButton id="navCollapseBtn" icon="panelLeft" onClick={() => api?.toggleSidebar()} />
      </div>
      {shell.activeProjectName && (
        <div className="shell-project-context">
          <Icon name="folderClosed" />
          <span>{shell.activeProjectName}</span>
        </div>
      )}
      <HeaderButton
        id="rpToggle"
        icon="panelRight"
        active={shell.inspector !== null}
        onClick={() => (shell.inspector ? api?.closeInspector() : api?.openInspectorTool())}
      />
    </div>
  )
}

function HeaderButton({
  id,
  icon,
  active = false,
  onClick,
}: {
  id: string
  icon: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button id={id} type="button" className={`shell-header-button${active ? ' active' : ''}`} onClick={onClick}>
      <Icon name={icon} />
    </button>
  )
}
