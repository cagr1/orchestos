/**
 * Riel izquierdo (UI.3, Mes 30) — reemplaza `buildNav()` de `app.js`.
 *
 * POR QUÉ CONSERVA LAS CLASES CSS VANILLA, y no se reescribe a Tailwind como los
 * componentes de UI.2. Las 4 reglas de diseño de v0.12 —las que se descubrieron a los
 * golpes, en dos rondas, con un screenshot de Carlos de por medio— **están implementadas
 * en CSS, no en JS**. El hover-swap del logo por el botón panel-left, por ejemplo, es
 * `.app[data-sidebar="collapsed"] .sidebar-toprow:hover .sidebar-toprow-logo { display: none }`:
 * CSS puro, sin una línea de JavaScript. Reescribir esas ~460 líneas a Tailwind, en el
 * componente que está SIEMPRE en pantalla y que concentra los bugs históricos del proyecto,
 * sería tomar todo el riesgo junto sin ninguna necesidad — y sin poder distinguir después
 * si algo se rompió por React o por el CSS nuevo.
 *
 * Entonces UI.3 migra **la estructura y el comportamiento**; el CSS probado se queda tal
 * cual y sigue resolviendo las 4 reglas. Reducirlo a tokens es literalmente el trabajo de
 * UI.5 ("`screens.css`/`styles.css` reducidos a tokens"), donde además ya no habrá vanilla
 * compitiendo por las mismas clases.
 *
 * SCOPE-LOCK: el botón de "modo avanzado" y el flag `localStorage['orchestos-mode']` se
 * migran TAL CUAL, aunque UI.7 los vaya a borrar. UI.3 tiene prohibido tocar navegación
 * (regla explícita de PLAN.md); si aparece la tentación, se anota para UI.7 y se sigue.
 */

import { useT } from '../../lib/i18n.ts'
import { Icon, RawIcon } from '../../lib/icons.tsx'
import { type NavEntry, shellApi } from './shell-api.ts'
import { useShell } from './use-shell.ts'

export function Sidebar() {
  const shell = useShell()
  const t = useT()
  const api = shellApi()
  const nav: NavEntry[] = api?.nav ?? []

  const mainNav = nav.filter((n) => n.id !== 'settings')
  const bottomNav = nav.filter((n) => n.id === 'settings')

  // El atajo se muestra según la plataforma, igual que en vanilla.
  const kbdHint = navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'
  const isBright = document.documentElement.getAttribute('data-theme') === 'bright'
  const logoSrc = `assets/${isBright ? 'logo_black' : 'logo_white'}.png`

  const modeTipKey = shell.advanced ? 'nav.mode.disable' : 'nav.mode.enable'

  return (
    <>
      <div className="sidebar-toprow">
        {/* El swap logo <-> botón es 100% CSS (regla 4): los dos elementos están SIEMPRE
            en el DOM y el `:hover` decide cuál se ve. Si esto se resolviera en JS, el
            markup cambiaría al pasar el mouse — el gate lo verifica comparando el
            outerHTML antes y después del hover. */}
        <img className="sidebar-toprow-logo" src={logoSrc} alt="OrchestOS" aria-hidden="true" />
        <b className="sidebar-brand-text">
          Orchest<span>OS</span>
        </b>
        <div className="sidebar-toprow-icons">
          <NavButton
            id="navSearchBtn"
            className="sidebar-toprow-btn sidebar-search-btn"
            tip={`${t('nav.search')} (${kbdHint})`}
            onActivate={() => api?.openCommandPalette()}
          >
            <Icon name="search" />
          </NavButton>
          <NavButton
            id="navCollapseBtn"
            className="sidebar-toprow-btn"
            tip={t(shell.sidebarExpanded ? 'nav.sidebar.collapse' : 'nav.sidebar.expand')}
            onActivate={() => api?.toggleSidebar()}
          >
            <Icon name="panelLeft" />
          </NavButton>
        </div>
      </div>

      <div className="nav-sep" />

      {mainNav.map((entry) => (
        <NavIcon
          key={entry.id}
          entry={entry}
          shellScreen={shell.screen}
          advanced={shell.advanced}
          skillsCount={shell.skillsCount}
        />
      ))}

      <div className="grow" />

      <NavButton
        id="navModeBtn"
        className={`nav-icon nav-mode-btn${shell.advanced ? ' active' : ''}`}
        tip={t(modeTipKey)}
        onActivate={() => api?.toggleAdvanced()}
      >
        <span className="nav-ic">
          <Icon name="sliders" />
        </span>
        <span className="nav-label">{t(modeTipKey)}</span>
      </NavButton>

      {bottomNav.map((entry) => (
        <NavIcon
          key={entry.id}
          entry={entry}
          shellScreen={shell.screen}
          advanced={shell.advanced}
          skillsCount={shell.skillsCount}
        />
      ))}
    </>
  )
}

function NavIcon({
  entry,
  shellScreen,
  advanced,
  skillsCount,
}: {
  entry: NavEntry
  shellScreen: string
  advanced: boolean
  skillsCount: number
}) {
  const t = useT()
  const api = shellApi()
  // Los ítems de operador solo existen en modo avanzado: en vanilla `navItem()` devolvía
  // string vacío. No llevan badge "adv" — se quitó en Mes 22/F2 por redundante.
  if (entry.operator && !advanced) return null

  return (
    <div
      className={`nav-icon${entry.operator ? ' operator visible' : ''}${shellScreen === entry.id ? ' active' : ''}`}
      data-nav={entry.id}
      data-tip={t(entry.key)}
      role="button"
      tabIndex={0}
      onClick={() => api?.go(entry.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          api?.go(entry.id)
        }
      }}
    >
      <span className="nav-ic">
        <RawIcon svg={entry.icon} />
        {entry.badge && (
          <span className="nav-count-badge" data-count={entry.id}>
            {skillsCount}
          </span>
        )}
      </span>
      <span className="nav-label">{t(entry.key)}</span>
    </div>
  )
}

/**
 * Botón del riel. Sigue siendo un `<div role="button">` y no un `<button>`, a propósito:
 * el CSS del shell selecciona por `.sidebar-toprow-btn`/`.nav-icon` y un `<button>` real
 * arrastraría estilos de user-agent (fondo, borde, font) que habría que resetear — y el
 * reset de Tailwind está desactivado en este proyecto justamente para no tocar el vanilla.
 * El comportamiento de teclado (Enter/Espacio), que el `<button>` daría gratis, se
 * implementa acá igual que lo hacía `buildNav()`.
 */
function NavButton({
  id,
  className,
  tip,
  onActivate,
  children,
}: {
  id: string
  className: string
  tip: string
  onActivate: () => void
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={className}
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
      {children}
    </div>
  )
}
