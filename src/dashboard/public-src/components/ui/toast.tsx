/**
 * shadcn/ui — Toast (sobre Radix). Vendorizado y ajustado al look del toast vanilla
 * (`.toast` en `styles.css`): centrado abajo, `--surface-2`, borde, 13px, y la variante
 * de error que pinta borde y texto con `--error`.
 *
 * Qué gana respecto del vanilla, y es la razón de usar la librería en vez de copiar el
 * `div` de antes:
 *  - El viewport es una región `aria-live`: un lector de pantalla anuncia el mensaje.
 *    El toast vanilla era un `div` mudo que nadie que no viera la pantalla percibía.
 *  - Varios toasts se apilan en vez de superponerse en el mismo punto fijo. El vanilla
 *    creaba un `div` con `position: fixed` en la misma coordenada para cada llamada, así
 *    que dos avisos seguidos se dibujaban uno encima del otro. Es una corrección, no un
 *    rediseño: nadie decidió que se taparan.
 *  - Descartable con swipe y con Esc.
 */
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cn } from '../../lib/utils.ts'

export const ToastProvider = ToastPrimitive.Provider

export function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        // `bottom: 48px` y centrado: las mismas coordenadas exactas del toast vanilla,
        // para que la migración no mueva de lugar un elemento que la gente ya ubica.
        'fixed bottom-12 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Toast({ className, variant = 'default', ...props }:
  React.ComponentProps<typeof ToastPrimitive.Root> & { variant?: 'default' | 'error' }) {
  return (
    <ToastPrimitive.Root
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-md border px-5 py-2.5 text-[13px]',
        'shadow-[0_4px_16px_rgba(0,0,0,.25)] transition-all',
        'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
        'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
        variant === 'error'
          ? 'border-destructive bg-muted text-destructive'
          : 'border-border bg-muted text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export const ToastTitle = ToastPrimitive.Title
export const ToastClose = ToastPrimitive.Close
