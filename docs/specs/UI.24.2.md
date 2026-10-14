# UI.24.2 — Tokens y jerarquía del hilo (spec)

Ítem de PLAN.md § UI.24. Solo presentación: ninguna función, handler, prop ni texto visible cambia.
Escribes bajo el candado de escritor del cerebro (`writer-lock status: ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.
Cambios sin commitear ajenos, no tocarlos: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`.

## Archivos que se tocan (y ninguno más)
- `src/dashboard/app/src/main.tsx`
- `src/dashboard/app/src/index.css`
- `src/dashboard/app/src/components/chat/OrchestChatView.tsx`
- `package.json`, `bun.lock`
- `.impeccable/config.json`
- `scripts/ui-gate/flows/chat-streaming.mjs`

No se editan los componentes de `src/dashboard/app/src/components/ui/` (terceros): se componen con props y `className`.

## 1. Inter es la fuente de toda la app
- `main.tsx`: borrar los dos imports `jakartaLatinExt` / `jakartaLatin` (líneas 9-10) y sus dos `@font-face`
  `'Plus Jakarta Sans'` (líneas 17-18).
- `index.css:109`: `font-family: 'Inter Variable', system-ui, -apple-system, sans-serif;` y debajo
  `font-optical-sizing: auto;`.
- `index.css:419-423`: borrar el comentario y la regla `[data-ff] { font-family…; font-optical-sizing… }` (el `body`
  ya lo cubre). Las reglas `[data-ff] :focus-visible` se quedan.
- `package.json:77`: quitar `@fontsource-variable/plus-jakarta-sans`; `bun install` para actualizar `bun.lock`.
- `.impeccable/config.json`: quitar la entrada entera `overused-font` / `plus jakarta sans` (líneas ~14-19); el JSON
  debe seguir siendo válido.
- `index.css` no gana ninguna otra línea.

## 2. `OrchestChatView.tsx` — el hilo usa `ChatMessage` de la familia
Import: `import { ChatMessage } from '@/components/ui/chat-message'`. Quitar `Bot` y `User` del import de lucide.

**Contenedor de la lista** (`:279`): `max-w-3xl lg:max-w-4xl mx-auto flex flex-col gap-5` y añadirle el atributo
`data-ff` (sale `space-y-5`; `ChatMessage` se alinea con `self-end`/`self-start`).

En los tres usos de `ChatMessage` de abajo pasar `initial={false}` y `layout={false}`: el movimiento de entrada es
de UI.24.7; hoy el bloque en vivo se sustituye por el mensaje final y con la entrada activa parpadea.

**Mensaje del usuario** (`:285-326`) pasa a ser:
- `<ChatMessage key={msg.id} from="user" time={msg.timestamp} actions={<botón copiar>} initial={false}
  layout={false} className="max-w-2xl select-text">`.
- Hijos: el bloque de adjuntos tal cual (`:295-307`) y, después, `{msg.content}`.
- El botón de copiar es el mismo `<button>` (mismo `onClick`, `title="Copy"`, `aria-label="Copy"`, iconos
  `Check`/`Copy`) con `className="p-1 rounded-control text-app-muted hover:text-app transition-colors"` (sin
  `absolute`, sin `opacity-*`: la fila meta de `ChatMessage` ya lo revela al pasar el cursor).
- Desaparecen el `div` exterior `flex items-end justify-end`, la burbuja `rounded-card … border … text-xs`, el
  `span` del timestamp y el icono `User`.
- `max-w-2xl` en la raíz es obligatorio: los gates leen la burbuja del usuario con `div.max-w-2xl`.

**Mensaje del asistente** (`:330-569`) pasa a ser:
- `<ChatMessage key={msg.id} from="assistant" actions={<botón copiar>} initial={false} layout={false}
  className="max-w-full w-full select-text">` — sin caja, sin borde, sin fondo, sin icono `Bot`.
- Hijos, en el mismo orden de hoy: bloque de razonamiento, bloque de herramientas, `div.prose`, tarjeta de tarea
  retenida, bloque del reporte de tarea. Toda la lógica (`onClick`, condiciones, textos) queda idéntica.
- `div.prose` (`:403`): conservar la clase `prose` (los gates leen `div.prose`); quitar `text-xs leading-relaxed`
  (hereda 14 px / 20 px de `ChatMessage`) y añadir `whitespace-normal` (el envoltorio de `ChatMessage` trae
  `whitespace-pre-wrap` y los saltos entre bloques de markdown se verían como líneas vacías). El resto de la lista
  de clases `[&>…]` no cambia.
- El botón de copiar va en `actions` con la misma clase que el del usuario.

**Bloque en vivo** (`:571-580`): `<ChatMessage from="assistant" initial={false} layout={false} aria-live="polite"
className="max-w-full w-full select-text">` con el mismo `div.prose` del punto anterior (clases idénticas) y el
mismo `<Markdown>`. Sin `Bot`, sin caja.

**Colores — un acento, sin degradados ni sombras de color.** Sustituciones literales en este archivo:

| Hoy | Queda |
|---|---|
| `:423` y `:528` `p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-500/40 shadow-xl space-y-3 mt-3` | `p-4 rounded-card bg-app-surface border border-app space-y-3 mt-3 whitespace-normal` |
| `:426` y `:531` `w-2 h-2 rounded-full bg-amber-400 animate-ping` | `w-2 h-2 rounded-full bg-app-warning` |
| `:427` y `:532` `font-bold text-xs text-white` | `font-semibold text-xs text-app` |
| `:431` y `:536` `text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30` | `text-[10px] font-mono px-2 py-0.5 rounded-control bg-app-bg text-app-muted border border-app` |
| `:435` `text-xs text-zinc-300` y `:540` `text-xs text-zinc-300 font-mono` | `text-xs text-app-muted` / `text-xs text-app-muted font-mono` |
| `text-xs text-red-300` (`:437`, `:520`, `:546`) | `text-xs text-app-error` (conservar `mt-3` donde esté) |
| `:455` y `:505` `… bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95` | `flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent hover:bg-app-accent-hover text-white text-xs font-semibold transition-colors` (`:505` conserva `disabled:opacity-60`) |
| `:473` `… bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-all` | `flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-surface hover:bg-app-elevated text-app text-xs font-medium border border-app transition-colors` |
| `:335` `rounded-xl border border-zinc-800/90 bg-zinc-900/60 overflow-hidden text-xs mb-3` | `rounded-card border border-app bg-app-surface overflow-hidden text-xs mb-3 whitespace-normal` |
| `:344` `… text-zinc-400 hover:text-zinc-200 bg-zinc-900/90 font-medium transition-colors border-b border-zinc-800/60` | `w-full px-3 py-2 flex items-center justify-between text-app-muted hover:text-app font-medium transition-colors border-b border-app` |
| `:347` `text-indigo-400` (Sparkles) y `:360` `text-indigo-400` (›) | `text-app-muted` |
| `:357` `… text-[11px] text-zinc-300` y `:361` `text-zinc-300` | `text-app-muted` en lugar de `text-zinc-300` |
| `:370` `text-zinc-500` | `text-app-muted` |
| `:369` `space-y-1.5 mb-3` | `space-y-1.5 mb-3 whitespace-normal` |
| `:377` `p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 …` | `p-2.5 rounded-control bg-app-surface border border-app flex items-center justify-between text-xs` |
| `:380` `bg-emerald-400` | `bg-app-success` |
| `:381` `font-mono text-indigo-300 font-medium` | `font-mono text-app font-medium` |
| `:384`, `:390` `text-zinc-500` | `text-app-muted` |
| `:394` `… bg-emerald-500/10 text-emerald-400 border border-emerald-500/20` | `px-1.5 py-0.5 rounded-control text-[10px] font-mono bg-app-bg text-app-muted border border-app` |
| `:273` `text-xs text-app-muted` (estado vacío) | `text-sm text-app-muted` |
| `:591` `mx-auto max-w-3xl text-xs text-red-400` | `mx-auto max-w-3xl text-sm text-app-error` |

Al terminar, en `OrchestChatView.tsx` no queda ninguna de estas cadenas: `indigo`, `emerald`, `amber`, `zinc-`,
`red-300`, `red-400`, `gradient`, `animate-ping`, `shadow-`, `<Bot`, `<User`.

No se tocan: la cabecera (`:245-265`), el bloque "pensando" (`:581-586`, es de UI.24.3), el composer, ni la
estructura de la tarjeta de tarea (una tarjeta por tarea y el UUID son de UI.24.5).

## 3. Gate — `scripts/ui-gate/flows/chat-streaming.mjs`
Justo después del paso `'Chat exchange order remains correct after reload'` (`:463-469`) y antes del comentario
`// The Dev workspace uses…`, con el hilo recargado en pantalla (2 mensajes del usuario, 2 respuestas):

1. `await shot('thread-hierarchy')`.
2. Un `page.evaluate` que devuelva, y un `step` por cada dato:
   - `thread-font-inter`: `getComputedStyle(document.body).fontFamily` contiene `Inter`.
   - `thread-body-14px`: `font-size` computado del último `div.prose` es `14px`.
   - `thread-assistant-unboxed`: desde el último `div.prose` hacia arriba hasta (sin incluir) el ancestro
     `[data-ff]`, todo elemento tiene `background-color` de alfa 0, `border-top-width` `0px` y `box-shadow` `none`.
   - `thread-user-bubble-visible`: el hijo `div.whitespace-pre-wrap` del último `div.max-w-2xl` tiene fondo opaco y su
     L* difiere ≥ 5 del L* del primer ancestro con fondo opaco. Reutilizar tal cual la función `labLightness` y el
     recorrido de ancestros de `scripts/ui-gate/flows/thread-states.mjs:~85-125` (copiarlos dentro del `evaluate`).
   - `thread-no-decoration`: dentro de `[data-ff]`, 0 elementos con clase `animate-ping`, 0 con `background-image`
     computado que contenga `gradient`, y 0 `svg.lucide-bot` / `svg.lucide-user`.
   El detalle de cada paso lleva el valor medido.

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit` (raíz) y `bunx tsc --noEmit -p src/dashboard/app`
- `bun run lint`
- `bun run build:app`
- `bun run ui:fidelity:jsx`
- `grep -nE "indigo|emerald|amber|zinc-|red-300|red-400|gradient|animate-ping|shadow-|<Bot|<User" src/dashboard/app/src/components/chat/OrchestChatView.tsx` → sin salida
- `grep -rn "Jakarta" src package.json .impeccable` → sin salida

Si algo de este spec no se puede aplicar tal cual (una línea no coincide, un tipo no cuadra), detente y dilo con
la línea exacta; no improvises una alternativa.
