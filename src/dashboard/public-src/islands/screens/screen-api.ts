/**
 * Superficie que el vanilla expone a las PANTALLAS migradas (UI.4, Mes 30).
 *
 * Misma frontera que estableció el shell en UI.3: React dibuja y avisa; los fetch, la
 * persistencia, los modales y el estado siguen viviendo en `app.js`. Mientras el vanilla sea
 * el dueño de los datos, duplicarlos en React crearía dos fuentes de verdad. Se invierte en
 * UI.5, cuando el vanilla se borre.
 */

export interface BulkApi {
  selected: (screen: string) => string[]
  toggle: (screen: string, id: string) => void
  toggleAll: (screen: string, ids: string[]) => void
  clear: (screen: string) => void
  remove: (screen: string, endpoint: string, refetch: () => Promise<unknown>, resourceLabel: string) => void
}

export interface ScreenApi {
  state: () => Record<string, unknown>
  t: (key: string, ...args: unknown[]) => string
  formatDate: (iso: string, opts?: { dateOnly?: boolean; seconds?: boolean }) => string
  icons: Record<string, string>
  fetchAll: () => void
  fetchSpecs: () => Promise<unknown>
  fetchSkills: () => Promise<unknown>
  fetchProSkills: () => Promise<unknown>
  fetchRegistrySkills: () => Promise<unknown>
  exportSkill: (id: string) => void
  copySkill: (id: string) => Promise<boolean>
  buildSkill: (id: string) => Promise<{ ok: boolean; paths?: string[]; error?: string }>
  deleteSkill: (id: string) => Promise<{ ok: boolean; error?: string }>
  importProSkill: (id: string) => Promise<{ ok: boolean; error?: string }>
  importRegistrySkill: (id: string) => Promise<{ ok: boolean; error?: string }>
  openNewSkill: () => void
  openImportSkill: () => void
  openSkillDetail: (skill: unknown) => void
  openEditSkill: (skill: unknown) => void
  showToast: (msg: string, type?: string) => void
  confirm: (title: string, body: string, label: string) => Promise<boolean>
  openSpecDraft: () => void
  bulk: BulkApi
}

export function screenApi(): ScreenApi | null {
  return (window as unknown as { OrchestOS?: ScreenApi }).OrchestOS ?? null
}

/**
 * Mapa de color de badge por estado. Es el mismo `STATUS_BADGE` de `data.js`; se replica acá
 * porque son 10 pares string→string estables desde hace meses, no un catálogo vivo como los 36
 * SVG de `ICON` (que sí se leen por el puente, ver `lib/icons.tsx`). La regla que se está
 * aplicando es la misma en los dos casos: duplicar solo lo que no puede desincronizarse.
 */
export const STATUS_BADGE: Record<string, string> = {
  done: 'green', running: 'blue', pending: 'gray', failed: 'red', blocked: 'amber',
  failed_permanent: 'red',
  pass: 'green', fail: 'red', approved: 'green', draft: 'amber', archived: 'gray',
}
