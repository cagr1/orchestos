# USO.51 — Carpetas de solo lectura por proyecto para el chat

Ítem: PLAN.md USO.51. Rol: criterio. No commitear ni tocar PLAN.md/NEXT.md.

## Caso real
El chat de Agro (Claude) no pudo leer `~/Projects/MemoriesMD`: el chat de proyecto corre con `--restricted` y un solo
`--add-dir` (el proyecto). Regla de producto: un control guía, no bloquea sin salida → el usuario autoriza carpetas
de solo lectura por proyecto, y el rechazo ofrece autorizarla.

## Contexto (verificado con grep, 2026-11-26)
- Solo Claude tiene frontera de lectura: `buildClaudeChatArgs` (`src/run/executors/external.ts:487-545`) pasa
  `--restricted`, `--tools Read,Glob,Grep` y `--add-dir projectRoot`; adjuntos con un `--add-dir` extra (línea ~535).
  Codex chat es `--sandbox read-only` y ya lee fuera de cwd (`cli-registry.ts:113`, `readBoundary: none`): no se toca.
- `runClaudeChat(cwd, …, generalChat, cut)` (`external.ts:569`), llamado desde el adaptador Claude
  (`src/run/executors/chat-adapters.ts:164-180`) con `CliTurnInput` (`chat-adapters.ts:24-55`).
- El turno se arma en `src/dashboard/handlers/chat.ts:1929` (`cliAdapter.runTurn({...})`); el proyecto se resuelve en
  `chat.ts:968-982` (`project.id`, `generalSession`, `isCut`). El resultado trae `result.readAudit` (`chat.ts:1963`).
- `ClaudeReadAudit` ya marca `outcome: 'rejected'` cuando el tool_result termina en
  `--restricted confines the file tools to the working directory.` (`src/run/read-audit.ts:262-281`);
  `ReadOperation.requestedPath` (`read-audit.ts:3-10`).
- Ajustes por proyecto: tabla `projects` (migración 37 `src/db/migrate.ts:1205-1225`, última versión 44 en
  `migrate.ts:1372`), `ProjectSettings` + `updateProjectSettings` (`src/db/projects.ts:87-135`), PATCH
  `handleApiProjectPatch` (`src/dashboard/handlers/projects.ts:46-73`, hoy solo admite string|null),
  `publicProjectRow` (`projects.ts:191-206`), UI `src/dashboard/app/src/components/settings/ProjectGeneralSettings.tsx`
  (bloque Setup script ~112-124).

## Cambios
1. DB: migración 45 `projects.read_dirs TEXT` (JSON array de rutas absolutas), con pre/postcondición como la 37.
2. `src/db/projects.ts`: `read_dirs` en `ProjectRow` y `ProjectSettings`. Validación al guardar: cada ruta absoluta
   (expandir `~`), existe, es carpeta, `realpath`, sin duplicados, no dentro del proyecto ni igual a `/` o al home
   entero; máx. 20. Error claro por ruta inválida (mismo estilo que base_branch).
3. PATCH: campo `readDirs: string[] | null` (array de strings; el resto de campos sigue string|null).
   `publicProjectRow` expone `readDirs: string[]` (vacío si NULL). Tipo del front si lo hay.
4. Chat: `CliTurnInput.readDirs?: string[]`; `chat.ts` lo llena desde el proyecto solo si hay proyecto, no es sesión
   general y no es `/cut`. `runClaudeChat` recibe `readDirs` (parámetro nuevo al final) y `buildClaudeChatArgs` agrega
   `--add-dir <dir>` por cada una. Herramientas sin cambio: el chat sigue siendo solo lectura.
5. Rechazo → autorizar: tras el turno, de `result.readAudit.operations` con `outcome === 'rejected'` y
   `requestedPath` fuera del proyecto, derivar la carpeta (la ruta si es carpeta, si no su `dirname`). Si hay alguna,
   el mensaje del asistente la lleva como dato (mismo mecanismo con que el mensaje ya transporta metadatos; buscarlo
   en `chat.ts` / tipos de mensaje) y el hilo muestra una acción "Allow read access to <dir>" que hace el PATCH
   añadiendo la carpeta y avisa que aplica desde el siguiente turno. Sin CSS nuevo: componentes y clases existentes.
6. Settings del proyecto: grupo "Read-only folders" en `ProjectGeneralSettings.tsx`: lista con quitar por fila y un
   input de ruta que añade con Enter; texto de ayuda de una línea ("The chat can read these folders; it never
   writes to them."). Copiar el patrón visual de las filas existentes.

## Tests
- `buildClaudeChatArgs` con `readDirs` → un `--add-dir` por carpeta; con `generalChat` o `cut` no se agregan.
- Validación de `updateProjectSettings` (relativa, inexistente, archivo, dentro del proyecto, `/`, duplicada → error;
  válida → guardada normalizada) y PATCH con `readDirs` (array ok, no-array → 400).
- Migración 45 aplica y su postcondición pasa (patrón de los tests de migraciones existentes).
- Derivación de carpetas rechazadas desde un `ReadAudit` de ejemplo.

## No tocar
Codex/OpenCode, `CLAUDE_CHAT_BOUNDARY_FLAGS`, herramientas del chat, escritura fuera del proyecto, tareas/worktrees.

## Verificación
`bunx tsc --noEmit`, `bun run lint`, tests de external/claude-chat, projects, migrate, chat. Gate en vivo lo corre
el cerebro.
