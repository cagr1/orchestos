/**
 * shadcn/ui — Dialog (sobre Radix). El overlay y el contenido se renderizan en un
 * portal a `<body>`, por eso llevan `z-[300]`: deben quedar sobre el scrim vanilla
 * (`z-index: 200`) pero debajo de los toasts (`z-index: 9999`).
 *
 * El ancho máximo, el radio y el blur espejan `.modal` y `.modal-scrim`; el estado
 * de Radix conserva además la transición de entrada/salida sin CSS adicional.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils.ts'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      {/* Las transiciones van con utilidades que EXISTEN. La primera pasada usaba
          `animate-out`/`fade-out-0`/`zoom-out-95`, que vienen del plugin
          `tailwindcss-animate` — no instalado acá: compilaban sin error y no generaban
          una sola regla CSS. Verificado sobre el bundle: 0 ocurrencias. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-[rgba(1,4,9,.66)] backdrop-blur-[2px] opacity-0 transition-opacity duration-200 data-[state=open]:opacity-100" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[300] grid w-[440px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-[12px] border border-border bg-card text-card-foreground shadow-[0_24px_70px_rgba(0,0,0,.6)] outline-none',
          'translate-y-2 opacity-0 transition-all duration-200 data-[state=open]:translate-y-0 data-[state=open]:opacity-100',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2.5 border-b border-border px-[18px] py-4', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex justify-end gap-2.5 border-t border-border px-[18px] py-3.5', className)}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('flex-1 text-[15px] font-semibold', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}
