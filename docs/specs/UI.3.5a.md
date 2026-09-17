# UI.3.5a — El gate invertido que mide de verdad, y el barrido de radios

Primera pasada concreta de `UI.3.5` (abierto 2026-08-30, `PLAN.md:1464`). No re-abre el diseño
visual: ejecuta el pendiente ya escrito ahí (*"barrido de `font-size`/`border-radius` en el resto
de `styles.css`/`screens.css`"*) y arregla el instrumento que debía hacerlo cumplir.

## Dos hallazgos medidos el 2026-09-17 que definen este ítem

**Hallazgo 1 — el gate navega a una URL que no existe.** `ui81-visual-consistency.mjs:33` hace
`page.goto(BASE + "/?screen=" + SCREEN)`, pero **`app.js` no lee `URLSearchParams` en ningún
lado** (`grep -n "searchParams\|URLSearchParams" src/dashboard/public/app.js` → 0 resultados).
El parámetro se ignora en silencio y el gate mide **siempre la pantalla de arranque**. Evidencia:
corrido sobre las 13 pantallas (`chat activity settings tasks runs workspace specs skills memory
instincts graph plan project`) devuelve **exactamente los mismos números en las 13**:
`font-size: 4 (11px, 12px, 13px, 19px)` · `border-radius: 6 (0px, 4px, 50%, 6px, 8px, 999px)`.
Es la Regla Cero de `CLAUDE.md` otra vez: el gate que `UI.3.5` pedía existe, pero no hace lo que
dice que hace.

**Hallazgo 2 — el umbral del gate contradice el diseño que debe hacer cumplir.** El gate exige
`radii.length <= 2` (`ui81-visual-consistency.mjs:66`). `UI.3.5` declara 4px (controles) + 8px
(contenedores) + 999px (solo el pill, ya excluido vía `#statusBadge`). Pero el gate mide
`getComputedStyle().borderRadius` de **todo nodo visible**, y todo elemento sin radio reporta
`0px`. O sea: el diseño declarado produce como mínimo `{0px, 4px, 8px}` = 3 valores.
**El gate es matemáticamente imposible de pasar sin violar su propia especificación.** Por eso
lleva meses en rojo sin que nadie pueda cerrarlo.

Estado actual en CSS (`grep -rho "border-radius:[^;]*"`, 55 usos crudos vs 51 por token):

| Valor | Usos | Veredicto |
| --- | --- | --- |
| `var(--radius)` 4px · `var(--radius-lg)` 8px · `var(--radius-pill)` | 53 | correcto, es el destino |
| `6px` | 13 | **deuda** → `var(--radius-lg)` si es contenedor, `var(--radius)` si es control |
| `50%` | 13 | legítimo (avatares/glifos circulares) → necesita token propio |
| `999px` | 10 | correcto pero crudo → `var(--radius-pill)` |
| `4px` · `8px` crudos | 9 | correcto pero crudo → su token |
| `7px` · `20px` · `12px` · `5px` · `2px` · `3px 3px 0 0` · `0 3px 3px 0` | 14 | **deuda, sin excepción declarada** |

## Contrato — sin decisiones para el ejecutor

1. **El gate navega de verdad.** Cambiar `ui81-visual-consistency.mjs` para que llegue a la
   pantalla pedida por el **camino real de la app**, no por un query param inventado: usar
   `page.evaluate(() => { window.state.screen = "<id>"; window.App.rerender() })` y esperar a que
   `#main` repinte (el mismo puente que ya usan `ui3-shell.mjs` y el gate de UI.1;
   `window.state` y `window.App` se exponen a propósito en `app.js:3335,3347`). **Verificar que
   cambió de pantalla** antes de medir — leer `window.state.screen` y abortar con FAIL si no
   coincide con la pedida. Un gate que no puede probar dónde está no mide nada.
2. **Umbral por lista blanca, no por conteo.** Reemplazar `radii.length <= 2` por una lista
   blanca explícita de valores permitidos: `0px`, `var(--radius)` (4px), `var(--radius-lg)` (8px),
   `var(--radius-pill)` (999px, ya exceptuada vía `#statusBadge`) y `50%` (circular). El gate
   **falla ante cualquier valor fuera de esa lista** y lo nombra en el mensaje.
   Esto es **más estricto**, no más laxo: hoy `{6px, 7px}` pasaría (son 2) y `{0px, 4px, 8px}`
   —el diseño correcto— falla. Con la lista blanca, `6px`/`7px`/`12px`/`20px`/`5px`/`2px` fallan
   siempre y el diseño declarado pasa. Dejar esa justificación como comentario en el script,
   citando este spec.
3. **Token para el círculo.** Agregar `--radius-circle: 50%` junto a los radios existentes en
   `styles.css` y migrar los 13 usos crudos de `50%`. No inventar otros tokens nuevos.
4. **Barrido de la deuda.** Migrar a token: los 13 `6px`, los 10 `999px`, los 9 `4px`/`8px`
   crudos, y resolver uno por uno los 14 restantes (`7px`, `20px`, `12px`, `5px`, `2px` y los dos
   radios asimétricos `3px 3px 0 0` / `0 3px 3px 0`). Criterio fijo, sin margen de
   interpretación: **control** (botón, input, chip, ícono interactivo) → `var(--radius)`;
   **contenedor** (card, panel, modal, dropdown, popover) → `var(--radius-lg)`; **circular**
   (avatar, punto de estado, badge redondo) → `var(--radius-circle)`; **pill** → `var(--radius-pill)`.
   Los dos asimétricos existen para pegar dos elementos: conservar la asimetría pero
   expresándola con el token (`var(--radius) var(--radius) 0 0`), no con el número crudo.
   **Hacerlo por tandas verificables** (una tanda = un archivo o una sección), como el propio
   `PLAN.md:1536` exige: *"no en un sólo sed masivo"*.
5. **No tocar tamaños de fuente.** Ya pasan el gate (4 computados: 11/12/13/19). Fuera de alcance.

## Fuera de alcance

- Las 9 pantallas sin migrar de `UI.4` y cualquier cambio de paleta o de los 4 temas.
- El baseline de `style=` inline: hoy pasa (5, baseline 5). No moverlo.
- `.card` como contenedor (33 usos) — es otra pasada de `UI.3.5`, no esta.
- Las observaciones de Carlos del 2026-09-16 sobre proyectos, cuotas e iconografía
  (`PLAN.md:1885-1888`): tienen su propio spec pendiente.
- El umbral del hook de contexto (`IDEAS.md#63`) y cualquier otra cosa fuera de CSS + ese gate.

## Archivos de referencia

- `scripts/ui-gates/ui81-visual-consistency.mjs:17,33,60-70` — navegación falsa y umbral.
- `src/dashboard/public/styles.css` — tokens de radio y 6px/50%/999px.
- `src/dashboard/public/screens.css` — el grueso de los crudos.
- `src/dashboard/public/app.js:3335,3347` — `window.state` / `window.App`, el puente que ya existe.

Si la implementación contradice este contrato o exige archivos fuera de esta lista, **detenerse y
reportarlo**; no ampliar el alcance.

## Verificación y evidencia

1. `bunx tsc --noEmit`, `bun run build:ui`, `bun run test:coverage` completos.
2. `bunx biome check` sobre los archivos tocados. **Nota:** el repo ya tiene 2 errores y 38
   warnings preexistentes en `app.js`/`screens-core.js`, idénticos en `master` (verificado con
   `git stash` el 2026-09-17). No son de este ítem; no arreglarlos ni dejar que bloqueen.
3. **Gate en vivo, dashboard real + Playwright, sobre las 13 pantallas**: `chat activity settings
   tasks runs workspace specs skills memory instincts graph plan project`. Cada una debe reportar
   la pantalla efectivamente alcanzada y pasar font-size, radios (lista blanca) y `style=` inline.
   Si alguna pantalla no se puede alcanzar por el puente, **decirlo explícito en la evidencia** en
   vez de omitirla del barrido.
4. Guardar mediciones por pantalla en `docs/done/evidence/UI.3.5a-live.json`, incluyendo el
   antes/después de los valores de radio. **Bajar el dashboard al terminar.**
5. Revisión visual honesta: si el barrido cambia cómo se ve algo (un botón que era 6px ahora es
   4px), decirlo en la evidencia. El objetivo es consistencia, pero un cambio visible no se
   reporta como "sin cambios".

Al cerrar: `[x]` en `PLAN.md` bajo `UI.3.5` con fecha, evidencia en `docs/done/sprint-30.md` +
`docs/done/evidence/`, `Ejecutado por: luna`, y **borrar este spec en el commit de cierre**
(`AGENTS.md` § ciclo de vida de specs). `UI.3.5` padre **sigue abierto**: quedan `.card`, los
componentes de `UI.2` y el shell.
