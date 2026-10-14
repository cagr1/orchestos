# UI.26.6 — Resto de Settings con los primitivos de UI.25.1 y a todo el ancho

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Reglas de forma de UI.26 y UI.25 (PLAN.md). **PROHIBIDO `git stash`, `git checkout` y `git restore`**: la
contraprueba se hace con copia en `/tmp` + `git show HEAD:<ruta> > <ruta>`, restaurar la copia y confirmar con `cmp`.

## Objetivo

Las secciones de Settings que no son General ni Executor pasan a `SettingsPage` / `SettingsGroup` / `SettingsRow` /
`SettingsSegmented` / `SettingsStepper` / `SettingsPrimaryAction` (`components/settings/primitives.tsx`), como ya
están General (`OrchestSettingsView.tsx:962`) y Executor (`:1868`). Y todas las secciones ocupan el ancho disponible.
Solo presentación: ni handlers, ni estado, ni endpoints, ni textos visibles.

Archivo: `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx` (2760 líneas). Secciones (medido
2026-10-14, clases de paleta / `font-mono`):

| Sección | Líneas | Paleta | mono |
|---|---|---|---|
| Health | 1023–1153 | 2 | 0 |
| API & Models | 1154–1347 | 26 | 12 |
| Model routing | 1348–1867 | 1 | 6 |
| Usage | 1929–2140 | 34 | 10 |
| Danger zone | 2141–2173 | 5 | 0 |
| Language | 2174–~2240 | 0 | 2 |

## Reglas

1. **Ancho (observación de Carlos 2026-10-14):** Usage, Model routing y las demás secciones con `max-w-3xl`
   (`:1024,1155,1349,1930,2142,2175`) no ocupan el ancho disponible; deben llenarlo. Quitar `max-w-3xl` de esas raíces
   **y** de `SettingsPage` (`primitives.tsx:29`, `mx-auto … max-w-3xl` → ancho completo con el mismo `px-6 py-8`).
   Las rejillas internas se adaptan al ancho (ej. tarjetas de tema de General: `sm:grid-cols-2 xl:grid-cols-4`;
   tarjetas de Model routing: 2 columnas desde `lg`). Ninguna fila de texto se estira a más de lo legible: las
   descripciones largas llevan `max-w-prose`.
2. **Primitivos:** cada sección con `SettingsPage` (título + descripción existentes) y sus bloques como `SettingsGroup`
   con `SettingsRow` por ajuste. Selectores de 2–4 opciones → `SettingsSegmented`; números con +/- →
   `SettingsStepper`; acción principal → `Button` dentro de `SettingsPrimaryAction`. Si una pieza no encaja en un
   primitivo (tablas de Usage, tarjetas de rol de Model routing, lista de claves de API & Models), se queda como está
   pero con tokens.
3. **Cero clases de paleta** en las secciones tocadas (regex `PALETTE` de `scripts/ui-gate/flows/shell-look.mjs:8`),
   mismo mapeo que UI.26.4/26.5: textos → `text-app`/`text-app-muted`; fondos → nada o `bg-app-elevated`; bordes →
   línea tenue `border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]`. Color solo como estado por token
   (`app-success`/`app-error`/`app-warning`), en punto o texto; nunca fondos ni bordes tintados.
4. **`font-mono` solo** en claves, ids de modelo, rutas, comandos y cifras de tabla (con `tabular-nums`).
5. **Danger zone:** grupo con título en `text-app-error`, texto en `text-app-muted`, botón destructivo de la familia
   (mismo patrón que la Zona de peligro de proyecto de UI.26.4, `OrchestSettingsView.tsx:~2591`).

## No tocar

`components/ui/*`, `index.css` y los `--app-*`; General y Executor salvo lo que cambie por el ancho de
`SettingsPage`; la barra lateral de Settings (`:760-900`); la página de proyecto (`:2250` en adelante) salvo el
ancho; `ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*`. El movimiento de Arc UI (settings-command,
api-keys, activity-heatmap) **no** entra aquí: es UI.26.6b.

Selectores que leen los flujos y no pueden romperse (o se actualiza el flujo en el mismo cambio, diciéndolo):
- `model-routing.mjs:114` localiza las tarjetas de rol con
  `.rounded-card.border.border-app.bg-app-surface.space-y-2.relative`. Mejor: añadir `data-role-card` a la tarjeta y
  cambiar el flujo a `[data-role-card]`; las 4 tarjetas siguen siendo 4.
- Textos y nombres: "Model routing config", "Loading live settings…", "Unassigned" (×4), "Select model",
  "No models match", "Save", nombres de sección de la barra ("Model routing", …), y lo que lean `usage-bar`,
  `smoke`, `shell-look`, `project-delete`, `chat-roles`, `orchestration` (grep en `scripts/ui-gate/flows/` antes de
  cambiar un texto o un rol).

## Gate

Ampliar `scripts/ui-gate/flows/shell-look.mjs` (o el flujo de Settings que ya recorra las secciones; decirlo):
- `settings <sección> no palette` para Health, API & Models, Model routing, Usage, Danger zone, Language.
- `settings fills width`: en Usage y en Model routing, el ancho del contenedor de contenido de la sección es ≥ 90 % del
  ancho del panel principal (viewport del flujo).
Contraprueba: con `OrchestSettingsView.tsx` y `primitives.tsx` de HEAD (método de arriba), el flujo debe fallar en
`settings fills width` y en `settings usage no palette`; pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check <archivos tocados>
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate shell-look model-routing usage-bar smoke project-delete project-tabs chat-roles orchestration

Si un gate falla por Codex (`workspace routing discovery failed`, HTTP 502) y no por Settings, decirlo con la línea
del log y seguir; no es de este ítem.

Reportar: archivos tocados, qué piezas quedaron fuera de los primitivos y por qué, conteo final de paleta y
`font-mono` por sección, y cualquier regla que no se pudo cumplir tal cual.
