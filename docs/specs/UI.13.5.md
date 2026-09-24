# UI.13.5 — La barra inferior muestra las cuotas al día

Diagnóstico completo en PLAN.md § UI.13.5 (causas 1–5, ya verificadas; no re-diagnosticar). Síntoma para Carlos:
la barra de usage solo se actualiza al recargar, y la cuota de Claude "sube y baja" sin reset.

## Cambios
1. **Servidor, `src/dashboard/handlers/session-status.ts`:** si la caché tiene más de ~10 s, esperar la lectura nueva
   (con tope razonable, p. ej. 3 s; si vence, devolver la caché) en vez de devolver la vieja y refrescar detrás.
2. **Cliente, `App.tsx`:** `refreshUsage()` al cerrar cada turno del chat (hermanos: todo camino que termina un turno
   o un run de tarea), además del intervalo y `visibilitychange` que ya existen.
3. **Hermanos del fetch sin proyecto:** `ShellStatusBar.tsx:73` y `AgentComposer.tsx:136` (y cualquier otro
   `fetch('/api/session/status')` sin `x-orchestos-project-id`) se quitan: el estado llega por props desde `App`.
   Al cargar, **1 sola** petición a `/api/session/status`, con proyecto.
4. **Varias sesiones de Claude, `scripts/claude-statusline-tee.sh` + lector `readClaudeStatuslineRateLimits`
   (`scripts/session-status.ts:52`):** gana la lectura más nueva por ventana, no la última escrita. Regla: para cada
   ventana (`five_hour`, `seven_day`), `resets_at` mayor gana; con el mismo `resets_at`, gana el mayor
   `used_percentage` (el uso dentro de una ventana solo sube). Implementarlo donde sea atómico y sin carreras entre
   sesiones que escriben a la vez (p. ej. un archivo por `session_id` y el lector combina, borrando los de ventanas
   vencidas). El tee sigue siendo POSIX `sh` y nunca rompe la statusline de Claude (sale 0 siempre). Test del
   combinador con dos lecturas (vieja 67 % libre / nueva 61 % libre, mismo reset → 61) y con reset nuevo.
5. **Diente contra fantasmas, `scripts/ui-gate/run.mjs`:** al arrancar, des-registrar por la API los proyectos cuya
   ruta esté en `os.tmpdir()` con prefijo `orchestos-ui-` (corridas previas interrumpidas) y borrar esas carpetas;
   registrar también un handler de `SIGINT`/`SIGTERM` que ejecute los `cleanup` pendientes.

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/usage-bar.mjs`:
- Al cargar: exactamente 1 petición `/api/session/status` y lleva `x-orchestos-project-id` (contar con
  `page.on('request')`).
- Escribir dos lecturas de statusline de "sesiones" distintas en el `ORCHESTOS_HOME` del gate (nunca el real):
  la barra de Claude muestra la más nueva (61 %) y no vuelve a 67 % tras refrescar.
  Ojo: el dashboard del gate usa hoy la DB y el `~/.orchestos` reales; si hace falta, una variable propia solo para
  el directorio de statusline, pasada al dashboard del gate, no cambiar `ORCHESTOS_HOME` entero.
- Tras un turno real de chat (Codex · gpt-5.6-luna · medium), la barra se refresca sin recargar (nueva petición a
  `/api/session/status` después del fin del turno, sin `page.reload`).
- 0 errores de consola; al terminar, 0 proyectos `orchestos-ui-*` en `/api/projects`.
- Verde: `bun run gate:all` + `bun run ui:gate usage-bar` + `bun run ui:gate smoke`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. No toques `~/.orchestos/claude-statusline.json` real ni la DB real salvo por
la API con el proyecto temporal. No re-ejecutes `agent:preflight`. `bun run typecheck` completo;
`bunx biome check . --diagnostic-level=error` = 0 errores. Lista TODOS los archivos que toques. No hagas commit.
