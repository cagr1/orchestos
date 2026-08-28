/**
 * UI.1 (Mes 30) — el combobox de modelo, en React. Es el GATE DE ABORTAR del mes:
 * el componente exacto que costó horas en vanilla, rehecho sobre shadcn
 * (`Popover` de Radix + `Command` de cmdk).
 *
 * CONTRATO QUE NO SE PUEDE ROMPER — lo consumen 5 call sites que NO se tocan:
 * el valor se lee siempre con `document.getElementById(inputId).value`
 * ([[reference-model-combo-pattern]]). Por eso la isla sigue renderizando el mismo
 * `<input type="hidden" id={inputId}>`. Quien lee el valor no se entera de que
 * adentro ahora hay React: `screens-ops.js` (guardar routing), `app.js` (crear
 * tarea), `screens-core.js` (diagnose y draft) siguen igual, sin una línea de cambio.
 *
 * Y ese hidden input hace un segundo trabajo, menos obvio: `pendingVal()` en
 * `screens-ops.js:1208` lo lee **desde el DOM viejo, durante el render** para
 * conservar una selección sin guardar a través de un `App.rerender()`. Es la razón
 * por la que el registro de islas NO puede desmontar antes de repintar — ver la nota
 * de orden en `lib/islands.ts`.
 *
 * Paridad de comportamiento con `buildModelSelect()`, deliberada (migrar ≠ rediseñar):
 * mismo label, mismos grupos (locales primero), mismo badge `:free` por id y no por
 * precio 0 (hay meta-routers sin pricing real que no son gratis), mismo `allowEmpty`
 * para el QA judge, misma carga perezosa del catálogo al abrir.
 *
 * Única diferencia visible, y es una corrección: en vanilla el fondo `--accent-soft`
 * significaba a la vez "opción elegida" y "opción bajo el mouse" — la misma clase para
 * dos conceptos distintos. Con cmdk el fondo es el ítem **resaltado** (el que mueven las
 * flechas, compartido con el mouse) y la opción **elegida** se marca con un check. Sin
 * eso, navegar con teclado no se vería, que es el criterio 3 del gate.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../lib/i18n.ts'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.tsx'

export interface ModelInfo {
  id: string
  name?: string
  priceIn?: number
}

/**
 * Puente hacia el estado vanilla. Se expone desde `app.js` (`window.OrchestOS`) en vez
 * de dejar que React alcance sus internals: el catálogo de modelos son cientos de
 * entradas compartidas por hasta 5 combos en pantalla a la vez, así que pasarlo por
 * `data-props` los duplicaría en cada repintado.
 */
interface VanillaBridge {
  getModels: () => { cloud: ModelInfo[] | null; local: ModelInfo[] | null; known: ModelInfo[] }
  loadModels: () => Promise<void>
  modelLabelFor: (val: string, pool: ModelInfo[]) => string
}

function bridge(): VanillaBridge | null {
  return (window as unknown as { OrchestOS?: VanillaBridge }).OrchestOS ?? null
}

/** Sentinela para la opción "(auto)": cmdk no admite un `value` vacío. */
const EMPTY = '__orchestos_empty__'

