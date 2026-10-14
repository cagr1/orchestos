# AT.21 — Shell de solo lectura para todo CLI de chat

Decisión de Carlos 2026-10-14 (AT.19 (b)): el chat puede verificar (git log/diff/status…) en vez de deducir, y
**para todos los LLM, no solo Claude**. Se construye sobre el servidor MCP de AT.20 (`src/mcp/server.ts`) y el
adaptador MCP del registro: misma herramienta, misma frontera, para cualquier CLI de chat.

## Diseño (decidido)
- Herramienta `run_readonly` con argumentos `{ argv: string[] }` (programa + argumentos; **sin shell**, sin
  `sh -c`, sin pipes ni redirecciones). La frontera la hace cumplir el servidor, no el prompt.
- Lista de permitidos: `git` con subcomandos `log`, `show`, `diff`, `status`, `blame`, `ls-files`, `grep`,
  `rev-parse`, `branch` (solo listar); `ls`; `rg`. Todo lo demás se rechaza con un mensaje claro.
- Endurecimiento de git (escribir test por cada uno): rechazar `--output`, `-o` en diff/log, `-O`/
  `--open-files-in-pager`, `--ext-diff`, `--exec`, `-c`, `--git-dir`, `--work-tree`, `-C`; añadir siempre
  `--no-pager`, `-c core.pager=cat`, `--no-ext-diff` y `--no-textconv` donde aplique; env con `GIT_CONFIG_NOSYSTEM=1`,
  `GIT_TERMINAL_PROMPT=0`, `GIT_PAGER=cat`. `branch` solo sin argumentos o con `--list`/`-a`/`-r`.
- Rutas: cwd = raíz del proyecto; todo argumento que sea ruta se resuelve (con `realpath`) y debe quedar dentro del
  proyecto. Timeout 20 s, salida recortada a 64 KB con aviso de recorte.
- Tests del proyecto: NO entran (ejecutan código del proyecto: no son de solo lectura).
- Cada CLI de chat recibe la herramienta por su adaptador (Claude: `--allowedTools mcp__orchestos__run_readonly`;
  Codex: mismo servidor por `-c mcp_servers…`). El prompt del chat nombra las herramientas reales que el adaptador
  ofrece (AT.13 punto 1: el texto se deriva de las herramientas reales, no de una frase fija).
- La llamada se ve en el hilo como cualquier otra herramienta (fila "Running …"), con el comando.

## Qué NO se toca
El sandbox read-only nativo de Codex se queda (es una frontera técnica más). Ejecutor de tareas, `harness.ts`.
Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado del cerebro.

## Verificación
- `bun run typecheck`, `bun run lint`, `bun run test:coverage`.
- Tests negativos del servidor: cada flag peligroso rechazado; ruta fuera del proyecto (incluido symlink) rechazada;
  programa fuera de la lista rechazado; `sh -c` imposible por diseño.
- En vivo (el cerebro lo vuelve a correr): en el chat de un proyecto, con Claude y con Codex, "¿cuál es el último
  commit?" → el hilo muestra la llamada a `run_readonly` con `git log -1` y la respuesta cita el SHA real.
