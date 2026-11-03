# CI.57 fase 1 — `composer-picker`: que el fallo "Codex effort levels remain available" deje evidencia

## Problema
`scripts/ui-gate/flows/composer-picker.mjs:64-87`: tras clic en el modelo `codexModel.name` (hoy GPT-6.1-Sol) y reabrir
el selector, a veces sigue marcado GPT-6-Luna y los esfuerzos visibles no incluyen `ultra`. Falló 4 seguidas el
2026-11-03 y luego pasó 5/5 con el mismo código. Esta fase NO arregla: hace que el próximo fallo diga por qué.

## Qué cambiar
Solo `composer-picker.mjs`, ese paso. Registrar desde antes del clic en el modelo hasta el `step`:
- requests y respuestas `/api/chat*` y `/api/config*` (método, ruta, status, ms relativos al clic; body acotado a
  300 chars) con `page.on('request'/'response')`, quitando los listeners en `cleanup`;
- el modelo de la sesión según la API (`GET` de la sesión de chat del gate) justo antes del clic, justo después y al
  reabrir;
- el modelo marcado (`aria-checked`/check visible) y los botones de esfuerzo visibles al reabrir;
- si el botón del modelo era visible y habilitado al hacer clic.
Si el paso va a fallar: escribir todo en `join(runDir, 'composer-picker-model-missing.json')` (patrón de
`codex-live.mjs:219-225`), captura `composer-picker-model-missing.png`, y el `detail` del step lleva un resumen
(~2 KB) con la ruta. El paso sigue fallando igual; sin reintentos nuevos.

## Qué no tocar
Producto (`src/`), la aserción, otros pasos/flows. No commitear ni tocar `PLAN.md`/`NEXT.md`.

## Cómo se verifica
- `bun run lint`.
- Contraprueba forzada (temporal, no se entrega): hacer que la condición del paso falle (p. ej. esperar un esfuerzo
  inexistente) y correr `bun run ui:gate composer-picker` fuera del sandbox; comprobar el JSON con todas las partes y
  la captura; pegar el detalle del paso. Restaurar.
- Corrida normal: `bun run ui:gate composer-picker` 11/11.
