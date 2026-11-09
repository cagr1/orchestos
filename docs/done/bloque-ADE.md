# Cerrados de ADE — editar archivos y Settings tomados de Orca, T3 Code y MonoCode

GO de Carlos 2026-11-07. Propuesta y comparación con las tres referencias: `docs/done/ADE-PLAN.md`.

- [x] **ADE.1 — Editar archivos desde el explorer.** (Carlos, 2026-11-07: "no puedo editarlos") Antes
  `DevFilePanel.tsx` solo mostraba y la API solo leía. Hecho: CodeMirror 6 (`CodeEditor.tsx`), ⌘S, buffers por
  archivo que sobreviven al cambio de tab (`file-buffers.ts`), punto de "sin guardar" en el tab, modal al cerrar
  sucio, aviso al salir; `PUT /api/explorer/file` confinado a la raíz real (symlinks, `.git`, binarios, 413,
  escritura atómica sobre el destino real, conserva el modo); conflicto "Keep mine / Reload" si el disco cambió,
  recarga sola sin cambios propios. Hermano: binarios y archivos grandes se veían vacíos; ahora lo dicen.
  Revisión del cerebro: 2 defectos devueltos (colores de sintaxis todos iguales; el guardado rompía symlinks) y
  la corrección dejó la app en blanco (`tags.title` inexistente en `@lezer/highlight`), visto con mi sonda de
  consola en :4242 y arreglado en el mismo ítem. `main.js` 2,07 → 2,65 MB (CodeMirror).
  Gates del cerebro: `tsc --noEmit`, `explorer-write` + `file-buffers` 11/11, `build:app`, `dev-file-edit` 17/17 y
  `dev-session-tabs` 50/50 (`gate:evidence` `ADE.1-dev-file-edit`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.1-live.json` y `docs/done/evidence/ADE.1/`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, 2 correcciones) · Spec: docs/specs/ADE.1.md
  Texto visible: "Unsaved", "Changed on disk", "Keep mine", "Reload", "Discard unsaved changes to <name>?", "Cancel", "Discard", "Loading…" (ya existía, cambia de línea), "Binary file — not shown", "File too large to open (<N> KB)" (estado y decisiones que un ícono no explica)

- [x] **ADE.2 — Settings → Editor: auto-guardado, ajuste de línea, tamaño de fuente.** Hecho: sección Editor en
  Settings → App (Auto save Off/After delay 500–10000 ms, Word wrap, Font size 10–24), preferencias por dispositivo
  en `localStorage` (`lib/editor-settings.ts`, defaults de VS Code: el editor queda igual que antes), cambios sin
  recrear el editor (`Compartment`); el auto-guardado no corre con un conflicto abierto. Revisión `qa`: un guardado
  pedido durante otro en vuelo se perdía (quedaba "Unsaved" para siempre); hermano con ⌘S; ambos se encadenan.
  Gates del cerebro: `tsc --noEmit`, `editor-settings` 4/4, `build:app`, sonda de consola sin `pageerror`,
  `dev-file-edit` 22/22 y `dev-session-tabs` 50/50 (`gate:evidence` `ADE.2-editor-settings`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.2/ui-gate-result.json` y capturas en `docs/done/evidence/ADE.2/`
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/ADE.2.md
  Texto visible: "Editor", "Auto save", "Off", "After delay", "Auto save delay", "Word wrap", "On", "Font size" (rótulos de preferencias: un ícono no dice qué ajusta)

- [x] **ADE.3 — Atajos reales: registro central de comandos, de 2 a ~20.** Hecho: `lib/keybindings.ts` es el
  registro único (14 comandos: paleta, Go to file ⌘P, Settings ⌘,, Chat/Dev Alt+1/2, New chat Alt+N, sidebar ⌘B,
  panel derecho ⌘⌥B, terminal Ctrl+`, cerrar/siguiente/anterior tab Alt+W/]/[, Stop Esc con turno corriendo); un
  listener global en `App.tsx` que respeta modales, menús e inputs; ningún atajo choca con ⌘W/⌘T/⌘N/⌘1–9 del
  navegador. Nuevo `GoToFileDialog.tsx` (con íconos de UI.70). La paleta sale del registro con sus atajos; se
  borraron sus acciones del prototipo ("Claude 3.7 Sonnet", "Gemini 2.5 Pro", "OrchestOS CLI v0.12"). Revisión
  del cerebro: en Linux/Windows la terminal perdía Ctrl+K/P/B frente a App (ahora solo pasan Ctrl+` y ⌘, regla
  única `reachesAppFromTerminal`); acabados de la paleta (atajos alineados, sin subtítulo repetido).
  Gates del cerebro: `tsc --noEmit`, `keybindings` 10/10, `build:app`, sonda de consola sin `pageerror`, ui-gates
  `keybindings` 27/27, `dev-terminal` 16/16, `dev-session-tabs` 50/50, `settings-pages` 29/29 (`gate:evidence`
  `ADE.3-keybindings`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.3/ui-gate-result.json` y `docs/done/evidence/ADE.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, acabados) · Spec: docs/specs/ADE.3.md
  Texto visible: "Command palette", "Search settings", "Go to file", "Open settings", "Switch to Chat", "Switch to Dev", "New chat", "Toggle sidebar", "Toggle right panel", "New terminal", "Close tab", "Next tab", "Previous tab", "Stop", "Go to <vista>", "Run next task", "Type a command…", "Go to file…", "Esc to close", "No matches" (nombres de comandos: un ícono no dice qué hace cada atajo)

- [x] **ADE.4 — Reasignar atajos grabando las teclas (MonoCode).** Hecho: la combinación es un dato (`Chord`) con
  override por dispositivo en `localStorage` `orchestos-keybindings`; clic en la celda graba ("Press keys…"), Delete
  desactiva, choque por `when` con "Used by <title>" + Replace/Cancel, reservadas del navegador rechazadas, Reset por
  fila y Reset all. App, paleta y terminal usan el chord efectivo. Los atajos ahora matchean por tecla física
  (`event.code`), no por carácter. De paso: Esc del buscador de Settings dependía del foco (gate `keybindings` rojo 2
  de 3; foco en un `BUTTON` al pulsar Esc); ahora listener en `window` mientras está abierto + `autoFocus`.
  Pendiente menor: "Replace" no se activa por teclado mientras graba.
  Texto visible: "Press keys…" · "Disabled" · "Add a modifier" · "Reserved by the browser" · "Used by" · "Replace" · "Cancel" · "Reset" · "Reset all" (estados y decisiones de la grabación; un ícono no los explica)
  Gates del cerebro: `tsc`, 16 tests, `ui:gate keybindings` 3/3 PASS 40/40 + `gate:evidence` keybindings 40/40,
  dev-terminal 16/16, settings-pages 29/29. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.4/ui-gate-result.json` y `docs/done/evidence/ADE.4-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio) · Specs: docs/specs/ADE.4.md, docs/specs/ADE.4-esc.md

