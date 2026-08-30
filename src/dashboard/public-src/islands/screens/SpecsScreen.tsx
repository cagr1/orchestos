/**
 * Pantalla Specs (UI.4, Mes 30) — la PRIMERA pantalla completa migrada. Reemplaza
 * `SCREENS.specs.render()/wire()` de `screens-ops.js`.
 *
 * Se eligió primero por chica (166 líneas) y porque tiene, en miniatura, todo lo que van a
 * necesitar las otras diez: estados de carga/error/vacío, una tabla con filas expandibles,
 * una sección colapsable, selección múltiple con barra flotante, acciones que pegan a la API
 * y confirmación destructiva. Lo que se resuelva acá define el patrón; por eso vale la pena
 * mirarla aunque sea la más simple.
 *
 * MIGRAR ≠ REDISEÑAR (regla del ítem). El markup conserva las clases del CSS vanilla
 * (`.screen`, `.card`, `.tbl`, `.badge`, `.stat-box`…) y el gate compara el resultado contra
 * el vanilla. Cero decisiones visuales nuevas.
 *
 * EL ESTADO NO SE COPIA: se lee de `window.state` en cada render, igual que hacía el
 * `render(st)` al que reemplaza, y `useAppVersion()` avisa cuándo releer. Duplicarlo en React
 * mientras `app.js` sigue siendo el dueño de los fetch crearía dos fuentes de verdad. Ver la
 * explicación larga en `lib/app-state.ts`.
 */
import { useAppVersion, appState } from '../../lib/app-state.ts'
import { useT } from '../../lib/i18n.ts'
import { RawIcon, Icon } from '../../lib/icons.tsx'
import { screenApi } from './screen-api.ts'

interface Spec {
  id: string
  status: string
  lintStatus: string
  lintFindings: number
  deltaIssues: number
  hasCapabilities: boolean
  clarify: string
  design?: string
  createdAt: string
}

const BULK_SCREEN = 'specs'

export function SpecsScreen() {
  // Sin esto el componente no se enteraría de un `fetchAll()`: `window.state` se muta
  // in-place, así que no hay identidad nueva a la que React pueda reaccionar.
  useAppVersion()
  const t = useT()
  const api = screenApi()
  const st = appState()

  const specs = (st['specs'] as Spec[] | undefined) ?? []
  const status = st['specsStatus'] as string | undefined
  const openSpec = st['openSpec'] as string | null
  const archOpen = !!st['archOpen']
  const selected = new Set(api?.bulk.selected(BULK_SCREEN) ?? [])

  const head = (
    <div className="screen-head">
      <div className="lead">
        <h1>{t('specs.title')}</h1>
        <p>{t('specs.subtitle')}</p>
      </div>
      <div className="tools">
        <button className="btn" onClick={() => api?.fetchAll()}>
          <Icon name="refresh" /> {t('btn.refresh')}
        </button>
        <button className="btn primary" onClick={() => api?.openSpecDraft()}>
          <Icon name="plus" /> {t('specs.btn.new')}
        </button>
      </div>
    </div>
  )

  // G1 — el banner explicativo va SIEMPRE, también en loading/error/vacío. Es la primera
  // pantalla que ve alguien que no sabe qué es una spec.
  const explainer = (
    <div className="spec-explainer">
      <span className="spec-explainer-icon"><Icon name="specs" /></span>
      <div>
        <strong>{t('specs.what.title')}</strong>
        {' '}{t('specs.what.body')}
      </div>
    </div>
  )

  if (status === 'loading') {
    return <div className="screen">{head}{explainer}<Placeholder title={t('specs.loading')} spinner /></div>
  }
  if (status === 'error') {
    return (
      <div className="screen">{head}{explainer}
        <Placeholder error icon="warn" title={t('specs.err.title')} body={t('specs.err.body')} />
      </div>
    )
  }
  if (specs.length === 0) {
    return (
      <div className="screen">{head}{explainer}
        <Placeholder icon="specs" title={t('specs.empty.title')} body={t('specs.empty.body')} />
      </div>
    )
  }

  const active = specs.filter((s) => s.status !== 'archived')
  const archived = specs.filter((s) => s.status === 'archived')

  return (
    <div className="screen">
      {head}
      {explainer}
      <SpecTable list={active} selectable={false} openSpec={openSpec} selected={selected} />
      {archived.length > 0 && (
        <>
          <div
            className={`section-title collapsible ${archOpen ? '' : 'closed'}`}
            onClick={() => { st['archOpen'] = !archOpen; forceRerender() }}
          >
            <span className="chev"><Icon name="chev" /></span>
            <span>{t('specs.archived')}</span>
            <span className="ct">{archived.length}</span>
          </div>
          {archOpen && (
            <SpecTable list={archived} selectable openSpec={openSpec} selected={selected} />
          )}
        </>
      )}
      <BulkBar />
    </div>
  )
}

