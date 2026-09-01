/**
 * Combobox del design system (UI.2, Mes 30) — trigger + popover + lista buscable.
 *
 * Sale de extraer la parte genérica de `ModelCombo` (UI.1), que era el único combobox
 * del dashboard. Se extrae ahora, y no cuando aparezca el segundo caso, porque el ítem
 * UI.2 es justamente "los componentes que se repiten": el selector de agente, el de
 * proyecto y el de sesión que llegan en UI.6 son el mismo control con otros datos.
 *
 * Queda como el ÚNICO camino para elegir de una lista larga
 * ([[reference-model-combo-pattern]]): siempre buscable, nunca un `<select>` nativo con
 * cientos de opciones. La regla ahora la hace cumplir el componente, no la disciplina.
 *
 * El filtrado replica el del combo vanilla: substring sobre `searchText` (que junta id y
 * nombre), sin reordenar por score — quien mira la lista espera el orden del catálogo.
 */
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils.ts'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command.tsx'
import { Popover, PopoverContent, PopoverTrigger } from './popover.tsx'

export interface ComboboxOption {
  /** Valor real que se reporta al elegir. */
  value: string
  /** Texto visible. */
  label: string
  /** Sobre qué texto filtra la búsqueda; por defecto, el label. */
  searchText?: string
  /** Contenido a la derecha del ítem (un precio, un badge). */
  hint?: ReactNode
  /** Encabezado del grupo al que pertenece; sin esto, va suelto arriba de todo. */
  group?: string
}

export interface ComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  /** Texto del trigger. Se separa de `value` porque el label puede necesitar formato. */
  triggerLabel: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  /** Apertura controlada. Sirve para cargar datos recién cuando el panel se abre. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Combobox({
  value,
  onValueChange,
  options,
  triggerLabel,
  searchPlaceholder,
  emptyText = 'No results',
  disabled,
  className,
  contentClassName,
  open,
  onOpenChange,
}: ComboboxProps) {
  // Se preserva el orden de llegada de los grupos: `Map` itera por inserción, así que
  // el catálogo manda y no hace falta un orden alfabético que nadie pidió.
  const groups = new Map<string, ComboboxOption[]>()
  for (const option of options) {
    const key = option.group ?? ''
    const bucket = groups.get(key)
    if (bucket) bucket.push(option)
    else groups.set(key, [option])
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={triggerLabel}
          aria-label={triggerLabel}
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5',
            'font-mono text-xs text-foreground transition-colors hover:bg-secondary',
            'data-[state=open]:border-primary disabled:cursor-not-allowed disabled:opacity-60',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
          <ChevronDown />
        </button>
      </PopoverTrigger>

      <PopoverContent className={cn('p-0', contentClassName)}>
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {[...groups].map(([heading, groupOptions]) => (
              <CommandGroup key={heading || '__ungrouped__'} heading={heading || undefined}>
                {groupOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    // cmdk filtra sobre este string; se le mete el texto de búsqueda para
                    // que matchee por id además de por label, como hacía el combo vanilla.
                    value={option.searchText ?? option.label}
                    title={option.label}
                    onSelect={() => onValueChange(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                      {option.hint}
                      {option.value === value && <Check />}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-[var(--text-faint)]"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Check() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="shrink-0 text-primary"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
