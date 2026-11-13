# Cerrados de LRN — OrchestOS aprende de los errores (LRN.1, 2026-11-13)

Padre abierto en `PLAN.md` (falta F2). Diseño: `docs/specs/LRN-1-opinion-fable.md`. Movidos desde `PLAN.md` el
2026-11-13.

- [x] **LRN.1a — Cimientos de lecciones sin LLM (F0).**
  Globales aplicadas, tope D2 en `listApplicable` (15 lecciones o 4.000 caracteres), columnas `why`,
  `evidence_json`, `injected_count`, `last_injected_at` y `runs.instinct_ids_json` (los ids viajan en
  `ctx.instinctIds` y se persisten en los ocho caminos de `insertRun`). Tests 231/231; `docs/done/evidence/LRN.1a-live.json`.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/LRN.1a.md

- [x] **LRN.1b — El chat recibe lecciones y puede proponerlas (F1).** Gate en vivo: navegador Playwright, `lessons` 10/10 con CLI falso (propose_lesson → propuesta auto con turnId; Remember → manual verificada; duplicado → error; Edit; segundo turno recibe `## Lessons`), `docs/done/evidence/LRN.1b-live.json`.
  Bloque `## Lessons` en el prompt del chat (`listApplicable`, mismo tope), `recordInjected` solo si el turno llega
  al modelo. Herramienta `propose_lesson` (MCP y API) solo con proyecto, máximo 3 por turno; trigger duplicado se
  omite sin romper el turno y responde 409 en create/PATCH. Acción Remember por mensaje; `PATCH /api/instincts/:id`;
  la tarjeta muestra why, cita y uso, y permite editar. qa (Codex) halló el conteo en turnos 422; corregido.
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (mecanico: addenda, gate `lessons`, contador) · Spec: docs/specs/LRN.1b.md
  Texto visible: "Remember", "When", "Do", "Why", "Save", "Cancel", "Edit", "Injected N times", "A lesson with this trigger already exists"; reindentados sin cambio: "Copy", "Learned Action", "Approve (+0.10)", "Reject", "Active in middleware chain" — guardar una lección necesita decir cuándo aplica y qué hacer; un ícono solo no lo distingue de copiar.

- [x] **LRN.1c — Ciclo de vida de lecciones y graduación a AGENTS.md (F3).** Gate en vivo: navegador Playwright, `lessons` 18/18 (lección de hace 61 días en Review → Keep la saca; "Add to AGENTS.md" muestra el diff → Cancel no escribe → Add escribe el bloque y la retira; el turno siguiente no la inyecta), `docs/done/evidence/LRN.1c-live.json`. (GO de Carlos 2026-11-13: "continúa")
  Migración 42: `instincts.status` (`active|review|retired`) y `status_changed_at`; `listApplicable` solo `active`;
  `sweepStaleLessons` (60 días sin actividad → `review`, nunca borra) al listar. `POST /api/instincts/:id/status` y
  `/graduate` (vista previa sin `confirm`; recalcula desde el archivo, rechaza symlink y lecciones globales). Desvío
  del spec, a propósito: la migración fija `status_changed_at` al migrar, porque el uso solo se registra desde la 41;
  sin eso toda lección vieja caería a `review` al abrir la vista. qa (Codex) halló que un marcador citado en una
  lección desplazaba el bloque: los marcadores ahora cuentan solo como línea completa (test en
  `lesson-lifecycle.test.ts`). Fuera: cita rota (la cita es un mensaje de chat) y recurrencia (necesita la firma de
  F2). F2 espera datos de F0 (D6).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fix chico: migración y marcadores) · Spec: docs/specs/LRN.1c.md
  Texto visible: "Unused for 60 days", "Keep", "Retire", "Add to AGENTS.md", "Add", "Cancel", "Creates AGENTS.md", "Retired"; reindentados sin cambio: "Edit", "Approve (+0.10)", "Reject", "Active in middleware chain" — conservar, retirar y escribir en un archivo del usuario son tres salidas distintas; un ícono no las distingue.
