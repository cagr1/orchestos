# UI.13.1 — Andamio: el prototipo servido en `/` como la app del producto

Decisión de Carlos (PLAN.md § UI.13): el prototipo de AI Studio **es** el frontend. Se copia tal
cual; el vanilla solo se conserva, sin tocarlo, en `/legacy` hasta UI.13.3.

`P = ~/Documents/screens/orchestos-ai-agent-dashboard`

## 1. Copiar, sin reescribir

- `P/src/` completo → `src/dashboard/app/src/` (App.tsx, main.tsx, index.css, components/, data/,
  types/). **No cambiar className, estructura ni animaciones.** Solo lo mínimo para compilar:
  - imports con alias `@/` → resolverlos (tsconfig `paths` o ruta relativa);
  - `P/src/data/orcaProjectData.ts` usa `process.env`: reemplazar esa lectura por un valor fijo;
  - nada de `@google/genai`, `express`, `vite`, `dotenv` (no entran al producto).
- `P/index.html` → `src/dashboard/app/index.html`, quitando los `<link>` a Google Fonts y apuntando
  el script/CSS al bundle (ver 2). Las fuentes salen de `@fontsource-variable/plus-jakarta-sans` y
  `@fontsource/fira-code`, ya en `package.json` (igual que UI.12.1): 0 requests a Google.
- Dependencias nuevas en `package.json`: `lucide-react`, `motion`, `react-markdown`, `remark-gfm`
  con las versiones de `P/package.json`. `react`/`react-dom` ya están.

## 2. Build

`scripts/build-app.ts`, mismo idioma que `scripts/build-ui.ts` (Bun.build + `bun-plugin-tailwind`):
entrada `src/dashboard/app/src/main.tsx`, salida `src/dashboard/app/dist/`. Script `build:app` en
`package.json`; que `build:ui` o el arranque del dashboard lo invoque igual que hoy invoca el de
islas (mirar cómo se dispara `build:ui`). `src/dashboard/app/dist/` en `.gitignore` si
`public/dist/` lo está.

## 3. Servir

`src/dashboard/server.ts` (catch-all `serveStatic` en `:451`, helper en `src/dashboard/http.ts`):
- `GET /` y cualquier ruta no-API sin extensión → `src/dashboard/app/index.html`; assets del bundle
  desde `src/dashboard/app/dist/`.
- `GET /legacy` → el `index.html` vanilla actual, y sus assets siguen resolviendo (las rutas
  relativas `dist/`, `styles.css`, `*.js` del vanilla deben seguir funcionando bajo `/legacy/`).
- `/api/*` intacto. No mover la verificación de origen/CSRF.

## No tocar

`src/dashboard/public/**` (el vanilla), `src/dashboard/public-src/**` (islas), `PLAN.md`, los
ui-gates. Los datos siguen siendo los mocks del prototipo: conectarlos es UI.13.2. No commitear.

## Verificación (el ejecutor)

- `bun install`, `bun run build:app`, `bunx tsc --noEmit`, `bun run test:coverage` verdes.
- Dashboard en :4330: `/` muestra la app del prototipo (Chat por defecto); `/legacy` muestra el
  dashboard viejo funcionando; en la consola de red, 0 requests a `fonts.googleapis.com` y 0 4xx.
- Captura de `/` (Chat, Dev, Settings) junto a la del prototipo con `cd P && bun run dev`
  (puerto 3000): deben verse iguales. Guardar las capturas en `/tmp/ui13.1/`. Bajar ambos
  servidores al terminar.
