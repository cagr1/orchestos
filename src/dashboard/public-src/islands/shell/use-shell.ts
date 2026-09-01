/**
 * Suscripción del shell al estado que empuja el vanilla (UI.3, Mes 30).
 *
 * Tercer uso del mismo patrón —estado fuera de React + `useSyncExternalStore`— después del
 * puente de i18n y del store de toasts. Ya no es una solución puntual: es LA forma de
 * cruzar la frontera vanilla -> React en este proyecto.
 */
import { useSyncExternalStore } from 'react'
import { getShellState, type ShellState, subscribeShell } from '../../lib/shell-store.ts'

export function useShell(): ShellState {
  return useSyncExternalStore(subscribeShell, getShellState, getShellState)
}
