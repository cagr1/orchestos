# UI.12.2a — Trinquete de CSS vanilla

Contexto: UI.12.2 sumó +119 líneas a `styles.css` y 4 de sus 7 rondas salieron de choques con reglas
viejas. La UI nueva va en las islas React con los `className` del prototipo; el CSS vanilla solo baja.

## Qué crear

1. `scripts/css-baseline.json`:
   ```json
   { "total": 5145, "autorizacion": "" }
   ```
   (5145 = `wc -l` de `src/dashboard/public/styles.css` 1788 + `screens.css` 3357 hoy; verificarlo.)

2. `scripts/check-css-ratchet.ts`, mismo idioma que `scripts/check-ui-copy.ts` (función pura
   exportada + `main()` con `if (import.meta.main) process.exit(main())`, `runCommand` de
   `scripts/agent-governance.ts:31`). Comentario de cabecera corto con el porqué (fecha 2026-09-21).
   - `countLines(source)`: igual que `wc -l` (no cuenta una línea vacía final).
   - `checkCssRatchet(total, staged, head)` → `{ errors, lowered }`:
     - si `head` existe y `staged.total > head.total`: error salvo que `staged.autorizacion` sea
       distinta de `head.autorizacion` **y** empiece por `CSS+ autorizado por Carlos:`;
     - si `total > staged.total`: error con los números y la frase "La UI nueva va en la isla React
       con los className del prototipo.";
     - sin errores y `total < staged.total` → `lowered = { ...staged, total }`; si no, `null`.
   - `main()`: lee el contenido **staged** (`git show :<ruta>`) de los dos CSS y del baseline, y el
     baseline de `HEAD` (`git show HEAD:<ruta>`, `null` si no existe). Con errores imprime `✗` y sale 1.
     Con `lowered`, reescribe el JSON (2 espacios + `\n`) y hace `git add` del baseline.

3. `scripts/check-css-ratchet.test.ts` (`bun:test`), casos: conteo como `wc -l`; sobre el tope
   bloquea; bajo el tope baja; igual pasa sin tocar; subir el tope sin autorización nueva falla;
   con autorización nueva pasa; reusar la autorización previa para subir otra vez falla.

4. `scripts/pre-commit.sh`: paso nuevo justo después del de `check-ui-copy.ts`:
   ```bash
   echo "🎨 Verificando trinquete de CSS vanilla..."
   bun run scripts/check-css-ratchet.ts
   ```
   Luego `bun run hooks:install` para que `.git/hooks/pre-commit` no quede desincronizado.

## No tocar

`PLAN.md`, `styles.css`, `screens.css`, las islas. No commitear.

## Verificación (el ejecutor)

- `bun test scripts/check-css-ratchet.test.ts` verde; `bunx tsc --noEmit` limpio.
- `bun run hooks:check` verde.
- A mano, sin commitear: stagear +1 línea en `styles.css` → `bun run scripts/check-css-ratchet.ts`
  sale 1; revertir; stagear −1 línea → sale 0 y el baseline queda en 5144; revertir ambos
  (`git restore --staged --worktree src/dashboard/public/styles.css scripts/css-baseline.json` y
  volver a poner 5145).
