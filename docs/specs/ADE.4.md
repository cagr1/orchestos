# ADE.4 — Reasignar atajos grabando las teclas (como MonoCode)

Ítem: `PLAN.md` § ADE.4. Depende de ADE.3 (`59150637`): registro en `src/dashboard/app/src/lib/keybindings.ts`
(14 comandos, `command(id, title, keys, when, code)`, `match` deriva de `keys` + `code`), tabla en
`OrchestSettingsView.tsx:1842-1880` (`data-keybindings`, filas `data-keybinding`). MonoCode: "Click a shortcut to
record new keys. Press Delete while recording to disable it."

## Qué cambiar

1. `lib/keybindings.ts` — la combinación pasa a ser un dato:
   `type Chord = { primary: boolean; ctrl: boolean; alt: boolean; shift: boolean; code: string }`
   (`primary` = ⌘ en macOS, Ctrl fuera; `ctrl` = Ctrl literal, solo distinto de `primary` en macOS).
   Cada comando tiene `defaultChord` (los de hoy, mismos resultados que el `match` actual; Esc =
   `{ ..., code: 'Escape' }` sin modificadores) y el efectivo sale de `defaultChord` + override.
   `match(event)` compara modificadores exactos (incluido `shiftKey`) y `event.code`. `keys` (para mostrar) se
   genera del chord efectivo: `⌘`/`Ctrl`, `Ctrl`, `Alt` (`⌥` en macOS), `Shift` (`⇧` en macOS) y la tecla desde
   `code` (`KeyK`→`K`, `Digit1`→`1`, `Comma`→`,`, `Backquote`→`` ` ``, `BracketLeft`→`[`, `Escape`→`Esc`, `F1`…,
   flechas → `←↑→↓`; el resto, el `code` sin prefijo).
2. Overrides por dispositivo en `localStorage` `orchestos-keybindings`: `{ [id]: Chord | null }` (`null` =
   desactivado). Mismo patrón que `lib/editor-settings.ts` (lectura validada, `subscribe`, `useSyncExternalStore`,
   evento `storage`). Funciones: `setChord(id, chord | null)`, `resetChord(id)`, `resetAllChords()`,
   `effectiveChord(id)`. Un desactivado no matchea nunca y no sale en la paleta.
3. `chordFromEvent(event): Chord | null` y `validateChord(id, chord)`:
   - Solo teclas modificadoras (Meta/Control/Alt/Shift) → `null` (sigue grabando).
   - Sin ningún modificador: solo se acepta `Escape` para `stop-turn` y `F1`–`F12` para cualquiera; el resto →
     error "Add a modifier".
   - Reservadas del navegador (con `primary`): `KeyW`, `KeyT`, `KeyN`, `KeyQ`, `KeyR`, `KeyL`, `Digit1`–`Digit9`,
     `Tab` → error "Reserved by the browser".
   - Choque: otro comando con el mismo chord efectivo y `when` que se solapa (`App` se solapa con todos;
     `Settings` y `Dev` no se solapan entre sí) → `{ conflictWith: id }`.
   - `command-palette` y `settings-search` comparten chord por diseño (vistas distintas): grabar uno no toca el otro.
4. Settings → Keybindings (`OrchestSettingsView.tsx:1842+`):
   - La celda del atajo es un botón (`data-keybinding-record`). Clic → modo grabación: la celda muestra
     "Press keys…" con `aria-live="polite"`; el listener de grabación va en captura (`capture: true`) y hace
     `stopPropagation` + `preventDefault`, así no dispara ningún comando de App mientras graba.
   - En grabación: Esc cancela (salvo grabando `stop-turn`: ahí Esc se graba y se cancela con clic fuera);
     Delete/Backspace desactiva el comando ("Disabled" en la celda); una combinación válida se guarda al instante.
   - Error de validación: texto en la fila (`text-app-error`, `role="alert"`), sigue grabando.
   - Choque: en la fila, "Used by <title>" + botones "Replace" (desactiva el otro y guarda este) y "Cancel".
   - Fila con override: botón "Reset" (vuelve al default). Encima de la tabla, a la derecha del buscador,
     "Reset all" solo si hay algún override.
5. `CommandPalette.tsx` y `App.tsx` ya leen `KEYBINDINGS`; deben re-renderizar al cambiar overrides
   (`useSyncExternalStore` del punto 2 en ambos). `reachesAppFromTerminal` sigue igual.

## Texto visible nuevo (va al ítem como `Texto visible:`)

"Press keys…", "Disabled", "Add a modifier", "Reserved by the browser", "Used by <title>", "Replace", "Cancel",
"Reset", "Reset all" (estados y decisiones de la grabación: un ícono no los explica).

## Qué NO tocar

- Lista de comandos y sus defaults (los de ADE.3). Sin sincronizar entre dispositivos (localStorage, como tema).
- `index.css`: no se suma CSS.

## Cómo se verifica

- `lib/keybindings.test.ts`: los 14 defaults producen exactamente los mismos `match` que antes (tabla de eventos
  de ADE.3); `chordFromEvent` ignora modificadores solos; Esc sin modificadores solo vale para `stop-turn`;
  reservadas rechazadas; choque detectado por `when`; override desactivado no matchea; `keys` en Mac y no-Mac.
- Ui-gate `scripts/ui-gate/flows/keybindings.mjs`, pasos nuevos al final: Settings → Keybindings → grabar
  "Toggle sidebar" con ⌘⇧E → la fila muestra ⌘ ⇧ E; volver a la app: ⌘⇧E oculta el sidebar y ⌘B ya no; grabar
  "Go to file" con ⌘⇧E → "Used by Toggle sidebar" → Replace → Toggle sidebar queda "Disabled"; ⌘W → "Reserved
  by the browser"; Delete en "New chat" → "Disabled" y Alt+N no hace nada; recargar la página → overrides
  conservados; "Reset all" → defaults (⌘B vuelve a funcionar). Capturas de grabación, choque y reservado.
- Gates: `bunx tsc --noEmit`, `bun test src/dashboard/app/src/lib/keybindings.test.ts`, `bun run build:app`,
  sonda: cargar la app en Playwright sin `pageerror`,
  `bun run gate:evidence -- --label ADE.4-keybindings-record -- bun run ui:gate keybindings dev-terminal settings-pages`.
