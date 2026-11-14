# USO.11 — El Chat investiga en la web y entrega documentos, como Claude Desktop

Decisión de Carlos (2026-11-13, GO). Depende de USO.10: un chat del modo Chat no tiene proyecto (`project_id`
null, modo `chat`). Este ítem le da dos capacidades: buscar/leer en la web y escribir documentos que se conservan.

## Qué existe (verificado 2026-11-13)

- Un chat general corre en `mkdtempSync(join(tmpdir(), 'orchestos-chat-'))` (`src/dashboard/handlers/chat.ts:1732`)
  que se borra al final del turno (`:1820`): lo que escriba se pierde.
- Claude: `buildClaudeChatArgs` (`src/run/executors/external.ts:487`) usa `--restricted --strict-mcp-config`
  (`CLAUDE_CHAT_BOUNDARY_FLAGS`, `:485`) y `--tools Read,Glob,Grep` (`CLAUDE_CHAT_TOOLS`, `:486`), `--add-dir
  <cwd>`. `claude --help` (2.1.325): `--restricted` confina las file tools a los working dirs y quita WebFetch
  salvo que `--tools` lo nombre. Ese borde (H.9.2, comentario `:461-483`) protege el chat de proyecto: no se toca
  para sesiones con proyecto.
- Codex: el chat va por app-server con `sandbox: 'read-only'` / `sandboxPolicy: { type: 'readOnly',
  networkAccess: false }` (`src/run/executors/codex-app-server.ts:710`, `:728`, `:762`, `:863`). `codex --help`
  (0.167.2) tiene `--search` ("native Responses `web_search` tool"); averigua el equivalente en app-server/config.
- Los adjuntos del usuario se pintan en `components/chat/OrchestChatView.tsx:442-444` (`msg.attachments`).

## Qué cambiar (solo para sesiones generales, `project_id` null)

1. Carpeta propia que se conserva: `~/.orchestos/chats/<sessionId>/` (respetar `ORCHESTOS_HOME` si el repo ya lo
   usa para la ruta base). Es el `cwd` del CLI en vez de la temporal. Se borra al borrar la sesión (no al archivarla).
2. Claude: para sesiones generales, `--tools` = `Read,Glob,Grep,Write,Edit,WebSearch,WebFetch`, manteniendo
   `--restricted` y `--strict-mcp-config` (Write/Edit quedan confinados a la carpeta del chat). Sin Bash. Comprueba
   con el binario real (`claude --help` y una sonda) que `--restricted` confina Write a la carpeta; si no, no lo
   habilites y dilo.
3. Codex: para sesiones generales, sandbox `workspace-write` con `writableRoots: [<carpeta del chat>]` y búsqueda
   web activada por el mecanismo que exponga app-server/config. `networkAccess` del sandbox de comandos sigue false
   salvo que la búsqueda lo exija; justifícalo.
4. Archivos entregados: al terminar el turno, los archivos nuevos o modificados en la carpeta del chat durante ese
   turno se guardan como lista en el mensaje del asistente (nombre, ruta relativa, tamaño). La UI los muestra bajo la
   respuesta como tarjetas (nombre, tamaño, Abrir, Mostrar en Finder) con los componentes existentes y clases del
   prototipo; sin CSS nuevo en `styles.css`. Endpoints: servir el archivo (`GET`, solo dentro de
   `~/.orchestos/chats/<id>/`, validando con realpath contra symlinks y `..`) y revelar en Finder si ya hay un
   mecanismo similar en el servidor; si no, solo descarga/abrir en pestaña.
5. Prompt del chat general: puede buscar en la web y escribir documentos en su carpeta; sigue sin tocar proyectos.
6. Tests unitarios: args de Claude según haya o no proyecto (el chat de proyecto no cambia), política de Codex,
   detección de archivos del turno, endpoint que rechaza rutas fuera de la carpeta.

## Qué no tocar
Chat de proyecto y Dev, ejecutores de tareas, `styles.css`/`index.css`. Parseo nuevo de datos externos en el
servidor pasa por `src/boundary` (en la UI, `JSON.parse` con `try`; no importar `src/boundary` desde `app/src`).
Todo spawn nuevo pasa por `spawnTree`. No commitear.

## Verificación
`bunx tsc --noEmit`, `bunx tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bunx biome check` de lo tocado,
`bun test src/dashboard src/run/executors`, `bun run build:app`. El cerebro verifica en vivo con los CLI reales.

## Añadido tras USO.10 (visto en vivo)
El chat general muestra "Orchestrator unassigned. Choose an agent or assign one in Model routing." aunque el
composer ya tiene modelo elegido: ya no lee la config del proyecto de arranque y `~/.orchestos/config.yaml` no
asigna orquestador. Un chat general usa el agente/modelo del composer (o el agente por defecto de
`/api/chat/default-agent`). **Carlos 2026-11-13: la fila entera desaparece** ("Orchestrator unassigned…" y el
enlace "Model routing") en Chat y en Dev: texto que no aporta. Si no hay ningún agente utilizable, el envío lo dice
al fallar, no una fila permanente.
