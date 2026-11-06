/**
 * scripts/scope-lock.ts
 *
 * H.4.1 (PLAN.md § Bloque H) — mecaniza el scope-lock, hoy solo narrativo
 * (docs/agent-work-protocol.md § paso 5: "documentar alcance... antes de
 * editar", pero nadie lo verificaba). Investigado contra precedente externo
 * antes de diseñar (ECC, OpenSpec, DeerFlow, Engram, gentle-ai, Orca,
 * fable-method, Graphify): ninguno resuelve "comparar diff contra scope
 * declarado por tarea" — el más cercano (ECC `ecc-context-monitor.js`) solo
 * cuenta archivos tocados en la sesión sin scope declarado, informativo,
 * nunca bloquea.
 *
 * Diseño: declaración OPCIONAL de un glob amplio al momento de
 * `agent:preflight --scope`, guardada en `.orchestos/active-item.json`
 * (gitignored, estado de sesión). Si no hay declaración, el gate no aplica
 * — mecaniza la disciplina existente sin forzar retrofits en ítems viejos.
 * Si hay declaración y el diff staged toca paths fuera del glob, el gate
 * NO bloquea el trabajo transversal: exige que el mismo commit lo
 * justifique en PLAN.md (línea "Fuera de scope declarado:"), mismo patrón
 * que `hasLiveGateEvidence` para "Gate en vivo:".
 */

export interface ActiveItemState {
  item: string
  scope: string[]
  declaredAt: string
}

export function parseScopeArg(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function pathsOutsideScope(paths: string[], scope: string[]): string[] {
  const globs = scope.map((pattern) => new Bun.Glob(pattern))
  return paths.filter((path) => !globs.some((g) => g.match(path)))
}

export function hasOutOfScopeJustification(planDiff: string): boolean {
  return planDiff
    .split('\n')
    .some((line) => line.startsWith('+') && /Fuera de scope declarado:/i.test(line))
}

/**
 * Un ítem declarado puede desaparecer de PLAN.md sin cerrarse nunca: se borra
 * porque era configuración interna, se renombra, o vivía en otra rama. En ese
 * caso `planClosesItem` nunca ve el `[x]` y el estado de sesión sobrevive sin
 * dueño, bloqueando en silencio todo commit fuera de su glob. Incidente real
 * 2026-09-11: `AG.1b` quedó declarado tras borrarse el ítem, y frenó un commit
 * de docs sin relación. Mismo patrón que la Regla cero de CLAUDE.md — un diente
 * mecánico desincronizado de su fuente deja de proteger y empieza a estorbar.
 */
export function planHasItem(planContent: string, itemId: string): boolean {
  const escaped = itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^- \\[[ x]\\] \\*\\*${escaped}(?:\\s|—|\\*)`, 'm').test(planContent)
}

export function planClosesItem(planDiff: string, itemId: string): boolean {
  const escaped = itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\+- \\[x\\] \\*\\*${escaped}(?:\\s|—)`, 'm')
  return re.test(planDiff)
}
