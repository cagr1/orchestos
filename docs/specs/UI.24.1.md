# UI.24.1 — Base de la familia Fluid Functionalism y lámina de estados

Contexto y dirección: `PLAN.md` § UI.24. Este ítem solo pone la base y una vista de desarrollo. **No toca el hilo
real**: `components/chat/OrchestChatView.tsx` y `components/common/AgentComposer.tsx` quedan como están.

Escribes bajo el candado de escritor del cerebro (`writer-lock status: ocupado: claude` es quien te delega: sigue).
No commitear, no `git stash`, no `prettier`, no tocar `PLAN.md`/`NEXT.md`. No correr `bun run test:coverage`.
Los cambios sin commitear en `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json` y
`.orchestos/feature-status.json` son ajenos: no tocarlos.

## Qué se construye

### 1. Alias `@/`
`@/*` → `src/dashboard/app/src/*`. Declararlo en `src/dashboard/app/tsconfig.json` (`baseUrl` + `paths`) y, si el
`tsc --noEmit` de la raíz o `bun test` no lo resuelven desde ahí, también donde haga falta (tsconfig raíz o
`bunfig.toml`). `scripts/build-app.ts:14` usa `Bun.build`: comprobar que el bundle resuelve el alias; si no, añadir
la resolución ahí. Criterio: `bun run build:app`, `bunx tsc --noEmit` y un test que importe un archivo con `@/`
pasan los tres.

### 2. Componentes de la familia (código de terceros, MIT)
Fuente: registro shadcn de `https://www.fluidfunctionalism.com/r/<nombre>.json` (repo
`mickadesign/fluid-functionalism`). Instalar: `chat-message`, `input-message`, `thinking-indicator`,
`thinking-steps`, `card`, `badge`, `button`, `banner`, `tooltip`, `elevated`, y todo lo que declaren en
`registryDependencies` (`utils`, `springs`, `tokens`, `type-scale`, `surface-classes`, `surface-context`,
`shape-context`, `size-context`, `icon-context`, `font-weight`, `omit`, `file-thumbnail`, `use-fluid-hover`,
`use-touch-primary`…), flavor Radix.

- Destino: `src/dashboard/app/src/components/ui/`, `.../lib/`, `.../hooks/` (lo que cada entrada del registro indique
  en `target`/`path`, bajo la raíz del alias).
- Crear `src/dashboard/app/components.json` para la CLI de shadcn si la CLI funciona en este layout
  (`npx shadcn@latest add <url> --overwrite`). Si no funciona en 2 intentos, materializar los archivos leyendo los
  JSON del registro (campo `files[].content`) con un script desechable en `/tmp`; el resultado en el repo debe ser
  el mismo. Decir en el reporte cuál de los dos caminos se usó.
- **No editar el contenido de esos archivos** salvo lo imprescindible para compilar aquí (ruta de import). Cada
  edición se lista en el reporte con archivo y motivo.
