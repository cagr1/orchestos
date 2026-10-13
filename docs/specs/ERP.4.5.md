# ERP.4.5 — Una skill que es gate de revisión no se asigna ni se inyecta al ejecutor

## Problema
`pickAutoSkill` (`src/dashboard/handlers/chat.ts:784-790`) elige la primera candidata con `mode: automatic`. Las dos
únicas skills automáticas (`skills/qa-structured.yaml`, `skills/security-review.yaml`) declaran
`activation.phases: [review]`: son gates que `resolveGates` (`src/skills/catalog.ts:98`) ya aplica en la revisión.
Al asignarlas como skill principal de la tarea, `skillRoute` (`src/run/middlewares/skill-route.ts:11-22`) y
`loadSkillGuidelines` (`src/run/prompt.ts:65-74`) meten "SKILL GUIDELINES: Structured QA Review" en el prompt del
**ejecutor**. En el piloto (etapa 5, run `ac5c6ee6`) el ejecutor actuó como revisor: devolvió un veredicto JSON y no
escribió ninguno de los 6 archivos. El propio comentario de `pickAutoSkill` dice que los gates transversales no se
resuelven ahí.

## Cambio
1. `src/skills/catalog.ts`:
   - `SkillCandidateInfo` gana `phases?: TaskClass[]` (de `s.activation?.phases`), poblado en
     `listAllSkillCandidates()`.
   - Nueva función exportada y pura
     `isReviewOnlyGate(activation: { mode?: SkillActivationMode; phases?: TaskClass[] } | undefined): boolean`:
     `true` solo si `mode === 'automatic'`, `phases` tiene al menos un elemento y **todos** son `'review'`.
2. `src/dashboard/handlers/chat.ts`, `pickAutoSkill`: antes del desempate, quitar de `skillOptions` las candidatas
   para las que `isReviewOnlyGate` es `true` (mirando la info del catálogo por id). El resto del orden de desempate
   queda igual, aplicado a las candidatas restantes. Añadir al comentario existente una entrada fechada
   `ERP.4.5 (2026-10-13)` de 2-3 líneas con el motivo; no borrar el historial del comentario.
3. `src/run/middlewares/skill-route.ts` y `src/run/prompt.ts` (`loadSkillGuidelines`): si la skill cargada cumple
   `isReviewOnlyGate(skill.activation)`, no inyectar nada (`ctx.skillInstructions` sin tocar / devolver `''`). Cubre
   las tareas ya guardadas con `skill: qa-structured` en un `tasks.yaml` y las creadas por otra vía.
   No tocar `src/run/qa.ts` ni `src/run/harness.ts`: la revisión sigue usando esas skills como hoy.
4. Tests:
   - `src/__tests__/skill-auto-selection.test.ts`, en el `describe('pickAutoSkill …')` existente:
     `[{id:'qa-structured'}]` → `undefined`; `[{id:'qa-structured'},{id:'tdd-enforcer'}]` → `'tdd-enforcer'`;
     `[{id:'security-review'},{id:'qa-structured'},{id:'frontend-design'}]` → `'frontend-design'`.
   - Test de `isReviewOnlyGate` (mismo archivo o uno nuevo junto a los tests de catálogo): automatic+[review] → true;
     automatic+[review, implement] → false; automatic sin phases → false; modo no automático → false; undefined →
     false.
   - Test de `buildPrompt` (`src/run/prompt.ts`): una tarea con `skill: 'qa-structured'` produce un `system` que NO
     contiene `SKILL GUIDELINES`; una tarea con una skill no-gate existente (p. ej. `tdd-enforcer`) SÍ lo contiene.
   - Test de `skillRoute`: con `ctx.task.skill = 'qa-structured'`, `ctx.skillInstructions` queda vacío tras correr el
     middleware. Buscar primero si ya hay un archivo de tests de ese middleware y añadir ahí.
   Ningún test existente debe cambiar de expectativa; si alguno lo exige, parar y decirlo.

## No tocar
- `skills/*.yaml`, `src/run/qa.ts`, `src/run/harness.ts`, `PLAN.md`, `NEXT.md`, `scripts/`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bunx tsc --noEmit`
- `bun test src/__tests__/skill-auto-selection.test.ts` y los archivos de test nuevos o tocados
- `bunx biome check` sobre los archivos tocados
- Contraprueba: decir qué tests nuevos fallan con el código viejo.

NO correr `test:coverage` ni `ui:gate`, ni detenerse por el baseline. El candado de escritor `ocupado: claude …` es
el cerebro que delega: se puede editar. Hay un dashboard real en `localhost:4242`: no tocarlo ni reiniciarlo. No
commitear.
