# AT.20 — El chat crea tareas con una herramienta, no con un marcador de texto

Decisión de Carlos 2026-10-14 (AT.19 (a)): reemplazar `[[orchestos:task]]` por una herramienta `create_task`.
Regla de Carlos que manda: **nada solo para un LLM**. La herramienta se ofrece igual a todo CLI de chat, por una
capa común (servidor MCP de OrchestOS) + un adaptador por CLI declarado en el registro (`cli-registry.ts`).

## Diseño (decidido; no reabrir)
1. **Servidor MCP stdio de OrchestOS**: `src/mcp/server.ts` (lanzable con `bun <ruta>`), sin dependencias nuevas si
   el protocolo se puede implementar a mano (JSON-RPC 2.0 por stdio: `initialize`, `tools/list`, `tools/call`); si
   hace falta SDK, `@modelcontextprotocol/sdk` y decirlo en el reporte. Herramienta `create_task` con argumentos
   `{ title: string, description: string, outputs: string[] }` (rutas relativas al proyecto que la tarea va a crear o
   modificar). El servidor NO crea nada: valida los argumentos y responde "Task proposal sent; the user will see it
   and approve it." La fuente de verdad es la llamada que aparece en el stream del CLI.
2. **Registro**: `CliDefinition` gana un campo de adaptador MCP (cómo se le pasa un servidor por invocación y cómo
   se reconoce una llamada MCP en su stream). Claude: `--mcp-config <json>` (compatible con `--restricted` y
   `--strict-mcp-config`) + permitir la herramienta (`--allowedTools mcp__orchestos__create_task`); su stream trae
   `tool_use` con nombre `mcp__orchestos__create_task`. Codex: **el chat ya no usa `exec`, usa el app-server**
   (`src/run/executors/codex-app-server.ts`, `thread/start`/`thread/resume` con `sandbox: 'read-only'`; un proceso
   compartido por config home). Averiguar con el binario real cómo darle un servidor MCP **por hilo** (override de
   config en `thread/start`/`thread/resume` si existe; si solo se puede al lanzar el app-server con
   `-c mcp_servers.orchestos.…`, entonces el servidor MCP recibe por argumento/variable si el hilo puede crear tareas y
   responde con error a `create_task` cuando no) y qué notificación/item emite para una llamada MCP y sus argumentos. **Verificar ambos con los binarios instalados antes de
   cablear**, con una corrida mínima real; pegar en el reporte las líneas del stream que prueban el formato.
3. **Flujo**: donde hoy `chat.ts:1129-1140` (`settleTaskIntent`) detecta el marcador y llama a `buildNaturalDraft`, se usa la llamada a
   `create_task`: sus `outputs` y `description` alimentan el borrador directamente (sin adivinar salidas del texto).
   Si el CLI llamó a la herramienta pero los argumentos son inválidos, el turno lo muestra como error visible, no lo
   descarta en silencio. La tarjeta "Approve & Run" y todo lo de después no cambia.
4. **Prompt** (`buildAutoTaskInstruction`, `chat.ts:101-116`, y `src/chat/chat-context.ts`): la regla queda en una línea: "Si hay que crear o modificar
   archivos, llama a `create_task`; todo lo demás, respóndelo." Fuera: las instrucciones del marcador y "never
   mention read-only". Sin proyecto o en modo `chat`: la herramienta no se ofrece (no se pasa el servidor).
5. **Fuera el marcador**: borrar su detección y limpieza en `chat-live.ts` y `chat.ts`, y actualizar o borrar los
   tests que lo afirman (`chat-live.test.ts:24`, `chat-task-marker.test.ts`, fixtures de `chat-r5-reliability` y
   `chat-sessions`) y los flujos `scripts/ui-gate/flows/chat-roles.mjs:174,253`, `auto-flow.mjs:619`,
   `chat-turn-details.mjs:338`. Grepear `orchestos:task` al final: 0 en `src/` y `scripts/`.

