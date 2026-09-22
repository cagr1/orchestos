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

## Siguiente (serial, una ronda cada uno)
1. UI.13.2c Settings — cerrado 2026-09-22. Pendiente menor: idioma solo traduce Settings.
2. UI.13.4a — cerrado 2026-09-22.
3. **UI.13.4b — spec listo: `docs/specs/UI.13.4b.md`** (2026-09-22). Decisiones de Carlos: la consola reemplaza
   al chat en Dev, como en la plantilla; la frontera es idéntica al runner, endurecida para los dos (argumentos con forma
   de ruta confinados al proyecto, sin lista de bloqueo; paso 1b del spec); los comandos se guardan en DB (migración 13). Siguiente tab (Opus): lanzar Luna (`codex exec -m gpt-5.6-luna`) con el spec y
   después el gate en vivo del cerebro.
   UI.13.4c razonamiento/herramientas/tarea retenida en el chat — spec por escribir.
4. Tasks/Runs/Graph → Memory/Specs/Skills/Instincts/Plan → UI.13.3 borrar vanilla.
Gate en vivo con el patrón de `/tmp/ui132b-gate*.mjs`. Regla nueva: comportamientos de la plantilla se
hacen reales, no se quitan (PLAN.md § UI.13).

## Avisos
- Al lanzar Luna, agregar al prompt: "No invoques codex exec ni delegues a otro agente" (hoy se anidó sola).
- Sesiones interactivas de Codex viejas abiertas: PIDs 78537 (12-sep), 48287 (11-sep), 62791 (hoy 19:07).
  No cerrarlas sin que Carlos confirme.
- Pendiente de verificar con Carlos: un turno real de chat contra un LLM (el modelo lo elige él).
- Fuente: el prototipo mismo renderiza con fuente del sistema (clase `font-sans` en `body`); la app es fiel.
  Si Carlos quiere Plus Jakarta Sans real, es un cambio de una línea.
- Stash guardados: `stash@{0}` UI.12.2b (reemplazado), `stash@{1}` UI.11 parcial. No aplicar.
