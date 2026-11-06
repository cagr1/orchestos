# Prompt para Google AI Studio — completar el prototipo de OrchestOS

Uso: pegar todo lo que está debajo de la línea en la misma conversación de AI Studio donde se
generó `orchestos-ai-agent-dashboard`. Base: auditoría del código (2026-09-21) + capturas del
prototipo corriendo + decisiones de Carlos del 2026-09-21 (`PLAN.md`, UI.10.A / UI.11).

---

Este prototipo ya tiene el look que quiero. **No cambies la estética**: misma paleta oscura, misma
densidad, misma tipografía mono para IDs/rutas, mismo estilo de tarjetas, badges y tablas. Lo que
te pido es completarlo, corregir el comportamiento y dejar el sistema visual consistente.
Sigue siendo solo front con datos mock.

## 1. Sistema visual (primero, porque todo lo demás lo usa)

- Mueve todos los colores a variables CSS en `index.css` (fondo, superficie, superficie elevada,
  borde, texto, texto tenue, acento, éxito, aviso, error) y úsalas desde Tailwind. Hoy hay 16
  colores hex sueltos (`bg-[#090d16]`, `bg-[#080c14]`, `bg-[#0b0f19]`, `bg-[#070a12]`) aunque
  `--background` ya existe.
- Escala tipográfica de **4 tamaños** como máximo (por ejemplo 11, 12, 14 y 20 px) declarados
  como tokens. Hoy conviven `text-[9px]`, `text-[10px]` (102 usos), `text-[11px]` (91 usos),
  `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` y `text-2xl`.
- **3 radios** como máximo: controles, tarjetas y píldoras. Hoy se mezclan `rounded`, `rounded-md`,
  `rounded-lg`, `rounded-xl` y `rounded-full` en elementos del mismo tipo.
- **Un solo componente `StatusBadge`** para todos los estados (done, running, pending, blocked,
  failed, draft, approved…). Hoy hay 8 variantes distintas entre Tasks, Specs, Memory y Threads.
- Un solo estilo de barra de pestañas para toda la app; hoy Settings usa otro radio.
- Tema oscuro por defecto. Los nombres de tema: OrchestOS, Graphite, Carbon, Light. Ninguno se
  llama como un proveedor de IA.

## 2. Sidebar izquierdo — proyectos

- Icono de cada proyecto: `FolderClosed` de lucide.
- A la derecha del nombre, un chip chico con la cantidad de agentes, centrado verticalmente en la
  fila. Al pasar el mouse por la fila, el chip se oculta y aparecen tres iconos pequeños: chevron,
  `Ellipsis` y `Plus`. Sin hover, desaparecen.
- **Clic en la fila de un proyecto: solo expande o colapsa sus agentes.** No abre ninguna pantalla.
- Agentes del proyecto: lista anidada con una línea vertical a la izquierda. Cada fila: icono del
  CLI, título truncado (con tooltip del título completo), tiempo relativo. Mientras el agente
  trabaja, un loader chico en lugar del icono; al terminar, un check chico verde.
- `Plus` abre el selector de CLI para crear un agente nuevo en ese proyecto.
- `Ellipsis` abre un menú con solo dos opciones: **Project settings** y **Delete project** (texto e
  icono en rojo, con confirmación: lo quita del espacio de trabajo, no borra la carpeta).
- Cuando no hay nada abierto en Dev, el área central queda vacía con el logo de OrchestOS
  centrado y tenue.
- Barras de cuota abajo a la izquierda: por cada CLI, solo las ventanas de 5 h y 7 d, con el icono
  del CLI en sus colores originales.

## 3. Proyecto: dónde viven Tasks, Runs, Graph, Memory, Specs, Skills, Instincts y Plan

- **Elimina la barra de pestañas del modo Dev** (Tasks | Runs | Graph | … | Project settings).
- Esas pantallas pasan a **Settings → sección Projects → <proyecto>**: título con el nombre del
  proyecto y pestañas `Tasks | Runs | Graph | Memory | Specs | Skills | Instincts | Plan`. Se llega
  desde el menú `Ellipsis` → Project settings, o desde la lista de proyectos dentro de Settings.
- En esa página, al final, una zona de peligro para borrar definitivamente los datos del proyecto
  (distinto de "Delete project" del sidebar).

## 4. Panel derecho

- Un **único** botón para mostrar/ocultar el panel, fijo arriba a la derecha. Hoy hay dos (uno en
  el header y otro en la barra de pestañas de Dev) más una `X` dentro del panel.
- Pestañas con icono: Files, Diff, **History** (en lugar de "Agents") y Props.
- History = historial de agentes: título + "N shown", control segmentado
  `Workspace | Project | All`, buscador, grupos por proyecto con contador, y por sesión: título,
  última línea del mensaje, icono del CLI, cantidad de mensajes, hace cuánto, modelo, chevron para
  expandir y `Ellipsis`. Cuando cierro un agente del sidebar, pasa a este historial.

## 5. Header

- Quita el indicador de estado de arriba a la derecha (el punto amarillo + icono de actividad).
- Deja el breadcrumb `proyecto / rama` como está.

