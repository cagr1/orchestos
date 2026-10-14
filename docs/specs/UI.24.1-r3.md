# UI.24.1 ronda 3 — la burbuja del usuario se ve y el gate lo mide de verdad

Los cambios sin commitear del front (`src/dashboard/app/**`, `scripts/ui-gate/**`, `biome.json`, `package.json`,
`bun.lock`, `THIRD_PARTY_NOTICES.md`) son de las rondas 1 y 2 de **este mismo ítem**: se edita encima. Ajenos:
`IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`.

Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue). No commitear, no
`git stash`, no `prettier`, no tocar `PLAN.md`/`NEXT.md`, no correr `bun run test:coverage`.

## Causa
`components/ui/chat-message.tsx:102` pinta la burbuja con `color-mix(in oklab, var(--accent), var(--background) 45%)`:
solo queda el 55 % del acento. Con `--accent: var(--surface-4)` la burbuja no se distingue a la vista en ningún
tema, y aun así el gate pasó: el contraste de luminancia WCAG da ≥ 1.15 sobre fondos casi negros con diferencias
invisibles. La métrica estaba mal elegida.

## Cambios
1. `src/dashboard/app/src/index.css`, puente de tokens: `--accent: var(--surface-6)` en los cuatro temas. Nada más.
   No se edita `chat-message.tsx`.
2. `scripts/ui-gate/flows/thread-states.mjs`:
   - Sustituir la medida WCAG por la diferencia de claridad CIELAB: convertir ambos colores sRGB a `L*` (D65) y
     exigir `|L*burbuja − L*fondo| ≥ 6` en los cuatro temas. El detalle del paso informa ambos `L*` y la diferencia.
   - El color de la burbuja se lee de `getComputedStyle(...).backgroundColor`; si el navegador lo devuelve como
     `oklab(...)`/`color(...)` en vez de `rgb(...)`, normalizarlo pintándolo en un canvas de 1×1 y leyendo el píxel
     (`getImageData`), no con una expresión regular sobre el texto.
   - Quitar el paso de contraste de la `Card` (su contenedor se diseña en UI.24.5).

## Verificación
1. `bunx tsc --noEmit -p src/dashboard/app/tsconfig.json`
2. `bun run lint`
3. `bun run ui:gate thread-states` — pegar en el reporte los cuatro valores de diferencia de `L*`.
4. Contraprueba: poner temporalmente `--accent: var(--surface-2)`, correr el gate, comprobar que **falla** el paso
   de la burbuja, y restaurar `--surface-6`. Reportar la salida del fallo.
