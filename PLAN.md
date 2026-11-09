---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: sprint-30-abierto--fiabilidad-del-recorrido-y-shell-chat-workspace
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo — orden cerrado por Carlos (2026-09-22)

*"Terminar interfaz, luego producto mínimo para entrega y luego corregir"* lo que Opus detectó corriendo dentro de
OrchestOS. Una fase a la vez; lo que no está en una fase no se abre sin GO de Carlos. Restricción que manda en las
tres: harness liviano (ver abajo) — la respuesta dentro de OrchestOS tiene que sentirse igual que el CLI directo,
sin peso extra y con reglas claras.

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13) — CERRADA
Todos sus ítems están archivados en `docs/done/` (UI.13.x, UI.9.8/9.9, UI.10.A, CI.2; el selector nativo de nuevo proyecto lo cerró UI.15).

### Fase 2 — Producto mínimo para entrega (ruta ERP) — EN CURSO
**Decisión de Carlos 2026-10-05:** *"primero lo primero, que funcione"* — ERP.4 no se abría hasta que R.8 dijera, con
evidencia, que el recorrido funciona. Cerrados y archivados: AT.10, R.7, ERP.2, ERP.3, I.7, H.5.3, H.9.4. R.8.1–R.8.6
están cerrados (2026-10-05/12); R.8 queda abierto solo por la contrastación con una tarea real de Carlos, que cubre
ERP.4. El piloto de ERP.4 corrió completo el 2026-10-13 (etapas 1-6; ERP.4.1–ERP.4.13 cerrados).

**Orden vigente** (GO de Carlos 2026-10-13 a UI.24, UI.25 y UI.26; "UI.24 primero, ERP.4 al final", `NEXT.md`):
1. UI.26.5 → UI.26.6 → UI.26.7 (UI.26 absorbió UI.25.2–25.4; UI.25 y UI.26.1–26.4a cerrados 2026-10-13/14).
2. UI.24.4 → UI.24.5 → UI.24.6 (incluye ERP.4.14) → UI.24.7 (UI.24.1–24.3 cerrados 2026-10-13).
3. ~~ERP.4.15 → ERP.4.16 → limpiar `erp-piloto` → veredicto de ERP.4 → cierre de R.8~~ (cerrado 2026-10-15).
4. ~~UI.8.6 (permisos visibles: aprobar en el chat lo que el CLI va a hacer)~~ (cerrado 2026-10-16). Sigue Fase 3.

Fiabilidad abierta, sin orden fijo (se atiende cuando el pre-push la tumba): CI.11, CI.18, CI.19, CI.23, CI.25.
Documentación y código muerto: DOC.1 y LIMP.1 (GO de Carlos 2026-10-14).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → AT.19 (lo que Claude notó dentro del chat; AT.19.1, AT.19.2) → AT.20 → AT.21 → CX.6 → ERP.6 (demostrar que no pesa) → ERP.5 (qué quitar) → ERP.7 (T3 Code) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.10.2 (H.9.4 entró a la Fase 2 el 2026-10-05). Los 11 superados por UI.13/UI.14 se retiraron el 2026-09-22 (`docs/done/retirados.md`).

## Restricción de producto: harness liviano — decisión de Carlos (2026-09-17)

**Pedido textual:** *"quiero un harness o orquestador light sin ahogar el trabajo de los agentes
cerebro"*. Origen: usando Orca, Carlos observa que consume ~2 GB de RAM y concluye que OrchestOS
no debe ir por ahí.

**Medición del 2026-09-17, no estimación** (`ps -o rss=`, ambos corriendo en la misma máquina):

| Proceso | RSS |
| --- | --- |
| OrchestOS (`bun run src/cli.ts dashboard`) | **121 MB** |
| Orca (suma de sus procesos, en ese momento) | **1,270 MB** |

OrchestOS ya es ~10× más liviano. **Eso deja de ser una casualidad y pasa a ser un invariante que
se defiende:** toda propuesta que agregue un runtime residente (swarms, memoria vectorial, índice
persistente, servidor extra) declara su costo en RAM antes de entrar, y se compara contra estos
121 MB. Es el mismo criterio con el que `IDEAS.md#64` deja a Serena MCP condicionada a medición
antes/después en vez de adoptarla por fe.

**"Sin ahogar al cerebro" es la otra mitad y limita lo anterior:** liviano no puede significar
recortarle contexto, herramientas o criterio al modelo que piensa. El ahorro sale de *dónde corre
el trabajo* (delegar al ejecutor, que gasta su propio contexto y su propio cupo — medido: 145,664
tokens de Luna que nunca entraron en el contexto del cerebro), no de podar al cerebro.

## Fase 1 — Terminar la interfaz

Cerrada. Todos sus ítems están archivados en `docs/done/` (ver "Cerrados — evidencia archivada" al final).

## Fase 2 — Producto mínimo para entrega

### ADE — editar archivos y Settings tomados de Orca, T3 Code y MonoCode (GO de Carlos 2026-11-07)

Propuesta y comparación con las tres referencias: `docs/specs/ADE-PLAN.md`. Uno a uno, en orden.

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
- [x] **LIMP.4 — Evidencia de ítems cerrados fuera del árbol.** (GO de Carlos 2026-11-08, `docs/specs/LIMPIEZA-2.md`
  § 1) Regla: en `docs/done/evidence/` queda solo lo que cita un ítem abierto de `PLAN.md` o `NEXT.md`; lo de ítems
  `[x]` vive en git (su commit de cierre lo tuvo staged, que es lo único que exige `check-live-gate.ts:61`). Borrados
  45 de 51 (1,5 MB); quedan CI.19, CI.55 y el conductor de ERP.4. Además, 10 capturas ignoradas por git borradas del
  disco. Ningún código lee `docs/done/evidence/` (grep en `src`, `scripts`, `tests`, `.claude`, `.github`).
  Prueba en worktree temporal con la lista borrada: `ledger:gate` exit 0, reconcile con rollback 50 ítems, `tsc` exit 0.
  Ejecutado por: codex gpt-6.1-sol (analizar) + Opus (borrado) · Spec: docs/specs/LIMPIEZA-2.md

### Abiertos — fiabilidad de los gates y documentación

- [x] **UI.66 — Quitar `orchestos / master` del header superior.** (Carlos, 2026-11-06: "no tiene sentido") El
  breadcrumb proyecto/rama de `ShellHeader.tsx` no aportaba; se borra el bloque y las props `activeProjectName` /
  `activeBranch` que le pasaba `App.tsx`. Gates del cerebro: `tsc --noEmit` y `build:app` verdes.
  Gate en vivo: navegador real (panel del navegador, dashboard en :4299), `docs/done/evidence/UI.66-live.json`
  Ejecutado por: claude opus 5.5
