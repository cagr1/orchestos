/**
 * Registro de islas React dentro del dashboard vanilla (UI.0, Mes 30).
 *
 * Por qué existe — hallazgo del 2026-08-25 al arrancar UI.0, NO estaba en el plan:
 * `App.rerender()` (app.js:432) hace `main.innerHTML = sc.render(state)`. Eso borra
 * los nodos del DOM sin avisarle a nadie. Una isla React montada ahí adentro queda
 * con su root apuntando a un nodo huérfano: React no se entera, sigue suscrito a
 * stores y timers, y en el siguiente rerender se monta OTRA copia. Y `rerender()` no
 * se llama solo al navegar: lo dispara el poll de 30s, el cambio de idioma y el de
 * tema. Sin este registro, cada isla dentro de `#main` acumula un leak por poll.
 *
 * Contrato:
 *  - El HTML vanilla declara un contenedor `<div data-island="nombre"></div>`.
 *  - Acá se registra el componente para ese nombre con `registerIsland()`.
 *  - `mountIslands(root)` monta lo que encuentre; `unmountIslandsIn(node)` desmonta
 *    ANTES de que el DOM se destruya.
 *  - `installIslandBridge()` parcha `App.rerender()` para hacer las dos cosas en el
 *    orden correcto, así ningún llamador de rerender() tiene que acordarse.
 *
 * Los props llegan por `data-props` (JSON) en el contenedor.
 */
import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'

type IslandComponent = ComponentType<Record<string, unknown>>

const registry = new Map<string, IslandComponent>()
const mounted = new Map<Element, Root>()

export function registerIsland(name: string, component: IslandComponent): void {
  registry.set(name, component)
}

function readProps(el: Element): Record<string, unknown> {
  const raw = el.getAttribute('data-props')
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    // Un data-props roto no debe tumbar el dashboard entero: la isla se monta sin props.
    console.warn('[islands] data-props inválido en', el)
    return {}
  }
}

/** Monta toda isla registrada bajo `root` que todavía no tenga un root vivo. */
export function mountIslands(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>('[data-island]')
  for (const el of nodes) {
    if (mounted.has(el)) continue
    const name = el.getAttribute('data-island')
    if (!name) continue
    const Component = registry.get(name)
    if (!Component) {
      console.warn(`[islands] isla no registrada: "${name}"`)
      continue
    }
    const r = createRoot(el)
    mounted.set(el, r)
    r.render(createElement(Component, readProps(el)))
  }
}

/**
 * Desmonta las islas que viven dentro de `node` (incluido `node` mismo).
 * Se llama ANTES de reemplazar el DOM, no después: una vez que el nodo dejó de estar
 * en el documento ya no se lo puede encontrar por query.
 */
export function unmountIslandsIn(node: Element | Document): void {
  for (const [el, root] of [...mounted]) {
    if (node === el || node.contains(el)) {
      root.unmount()
      mounted.delete(el)
    }
  }
}

/** Desmonta cualquier isla cuyo contenedor ya no esté en el documento (red de seguridad). */
export function pruneDetachedIslands(): void {
  for (const [el, root] of [...mounted]) {
    if (!document.contains(el)) {
      root.unmount()
      mounted.delete(el)
    }
  }
}

/** Solo para tests/diagnóstico en vivo: cuántas islas hay montadas ahora mismo. */
export function mountedIslandCount(): number {
  return mounted.size
}

type AppLike = { rerender: () => void }

/**
 * Envuelve `App.rerender()` para que el ciclo sea:
 *   desmontar → repintar vanilla → `beforeMount` → montar.
 *
 * `beforeMount` es el punto donde el llamador puede reinsertar contenedores que el
 * `innerHTML = …` acaba de borrar, antes de que se monte nada. Existe para que no haga
 * falta envolver `rerender()` una segunda vez desde afuera: dos wrappers encadenados
 * son exactamente el tipo de indirección que después nadie entiende.
 *
 * Idempotente: si ya se instaló, no vuelve a envolver.
 */
export function installIslandBridge(app: AppLike, beforeMount?: () => void): void {
  const flagged = app as AppLike & { __islandBridge?: boolean }
  if (flagged.__islandBridge) return
  flagged.__islandBridge = true

  const original = app.rerender.bind(app)
  app.rerender = () => {
    const main = document.getElementById('main')
    if (main) unmountIslandsIn(main)
    original()
    pruneDetachedIslands()
    beforeMount?.()
    mountIslands(document)
  }
}
