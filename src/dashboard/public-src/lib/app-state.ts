/**
 * Puente de estado para las PANTALLAS migradas (UI.4, Mes 30).
 *
 * Es el cuarto uso del mismo patrón (i18n, toasts, shell, y ahora esto), pero resuelve un
 * problema distinto de los anteriores, y vale la pena entender por qué:
 *
 * El shell (UI.3) recibe un puñado de campos concretos que `syncNav()` le empuja. Una
 * pantalla, en cambio, lee CUALQUIER cosa de `state` — `specs`, `specsStatus`, `openSpec`,
 * `archOpen`, `bulkSelected`… — y cada una lee un subconjunto distinto. Enumerarlos en un
 * store tipado por pantalla sería mantener once copias del estado que ya existe.
 *
 * Entonces acá no se COPIA estado: solo se avisa que cambió. El componente lee `window.state`
 * directamente, que es exactamente lo que hacía el `render(st)` vanilla al que reemplaza. El
 * acoplamiento es deliberado y temporal: mientras `app.js` siga siendo el dueño de los datos y
 * de los fetch, duplicarlos en React crearía dos fuentes de verdad — el problema que este mes
 * viene evitando en cada ítem. Cuando UI.5 borre el vanilla, el estado se muda a React y este
 * archivo desaparece.
 *
 * La señal de "cambió algo" ya existía: `App.rerender()`. Antes significaba "repintá el DOM";
 * para una pantalla React significa "volvé a leer el estado".
 */
import { useSyncExternalStore } from 'react'

let version = 0
const listeners = new Set<() => void>()

/** Lo llama `App.rerender()` a través del puente. */
export function bumpAppState(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Devuelve un número que cambia cada vez que el estado del dashboard se tocó. No devuelve el
 * estado en sí a propósito: `window.state` se muta in-place, así que cualquier snapshot que
 * se devolviera sería el mismo objeto y `useSyncExternalStore` no vería el cambio. El
 * componente usa esto como disparador y lee `appState()` para los datos.
 */
export function useAppVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version)
}

/** El `state` de `app.js`. Tipado como índice: cada pantalla sabe qué campos usa. */
export function appState(): Record<string, unknown> {
  return (window as unknown as { state?: Record<string, unknown> }).state ?? {}
}
