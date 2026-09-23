# UI.13.2f — Memory, Specs, Skills, Instincts y Plan con datos reales (Lote L2, ítem 2)

Settings → proyecto → pestañas **Memory, Specs, Skills, Instincts, Plan**. Hoy las cuatro primeras arrancan con
`initialMock*` (`App.tsx:112-116`, de `data/mockOrchestosData.ts`) y sus acciones son locales o no-op: `App.tsx`
pasa `onForgetMemory/onRecordMemory/onToggleSkill/onTeachInstinct` pero `OrchestSettingsView` usa
`onResolveConflict/onLintSpec/onCompileSkill/onApproveInstinct/onRejectInstinct/onAddInstinct/onRunTask/
onExplainTask/onAddTask` (`OrchestSettingsView.tsx:2049-2090`), que caen en `() => {}`: botones que no hacen nada.
Regla UI.13: JSX de la plantilla intacto (className literal); se cambia la capa de datos, se cablean handlers y el
texto fijo que afirma algo pasa a ser el dato real. No tocar `/legacy` ni `src/dashboard/public/`.

## Regla general
Cada pestaña carga por `currentProject.id` (header `x-orchestos-project-id`) al abrir Settings, igual que `tasks`
(`App.tsx:271-289`), con estado de carga y error visible (una línea, no tragado). Cada botón llama a su endpoint real
y, al terminar, recarga su lista. Sin endpoint posible → botón `disabled` con `title` que dice por qué; nunca
un botón que no hace nada. Una capa por vista en `src/dashboard/app/src/api/<vista>.ts` con su test de mapeo;
reusar los `fetch` existentes, no duplicar. Al final `initialMock*` de estas 4 vistas y su import desaparecen de
`App.tsx` (si `mockOrchestosData.ts` queda sin uso, se borra).

## Cambios por vista
1. **Memory** — `GET /api/memory` + `GET /api/memory/conflicts?project=<id db>` (`handlers/memory.ts`).
   Backend: `GET /api/memory` con header de proyecto devuelve las entradas de ese proyecto + las `global`
   (sin header, igual que hoy). `hasConflict`/`conflictDetails` salen de los conflictos abiertos
   (`conflictingContent` = contenido de la otra entrada). `onResolveConflict(id, texto)`: endpoint
   `POST /api/memory/conflicts/:id/resolve` acepta `{ content }` opcional; si viene, actualiza el `content` de la
   entrada A (y su FTS) y marca resuelto; la entrada B no se borra. Test del backend.
2. **Specs** — `GET /api/specs` (`handlers/specs.ts`). `onApproveSpec` = `POST /api/specs/:id/approve`,
   `onLintSpec` = `GET /api/specs/:id/lint` (el resultado actualiza `lintStatus/lintFindings` de esa fila),
   `onDraftSpec` = `POST /api/specs/draft` (leer qué body exige y si llama a un LLM: si llama, el botón dice el
   modelo que usa, según regla "modelo = decisión de Carlos"; si exige un modelo no configurado, error visible).
   `criteria` desde el markdown real del spec (WHEN/THEN), no inventados.
3. **Skills** — `GET /api/skills` (`handlers/skills.ts`). `onCompileSkill` = `POST /api/skills/:id/build`.
   `usageRuns` = conteo real de runs con ese `skill_id` si existe fuente barata (DB), si no se omite el número (no 0
   fijo). `status`/`language`/`verifierCommand` desde el manifiesto real.
4. **Instincts** — `GET /api/instincts`. `onApproveInstinct` = `POST /api/instincts/:id/approve`,
   `onRejectInstinct` = `POST /api/instincts/:id/reject`, `onAddInstinct` = `POST /api/instincts`. Pestaña
   "review" = los no verificados reales.
5. **Plan (`PlanBoardView`)** — recibe `tasks` reales (ya). `onRunTask(id)` = el mismo `runTask` + espera de fin
   de run de UI.13.2d (`App.tsx` `handleRunNextTask`: extraer lo común, no copiar). `onExplainTask(id)` =
   `GET /api/tasks/:id/explain`; el modal muestra esa respuesta real: el párrafo fijo "💡 Dry-Run Verification:
   0 tokens spent…" se reemplaza por el resultado del explain (y su error si falla). `onAddTask`: **las tareas solo
   entran por chat** (regla de Carlos): el botón "Add task" lleva a Chat como `Create First Task`, no abre el
   modal de alta ni escribe `tasks.yaml`.

## Fuera de esta pasada
Borrado de memoria/specs/instincts desde estas vistas si la plantilla no lo tiene; alcance de memoria más allá de
proyecto+global (ERP.2); plan por proyecto de PLAN.md (`/api/plan`, UI.10.A).

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/project-tabs.mjs`, patrón de `tasks.mjs` (proyecto temporal con git, `orchestos
init` + `task init`, registrado por la API, `cleanup` que lo des-registra, borra su carpeta y **las filas de DB que
creó** — memoria, instinct, conflicto):
- Sembrar por API/DB del proyecto temporal: 1 memoria con conflicto, 1 spec en borrador, 1 instinct sin verificar,
  1 tarea corrible (Codex · gpt-5.6-luna · medium, campos como `tasks.mjs`).
- Memory: se ve la memoria sembrada y **ningún** texto de `mockOrchestosData.ts`; resolver el conflicto con texto
  nuevo → la API devuelve el conflicto cerrado y el contenido nuevo.
- Specs: aparece el spec; `Approve` → `/api/specs` lo da aprobado sin recargar; `Lint` cambia su fila.
- Skills: la lista coincide con `/api/skills`; `Compile` llama a `/build` (respuesta visible).
- Instincts: aparece en "review"; `Approve` → verificado en `/api/instincts`; alta nueva aparece en la lista.
- Plan: `Explain` muestra la respuesta de `/explain`, no "0 tokens spent"; `Run` corre la tarea y el badge cambia
  sin recargar; "Add task" lleva a Chat y no crea tarea.
- 0 errores de consola. Verde: `bun run gate:all` + `bun run ui:gate project-tabs` + `bun run ui:gate smoke`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues a otro agente. No toques `tasks.yaml` ni la memoria/instincts de este repo:
reproducciones solo con el proyecto temporal. `bun run typecheck` completo (dos tsconfig). No reportes
"preexistente" ni "aislado" sin la salida que lo demuestre. Al terminar: archivos tocados y salida real del gate.
