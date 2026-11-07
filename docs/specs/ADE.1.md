# ADE.1 — Editar archivos desde el explorer

Ítem: `PLAN.md` § ADE.1. Hoy el archivo abierto en Dev es de solo lectura: `DevFilePanel.tsx` lo pinta con
highlight.js (`FileSource`, `<pre>`) y la API solo tiene GET. Objetivo: editar y guardar como en Orca/VS Code.

## Qué cambiar

### Backend — `src/dashboard/handlers/explorer.ts` y `src/dashboard/server.ts`

1. `handleApiExplorerFile` (explorer.ts:86) suma `mtimeMs: stat.mtimeMs` a las tres respuestas JSON.
2. Nueva `async function handleApiExplorerWrite(req: Request, root: string): Promise<Response>`, exportada junto a
   las otras (explorer.ts, línea final `export { ... }`). Body JSON `{ path: string, content: string,
   expectedMtimeMs: number }`.
   - Body inválido / `path` vacío / `content` no string → 400.
   - `safeResolve(root, path)` (explorer.ts:33) null → 400 `Invalid path`.
   - Symlinks: `realpathSync(target)` debe quedar dentro de `realpathSync(root)` (mismo criterio
     `=== root || startsWith(root + sep)`); si no → 400 `Invalid path`. Solo se editan archivos que ya existen:
     no existe → 404; no es archivo → 400.
   - Cualquier segmento del path igual a `.git` → 400.
   - `Buffer.byteLength(content) > MAX_FILE_BYTES` (explorer.ts:10) → 413.
   - Archivo actual binario (mismo sniff de null byte, explorer.ts:115) → 400 `Binary file`.
   - `Math.abs(stat.mtimeMs - expectedMtimeMs) > 1` → 409 con JSON `{ error: 'conflict', mtimeMs, content }`
     (contenido actual del disco).
   - Escritura atómica: `writeFileSync(<target>.orchestos-tmp-<pid>-<Date.now()>, content)` + `renameSync`
     sobre el destino; conserva el modo (`chmodSync(tmp, stat.mode)` antes del rename). En error, borra el tmp.
   - 200 `{ path, mtimeMs }` con el `mtimeMs` nuevo.
3. `server.ts:581`: tras el GET de `/api/explorer/file`, sumar
   `if (method === 'PUT' && url.pathname === '/api/explorer/file') return withDashboardProject(req, (project) =>
   handleApiExplorerWrite(req, project.root))`. El chequeo de mismo origen para PUT ya existe (server.ts:173).
4. Actualizar el comentario de explorer.ts:6-8 ("read-only") para que diga que lee y edita archivos existentes.

### Cliente — `src/dashboard/app/src/api/explorer.ts`

5. `getExplorerFile` devuelve también `mtimeMs`. Nueva `saveExplorerFile(path, content, expectedMtimeMs,
   projectId)`: `PUT` con header `x-orchestos-project-id` y `content-type: application/json`. 409 → devuelve
   `{ conflict: true, mtimeMs, content }`; otro error → lanza `Error` con el mensaje del servidor.

### Editor — CodeMirror 6

6. Dependencias en `package.json` (raíz, donde ya están `highlight.js` y `@xterm/xterm`): `@codemirror/state`,
   `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`,
   `@codemirror/lang-javascript`, `@codemirror/lang-json`, `@codemirror/lang-css`, `@codemirror/lang-markdown`,
   `@codemirror/lang-yaml`, `@lezer/highlight`. Lenguajes = los mismos que `lib/highlight.ts` (ts/tsx/js/mjs, json,
   css, md, yaml; bash y el resto quedan como texto plano). `build-app.ts` no usa splitting: va en `main.js`;
   anotar en la evidencia el tamaño de `main.js` antes y después.
7. Nuevo `src/dashboard/app/src/components/dev/CodeEditor.tsx`: monta un `EditorView` con `lineNumbers`,
   `highlightActiveLine`, `history`, `drawSelection`, `bracketMatching`, `indentOnInput`, `search` (⌘F),
   `keymap` (`defaultKeymap`, `historyKeymap`, `searchKeymap`, `indentWithTab`) y el lenguaje según la extensión.
   Props: `path`, `value`, `onChange(text)`, `onSave()`. ⌘S/Ctrl+S → `onSave` con `preventDefault` (no debe abrir
   el diálogo del navegador). Tema con `EditorView.theme` y `HighlightStyle.define` usando solo variables
   `var(--app-*)` existentes (fondo, texto, muted, accent, borde); **no se suma nada a `styles.css`**. Fuente mono
   igual a la que usa hoy `FileSource`. Si cambia `value` desde fuera (recarga), reemplaza el documento sin
   perder el scroll.

### Buffers por archivo — sobreviven al cambio de tab

`DevFilePanel` se monta con `key={activeProjectId}` (App.tsx:1667) y hoy hace `setFiles({})` al cambiar de
path (DevFilePanel.tsx:57): lo editado se perdería al cambiar de tab.

