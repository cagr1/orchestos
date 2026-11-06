# Bloque TRUST — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-trust-seccion-confianza-en-el-flujo---trust--go-de-car"></a>
### Confianza en el flujo — TRUST (GO de Carlos 2026-10-22)

Regla: nada se reintenta, cierra ni muestra sin evidencia medida que el usuario vea. Opinión de LLM se marca como tal.

- [x] **TRUST.0 — 🔍 Auditar la evidencia de cada paso del flujo.** (cerrado 2026-10-22) Tabla y 7 huecos verificados
  leyendo el código en `docs/specs/TRUST.md`; orden por riesgo: TRUST.2, TRUST.1, TRUST.3, CI.23.
  Ejecutado por: codex gpt-6-luna (leer) + verificación del cerebro · Spec: docs/specs/TRUST.md
- [x] **TRUST.2 — ⚡ "QA pass" solo si algo verificó.** (cerrado 2026-10-22) Sin criterios el juez no corría y se
  escribía `pass` (`src/run/harness.ts:783`). Ahora veredicto `skipped` con motivo que dice qué verificó (checks corridos o
  "nada verificó esta tarea"); `graph-runner`/`cli` copian el veredicto real, no un literal. UI: "Sin QA · n checks",
  "Sin verificar" (aviso) o "QA pass/fail"; `skipped` no cuenta en la tasa de pase. Evidencia del cerebro: diff leído,
  typecheck y lint limpios, 45/45 unitarios, captura del run "Sin verificar"; `test:coverage` 1985/0 (ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.2-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.2.md
- [x] **TRUST.1 — ⚡ El reintento recibe la causa medida, no un resumen.** (cerrado 2026-10-22) `formatCheckFailure`
  (`src/run/checks.ts`): cmd + exit/expected o timeout + cola de stderr/stdout, ≤ 1800. El prompt conserva primera línea
  y final (antes cortaba el final). Fallo de QA llega como "Opinión del juez QA (<modelo>): …". UI: salida bajo el check
  fallido en Runs; el detalle de tarea muestra el motivo sin exigir `retryCount > 0` y avisa "No hay registro de por qué
  falló". Evidencia del cerebro: diff leído, typecheck y lint limpios, 63/63 unitarios, capturas con `TRUST1-MARKER` en
  Runs y en Tasks; `test:coverage` 1991/0 (ejecutor). Dos paradas del ejecutor por casos borde de recorte no definidos
  en el spec (corregido el spec, no el ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.1-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.1.md
- [x] **TRUST.3 — ⚡ La UI separa medida de opinión.** (cerrado 2026-10-22) Pestaña QA de Runs en "Medido" (checks y su
  salida) y "Opinión del juez (<modelo>)" (veredicto y criterios); un check fallido ya no aparece como "QA verdict";
  juez que no corrió en tono neutro, sin ✗; sin checks ni juez "Nada verificó este run". La respuesta del ejecutor se
  titula "Lo que reporta el ejecutor (no verificado)" y se muestra también en runs `done`. Evidencia del cerebro: diff
  leído, captura de `qa-negative` con las dos secciones; typecheck, lint, fidelidad JSX y `test:coverage` 1992/0
  (ejecutor). Una aserción propia del ejecutor (reply en run `done`) se retiró porque el run real trae
  `executor_reply: null` → TRUST.4.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.3.md
- [x] **TRUST.4 — 🔍 Un run `done` de Codex no guarda lo que reportó el ejecutor.** (cerrado 2026-10-22) Bug del producto:
  3 de 7 `insertRun` de `harness.ts` (éxito, excepción, fallo previo a checks) no pasaban `executor_reply`; ERP.4.8 lo
  había acotado a fallos. Ahora todos. Evidencia del cerebro: diff leído, typecheck, 4/4 `harness-executor-reply`
  (contraprueba contra HEAD: `Received: null`), captura del run `done` con el texto real de Codex bajo "Lo que reporta
  el ejecutor (no verificado)"; `test:coverage` 1992/0 (ejecutor). Luna (`mecanico`) paró dos veces: `writer-lock check`
  daba EPERM en el sandbox (arreglado en el vault `520f0e0`: el refresco no bloquea la autorización) y luego afirmó
  cambios ajenos en `tasks.mjs` que no existían; pasó a Sol.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.4-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.4.md
- [x] **TRUST.5 — 🔍 La pestaña resaltada en el detalle de un run no es la que se ve.** (cerrado 2026-10-22) No era bug
  del componente: las clases eran correctas; las capturas de ui-gate se tomaban dentro de la transición de 150 ms y la
  evidencia visual mentía. `shot` (`scripts/ui-gate/run.mjs`) espera 300 ms antes de capturar; `qa-negative` afirma las
  clases de las pestañas. Evidencia del cerebro: diff leído, captura nueva con "QA Assertions" resaltada; `test:coverage`
  1992/0 (ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.5-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.5.md
- [x] **TRUST.R2 — 🔍 Auditar aprobaciones, undo y lo que el chat afirma de las tareas.** (cerrado 2026-10-23) Mapeo de
  Sol (`analizar`), huecos altos verificados por el cerebro leyendo el código. Tabla y huecos: `docs/specs/TRUST.md` §
  Ronda 2. Sin delegación de código: auditoría de solo lectura.
- [x] **TRUST.6 — ⚡ El reporte de tarea dice "done" solo con un run `done` del mismo proyecto.** (abierto y cerrado 2026-10-23)
  `task-report.ts:39-44`: el titular sale de `tasks.yaml` sin mirar el run (puede decir "✓ done" + "No run was
  recorded."), y sin run del proyecto usa `runs[0]` de cualquier proyecto (evidencia ajena con el mismo ID de tarea).
  Arreglo: run válido = el del mismo proyecto; sin `projectId` no se adjunta run (el lanzamiento sin proyecto tampoco
  le pone `project_id`). `✓ done` exige yaml `done` + run `done`; si no, "marked done in tasks.yaml · latest run <estado>"
  o "· no matching run recorded" y `outcome` = estado del run o `pending` (la tarjeta no lo pinta como éxito). Sin
  hermanos con el mismo defecto. Contraprueba: 5 tests fallan contra HEAD. Cerebro: tests 64/0 + thread.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.6-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/TRUST.6.md
- [x] **TRUST.6.1 — ⚡ Regresión de TRUST.6: el test de reconcile esperaba "✓ done" sin run.** (abierto y cerrado 2026-10-23)
  `task-run-reconcile.test.ts:165` crea la tarea `done` sin run y sigue esperando `✓ done`: 15/1 en HEAD, 16/0 en
  HEAD~1. Visto por Sol al correr `src/dashboard/handlers` en TRUST.7; el cerebro corrió solo suites acotadas al cerrar
  TRUST.6. No llegó a CI (sin push).
  Arreglo: el test registra un run `done` del proyecto y pasa el watch con su `project_id`; la expectativa no cambia.
  Cerebro: diff leído, 16/0. Lección: al cambiar un texto que el producto emite, `grep -rn` del texto viejo en tests.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.6.1.md
- [x] **TRUST.7 — ⚡ Undo comprueba que el rollback quedó limpio.** (abierto y cerrado 2026-10-23) `runs.ts:253-266`: si el
  commit del undo falla, `revert --abort` no se comprueba; podrían quedar cambios inversos aplicados con el error a la
  vista. Verificar árbol vs. HEAD tras abortar y mostrar residuos. Inferido, reproducir primero: un run con varios
  commits (fast-forward, `sandbox.ts:194/253`) registra solo HEAD y el undo revierte solo ese.
  Reproducido antes de arreglar (Sol): 2 commits en el worktree → undo dejaba vivo el primero. Arreglo: el merge guarda
  la base tomada bajo el candado (`runs.commit_base_sha`, migración 31 aditiva, sin backfill) y el undo revierte el
  rango lineal completo (rechaza historia no lineal); tras abortar o commitear compara HEAD y árbol, y solo marca
  revertido si quedó limpio (si no: `rollbackClean:false` + `residualFiles`). Runs viejos sin base: undo de un SHA.
  Contraprueba: 5 tests fallan contra HEAD. Cerebro: diff leído, `test:coverage` 2003/0, `chat-task-undo` 16/16.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.7-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/TRUST.7.md
- [x] **TRUST.7.1 — ⚡ La tarjeta muestra los archivos residuales de un undo que no quedó limpio.** (abierto y cerrado 2026-10-23)
  TRUST.7 devuelve `residualFiles` con 500; `revertRun` (`api/runs.ts:141`) y `TaskCard.tsx:202` solo pasan archivos en
  409 → el usuario vería el error sin los archivos.
  Arreglo: `revertRun` pasa `residualFiles` y la tarjeta los pinta con cualquier status (lista existente, sin JSX nuevo).
  Cerebro: diff leído, typecheck, `test:coverage` 2003/0, `chat-task-undo` 16/16 (camino feliz). **Sin verificar en
  vivo el caso residual**: requiere un revert que deje residuos, que el flow no puede fabricar.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.7.1-live.json` (misma corrida que TRUST.7)
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.7.1.md
- [x] **TRUST.7.2 — ⚡ Los tests de TRUST.7 asumen que `git init` crea `.git/hooks`.** (abierto y cerrado 2026-10-23) El
  pre-push (HOME temporal, sin plantilla de git) falló 3 tests de `run-revert.test.ts` con `ENOENT …/.git/hooks/
  pre-commit`; localmente pasaban. Hermano: `scripts/ui-gate/flows/tasks.mjs:101` (CI.40).
  Arreglo: `mkdirSync(.git/hooks, recursive)` antes de cada hook (3 tests + el flow). Cerebro: 15/0 con
  `HOME` temporal, `GIT_CONFIG_GLOBAL=/dev/null` y `GIT_TEMPLATE_DIR` vacío. Trampa: un fixture que escribe hooks crea
  la carpeta, como `commit-tasks-yaml.test.ts:110`.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.7.2.md
- [x] **TRUST.8 — ⚡ El chat no promete lo que no pasó.** (abierto y cerrado 2026-10-23) `create_task` responde al orquestador
  "the user will see it and approve it" (`src/mcp/server.ts:34`, `adapters.ts:118`) aunque fuera de modo manual arranca
  solo (`chat.ts:1169`); "Started" se añade tras el spawn, sin estado `running` (`chat.ts:1189`); la nota del sistema
  va pegada al texto libre del LLM (`chat.ts:1199`) y no se distingue. Aprobación: OpenCode sin `metadata.diff` y
  `NotebookEdit` de Claude ofrecen aprobar una ruta sin cambio visible (`opencode-approval.ts:22`,
  `claude-approval.ts:14-22`) → avisar que falta el detalle.
  Arreglo (Sol): `CREATE_TASK_RESPONSE` dice que la propuesta se recibió, que OrchestOS la correrá o retendrá y que
  no diga que está hecha; `▶ Started` → `▶ Run requested` (es el spawn, no `running`) y la tarjeta absorbe esa nota
  (ya no sale duplicada en la burbuja); Claude/OpenCode/Codex avisan "did not provide the content of this change" en
  el detalle de la aprobación. Ajuste del cerebro: fuera las etiquetas "Model statement (unverified)" y "OrchestOS:"
  que Sol puso en cada respuesta (texto que no aporta; el estado medido es la tarjeta) — Luna. `chat-followup-task` y
  `chat-task-undo` miden la tarea por `/api/tasks` + tarjeta visible, no por el texto (Luna). En vivo, el modelo ahora
  dice "la creación aún no está confirmada". Cerebro: `test:coverage` 2007/0; `chat-streaming` 27/27, `codex-live`
  14/14, `chat-followup-task` 9/9, `chat-task-undo` 17/17; `chat-permissions` 9/9 en la corrida anterior y sola, 1 fallo
  en la del archivo de evidencia → CI.41.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.8-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, 2 ajustes) · Spec: docs/specs/TRUST.8.md
