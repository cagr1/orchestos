/**
 * Pantalla Skills (UI.4, Mes 30) — reemplaza `SCREENS.skills.render()/wire()`.
 *
 * MIGRAR ≠ REDISEÑAR: conserva las mismas cards, clases, textos y estados del dashboard
 * vanilla. La pantalla se migra como patrón de cards porque no usa tabla y porque su borrado
 * tiene una confirmación inline, dos casos que complementan lo que ya probó Specs.
 *
 * EL ESTADO NO SE COPIA: `skills`, `proSkills` y `registrySkills` se leen de `window.state`.
 * `useAppVersion()` solo avisa cuándo volver a leerlo; copiar esos datos a `useState` crearía
 * dos fuentes de verdad mientras `app.js` siga siendo dueño de los fetch.
 */
import { useState } from 'react'
import { useAppVersion, appState } from '../../lib/app-state.ts'
import { useT } from '../../lib/i18n.ts'
import { Icon, RawIcon } from '../../lib/icons.tsx'
import { screenApi } from './screen-api.ts'

interface Skill {
  id: string
  name: string
  description: string
  targets?: string[]
  source?: string
  imported?: boolean
}

interface SkillMessage {
  text: string
  color: string
}

const EMPTY_SKILL: Skill[] = []

export function SkillsScreen() {
  // `window.state` se muta in-place: la versión es el disparador que hace que React lo relea.
  useAppVersion()
  const t = useT()
  const api = screenApi()
  const st = appState()
  const skills = (st['skills'] as Skill[] | undefined) ?? EMPTY_SKILL
  const proSkills = (st['proSkills'] as Skill[] | undefined) ?? EMPTY_SKILL
  const registrySkills = (st['registrySkills'] as Skill[] | undefined) ?? EMPTY_SKILL
  const status = st['skillsStatus'] as string | undefined
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, SkillMessage>>({})

  const setMessage = (id: string, text: string, color: string) => {
    setMessages((current) => ({ ...current, [id]: { text, color } }))
    window.setTimeout(() => {
      setMessages((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    }, 5000)
  }

  const copy = async (skill: Skill) => {
    setBusy(skill.id)
    try {
      if (api && await api.copySkill(skill.id)) {
        setCopied(skill.id)
        window.setTimeout(() => setCopied((current) => current === skill.id ? null : current), 2000)
      }
    } catch {
      // El vanilla ignora un fallo de exportación/copiado: no se muestra un estado nuevo.
    } finally {
      setBusy(null)
    }
  }

  const build = async (skill: Skill) => {
    setBusy(skill.id)
    try {
      const result = await api?.buildSkill(skill.id)
      setMessage(skill.id, result?.ok ? t('skills.build.ok', result.paths?.join(', ') ?? '') : (result?.error || t('skills.build.err')), result?.ok ? 'var(--success)' : 'var(--error)')
    } catch {
      setMessage(skill.id, t('common.conn.error'), 'var(--error)')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (skill: Skill) => {
    setBusy(skill.id)
    try {
      const result = await api?.deleteSkill(skill.id)
      if (result?.ok) {
        setConfirming(null)
        await api?.fetchSkills()
        forceRerender()
      } else {
        setMessage(skill.id, result?.error || t('skills.delete.err'), 'var(--error)')
      }
    } catch {
      setMessage(skill.id, t('common.conn.error'), 'var(--error)')
    } finally {
      setBusy(null)
    }
  }

  const importRegistry = async (skill: Skill) => {
    setBusy(skill.id)
    try {
      const result = await api?.importRegistrySkill(skill.id)
      if (result?.ok) {
        await Promise.all([api?.fetchSkills(), api?.fetchRegistrySkills()])
        forceRerender()
      } else {
        setMessage(`reg-${skill.id}`, result?.error || t('skills.registry.err'), 'var(--error)')
      }
    } catch {
      setMessage(`reg-${skill.id}`, t('common.conn.error'), 'var(--error)')
    } finally {
      setBusy(null)
    }
  }

  const importPro = async (skill: Skill) => {
    setBusy(skill.id)
    try {
      const result = await api?.importProSkill(skill.id)
      if (result?.ok) {
        await Promise.all([api?.fetchSkills(), api?.fetchProSkills()])
        forceRerender()
      } else {
        setMessage(`pro-${skill.id}`, result?.error || t('skills.pro.err'), 'var(--error)')
      }
    } catch {
      setMessage(`pro-${skill.id}`, t('common.conn.error'), 'var(--error)')
    } finally {
      setBusy(null)
    }
  }

  const head = (
    <div className="screen-head">
      <div className="lead"><h1>{t('skills.title')}</h1><p>{t('skills.subtitle')}</p></div>
      <div className="tools">
        <button className="btn" onClick={() => api?.fetchAll()}><Icon name="refresh" /> {t('btn.refresh')}</button>
        <button className="btn primary" onClick={() => api?.openNewSkill()}><Icon name="plus" /> {t('skills.btn.new')}</button>
        <button className="btn" onClick={() => api?.openImportSkill()}><Icon name="inbox" /> {t('skills.btn.import')}</button>
        <button className="btn" disabled={busy === 'discover'} onClick={async () => { setBusy('discover'); await api?.fetchRegistrySkills(); setBusy(null) }}>
          <Icon name={busy === 'discover' ? 'refresh' : 'search'} /> {busy === 'discover' ? t('common.loading') : t('skills.btn.discover')}
        </button>
      </div>
    </div>
  )

  if (status === 'loading') return <div className="screen">{head}<Placeholder spinner title={t('skills.loading')} /></div>
  if (status === 'error') return <div className="screen">{head}<Placeholder error icon="warn" title={t('skills.err.title')} body={t('skills.err.body')} /></div>
  if (skills.length === 0) return <div className="screen">{head}<Placeholder icon="flask" title={t('skills.empty.title')} body={t('skills.empty.body')} /></div>

  return (
    <div className="screen">
      {head}
      <div className="skills-grid">{skills.map((skill) => <SkillCard key={skill.id} skill={skill} confirming={confirming === skill.id} busy={busy === skill.id} copied={copied === skill.id} message={messages[skill.id]} onDetail={() => api?.openSkillDetail(skill)} onEdit={() => api?.openEditSkill(skill)} onExport={() => api?.exportSkill(skill.id)} onCopy={() => void copy(skill)} onBuild={() => void build(skill)} onDelete={() => setConfirming(skill.id)} onCancelDelete={() => setConfirming(null)} onConfirmDelete={() => void remove(skill)} />)}</div>
      {proSkills.length > 0 && <section className="skills-pro-section"><div className="screen-head" style={{ marginTop: '24px' }}><div className="lead"><h2>{t('skills.pro.title')}</h2><p>{t('skills.pro.subtitle')}</p></div></div><div className="skills-grid">{proSkills.map((skill) => <CatalogCard key={skill.id} skill={skill} kind="pro" message={messages[`pro-${skill.id}`]} onImport={() => void importPro(skill)} busy={busy === skill.id} />)}</div></section>}
      {registrySkills.length > 0 && <section className="skills-registry-section"><div className="screen-head" style={{ marginTop: '24px' }}><div className="lead"><h2>{t('skills.registry.title')}</h2><p>{t('skills.registry.subtitle')}</p></div><button className="btn ghost sm" onClick={() => api?.fetchRegistrySkills()}><Icon name="refresh" /></button></div><div className="skills-grid">{registrySkills.map((skill) => <CatalogCard key={skill.id} skill={skill} kind="registry" message={messages[`reg-${skill.id}`]} onImport={() => void importRegistry(skill)} busy={busy === skill.id} />)}</div></section>}
    </div>
  )
}

function SkillCard({ skill, confirming, busy, copied, message, onDetail, onEdit, onExport, onCopy, onBuild, onDelete, onCancelDelete, onConfirmDelete }: { skill: Skill; confirming: boolean; busy: boolean; copied: boolean; message?: SkillMessage; onDetail: () => void; onEdit: () => void; onExport: () => void; onCopy: () => void; onBuild: () => void; onDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void }) {
  const t = useT()
  return <div className="skill-card" data-skill={skill.id}>
    <div className="skill-card-main" data-skill-detail={skill.id} onClick={onDetail}><div className="skill-card-name">{skill.name}</div><div className="skill-card-desc">{skill.description}</div><div className="skill-card-targets">{(skill.targets ?? []).map((target) => <span className="badge blue square" key={target}>{target}</span>)}</div></div>
    {!confirming && <div className="skill-card-actions"><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onEdit() }}><Icon name="settings" /> {t('skills.btn.edit')}</button><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onExport() }}><Icon name="inbox" /> {t('skills.btn.export')}</button><button className="btn ghost sm" disabled={busy} onClick={(e) => { e.stopPropagation(); onCopy() }}><Icon name={copied ? 'check' : 'copy'} /> {copied ? t('skills.btn.copied') : t('skills.btn.copy')}</button><button className="btn ghost sm" disabled={busy} onClick={(e) => { e.stopPropagation(); onBuild() }}><Icon name="play" /> {t('skills.btn.build')}</button><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onDelete() }}><Icon name="trash" /> {t('skills.btn.delete')}</button></div>}
    {confirming && <div className="skill-card-confirm"><span className="muted fs-2" style={{ flex: 1 }}>{t('skills.delete.confirm', skill.name)}</span><button className="btn danger sm" disabled={busy} onClick={(e) => { e.stopPropagation(); onConfirmDelete() }}>{t('skills.delete.btn')}</button><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onCancelDelete() }}>{t('btn.cancel')}</button></div>}
    {message && <div className="skill-card-msg" style={{ color: message.color }}>{message.text}</div>}
  </div>
}

