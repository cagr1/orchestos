# CI.54 fase 1 — `codex-live`: que el fallo "turn 1 user message appears before completion" deje evidencia

## Problema
`scripts/ui-gate/flows/codex-live.mjs:155-163` falló 1 de 3 corridas (2026-11-02): la burbuja del mensaje del
usuario no apareció en 2 s tras enviar. El pre-push reintenta y pasa, así que el defecto queda oculto. No sabemos si
es el producto (el mensaje optimista tarda o no se pinta) o el gate (selector `div.max-w-2xl`, texto truncado,
envío que no salió). Esta fase NO arregla: hace que el próximo fallo diga por qué.

## Qué cambiar
1. `codex-live.mjs`, solo en ese paso: si `bubbleVisibleAt` es null, antes de `step(...)` capturar y adjuntar al
   detalle del paso (el `detail` del `step`, como string JSON acotado a ~2 KB) y al `result.json`:
   - captura de pantalla `turn1-bubble-missing.png` en el directorio de evidencia del run (mismo mecanismo que usen
     otros flows para capturas; buscar `screenshot(` en `scripts/ui-gate/`);
   - si la burbuja existe pero no es visible / no existe: `count()` de `div.max-w-2xl` con ese texto y de
     `div.max-w-2xl` en total, y el `innerText` (últimos 300 chars) de `main` del hilo;
   - estado del composer: valor del textarea (¿se vació?), `aria-label` del botón de enviar (Send/Stop);
   - respuesta de la API del turno: si el `POST /api/chat` ya respondió, su status; y
     `GET /api/chat/sessions/:id/timeline` → `pending`, número de mensajes y roles;
   - líneas `[chat-turn]` de la sesión en `dashboard.log` (ya existe `sessionLogs`).
   - además medir: seguir esperando hasta 15 s y registrar a qué ms apareció la burbuja (o "nunca").
2. El paso sigue fallando igual que hoy (mismo umbral de 2 s); solo cambia la evidencia.

## Qué no tocar
- Producto (`src/`), otros pasos del flow, el umbral, `PLAN.md`, `NEXT.md`. No commitear.

## Cómo se verifica
- `bun run lint`, `bun run typecheck` verdes.
- Contraprueba forzada (temporal, no se entrega): bajar el umbral a 1 ms localmente, correr
  `bun run ui:gate codex-live` fuera del sandbox y comprobar que el `result.json` trae la evidencia y la captura;
  restaurar el umbral. Pegar en el reporte el detalle del paso de esa corrida.
- Corrida normal: `bun run ui:gate codex-live` verde.

## r2 — contraprueba que sí fuerce la rama
El umbral de 1 ms no la fuerza (la burbuja aparece en 15–20 ms y `waitFor` acepta la primera consulta). Forzar así,
temporal y sin entregarlo: en el `filter({ hasText: … })` de la burbuja buscar `sentMessage + '-NO-EXISTE'`. Correr
`bun run ui:gate codex-live` fuera del sandbox, comprobar en `result.json` el detalle del paso con la evidencia y que
existe `turn1-bubble-missing.png`; pegar ese detalle en el reporte; restaurar el filtro. Luego la corrida normal verde.
El diff actual de `codex-live.mjs` es tuyo (r1): consérvalo y corrígelo solo si la contraprueba revela un fallo.
