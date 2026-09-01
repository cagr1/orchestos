import type { TaskClass } from '../router/classify.ts'
import type { SkillActivationMode, SkillDef } from './registry.ts'
import { listProSkillFiles, listSkillFiles, loadSkill } from './registry.ts'

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
  return listAllSkillCandidates().some((s) => s.id === id)
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
    .map(
      (s) =>
        `- ${s.id}: ${s.description}${s.whenToUse.length ? ' — Use when: ' + s.whenToUse.join('; ') : ''}`,
    )
    .join('\n')
}

export interface GateEvaluation {
  skill: SkillDef
  /** Coincide fase + `mode: automatic` — era elegible, sin importar `triggers`. */
  candidate: boolean
  /** Candidata Y (sin triggers, o al menos uno coincidió con el texto de la tarea). */
  applied: boolean
  reason: string
}

/**
 * O.3 (Bloque O, 2026-08-05) — gates transversales que NO puede decidir el
 * mismo LLM que hace el trabajo (esa es la razón de ser de iron_law/
 * common_rationalizations, N.1-N.3: si quien elige la skill puede
 * descartarla, el endurecimiento no sirve). La condición de gate vive
 * enteramente en `activation.mode: automatic` + `activation.phases` +
 * `activation.triggers` del YAML de la skill (contrato O.0) — nunca en un
 * `if` de código, para no romper la portabilidad a otros proyectos (O.1).
 *
 * `triggers` ausente o vacío = la skill aplica siempre que la fase coincide
 * (caso `qa-structured`, sin triggers). `triggers` presente = requiere al
 * menos una coincidencia case-insensitive contra la descripción de la tarea
 * (caso `security-review`, con "authentication"/"user_input"/etc — los guiones
 * bajos también matchean con espacio, ya que las skills los escriben así por
 * legibilidad pero el texto de la tarea normalmente no).
 */
export function resolveGates(taskText: string, phase: TaskClass): GateEvaluation[] {
  const out: GateEvaluation[] = []
  const haystack = taskText.toLowerCase()
  for (const f of [...listSkillFiles(), ...listProSkillFiles()]) {
    let skill: SkillDef
    try {
      skill = loadSkill(f)
    } catch {
      continue
    }
    const activation = skill.activation
    if (!activation || activation.mode !== 'automatic') continue
    if (!activation.phases || !activation.phases.includes(phase)) continue

    const triggers = activation.triggers
    if (!triggers || triggers.length === 0) {
      out.push({
        skill,
        candidate: true,
        applied: true,
        reason: 'sin triggers declarados — aplica siempre en esta fase',
      })
      continue
    }
    const matched = triggers.filter((t) => {
      const needle = t.toLowerCase()
      return haystack.includes(needle) || haystack.includes(needle.replace(/_/g, ' '))
    })
    if (matched.length > 0) {
      out.push({
        skill,
        candidate: true,
        applied: true,
        reason: `trigger match: ${matched.join(', ')}`,
      })
    } else {
      out.push({
        skill,
        candidate: true,
        applied: false,
        reason: 'ningún trigger coincidió con la descripción de la tarea',
      })
    }
  }
  return out
}
