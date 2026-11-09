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

- [x] **SK.1 — Biblioteca de skills general, activación por proyecto y "Add skill" en Settings.** (GO de Carlos
  2026-11-06) Las skills no se instalan en el CLI: quedan disponibles en `~/.orchestos/skills/` y cada proyecto elige
  cuáles usa; la del proyecto gana. Hoy importar por URL existe solo por API y no acepta `SKILL.md`. Siguen SK.2
  (skill por fase: plan/diseño/código/revisión/seguridad) y SK.3 (perfil "¿sabes programar?"). Set curado inicial:
  `karpathy-guidelines`, `grill-me`/`to-spec` (mattpocock), `impeccable`, `tdd`, `verification-before-completion`
  (superpowers), `security-audit` (Cloudflare, modo orientación).
  Hecho: biblioteca `~/.orchestos/skills/` (orden proyecto > biblioteca > incluida); `POST /api/skills/library`
  importa un `SKILL.md` (URL raw, blob o tree de GitHub) sin LLM, con `checkSsrSafe`, 256 KB y sin redirecciones,
  y avisa los archivos auxiliares no traídos; las de biblioteca llegan apagadas y se activan por proyecto
  (`<proyecto>/.orchestos/skills.json`, excluido de git para no ensuciar el árbol); el selector, `skillRoute` y la
  resolución por id solo ven las habilitadas. Esquema: `description` ≤ 1024, `instructions` ≤ 32 000; el catálogo
  del selector recorta la descripción a 200. UI: "Add skill", origen por fila y switch. Gate nuevo `skills-library`
  en el pre-push (la excepción de SSRF para el servidor local del gate entra solo por `--preload`).
  Gates del cerebro: `test:coverage` 2359/1 (el fallo, `session-status.test.ts` por timeout, no lo toca el ítem y
  aislado pasa 3/3: intermitente por carga), `skills-library` 9/9 ×2 y 11/11 ×3 con importación real de
  `karpathy-guidelines` desde GitHub (`gate:evidence` `SK.1-skills-library`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/SK.1-live.json`
  Revisión: Opus (diff de registry, handlers, conversión y sonda del gate leídos; defecto `skills.json` → árbol
  sucio hallado y corregido en r3; capturas del diálogo y la lista mirados).
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2) + gpt-6-luna (mecanico r3) · Spec: docs/specs/SK.1.md
  Texto visible: "Add skill" · "Add" · "Cancel" (botones del diálogo: un "+" solo no dice qué agrega ni cómo salir)
  Texto visible: "GitHub URL of a SKILL.md or folder" (rótulo del campo: dice qué URL acepta)
  Texto visible: "Project" · "Library" · "Built-in" (origen por fila: sin él no se sabe cuál gana)
  Texto visible: "Use in this project" (rótulo del switch: sin texto, el switch es ambiguo)

- [x] **SK.2 — Cada tarea recibe las skills de su fase, no solo una.** (GO de Carlos 2026-11-06) Hoy el ejecutor
  recibe una sola skill (`task.skill`, elegida por `pickAutoSkill`) y las fases (`activation.phases`) solo se usan en
  QA (`resolveGates(…, 'review')`, `harness.ts:785`). Las skills de la biblioteca llegan sin fase, así que nunca se
  aplican solas. SK.2: la fila de una skill de biblioteca permite elegir en qué fases aplica (Plan, Build, Fix,
  Review, Docs = `TaskClass`); el ejecutor recibe la skill principal más las automáticas de la fase de la tarea, con
  tope de contexto; el run registra cuáles aplicó y el detalle de la tarea las muestra.
  Hecho: `PUT /api/skills/<id>/phases` escribe `activation: {mode: automatic, phases}` en el YAML de la biblioteca
  (vacío la quita); `buildSkillInstructions` (`catalog.ts`) es la única vía para `skillRoute` y `prompt.ts`: principal
  + automáticas de la fase (sin gates review-only), tope 48 000 caracteres con razón de omisión; migración 36
  `runs.phase_skills_json`; el detalle de la tarea muestra "Skills" con los ids. Proyectos existentes sin cambio
  (ninguna incluida es `automatic` fuera de `review`). Gates del cerebro: `test:coverage` 2369/0, `skills-library`
  16/16, `tasks` 43/43 (`gate:evidence` `SK.2-skills-library`); captura de chips mirada.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/SK.2-live.json`
  Revisión: Opus (diff de catalog, skill-route, prompt, harness, migración, handlers y SkillsView leído).
  Ejecutado por: codex gpt-6.1-sol (criterio r1 frenó por contradicción del spec con `AGENTS.md:101`, r2) · Spec: docs/specs/SK.2.md
  Texto visible: "Applies in" · "Plan" · "Build" · "Fix" · "Review" · "Docs" (chips de fase: un ícono no dice en qué fase aplica)
  Texto visible: "Skills" (rótulo plural cuando la tarea recibió varias)

- [x] **SK.3 — Perfil "¿sabes programar?": si el usuario no programa, el producto pregunta, revisa y audita solo.**
  (GO de Carlos 2026-11-06; 2026-11-07: tarjeta en el Chat vacío, perfil global) Perfil en `~/.orchestos/profile.json`
  con `GET`/`PUT /api/profile`; tarjeta "Do you write code?" en el Chat vacío y fila en Settings → General. Con "no":
  el chat entrevista con `grilling` antes de `create_task`, el revisor corre siempre y `security-audit` entra como gate.
  Hecho: `src/config/user-profile.ts` (lectura tolerante, escritura atómica), `handlers/profile.ts` (400 si `codes`
  no es booleano; same-origin del router), hook `useUserProfile` sincroniza tarjeta y Settings; `chat-context.ts`
  añade la sección "User profile:" con `grilling` cargada aunque el proyecto no la active (r2: antes caía bajo
  "Project state:"); `harness.ts` con perfil "no" fuerza el revisor y registra `security-audit` en
  `skill_gates_json` ("perfil: el usuario no programa" o "no instalada"); perfil inyectable en tests. Con
  `true`/`null` el prompt y el QA quedan idénticos. Gates del cerebro: `typecheck`, `lint`, `test:coverage` 2381/0,
  `user-profile` 8/8 (`gate:evidence` `SK.3-user-profile`), `chat-streaming` 27/27 y `codex-live` 15/15
  (`SK.3-chat-live`); capturas de tarjeta y Settings miradas.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/SK.3-live.json`
  Revisión: Opus (diff de perfil, handler, chat-context, harness, catálogo y UI leído; defecto de sección hallado
  y corregido en r2).
  Ejecutado por: codex gpt-6.1-sol (criterio r1) + gpt-6-luna (mecanico r2) · Spec: docs/specs/SK.3.md
  Texto visible: "Do you write code?" · "I write code" · "I don't write code" (la tarjeta pregunta una vez y se va)
  Texto visible: "I write code" · "Yes" · "No" (fila de Settings → General para cambiarlo después)