- [x] **ADE.5 — Settings → Chat: Enter o ⌘Enter, escribir mientras el agente trabaja, confirmar archivar/borrar.**
  Hecho: Settings → Chat (`lib/chat-settings.ts`, `orchestos-chat`): enviar con Enter o ⌘Enter; con turno activo,
  "Queue message" (por defecto: cola por hilo sobre el composer, sale sola al terminar cada turno, uno por turno,
  quitable) o "Stop and send"; confirmación antes de borrar un chat / entrada de History y de archivar un agente
  (`ConfirmDialog.tsx`, "Don't ask again"). `chat-stop` cambió: Enter con turno activo ya no es no-op, encola.
  Riesgos revisados por el cerebro y probados en gate: dos encolados salen en orden sin 409; hilo nuevo conserva su
  cola. Gates del cerebro: `tsc`, 4 tests, `ui:gate chat-settings` 3/3 PASS 19/19; `gate:evidence` chat-settings
  19/19, chat-stop 22/22, chat-streaming 27/27, codex-live 15/15, settings-pages 29/29. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.5/ui-gate-result.json` y `docs/done/evidence/ADE.5-live.json`.
  Texto visible: "Chat" · "Send with" · "Enter" · "⌘ Enter" · "Ctrl Enter" · "While the agent is working" · "Queue message" · "Stop and send" · "Confirm before deleting a chat" · "Confirm before archiving an agent" · "Queued" · "Delete this chat?" · "Delete" · "Archive this agent?" · "It moves to History; you can restore it." · "Archive" · "Cancel" · "Don't ask again" (opciones y confirmaciones; un ícono no las explica)
  Ejecutado por: codex gpt-6.1-sol (criterio, + corrección ADE.5-cola) · Spec: docs/specs/ADE.5.md

- [x] **ADE.6 — Notificaciones: tarea terminada o esperando respuesta.** Hecho: notificación del sistema + tono Web
  Audio (sin assets) cuando un agente termina, falla o pide aprobación y la ventana no está a la vista. Detección por
  transiciones (`lib/attention-events.ts`, nunca por estados ya presentes al cargar), un evento por clave. Los hilos no
  abiertos no se actualizaban: poll de `listSessions` cada 5 s solo mientras algo trabaja o espera, sin backend nuevo.
  Clic → Dev si el hilo es pestaña de Dev abierta, si no Chat. Settings → Notifications: 3 switches, permiso, Test.
  Gates del cerebro: `tsc`, 8 tests, `ui:gate notifications` 3/3 PASS 10/10; `gate:evidence` notifications 10/10,
  chat-settings 19/19, settings-pages 29/29, smoke 7/7. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.6/ui-gate-result.json` y `docs/done/evidence/ADE.6-live.json`.
  Texto visible: "Notifications" · "When an agent finishes" · "When an agent needs your input" · "Play a sound" · "Allow notifications" · "Blocked in the browser" · "Test" · "Finished" · "Failed" · "Needs your approval" (permiso y contenido de la notificación; un ícono no los explica)
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.6.md