## 6. Chat

- Renderiza markdown en los mensajes (negritas, listas, código inline y bloques). Hoy
  `whitespace-pre-wrap` muestra `**texto**` literal.
- La tarjeta "Task Held for Human Approval" queda igual; el resto del chat también.

## 7. Settings

- Settings es pantalla completa: **oculta el sidebar Chat | Dev mientras estás en Settings**. Hoy
  se ven dos columnas de navegación a la vez y la de la izquierda queda vacía. "Back to app"
  vuelve donde estabas.

## 8. Runs

- Con el panel derecho abierto, las tarjetas de KPI se aprietan (el costo se corta) y la tabla
  trunca todas las columnas. Haz que las KPI se reacomoden y que el detalle del run se abra como
  panel que reemplaza la lista o como hoja lateral, sin encoger la tabla a una columna.

## 9. Estados y detalles que faltan

- Estado vacío con mensaje y acción en Specs, Memory, Skills, Instincts, Runs y Tasks.
- Estado de carga (skeleton) y estado de error en cada vista.
- Los handlers vacíos de la paleta de comandos (`onSelectTab={() => {}}`,
  `onSelectModel={() => {}}` en `App.tsx`) tienen que hacer lo que dicen.
- "Add or Upload Project" usa `prompt()` del navegador: reemplázalo por un diálogo propio.
- Accesibilidad: filas clickeables como `<button>` (hoy son `<div onClick>` en el sidebar), tooltip
  en todo texto truncado, `aria-label` en botones de solo icono y en los checkboxes de las tablas.

Cuando termines, dime qué archivos cambiaste y qué quedó sin resolver.

---

# Ronda 2 (2026-09-21) — después de verificar la versión corregida

Verificado corriendo el prototipo: sistema de tokens hecho (0 colores hex sueltos), sidebar con
chips, hover `Ellipsis`/`Plus`, clic que solo colapsa, loader/check, menú Project settings / Delete
project en rojo, estado vacío con logo, cuotas 5h/7d, History, sin indicador en el header,
markdown en el chat y página de proyecto en Settings con las 8 pestañas. Pegar lo de abajo:

---

Muy bien, esto ya es lo que quiero. Ajustes finales, sin tocar la estética:

1. **Quita la pestaña "Props"** del panel derecho. Quedan Files, Diff y History.
2. **Error de React en consola:** en la lista de chats, el botón "Delete chat" está dentro de otro
   `<button>` (la fila). HTML no permite botones anidados. Haz la fila un `div` con
   `role="button"` y `tabIndex={0}` (o saca el botón de borrar fuera del botón de la fila).
3. **Chat — filas de herramientas** (`orchestos.worktree.spawn`, etc.): el JSON de argumentos se
   parte en varias líneas y el texto `success` se sale del borde en la primera fila. Nombre de la
   herramienta en una línea, argumentos en una sola línea truncada con tooltip (o expandibles al
   clic), y el estado alineado a la derecha sin desbordar.
4. **Chat — listas de tareas en markdown:** `- [x] texto` se ve como viñeta con `[x]` literal.
   Rendérealas como check chico.