/**
 * Repinta a través del vanilla en vez de con estado propio de React.
 *
 * Es a propósito y es el punto delicado de esta migración: `openSpec` y `archOpen` viven en
 * `window.state`, y el vanilla los lee (por ejemplo `App.rerender()` tras borrar una spec).
 * Si React los duplicara en `useState`, las dos copias se separarían en cuanto una acción
 * pase por el lado vanilla. Se mutan donde ya viven y se avisa; cuando UI.5 borre el vanilla,
 * este estado se muda a React de una sola vez y con dueño único.
 */
function forceRerender(): void {
  ;(window as unknown as { App?: { rerender: () => void } }).App?.rerender()
}

function SpecTable({ list, selectable, openSpec, selected }: {
  list: Spec[]; selectable: boolean; openSpec: string | null; selected: Set<string>
}) {
  const t = useT()
  const api = screenApi()
  const ids = list.map((s) => s.id)
  const allChecked = selectable && ids.length > 0 && ids.every((id) => selected.has(id))

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="tbl">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '32px' }}>
                <input
                  type="checkbox" className="bulk-checkbox" checked={allChecked}
                  onChange={() => api?.bulk.toggleAll(BULK_SCREEN, ids)}
                />
              </th>
            )}
            <th>{t('specs.col.id')}</th>
            <th style={{ width: '190px' }}>{t('specs.col.status')}</th>
            <th style={{ width: '110px' }}>{t('specs.col.caps')}</th>
            <th style={{ width: '140px' }}>{t('specs.col.date')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <SpecRow key={s.id} spec={s} selectable={selectable}
              open={openSpec === s.id} checked={selected.has(s.id)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SpecRow({ spec, selectable, open, checked }: {
  spec: Spec; selectable: boolean; open: boolean; checked: boolean
}) {
  const t = useT()
  const api = screenApi()
  const st = appState()

  const toggleOpen = () => {
    st['openSpec'] = open ? null : spec.id
    forceRerender()
  }

  return (
    <>
      <tr
        className={`row ${open ? 'open' : ''}`}
        tabIndex={0}
        onClick={toggleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen() } }}
      >
        {/* El checkbox SOLO se renderiza en la tabla de archivadas: el borrado permanente
            (I.8, Mes 18) nunca toca drafts ni approved, así que ofrecerlo ahí sería una
            acción que no hace nada, en silencio. */}
        {selectable && (
          <td style={{ width: '32px' }}>
            <input
              type="checkbox" className="bulk-checkbox" checked={checked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); api?.bulk.toggle(BULK_SCREEN, spec.id) }}
            />
          </td>
        )}
        <td className="mono" style={{ color: 'var(--text)' }}>{spec.id}</td>
        <td><StatusRail spec={spec} /></td>
        <td>
          {spec.hasCapabilities
            ? <span className="cap-yes mono fs-2"><Icon name="check" /> {t('specs.cap.yes')}</span>
            : <span className="cap-no mono fs-2">— {t('specs.cap.no')}</span>}
        </td>
        <td className="mono faint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {api?.formatDate(spec.createdAt, { dateOnly: true })}
        </td>
      </tr>
      {open && <SpecDetail spec={spec} colSpan={selectable ? 5 : 4} />}
    </>
  )
}

/**
 * Carril de estado (UI.3.5): un glifo + mono en vez de dos badges de color
 * apilados (estado + lint). El glifo resume la salud de la fila —
 * archivada (neutral), con hallazgos de lint (mala), o al día (ok) — y el
 * texto conserva el estado real (`draft`/`approved`/…) que antes vivía en
 * el badge de color.
 */
function StatusRail({ spec }: { spec: Spec }) {
  if (spec.status === 'archived') {
    return (
      <span className="status-rail neutral">
        <span className="glyph">○</span>
        <span className="label">{spec.status}</span>
        <span className="rail-detail">—</span>
      </span>
    )
  }
  if (spec.lintStatus !== 'pass') {
    return (
      <span className="status-rail bad">
        <span className="glyph">✗</span>
        <span className="label">{spec.status}</span>
        <span className="rail-detail">{spec.lintFindings} findings</span>
      </span>
    )
  }
  return (
    <span className="status-rail ok">
      <span className="glyph">●</span>
      <span className="label">{spec.status}</span>
      <span className="rail-detail">ok</span>
    </span>
  )
}

