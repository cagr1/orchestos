# UI.12.1 — Tokens del prototipo: paleta, temas, fuentes, radios y escala

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. Contexto en `PLAN.md` § `UI.12`.
Fuente de los valores: `~/Documents/screens/orchestos-ai-agent-dashboard/src/index.css` (el
prototipo). **Solo se cambian valores de tokens y nombres de tema; ningún layout, ninguna pantalla.**

## Por qué alcanza con esto

Todo el producto lee un solo juego de variables: `src/dashboard/public/styles.css:6-80` (`:root` =
tema `orchestos`) más un bloque por tema (`styles.css:~93-180`), y Tailwind las usa vía
`src/dashboard/public-src/styles/ui.css:32-64` (`@theme inline`). Cambiando esos valores cambia el
vanilla y las islas React a la vez.

## Cambios

1. **Paleta** — por cada tema, mapear las variables del prototipo a las nuestras:

   | nuestra | del prototipo |
   |---|---|
   | `--bg` | `--app-bg` |
   | `--surface` | `--app-surface` |
   | `--surface-hi` | `--app-surface-elevated` |
   | `--surface-2` | `color-mix(in oklab, var(--surface) 50%, var(--surface-hi))` |
   | `--border` | `--app-border` |
   | `--border-soft` | `color-mix(in oklab, var(--border) 60%, var(--bg))` |
   | `--text` | `--app-text` |
   | `--text-muted` | `--app-text-muted` |
   | `--text-faint` | `color-mix(in oklab, var(--text-muted) 70%, var(--bg))` |
   | `--accent` | `--app-accent` |
   | `--success` / `--warning` / `--error` | `--app-success` / `--app-warning` / `--app-error` |

   `--accent-contrast`: `#0a1020` en los tres oscuros (acento claro), `#ffffff` en `light`.
   Las derivadas (`--accent-dim`, `--success-dim`…) no se tocan: ya salen por `color-mix`.
   `--term-bg` y `--term-green` quedan como están.
   Temas del prototipo → los nuestros: `orchestos` = `:root`, `graphite`, `carbon`, `light`.

2. **Temas renombrados** — `theme.js:9` pasa a `['orchestos', 'graphite', 'carbon', 'light']`.
   En `getTheme()`, migrar lo guardado: `dark2026` → `graphite`, `claude` → `carbon`,
   `bright` → `light`, y reescribir `localStorage`. Renombrar los selectores
   `html[data-theme="…"]` en `styles.css`, los `.theme-swatch[data-swatch="…"]` en `screens.css`
   (`~1247-1270`, con los colores nuevos de cada tema), el mapa de `screens-ops.js:1841` y las
   claves `settings.theme.*` en `i18n.js` (en y es): OrchestOS, Graphite, Carbon, Light / Claro.
   `Sidebar.tsx:111` compara con `'bright'`: pasa a `'light'`. Buscar cualquier otro uso con
   `grep -rn "bright\|dark2026" src` (el `'claude'` de agentes/CLI **no** es el tema: no tocarlo).
   Default: `orchestos`.

3. **Fuentes** — sans `Plus Jakarta Sans`, mono `Fira Code`, **empaquetadas localmente** (el
   dashboard corre local y no debe depender de Google Fonts): agregar
   `@fontsource-variable/plus-jakarta-sans` y `@fontsource/fira-code` (400, 500, 600), importarlas
   en el bundle de islas, y `--sans` / `--mono` (`styles.css:74-75`) con esas familias primero y los
   fallbacks actuales detrás. Verificar que los `.woff2` llegan al `dist/` que sirve el dashboard.

4. **Radios** — `--radius: 6px`, `--radius-lg: 10px` (prototipo: controles 6, tarjetas 10,
   píldoras 9999). `--radius-pill` y `--radius-circle` iguales. Buscar radios literales en px en
   `styles.css`, `screens.css`, `ui.css` y los `.tsx` (`grep -rnE "border-radius: *[0-9]+px|rounded-\[[0-9]+px\]"`)
   y pasarlos al token que corresponda.

5. **Escala tipográfica** — 4 tamaños del prototipo: 11 (meta, badges), 12 (controles, labels),
   14 (cuerpo, chat, inputs), 20 (títulos de pantalla). `--fs-1: 11px`, `--fs-2: 12px`,
   `--fs-3: 14px`, `--fs-4: 14px`, `--fs-5: 20px`. Dejar las 5 variables (hay usos de las cinco);
   la jerarquía que se pierde entre 3 y 4 la da el peso de la fuente, como en el prototipo.
   Buscar `font-size` literales en px y pasarlos al token más cercano.

6. **Gate `ui81`** (`scripts/ui-gates/ui81-visual-consistency.mjs`): la lista blanca de radios pasa
   a `0px, 6px, 10px, 50%, 999px, 9999px`. El máximo de 5 tamaños de fuente se mantiene.

## Verificación (la corre el cerebro)

- `bunx tsc --noEmit`, `bun run test:coverage` verde, build de las islas.
- Dashboard real reiniciado; `ui81`, `ui2-design-system`, `ui0`, `ui4-specs`, `ui10` verdes. Los que
  afirmen valores viejos (4px/8px, 13/15/19px, nombres de tema) se actualizan en el mismo diff,
  listados en el reporte con el motivo.
- En el navegador: `getComputedStyle(document.body).fontFamily` empieza con Plus Jakarta Sans y no
  hay requests a `fonts.googleapis.com`.
- Capturas de Chat, Settings → General (los 4 swatches) y una pantalla vanilla (Settings → Usage)
  en los 4 temas, en un directorio temporal; las revisa el cerebro contra el prototipo.
- Un `localStorage` con `orchestos-theme = claude` abre en `carbon` y queda reescrito.

## Fuera de esta pasada

Cualquier cambio de layout o de estructura (shell, sidebar, Settings, chat): son `UI.12.2` en
adelante. El uso de los CLI (`SessionStatusBar`) no cambia más allá de lo que cambien los tokens.
