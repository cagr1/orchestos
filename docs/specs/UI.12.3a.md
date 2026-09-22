# UI.12.3a — Navegación de Settings como isla React, copiada del prototipo

Prerrequisito: `UI.12.2b` cerrado (vocabulario `app-*` en `ui.css`). Prototipo:
`P = ~/Documents/screens/orchestos-ai-agent-dashboard/src/components/settings/OrchestSettingsView.tsx`.

## Qué cambia

Hoy la barra de Settings es vanilla: `src/dashboard/public/screens-ops.js:1921-1948` (`<nav
class="settings-nav">` con 5 grupos) y sus handlers en `screens-ops.js:2019-2050`. Pasa a una isla
React `settings-nav` que copia el `<aside>` del prototipo `P:399-606`, **con los className tal cual**
(anchos, `bg-app-surface/50`, labels `text-[10px] font-bold uppercase tracking-wider`, ítems
`px-2.5 py-1.5 rounded-control transition-colors`, estado activo, ícono de color por ítem
`text-sky-400`/`text-emerald-400`/`text-amber-400`/…, punto de salud, código de idioma, `+` en
Projects, botón "Back to app" con la flecha que se mueve en hover, buscador).

## Reglas

- **Grupos e ítems: los del producto**, no los del prototipo (`screens-ops.js:1922-1947`: workspace →
  general, health; configure → keys, routing, executor; observe → usage; protect → project, lang;
  projects → un ítem por proyecto). Del prototipo se toma el look de cada ítem; si el producto no
  tiene el ítem, no se agrega.
- **Íconos:** los SVG que ya expone el vanilla (`ICON.*` vía la superficie del shell,
  `src/dashboard/public-src/islands/shell/shell-api.ts`); el color va en el wrapper con la clase
  del prototipo. No agregar `lucide-react` ni otra dependencia.
- **Acciones sin duplicar lógica** (mismo criterio que `shell-api.ts:1-10`): mover el cuerpo de los
  dos handlers de `screens-ops.js:2019-2050` a funciones del vanilla (p. ej.
  `selectSettingsSection(sec)` y la que abre la página del proyecto) expuestas en la superficie
  del shell; la isla solo las llama. `selectSettingsSection` sigue sin rerender completo
  (preserva las keys sin guardar). La isla marca el activo con su propio estado, inicializado
  desde `state.settingsSection`.
- **Back to app** → la misma acción que el modo Chat del segmentado (`setShellMode('chat')`).
  **Buscador**: filtra los ítems de la barra por su label traducido; sin resultados, grupo oculto.
  **`+` de Projects**: la misma acción que el `+` de agregar proyecto del sidebar.
- Textos por `i18n.js` (en/es), con las claves existentes; las nuevas (back, buscador) en los dos
  locales y dentro del presupuesto de `ui-copy-budget.json`.
- La clase `settings-nav` queda en el `<aside>` como gancho de `scripts/ui-gates/ui10-project-settings.mjs`.
- Borrar de `src/dashboard/public/screens.css` las reglas `.settings-nav*` y `.settings-projects-*`
  que quedan sin uso (incluidas las de `@media`, `screens.css:1361-1395` aprox.). No sumar CSS a
  `styles.css`/`screens.css` (el pre-commit lo bloquea).

## No tocar

Los paneles (`settings-panels` y lo que hay adentro), la página del proyecto, `PLAN.md`, los gates.
Si un gate falla por una medida que el prototipo hace distinta, parar y reportar. No commitear.

## Verificación (el ejecutor)

- `bun run build:ui`, `bunx tsc --noEmit`, `bun run scripts/check-ui-copy.ts` limpios.
- `wc -l` de `screens.css` baja; reportar el número.
- Con el dashboard en :4330: `GATE_BASE=http://localhost:4330 node scripts/ui-gates/ui10-project-settings.mjs`
  verde; a mano: cada ítem cambia de panel sin perder una key escrita sin guardar, el ítem de
  proyecto abre su página, el buscador filtra y Back vuelve a Chat. Bajar el dashboard al terminar.