function CatalogCard({ skill, kind, message, onImport, busy }: { skill: Skill; kind: 'pro' | 'registry'; message?: SkillMessage; onImport: () => void; busy: boolean }) {
  const t = useT()
  const imported = kind === 'pro' && skill.imported
  const dataAttribute = kind === 'pro' ? { 'data-pro-skill': skill.id } : { 'data-reg-skill': skill.id }
  return <div className="skill-card" {...dataAttribute}><div className="skill-card-main"><div className="skill-card-name">{skill.name} <span className="badge gray square">{kind}</span></div><div className="skill-card-desc">{kind === 'registry' ? (skill.description || skill.id) : skill.description}</div><div className="skill-card-targets">{kind === 'registry' ? <span className="badge blue square">{skill.source}</span> : (skill.targets ?? []).map((target) => <span className="badge blue square" key={target}>{target}</span>)}</div></div><div className="skill-card-actions">{imported ? <button className="btn ghost sm" disabled><Icon name="check" /> {t('skills.pro.imported')}</button> : <button className="btn primary sm" disabled={busy} onClick={onImport}><Icon name="inbox" /> {kind === 'pro' ? t('skills.pro.btn.import') : t('skills.registry.btn.import')}</button>}</div>{message && <div className="skill-card-msg" style={{ color: message.color }}>{message.text}</div>}</div>
}

function Placeholder({ title, body, icon, spinner, error }: { title: string; body?: string; icon?: string; spinner?: boolean; error?: boolean }) {
  const icons = screenApi()?.icons ?? {}
  return <div className="card"><div className={`placeholder ${error ? 'err' : ''}`}>{spinner && <div className="spinner" />}{icon && <div className="pic"><RawIcon svg={icons[icon] ?? ''} /></div>}<h3>{title}</h3>{body && <p>{body}</p>}</div></div>
}

function forceRerender(): void {
  ;(window as unknown as { App?: { rerender: () => void } }).App?.rerender()
}
