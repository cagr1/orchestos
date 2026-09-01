/**
 * Host de toasts (UI.2, Mes 30) — el primer componente del design system con adopción
 * REAL e inmediata: reemplaza `showToast()`, que el dashboard vanilla llama desde 71
 * lugares.
 *
 * Se sigue la misma estrategia que probó UI.1 con el combobox: **se cambia el cuerpo,
 * no los llamadores**. `window.showToast(msg, type)` mantiene exactamente la misma
 * firma, así que los 71 call sites no se tocan; por dentro ahora empuja al store y esto
 * lo pinta.
 *
 * Este host NO es una isla `[data-island]` como las demás, y es a propósito: las islas
 * declaradas en el HTML viven dentro de `#main`, que `App.rerender()` borra entero cada
 * 30 segundos. Un toast disparado justo antes de un repintado desaparecería a mitad de
 * camino. Por eso el host se monta una sola vez en un contenedor propio colgado de
 * `<body>`, fuera del alcance de cualquier repintado vanilla, y vive toda la sesión.
 */
import { useSyncExternalStore } from 'react'
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '../components/ui/toast.tsx'
import { dismissToast, getToasts, subscribeToasts, TOAST_DURATION_MS } from '../lib/toast-store.ts'

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  return (
    <ToastProvider duration={TOAST_DURATION_MS} swipeDirection="down">
      {toasts.map((item) => (
        <Toast
          key={item.id}
          variant={item.variant}
          open
          // Radix avisa acá tanto por el timeout como por swipe/Esc/click en cerrar:
          // un solo camino de salida, en vez de los dos `setTimeout` encadenados que
          // tenía el toast vanilla.
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id)
          }}
        >
          <ToastTitle className="font-normal">{item.message}</ToastTitle>
          <ToastClose
            aria-label="Close"
            className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </ToastClose>
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
