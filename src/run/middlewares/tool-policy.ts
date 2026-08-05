import { loadSkill, resolveSkillPath } from '../../skills/registry.ts'
import type { MiddlewareFn, RunContext } from '../middleware.ts'

/**
 * O.3 (Bloque O, 2026-08-05) — INS-2026-014 pedía hacer explícito que elegir
 * una skill cambia los permisos de herramientas del agente, para que no
 * pase inadvertido con la selección automática (O.2).
 *
 * Verificado al tocar este archivo: `ctx.allowedTools` (seteado acá) **no lo
 * lee ningún ejecutor** (`single-shot`, `agentic`, `external`, `opencode`,
 * `codex` — ninguno hace `grep -rn allowedTools` fuera de este middleware).
 * El camino que sí enforcea de verdad es otro: `SubTask.allowed_tools`
 * (`agents/sub-task-schema.ts`, requerido y validado por el planner,
 * chequeado hard en `agents/executor.ts`). Esos dos `allowed_tools` — el de
 * la skill de una tarea simple y el de una sub-tarea del planner — parecen
 * el mismo mecanismo pero NO lo son; solo el segundo tiene efecto real.
 *
 * Por eso el riesgo literal de INS-2026-014 (una skill auto-elegida
 * restringe permisos en silencio y rompe la tarea de forma confusa) no se
 * materializa HOY vía este middleware — no hace nada. Pero dejar el campo
 * puesto sin advertencia es su propia trampa silenciosa: alguien puede leer
 * este archivo y asumir que protege algo. Cablear una enforcement real acá
 * sería redefinir el modelo de seguridad de los ejecutores — cambio de
 * comportamiento central, fuera del alcance de O.3 (regla de planificar
 * antes de cambios grandes). Registrado como IDEAS.md #58: o se cablea de
 * verdad, o este middleware se borra.
 */
export const toolPolicy: MiddlewareFn<RunContext> = async (ctx, next) => {
  const skillId = ctx.task.skill
  if (skillId) {
    try {
      const skill = loadSkill(resolveSkillPath(skillId))
      ctx.allowedTools = skill.allowed_tools ?? []
    } catch {
      // skill not found — leave allowedTools as empty array (no restriction)
    }
  }
  await next()
}
