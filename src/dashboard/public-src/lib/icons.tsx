/**
 * Íconos del shell (UI.3, Mes 30).
 *
 * DECISIÓN: no se portan. `ICON` (`data.js`) tiene 36 SVG como strings y el dashboard
 * vanilla los sigue usando en las 11 pantallas. Copiarlos a componentes React crearía dos
 * fuentes de verdad para el mismo dibujo, que se desincronizan el día que alguien retoque
 * uno — el patrón exacto que ya le costó 11 días de commits sin chequear al proyecto
 * (el hook de git desincronizado de su fuente). Mientras el vanilla siga vivo, hay UN
 * catálogo de íconos y React lo lee por el puente.
 *
 * Cuando UI.5 borre el `render()`/`wire()` vanilla, el catálogo se muda acá y este archivo
 * pasa a ser la fuente. No antes.
 *
 * Sobre `dangerouslySetInnerHTML`: el contenido no es entrada de usuario ni viene de la red
 * — son literales SVG del propio bundle del dashboard, definidos en `data.js`. Es el mismo
 * markup que el vanilla ya inyecta con `innerHTML` en cada repintado.
 */

interface IconCatalog {
  [name: string]: string | undefined
}

function catalog(): IconCatalog {
  return (window as unknown as { OrchestOS?: { icons?: IconCatalog } }).OrchestOS?.icons ?? {}
}

export function Icon({ name, className }: { name: string; className?: string }) {
  const svg = catalog()[name]
  if (!svg) return null
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** Para los casos donde el ícono ya viene resuelto como string (los ítems de `NAV`). */
export function RawIcon({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}