- Dependencias npm nuevas permitidas: las que el registro declare (`@radix-ui/react-collapsible`,
  `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, y `clsx`/`tailwind-merge` si `utils` las pide), más
  `@fontsource-variable/inter`. Ninguna otra. `pdfjs` solo si `file-thumbnail` no compila sin ella; avisar.
- Añadir en `THIRD_PARTY_NOTICES.md` (crearlo en la raíz si no existe) la atribución MIT de Fluid Functionalism.

### 3. Puente de tokens en `src/dashboard/app/src/index.css`
Los componentes leen tokens de shadcn y propios (`--background`, `--foreground`, `--muted`, `--muted-foreground`,
`--border`, `--card`, `--accent`, `--destructive`, `--surface-1…8`, `--hover`, `--active`, `--selected`, `--tint`,
`--tint-hover`, `--focus-ring`, `--shadow-color`, `--info`, `--success`, `--warning`, escala tipográfica
`--fs-*`/`--lh-*`). El registro trae sus valores para `light` y `dark` en `cssVars` y sus reglas en `css`.

- Los colores **se derivan de los `--app-*` existentes**, para los cuatro temas (`orchestos`, `graphite`, `carbon`,
  `light`; selector `[data-theme=…]`, `index.css:49-100`): `--background: var(--app-bg)`,
  `--foreground: var(--app-text)`, `--muted-foreground: var(--app-text-muted)`, `--border: var(--app-border)`,
  `--destructive: var(--app-error)`, `--success: var(--app-success)`, `--warning: var(--app-warning)`,
  `--info` y `--focus-ring: var(--app-accent)`.
- La escalera `--surface-1…8` sube desde `--app-bg` hasta por encima de `--app-surface-elevated` en pasos parejos
  (`color-mix` con `--app-text`), de modo que `surface-1` = fondo de página. Los tres temas oscuros usan los valores
  `dark` del registro para `--hover`, `--active`, `--tint*`, `--shadow-color`; `light` usa los `light`.
- `--accent` de shadcn es un neutro de hover, **no** el celeste: mapearlo a una superficie (`--surface-3` o
  equivalente). El celeste de marca queda solo en `--focus-ring`, `--info` y la acción primaria.
- Registrar en `@theme inline` las utilidades que los componentes usan (`bg-background`, `text-foreground`,
  `text-muted-foreground`, `bg-surface-N`, `bg-hover`, `text-body`, `text-caption`, …) según `cssVars.theme` del
  registro.
- Copiar tal cual las reglas `css` del registro que hagan falta (`@keyframes shimmer`, `.shimmer-text`, spinner del
  botón). **No** copiar la regla global `:focus-visible` de `tokens`: cambiaría el foco de toda la app; aplicarla
  solo bajo `[data-ff]` (ver punto 5).
- No se cambia ningún token `--app-*` ni ninguna regla existente.

### 4. Inter variable, local
`@fontsource-variable/inter` con el eje `opsz` (archivo con `opsz` y `wght`), cargada como hoy se carga Plus
Jakarta Sans (`src/dashboard/app/src/main.tsx:7-25`, loader `.woff2` de `build-app.ts:20`). Familia `'Inter Variable'`.
**No** cambiar la fuente de `body`: Inter se aplica solo bajo `[data-ff]` en este ítem.

### 5. Lámina de estados
- `src/dashboard/app/src/components/thread/ThreadStatesSheet.tsx`: vista sin API ni estado global, con datos fijos en
  el mismo archivo. Raíz con `data-ff` (fuente Inter, foco de la familia) y `data-testid="thread-states-sheet"`.
- Se abre con `?view=thread-states`: decidirlo en `main.tsx` antes de montar `App` (no hay router, `App.tsx:86`).
  Sin ese parámetro la app se comporta exactamente igual que hoy.
- Respeta el tema: lee `?theme=<orchestos|graphite|carbon|light>` y lo pone en `data-theme` del `<html>`; por
  defecto `orchestos`.
- Contenido, cada bloque con un rótulo `text-caption` y `data-testid="state-<id>"`, en una columna de `max-w-3xl`:
  1. `message-user` — `ChatMessage from="user"` con hora y acción copiar.
  2. `message-assistant` — `ChatMessage from="assistant"` con dos párrafos y acción copiar.
  3. `message-attachments` — `ChatMessage from="user"` con 2 `File` de imagen generados en memoria (canvas → blob)
     y texto.
  4. `thinking` — `ThinkingIndicator` en curso.
  5. `thinking-steps-running` y `thinking-steps-done` — `ThinkingSteps` con 3 pasos (uno con detalle), en curso y
     terminado/plegado.
  6. `composer-empty` y `composer-with-files` — `InputMessage` vacío y con texto + 1 adjunto; con un botón de
     adjuntar, un control de modelo a la izquierda y enviar a la derecha en sus slots.
  7. `card` — `Card` con título, texto, un `Badge` de estado y dos `Button` (primario y secundario).
  8. `badges` — `Badge` en variantes neutro, success, warning, destructive (solid y dot).
  9. `banner` — `Banner` en `info`, `warning` y `error`/`destructive` con una acción.
- Sin texto de relleno tipo lorem: frases cortas y reales del dominio (crear una tarea, check fallido, etc.).
- Ningún color literal ni degradado en la lámina: solo tokens y props de la familia.

### 6. Gate
`scripts/ui-gate/flows/thread-states.mjs` (patrón de `smoke.mjs`, helpers de `run.mjs:178-243`): abre
`/?view=thread-states`, comprueba visible cada `state-<id>`, comprueba que `getComputedStyle` de la raíz da familia
Inter, que no hay errores de consola ni peticiones fallidas, y hace `shot('thread-states-orchestos')`,
`shot('thread-states-light')` (con `?theme=light`) a página completa. Además un paso que abre `/` sin parámetro y
comprueba que carga el chat de siempre (`textarea` visible).

## Qué no se toca
`OrchestChatView.tsx`, `AgentComposer.tsx`, `App.tsx` (salvo que el desvío de `main.tsx` sea imposible; avisar),
Settings, modo Dev, backend, tokens `--app-*`, la fuente del `body`, los flujos `ui-gate` existentes.

## Cómo se verifica (lo corre también el cerebro)
1. `bunx tsc --noEmit`
2. `bun run lint`
3. `bun run build:app`
4. `bun run ui:fidelity:jsx`
5. `bun run ui:gate thread-states`
6. `bun run ui:gate smoke text-sweep composer-picker`
7. `bun test src/dashboard` (los tests del front existentes siguen verdes)

## Reporte
Archivos creados/modificados; camino de instalación usado (CLI o registro); ediciones a archivos de terceros;
dependencias añadidas con versión; peso del bundle antes/después (`ls -l src/dashboard/app/dist`); qué gates
corriste y su salida; qué no pudiste verificar.
