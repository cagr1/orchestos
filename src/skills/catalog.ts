import { listSkillFiles, listProSkillFiles, loadSkill } from './registry.ts'
import type { SkillActivationMode } from './registry.ts'

/**
 * O.2 (Bloque O, 2026-08-03) — catálogo de skills compartido.
 *
 * `listAllSkillCandidates()` e `isKnownSkillId()` vivían dentro de la capa
 * dashboard (`handlers/project.ts` y `handlers/tasks.ts`), pero el planner
 * (`agents/planner.ts`) necesita las dos: importar dashboard desde agents sería
 * invertir las capas. Se extraen acá; los handlers las re-exportan para no
 * romper su API pública ni los tests que las importan de la ubicación vieja.
 *
 * Este módulo NO decide qué skill aplica — solo describe qué hay disponible.
 * La decisión vive en el consumidor (planner, `pickAutoSkill`, gates de O.3).
 */

export interface SkillCandidateInfo {
  id: string
  name: string
  description: string
  whenToUse: string[]
  /** Ausente = la skill no declaró `activation` (contrato O.0). */
  mode?: SkillActivationMode
}

/** Todas las skills instaladas — propias del proyecto y centralizadas (O.1). */
export function listAllSkillCandidates(): SkillCandidateInfo[] {
  const out: SkillCandidateInfo[] = []
  for (const f of [...listSkillFiles(), ...listProSkillFiles()]) {
    try {
      const s = loadSkill(f)
      out.push({
        id: s.id,
        name: s.name,
        description: s.description,
        whenToUse: s.when_to_use ?? [],
        mode: s.activation?.mode,
      })
    } catch {}
  }
  return out
}

/**
 * Bloque D (Mes 18, ex-IDEAS #21) — un `skill` inventado o mal escrito se ignora
 * en silencio en vez de romper la creación de la tarea; solo importa que exista.
 */
export function isKnownSkillId(id: string): boolean {
  return listAllSkillCandidates().some(s => s.id === id)
}

/**
 * Catálogo resumido para meter en un prompt: id + description + when_to_use.
 *
 * Es **solo metadata**, nunca el cuerpo de las skills — cargar las 24 completas
 * en cada prompt inflaría el contexto, mezclaría instrucciones irrelevantes y
 * diluiría las reglas que sí importan. El cuerpo se carga después, y solo el de
 * la skill elegida (`skillRoute` / `loadSkillGuidelines`).
 */
export function renderSkillCatalog(candidates?: SkillCandidateInfo[]): string {
  const list = candidates ?? listAllSkillCandidates()
  if (list.length === 0) return ''
  return list
    .map(s => `- ${s.id}: ${s.description}${s.whenToUse.length ? ' — Use when: ' + s.whenToUse.join('; ') : ''}`)
    .join('\n')
}
