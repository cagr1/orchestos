# AUD.25 — UI que no hace lo que muestra

Ejecutor: `criterio`. No commitear, no tocar `PLAN.md`/`NEXT.md`. Sitios verificados por grep el 2026-11-12 salvo los
marcados "comprobar". Rutas de la app relativas a `src/dashboard/app/src/`.

## Qué cambiar

### 1. `!comando`
- Dev: `components/dev/OrchestDevWorkspace.tsx:432` solo corre con `onRunCommand`, que `App.tsx` no pasa (grep:
  única aparición, `:41,195,432`): el composer consume el borrador y no ejecuta nada.
  Arreglo: `App.tsx` pasa `onRunCommand(cmd)` que abre o reutiliza el tab terminal del proyecto
  (`session-tabs.ts:20` `openTerminalTab`, igual que `handleOpenTerminal`, `App.tsx:601`) y escribe `cmd + '\r'` en su
  PTY. `components/dev/OpenCodeTerminal.tsx:17` hoy solo recibe `{ projectId, kind }`: añadir la vía mínima para
  enviar entrada (p. ej. prop `pendingInput` que se envía por el WebSocket al abrir/estar abierto y luego se consume).
  Sin endpoint nuevo: el PTY de `/api/terminal` (`server.ts:748`) ya es la frontera.
- Chat: `components/chat/OrchestChatView.tsx:318` descarta `_isShellCmd` y manda `!…` al LLM como si fuera shell.
  Arreglo: en Chat el composer no entra en modo shell (`components/common/AgentComposer.tsx:264,380`: prop
  `shellMode?: boolean`, por defecto false, solo Dev la activa); `!` queda como texto normal.

### 2. Kanban sin columna `failed`
- `components/plan/PlanBoardView.tsx:98-104`: hay `failed_permanent` pero no `failed` (`TaskStatus` lo incluye); una
  tarea `failed` no aparece en ninguna columna. Añadir columna `failed` ("Failed", `bg-app-error`) antes de
  `failed_permanent`; comprobar `statusDot` (`:106`) y contadores.

### 3. Plan del kanban sin resultado
- `PlanBoardView.tsx:313` el botón "Plan" solo hace `setExplainModalTask(task)`; no pide ni limpia `explainResult`
  (`:65`), así que el modal muestra el resultado de otra tarea o nada. Reusar la carga de `:401-406`.

### 4. `purgingProjectIds` no se limpia tras purgar bien
- `App.tsx:1173-1190` `handlePurgeProjectData`: solo borra el id en el `catch`; tras purgar, el proyecto sigue
  existiendo y toda hidratación suya devuelve `[]` (`:349,823,859`) hasta recargar. Mover el `delete` al `finally`,
  como `handleDeleteProject` (`:1161-1162`).

### 5. Regla "Executor model" inválida
- `components/settings/OrchestSettingsView.tsx:3727` ofrece `id: ''` como "Executor model" cuando el agente es el del
  Ejecutor, pero `validRule` (`:1048-1051`) exige `model`. El servidor sí lo acepta (`src/router/engine-cascade.ts:20`:
  sin modelo vale si `rule.agent === cfg.roles.executor?.agent`). `validRule` debe aceptar modelo vacío en ese caso.

### 6. Enter confirma con el foco en Cancel
- `components/common/ConfirmDialog.tsx:38-42`: Enter llama `onConfirm` siempre. Si el foco está en un botón, Enter
  activa ese botón (no interceptar); solo confirmar con Enter cuando el foco no esté en Cancel ni en otro botón.

### 7. Búsqueda del inspector
- `components/dev/OrcaRightInspector.tsx:297-301`: el filtro por nombre oculta los hijos si la carpeta padre no
  coincide. Una carpeta se muestra si ella o algún descendiente coincide (y se expande mientras haya búsqueda).
- `:576-588` modo "contents" (`{}`) busca nombres igual que "Aa" (`searchMode` solo cambia el estilo, `:162,565,578`).
  Implementar búsqueda por contenido: `GET /api/explorer/search?q=` en `src/dashboard/handlers/explorer.ts`
  (exporta en `:209`, rutas en `server.ts:703-713`) con `git grep -l -I -F --` en la raíz del proyecto resuelto,
  tope de resultados (p. ej. 200), consulta mínima 2 caracteres, `spawn` con array (sin shell) y la misma resolución
  de proyecto/`guardRequest` que `/api/explorer/tree`. El inspector muestra la lista de archivos que coinciden.

### 8. Resumen de herramientas recortado en Dev
- `OrchestDevWorkspace.tsx:454-480,622-…`: muestra `readSteps[0..2]`, `editStep = find` (solo la primera edición) y
  solo el primer comando fallido y el primero correcto. Mostrar todas las lecturas, ediciones y comandos (lista con
  scroll o "+N más" expandible), sin cambiar el look.

### 9. Formularios que cierran sin esperar el guardado
- `components/instincts/InstinctsView.tsx:30-37`: `onAddInstinct` sin `await`, cierra y borra lo escrito antes de
  saber si guardó. Igual en `components/memory/MemoryView.tsx` (~`:42`, comprobar). Esperar la promesa; si falla,
  dejar el modal abierto con el texto y el error.

### 10. Subidas sin abort al desmontar
- `components/common/AgentComposer.tsx:575-592`: los `AbortController` de `uploadControllers` solo se abortan al
  quitar un adjunto (`:623`). Abortarlos todos en el cleanup de desmontaje.

### 11. Backend del informe (comprobar antes de tocar; si no se confirma, decirlo y no tocar)
- `src/usage/cli-transcripts-reader.ts:130,144`: todo el consumo de una sesión Codex se atribuye a la última fecha y
  modelo; debe ir por evento.
- `src/run/html-script-check.ts:143`: concatena `<script type="module">` independientes y rechaza HTML válido;
  comprobar cada script por separado.
- `src/skills/scaffold.ts:195` vs `src/skills/targets/_shared.ts:56`: clave de lenguaje normalizada contra nombre
  literal; usar la misma normalización.

## Qué no tocar
- `handlers/skills.ts` (AUD.16), refactor de `App.tsx` (AUD.28). Sin CSS nuevo en `styles.css`: clases existentes.

## Cómo se verifica
- Tests unitarios por caso donde haya lógica: `validRule` con modelo vacío; filtro del árbol con hijo que coincide y
  padre que no; `ConfirmDialog` Enter con foco en Cancel → cancela/no confirma; endpoint de búsqueda (coincide, sin
  coincidencias, consulta corta → 400, fuera del proyecto no); columna `failed`; `purge` limpia el set; formulario que
  falla no se cierra; los tres del punto 11 si se confirman.
- `bunx tsc --noEmit`, `bun run lint`, tests afectados. `test:coverage` lo corre el cerebro.
- Un step de ui-gate por caso de UI (1–9) en el flujo existente más cercano (`dev-terminal.mjs`, `tasks.mjs`,
  `project-settings.mjs`, `model-routing.mjs`, `chat-*`, `diff-view.mjs`…) o uno nuevo `aud25-ui.mjs`. Tras tocar
  flujos: `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`. Si el sandbox no puede
  correrlos, dejarlos escritos y decirlo; los corre el cerebro.
