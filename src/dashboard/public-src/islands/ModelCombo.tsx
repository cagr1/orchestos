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
 *
 * UI.2: la mecánica de trigger + popover + lista buscable se mudó al `Combobox` del
 * design system. Acá queda SOLO lo que es propio de elegir un modelo: de dónde sale el
 * catálogo, cómo se arma el label, el badge de precio y el contrato del hidden input.
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/i18n.ts'
import { Combobox, type ComboboxOption } from '../components/ui/combobox.tsx'

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

  const options = useMemo<ComboboxOption[]>(() => {
    const list: ComboboxOption[] = []
    if (allowEmpty) list.push({ value: EMPTY, label: emptyLabel || '—' })
    for (const m of locals) {
      const fullName = m.id.replace('ollama/', '')
      list.push({
        value: m.id,
        label: fullName,
        searchText: `${m.id} ${fullName}`,
        group: t('chat.local.group'),
        hint: <span className="text-muted-foreground">{t('chat.local.free')}</span>,
      })
    }
    for (const m of cloudModels) {
      const fullName = m.name || m.id
      // Badge por id (":free"), NO por priceIn === 0: hay meta-routers sin pricing real
      // que caen en 0 y no son gratis (hallazgo #37).
      const isFree = m.id.endsWith(':free')
      list.push({
        value: m.id,
        label: fullName,
        searchText: `${m.id} ${fullName}`,
        // El encabezado "Cloud" solo aparece si hay locales arriba con los que contrastar.
        group: locals.length > 0 ? t('chat.cloud.group') : undefined,
        hint: (
          <span className={isFree ? 'font-semibold text-[var(--success)]' : 'text-muted-foreground'}>
            {isFree ? t('chat.models.free') : `$${(m.priceIn ?? 0).toFixed(2)}/M`}
          </span>
        ),
      })
    }
    return list
  }, [allowEmpty, emptyLabel, locals, cloudModels, t])

  return (
    <div className="model-combo relative max-w-[260px]">
      {/* El contrato con el mundo vanilla. `readOnly` porque React es el dueño del valor. */}
      <input type="hidden" id={inputId} value={value} readOnly />
      <Combobox
        open={open}
        onOpenChange={setOpen}
        value={isEmptyVal ? EMPTY : value}
        onValueChange={(next) => { setValue(next === EMPTY ? '' : next); setOpen(false) }}
        options={options}
        triggerLabel={label}
        searchPlaceholder={t('chat.models.search')}
        disabled={isLoading}
      />
    </div>
  )
}