- [x] **UI.67 — Tabs de Dev: `+` pegado a la última tab y desborde con muchas tabs.** (Carlos, 2026-11-06: el `+`
  quedaba en el borde derecho y "solo me deja abrir 2") Causa: no había tope; la lista ocupaba todo el ancho
  (`flex-1`) y empujaba el `+` al borde, y desde la tercera tab desbordaba sin barra visible, así que las nuevas
  quedaban fuera de vista. Arreglo en `DevSessionTabs.tsx`: la lista mide lo que ocupan sus tabs y el `+` va justo
  después; con desborde las tabs se encogen hasta 128 px, luego hay scroll horizontal (rueda vertical incluida), sin
  barra, con fundido en el borde que esconde tabs. Gates del cerebro: `tsc --noEmit`, `build:app`,
  `dev-session-tabs` 47/47 y `shell-look` 75/75 (`gate:evidence` `UI.67-dev-tabs`).
  Gate en vivo: navegador real (panel del navegador, 10 tabs abiertas en :4299), `docs/done/evidence/UI.67-live.json`
  Ejecutado por: claude opus 5.5
- [x] **UI.68 — Chat vacío sin la línea "agente · modelo".** (Carlos, 2026-11-06: "texto innecesario") Bajo el
  nombre del proyecto se repetía p. ej. "Codex · gpt-6.1-sol", que el composer ya muestra. `ThreadEmpty` queda solo
  con el título; se borran `cliName`, `chatClis` y su `getCliModels`, que solo existían para esa línea.
  Hermano hallado: `thread-states` estaba rojo en `master` (`a2666db3`) desde RUN.1, que quitó Retry de la tarjeta
  fallida a propósito pero no actualizó el gate; ahora el gate exige que Retry no esté.
  Gates del cerebro: `tsc --noEmit`, `build:app`, `thread-states` 311/311, `chat-streaming` 27/27, `codex-live`
  15/15 (`gate:evidence` `UI.68-chat-live`).
  Gate en vivo: navegador real (panel del navegador, chat nuevo en :4299), `docs/done/evidence/UI.68-live.json`
  Ejecutado por: claude opus 5.5
  Texto visible: "OrchestOS" (título de ejemplo del chat vacío en la hoja de estados; ya existía, solo pierde el subtítulo)
- [x] **UI.69 — Restaurar el logo "S" en el header y el favicon.** (Carlos, 2026-11-06: eligió su logo original, la
  "S" geométrica borrada en `ff090e38`, frente a la marca de red con degradado) Hecho: `BrandMark.tsx` con los 4
  trazos de `AnimatedLogoDark.svg` sin animación y en `currentColor`; el header lo muestra a 16 px antes de
  "Orchest OS"; el favicon pasa de la "O" celeste a la S clara sobre fondo oscuro. Trazos comparados uno a uno con
  el original (componente y favicon: iguales). Gates del cerebro: `tsc --noEmit`, `build:app`, `shell-look` 75/75
  (`gate:evidence` `UI.69-shell-look`).
  Gate en vivo: navegador real (panel del navegador, header en :4299), `docs/done/evidence/UI.69-live.json`
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/UI.69.md
- [x] **OC.1 — La terminal de Dev lanza OpenCode con `--standalone`.** (abierto 2026-11-03, GO de Carlos al plan
  OC.1–OC.4) Con OpenCode 2.2.5 y el servicio compartido desincronizado, la TUI sale a los ~20 s.
  Hecho: `resolveOpenCodeCommand` devuelve `[binary, '--standalone']` (servidor privado por pestaña).
  Gates del cerebro: tsc, tests 36/0, `ui:gate opencode-terminal` 13/13 con el servicio compartido aún roto.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus
- [x] **OC.2 — El catálogo de OpenCode usa `api --standalone model.list`.** (abierto 2026-11-03) 2.2.5 quitó
  `models --verbose`; catálogo vacío y `model-routing` rojo bloquean el push.
  Hecho: `parseOpencodeModels` lee `data[]` (`providerID/id`, esfuerzos = `variants[].id`); sale la llamada a
  `run --help`. En vivo (Sol): `/api/models/catalog` 361 modelos, 230 con esfuerzos y 131 sin.
  Gates del cerebro: tsc, tests 36/0, `ui:gate model-routing` 19/19.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · revisión Opus
- [x] **OC.2.1 — `opencode-engine.test.ts` simula el catálogo con el formato viejo.** (abierto 2026-11-03, regresión
  de OC.2 vista en el pre-push; el cerebro corrió 3 archivos en vez de `test:coverage`)
  Hecho: el mock responde a `model.list` con el JSON nuevo. Gate del cerebro: `test:coverage` 2240/0.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus
- [x] **DOC.7 — Fuera los marcadores de delegación de los ítems del plan.** (abierto 2026-11-03, decisión de Carlos
  2026-10-13 reafirmada hoy) El rol sale del roster; el marcador era formato parseado (regex, columna con CHECK).
  Hecho: formato `- [ ] **ID — título.**`; `plan-status.ts` acepta el marcador legado pero nunca lo emite; migración 34
  quita `plan_items.delegation` (DB real migrada); `next`, `handoff`, `plan-doc`, tipos y tests sin el campo;
  `AGENTS.md` y `docs/agent-work-protocol.md` sin marcador; los 10 ítems de `PLAN.md` sin él. `docs/done/` intacto.
  Gates del cerebro: tsc, `test:coverage` 2243/0, `plan-render --check` 0, `next` lista `ID — título`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/DOC.7-live.json` (`plan-doc` 16/16).
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · revisión Opus
- [x] **DOC.8 — Vuelven las reglas vivas que DOC.6 retiró.** (abierto 2026-11-03, GO de Carlos tras la auditoría de
  Sol: 36 reglas sin respaldo y 7 de significado cambiado) Hecho: `AGENTS.md` recupera las generales (no duplicar ítem
  tomado, no improvisar gobierno, control computable, lint completo, contrato CLI lo prueba el cerebro, evidencia solo
  `<ID>-live.json`, aviso de `criterio-alt`, fecha de caso de campo, limpieza comprobada por consulta, batería completa
  en cambio de marco, texto emitido, roadmap determinista, costo QA, `CONTEXT.md` derivado); 23 recetas en
  `docs/reference/gotchas.md` (no cargado); `NEXT.md` recupera seguimientos, alcance de Settings y "abrir solo si Carlos
  lo pide". `knownCost` sale de decisiones pendientes: solo entra con `usd` `undefined` (`harness.ts:835`).
  Ejecutado por: claude opus-5.5 (cerebro, solo docs)
- [x] **OC.3 — El ejecutor `opencode run` usa `--standalone` y `--model prov/modelo#variante`.** (abierto 2026-11-03)
  2.2.5 quitó `--variant`; sin `--standalone` depende del servicio. Hecho: tarea, display y chat pasan `--standalone` y
  `--model <modelo>#<variante>`; parser intacto (`part.type` sigue `step-finish`). Gates del cerebro: tsc, lint,
  `test:coverage` 2243/0. Gate en vivo: inferencia real con los args del chat, `docs/done/evidence/OC.3-live.json`.
  Revisión: Opus.
  Ejecutado por: codex gpt-6-luna (mecanico r1)
