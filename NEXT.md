# NEXT — Shell de dos modos: Chat | Dev (2026-09-15)

## HANDOFF (para Codex o cualquier LLM que retome)

Orden fijo, uno a la vez, cada uno con su spec antes de ejecutar:

**Regla de Carlos (2026-09-15, reafirmada):** OrchestOS se prueba desde la interfaz, no con
comandos. Si algo funciona en el back y no está en el front, no existe. Ningún gate ni paso de
preparación puede exigirle a Carlos correr un comando.

0. **UI.9.4 PRIMERO** — agregar proyecto desde la UI (diálogo nativo macOS). Es prerrequisito del
   gate de UI.9.1 (necesita ≥2 proyectos) y hoy registrar un proyecto solo existe por CLI. Escribir
   spec (cerebro), ejecutar con Luna, gate en vivo agregando el segundo proyecto desde el
   dashboard. El `+` vive junto a `Projects` en el sidebar actual; UI.9.1 lo reubica en modo Dev.

1. **UI.9.1** — spec listo: `docs/specs/UI.9.1.md`. Ejecutar con Luna:
   `codex exec -m gpt-5.6-luna -s workspace-write -c 'sandbox_workspace_write.writable_roots=["/Users/carlosgallardo/.orchestos"]' "Ejecuta docs/specs/UI.9.1.md" < /dev/null`
   Antes: `bun run agent:preflight -- --item UI.9.1 --agent codex`.
   **Depende de UI.9.4:** el gate en vivo exige ≥2 proyectos y el segundo se agrega desde la UI
   (paso 0). Nota técnica para el spec de 9.4: `ensureProject` (`src/cli.ts:2628`) registra solo en
   DB sin escribir en la carpeta — reusar esa lógica; `init` escribe `AGENTS.md`/`context.json` y no
   debe usarse. `POST /api/project/index` hoy indexa el proyecto del cwd, no una ruta dada.
2. **UI.9.2** — Modo Chat completo. Escribir spec (cerebro) tras cerrar 9.1.
3. **UI.9.3** — Modo Dev completo (Runs→Activity, rail colapsado, A.3/A.4). Spec pendiente.
4. ~~UI.9.4~~ — adelantado al paso 0.
5. **UI.9.5** — Inspector condicional: re-leer `docs/specs/UI.8.4c.md` contra el shell nuevo y
   ajustarlo antes de ejecutar (hoy asume el `#rightpanel`/`SidePanel` actuales).

Reglas que aplican: cerebro escribe spec y verifica, Luna ejecuta y no commitea; cierre = un commit
con código + `[x]` en PLAN.md + evidencia `docs/done/evidence/UI.9.x-live.json` + borrar spec
(`AGENTS.md` § Protocolo de delegación). Investigación delegada solo con modelos baratos.
Nota de diseño aceptada en 9.1: el switch va en una fila bajo el toprow del sidebar (no dentro), para
no romper las reglas/gates del toprow; moverlo arriba sería un cambio aparte.

Estado del working tree al dejar la sesión: `PLAN.md` (bloque UI.9 + pausa UI.8.4c),
`docs/specs/UI.9.1.md`, `docs/specs/UI.8.4c.md` y este `NEXT.md` **sin commitear**. El resto de
cambios sin commitear (`.claude/settings.json`, `orchestos.config.yaml`, `docs/*-2026-09-1x.md`,
`.impeccable/`) no son de esta sesión.

---

**Estado: plan propuesto, pendiente de confirmación de Carlos. No escribir specs de ejecución ni
código hasta que confirme las decisiones abiertas.**

Reemplaza el NEXT.md anterior (Entrega 2, ya cerrado en PLAN.md: UI.8.1–UI.8.4b).

## Decisiones ya tomadas por Carlos (2026-09-15)

- Switch **explícito** Chat | Dev arriba a la izquierda, como Claude Desktop. **Revierte** la
  decisión del 2026-09-02 ("Chat | Workspace como profundidad, no modo etiquetado", UI.7/UI.8.3).
  Se anota en PLAN.md sin borrar la anterior.
- Modo Chat = conversaciones **sin proyecto** (`projectId: null`), con cualquier CLI/modelo.
- UI.8.4c (inspector, `docs/specs/UI.8.4c.md`) **en pausa**; se retoma sobre el shell nuevo.
- Delegación: investigación con modelos baratos (Luna/haiku); ejecución con Luna.

## Estado real medido (auditoría en vivo 2026-09-15, capturas en /tmp/orchestos-audit/)

- La lista de sesiones está **dos veces** en pantalla: sidebar (`Sidebar.tsx:111-179`, rotulada
  "N agents") y aside interno del chat (`screens-core.js:474-529`, listeners `881-903`).
