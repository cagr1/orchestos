# UI.13.7 — La barra de cuota avisa por color (Lote L4)

Pedido de Carlos: barra **y** número en naranja al pasar el 60 % consumido; en rojo al pasar el 80 %.
Las barras muestran lo **restante** (`mapQuotas`, `ShellStatusBar.tsx:28`).

## Cambios

1. **`src/dashboard/app/src/components/layout/ShellStatusBar.tsx`** — función pura exportada
   `quotaTone(remaining: number | null): 'normal' | 'warning' | 'error'`: `null` → `normal`; `< 20` → `error`;
   `< 40` → `warning`; si no, `normal` (40 exacto y 20 exacto = el tramo superior).
2. Aplicarla, sin tocar el resto del className, a:
   - fila del footer (barra `bg-app-accent` y número `text-app-muted` del `pct`);
   - popover 5 h (barra `bg-app-accent` y número `font-semibold text-app`);
   - popover semanal (barra `bg-app-accent/60` y número `font-semibold text-app`).
   `warning` → barra `bg-app-warning`, número `text-app-warning`; `error` → `bg-app-error` / `text-app-error`;
   `normal` → las clases actuales exactas. Tokens ya definidos en `index.css:13-14`: **nada de CSS ni colores
   nuevos**, nada de `style={{color}}`.
3. Añadir `data-quota-tone={tone}` a cada barra y cada número coloreados (lo usa el gate).
4. **Test** en `ShellStatusBar.test.ts`: `quotaTone` con null, 100, 41, 40, 39, 21, 20, 19, 0.
5. `bun run ui:fidelity:jsx` compara el className contra la plantilla. Si falla por los tokens nuevos, añadir
   entradas en `scripts/ui-fidelity/jsx-allow.json` con el patrón existente y razón
   `Carlos 2026-09-24 UI.13.7: la cuota avisa por color`. No añadir más que las necesarias.

## Gate — flujo `scripts/ui-gate/flows/usage-bar.mjs`
Sin turno real extra. Tras el paso `manual usage refresh keeps the newest Claude quota` y **antes** del chat,
reescribir el statusline de Claude (mismo patrón `writeStatusline`, sesión nueva y más reciente cada vez), pulsar
`Refresh usage`, esperar la respuesta de `/api/session/status` y afirmar sobre el botón `button[title^="Claude"]`:
- used 50 → barra y número del footer `data-quota-tone="normal"`;
- used 70 → `warning`, y la barra tiene clase `bg-app-warning`;
- used 90 → `error`, y la barra tiene clase `bg-app-error`;
- con used 90, abrir el popover (clic en el botón) → la barra y el número del 5-hour quota con `error`; cerrarlo
  con Escape.
Después, dejar el statusline como estaba antes de estos pasos (used 39) para que el resto del flujo no cambie.

## Verificación (obligatoria antes de reportar)
`bunx tsc --noEmit`, `bun run lint`, `bun test` **completo**, `bun run ui:fidelity:jsx`,
`node --check scripts/ui-gate/flows/usage-bar.mjs`. Reporta la salida real. No commitees.
No invoques `codex exec` ni delegues a otro agente.

## Fuera de esta pasada
Colores en otras vistas; umbrales configurables; el semanal en la fila del footer.
