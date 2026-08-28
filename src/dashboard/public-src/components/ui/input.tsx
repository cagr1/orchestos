/**
 * shadcn/ui — Input. La altura, el padding y la tipografía siguen a `.m-field`
 * y `.model-combo-search` para que un formulario migrado no cambie de ritmo visual.
 *
 * El fondo usa `bg-background` en vez de un color literal: los inputs vanilla
 * descansan sobre `--bg`, y el token permite conservar esa relación en cada tema.
 */
import { cn } from '../../lib/utils.ts'

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-auto w-full rounded-[var(--radius)] border border-border bg-background px-[11px] py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
