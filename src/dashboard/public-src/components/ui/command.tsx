/**
 * shadcn/ui — Command (sobre `cmdk`). Vendorizado y ajustado a los tokens de OrchestOS.
 *
 * Es el patrón "combobox buscable" que exige [[reference-model-combo-pattern]]: input de
 * búsqueda + lista filtrada + navegación por teclado, resuelto por la librería en vez de
 * a mano. `cmdk` trae el filtrado, el ítem activo, y flechas/Enter/Home/End de fábrica.
 */
import { Command as CommandPrimitive } from 'cmdk'
import { cn } from '../../lib/utils.ts'

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}
      {...props}
    />
  )
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      className={cn(
        'w-full border-0 border-b border-border bg-card px-2.5 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-[240px] overflow-y-auto overflow-x-hidden p-1', className)}
      {...props}
    />
  )
}

export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="px-2 py-4 text-center text-xs text-muted-foreground"
      {...props}
    />
  )
}

export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-0.5',
        '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider',
        '[&_[cmdk-group-heading]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-foreground outline-none',
        // `data-[selected=true]` es el ítem activo de cmdk — el mismo que mueven las
        // flechas. Con esto el hover del mouse y el foco del teclado se pintan igual,
        // que es justo lo que el combo vanilla resolvía con dos reglas separadas.
        'data-[selected=true]:bg-[var(--accent-soft)]',
        className,
      )}
      {...props}
    />
  )
}
