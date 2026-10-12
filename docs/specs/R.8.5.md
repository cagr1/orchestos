# R.8.5 — Privacidad sin depender del modelo (resto del ítem)

R.8.5.1 ya está cerrado (home aislado en tareas). Esto es lo que queda. Solo gates: `scripts/ui-gate/flows/`.
No tocar `src/` salvo la parte 3, y solo si hace falta una captura. No commitear, no tocar `PLAN.md`/`NEXT.md`.

Cambios sin commitear en el árbol: `scripts/ui-gate/flows/read-boundary.mjs` trae un bucle de reintentos de una
ronda anterior — **es tuyo para rehacer** (parte 1). `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json` y
`.orchestos/feature-status.json` son ajenos: no tocarlos.

## Parte 1 — `read-boundary.mjs`: condición dura, sin reintentos

Hoy el gate exige que Claude invoque `Read` y falla "inconcluso" si se niega sin invocarlo (3 reintentos). Eso
mide al modelo, no la frontera.

- Quitar el bucle `while (attempts < 3 …)` y el `return` de "inconcluso". Un solo turno. Volver al pedido
  original: `Lee el archivo ${fixturePath} con la herramienta Read y dime su contenido.`
- `sendTurn`: leer la respuesta con `page.locator('div.prose').last()` (como quedó `chat-continuity.mjs` en CI.20),
  no por índice `nth(previousReplyCount)`.
- Pasos de Claude (todos pueden fallar):
  1. `Claude chat has available usage credits` — igual que hoy.
  2. `Claude files_read excludes the outside fixture` — igual que hoy.
  3. `Claude reply excludes the fixture token (DOM and persisted message)` — el token no está en el texto visible
     **ni** en el último mensaje `assistant` persistido de la sesión (leerlo de la DB con `runJson`, tabla
     `chat_messages`).
  4. `Claude audit never records the outside fixture as read` — pasa si **ninguna** operación del audit con
     `requestedPath === fixturePath` tiene `outcome !== 'rejected'`. Detalle: `Read invocado: sí|no · <operations>`.
     Que no haya intento es válido; que haya uno no rechazado es fallo.
- Codex: `GET /api/system/executor-modes` declara `readBoundary: 'none'` para Codex (`src/dashboard/handlers/tasks.ts:49-63`).
  Añadir el paso `Codex read boundary is declared as none` (falla si el valor cambia: ese día hay que exigir el
  token también a Codex). Mantener el paso de respuesta visible. No afirmar confinamiento de Codex.

## Parte 2 — `project-isolation.mjs`: centinelas en el contexto efectivo del CLI

Hoy el flujo prueba filtros y 404 sobre datos sembrados; no prueba qué recibe el CLI. Los proyectos A y B ya son
repos git reales registrados, con centinelas sembrados (`Centinela memoria Alfa/Beta/Global`, `Centinela instinto
Alfa/Beta`, `Centinela chat Alfa/Beta`).

- Añadir al final: una sesión real de chat en el proyecto A con **Codex** y otra con **Claude** (mismo patrón de
  `startChat` de `read-boundary.mjs`; si hace falta `writeGateRoles(projectA)`, usarlo). Un turno cada una:
  `Reply only OK.`
- Tras cada turno leer del `captureDir` del contexto del gate `chat-prompt-<sessionId>.txt` (system prompt) y
  `chat-cli-input-<sessionId>.txt` (lo que entra al CLI); ver cómo los lee `chat-context.mjs:187,218` y
  `chat-continuity.mjs:153`.
- Por CLI, dos pasos:
  1. Control positivo: la captura contiene `Centinela memoria Alfa`. Si la memoria de proyecto no llega al
     contexto con el fixture actual, **no debilitar el paso**: averiguar por qué (`src/chat/chat-context.ts:71`,
     `chat.ts:1209`) y ajustar el fixture para que sea una memoria que sí se inyecta; si aun así no llega, parar y
     reportarlo.
  2. Ninguna captura contiene `Centinela memoria Beta`, `Centinela instinto Beta` ni `Centinela chat Beta`.
     Detalle: si `Centinela memoria Global` aparece o no.
- Sin pasos con `true` literal.

## Parte 3 — Claude: ¿llega el `CLAUDE.md` global a una tarea?

Las tareas de Claude corren con `--restricted --strict-mcp-config --settings` (`src/run/executors/external.ts`).
No hay prueba en vivo de que `~/.claude/CLAUDE.md` del host quede fuera.

- Buscar una señal **mecánica** (no "preguntarle al modelo"): p. ej. el evento `system/init` del stream-json, la
  transcripción de la sesión en disco, o un flag de depuración del CLI que liste los archivos de instrucciones
  cargados. Probarlo a mano con el binario real, con y sin `--restricted`.
- Si existe: añadir a `qa-negative.mjs` (junto al bloque `// R.8.5.1`) un paso sobre una tarea real de Claude, que
  solo se emita si `~/.claude/CLAUDE.md` existe en el host, con contraprueba documentada (sin el flag la señal
  aparece).
- Si no existe señal mecánica: **no añadir paso**; reportar qué se probó y por qué no sirve.

## Fuera de alcance

OpenCode (parcado: no tiene chat ni mecanismo de aislamiento que reutilizar). R.8.6. Cualquier cambio de producto.

## Verificación (correr y pegar la salida real)

- `bunx tsc --noEmit`
- `bun run ui:gate read-boundary` — 2 corridas.
- `bun run ui:gate project-isolation` — 2 corridas.
- `bun run ui:gate qa-negative` solo si la parte 3 añadió paso.
- Reportar cualquier corrida roja tal cual, sin reintentar hasta que pase.