5. **Settings: reemplaza la barra de navegación por esta, que es la que tiene la app real.**
   Mismos grupos, mismo orden, mismo contenido; solo cambia el look, que es el tuyo. Cada sección
   con el patrón de fila que ya usas: título, descripción de una línea y control a la derecha.

   **WORKSPACE**
   - **General** — *Appearance*: los 4 temas (OrchestOS, Graphite, Carbon, Light) como tarjetas
     con muestra de color; el activo marcado.
   - **Health** — lo que hoy llamas "Setup" + *Project Health*: estado del sistema ("All
     prerequisites met" / "Action needed"), tareas bloqueadas, pendientes de revisión, costo de
     los últimos 7 días y aprendizajes recientes, cada bloque con su botón "View".

   **CONFIGURE**
   - **API & Models** — *API Keys*: una fila por clave (OpenRouter, Anthropic, OpenAI) con badge
     Set/Not set, el valor enmascarado en mono y un campo password para reemplazarla; botón "Change
     key" que abre un asistente para OpenRouter/Anthropic/OpenAI. Fila de **Ollama**: "Detected" /
     "Not detected" y un campo para sobreescribir la URL. Nota al pie: "Leave a field blank to keep
     its current value. Stored in ~/.orchestos/.env". Botón Save.
   - **Model routing** — *Model routing config*: origen de la config (defaults o archivo propio),
     botón "Start free" (preset de modelos gratis), una grilla de **Roles** — Planner, Executor
     (heavy), Executor (light), Default — cada uno con un combobox de modelo con buscador (no
     `<select>`), y **QA judge** en fila completa con la nota "optional, leave on auto unless you
     need a specific judge". Tabla "task → model" con las tareas pendientes, plegable. Botón Save.
   - **Executor** — dos tarjetas. *Chat build mode* ("How OrchestOS runs build tasks the chat
     creates automatically"): chips Auto · Local · Claude CLI · opencode CLI · Codex CLI · API, con
     "not detected" en gris para los CLI que no están instalados. *Executor engine* ("Default engine
     for tasks that don't declare their own `engine:`"): mismo selector de chips, más "Max
     iterations (agentic)" y "Timeout in minutes (external)" como inputs numéricos. Cada tarjeta con
     su Save.

   **OBSERVE**
   - **Usage** — tres KPI arriba: Total spend, Total runs, Avg. cost / run. Debajo, **Daily
     activity**: un heatmap de actividad por día estilo GitHub, con leyenda "less → more". Debajo,
     **Spend by model**: tabla Model · Runs · Tokens · Spend. Estado vacío si no hay runs.

   **PROTECT**
   - **Danger zone** — tarjeta roja "Reset OrchestOS": "Deletes all runs and unverified instincts,
     and resets every task in tasks.yaml back to pending. Does NOT touch config, skills,
     CONSTITUTION.md/CONTEXT.md, or memory." Botón rojo con confirmación.
   - **Language** — dos opciones English / Español; cambia toda la interfaz al instante.

   **PROJECTS**
   - **Un ítem por proyecto**, separado, con su icono de carpeta y su nombre (orchestos,
     MemoriesMD, SalaDespecho…). **No** un solo ítem "Projects" con un selector arriba: quita ese
     selector de la derecha de la página del proyecto. Al clickear un proyecto se abre su página
     (la que ya hiciste, con las 8 pestañas y su zona de peligro). Si no hay proyectos: "No
     projects registered" y un botón para agregar uno.

   Quita "AST Worktrees & Safety" y "CLI Integrations": no existen en el producto; lo de CLIs vive
   en Executor.

6. **Chat — lo que la app real tiene y el prototipo todavía no:**
   - Selector de **agente** además del de modelo: chips con el icono de cada CLI (Claude, Codex,
     OpenCode) y "API". El selector de modelo y el de esfuerzo (Low · Medium · High · Reasoning)
     que ya hiciste se quedan, pero dependen del agente elegido.
   - "New chat" abre primero ese mismo menú de agente (como el `+` de un proyecto).
   - **Barra de estado de la sesión**, fina, pegada abajo del chat: por cada CLI, una barra de
     uso de contexto con su porcentaje, en el color del CLI.
   - Adjuntar archivos con el clip (ya está el icono): muestra el archivo adjunto como chip dentro
     del compositor, con una `x` para quitarlo.

Cuando termines, dime qué archivos cambiaste y qué quedó sin resolver.

---

# Ronda 3 (2026-09-21) — Executor

Verificado: Settings con los grupos reales y proyectos separados, chat con selector de agente,
barra de contexto por CLI, listas de tareas con check. Queda Executor. **Diagnóstico:** en el
producto, las dos tarjetas NO son lo mismo — "Chat build mode" guarda `agent` (auto, local, claude,
opencode, codex, api) y "Executor engine" guarda `apiMode` (single-shot / agentic) + iteraciones
máximas, que solo aplica cuando el agente es API (`screens-ops.js:2075-2126`). El prompt de la ronda
2 le pidió "mismo selector de chips" en las dos (error del cerebro), y encima el producto ya las
muestra como dos tarjetas con dos Save. Pegar lo de abajo:

---

La sección Executor no funciona como UX: dos tarjetas con la misma fila de chips y dos botones Save
confunden. Rehazla así, siguiendo el patrón de la página "Agents" de Orca (sin cambiar tu estética):

1. **Una sola sección: "Default agent"**, con descripción de una línea ("Which agent runs the
   tasks OrchestOS creates. A task can override it with its own `engine:`.").
2. Debajo, un grupo de **chips grandes con el icono de cada agente** (Auto, Claude, Codex, OpenCode,
   Local, API), el elegido con borde y un check. Los CLI no instalados se ven apagados con el texto
   "Not installed" debajo del nombre, y no se pueden elegir.
3. **Se guarda al elegir** (sin botón Save): un toast "Default agent: Codex".
4. Debajo, **filas de ajuste que dependen del agente elegido**, con el patrón de fila que ya usas
   (título, descripción de una línea, control a la derecha):
   - Si es un **CLI** (Claude, Codex, OpenCode): "Timeout" — "Stop the CLI if it runs longer than
     this" — stepper numérico con la unidad "min".
   - Si es **API**: "Mode" — segmented control `Single-shot | Agentic`; y si es Agentic, "Max
     iterations" — stepper numérico.
   - Si es **Auto** o **Local**: sin filas extra.
   Estos ajustes también se guardan solos al cambiar.
5. Borra la segunda tarjeta "Executor engine" y los dos botones Save.

Otros dos detalles:
- **Usage → Daily activity:** hay celdas con borde blanco y fondo vacío mezcladas con las verdes;
  todas las celdas deben ser del mismo estilo, variando solo la intensidad del verde (y un gris
  tenue para "sin actividad"). Agrega el tooltip con fecha y cantidad al pasar el mouse.
- **Usage:** "Total runs" dice 3 pero la tabla suma 142 runs; que los números de los KPI salgan de
  la misma data que la tabla.

Cuando termines, dime qué archivos cambiaste y qué quedó sin resolver.
