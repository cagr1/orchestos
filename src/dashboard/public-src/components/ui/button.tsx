/**
 * shadcn/ui — Button. Vendorizado para que las variantes compartan los tokens del
 * dashboard y conserven la densidad visual del botón vanilla durante la migración.
 *
 * `asChild` delega el elemento raíz a Radix Slot: así un enlace o un botón de
 * navegación puede recibir exactamente la misma API visual sin renderizar un botón
 * interactivo dentro de otro elemento interactivo.
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils.ts'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[var(--radius)] border px-[13px] py-[7px] text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0',
  {
    variants: {
      // Los hovers apuntan a --surface-2 -> --surface-hi, que es el salto real del CSS
      // vanilla (`.btn` vive en --surface-2 y su :hover sube a --surface-hi).
      // CUIDADO al tocar esto: `--color-secondary` y `--color-accent` mapean AMBOS a
      // --surface-hi (ver la nota de roles en styles/ui.css), así que un
      // `bg-secondary hover:bg-accent` compila sin error y no cambia nada al pasar el
      // mouse. Es el bug que tuvo la primera pasada de este archivo.
      variant: {
        default:
          'border-transparent bg-primary font-semibold text-primary-foreground hover:bg-primary/88',
        // El `.btn` neutro del dashboard: fondo --surface-2, hover --surface-hi.
        secondary: 'border-border bg-muted text-foreground hover:bg-secondary hover:border-[#444c56]',
        ghost: 'border-border bg-transparent text-foreground hover:bg-muted',
        // Espeja `.btn.danger`: los tokens --error-dim/--success-dim ya son un color-mix
        // sobre el color semántico, así que se usan tal cual en vez de re-derivarlos.
        destructive: 'border-[var(--error-dim)] bg-[var(--error-dim)] text-destructive hover:bg-[color-mix(in_oklab,var(--error)_24%,transparent)]',
        // `.btn.success` existe en el CSS vanilla y faltaba acá.
        success: 'border-[var(--success-dim)] bg-[var(--success-dim)] text-[var(--success)] hover:bg-[color-mix(in_oklab,var(--success)_26%,transparent)]',
        // NO hay variante `outline`, y es a propósito: en shadcn `ghost` se distingue de
        // `outline` por no tener borde, pero el `.btn.ghost` de OrchestOS SÍ lo tiene
        // (lo hereda de `.btn` y solo pisa el fondo). Con esta paleta las dos variantes
        // daban exactamente el mismo botón — lo detectó el gate en vivo al medir que las
        // variantes fueran visualmente distintas. Se deja una sola en vez de dos nombres
        // para lo mismo, que es como se empieza a usar cualquiera de los dos al azar.
      },
      size: {
        sm: 'gap-[5px] px-[9px] py-1 text-xs [&_svg]:size-[13px]',
        default: '',
        icon: 'size-9 p-0 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