export interface ModelComboProps {
  inputId: string
  value?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

export function ModelCombo(props: Record<string, unknown>) {
  const { inputId, value: initialValue, allowEmpty, emptyLabel } = props as unknown as ModelComboProps
  const t = useT()
  const api = bridge()

  const [value, setValue] = useState(initialValue ?? '')
  const [open, setOpen] = useState(false)
  // `tick` fuerza un repintado cuando el catálogo termina de cargar: vive en el estado
  // vanilla, que no es reactivo — no hay nada a lo que suscribirse.
  const [, setTick] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { cloud, local, known } = api?.getModels() ?? { cloud: null, local: null, known: [] }

  useEffect(() => {
    if (!open || !api) return
    let alive = true
    void api.loadModels().then(() => { if (alive) setTick((n) => n + 1) })
    return () => { alive = false }
  }, [open, api])

  const locals = useMemo(() => (Array.isArray(local) ? local : []), [local])

  /**
   * `cloud === null` significa que la carga falló: se cae al catálogo curado en vez de
   * mostrar una lista vacía. `cloud === []` significa "cargando" y deshabilita el trigger.
   */
  const isLoading = Array.isArray(cloud) && cloud.length === 0
  const cloudModels = useMemo<ModelInfo[]>(() => {
    const source = cloud === null ? known.map((m) => ({ ...m })) : (Array.isArray(cloud) ? cloud : [])
    // Un valor guardado que ya no está en el catálogo se antepone, o el combo mostraría
    // como elegido algo que no puede volver a seleccionarse.
    if (!value || cloud === null || source.some((m) => m.id === value)) return source
    return [{ id: value, name: value, priceIn: 0 }, ...source]
  }, [cloud, known, value])

  const isEmptyVal = !!allowEmpty && !value
  const label = isLoading
    ? t('common.loading')
    : isEmptyVal
      ? (emptyLabel || '—')
      : (api?.modelLabelFor(value, cloudModels) ?? value)

  function choose(next: string): void {
    setValue(next === EMPTY ? '' : next)
    setOpen(false)
  }

  return (
    <div className="model-combo relative max-w-[260px]">
      {/* El contrato con el mundo vanilla. `readOnly` porque React es el dueño del valor. */}
      <input type="hidden" id={inputId} value={value} readOnly />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={isLoading}
            title={label}
            aria-label={label}
            className={
              'flex w-full items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5 ' +
              'font-mono text-xs text-foreground transition-colors hover:bg-secondary ' +
              'data-[state=open]:border-primary disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <ChevronDown />
          </button>
        </PopoverTrigger>

        <PopoverContent className="p-0">
          {/* Filtro propio: se replican las reglas del combo vanilla — match por id O por
              nombre, substring simple, sin reordenar por score. */}
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0
            }
          >
            <CommandInput placeholder={t('chat.models.search')} />
            <CommandList>
              <CommandEmpty>No results</CommandEmpty>

              {allowEmpty && (
                <CommandItem value={EMPTY} onSelect={choose}>
                  <span className="min-w-0 flex-1 truncate">{emptyLabel || '—'}</span>
                  {isEmptyVal && <Check />}
                </CommandItem>
              )}

              {locals.length > 0 && (
                <CommandGroup heading={t('chat.local.group')}>
                  {locals.map((m) => {
                    const fullName = m.id.replace('ollama/', '')
                    return (
                      <CommandItem key={m.id} value={`${m.id} ${fullName}`} onSelect={() => choose(m.id)} title={fullName}>
                        <span className="min-w-0 flex-1 truncate">{fullName}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          {t('chat.local.free')}
                          {m.id === value && <Check />}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}

              <CommandGroup heading={locals.length > 0 ? t('chat.cloud.group') : undefined}>
                {cloudModels.map((m) => {
                  const fullName = m.name || m.id
                  // Badge por id (":free"), NO por priceIn === 0: hay meta-routers sin
                  // pricing real que caen en 0 y no son gratis (hallazgo #37).
                  const isFree = m.id.endsWith(':free')
                  return (
                    <CommandItem key={m.id} value={`${m.id} ${fullName}`} onSelect={() => choose(m.id)} title={fullName}>
                      <span className="min-w-0 flex-1 truncate">{fullName}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                        <span className={isFree ? 'font-semibold text-[var(--success)]' : 'text-muted-foreground'}>
                          {isFree ? t('chat.models.free') : `$${(m.priceIn ?? 0).toFixed(2)}/M`}
                        </span>
                        {m.id === value && <Check />}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className="shrink-0 text-[var(--text-faint)] transition-transform" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      className="shrink-0 text-primary" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