- [x] **OC.4 — El adaptador HTTP de aprobaciones migra a la API v2 de OpenCode.** (abierto 2026-11-03) Cambiaron
  banner, `/api/session`, prompt, modelo y permisos (`src/run/executors/opencode-server.ts`). Hecho: rutas `/api`,
  envoltura `data`, reglas `{action,resource,effect}`, variante dentro de `model`, `decision` once/reject (nunca always),
  `session/active`, mensajes paginados y traducidos al NDJSON de siempre; permisos v2 en `opencode-approval.ts`.
  r1: el test del motor seguía simulando la API v1. Gates del cerebro: tsc, lint, `test:coverage` 2250/0.
  Gate en vivo: `opencode serve` real, edición aprobada crea el archivo con costo y tokens; shell rechazado falla la
  tarea; sin servidores huérfanos (`docs/done/evidence/OC.4-live.json`).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico r1)
- [x] **ONB.1 — El primer arranque usa una CLI instalada, no OpenRouter.** (abierto 2026-11-04, GO de Carlos) Clon
  limpio: `setup` exigía `OPENROUTER_API_KEY`, el chat nacía en `api` con `typesafe/jev-router` (precio -1 ordenado
  primero) rotulado "ChatGPT" y el primer mensaje fallaba.
  Texto visible: mensaje de error sin CLI ni clave (dice qué instalar; un ícono no lo explica) y la etiqueta
  "OpenRouter" (reemplaza "ChatGPT", que era falsa).
  Hecho: `default-chat-agent.ts` (config → primera CLI instalada, con chat y funcional en orden del registro →
  `api` con clave → nada); sesiones, `GET /api/chat/default-agent`, composer sin hilo y `setup` lo usan; catálogo
  sin precios negativos; clave de OpenRouter opcional. Gates del cerebro: tsc, lint, `test:coverage` 2264/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.1-live.json` (`ORCHESTOS_HOME` vacío → "Message Claude…",
  primer mensaje respondido por la CLI en 2,4 s, sin error). Sin probar en vivo: el caso sin ninguna CLI (tests).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio r1)
- [x] **ONB.2 — Model routing propone la CLI detectada para los roles vacíos.** (abierto 2026-11-04, GO de Carlos,
  opción 1) Clon limpio: los cuatro roles nacen sin asignar y la primera tarea falla con "Rol 'executor' sin asignar";
  el error no lleva a Settings. Detectar no es decidir: se propone, Carlos confirma con un clic y guarda.
  Texto visible: "Use <CLI> for unassigned roles" y "Model routing" junto al error de tarea; un ícono no dice
  qué CLI se detectó ni adónde lleva. El mensaje del rol sin asignar pasa al inglés, como el resto de la UI.
  Hecho: `routing-roles.ts` (filtros y modelo compartidos entre selector y botón); la sugerencia sale de
  `/api/chat/default-agent`; correr una tarea sin rol devuelve `code: 'role_unassigned'` y el error muestra el botón
  "Model routing"; `createSession` sin agente deja que el servidor lo resuelva (hermanos de ONB.1). r1: nombre visible
  "Claude" (como el selector) y botón compacto. Gates del cerebro: tsc, lint, `test:coverage` 2275/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.2-live.json`; `ui:gate model-routing` 24/24
  repetido por el cerebro (error 400 `role_unassigned` → botón → Model routing; "Use Claude for unassigned roles" →
  guardar → los 4 roles en `claude`/`claude-opus-5-5`; el botón desaparece). Captura mirada a ojo.
  Anotado: con una sola CLI el Reviewer queda igual que el Executor (la UI ya avisa "errors may correlate").
  Revisión: Opus (diff de Sol leído completo; r1 de Luna verificado en la captura).
  Ejecutado por: codex gpt-6.1-sol (criterio) + luna (mecanico r1)
- [x] **CI.61 — `Mutation Shards`: `executors-routing` vuelve a pasar las 3 h.** (abierto 2026-11-04) Corrida
  `41811181197`: shard cancelado a 180 min (11:09 → 14:10); los otros 9 verdes. Duración 77 min (2026-10-27) →
  151 (2026-11-03) → 180+. Muta `cli-registry.ts` (496 líneas, 46 tests) y otros 6 archivos (~506 líneas, hasta
  51 tests). Se parte en dos: `executors-routing` = `cli-registry.ts`; `executors-routing-c` = el resto.
  Hecho: `stryker.run-executors-routing-c.config.mjs`, exclusión en `-routing`, script en `package.json`, matriz del
  workflow y prueba de particiones. Gates del cerebro: `mutation-test-shard.test.ts` 9/0, lint, `test:coverage`
  2273/0 (los 6 fallos del ejecutor eran de su sandbox: EADDRINUSE y EPERM en `~/.ssh`). La duración real se ve en
  la próxima corrida nocturna; si `-routing` sigue sobre 150 min, se reabre.
  Revisión: Opus (diff leído completo).
  Ejecutado por: luna (mecanico)
