/**
 * Store imperativo de toasts (UI.2, Mes 30).
 *
 * Por qué un store fuera de React y no un contexto: los 71 llamadores de `showToast()`
 * son código vanilla — handlers de `screens-ops.js`, `screens-core.js` y `app.js` — que
 * no viven dentro de ningún árbol de React y nunca van a poder usar un hook. Necesitan
 * una función global que puedan llamar desde cualquier lado, en cualquier momento.
 *
 * La forma es la misma que ya usa el puente de i18n: estado fuera de React + suscripción
 * con `useSyncExternalStore`. Así el host es un componente normal y no hace falta ningún
 * truco para empujarle datos desde afuera.
 */

export interface ToastItem {
  id: number
  message: string
  variant: 'default' | 'error'
}

/** Igual que el toast vanilla: 3 segundos. */
export const TOAST_DURATION_MS = 3000

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  // Se reemplaza el array en vez de mutarlo: `useSyncExternalStore` compara por
  // identidad y una mutación in-place no dispararía el repintado.
  for (const listener of listeners) listener()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): ToastItem[] {
  return items
}

export function pushToast(message: string, variant: ToastItem['variant'] = 'default'): number {
  const id = nextId++
  items = [...items, { id, message, variant }]
  emit()
  return id
}

export function dismissToast(id: number): void {
  items = items.filter((item) => item.id !== id)
  emit()
}

/** Solo para el gate en vivo y los tests: vaciar la cola. */
export function clearToasts(): void {
  items = []
  emit()
}
