/**
 * shadcn/ui — Popover (sobre Radix). Vendorizado, como manda shadcn: el código es
 * nuestro y se ajusta a los tokens de OrchestOS (ver `styles/ui.css`).
 *
 * Lo relevante para el Mes 30: el contenido va en un **portal a `document.body`**.
 * Eso resuelve de fábrica la regla 3 de diseño de v0.12 — un panel flotante nunca
 * queda recortado por un `overflow:hidden` de un ancestro — que en vanilla había que
 * cuidar a mano moviendo el overflow al nivel más interno.
 */
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/utils.ts'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-[280px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_rgba(0,0,0,.45)] outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
