# UI.9.6 — El puente no puede borrar estado con `undefined`

Cierra el hallazgo anotado en `PLAN.md` (2026-09-17) y observado en vivo como `consoleErrors` en
`docs/done/evidence/UI.9.5-live.json`: *"TypeError: Cannot read properties of undefined (reading
'filter')"* al arrancar en Dev y cambiar a Chat.

## Causa raíz (leída en el código, no inferida del síntoma)

`setShellState()` (`src/dashboard/public-src/lib/shell-store.ts:92-102`) tiene **dos mitades que no
siguen la misma regla**:

```ts
for (const key of Object.keys(patch) as (keyof ShellState)[]) {
  if (patch[key] !== undefined && patch[key] !== state[key]) {   // ← ignora undefined
    changed = true
    break
  }
}
if (!changed) return
state = { ...state, ...patch }                                    // ← NO lo ignora
```

La detección de cambio salta las claves `undefined` a propósito. El merge no: el spread **sí copia
`undefined` encima del valor bueno**. Basta con que *otra* clave del mismo patch haya cambiado para
que `changed` sea `true` y el spread pise todo el patch, `undefined` incluido.

El disparador concreto es `App.syncNav()` (`src/dashboard/public/app.js:879`):

```js
generalSessions: state.shellMode === 'chat' ? state.chatSessions : undefined,
```

Arrancando en Dev, cada `syncNav()` publica `generalSessions: undefined`. En cuanto cambia `screen`
o cualquier otra clave, el store pasa de `[]` a `undefined`. Al cambiar a Chat, `shellMode` cambia,
el `Sidebar` repinta y ejecuta `shell.generalSessions.filter(...)`
(`src/dashboard/public-src/islands/shell/Sidebar.tsx:189`) **antes** de que vuelva el fetch de
sesiones → `TypeError`.

Nótese que `ShellState.generalSessions` está declarado `SessionRow[]`, **no opcional**
(`shell-store.ts:28`). El tipo promete algo que el runtime viola: hoy el tipo miente.

## Contrato — sin decisiones para el ejecutor

1. **El merge respeta la misma regla que la detección.** En `setShellState()`, construir el nuevo
   estado ignorando las claves cuyo valor es `undefined`, en vez de `{ ...state, ...patch }`.
   Semántica resultante, que hay que dejar escrita en el comentario de la función: en este puente
   **`undefined` significa "no toques esta clave", nunca "borrá esta clave"**. Quien quiera vaciar
   un valor manda el vacío explícito (`[]`, `null`), que es lo que el tipo ya permite.
2. **Arreglar el mecanismo, no el síntoma.** **No** agregar `?? []` ni `?.` en `Sidebar.tsx:189`
   como arreglo principal: eso deja el mecanismo armado para la próxima clave que se sume al store
   ([[feedback-arreglar-los-hermanos-del-bug]]). Hoy `generalSessions` es el único array del store
   y `Sidebar.tsx:189` su único consumidor — verificado por grep, no asumido — pero el defecto es
   del puente, no del componente.
3. **`syncNav()` queda como está** (`app.js:879`). Con el punto 1, ese `undefined` pasa a
   significar exactamente lo que el autor quiso decir: "en modo Dev esta clave no aplica, no la
   toques". Agregar ahí un comentario de una línea que lo diga, citando la semántica del punto 1.
4. **Cobertura que falla antes del arreglo.** Test unitario sobre `setShellState` que reproduzca el
   patrón exacto: estado inicial con `generalSessions: []`, aplicar un patch con **otra** clave
   cambiada más `generalSessions: undefined`, y afirmar que el array sobrevive. Debe fallar contra
   el código actual — verificarlo corriéndolo antes del fix, y decirlo en la evidencia.

## Fuera de alcance

- Cualquier cambio de CSS. En particular **no** tocar `styles.css`/`screens.css`: `UI.5` los deja
  "reducidos a tokens" y ese trabajo se tira (decisión de Carlos, 2026-09-17).
- Rediseñar el puente vanilla→React, cambiar `syncNav()` más allá del comentario, o mover la carga
  de sesiones. El bug es de una función de 10 líneas; el arreglo también.
- Los fallos preexistentes de `font-size` y `style=` inline que el gate de `UI.3.5a` destapó.
- El flujo "Open in Workspace" de UI.9.2, que quedó sin observar por falta de datos en la base real.

## Archivos de referencia

- `src/dashboard/public-src/lib/shell-store.ts:28,60,92-102` — tipo, valor inicial y el merge.
- `src/dashboard/public/app.js:469,879` — los dos sitios que publican `generalSessions`.
- `src/dashboard/public-src/islands/shell/Sidebar.tsx:189` — el consumidor que hoy crashea.

Si la implementación contradice este contrato o exige archivos fuera de esta lista, **detenerse y
reportarlo**; no ampliar el alcance.

## Verificación y evidencia

1. `bunx tsc --noEmit`, `bun run build:ui`, `bun run test:coverage` completos.
2. El test nuevo del punto 4, **mostrando que falla antes y pasa después**.
3. **Gate en vivo con la reproducción exacta del hallazgo**, dashboard real + Playwright:
   arrancar en modo **Dev** (localStorage `orchestos-shell-mode=dev`), **recargar**, cambiar a
   **Chat**, y capturar `console` + `pageerror`. La corrida debe quedar con **cero** errores de
   consola; hoy aparece el `TypeError`. Repetir el cruce Dev→Chat→Dev al menos dos veces para
   descartar que el primer render lo esconda.
4. Correr `scripts/ui-gates/ui3-shell.mjs` completo (no debe romperse: su criterio 11 ya exige
   cero errores de consola, pero arranca directo en Dev y por eso no atrapaba este caso — decirlo
   en la evidencia).
5. Guardar en `docs/done/evidence/UI.9.6-live.json`: el error observado **antes** del fix y la
   corrida limpia **después**. Sin el "antes", la evidencia no prueba que el bug existía.
   **Bajar el dashboard al terminar.**

Al cerrar: `[x]` en `PLAN.md` con fecha, sección de evidencia en `docs/done/sprint-30.md` con el
ancla y la línea `Gate en vivo:` citando Playwright y el `.json` entre backticks (el gate de
procedencia lo exige), `Ejecutado por: luna`, y **borrar este spec en el commit de cierre**.
