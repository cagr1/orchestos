# ADE.2 — Settings → Editor: auto-guardado, ajuste de línea y tamaño de fuente

Ítem: `PLAN.md` § ADE.2. Depende de ADE.1 (`8c56a98f`): editor en `components/dev/CodeEditor.tsx`, guardado en
`DevFilePanel.tsx` (`save`, línea ~87). Referencias: Orca ("Auto Save Files", "Auto Save Delay", "Editor Word
Wrap"), MonoCode y VS Code. Preferencias por dispositivo en `localStorage`, como tema e idioma
(`App.tsx:118`, `App.tsx:242-252`).

## Qué cambiar

1. Nuevo `src/dashboard/app/src/lib/editor-settings.ts` (puro + hook, con test):
   - Tipo `EditorSettings = { autoSave: 'off' | 'afterDelay', autoSaveDelayMs: number, wordWrap: boolean,
     fontSize: number }`. Defaults (los de VS Code; con ellos el editor se comporta igual que hoy):
     `{ autoSave: 'off', autoSaveDelayMs: 1000, wordWrap: false, fontSize: 12 }`.
   - Clave `localStorage` `orchestos-editor`. `readEditorSettings()` valida y recorta: delay 500–10000 en pasos
     de 500, fontSize 10–24; JSON roto o campos inválidos → default del campo.
   - `writeEditorSettings(partial)` mezcla, guarda y notifica; `useEditorSettings()` con `useSyncExternalStore`
     (escucha también el evento `storage` para otra pestaña).
2. `CodeEditor.tsx`: lee `useEditorSettings()`. `wordWrap` → `EditorView.lineWrapping`; `fontSize` → tamaño
   de `.cm-scroller` (hoy fijo en `12px`) con `lineHeight` = `fontSize * 2` px. Cambiarlos no recrea el editor ni
   pierde cursor o historial: usar un `Compartment` por cada uno y `reconfigure`.
3. `DevFilePanel.tsx`: con `autoSave === 'afterDelay'`, tras cada cambio del draft se reinicia un temporizador de
   `autoSaveDelayMs`; al vencer, si el archivo sigue sucio y no hay conflicto abierto, llama a `save()`. Se cancela
   al desmontar o cambiar de archivo. Con un conflicto abierto no guarda solo (decide el usuario). ⌘S sigue
   guardando al instante.
4. `OrchestSettingsView.tsx`:
   - Nueva sección `editor` en el grupo "App" del sidebar (línea ~1616), después de `keybindings`, label "Editor",
     ícono `FileCode` de `lucide-react` (sumarlo al import de la línea 32).
   - Página `<SettingsPage title="Editor">` con un `SettingsGroup` y tres `SettingsRow` (con
     `data-settings-anchor`): "Auto save" → `SettingsSegmented` Off / After delay; "Auto save delay" →
     `SettingsStepper` (min 500, max 10000, step 500, unit "ms"), solo visible con After delay; "Word wrap" →
     `SettingsSegmented` Off / On; "Font size" → `SettingsStepper` (10–24, unit "px").
   - Entradas en `SETTINGS_SEARCH_INDEX` (línea 191) para las cuatro filas, `section: 'editor'`, labels en/es y
     keywords (`save`, `autosave`, `guardar`, `wrap`, `ajuste`, `font`, `fuente`, `editor`).

## Texto visible nuevo (va al ítem como `Texto visible:`)

"Editor", "Auto save", "Off", "After delay", "Auto save delay", "Word wrap", "On", "Font size" (rótulos de
preferencias: un ícono no dice qué ajusta).

## Qué NO tocar

- Formatear al guardar (Prettier): fuera.
- Minimapa: CodeMirror no lo trae; fuera.
- `styles.css` / `index.css`: no se suma CSS.

## Cómo se verifica

- `lib/editor-settings.test.ts`: defaults; recorte de delay y fuente; JSON roto → defaults; `writeEditorSettings`
  mezcla y notifica.
- Ui-gate: extender `scripts/ui-gate/flows/dev-file-edit.mjs` con pasos nuevos al final: Settings → Editor;
  poner Word wrap On y Font size 16 → abrir `notes.txt` con una línea larga: la línea se ajusta (sin scroll
  horizontal en `.cm-scroller`) y el `font-size` computado de `.cm-content` es 16px; Auto save After delay con
  500 ms → escribir sin ⌘S → antes de 3 s el tab pierde `data-dirty` y el disco tiene el texto; con un conflicto
  abierto no guarda solo. Restaurar defaults al final del flujo. Capturas de la página Editor y del ajuste.
- Gates: `bunx tsc --noEmit`, `bun run build:app`, `bun test src/dashboard/app/src/lib/editor-settings.test.ts`,
  `bun run gate:evidence -- --label ADE.2-editor-settings -- bun run ui:gate dev-file-edit`.
- Antes de reportar, cargar la app una vez en un navegador (Playwright) y confirmar que no hay `pageerror`.
