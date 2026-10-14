# UI.24.1 ronda 4 — escalera de superficies con valores literales

Los cambios sin commitear del front (`src/dashboard/app/**`, `scripts/ui-gate/**`, `biome.json`, `package.json`,
`bun.lock`, `THIRD_PARTY_NOTICES.md`) son de las rondas 1 a 3 de **este mismo ítem**: se edita encima. Ajenos:
`IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`.

Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue). No commitear, no
`git stash`, no `prettier`, no tocar `PLAN.md`/`NEXT.md`, no correr `bun run test:coverage`.

## Causa (medida con una sonda en el navegador sobre el build)
1. `--surface-6` llega al navegador como `var(--app-bg)`: el build (`bun-plugin-tailwind`, `scripts/build-app.ts:14-24`)
   rebaja `color-mix()` dentro de propiedades personalizadas a un valor de respaldo y en `dist/main.css` solo queda
   `--surface-6:var(--app-bg)`. La escalera entera es plana.
2. El gate compara la burbuja contra `document.body`, cuyo fondo no es el de la lámina (es un color fijo de la app
   que no cambia con el tema).

## Cambios

### `src/dashboard/app/src/index.css`, puente de tokens
Sustituir cada `color-mix(...)` de `--surface-2…8` por el valor literal, un bloque por tema (los temas oscuros ya
no comparten bloque para estas siete variables). `--surface-1` sigue siendo `var(--app-bg)`.

| tema | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| `orchestos` (y `:root`) | `#10141c` | `#191c24` | `#21242c` | `#292c34` | `#31353b` | `#3a3d43` | `#42454b` |
| `graphite` | `#17191d` | `#1f2125` | `#27292d` | `#2f3134` | `#37393c` | `#3f4144` | `#47494c` |
| `carbon` | `#111113` | `#1a1a1c` | `#222224` | `#2b2b2c` | `#333335` | `#3c3c3d` | `#444446` |
| `light` | `#f2f4f7` | `#eceff1` | `#e7e9ec` | `#e1e3e7` | `#dbdee2` | `#d5d8dc` | `#cfd2d7` |

`--accent`: `var(--surface-6)` en los tres temas oscuros y `var(--surface-7)` en `light`.

Revisar el resto del bloque del puente: cualquier otra propiedad personalizada cuyo valor use `color-mix()` se
sustituye también por un literal equivalente o por una referencia directa a otra variable. No tocar las reglas
`.border-app/NN` existentes (`index.css:31-45`), que no son propiedades personalizadas.

### `scripts/ui-gate/flows/thread-states.mjs`
- La claridad de la burbuja se compara contra el fondo **efectivo** detrás de ella: subir por los ancestros desde la
  burbuja hasta el primero con `backgroundColor` no transparente (alfa > 0) y usar ese color. No usar `body`.
- Paso nuevo por tema `<tema>-surface-ladder`: leer del `<html>` el valor calculado de `--surface-1`…`--surface-8`
  (pintando cada uno en el canvas de 1×1 ya existente) y exigir que `L*` sea estrictamente monótona: creciente en
  los temas oscuros, decreciente en `light`.
- El umbral de la burbuja sigue en `≥ 6`.

## Verificación
1. `bunx tsc --noEmit -p src/dashboard/app/tsconfig.json`
2. `bun run lint`
3. `bun run build:app` y `grep -o -E "\-\-surface-6:[^;}]*" src/dashboard/app/dist/main.css | sort | uniq -c`:
   deben salir los cuatro literales y ningún `var(--app-bg)`.
4. `bun run ui:gate thread-states` — pegar las cuatro diferencias de `L*` de la burbuja.
5. Contraprueba: poner temporalmente `--accent: var(--surface-2)` en `orchestos`, correr el gate, comprobar que
   falla `orchestos-user-bubble-clarity`, y restaurar. Reportar la línea del fallo.
6. `bun run ui:gate smoke text-sweep composer-picker`
