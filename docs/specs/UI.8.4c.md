# UI.9.5 — Inspector condicional sobre el shell Chat | Dev

Retoma la pieza pausada UI.8.4c después de UI.9.1–UI.9.4. Dirección aprobada por Carlos:
inspector derecho contextual (0 px y ausente visualmente cuando está cerrado), no riel vacío
permanente; consultar `docs/dashboard-experience-direction.md` § Arquitectura visual y
`PLAN.md` § UI.8.4. Se revisaron las capturas reales `~/Documents/screens/Orca1_main.png` y
`Orca_agents.png`: respetar jerarquía y selección contextual de Orca sin copiar su marca. El árbol
proyecto → rama → agentes sigue siendo responsabilidad de UI.9.3/UI.8.4a.

## Contrato — sin decisiones para el ejecutor

1. **Una superficie, una fuente de estado.** Reemplazar el `SidePanel` flotante de detalle de tarea
   (`src/dashboard/public/app.js:1074`) y el right-rail persistente (`state.rightPanelOpen` /
   `rightPanelTab`, cerca de `app.js:76`) por `Inspector`, montado dentro de `#rightpanel`.
   Estado único: `null | { kind: 'task', id: string } | { kind: 'tool', tab: 'explorer' | 'terminal' | 'diff' }`.
   Al cambiar a otro proyecto, modo o pantalla, cerrar el inspector para no dejar contenido de otro
   contexto visible. No persistir qué entidad está abierta.
2. **Cerrado de verdad.** `#rightpanel` ocupa 0 px, sin borde, contenido, toggle ni resize handle
   visible; el canvas recupera ese ancho. El ancho abierto mantiene `--rightpanel-w`,
   `orchestos-rightpanel-width` y límites actuales 220–720 px. Limpiar en el arranque las claves
   antiguas `orchestos-rightpanel` y `orchestos-rightpanel-tab`; conservar el ancho.
3. **Detalle de tarea en el inspector.** Migrar intactas las capacidades del `SidePanel.openTask`
   (badge/id, descripción, outputs, metadatos, última ejecución, clarificación+ejecutar, Explain,
   borrar con confirmación y errores/toasts) a `#rightpanelBody`, sin backdrop. Actualizar todos los
   call sites de `SidePanel.openTask` en `app.js` y `screens-core.js`; no debe quedar otra instancia
   de `SidePanel` ni drawer `.side-panel`.
4. **Herramientas accesibles.** Explorer, Terminal y Diff se abren desde acciones explícitas del
   command palette (`app.js:2287`, cuyo flujo actual compone pantallas y entidades). `Inspector`
   conserva renderizado y comportamiento existentes de esas herramientas; abierto como `tool`, el
   toprow muestra sus tabs y el botón cerrar. Abierto como `task`, solo muestra cerrar. No volver a
   introducir un toggle para abrir un panel vacío.
5. **Shell React.** Adaptar `shell-store.ts`, `shell-api.ts` y `RightPanelToprow.tsx` para recibir
   sólo el tipo/tab del inspector y exponer la acción de cierre/selección necesaria; `app.js` sigue
   siendo dueño del estado y del render vanilla. Botones semánticos, accesibles por teclado,
   etiquetas i18n en inglés/español. El cierre es el último hijo del toprow y queda anclado al
   borde derecho (regla histórica documentada en `RightPanelToprow.tsx`).
6. **Transiciones y teclado.** Cerrar con el botón, `Escape` si el foco no está en input/textarea y
   no hay modal ni command palette abierto, al navegar a otra pantalla, cambiar Chat ↔ Dev o cambiar
   proyecto. Los flujos que navegan y luego abren una tarea deben seguir abriéndola. El poll de
   30 s no debe cerrar ni repintar destructivamente el inspector. Sin backdrop.
7. **Responsive.** En viewport móvil (390×844), inspector abierto ocupa el viewport como panel
   superpuesto, usable y con botón de cierre; cerrado no reserva espacio. Respetar
   `prefers-reduced-motion`.
