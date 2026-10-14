# UI.26.1 — Marco: cabecera, barras laterales y panel

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.

## Objetivo

Que el marco de la app tenga la forma de Gr8r (medidas en PLAN.md § UI.26): barra lateral y cabecera sobre el fondo,
el contenido como un panel algo más claro, sin líneas entre ellos; filas planas; iconos en un solo tono. Solo
presentación: ni handlers, ni estado, ni textos visibles salvo lo que se indica.

## Dónde

- `src/dashboard/app/src/components/layout/ShellHeader.tsx` (85 líneas).
- `src/dashboard/app/src/components/layout/ShellSidebar.tsx` (barra de Chat y de Dev).
- `src/dashboard/app/src/App.tsx:1165-1330` aprox. (contenedor de la columna principal).
- `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:703-913` (barra lateral de Settings) y la raíz
  `<main>` de Settings (`:915`).

## Reglas de forma

1. **Panel.** La columna principal (todo lo que queda a la derecha de la barra lateral y debajo de la cabecera) pinta
   `bg-app-surface` con `rounded-tl-[10px]`; barra lateral y cabecera pintan `bg-app-bg`. Fuera `border-r` de la barra,
   `border-b` de la cabecera y cualquier línea entre ellos. Las vistas montadas en la columna (chat, Settings) no deben
   tapar el panel con su propio `bg-app-bg` en su raíz: quítalo de la raíz de `OrchestChatView` y de `<main>` de
   Settings si lo tienen. Si al hacerlo `thread-states` falla en el contraste de la burbuja del usuario, deja el fondo
   del chat como estaba y repórtalo (no ajustes tokens).
2. **Filas de navegación** (ítems de Settings, chats, proyectos y sus hijos, "New chat"): alto 28 px (`h-7`), `px-2`,
   `gap-2`, `rounded-control`, `text-[12.5px] font-medium`, `text-app-muted`; hover `bg-app-surface text-app`; activo
   `bg-app-surface text-app`. Sin `border`, sin `shadow-*`, sin `font-semibold`/`font-bold` en el activo. "New chat" es
   una fila más (icono + texto), sin caja.
3. **Iconos**: 16 px (`w-4 h-4`), `text-app-muted`; en la fila activa `text-app`. Ningún icono de navegación en color de
   paleta ni en `text-app-accent` (hoy: `Palette` sky, `Activity` emerald, `Key` amber, `Cpu` indigo, `Server` teal,
   `DollarSign` emerald, `ShieldAlert` rose, `Globe` sky, `FolderClosed` accent, `MessageSquare`/`Code2` accent).
   Excepción: el punto verde de salud de Health se queda (es estado) pero con `bg-app-success`.
4. **Rótulos de sección** ("Chats", "Projects", "Workspace", "Configure", "Observe", "Protect"): `text-[11px]
   font-semibold text-app-muted`, `px-2`, sin `uppercase` ni `tracking-wider`. Si el texto está escrito en mayúsculas en
   el JSX ("CHATS", "PROJECTS"), pásalo a "Chats"/"Projects" **solo si** ningún flujo de `scripts/ui-gate/flows/`
   busca el literal en mayúsculas (grep antes); si alguno lo busca, deja el literal.
5. **Contadores** (chats por proyecto, etc.): sin píldora ni borde; `text-[11px] tabular-nums text-app-muted`, sans.
6. **Buscadores de las barras**: `h-7`, `bg-app-surface` sin borde, `rounded-control`, `text-[12.5px]`; foco con el
   anillo de la familia (`[data-ff] :focus-visible`), así que la barra lateral lleva `data-ff` en su raíz.
7. **Switch Chat | Dev**: mismo control segmentado que `SettingsSegmented` de `components/settings/primitives.tsx`
   (reutilízalo si encaja con sus props; si no, mismas clases), sin borde exterior, iconos muted.
8. **Cabecera**: `h-11`, `bg-app-bg`, sin borde. Marca "Orchest OS" en `text-[13px] font-semibold` (el "OS" puede
   seguir en acento: es la marca). Ruta proyecto/rama en sans (fuera `font-mono`), `text-[12.5px] text-app-muted`, el
   nombre del proyecto en `text-app`.
9. Borrar en hover (papelera de chat): `hover:text-app-error`, no `hover:text-rose-400`.
10. **Cero clases de paleta de Tailwind** (`(emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray|
    violet|pink|cyan|orange|yellow)-N`) en `ShellHeader.tsx`, `ShellSidebar.tsx` y en `OrchestSettingsView.tsx:703-913`.

## No tocar

`ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*` (fijados por `ui:fidelity:jsx` o fuera de alcance),
`components/ui/*`, `index.css` y los `--app-*`, el contenido de las secciones de Settings y de las pestañas de proyecto.

## Gate nuevo `scripts/ui-gate/flows/shell-look.mjs`

Copia el andamiaje de `smoke.mjs` (arranque, `step`, evidencia) y regístralo como lo estén los demás flujos. Pasos, en
el tema por defecto, con la página de Chat y luego con Settings → General abiertos:
- `sidebar rows flat`: ninguna fila de navegación de la barra visible tiene `border-top-width` > 0 ni `box-shadow` ≠
  `none` (computed style).
- `nav icons one tone`: todos los `svg` de filas de navegación no activas comparten el mismo `color` computado.
- `no line between sidebar and panel`: `border-right-width` de la barra = 0 y `border-bottom-width` de la cabecera = 0.
- `panel lighter than chrome`: el `background-color` computado de la columna principal ≠ el de la barra lateral.
- `no palette classes in chrome`: ningún elemento dentro de la cabecera o de las barras laterales tiene una clase que
  case con la regex de la regla 10.
Contraprueba: con `ShellSidebar.tsx` revertido temporalmente (`git stash push -- <ruta>`), `shell-look` debe fallar;
pega esa salida y restaura (`git stash pop`).

## Verificación (pegar salida real)

    bun run typecheck
    bun run lint
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate shell-look smoke project-isolation project-tabs model-routing chat-roles thread-states text-sweep

Reportar: archivos tocados, qué literales de rótulo se cambiaron o no (y por qué), si el fondo del chat se pudo quitar,
y cualquier regla que no se pudo cumplir tal cual.