- [x] **UI.63 — El popover de cuotas muestra los créditos de reinicio de Codex.** (abierto 2026-11-04, GO de Carlos)
  `account/rateLimits/read` ya devuelve `rateLimitResetCredits {availableCount, credits[{status, expiresAt, title}]}`
  (en vivo hoy: 3 disponibles, "Full reset (Weekly + 5 hr)") y OrchestOS lo descarta. Solo se muestra; gastar un
  crédito (`account/rateLimitResetCredit/consume`) es irreversible y queda fuera.
  Texto visible: "Reset credits" en el popover (un número suelto no dice qué es) y la expiración del más próximo.
  Hecho: `parseCodexResetCredits` en `scripts/context-adapters.ts` (cuenta y vencimiento más próximo; sin `id` ni
  `description`); `rateLimits.resetCredits` en `/api/session/status` solo para Codex; fila "Reset credits N · expires
  in Nd" en el popover, solo con créditos > 0. r1: el número no hereda el color de la cuota semanal. Gates del cerebro:
  tsc, lint, `test:coverage` 2287/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.63-live.json`; `ui:gate usage-bar` 22/22 repetido
  por el cerebro con Codex real; captura mirada a ojo: "Reset credits 3 · expires in 1d".
  Revisión: Opus (diff de Sol leído completo; r1 de Luna verificado).
  Ejecutado por: codex gpt-6.1-sol (criterio) + luna (mecanico r1)
- [x] **DOC.9 — `bun run readme:sync`: el README se actualiza solo con datos computables.** (GO de Carlos
  2026-11-05) Bloques marcados (CLIs, número de tests) reescritos sin LLM; un workflow de los viernes abre un PR.
  Hecho: `scripts/readme-sync.ts` (bloques `readme-sync:clis` desde `KNOWN_CLIS` y `readme-sync:tests` desde la salida
  de `test:coverage`, stdout+stderr; con fallos no escribe), `--check`, `--from-log`; workflow
  `.github/workflows/readme-sync.yml` (viernes 12:00 UTC + manual, PR si cambia, uno abierto a la vez). Gates del
  cerebro: `test:coverage` 2295/0, `readme:sync` real → 2296 (suma el test de r2), `--check` exit 0, lint y tsc.
  qa (Sol) r1: 2 P1 (resumen en stderr, `tee` sin stderr) confirmados y corregidos en r2. `actionlint` no instalado.
  Ejecutado por: codex gpt-6-luna (mecanico r1, r2) · revisión qa codex gpt-6.1-sol
- [x] **DOC.9.1 — El test de `readme-sync` no depende del `README.md` real.** (regresión de DOC.9, 2026-11-05) El
  pre-push de `52879bd5` falló: el test fija 2295 y lee el README real, que ya dice 2296.
  Hecho: `syncReadme` recibe la ruta del README; el test usa un README de fixture en `mkdtempSync`. Gates del
  cerebro: test 10/0 con el README real alterado a mano (restaurado), lint, tsc.
  Ejecutado por: codex gpt-6-luna (mecanico)
- [x] **RUN.2 — `run_steps` acepta el paso `notice` de Codex; persistir un paso nunca rompe la corrida.** (visto
  2026-11-05 en el gate de RUN.1) Desde CHAT.3 (`760982d9`) Codex emite `notice` y el CHECK de `run_steps` lo rechaza
  con `SQLITE_CONSTRAINT_CHECK` dentro del handler de `codex-app-server.ts:475`. En HEAD sin el arreglo,
  `chat-retry-report` deja la tarea "Interrupted: the task runner stopped" (el error tumba el runner).
  Hecho: migración 35 `run-step-notices` (CHECK con `notice`, filas copiadas); `insertRunStep` guarda el notice
  (`detail` = JSON del `CliNotice`); `harness.ts` registra y sigue si el insert lanza; consola de sesión pinta
  `[notice]`. Hermano `chat_turn_steps` ya lo admitía. No es la causa de CI.55 (reprodujo con el arreglo).
  Gates del cerebro: tsc, lint, `test:coverage` 2308/0, `tasks` 43/43 sin `SQLITE_CONSTRAINT` en `dashboard.log`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/RUN.2-live.json`
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio)
- [x] **RUN.1 — Una tarea fallida explica por qué falló en vez de reintentar a ciegas.** (pedido de Carlos
  2026-11-05) "No creo que el usuario deba hacer restart de una tarea fallida; si algo falló, es más valioso saber
  por qué que volver a intentar." Origen: `restart-mid-run` caso A ("failed · attempt 1/3" con reintento pendiente).
  Decisión (2026-11-05): el reintento automático con el motivo del fallo se mantiene; la tarjeta fallida del hilo
  muestra arriba el diagnóstico (check que falló con su salida, razones del QA, reporte del ejecutor, enlace a la
  evidencia) y se quita `Retry` (`TaskCard.tsx:432`); para seguir, se ajusta el pedido en el chat.
  Hecho: `task-report.ts` arma `diagnosis` (causa, check fallido con la cola de su salida, razones QA deduplicadas,
  reporte del ejecutor; rutas de worktree relativizadas; topes de bytes). La tarjeta lo muestra en `failed` con
  "View evidence" (abre ese run en Settings → Runs). Sin `Retry`. La interrupción (`failed` con
  `INTERRUPTED_REASON`) muestra solo "Resume". Gates del cerebro: tsc, lint, `test:coverage` 2308/0,
  `chat-retry-report` 23/23 y `restart-mid-run` 30/30. `chat-retry-report` falló 2 veces antes por timeout de 30 s
  del primer turno de Codex, que es previo a la tarea.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/RUN.1-live.json`
  Revisión: Opus (diff de Sol leído; capturas `failed-task-diagnosis.png` r1 y r2 mirados).
  Anotado: `pending` con reintento programado muestra el resumen, no el diagnóstico; "Interrupted" sale dos veces
  (en el estado y en la línea).
  Texto visible: "Interrupted — the task runner stopped before it finished" (un ícono no dice que no es un fallo)
  Texto visible: "Executor report (not verified)" (avisa que es lo que dijo el modelo, no un hecho)
  Texto visible: "Check output" (rótulo del desplegable de una salida larga) · "QA:" (de quién es la razón)
  Texto visible: "View evidence" · "Resume" (botones: una acción sin rótulo es ambigua)
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2)
- [x] **CI.62 — `ui:gate` borra al arrancar los `runDir` de más de 24 h.** (pedido de Carlos 2026-11-05: "no quiero
  capturas guardadas sin sentido") Limpieza manual ya hecha: 1932 carpetas `ui-gate-*` (384 MB) y 50 imágenes
  versionadas de `docs/done/evidence/`, que `.gitignore` ahora excluye. Falta el mecanismo para que no se repita.
  Hecho: `cleanOldUiGateDirs` (`scripts/ui-gate/lib.mjs`) borra al arrancar los `ui-gate-*` de más de 24 h;
  `project-add-menu` entra en la lista del pre-push. Gates del cerebro: `run.test.ts` 13/0, lint, `ui:gate smoke`
  7/7 con un `ui-gate-x-old` de fixture borrado ("cleaned 1 old ui-gate dirs").
  Ejecutado por: codex gpt-6-luna (mecanico)
- [x] **UI.64 — El (+) de proyecto y el de adjuntar abren un menú, no una acción directa.** (pedido de Carlos
  2026-11-05) "+ Add project" ofrece clonar desde URL como Orca, T3 y MonoCode. Adjuntar archivo en Chat y Dev hoy
  abre directo el selector del sistema; debe abrir antes un menú.
  Decisión (2026-11-05): adjuntar = "Subir desde la computadora" + "Archivo del proyecto"; clonar = URL + carpeta de
  destino elegible (por defecto la que contiene los proyectos), registra y activa. Referencias leídas (bundle de Orca, código de T3): ambas abren directo el selector al
  adjuntar; el menú del clip es decisión propia. MonoCode sin verificar (binario Tauri).
  Hecho: el (+) de proyecto, en la barra lateral y en Settings, abre un menú con "Open folder" y "Clone from URL".
  El diálogo pide Git URL y Clone location, por defecto la carpeta padre del proyecto activo, con "Choose folder"
  nativo y vista previa de la ruta final. `POST /api/projects/clone`: `git clone -- <url> <destino>` sin shell,
  solo https, ssh y git@ (`file://` solo con el flag de test que pone `ui-gate/run.mjs`), timeout de 45 s, destino
  exclusivo, borra solo lo que creó y registra y activa el clon. El clip abre "Upload from computer" y "File from
  project", que reusa el selector de `@`. Gates del cerebro: tsc, lint, `test:coverage` 2315/0,
  `project-add-menu` 12/12, `project-tabs` 40/40, `smoke` 7/7.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.64-live.json`
  Revisión: Opus (handler de clonar leído completo; capturas del menú, del diálogo y del clip mirados).
  Anotado: el menú del clip se superpone al borde del composer.
  Texto visible: "Clone from URL" · "Enter the Git URL and choose where to clone it." (el diálogo dice qué pide, como Orca)
  Texto visible: "Git URL" · "Clone location" · "Choose folder" · "Cancel" (rótulos de campos y botones de un formulario)
  Ejecutado por: codex gpt-6.1-sol (criterio r1) + gpt-6-luna (mecanico r2)
- [x] **CI.63 — `chat-retry-report`: el primer turno de Codex no cabe en 30 s y un párrafo salió dos veces.**
  (pedido de Carlos 2026-11-06) Visto 2026-11-05: falló 2 veces en `waitForResponse` del POST `/api/chat`
  (`chat-retry-report.mjs:130` y `:256`), que usa el timeout por defecto de Playwright (30 s) mientras la tarjeta
  espera 180 s. En una captura el mismo párrafo de Codex salió dos veces en la respuesta.
  Hecho: timeouts de 180 s y paso `assistant reply has no duplicated paragraph` (guarda DOM, mensajes y
  `[chat-turn]` si falla). El paso reprodujo el duplicado en la corrida del cerebro: el mensaje persistido traía el
  párrafo una vez, el texto en vivo dos (`docs/done/evidence/CI.63/assistant-duplicate-paragraph-turn1.json`).
  Causa: `replaceLiveText` (`src/dashboard/chat-live.ts`), compartido por Codex y Claude, reconciliaba el texto final
  de un mensaje contra todo el turno; tras una herramienta, el segundo mensaje quedaba duplicado. Ahora cada final
  reemplaza solo los deltas de su mensaje; test rojo→verde para ambos CLIs. Gates del cerebro: tsc,
  `test:coverage` 2317/0, `chat-retry-report` 25/25, `chat-streaming` 27/27, `codex-live` 15/15
  (`gate:evidence` `CI.63-chat-live`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.63-live.json`
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2)
- [x] **CI.64 — El pre-push no reconoce como "cambio de chat" `src/dashboard/chat-live.ts` ni el hilo.** (visto
  2026-11-06 al subir CI.63: "sin cambios de chat; omitidos" con `chat-live.ts` cambiado; los gates de chat los corrió
  el cerebro a mano) `chat_paths` (`scripts/pre-push.sh:107`) solo lista `chat-cli-models.ts`; faltan
  `chat-live.ts`, `default-chat-agent.ts` y `src/dashboard/app/src/components/thread/`.
  Hecho: `chat_paths` cubre `src/dashboard/(chat-|default-chat-)*.ts` y el hilo. Gate del cerebro: sondeo de la regex
  (5 rutas de chat coinciden, `server.ts` y Settings no), `bash -n`, hook instalado idéntico a la fuente.
  Ejecutado por: codex gpt-6-luna (mecanico)