- [x] **ADE.7 — Apariencia 2: escala de la interfaz, archivos ignorados por git, diff para daltónicos.** Hecho:
  `lib/appearance-settings.ts` (`orchestos-appearance`): escala 80–150 % por CSS `zoom` en `<html>` (navegador puro,
  sin Electron) con ⌘= / ⌘- / ⌘0 reasignables y `preventDefault` sobre el zoom nativo; el explorer oculta en vivo los
  nodos `ignored` (el handler ya los marcaba) si se apaga el switch; paleta daltónica azul/naranja vía
  `data-diff-palette` en `<html>` y variantes arbitrarias de Tailwind, sin tocar `styles.css`, en DevDiffPanel,
  timeline de Dev, TaskCard, conteos del inspector y RunsEvidenceView. Settings → Appearance: 3 filas + búsqueda.
  Gates del cerebro: `tsc`, 23 tests, `build:app`, `ui:gate appearance` 3/3 PASS 23/23 (incluye paleta ⌘K centrada a
  125 % y 80 %), settings-pages 32/32, dev-file-edit 22/22, dev-session-tabs 50/50, keybindings 40/40. Revisión:
  Opus (diff leído). El explorer no tiene menú contextual: esa comprobación del spec no aplicaba.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.7/ui-gate-result.json` y `docs/done/evidence/ADE.7-live.json`.
  Texto visible: "Interface scale" · "Reset" · "Show git-ignored files" · "Diff colors" · "Default" · "Color-blind friendly" · "Zoom in" · "Zoom out" · "Reset zoom" (etiquetas de ajustes y atajos; un ícono no dice qué controla cada fila)
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.7.md

- [x] **ADE.8 — Diff por defecto: unificado o lado a lado, espacios, árbol.** Hecho: `lib/diff-settings.ts`
  (`orchestos-diff`) con vista, espacios, layout de Changes y carpetas abiertas; `ignoreWhitespace=1` añade `-w` a
  `/api/git/diff` (también `--no-index`) y al numstat de `/api/git/changes`, sin el parámetro idéntico a antes.
  `DevDiffPanel`: vista lado a lado (`splitDiffRows`, empareja rachas `-`/`+` por hunk) con paleta daltónica, y
  toggles por panel en el header iniciados desde los ajustes. Changes como árbol con carpetas compactadas, toggle en
  la cabecera. Settings → Editor: grupo de 4 filas + búsqueda. Diff del timeline y TaskCard siguen unificados.
  Gates del cerebro: `tsc`, 46 tests, `build:app`, `ui:gate diff-view` 3/3 PASS 19/19, appearance 23/23,
  dev-session-tabs 50/50, settings-pages 32/32. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.8/ui-gate-result.json` y `docs/done/evidence/ADE.8-live.json`.
  Texto visible: "Diff view" · "Unified" · "Split" · "Ignore whitespace" · "Changes layout" · "List" · "Tree" · "Expand folders" · "Open file" (filas de ajustes; en el visor y en Changes son íconos con aria-label; "Open file" ya existía, solo se movió dentro del grupo del header)
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.8.md

