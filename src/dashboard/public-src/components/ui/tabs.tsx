/**
 * shadcn/ui — Tabs (sobre Radix). Wrappers chicos, para reutilizar la accesibilidad y el
 * teclado de Radix sin inventar una convención de clases por pantalla.
 *
 * OJO con el estilo: NO se usa el segmented control que trae shadcn por defecto (una
 * barra con fondo `muted` y la pestaña activa en blanco). El dashboard YA tiene su patrón
 * de pestañas — `.filter-tab` en `screens.css`: pills de radio 20px, transparentes con
 * borde, y la activa en `--accent` sólido. Se espeja ese, porque el objetivo del Mes 30
 * es cambiar la tecnología sin cambiar el aspecto; meter un segundo lenguaje visual para
 * lo mismo es justo lo que la migración tiene que evitar. La primera pasada de este
 * archivo traía el default de shadcn y se veía como un injerto.
 */
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils.ts'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        // Espeja `.filter-tab`: 5px/13px, radio 20px, 12.5px, borde e inactivo en muted.
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] border border-border',
        'bg-transparent px-[13px] py-[5px] text-[12.5px] text-muted-foreground outline-none',
        'transition-colors hover:bg-muted hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-3 outline-none', className)} {...props} />
}
