# UI.8.1 — el gate visual, y Playwright como dependencia real

Contrato en `PLAN.md:1708-1720`. Primer paso de la Entrega 2 del piloto ERP
(`PLAN.md:14-61`, `NEXT.md`). Motivo: sin este gate, cada pantalla nueva reproduce el
problema de UI.3.5 (tokens definidos, 4.5% de adopción real, medido en su momento).

## Ya resuelto, no repetir

**Playwright ya está instalado como devDependency real**: `package.json:67`
(`"playwright": "^1.63.0"`), `node_modules/.bin/playwright --version` → `1.63.0`,
`import { chromium } from 'playwright'` funciona desde cualquier script del repo
(confirmado en vivo el 2026-09-15 corriendo un gate ad-hoc de ERP.1). Los comentarios
"Playwright no está en devDependencies, es un gate manual" en
`scripts/ui-gates/ui2-design-system.mjs:9` y `ui3-shell.mjs:9` están desactualizados —
corregirlos (ya no hace falta el paso `cd <dir con playwright>`) pero no hay que instalar
nada.

## Qué falta: el gate en sí

Nuevo `scripts/ui-gates/ui81-visual-consistency.mjs`, mismo patrón que
`ui2-design-system.mjs`/`ui3-shell.mjs` (Playwright real, `chromium.launch()`, navega al
dashboard en `BASE`, mide estilo COMPUTADO, nunca un número copiado a mano). Contra la
pantalla que se le pase por argumento (default: la vista `chat`, que es donde arranca la
Entrega 2), el gate **falla** si:

1. Hay **más de 5** valores distintos de `font-size` computado entre todos los elementos
   visibles de texto de la pantalla (leer `getComputedStyle(el).fontSize` de cada nodo con
   texto directo, dedup por valor).
2. Hay **más de 2** valores distintos de `border-radius` computado, **excluyendo** el pill
   del header (excluir por selector — confirmar en el código actual cuál es ese elemento,
   buscar `header` + `border-radius: 999px` o similar patrón de "pill" en `screens.css`).
3. Queda un `<select>` nativo donde el diseño exige `Combobox` o chips — el gate no
   necesita saber "dónde correspondía": basta con que **cualquier** `<select>` visible
   en la pantalla auditada falle el gate (si hay excepciones legítimas ya documentadas,
   confirmar contra `docs/ui-reference-patterns.md` antes de excluirlas, no asumir).
4. El conteo de atributos `style=` inline en el HTML servido **sube** respecto del
   commit anterior. Trinquete, solo baja — mismo mecanismo que `scripts/check-coverage.ts`
   (leer ese script para copiar el patrón de "número guardado en un archivo pequeño,
   comparar, fallar si empeora, nunca requiere que alguien lo suba a mano").

## Cómo se verifica

1. `bunx tsc --noEmit` limpio (si el gate importa algo tipado; el script en sí es `.mjs`
   suelto como los otros, no necesita tipar).
2. Correr el gate nuevo contra el dashboard real (`bun run src/cli.ts dashboard --port
   4321 &`, luego `BASE=http://localhost:4321 node scripts/ui-gates/ui81-visual-consistency.mjs`)
   y **verlo fallar** con el CSS de hoy — si pasa a la primera, el gate está mal escrito
   (regla explícita del ítem, `PLAN.md:1719`). Documentar en el commit de cierre CUÁLES
   de las 4 condiciones fallaron y con qué números reales (no solo "falló").
3. Bajar el servidor del dashboard al terminar cada corrida.

## Qué NO tocar

- No arreglar el CSS/HTML para que el gate pase — este ítem es **escribir el gate**, no
  resolver la inconsistencia visual (eso es UI.8.3/UI.8.5, después).
- No instalar ni tocar la versión de Playwright — ya está resuelta.
- No migrar ninguna pantalla de UI.4 (eso sigue pausado hasta que este gate exista Y
  esté hecho UI.8.3, `PLAN.md:1544-1548`).

## Evidencia de cierre

Salida real del gate (`FAIL` esperado) pegada en el commit de cierre o en
`docs/done/evidence/UI.8.1-live.json`, citando los números concretos de cada condición.
Borrar este spec en el commit de cierre.