- [x] **ADE.9 — Terminal: fuente, tamaño, cursor, scrollback.** Hecho: `lib/terminal-settings.ts`
  (`orchestos-terminal`; defaults = los de antes: Fira Code 13, bloque con parpadeo, scrollback 1000). La terminal
  aplica cambios en vivo sobre `terminal.options` + `fit` + resize al servidor, sin reconectar el WebSocket. El
  contenedor de xterm cancela el `zoom` de ADE.7 para que el mouse caiga en la celda correcta (selección verificada
  a 125 %); efecto: el texto de la terminal no crece con la escala de UI (pendiente menor, sin ítem). Settings →
  Terminal: sección nueva con 6 filas + búsqueda; `settings-shell` la cuenta.
  Gates del cerebro: `tsc`, 4 tests, `build:app`, `ui:gate terminal-settings` 3/3 PASS 14/14, dev-terminal 16/16,
  settings-shell 22/22, settings-pages 32/32, appearance 23/23. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.9/ui-gate-result.json` y `docs/done/evidence/ADE.9-live.json`.
  Texto visible: "Terminal" · "Font family" · "Font size" · "Line height" · "Cursor style" · "Block" · "Bar" · "Underline" · "Cursor blink" · "Scrollback" (filas de ajustes; un ícono no dice qué controla cada una)
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.9.md

- [x] **ADE.10 — Por proyecto: nombre e ícono, script al crear worktree, rama base.** Hecho: los 4 ajustes en la
  DB local (migración: `display_name`, `icon`, `base_branch`, `setup_script` en `projects`), nunca en el config del
  repo: un script versionado correría solo con clonar un repo ajeno. `PATCH /api/projects/:id` valida (rama existente,
  ícono del set, límites). La rama base se resuelve en un solo lugar, `resolveSandboxMode` (cli, graph-runner y
  harness coherentes; si ya no existe, warning y rama actual). Merge-back sin mover el checkout del usuario: si la
  base no es la rama checkout, `git fetch . <wt>:<base>` (fast-forward), con rebase y reintento; `squash` aplasta en
  el worktree. Script de setup tras crear el worktree, `cwd` = worktree, timeout 10 min; fallo → limpia y error con
  las últimas 20 líneas. Front: nombre e ícono propagados desde `listProjects`; Settings del proyecto abre en la
  pestaña nueva "General". El ejecutor se detuvo 2 veces por huecos del spec (call sites que fijaban la rama;
  `squash` sin checkout); se ampliaron. El error de merge fallido perdió los pasos manuales (conserva stderr).
  Gates del cerebro: `tsc`, 58 tests, `build:app`, `ui:gate project-settings` 3/3 PASS 6/6, project-tabs 40/40,
  tasks 43/43, settings-pages 32/32. Rama base y setup verificados en integración del harness (worktree real, merge a
  `develop` con `main` intacta), no en UI. Revisión: Opus (diff leído).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ADE.10/ui-gate-result.json` y `docs/done/evidence/ADE.10-live.json`.
  Texto visible: "General" · "Name" · "Icon" · "Base branch" · "Current branch" · "Setup script" · "Runs in the new worktree folder after creation and linking node_modules." (ajustes del proyecto; la ayuda dice cuándo y dónde corre el script, un ícono no lo explica)
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.10.md

- [x] **ADE.11 — Tres detalles del ADE: zoom en la terminal, "Replace" por teclado, atajos por letra.** (hallados al
  cerrar ADE.3/ADE.7) A 125 % de UI el texto de la terminal no crece (`OpenCodeTerminal.tsx:165` cancela el zoom y la
  fuente no compensa); con un choque de atajos, Tab/Enter quedan capturados por la grabación
  (`OrchestSettingsView.tsx:838`) y "Replace" solo se alcanza con el ratón; los atajos de letra matchean por
  `event.code` (`keybindings.ts:41`), así que en AZERTY/Dvorak ⌘P no es la tecla con "P".
  Hecho: la fuente de xterm = elegida × escala de UI (al crear, al cambiar ajustes y al cambiar la escala, sin
  reconectar); con choque, la grabación suelta el teclado, el foco va a "Replace" y Escape cancela; letras, `=` y `-`
  matchean por `event.key` (dígitos, ⌥ en Mac y teclas especiales siguen por posición).
  Gates del cerebro: `typecheck`, `keybindings.test.ts` 21/0, `keybindings` 43/43, `terminal-settings` 16/16.
  Revisión: Opus (diff leído).
  Gate en vivo: Playwright `keybindings` 43/43, `docs/done/evidence/ADE.11-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/ADE.11.md
