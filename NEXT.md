# NEXT — handoff 2026-09-21 (noche) → siguiente tab

## Decisión vigente
UI.13 (PLAN.md § UI.13): el prototipo de AI Studio **es** el frontend (`src/dashboard/app/`, servido en `/`);
el vanilla vive en `/legacy` solo hasta UI.13.3 y no se edita. Tope: **lo que falta de UI.13 en 2 h**
(regla escrita en PLAN.md § UI.13).

## Regla de Carlos 2026-09-22
Cero trabajo sobre el vanilla: `/legacy` es cascarón de referencia. Todo look/comportamiento sale de la
plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Anotado en PLAN.md § UI.13.

## Hecho y pusheado
UI.12.2a, UI.13.1, UI.13.1b, UI.13.2a (Chat), UI.13.2b (proyectos/Dev/Files, cerrado 2026-09-22).

## Decisión 2026-09-22 (tarde) — "SI go"
Copiar YA tal cual las pantallas de la plantilla sin backend (datos de ejemplo visibles), conectar después.
Primero: pasada de fidelidad pantalla por pantalla, capturas lado a lado revisadas por Opus (no haiku).
Detalles de Carlos → PLAN.md § UI.13 (3) a–d: barra inferior sin acción/usage 5h+semanal, selector de CLI/modelo/
esfuerzo real en el input del chat, iconos de CLI con color, Settings→Usage estilo GitHub.
CI verde otra vez en local (61b63b6, CI.3); pre-push ahora corre lint.

## Estado 2026-09-22 (noche)
UI.13.5 cerrado y pusheado (448f07a). Siguiente: **UI.14** — copiar la plantilla nueva de AI Studio (Dev como chat
que actúa como CLI, AgentComposer, ContextRing, ShellStatusBar, logos de producto) y cablearla. Plan en el último
mensaje del tab anterior; **espera el GO de Carlos** y su respuesta sobre tooltips (nativos `title` tal cual vs
tooltip propio instantáneo). Luego UI.13.6 (cuotas reales: Claude sin fuente, Codex vencido desde 17-sep).

## PLAN-ORDEN — en curso (2026-09-22)
- Carlos: cerrar UI.13.6 y reordenar PLAN.md en tres fases: interfaz → producto mínimo → correr dentro de OrchestOS
  igual que el CLI directo (AT.13 + hallazgos de Opus, run `560e910f`). Spec `docs/specs/PLAN-ORDEN.md` (sin
  commitear). **Luna lanzada**, log `/tmp/plan-orden-luna.log`. Al terminar: verificar invariante de ítems,
  `plan:render --check`, `bun run next` antes/después, `test:coverage`; commit y push.
- UI.14 cerrado (`f4fb772`); sin verificar en vivo: selector nativo de nuevo proyecto.
- Carlos: turno real de gate = **Codex · gpt-5.6-luna · medium**.

## Siguiente (serial, una ronda cada uno)
1. UI.13.2c Settings — cerrado 2026-09-22. Pendiente menor: idioma solo traduce Settings.
2. UI.13.4a — cerrado 2026-09-22.
3. UI.13.4b — cerrado 2026-09-22 (816a229). Decisión pendiente de Carlos: la frontera por argumentos no frena
   `node -e`/`sh -c`; barrera real = sandbox de proceso o lista de binarios permitidos.
   UI.13.4c razonamiento/herramientas/tarea retenida en el chat — spec por escribir.
4. Tasks/Runs/Graph → Memory/Specs/Skills/Instincts/Plan → UI.13.3 borrar vanilla.
Gate en vivo con el patrón de `/tmp/ui132b-gate*.mjs`. Regla nueva: comportamientos de la plantilla se
hacen reales, no se quitan (PLAN.md § UI.13).

## Avisos
- Al lanzar Luna, agregar al prompt: "No invoques codex exec ni delegues a otro agente" (hoy se anidó sola).
- Luna en segundo plano: `codex exec … < /dev/null`. Sin eso queda colgada en "Reading additional input from
  stdin..." sin hacer nada (2026-09-22: 40 min perdidos).
- No usar `pkill -f "<patrón>"` si una tarea en segundo plano tiene ese texto en su línea de comandos: la mata
  también (2026-09-22 cortó el wrapper de Luna). Matar por PID (`lsof -ti :3000 | xargs kill`).
- Sesiones interactivas de Codex viejas abiertas: PIDs 78537 (12-sep), 48287 (11-sep), 62791 (hoy 19:07).
  No cerrarlas sin que Carlos confirme.
- Pendiente de verificar con Carlos: un turno real de chat contra un LLM (el modelo lo elige él).
- Fuente: el prototipo mismo renderiza con fuente del sistema (clase `font-sans` en `body`); la app es fiel.
  Si Carlos quiere Plus Jakarta Sans real, es un cambio de una línea.
- Stash guardados: `stash@{0}` UI.12.2b (reemplazado), `stash@{1}` UI.11 parcial. No aplicar.
