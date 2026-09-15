# AT.4 — el congelamiento es O(CLIs × transcripts), no GC

## Causa raíz confirmada (medido 2026-09-15)

`readActiveSessionStatuses` en `scripts/session-status.ts:71-94` tiene un bucle anidado:

```
for (const cli of detections) {          // 7 CLIs
  for (const transcriptPath of paths) {  // 371 transcripts en esta máquina
    const metrics = await readSessionMetrics(transcriptPath, adapters)
    if (!metrics || metrics.context.source !== cli.id) continue
    ...
    break
  }
}
```

Para un CLI que no tiene ningún transcript propio (5 de 7 en esta máquina: opencode,
deepseek, gemini, kimi, glm), el `break` nunca se alcanza: se parsean los 371 archivos
completos antes de rendirse. Medido: `readSessionMetrics` sobre los 371 archivos una vez
= 1.4s. 5 CLIs sin match × 1.4s ≈ 7s de bloqueo síncrono del event loop de Bun — coincide
con los 7–15s reportados en `curl`/`app.js`/`i18n.js` en AT.4 (PLAN.md:172-184). Se
descartó `detectInstalledClis` (cacheado, 45-160ms) y `readCodexRateLimitsLive` (68-73ms)
como causa: medidos por separado, ninguno explica el tiempo.

Repro de la medición (no lo dejes en el repo, era solo diagnóstico):
```
bun -e 'import { readActiveSessionStatuses } from "./scripts/session-status.ts"; \
  const t0=performance.now(); await readActiveSessionStatuses({projectRoot: process.cwd()}); \
  console.log(performance.now()-t0)'
```

## Qué cambiar

Invertir el bucle: una sola pasada sobre `paths`, parsear cada transcript **una vez**,
no una vez por CLI.

`scripts/session-status.ts`, función `readActiveSessionStatuses` (líneas ~57-111):

1. Recorrer `paths` en su orden actual (ya vienen ordenados por `mtimeMs` descendente).
2. Por cada `transcriptPath`, llamar `readSessionMetrics` **una sola vez**.
3. Si `metrics` es válido y `metrics.context.source` corresponde a un CLI de `detections`
   que todavía no tiene resultado (`found` aún no seteado para ese id), guardarlo —
   incluyendo la rama de `readCodexRateLimitsLive` que ya existe para `cli.id === 'codex'`.
4. Cortar el recorrido cuando ya se encontró un match para **todos** los CLIs detectados
   (no hace falta seguir leyendo transcripts viejos una vez que todos tienen su tarjeta),
   o cuando se acaban los `paths`.
5. Al final, construir `result` en el mismo orden de `detections` que hoy (`found ?? {...
   available: false ...}`), sin cambiar la forma de `SessionStatus` ni el contrato de la
   función — esto es una optimización interna, no un cambio de API.

No tocar `discoverSessionTranscripts`, `detectInstalledClis` ni `readCodexRateLimitsLive`:
ya están medidos como rápidos.

## Qué no tocar

- El formato de `SessionStatus` / `SessionStatusResponse`.
- El polling de 5s en `SessionStatusBar.tsx` (no es lo que se decidió cambiar en esta
  pasada; la corrección del bucle ya baja el costo de ~7s a ~1.4s peor caso, una sola vez
  por poll en vez de repetido — suficiente para no bloquear estáticos).
- `detectInstalledClis`, `readCodexRateLimitsLive`, `discoverSessionTranscripts`.

## Cómo se verifica

1. `bunx tsc --noEmit` limpio.
2. Tests existentes de `scripts/session-status.ts` (buscar
   `session-status.test.ts` o equivalente) en verde; si no hay test de este bucle,
   añadir uno con fixture de N transcripts donde ningún CLI del set tenga match, que
   assert-ee que `readSessionMetrics` (mock/spy) se llama **como máximo una vez por
   transcript**, no una vez por (CLI × transcript).
3. Medición antes/después con el mismo `bun -e` de arriba contra este repo real: reportar
   los ms de un run en frío y dos en caliente.
4. Gate en vivo (obligatorio, dashboard real): levantar `bun run src/cli.ts dashboard`,
   abrir el navegador, y confirmar con curl aislado en paralelo que `app.js`/`i18n.js`/
   `style.css` siguen sirviendo en ms mientras `/api/session/status` está en curso (no
   `000` ni tardanzas de segundos). Bajar el dashboard al terminar.

## Evidencia de cierre

Medición antes/después + captura del gate en vivo en el commit de cierre de AT.4, citando
este spec. Borrar este archivo en ese mismo commit.