- [x] **UI.65 — Acabados de la tarjeta de tarea y del menú del clip.** (pedido de Carlos 2026-11-06) Anotados en
  RUN.1 y UI.64: "Interrupted" sale dos veces en la tarjeta interrumpida (`TaskCard.tsx:263` y `:276`); `pending` con
  reintento muestra el resumen y no el diagnóstico (sin causa aislada: `task-report.ts:73` sí lo arma); el menú del
  clip se superpone al borde del composer (`AgentComposer.tsx`).
  Hecho: la tarjeta interrumpida dice "Interrupted" una vez; el menú del clip se ancla al composer
  (`ActionMenuButton` con `anchorRef`, `bottom-full`) y ya no pisa su borde en Chat ni Dev; paso nuevo
  `failed attempt shows diagnosis` en `chat-retry-report`: el intento 1/3 muestra el diagnóstico (no reprodujo el
  resumen visto en RUN.1; probable mensaje persistido antes de RUN.1, sin confirmar). Gates del cerebro: tsc, lint,
  `chat-retry-report` 26/26, `restart-mid-run` 31/31, `project-add-menu` 14/14 (`gate:evidence` `UI.65-live`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.65-live.json`
  Revisión: Opus (diff leído; capturas del clip antes/después en Chat y Dev, tarjeta fallida e interrumpida mirados).
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/UI.65.md
  Texto visible: "The task runner stopped before it finished" (un ícono no dice que el runner se cortó antes de terminar)
- [x] **DEV.1 — El candado "un árbol, un escritor" vive en el repo.** (GO de Carlos 2026-11-06) Hoy el pre-commit
  solo lo comprueba si existe `~/.agent-method/hooks/writer-lock.js` (`scripts/pre-commit.sh:25-34`); en otra máquina
  no protege.
  Hecho: `scripts/writer-lock.mjs` (copia del candado con el mismo archivo `.git/agent-writer.lock`, convive con el
  hook global) + 28 tests; el pre-commit lo comprueba siempre; `.claude/settings.json` lo registra como PreToolUse;
  `bun run writer-lock status|check|claim|release`; `AGENTS.md` § Un árbol, un escritor apunta ahí. Gates del cerebro:
  contraprueba con HOME temporal sin `.agent-method` (ajeno 1, propio 0, vencido 0), test 28/0; ejecutor:
  `test:coverage` 2347/0. Anotado: el repo no registra `release` en SessionEnd (lo hace el hook global; sin él,
  el candado vence a los 45 min).
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/DEV.1.md
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
- [x] **CI.65 — `chat-continuity` rojo tras SK.1: bloquea el push.** (visto 2026-11-06, pre-push de `c222bfc5`) Falló
  2 de 2 en el paso de thread de Codex expirado (el POST no deja `[chat-turn] received`); aislado, el diálogo "New
  chat" no ofreció Claude. El push previo `296bfbb6` pasó.
  Causa (r2): no es SK.1 (`296bfbb6` también falla en secuencia) ni Codex: tras un turno la UI sigue `busy` unos
  cientos de ms y el composer descarta el Enter (`AgentComposer.tsx:441`); el gate pulsaba Enter sin esperar "Send".
  Arreglo en el gate: `sendTurn` espera "Send message" habilitado (tope 30 s; si no, "composer stayed busy N ms") y
  anota los ms; mismo patrón en `chat-followup-task`, `chat-task-undo`, `chat-turn-details`. "New chat" sin Claude no
  se reprodujo (descartado). Gates del cerebro: `chat-streaming` 27/27, `codex-live` 15/15, `chat-continuity` 8/8 en
  secuencia (busy máx. 227 ms; ejecutor: 2 secuencias verdes, máx. 536 ms; `test:coverage` 2362/0).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.65-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2) + gpt-6-luna (mecanico r3) · Spec: docs/specs/CI.65.md
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
- [x] **UI.70 — Íconos por tipo de archivo y carpeta en el explorer, como VS Code.** (Carlos 2026-11-07, visto en
  MonoCode) Hoy `OrcaRightInspector.tsx:6-9` usa cuatro íconos genéricos de lucide (`FileCode`, `FileText`, `Folder`,
  `FolderOpen`). Propuesta: subconjunto de Material Icon Theme (MIT) como SVG estáticos en `dist/` (no en `main.js`),
  tabla extensión/nombre → ícono, genérico como respaldo; mismo ícono en tabs del editor y diff. Va después de SK.3.
  Hecho: `build:app` genera `dist/file-icons/manifest.json` desde `generateManifest()` (extensiones, nombres de
  archivo y carpeta, ya resueltos a SVG) y copia los 1130 SVG referenciados + `LICENSE` (4,9 MB fuera de `main.js`);
  resolver puro `lib/file-icons.ts` (nombre exacto → extensión compuesta más larga → default); `useFileIcons` hace un
  solo fetch; `FileIcon` cae al lucide de antes sin manifest. Aplicado en árbol, lista del diff y tabs de archivo.
  Gates del cerebro: `build:app`, `typecheck`, `lint`, `test:coverage` 2386/0, `dev-session-tabs` 50/50
  (`gate:evidence` `UI.70-dev-session-tabs`); captura del árbol mirada.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.70-live.json`
  Revisión: Opus (diff de build, resolver, hook, componente y usos leído).
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/UI.70.md
- [x] **CI.66 — CI rojo desde SK.2: el orden de skills depende del sistema de archivos.** (visto 2026-11-06, CI
  42307722525 y Mutation Shards 42361144282) `SK.2 execution phase instructions > combines primary and two phase
  skills…` espera `phase-a`, `phase-b` y omite `phase-c`; en Linux entró `phase-c`. Causa: `readdirSync` sin ordenar
  en `src/skills/registry.ts:123` y `:272`; APFS devuelve alfabético, ext4 no.
  Hecho: ambos recorridos usan `readdirSync(dir).sort()`; test nuevo fija orden alfabético por id en
  `listSkillFilesWithOrigin`. Gates del cerebro: `skill-library` 20/0, `typecheck`, `lint`, `test:coverage` 2368/0.
  Revisión: Opus (diff leído).
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.66.md (borrado)
- [x] **CI.67 — El pre-push desde un worktree commitea los fixtures de los tests en la rama del worktree.** (visto
  2026-11-06: 13 commits de fixture `51613edb..e0fde66c` subieron a master, revertidos en `85379e95`) Desde un
  worktree, git exporta `GIT_DIR` a los hooks (verificado en un repo temporal); `scripts/pre-push.sh:76` corre
  `test:coverage` con ese entorno y cada `git commit` de fixture escribe en el repo real. Desde el checkout principal
  git no exporta `GIT_DIR`, por eso no se vio antes.
  Hecho: `scripts/pre-push.sh` hace `unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE …` antes del worktree temporal y la
  suite; `scripts/pre-push-git-env.test.ts` fija que la línea limpia el entorno y va antes. Contraprueba del cerebro
  (repo temporal + worktree + push a remoto bare, hook que commitea en un temporal): sin `unset` la rama del worktree
  recibe el commit `leak`; con `unset`, no. Gates del cerebro: `bash -n`, `lint`, `test:coverage` 2370/0 (el
  ejecutor no pudo correrla: `EPERM`/`EADDRINUSE` del sandbox).
  Revisión: Opus (diff leído).
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.67.md (borrado)
- [x] **CI.68 — `model-routing`: "Use <CLI> for unassigned roles" se mira sin esperar.** (abierto 2026-11-07)
  Frenó el push de ADE.3 en el pre-push; aislado pasa 24/24. Causa: `model-routing.mjs:161` usaba `isVisible()`
  inmediato sobre un botón que aparece tras cargar el catálogo. Hecho: espera hasta 10 s y, si falla, el detalle
  lista los botones visibles de roles; mismo patrón en los hermanos del archivo (estado vacío, esfuerzo del
  revisor, aviso de correlación). Verde 3 veces seguidas y con `test:coverage` en paralelo.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.68/ui-gate-result.json`
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.68.md
- [ ] **CI.19 — El `git commit` del fixture falla a veces en el andamiaje de los ui-gates.** Visto 1 vez en
  `qa-negative` (2026-10-11, 1 de 9): `Command failed: git … commit -qm task fixture`, sin motivo porque el helper
  `run` usa `stdio: 'ignore'`. `qa-negative` ya reporta stdout/stderr y exit; los otros 20 flows con el mismo helper no.
  Al próximo fallo, leer el motivo en el `result.json` antes de arreglar; llevar el helper a `scripts/ui-gate/lib.mjs`.
  Fase 1 (2026-10-23): `run` vive en `scripts/ui-gate/lib.mjs` y los 27 flows lo importan; todo fallo dice
  `failed (exit N): <stdout+stderr>`. Gates (cerebro): `plan-doc` 16/16, `project-tabs` 39/39, `model-routing` 18/18;
  `test:coverage` 2012/0 (ejecutor). Sigue abierto hasta el próximo fallo: leer el motivo y escribir la fase 2.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.19-live.json`
  Ejecutado por: claude sonnet (criterio-alt; Sol sin cupo de 5 h)
  Bucle aislado 2026-11-03 (en serie, sin carga): `qa-negative` 3/3 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.
- [x] **CI.70 — Los ui-gates salen del pre-push a una corrida nocturna local.** (Carlos, 2026-11-08: "pasamos más
  tiempo en pruebas que en código… no quiero que se corra 3 veces… que esto no vuelva a pasar") Hecho: pre-push =
  typecheck + `test:coverage` + lint, sin flujos. `scripts/nightly-ui-gates.ts` corre todos los flujos (excepto
  `opencode-terminal` sin binario) sobre `origin/master` en `~/.orchestos/nightly/worktree`, uno por uno, reintento
  único que separa `flaky` de `failed`, evidencia copiada a `~/.orchestos/nightly/<fecha>/`, 7 días. LaunchAgent
  `dev.cagr1.orchestos.nightly-ui-gates` 01:30 (`bun run nightly:install`, instalado). El startup-guard avisa rojos,
  flaky o "sin corrida en 36 h". Local y no en GitHub: los flujos con modelo real usan los CLI con sesión de Carlos.
  Reglas: `AGENTS.md` § Gates ("cada prueba corre una vez"), `CLAUDE.md` § Hooks.
  Gates del cerebro: `tsc`, 25 tests (nightly + guard), `bash -n`, `plutil -lint`, `ui-gates-latest.json` de la
  corrida real (smoke + plan-doc, 2/2, worktree limpio), `launchctl print` cargado. Revisión: Opus (diff leído).
  Gate en vivo: corrida real del script nocturno, `docs/done/evidence/CI.70-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/CI.70.md
- [x] **CI.71 — El repo no depende del método personal de Carlos.** (GO de Carlos; plan en
  `docs/specs/LIMPIEZA-2.md` § 2) Las reglas del repo nombran rutas y alias de `~/.agent-method` (`delegate`,
  `roster.conf`, Sol/Luna/`criterio-alt`) y el vault `MemoriesMD`; quien clone el repo no tiene nada de eso. Cada
  referencia queda como regla propia con texto neutral. Se quedan a propósito: el reconocimiento de comandos
  `delegate` en `scripts/writer-lock.mjs` (genérico por nombre; quitarlo dejaría a una segunda sesión lanzar un
  ejecutor), `qa-negative.mjs` y `cli-registry.test.ts` (prueban aislamiento del `~/.claude` del host, producto),
  `tasks.yaml` y `PLAN.md`/`docs/done/` (registro histórico).
  Hecho: `AGENTS.md` (delegar = otro modelo con solo el spec; el modelo por rol es config del operador; sin alias ni
  `criterio-alt`), mensajes de `brain-no-code.js` y `subagent-budget.js`, comentario de `context-budget.js`, rutas
  neutrales en `writer-lock.test.ts`, `source: MemoriesMD/…` fuera de `docs/roadmaps/disciplines/` y fixtures,
  `docs/roadmaps/README.md`, `gotchas.md`, `CTX-GUARD.md`, dato de ejemplo `MemoriesMD` → `notes`. Qué se pierde: el
  rastro de origen de los roadmaps (vivía en el vault, no en el repo). `IDEAS.md` conserva menciones de origen.
  Gates del cerebro: `typecheck`, hooks + roadmap 69/0; ejecutor: writer-lock 28/0, lint exit 0.
  Gate en vivo: Playwright `project-tabs` 40/40 (sidebar con el dato renombrado), `docs/done/evidence/CI.71-live.json`.
  Ejecutado por: codex (mecanico) · Spec: docs/specs/CI.71.md
- [x] **CI.72 — La corrida nocturna de ui-gates no encuentra `node`: 45 de 49 rojos en 5 h 40 min.** (2026-11-09,
  primera corrida completa sobre `d32a9356`) El PATH del LaunchAgent está fijo en el plist
  (`scripts/launchd/dev.cagr1.orchestos.nightly-ui-gates.plist:18`) y no incluye `node`, que vive en nvm. Sin él
  los fixtures no se registran ("temporary project was not registered") y cada flujo espera su timeout y reintenta.
  Reproducido con `env -i` y el PATH del plist: `project-tabs` FAIL; mismo PATH + el bin de nvm: PASS 40/40.
  Hecho: el plist lleva un marcador y `install-nightly.sh` arma el PATH al instalar, en el orden del PATH de quien
  instala (sin `node_modules/.bin`), con los dirs de `bun node git claude codex opencode`; sin `bun`/`node`/`git` no
  instala. Si falta uno al correr, la corrida no arranca: publica `preparationError` en `ui-gates-latest.json`, que
  muestran el startup-guard y el pre-push. Reinstalado: los 6 binarios del LaunchAgent resuelven igual que en el
  shell (`diff` vacío). Rondas: r1 pre-push (mecanico), r2 `node_modules/.bin` (mecanico), r3 orden fallido
  (mecanico) → r4 (criterio).
  Gates del cerebro: `typecheck`, nightly + startup-guard 29/0, `bash -n`, `plutil -lint`, `project-tabs` 40/40
  con `env -i` y el PATH del plist instalado (antes FAIL). La corrida completa se verá esta noche.
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/CI.72.md
- [x] **CI.73 — Un ítem de `PLAN.md` cuyo título no se parsea desaparece sin aviso.** (IDEAS `#62`, GO de Carlos
  2026-11-09) `ITEM_LINE_RE` (`scripts/plan-status.ts:38`) exige que el título abra y cierre `**` en la misma línea;
  si no, `parsePlanDocumentSegments` (`:141-145`) lo trata como prosa y el reconcile, `plan:render` y
  `feature-status.json` lo omiten en silencio.
  Hecho: `findUnparsedPlanItemLines` (`plan-status.ts`) devuelve las líneas `- [ ] **`/`- [x] **` que no casan; el
  reconcile (`plan-import.ts`), el pre-commit (`plan-gate.ts`, sobre el PLAN staged) y `generate-feature-status.ts`
  fallan con línea y texto. Regresión con el caso real de H.5.3; el `PLAN.md` actual da `[]`.
  Gates del cerebro: `typecheck`, tests de `plan-status`/`plan-import`/`plan-gate`. Revisión: Opus (diff leído).
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/CI.73.md
- [ ] **CI.69 — `usage-bar`: a veces el Enter del composer no envía el turno.** (abierto 2026-11-08) Falló en el
  pre-push de ADE.7/8 (`2e9aae2d`, `1355590c`): `page.waitForResponse` 180 s sin `POST /api/chat`
  (`usage-bar.mjs:309`). Captura: picker de modelo abierto (Luna · medium) y el texto sigue en la caja, así que
  `handleSend` (`AgentComposer.tsx:468`) salió temprano (`orchestratorLoading`, `isLoadingModels` →
  `sendWhenReadyRef`, o catálogo vacío) o el Enter no llegó. Aislado pasó 2/2. Corrió en paralelo con los gates del
  ejecutor de ADE.9 (carga). Mismo terreno que CI.57 (elegir modelo de Codex). Fase 1: que el fallo deje evidencia
  (valor del textarea, picker abierto, `isLoadingModels`/catálogo, requests tras Enter).
- [ ] **CI.57 — `composer-picker`: a veces elegir otro modelo de Codex en Chat no queda aplicado.** (abierto
  2026-11-03) Falló 4 seguidas (pre-push del lote UI.57/58, 2 aisladas, una en worktree de `82820986`) en `Codex
  effort levels remain available` (`composer-picker.mjs:75-87`): tras clic en GPT-6.1-Sol el selector sigue en
  GPT-6-Luna. Luego pasó 11/11 en `50e087e2`, `a4beb111`, y 5 veces en HEAD (Sol 3, cerebro 2): intermitente, la
  bisección no prueba que sea UI.58. Sospecha (opinión de LLM): una actualización tardía del estado del chat pisa
  la selección. Fase 1: que el fallo deje evidencia (modelo del chat en API antes/después del clic, requests entre
  clic y reapertura, captura).
  Fase 1 hecha: si el paso falla, guarda `composer-picker-model-missing.json` y su captura en el `runDir` (red
  `/api/chat*` y `/api/config*` con ms desde el clic, sesión antes/después/al reabrir, botones marcados, esfuerzos
  visibles, estado del botón). Contraprueba forzada con todas las partes (Sol; `lastModel` de la sesión es `null` antes
  de enviar, la red es la evidencia útil); corrida normal 11/11 (Sol y cerebro, `gate:evidence`
  `CI.57-composer-picker`). Abierto hasta el próximo fallo. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `composer-picker` 15/15 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.
- [ ] **CI.55 — `tasks`: la tarea real `gate-role-task` a veces no deja `ROLE.md` en el primer intento.** (abierto 2026-11-02)
  Visto 1 vez (pre-push del lote UI.49–55, 2026-11-02): el gate corre Codex real (`gpt-6-luna`); la corrida
  terminó con `retryReason: "missing declared output(s): ROLE.md"`, `retryCount: 1`, `runId: null`, `qaVerdict: fail`, y
  `waitForTaskFinished` (`tasks.mjs:39`) lo toma como fin. Aislado pasa 43/43 justo después. El lote no tocó tareas.
  Evidencia: `docs/done/evidence/CI.55-prepush-fail.log`. Falta: que el próximo fallo deje la salida del CLI de esa
  corrida (stdout/stderr o el log del run) para distinguir modelo, cuota o sandbox.
  Fase 1 hecha: si el paso falla, guarda `role-task-missing-output.json` en el `runDir` del gate con la tarea, las
  filas de run con su detalle (`result`, `executorReply` completo, archivos, checks), las líneas `[cli-spawn]` del
  `dashboard.log` y el estado git/worktrees con `ROLE.md`; el detalle del paso lleva un resumen y la ruta. Contraprueba
  forzada con las 4 partes (Sol); corrida normal 43/43 (Sol y cerebro, `gate:evidence` `CI.55-tasks`). Abierto hasta
  el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `tasks` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Reproducido 2026-11-05 (ejecutor de RUN.1 r2, `tasks` 38/43, con RUN.2 aplicado: no es el bug de `notice`).
  Evidencia `$TMPDIR/ui-gate-88246/role-task-missing-output.json`: run `codex exec --sandbox workspace-write`
  `gpt-6-luna`, 1 iteración, 30 tokens de salida, `executorReply` "I can't make or verify this change because no
  file-editing tool is available in this session"; `retryCount 1`, tarea `pending` (reintento programado). Fase 2,
  dos hallazgos: (a) Codex a veces dice no tener herramienta de edición con `workspace-write` (causa sin aislar);
  (b) `waitForTaskFinished` (`tasks.mjs:39`) toma `pending` con reintento programado como fin.
  Fase 2 hecha: (b) `gate-role-task` sigue el reintento del producto como `gate-first-task` (hasta 3 intentos, cada
  uno con nota `gate-role-task retried` en el resumen); (a) cada intento fallido guarda
  `role-task-missing-output-attempt-<n>.json` con `codexRollouts` (primera línea y últimas 60 del rollout de Codex
  del proyecto temporal). Contraprueba forzada del ejecutor: rollout de 21 líneas capturado. Gates del cerebro: tsc,
  biome, `tasks` 43/43 (`gate:evidence` `CI.55-fase2-tasks`). Abierto hasta el próximo fallo: leer `codexRollouts`
  para aislar (a). Anotado: la escritura del JSON por intento no va envuelta en `capture`.
  Fase 2 por codex gpt-6-luna (mecanico).
- [ ] **CI.54 — `codex-live`: la burbuja del usuario a veces no aparece en 2 s.** (abierto 2026-11-02)
  Visto 1 de 3 (2026-11-02, "turn 1 user message appears before completion"); el pre-push reintenta y lo oculta.
  Fase 1: que el fallo deje evidencia (captura, DOM, composer, timeline, log); fase 2: causa con esa evidencia.
  Fase 1 hecha: si la burbuja falta a los 2 s, el paso guarda `turn1-bubble-missing.png` y un JSON con burbujas,
  cola del hilo, composer, botón, timeline, status del POST, `[chat-turn]` y a qué ms apareció (sigue hasta 15 s).
  Contraprueba forzada (filtro inexistente) con la evidencia completa; corrida normal 14/14 (Sol y cerebro). Abierto
  hasta el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1, r2).
  Bucle aislado 2026-11-03 (en serie, sin carga): `codex-live` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado. — Decidido 2026-10-16: entra la aprobación por tarea; la de cada herramienta sale como bloque propio.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.

