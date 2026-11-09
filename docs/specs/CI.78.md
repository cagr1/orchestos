# CI.78 — `shell-look`: el panel del chat ya no es el hermano del `aside`

Hecho verificado: `shell-look` falla en master con `chat: panel lighter than chrome: panel=null`. En
`scripts/ui-gate/flows/shell-look.mjs:22` el panel del chat se toma como `sidebars[0]?.nextElementSibling`; desde que
el sidebar va envuelto por `ResizableAside` (`src/dashboard/app/src/components/common/ResizableAside.tsx`) el `aside`
no tiene hermano siguiente → `null`. La captura muestra el panel del chat más claro que el sidebar (el producto
cumple; el selector quedó viejo).

Cambio (solo el flujo): para `panelSelector === 'sibling'`, tomar el panel como el primer ancestro con
`background-color` no transparente (`rgba(0, 0, 0, 0)`) del encabezado/raíz de la vista Chat — usa un ancla estable
que ya exista en el DOM (p. ej. el `h1`/heading "Chat" o el contenedor del composer); verifícalo leyendo el JSX de
la vista Chat (`components/chat/OrchestChatView.tsx`). No cambies el criterio del paso (fondo del panel distinto del
del sidebar) ni el caso `main` de Settings. No toques código de producto.

Verificación: `node --check scripts/ui-gate/flows/shell-look.mjs`, `bunx biome format --write` del archivo,
`bun run lint` exit 0. No corras `ui:gate` (EPERM): lo corre el cerebro. No commitees.

## Ronda 2

El panel ya se mide bien (`panel=rgb(14, 19, 32) sidebar=rgb(8, 12, 20)`). Nuevo fallo, causado por CI.77: el
separador de `ResizableAside` pasó de `div role="separator"` a `<hr>` nativo (rol implícito, sin atributo), y el
flujo lo busca con `[data-resizable-aside="<lado>"] [role="separator"]` en `shell-look.mjs:877, 898, 948, 952`.
Cambia esos 4 selectores a `[data-resizable-aside="<lado>"] hr` (equivalente exacto, también para el `count()` de
la línea 952). Nada más. Mismas verificaciones.

## Ronda 3

`[data-resizable-aside="left"] hr` también casa con otros `<hr>` del sidebar (el paso "collapsed navigation has no
resize handle" cuenta >0). Cambia los 4 selectores a `[data-resizable-aside="<lado>"] hr[aria-label^="Resize"]`
(el separador lleva `aria-label` "Resize navigation sidebar" / "Resize workspace inspector",
`ResizableAside.tsx:94-97`). Nada más.

## Ronda 4

El sidebar colapsado no se desmonta: `App.tsx:1817` lo oculta con `hidden` (display:none), así que el separador
sigue en el DOM pero no es visible ni enfocable. El paso "collapsed navigation has no resize handle"
(`shell-look.mjs` ~952) debe comprobar que no es visible: `(await <locator>.isVisible()) === false` con el mismo
selector `hr[aria-label^="Resize"]`, detalle `'left separator hidden'`. Nada más.