8. Nuevo `src/dashboard/app/src/components/dev/file-buffers.ts` (puro, con test): store a nivel de módulo
   indexado por `${projectId}:${path}` con `{ saved: string, draft: string, mtimeMs: number }`, más
   `subscribe(listener)`, `isDirty(projectId, path)`, `dirtyPaths(projectId): Set<string>`, `setDraft`,
   `markSaved(content, mtimeMs)`, `replaceFromDisk(content, mtimeMs)`, `drop(projectId, path)`.
9. `DevFilePanel.tsx`: carga a buffer si no existe (si existe, usa el buffer y no pisa el draft); el código fuente
   (`FileSource` y la vista Source del markdown) pasa a `CodeEditor`. El markdown sigue abriendo en Preview y
   "Source" es el editor. Binario o `tooLarge`: hoy `getExplorerFile` (api/explorer.ts:52) descarta esos campos
   y el panel muestra vacío (bug). `getExplorerFile` devuelve `binary`, `tooLarge` y `sizeBytes`; el panel, sin
   editor, muestra un texto centrado `text-app-muted`: "Binary file — not shown" o "File too large to open
   (<N> KB)" (N = `Math.round(sizeBytes / 1024)`), con `data-file-unavailable`.
   Al ganar foco la ventana (`focus` / `visibilitychange`) y al activar el tab, re-pide el archivo:
   - sin cambios propios y `mtimeMs` distinto → `replaceFromDisk` (recarga sola);
   - con cambios propios y `mtimeMs` distinto → barra arriba del editor: "Changed on disk" + botones
     "Keep mine" (guarda con el `mtimeMs` del disco) y "Reload" (`replaceFromDisk`).
   El 409 al guardar muestra la misma barra. Error de guardado: `role="alert"` con el mensaje.
   Footer: a la derecha del path, "Unsaved" cuando hay cambios. Atributos para el gate:
   `data-file-editor` en el contenedor del editor, `data-file-dirty` en el footer cuando hay cambios,
   `data-file-conflict` en la barra.
10. `DevSessionTabs.tsx`: nueva prop `dirtyFileTabs: Set<string>` (ids `file:<path>`). Un tab de archivo sucio
    muestra un punto en lugar de la ✕ y la ✕ al pasar el mouse (como VS Code), con `data-dirty` en el tab.
    `App.tsx` la calcula con `dirtyPaths(activeProjectId)` suscrito al store.
11. Cerrar un tab sucio (✕ y el `onClose` de App.tsx:1645) pide confirmación con el diálogo de confirmación que
    en un modal nuevo `components/dev/DiscardChangesModal.tsx` que copia la estructura y las className de
    `components/layout/DeleteProjectModal.tsx` (74 líneas; no hay diálogo de confirmación genérico):
    "Discard unsaved changes to <name>?", botones "Cancel" y "Discard"; Esc cancela.
    Aceptar → `drop` + cerrar. `beforeunload` con cambios sin guardar en cualquier archivo → aviso del
    navegador.

## Texto visible nuevo (va al ítem en PLAN.md como `Texto visible:`)

"Unsaved" (estado que un ícono solo no explica en el footer), "Changed on disk", "Keep mine", "Reload" (decisión
del usuario, necesita palabras), "Discard unsaved changes to <name>?" (confirmación destructiva), "Binary file —
not shown" y "File too large to open (<N> KB)" (antes el panel quedaba vacío sin explicar por qué).

## Qué NO tocar

- `DevDiffPanel` (los diffs siguen de solo lectura; diffs editables quedan fuera).
- Crear, renombrar o borrar archivos desde el árbol (fuera de alcance).
- `styles.css` (no se suma CSS), `ThreadMarkdown`, `lib/highlight.ts` (lo siguen usando otras vistas).
- Settings (auto-guardado y fuente son ADE.2).

## Cómo se verifica

- Test de backend nuevo `src/dashboard/__tests__/explorer-write.test.ts` (patrón de `explorer-ignored.test.ts`):
  guarda y devuelve `mtimeMs` nuevo; 409 con `expectedMtimeMs` viejo y devuelve el contenido del disco; 400 con
  `../x`, con `.git/config` y con un symlink dentro del root que apunta fuera; 404 si no existe; 413 si excede;
  400 binario; conserva el modo del archivo (un `0o755` sigue `0o755`).
- Test de `file-buffers.ts`: draft sobrevive a otro path, `isDirty`, `markSaved`, `replaceFromDisk`, `drop`.
- Ui-gate nuevo `scripts/ui-gate/flows/dev-file-edit.mjs` (andamiaje de `dev-session-tabs.mjs`: root temporal con
  `notes.txt` y `src/index.ts`): abrir `notes.txt` → escribir → tab con `data-dirty` y footer "Unsaved" → ⌘S →
  sin `data-dirty` y el archivo en disco tiene el texto nuevo; cambiar a `src/index.ts` y volver sin perder un
  draft; con draft, escribir el archivo en disco desde el flujo, disparar `focus` → barra `data-file-conflict` →
  "Reload" deja el contenido del disco; sin draft, cambio en disco + focus → recarga sola; cerrar tab sucio →
  confirmación. Capturas en cada estado.
- Gates: `bunx tsc --noEmit`, `bun run build:app`, `bun run test:coverage`,
  `bun run gate:evidence -- --label ADE.1-dev-file-edit -- bun run ui:gate dev-file-edit dev-session-tabs`.
