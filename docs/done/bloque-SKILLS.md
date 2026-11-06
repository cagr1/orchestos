# Bloque SKILLS — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-skills-seccion-abiertos---fiabilidad-de-los-gates-y-doc"></a>
### Abiertos — fiabilidad de los gates y documentación

- [x] **SKILLS.1 — 🔍 No se sabe qué skills de OrchestOS se usan ni si aportan.** Cerrado 2026-10-24.
  GO de Carlos 2026-10-24. Fase 1: medir sin LLM inventario, caminos de selección, uso real en `runs` y resultado de
  QA por skill (`skills/*.yaml` + `skills/pro/`); veredicto propuesto por skill. Retirar espera OK de Carlos.
  Medido (SQL de solo lectura sobre `~/.orchestos/db.sqlite`; el cerebro reprodujo los conteos): 806 runs, 778 sin
  skill. Con skill: doc-gen 9 (1/8; los 8 fallos son `codex produced no turn.completed`, todos el 2026-09-23, no la
  skill), frontend-design 8 (6/2), qa-structured 5, security-review 1, tdd-enforcer 1; IDs sin YAML `doc` 3 (0/3) e
  `implement` 1, aún generados por `src/tasks/init.ts:71`. 22 de 27 YAML nunca corrieron: el camino automático solo
  elige con candidata única o `mode: automatic` (`chat.ts:791`), así que "nunca usada" mide al selector, no a la skill.
  Aporte no demostrable (muestras < 10, sin control). Hallazgos: `skills/pro/api-contract.yaml` idéntica (`cmp`) a la
  normal y sombreada; `pickAutoSkill` elige una skill `explicit` si es candidata única (`verification-before-completion`).
  Ejecutado por: codex gpt-6.1-sol (analizar), verificación Opus · Spec: docs/specs/SKILLS.1.md (borrado)
