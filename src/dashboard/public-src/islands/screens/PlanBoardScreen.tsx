import { useState } from 'react'
import { appState, useAppVersion } from '../../lib/app-state.ts'
import { useT } from '../../lib/i18n.ts'
import { Icon } from '../../lib/icons.tsx'
import { screenApi } from './screen-api.ts'

interface PlanItem {
  id: string
  sprint: string
  block: string | null
  delegation: string
  title: string
  status: 'open' | 'done'
  position: number
  dependsOn: string[]
  blockedBy: string[]
  ready: boolean
}

interface PlanMutation {
  status?: 'idle' | 'saving' | 'closing' | 'pending-commit' | 'error'
  error?: string | null
}

export function PlanBoardScreen() {
  useAppVersion()
  const t = useT()
  const api = screenApi()
  const state = appState()
  const items = ((state.planItems as PlanItem[] | undefined) ?? []).slice()
  const status = state.planStatus as string | undefined
  const mutation = (state.planMutation as PlanMutation | undefined) ?? { status: 'idle' }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const head = (
    <div className="screen-head">
      <div className="lead">
        <h1>{t('plan.title')}</h1>
        <p>{t('plan.subtitle')}</p>
      </div>
      <div className="tools">
        <button type="button" className="btn" onClick={() => api?.fetchPlan()}>
          <Icon name="refresh" /> {t('btn.refresh')}
        </button>
      </div>
    </div>
  )

  if (status === 'loading' || !status)
    return (
      <div className="screen">
        {head}
        <PlanPlaceholder text={t('plan.loading')} />
      </div>
    )
  if (status === 'error')
    return (
      <div className="screen">
        {head}
        <PlanPlaceholder error text={t('plan.error')} />
      </div>
    )
  if (items.length === 0)
    return (
      <div className="screen">
        {head}
        <PlanPlaceholder text={t('plan.empty')} />
      </div>
    )

  const byId = new Map(items.map((item) => [item.id, item]))
  const sprints = new Map<string, PlanItem[]>()
  for (const item of items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
    const list = sprints.get(item.sprint) ?? []
    list.push(item)
    sprints.set(item.sprint, list)
  }
  const mutating = mutation.status === 'saving' || mutation.status === 'closing'

  return (
    <div className="screen plan-board" data-plan-status={status}>
      {head}
      {mutation.error && (
        <div className="plan-message error" role="alert">
          {mutation.error}
        </div>
      )}
      {mutation.status === 'pending-commit' && (
        <div className="plan-message success" role="status">
          {t('plan.commitPending')}
        </div>
      )}
      {[...sprints.entries()].map(([sprint, sprintItems]) => (
        <section className="plan-sprint" key={sprint} data-plan-sprint={sprint}>
          <h2>{sprint}</h2>
          <div className="plan-columns">
            <PlanColumn
              title={t('plan.ready')}
              items={sprintItems.filter((item) => item.status === 'open' && item.ready)}
              byId={byId}
              editingId={editingId}
              selection={selection}
              confirmingId={confirmingId}
              mutating={mutating}
              onEdit={(item) => {
                setEditingId(item.id)
                setSelection(item.dependsOn)
              }}
              onToggle={(id) =>
                setSelection((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
              onCancel={() => {
                setEditingId(null)
                setSelection([])
              }}
              onSave={async (id) => {
                const result = await api?.setPlanDependencies(id, selection)
                if (result?.ok) {
                  setEditingId(null)
                  setSelection([])
                }
              }}
              onConfirm={(id) => setConfirmingId(id)}
              onCancelConfirm={() => setConfirmingId(null)}
              onPrepare={async (id) => {
                const result = await api?.preparePlanItemClose(id)
                if (result?.ok) setConfirmingId(null)
              }}
            />
            <PlanColumn
              title={t('plan.blocked')}
              items={sprintItems.filter((item) => item.status === 'open' && !item.ready)}
              byId={byId}
              editingId={editingId}
              selection={selection}
              confirmingId={confirmingId}
              mutating={mutating}
              onEdit={(item) => {
                setEditingId(item.id)
                setSelection(item.dependsOn)
              }}
              onToggle={(id) =>
                setSelection((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
              onCancel={() => {
                setEditingId(null)
                setSelection([])
              }}
              onSave={async (id) => {
                const result = await api?.setPlanDependencies(id, selection)
                if (result?.ok) {
                  setEditingId(null)
                  setSelection([])
                }
              }}
              onConfirm={(id) => setConfirmingId(id)}
              onCancelConfirm={() => setConfirmingId(null)}
              onPrepare={async (id) => {
                const result = await api?.preparePlanItemClose(id)
                if (result?.ok) setConfirmingId(null)
              }}
            />
            <PlanColumn
              title={t('plan.done')}
              items={sprintItems.filter((item) => item.status === 'done')}
              byId={byId}
              editingId={editingId}
              selection={selection}
              confirmingId={confirmingId}
              mutating={mutating}
              onEdit={(item) => {
                setEditingId(item.id)
                setSelection(item.dependsOn)
              }}
              onToggle={(id) =>
                setSelection((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
              onCancel={() => {
                setEditingId(null)
                setSelection([])
              }}
              onSave={async (id) => {
                const result = await api?.setPlanDependencies(id, selection)
                if (result?.ok) {
                  setEditingId(null)
                  setSelection([])
                }
              }}
              onConfirm={(id) => setConfirmingId(id)}
              onCancelConfirm={() => setConfirmingId(null)}
              onPrepare={async (id) => {
                const result = await api?.preparePlanItemClose(id)
                if (result?.ok) setConfirmingId(null)
              }}
            />
          </div>
        </section>
      ))}
    </div>
  )
}

function PlanPlaceholder({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`card plan-placeholder${error ? ' error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {text}
    </div>
  )
}

function PlanColumn({
  title,
  items,
  byId,
  editingId,
  selection,
  confirmingId,
  mutating,
  onEdit,
  onToggle,
  onCancel,
  onSave,
  onConfirm,
  onCancelConfirm,
  onPrepare,
}: {
  title: string
  items: PlanItem[]
  byId: Map<string, PlanItem>
  editingId: string | null
  selection: string[]
  confirmingId: string | null
  mutating: boolean
  onEdit: (item: PlanItem) => void
  onToggle: (id: string) => void
  onCancel: () => void
  onSave: (id: string) => Promise<void>
  onConfirm: (id: string) => void
  onCancelConfirm: () => void
  onPrepare: (id: string) => Promise<void>
}) {
  const t = useT()
  return (
    <div className="plan-column" data-plan-column={title}>
      <h3>
        {title}
        <span>{items.length}</span>
      </h3>
      <div className="plan-cards">
        {items.map((item) => (
          <article
            className={`plan-card ${item.status === 'done' ? 'done' : item.ready ? 'ready' : 'blocked'}`}
            key={item.id}
            data-plan-item={item.id}
          >
            <div className="plan-card-title">
              <code>{item.id}</code>
              <span>{item.delegation}</span>
            </div>
            <strong>{item.title}</strong>
            {item.block && <small>{item.block}</small>}
            <DependencyEdges item={item} byId={byId} />
            {item.status === 'open' && (
              <div className="plan-card-actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={mutating}
                  onClick={() => onEdit(item)}
                >
                  {t('plan.editDeps')}
                </button>
                {item.ready && (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={mutating}
                    onClick={() => onConfirm(item.id)}
                  >
                    {t('plan.prepareClose')}
                  </button>
                )}
              </div>
            )}
            {editingId === item.id && (
              <div className="plan-dependency-editor" data-plan-editor={item.id}>
                <p>{t('plan.selectDeps')}</p>
                {[...byId.values()]
                  .filter((candidate) => candidate.id !== item.id)
                  .map((candidate) => (
                    <label key={candidate.id}>
                      <input
                        type="checkbox"
                        checked={selection.includes(candidate.id)}
                        disabled={mutating}
                        onChange={() => onToggle(candidate.id)}
                      />
                      <code>{candidate.id}</code> {candidate.title}
                    </label>
                  ))}
                <div>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={mutating}
                    onClick={() => void onSave(item.id)}
                  >
                    {mutating ? t('plan.saving') : t('plan.save')}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={mutating}
                    onClick={onCancel}
                  >
                    {t('btn.cancel')}
                  </button>
                </div>
              </div>
            )}
            {confirmingId === item.id && (
              <div className="plan-close-confirm" data-plan-confirm={item.id}>
                <p>{t('plan.confirmClose', item.id, item.title)}</p>
                <button
                  type="button"
                  className="btn primary"
                  disabled={mutating}
                  onClick={() => void onPrepare(item.id)}
                >
                  {mutating ? t('plan.closing') : t('btn.confirm')}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={mutating}
                  onClick={onCancelConfirm}
                >
                  {t('btn.cancel')}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function DependencyEdges({ item, byId }: { item: PlanItem; byId: Map<string, PlanItem> }) {
  const t = useT()
  if (item.dependsOn.length === 0) return <p className="plan-no-deps">{t('plan.noDeps')}</p>
  return (
    <div className="plan-edges">
      {item.dependsOn.map((id) => {
        const dependency = byId.get(id)
        const open = dependency?.status !== 'done'
        return (
          <span className={`plan-edge ${open ? 'open' : 'done'}`} key={id}>
            {id} → {item.id}
          </span>
        )
      })}
    </div>
  )
}