function SpecDetail({ spec, colSpan }: { spec: Spec; colSpan: number }) {
  const t = useT()
  const api = screenApi()
  const st = appState()

  const designPending = spec.design === 'pending'
  const canApprove = spec.status === 'draft' && spec.clarify !== 'pending' && !designPending
  const canArchive = spec.status !== 'archived'
  // Borrado permanente solo para specs ya archivadas: soft delete primero, hard delete
  // después — nunca sobre drafts/approved activos (I.8, Mes 18).
  const canDelete = spec.status === 'archived'

  const post = (path: string, okKey: string, errKey: string, after?: () => void) => {
    fetch(`/api/specs/${encodeURIComponent(spec.id)}${path}`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { after?.(); api?.fetchAll(); api?.showToast(t(okKey, spec.id)) }
        else api?.showToast(d.error || t(errKey), 'error')
      })
  }

  const lint = () => {
    fetch(`/api/specs/${encodeURIComponent(spec.id)}/lint`)
      .then((r) => r.json())
      .then((d) => {
        // La guarda `Array.isArray` es un ARREGLO, no paridad: el vanilla hacía
        // `if (d.findings && d.findings.length === 0) … else d.findings.length`, así que una
        // respuesta sin `findings` (un 404, un error del servidor) caía al `else` y explotaba
        // con "Cannot read properties of undefined". Se vio en vivo al correr el gate contra
        // una spec inexistente. Un error de la API tiene que salir como aviso, no como crash.
        if (!Array.isArray(d.findings)) {
          api?.showToast(d.error || t('specs.toast.lintFindings', 0, spec.id), 'error')
        } else if (d.findings.length === 0) {
          api?.showToast(t('specs.toast.lintOk', d.structuredCount))
        } else {
          api?.showToast(t('specs.toast.lintFindings', d.findings.length, spec.id), 'error')
        }
      })
  }

  const remove = async () => {
    const ok = await api?.confirm(t('specs.delete.confirm'), t('bulk.confirm.body'), t('btn.confirm'))
    if (!ok) return
    fetch(`/api/specs/${encodeURIComponent(spec.id)}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { st['openSpec'] = null; api?.fetchAll(); api?.showToast(t('specs.toast.deleted', spec.id)) }
        else api?.showToast(d.error || t('specs.toast.deleteErr'), 'error')
      })
  }

  return (
    <tr className="detail-row">
      <td colSpan={colSpan}>
        <div className="spec-detail">
          <StatBox bad={spec.lintFindings > 0} n={spec.lintFindings} label={t('specs.stat.lintFindings')} />
          <StatBox bad={spec.deltaIssues > 0} n={spec.deltaIssues} label={t('specs.stat.deltaIssues')} />
          <div className="stat-box">
            <div className="n n-text">
              {spec.hasCapabilities
                ? <span className="cap-yes"><Icon name="check" /> {t('specs.cap.defined')}</span>
                : <span className="cap-no"><Icon name="x" /> {t('specs.cap.missing')}</span>}
            </div>
            <div className="l">{t('specs.col.caps')}</div>
          </div>
          {spec.clarify !== 'none' && (
            <StatBox bad={spec.clarify === 'pending'} text={spec.clarify} label={t('specs.clarify')} />
          )}
          {/* `design` undefined = spec simple: ningún badge, cero cambio visual (AA, IDEAS #6). */}
          {spec.design && (
            <StatBox bad={spec.design === 'pending'} text={spec.design} label={t('specs.design')} />
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {designPending && (
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); post('/approve-design', 'specs.toast.designApproved', 'specs.toast.approveDesignErr') }}>
                <Icon name="check" /> {t('specs.btn.approveDesign')}
              </button>
            )}
            {canApprove && (
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); post('/approve', 'specs.toast.approved', 'specs.toast.approveErr') }}>
                <Icon name="check" /> {t('specs.btn.approve')}
              </button>
            )}
            <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); lint() }}>
              <Icon name="search" /> Lint
            </button>
            {canArchive && (
              <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); post('/archive', 'specs.toast.archived', 'specs.toast.archiveErr') }}>
                <Icon name="inbox" /> {t('specs.btn.archive')}
              </button>
            )}
            {canDelete && (
              <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); void remove() }}>
                <Icon name="trash" /> {t('specs.btn.delete')}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

function StatBox({ bad, n, text, label }: { bad?: boolean; n?: number; text?: string; label: string }) {
  return (
    <div className={`stat-box ${bad ? 'bad' : 'ok'}`}>
      {text !== undefined
        ? <div className="n n-text">{text}</div>
        : <div className="n">{n}</div>}
      <div className="l">{label}</div>
    </div>
  )
}

/** Barra flotante de selección múltiple. Solo aparece con selección activa, como en vanilla. */
function BulkBar() {
  const t = useT()
  const api = screenApi()
  const selected = api?.bulk.selected(BULK_SCREEN) ?? []
  if (selected.length === 0) return null

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{t('bulk.selected', selected.length)}</span>
      <span className="bulk-spacer" />
      <button className="btn ghost sm" onClick={() => api?.bulk.clear(BULK_SCREEN)}>{t('bulk.clear')}</button>
      <button
        className="btn danger sm"
        onClick={() => api?.bulk.remove(BULK_SCREEN, '/api/specs/bulk-delete',
          () => Promise.resolve(api.fetchSpecs()), t('bulk.resource.specs'))}
      >
        <Icon name="trash" /> {t('bulk.delete', t('bulk.resource.specs'))}
      </button>
    </div>
  )
}

function Placeholder({ title, body, icon, spinner, error }: {
  title: string; body?: string; icon?: string; spinner?: boolean; error?: boolean
}) {
  const icons = screenApi()?.icons ?? {}
  return (
    <div className="card">
      <div className={`placeholder ${error ? 'err' : ''}`}>
        {spinner && <div className="spinner" />}
        {icon && <div className="pic"><RawIcon svg={icons[icon] ?? ''} /></div>}
        <h3>{title}</h3>
        {body && <p>{body}</p>}
      </div>
    </div>
  )
}
