# NEXT — handoff 2026-09-21 (noche) → siguiente tab

## Decisión vigente
UI.13 (PLAN.md § UI.13): el prototipo de AI Studio **es** el frontend (`src/dashboard/app/`, servido en `/`);
el vanilla vive en `/legacy` solo hasta UI.13.3 y no se edita. Tope: **lo que falta de UI.13 en 2 h**
(regla escrita en PLAN.md § UI.13).

## Hecho y pusheado
UI.12.2a (trinquete CSS), UI.13.1 (andamio, `/` 573 ms vs `/legacy` 4.298 ms), UI.13.1b (fallback `/api` → 404),
UI.13.2a (Chat con datos reales). Último push: `675be66`.

## En curso al cerrar la tab
- **UI.13.2b** (proyectos, header, Dev, Files) — Luna lanzada 22:58 (`codex exec … "Ejecuta docs/specs/UI.13.2b.md"`,
  PID 25173, que abrió otra Luna hija PID 28641). Salida en `/tmp/luna-ui132b.log`. Cambios **sin commitear**
  en `src/dashboard/app/`.

## Primer paso en la tab nueva
1. `ps aux | grep "codex exec"` — ¿terminó Luna? Leer `tail -30 /tmp/luna-ui132b.log` y `git status`.
2. Gate en vivo del cerebro (Luna no puede abrir puertos en su sandbox): `bun run build:app`,
   `bun src/cli.ts dashboard --port 4330`, Playwright con el patrón de `/tmp/ui132a-gate.mjs`
   (`createRequire` del `package.json` del repo para `playwright`). Medir lo que lista la sección
   "Verificación" de `docs/specs/UI.13.2b.md`. Borrar sesiones de prueba (`DELETE /api/chat/sessions/:id`
   con header `Origin: http://localhost:4330`). Bajar el dashboard.
3. Cerrar UI.13.2b: `[x]` + evidencia en PLAN.md, `docs/done/evidence/UI.13.2b-live.json`, borrar spec,
   `bun run plan:reconcile`, commit, push. Si no cierra en esta ronda → queda en `/legacy` y se anota.
4. Bloques restantes, **una ronda cada uno**, spec con la lista de lo que el gate va a medir:
   Settings → Tasks/Runs/Graph → Memory/Specs/Skills/Instincts/Plan → UI.13.3 borrar vanilla.

## Avisos
- Al lanzar Luna, agregar al prompt: "No invoques codex exec ni delegues a otro agente" (hoy se anidó sola).
- Sesiones interactivas de Codex viejas abiertas: PIDs 78537 (12-sep), 48287 (11-sep), 62791 (hoy 19:07).
  No cerrarlas sin que Carlos confirme.
- Pendiente de verificar con Carlos: un turno real de chat contra un LLM (el modelo lo elige él).
- Fuente: el prototipo mismo renderiza con fuente del sistema (clase `font-sans` en `body`); la app es fiel.
  Si Carlos quiere Plus Jakarta Sans real, es un cambio de una línea.
- Stash guardados: `stash@{0}` UI.12.2b (reemplazado), `stash@{1}` UI.11 parcial. No aplicar.