8. **Compatibilidad/memoria.** Actualizar comentarios en `index.html`, `styles.css`,
   `RightPanelToprow.tsx` y `app.js` que presenten el riel/toggle persistente como regla vigente;
   conservar la referencia histórica a la decisión revertida, sin borrar su historial. Actualizar
   `public-src/lib/shell-store.ts` y `public/i18n.js` (no hay espejo `public-src/lib/i18n.ts` para
   estas claves: verificarlo antes de editar).

## Fuera de alcance

- No cambiar el árbol de proyectos/agentes, añadir menú de tres puntos, acciones Project settings /
  Delete project, ni resolver el aislamiento de datos/settings por proyecto. Son las observaciones
  de Carlos del 2026-09-16 anotadas en `PLAN.md`, pendientes de su propio spec.
- No mover Runs ni el detalle expandible de run al inspector; no crear vista Activity nueva.
- No cambiar endpoints/backend, datos de tareas, `chat_turns`, ni rutas/navegación legacy más allá
  de cerrar el inspector al cambiar de contexto.
- No tocar `Header.tsx`, los internos de Explorer/Term/renderDiff, ni tareas adyacentes.

## Archivos de referencia / alcance previsto

- `src/dashboard/public/app.js:76-77, 717, 736, 823, 1074-1210, 2287-2425, 3122-3140, 3210-3255`
  — estado y render vanilla, ciclo de navegación/boot, paleta y SidePanel.
- `src/dashboard/public-src/lib/shell-store.ts:27-67`,
  `src/dashboard/public-src/islands/shell/shell-api.ts:17-38`,
  `src/dashboard/public-src/islands/shell/RightPanelToprow.tsx:1-90` — puente/componente React.
- `src/dashboard/public/index.html:30-44`, `src/dashboard/public/styles.css:58-72,216-242,1128-1180,1390-1410,1740-1770`,
  `src/dashboard/public/screens.css:386-496`, `src/dashboard/public/i18n.js:225-240,1132-1148`.
- `scripts/ui-gates/ui3-shell.mjs` y tests existentes del shell/panel (localizar por búsqueda antes
  de editarlos); `docs/dashboard-experience-direction.md:68-74,124-140`.

El ejecutor puede editar sólo estos archivos y los tests/evidencia directamente necesarios. Si la
implementación real contradice este contrato o requiere archivos/cambios adicionales, detenerse y
reportarlo; no ampliar el alcance.

## Verificación y evidencia

1. Baseline y cierre: `bunx tsc --noEmit`, tests relevantes, `bun run build:ui`,
   `bunx biome check` en archivos tocados, `node scripts/ui-gates/ui81-visual-consistency.mjs` y
   `bun run test:coverage` completos.
2. Actualizar y pasar `scripts/ui-gates/ui3-shell.mjs`: cerrado al boot = attached pero 0 px, sin
   toggle/handle visible; al abrir tarea/pestaña herramienta el inspector abre; cierre por botón,
   Escape y cambio de proyecto/modo/pantalla; el toprow sigue anclado; `App.rerender()` conserva
   exactamente una instancia de cada shell.
3. Búsqueda sin resultados (excepto historial/documentación y el nombre de la propia tarea) para
   `SidePanel`, `rightPanelOpen`, `rightPanelTab`, `rpToggle`, `orchestos-rightpanel-tab`,
   `rightpanel-w-collapsed`, y clases `.side-panel*` en fuentes activas; regenerar `dist/ui.js` con
   `bun run build:ui`.
4. Gate en vivo con dashboard real y Playwright; guardar mediciones/capturas en
   `docs/done/evidence/UI.9.5-live.json`: boot cerrado/ancho 0; tarea real abre con detalle y sin
   backdrop; resize persiste y al recargar inicia cerrado; cierre por botón/Escape/navegación;
   cambiar de proyecto no conserva detalle ajeno; regresión "Open in Workspace" de UI.9.2 abre la
   tarea correcta; palette abre Terminal y permite cambiar a Diff; viewport 390×844 usable.
   Bajar el dashboard al terminar. No declarar gate vivo si no fue observado en navegador real.

Al cerrar UI.9.5, documentar evidencia en `docs/done/sprint-30.md`/`docs/done/evidence/`, cerrar
UI.9.5 y la subpieza UI.8.4c/UI.8.4 padre si todas sus piezas constan cerradas, reconciliar plan,
y borrar este spec en el commit de cierre según el ciclo de vida de specs.