**AT.11 adelantado (GO de Carlos 2026-10-26):** "cualquier CLI" sin instalar nada ni escribir código por CLI. Hoy cada
motor es código a mano (`src/run/executors/task-engines.ts:37-51`) y el único PTY está fijo a `opencode`
(`src/dashboard/terminal.ts:19`). Modelo: capa común configurable (como Orca: cualquier CLI de terminal) + adaptadores
ricos por CLI solo para streaming/sesiones/cuotas (como T3 Code). Fuera: chat con CLI genérico (necesita streaming).

## Fuera de fase

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

## Retirados

→ [11 ítems superados por UI.13/UI.14, retirados 2026-09-22](docs/done/retirados.md)

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de CX](docs/done/bloque-CX.md)
→ [cerrados de MR](docs/done/bloque-MR.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
→ [cerrados de UI](docs/done/bloque-UI.md)
→ [cerrados de CTX-GUARD](docs/done/bloque-CTX-GUARD.md)
→ [cerrados de SEC](docs/done/bloque-SEC.md)
→ [cerrados de OC](docs/done/bloque-OC.md)
→ [cerrados de UI / Sprint 30](docs/done/sprint-30.md)
→ [cerrados de Sprint 1](docs/done/sprint-01.md)
→ [cerrados de Sprint 2](docs/done/sprint-02.md)
→ [cerrados de Sprint 3](docs/done/sprint-03.md)
→ [cerrados de Sprint 4](docs/done/sprint-04.md)
→ [cerrados de Sprint 5](docs/done/sprint-05.md)
→ [cerrados de Sprint 6](docs/done/sprint-06.md)
→ [cerrados de Sprint 7](docs/done/sprint-07.md)
→ [cerrados de Sprint 8](docs/done/sprint-08.md)
→ [cerrados de Sprint 9](docs/done/sprint-09.md)
→ [cerrados de Sprint 10](docs/done/sprint-10.md)
→ [cerrados de Sprint 11](docs/done/sprint-11.md)
→ [cerrados de Sprint 12](docs/done/sprint-12.md)
→ [cerrados de Sprint 13](docs/done/sprint-13.md)
→ [cerrados de Sprint 14](docs/done/sprint-14.md)
→ [cerrados de Sprint 15](docs/done/sprint-15.md)
→ [cerrados de Sprint 16](docs/done/sprint-16.md)
→ [cerrados de Sprint 17](docs/done/sprint-17.md)
→ [cerrados de Sprint 18](docs/done/sprint-18.md)
→ [cerrados de Sprint 19](docs/done/sprint-19.md)
→ [cerrados de Sprint 20](docs/done/sprint-20.md)
→ [cerrados de Sprint 21](docs/done/sprint-21.md)
→ [cerrados de Sprint 22](docs/done/sprint-22.md)
→ [cerrados de Sprint 23](docs/done/sprint-23.md)
→ [cerrados de Sprint 24](docs/done/sprint-24.md)
→ [cerrados de Sprint 25](docs/done/sprint-25.md)
→ [cerrados de Sprint 26](docs/done/sprint-26.md)
→ [cerrados de Sprint 27](docs/done/sprint-27.md)
→ [cerrados de Sprint 28](docs/done/sprint-28.md)
→ [cerrados de Sprint 29](docs/done/sprint-29.md)
→ [cerrados de SET](docs/done/bloque-SET.md)
→ [cerrados de TRUST](docs/done/bloque-TRUST.md)
→ [cerrados de CHAT](docs/done/bloque-CHAT.md)
→ [cerrados de SKILLS](docs/done/bloque-SKILLS.md)
→ [cerrados de CFG](docs/done/bloque-CFG.md)
→ [cerrados de TCLI](docs/done/bloque-TCLI.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
