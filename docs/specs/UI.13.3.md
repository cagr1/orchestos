# UI.13.3 — Borrar el vanilla, `/legacy`, sus islas, CSS y ui-gates de píxel (Lote L2, ítem 3)

La app React (`src/dashboard/app/`, servida en `/`) es el frontend. El vanilla solo quedaba como referencia hasta
este ítem. Carlos 2026-09-23: se borra; es recuperable por git. Nada del producto debe dejar de funcionar.

## Qué se borra
1. `src/dashboard/public/` entero salvo lo que la app React use de verdad (verificar con grep y en el navegador:
   hoy `app/index.html` no referencia nada de `public/`; las fuentes vienen de `@fontsource` en `main.tsx`). Si algo
   se usa (ej. favicon/logo), moverlo a `src/dashboard/app/` y servirlo desde ahí, no conservar `public/`.
2. `src/dashboard/public-src/` (islas React del vanilla) y `scripts/build-ui.ts`; `build:ui` pasa a ser solo
   `build:app` (o se elimina y quien lo llame usa `build:app`: grep en `package.json`, `scripts/*.sh`,
   `.github/workflows/*`, docs de arranque).
3. `src/dashboard/http.ts`: rama `/legacy` y el fallback final `serveFrom(STATIC_DIR, …)`; `STATIC_DIR` en
   `types.ts`. Una ruta con extensión que no sea `/app/dist/…` → 404.
4. `scripts/ui-gates/` (16 gates de píxel/markup del vanilla) y `scripts/check-css-ratchet.ts` si solo mide
   `styles.css`/`screens.css`. **No** se borran `scripts/ui-gate/` (flujos vivos de la app React) ni
   `scripts/ui-fidelity/`.
5. Tests que solo prueban el vanilla (`agent-icons`, `chat-held-restore`, `chat-ui-contract`, `ui135-round3` y los
   que grep encuentre leyendo `public/`): si el test cubre comportamiento del backend además del markup, conservar
   esa parte apuntando al backend; lo demás se borra. Listar cada test borrado y por qué en el reporte.
6. `scripts/check-ui-copy.ts` + `ui-copy-budget.json` + su paso en `scripts/pre-commit.sh:55` leen `public/i18n.js`:
   apuntarlos al copy de la app React si tiene sentido, o borrar el check y su paso del pre-commit (y reinstalar
   hooks con `bun run hooks:install` para que el self-check no aborte). Mismo tratamiento para las referencias en
   `scripts/agent-governance.ts`, `scope-lock.test.ts`, `check-live-gate.test.ts`, `src/__tests__/codex-engine.test.ts`.
7. Dependencias de `package.json` que solo usaba el vanilla/islas (verificar con grep antes de quitar cada una).

## Qué no se toca
`src/dashboard/app/**` salvo mover assets usados; handlers y API; `docs/done/**` (historia); PLAN.md/NEXT.md los
actualiza el cerebro.

## Gate (lo que el cerebro va a medir)
- `git grep -n "dashboard/public\b\|public-src\|/legacy\|STATIC_DIR"` fuera de `docs/` → vacío (o cada resto
  justificado en el reporte).
- `GET /legacy` → 404; `GET /` y rutas cliente cargan la app; `GET /styles.css` → 404.
- Pre-commit completo pasa (`bash scripts/pre-commit.sh` o un commit de prueba) con hooks reinstalados.
- Verde: `bun run gate:all` + `bun run ui:gate smoke` + `bun run ui:gate tasks` + `bun run ui:gate runs-graph` +
  `bun run ui:gate project-tabs` (los flujos de los ítems anteriores siguen pasando) + 0 errores de consola.
- Cobertura: `test:coverage` no baja de los umbrales de `scripts/check-coverage.ts`; si baja por quitar tests del
  vanilla, reportarlo con los números, no bajar los umbrales.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues a otro agente. No hagas commit. No toques `git config`. `bun run typecheck`
completo. No reportes "preexistente" sin la salida que lo demuestre. Al terminar: archivos borrados/movidos,
tests borrados con motivo y salida real del gate.
