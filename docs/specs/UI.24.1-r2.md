# UI.24.1 ronda 2 — correcciones sobre la base ya aplicada

Los cambios sin commitear del front (`src/dashboard/app/**`, `scripts/ui-gate/**`, `biome.json`, `package.json`,
`bun.lock`) son de la ronda 1 de **este mismo ítem**: se editan encima, no son ajenos. Ajenos y sin tocar:
`IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`.

Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue). No commitear, no
`git stash`, no `prettier`, no tocar `PLAN.md`/`NEXT.md`. No correr `bun run test:coverage` ni detenerte por el
baseline. `bun test src/dashboard/handlers/tasks.test.ts` da 1 fallo (409 de ERP.4.13) con la identidad git global
del Mac: es del entorno, ignorarlo.

## 1. Escalera de superficies visible (`src/dashboard/app/src/index.css`, bloque del puente de tokens)
Hoy `--surface-N` sube 2 % por nivel y la burbuja del usuario y la `Card` no se distinguen del fondo.
- Temas oscuros (`orchestos`, `graphite`, `carbon`): `--surface-2…8` = `color-mix(in srgb, var(--app-bg),
  var(--app-text) P%)` con P = 3.5, 7, 10.5, 14, 17.5, 21, 24.5. `--surface-1` sigue siendo `var(--app-bg)`.
- Tema `light`: P = 2.5, 5, 7.5, 10, 12.5, 15, 17.5.
- `--accent: var(--surface-4)` (burbuja del usuario), `--card: var(--surface-2)`, `--muted: var(--surface-3)`.
- Nada más del bloque cambia. Ningún token `--app-*` cambia.

## 2. Fuera `pdfjs-dist`
`src/dashboard/app/src/components/ui/file-thumbnail.tsx` importa `pdfjs-dist` de forma dinámica y Bun lo mete en
`main.js`. Quitar la carga de pdfjs y la rama que dibuja la primera página: un PDF (y cualquier archivo que no sea
imagen) se muestra como una ficha del mismo tamaño y radio que la miniatura, fondo `bg-surface-3`, con el icono
`FileText` de `lucide-react` centrado en `text-muted-foreground` y la extensión en mayúsculas debajo en
`text-micro`. Quitar `pdfjs-dist` de `package.json` y `bun.lock` (`bun remove pdfjs-dist`). Es una edición a un
archivo de terceros: va en el reporte.

## 3. Atribución
Crear `THIRD_PARTY_NOTICES.md` en la raíz con: Fluid Functionalism, `https://github.com/mickadesign/fluid-functionalism`,
licencia MIT, el texto de la licencia copiado del archivo `LICENSE` de ese repo, y la lista de carpetas donde vive
su código aquí (`src/dashboard/app/src/components/ui`, `.../lib`, los 2 hooks).

## 4. Lámina (`src/dashboard/app/src/components/thread/ThreadStatesSheet.tsx`)
- Todo el texto visible en **inglés**, como el resto del producto ("New chat", "Approve & Run"): rótulos, mensajes
  de ejemplo, botones, insignias, avisos, placeholder. Mismos `data-testid`.
- Añadir un bloque `state-message-pdf`: `ChatMessage from="user"` con un `File` PDF en memoria
  (`new File([...], 'spec.pdf', { type: 'application/pdf' })`) y una frase.

## 5. Gate (`scripts/ui-gate/flows/thread-states.mjs`)
- Capturas a página completa para los cuatro temas: `thread-states-orchestos`, `-graphite`, `-carbon`, `-light`.
- Paso nuevo por tema: leer `getComputedStyle` del fondo de la burbuja del usuario (dentro de `state-message-user`)
  y del fondo de `body`, calcular el contraste de luminancia WCAG entre ambos y exigir ≥ 1.15. Lo mismo para el
  fondo de la `Card` de `state-card` con umbral ≥ 1.04.
- Paso nuevo: `state-message-pdf` visible y ninguna petición de red a un worker de pdf.

## Verificación
1. `bunx tsc --noEmit` y `bunx tsc --noEmit -p src/dashboard/app/tsconfig.json`
2. `bun run lint`
3. `bun run build:app` — reportar el tamaño de `src/dashboard/app/dist/main.js` (antes de esta ronda: 2 030 831 B)
4. `bun run ui:fidelity:jsx`
5. `bun run ui:gate thread-states`
6. `bun run ui:gate smoke text-sweep composer-picker`

## Reporte
Archivos tocados, tamaño de `main.js`, salida de cada gate, lo que no pudiste verificar.