- "agents" en el sidebar son `chat_sessions` del proyecto — de ahí "los agentes están dentro del
  chat".
- Rail colapsado: "Projects" y "0 agents ⌄" se amontonan, no hay versión solo-ícono.
- Menú "New chat" con CLI (Local/Claude/OpenCode/Codex/OpenRouter): `screens-core.js:484-505`.
  Selector modelo+esfuerzo: `app.js:2714` (`buildChatModelFx`).
- El backend ya soporta sesiones sin proyecto y listado por proyecto
  (`handlers/chat-sessions.ts:79-124`). Probablemente sin backend nuevo para 9.1–9.3.
- Referencias visuales: modo Dev = `~/Documents/screens/Orca1_main.png` (ya en
  `docs/ui-reference-patterns.md` A.1–A.7). Modo Chat = captura de Claude Desktop de Carlos
  (hoy en el Escritorio; no está en `~/Documents/screens`). Ninguna captura muestra el switch
  mismo salvo esa.

## Anatomía objetivo

**Toprow del sidebar (ambos modos):** colapsar · `[Chat][Dev]` segmented de dos íconos
(chat / `</>`), seleccionado con fondo. Persistido en localStorage; arranque por defecto Chat
(memoria `feedback-home-siempre-chat`).

**Modo Chat** (Claude Desktop):
- `+ New chat` (abre el menú de CLI existente, sin proyecto).
- Sección `Chats` con buscar: lista plana de sesiones `projectId null`, título + tiempo relativo,
  borrar al hover. Fila activa = único contenedor con fondo/borde.
- Settings abajo.
- Canvas: estado vacío centrado (saludo + composer grande) cuando no hay sesión; conversación
  cuando la hay. Composer con selector CLI/modelo/esfuerzo a la derecha.

**Modo Dev** (Orca):
- `Activity` (hoy se llama "Runs": rename a Activity).
- Sección `Projects` con `+` (agregar proyecto): árbol proyecto → `N agents ⌄` → filas de agente
  (ícono del CLI, título, tiempo). `+` por proyecto = nuevo agente (menú de CLI con `projectId`).
- Click en proyecto → Workspace (tabs actuales). Click en agente → su conversación.
- Settings abajo.

**Ambos:** se borra el aside de conversaciones dentro del chat. El inspector condicional
(UI.8.4c) llega después.

## Ítems propuestos (orden)

1. **UI.9.1 — 🧠 Switch de modo y sidebar por modo.** `state.shellMode` + store React; Sidebar
   pinta dos variantes; borrar `sessionsAside` del chat; mover "New chat" al sidebar.
   Rail colapsado solo-ícono coherente en ambos modos.
2. **UI.9.2 — 🧠 Modo Chat completo.** Lista de chats sin proyecto con buscar/borrar, estado
   vacío centrado, composer con selector, nuevo chat nunca hereda proyecto.
3. **UI.9.3 — 🧠 Modo Dev completo.** Árbol con agentes bajo proyecto, `+` agente por proyecto,
   rename Runs→Activity, selección única con borde (A.3).
4. **UI.9.4 — 🧠 Agregar proyecto desde la UI** (hoy solo CLI / `POST /api/project/index`).
   Depende de la decisión 3 de abajo.
5. **UI.8.4c — inspector condicional**, spec ya escrito, re-leído contra el shell nuevo.

Gate de cada uno: `tsc`, biome, `build:ui`, `test:coverage`, `ui3-shell.mjs` actualizado,
`ui81-visual-consistency.mjs`, y en vivo con Playwright sobre datos sembrados (**≥2 proyectos,
≥3 sesiones por proyecto, ≥5 chats sin proyecto** — hoy la DB real tiene 1 y 1, la auditoría no
pudo ver el layout con volumen). Captura lado a lado con la referencia en la evidencia.

## Decisiones cerradas por Carlos (2026-09-15, segunda ronda)

1. Cada modo muestra lo suyo: Chat lista solo `projectId null`; Dev solo sesiones con proyecto.
2. "Agente" en Dev = solo sesiones de chat con CLI dentro del proyecto. Tareas/runs siguen en
   Workspace/Activity.
3. Agregar proyecto = diálogo nativo de macOS abierto por el servidor (`osascript choose folder`).
4. El switch cambia sidebar **y** canvas: Chat → último chat sin proyecto o estado vacío; Dev →
   último proyecto/agente usado.

**Estado: plan confirmado.** Siguiente: specs por ítem, ejecución con Luna.

## Fuera de esta pasada

ERP.2 (aislamiento de datos por proyecto), UI.8.5 Settings por alcance, UI.8.6 permisos, migrar
las pantallas restantes de UI.4, pantalla legacy `tasks` (`App.go('tasks')`, hermano observado).
