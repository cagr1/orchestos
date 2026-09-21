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
