# ADE.3 — Atajos reales: un registro de comandos para atajos, paleta y Settings

Ítem: `PLAN.md` § ADE.3. Hoy hay 2 atajos (`lib/keybindings.ts`: ⌘K paleta y ⌘K buscar en Settings) más
Ctrl+` (terminal, `App.tsx:503`, fuera de la tabla). La paleta (`components/common/CommandPalette.tsx:60-169`)
trae acciones del prototipo que mienten: "Switch active model to Claude 3.7 Sonnet", "Gemini 2.5 Pro",
"Skills Engine (36 Languages)", y no muestra atajos. La app corre en una pestaña del navegador: ⌘W, ⌘T, ⌘N y ⌘1–9
son del navegador y no se usan.

## Qué cambiar

1. `src/dashboard/app/src/lib/keybindings.ts` pasa a ser el registro único. Cada comando:
   `{ id, title, keys: string[] (para mostrar), when: string (para mostrar), match(event): boolean }`.
   `match` usa `event.code` cuando hay Alt (en macOS Option cambia `event.key`). `Cmd/Ctrl` = `metaKey` en macOS o
   `ctrlKey` en el resto (`navigator.platform` con `/Mac/`); mantener `matchesKeybinding(event, id)` como
   envoltorio para no romper `OrchestSettingsView.tsx:769` y `CommandPalette.tsx:42`.
2. Comandos y teclas (fijos en este ítem; reasignarlos es ADE.4):

   | id | title | teclas | when | handler existente |
   |---|---|---|---|---|
   | command-palette | Command palette | ⌘/Ctrl K | App | ya existe |
   | settings-search | Search settings | ⌘/Ctrl K | Settings | ya existe |
   | go-to-file | Go to file | ⌘/Ctrl P | App | nuevo (punto 4) |
   | open-settings | Open settings | ⌘/Ctrl , | App | `handleOpenSettings` (App.tsx:874) |
   | mode-chat | Switch to Chat | Alt 1 | App | `handleModeChange('chat')` (App.tsx:851) |
   | mode-dev | Switch to Dev | Alt 2 | App | `handleModeChange('dev')` |
   | new-chat | New chat | Alt N | App | el mismo que abre el selector de "New chat" (ShellSidebar.tsx:125 → `setIsNewChatAgentModalOpen(true)`) |
   | toggle-sidebar | Toggle sidebar | ⌘/Ctrl B | App | `setIsLeftSidebarOpen` (App.tsx:1545) |
   | toggle-right-panel | Toggle right panel | ⌘/Ctrl Alt B | App | `setIsRightInspectorOpen` (App.tsx:1548) |
   | new-terminal | New terminal | Ctrl ` | Dev | `openTerminalTab` (App.tsx:496-509; se mueve al registro) |
   | close-tab | Close tab | Alt W | Dev | `closeSessionTab` (App.tsx:1644); con ADE.1, un tab sucio pide confirmación igual que la ✕ |
   | next-tab | Next tab | Alt ] | Dev | selección de App.tsx:1636 con el siguiente id (circular) |
   | previous-tab | Previous tab | Alt [ | Dev | ídem, anterior |
   | stop-turn | Stop | Esc | Turn running | `onStop` de `useStopChatTurn` (hooks/useStopChatTurn.ts:14; Chat lo conecta en OrchestChatView.tsx:617) |

3. Un solo listener global en `App.tsx` (reemplaza el de App.tsx:500-509) que recorre el registro. Reglas:
   - Con un modal abierto (paleta, selector de agente, confirmaciones) no se dispara nada salvo lo que el modal ya
     maneja.
   - Si el foco está en una terminal (`.xterm`), solo `new-terminal` y los que llevan ⌘/Ctrl; el resto llega a la
     terminal.
   - `stop-turn` solo si hay un turno corriendo en la vista activa y el foco no está en un input con texto ni en
     la terminal; no pisa los Esc existentes (cerrar menús/modales): se registra en burbuja y respeta
     `defaultPrevented`.
   - Los comandos `Dev` solo actúan en modo Dev; `preventDefault` solo cuando el comando actúa.
4. **Go to file**: nuevo `components/dev/GoToFileDialog.tsx` con el look de la paleta (copiar su estructura y
   className de `CommandPalette.tsx`): input + lista; busca con `findExplorerFiles` (api/explorer.ts:65, con el
   debounce que usa `AgentComposer.tsx:220-225`), ↑/↓/Enter abre con el `handleOpenFile` de App (el mismo que usa
   el árbol), Esc cierra. Si no está en Dev, pasa a Dev y abre el archivo. `data-go-to-file` en el diálogo.
5. **Paleta**: sus acciones salen del registro (título + atajo con `<kbd>` como la tabla de Keybindings) más
   "Go to <vista>" solo para las vistas de `handleCommandPaletteSelectTab` que existen hoy en la UI (verificar cada
   una abriéndola; la que no exista se borra). Se borran `model_claude`, `model_gemini` y los títulos del prototipo.
   `action_run_task` se queda como "Run next task".
6. **Settings → Keybindings** (`OrchestSettingsView.tsx:1809-1862`): la tabla ya lee `KEYBINDINGS`; queda igual
   pero muestra las teclas según la plataforma (⌘ en macOS, Ctrl en el resto) y la columna "When" del registro.

## Texto visible nuevo (va al ítem como `Texto visible:`)

Los `title` de la tabla (nombres de comandos: un ícono no dice qué hace cada atajo) y el placeholder de Go to file
"Go to file…".

## Qué NO tocar

- Atajos locales de inputs (composer, menús, `useStickToBottom`, `ResizableAside`, `page.tsx:89`).
- Reasignar teclas, guardar config: es ADE.4. Zoom: ADE.7.

## Cómo se verifica

- Test `lib/keybindings.test.ts`: cada id es único; `match` por plataforma (meta en Mac, ctrl fuera); Alt usa
  `event.code`; ningún comando usa ⌘W/⌘T/⌘N/⌘1–9; no hay dos comandos con las mismas teclas en el mismo `when`
  (salvo command-palette y settings-search, que ya comparten ⌘K en vistas distintas).
- Ui-gate nuevo `scripts/ui-gate/flows/keybindings.mjs` (andamiaje de `dev-session-tabs.mjs`): Alt+2 entra a Dev,
  ⌘P abre Go to file, escribir "index" y Enter abre `src/index.ts` en un tab; Alt+] y Alt+[ cambian de tab;
  Alt+W lo cierra; Ctrl+` abre terminal y, con foco en ella, Alt+1 no sale de Dev; ⌘B oculta y muestra el
  sidebar; ⌘, abre Settings y Keybindings lista los 14 comandos; ⌘K abre la paleta, sin "Claude 3.7" ni
  "Gemini", y con los atajos visibles. Capturas por paso.
- Gates: `bunx tsc --noEmit`, `bun run build:app`, `bun run test:coverage`,
  `bun run gate:evidence -- --label ADE.3-keybindings -- bun run ui:gate keybindings dev-session-tabs`.

## Referencias actualizadas tras ADE.1/ADE.2 (2026-11-07; prevalecen sobre las líneas de arriba)

- `App.tsx`: `closeDevTab` :148 (ya pide confirmación si el tab está sucio: `close-tab` debe llamarlo a él, no a
  `closeSessionTab`), `handleOpenFile` :159 (lo usa Go to file), `handleOpenTerminal` :530 y su listener Ctrl+`
  :534-543, `handleModeChange` :885, `handleOpenSettings` :908, toggle del sidebar :1580, panel derecho :1583,
  `onSelect` de los tabs Dev :1671.
- "New chat": el estado del selector vive local en `ShellSidebar.tsx:78` (`isNewChatAgentModalOpen`), abierto en
  :127. Para `new-chat`, `ShellSidebar` recibe una prop nueva `newChatSignal: number`; un efecto abre el selector
  cuando el número sube. App la incrementa al disparar el comando (si está en Dev, primero `handleModeChange('chat')`).
- Settings → Editor (ADE.2) existe: el registro no toca sus filas.
