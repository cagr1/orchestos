# UI.9.B — Los radios del kit React no siguieron a UI.3.5

**Abierto:** 2026-09-20 · **Origen:** el FAIL de `scripts/ui-gates/ui2-design-system.mjs`
encontrado al medir `CI.2` el 2026-09-18.

## El bug, verificado en el código

`UI.3.5` bajó la geometría del producto y lo dejó escrito en el propio CSS
(`src/dashboard/public/styles.css:45-46`): *"UI.3.5: todo lo demás baja a
`--radius`/`--radius-lg`"*. Los tokens quedaron en `--radius: 4px` y `--radius-lg: 8px`.

El kit React no acompañó en dos componentes, y cada uno repite un número en vez de consumir el
token:

1. **`components/ui/tabs.tsx:35` — `rounded-[20px]`.** El vanilla equivalente, `.filter-tab`
   (`screens.css:100`), usa `border-radius: var(--radius-lg)` → **8px**. Las pestañas React se ven
   con 20px en pantalla. Peor: el comentario de la línea 34 afirma *"Espeja `.filter-tab`: 5px/13px,
   radio 20px"* — documenta como correcto el número que quedó viejo.
2. **`components/ui/dialog.tsx:30` — `rounded-[12px]`.** El `.modal` vanilla
   (`screens.css:1879`) usa `border-radius: var(--radius-lg)` → **8px**. Y 12px no es ningún token
   del sistema: no es `--radius` (4) ni `--radius-lg` (8).

**Corrección del 2026-09-20, encontrada por Luna al ejecutar — este spec decía mal esto, y el error
importa.** Acá se afirmó que el gate "compara solo el `width` del Dialog, nunca el radio". Falso:
`ui2-design-system.mjs:206` **sí** compara el radio, pero contra el literal `'12px'` escrito a mano,
y el mensaje que imprime —*"Dialog: radio 12px como el vanilla"*— afirma algo que el gate nunca
mide: jamás computa el `.modal`. El número salió copiado del componente que debía auditar (`49f5d3f`,
`UI.2`), así que el bug de `dialog.tsx` no es que el gate no lo viera: **el gate lo bendecía en
verde**. Al corregir el componente a 8px, el assert stale se pone rojo — el gate defiende el bug.

Es el caso más puro del patrón que `CI.2` persigue, y peor que los tres que ya tenía anotados: no es
un gate que se saltea la UI, ni uno que nadie volvió a correr, es un gate que **cristalizó el valor
equivocado como verdad de referencia**. Corregirlo entra en este ítem: un fix que deja el gate rojo
no está terminado.

`button.tsx:14` e `input.tsx:15` ya lo hacen bien (`rounded-[var(--radius)]`): ese es el patrón a
copiar, no inventar otro.

## Qué cambiar

- `src/dashboard/public-src/components/ui/tabs.tsx:35` — `rounded-[20px]` →
  `rounded-[var(--radius-lg)]`. Corregir el comentario de la línea 34: ya no es "radio 20px", es el
  token `--radius-lg`.
- `src/dashboard/public-src/components/ui/dialog.tsx:30` — `rounded-[12px]` →
  `rounded-[var(--radius-lg)]`.
- `scripts/ui-gates/ui2-design-system.mjs:206` — el assert deja de comparar contra el literal
  `'12px'` y pasa a medir el `.modal` vanilla de verdad, con la técnica que el propio gate ya usa
  para Tabs (`:167-180`: crear el elemento vanilla, leer su `getComputedStyle`, comparar). Así el
  mensaje "como el vanilla" pasa a ser cierto, y el gate sigue al token si `--radius-lg` vuelve a
  moverse.

Nada más. No tocar paddings, tamaños de fuente ni colores: el gate los da verdes hoy y no están en
alcance.

## Cómo se verifica

Con el dashboard real levantado, no con mocks:

    bun run src/cli.ts dashboard --port 4323 &
    BASE=http://localhost:4323 node scripts/ui-gates/ui2-design-system.mjs

Antes del ítem: 31 PASS / 1 FAIL (`Tabs: … radio 20px`). Después tiene que dar **32 PASS / 0 FAIL**,
con la línea de Tabs reportando radio **8px** y la del Dialog reportando **8px** contra el `.modal`
computado, no contra un literal.

**Bajar el dashboard al terminar.**
