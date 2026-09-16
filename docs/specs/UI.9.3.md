# UI.9.3 — Modo Dev completo

## Objetivo

Completar el modo Dev del shell UI.9: Activity reemplaza la presentación “Runs”; el rail
colapsado conserva proyectos reconocibles y operables como iconos; y el árbol tiene una sola
selección de proyecto/agente, con borde según A.3. Los estados anómalos se muestran junto a su
entidad según A.4, usando únicamente datos que ya entrega el frontend.

## Alcance de implementación

- `src/dashboard/public-src/islands/shell/Sidebar.tsx` (aprox. líneas 210–290): resolver el
  estado activo entre fila de proyecto y sesión/agente: proyecto activo solo en Workspace con
  ese `workspaceProjectId`; sesión activa solo en Chat con ese `chatSessionId`; en Activity
  ninguna fila del árbol queda seleccionada. Así nunca tienen borde simultáneo. En rail
  expandido, conservar el árbol y sus acciones. En rail colapsado, cada proyecto
  sigue visible como icono clicable con nombre accesible/tooltip; ocultar etiquetas, contador de
  agentes, filas hijas y botón `+`, sin apilar texto ni controles. Activity y Settings conservan
  sus iconos navegables.
- `src/dashboard/public/styles.css` (aprox. líneas 542–578 y 682–686): implementar y verificar
  el rail Dev colapsado solo-ícono; mantener foco visible y tooltip/nombre accesible de proyecto.
  El único borde/fondo de selección del árbol pertenece al proyecto o a la sesión activa, nunca a
  los dos. No cambiar colores de marca ni el switch de modos de UI.9.1.
- `src/dashboard/public/app.js:147` y `src/dashboard/public/i18n.js:12,915`: rotular el destino
  como “Activity” / “Actividad” (incluida la etiqueta del rail), conservando `id: 'activity'` y
  evitando cambiar navegación, endpoints o estado de Runs.
- `src/dashboard/public/screens-ops.js:640–870,2381–2387` e
  `src/dashboard/public/i18n.js:446–448,1355–1357`: presentar la pantalla delegada de Runs como
  Activity / Actividad también en título, subtítulo y texto explicativo. Conservar render/wire,
  filtros, análisis, detalle y datos de ejecuciones existentes.
- Anomalías (A.4): conservar el estado fallido/bloqueado en la fila de la ejecución/tarea donde
  ya aparece. No añadir banners globales ni replicar el estado en otra entidad. El modelo
  `ProjectRow` (`src/dashboard/types.ts:104`) no expone estado de Git/worktree: no agregar
  detección Git, endpoints, handlers ni nuevas señales de backend en UI.9.3; el worktree sucio
  queda fuera hasta que exista una fuente de datos del producto.

## No tocar

- Backend, endpoints, esquema/DB, ejecución de tareas o detección de estado del worktree.
- Switch Chat | Dev, comportamiento del modo Chat, diálogo de agregar proyecto, controles de CLI,
  selector de modelo/esfuerzo e inspector (UI.9.1, UI.9.2, UI.9.4 y UI.9.5).
- La semántica o el identificador `runs` de APIs/estado, ni el contenido funcional de Runs; el
  cambio es de presentación y etiqueta en Activity.
- Archivos ajenos ya modificados/no rastreados.

## Verificación requerida

1. `bunx tsc --noEmit`, `bunx biome check` para archivos tocados, tests UI relevantes y
   `bun run build:ui`.
2. Dashboard real + Playwright: en Dev expandido, seleccionar un proyecto y luego una sesión hija;
   comprobar que el borde migra del proyecto a la sesión y nunca aparece en ambos. Cambiar a
   Activity y comprobar que Activity es la única selección de navegación y ninguna fila del árbol
   queda seleccionada.
3. Colapsar/expandir el rail: Activity, Settings y proyectos siguen operables por icono; el icono
   del proyecto conserva tooltip/nombre accesible; no se muestran textos de hijos/contadores ni
   controles apretados; el switch Chat | Dev sigue legible y navegable.
4. Activity muestra “Activity”/“Actividad” y mantiene filtros y ejecuciones; verificar una
   ejecución fallida con su estado inline y que no aparece aviso global duplicado. Confirmar que
   Tasks conserva su estado bloqueado/fallido inline donde ya se lista.
5. Guardar evidencia del gate vivo en `docs/done/evidence/UI.9.3-live.json`; al cerrar el ítem,
   registrar evidencia y `Gate en vivo:` en `docs/done/sprint-30.md`/PLAN conforme al protocolo,
   y borrar este spec en el commit de cierre.