## Qué NO se toca
El ejecutor de tareas, `tasks.yaml`, la tarjeta y su aprobación, OpenCode (no participa en el chat,
`chat.ts:878`; su adaptador queda declarado como "sin MCP en chat"). El shell de solo lectura es AT.21, no aquí.
Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado del cerebro.
`src/run/harness.ts` no se toca (si se toca, exige entrada en `LEDGER.md`).

## Verificación
- `bun run typecheck`, `bunx biome check <archivos tocados>` (el `lint` del repo entero ya tiene deuda previa:
  no introducir errores nuevos), `bun run test:coverage`.
- Ojo con AT.19.1 (`eb48845`): Claude retoma su sesión con `--resume`; el `--mcp-config` va en cada invocación,
  también al retomar. Comprobarlo en el turno 2 de una sesión.
- Tests nuevos: el servidor MCP responde `initialize`/`tools/list`/`tools/call` (stdio real); el parser de cada
  adaptador reconoce la llamada con una línea de stream real capturada (fixture copiado de la corrida real).
- En vivo (el cerebro lo vuelve a correr): `bun run gate:evidence -- --label AT.20-chat-live -- bun run ui:gate auto-flow chat-roles chat-turn-details chat-continuity chat-streaming codex-live` con Claude y
  Codex reales; un pedido de crear un archivo produce la tarjeta con las salidas que el modelo pasó a la herramienta.

## Ronda 2 (cerebro, 2026-10-17) — tras revisar el diff de la ronda 1

Lo de la ronda 1 se queda (servidor, adaptadores, Claude, Codex app-server, marcador fuera). Se corrigen tres
regresiones que contradicen "nada solo para un LLM" y una que deja la herramienta muda:

1. **Chat por API (OpenRouter) vuelve a crear tareas.** Ya tiene herramientas (`runToolLoop`, `chat.ts:~1801`):
   añadir `create_task` como herramienta nativa más, con el mismo `CREATE_TASK_SCHEMA` y la misma validación
   `parseCreateTaskArgs` de `src/mcp/server.ts` (capa común; no duplicar). El ejecutor de la herramienta responde
   `CREATE_TASK_RESPONSE` y entrega la propuesta a `settleTaskIntent` por el mismo camino que la llamada MCP.
   Solo se ofrece con las mismas condiciones (proyecto + modo que permite tareas). Test unitario con el tool loop.
   Ollama (sin herramientas): queda sin crear tareas y su prompt lo dice; anotarlo en el reporte.
2. **Codex `exec` (respaldo sin `sessionId`) también ofrece la herramienta**: pasar el servidor con
   `-c mcp_servers.orchestos.command=…`/`args=[…]` (más la aprobación automática equivalente) cuando
   `offerTaskTool`; reconocer en su stream JSON el item de llamada MCP (comprobar con el binario real, fixture
   copiado) y convertirlo al mismo paso `mcp__orchestos__create_task`. Si `exec` no puede, decirlo con la salida real.
3. **Hilo de Codex con disponibilidad de la herramienta distinta a la actual** (p. ej. modo `chat` → `code` con el
   hilo ya reanudado en el proceso): la herramienta debe estar disponible en ese mismo turno. Opción preferida:
   guardar junto al hilo si se abrió con herramienta (incluir `offerTaskTool` en el hash que ya se guarda, o un campo
   propio) y, si cambió, volver a `thread/resume` con el `config` nuevo aunque el hilo esté en `this.resumed`; si el
   app-server no aplica `config` en un resume repetido (medirlo), abrir hilo nuevo con transcripción y el paso
   visible que ya existe para hilo caducado. Test unitario del cambio de modo.
4. Mismo criterio para Claude: ya va por invocación (sin estado), no requiere cambio; confirmarlo en el reporte.

Verificación: la misma de arriba (typecheck, biome de lo tocado, `test:coverage`). No correr `ui:gate` (lo corre el
cerebro). Mismas prohibiciones.
