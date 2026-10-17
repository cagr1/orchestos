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

## Ajustes del cerebro (2026-10-17, tras cerrar AT.20 en `38993ec`)
1. **Oferta por herramienta, no por servidor.** Hoy el servidor solo se pasa cuando `taskToolOffered`
   (`chat.ts`, `buildAutoTaskInstruction`/`taskToolOffered`). `run_readonly` se ofrece siempre que el chat tenga
   proyecto (también en modo `chat`); `create_task` sigue con su condición. El servidor recibe qué herramientas
   exponer y la raíz del proyecto por argumentos (p. ej. `--tools create_task,run_readonly --root <abs>`; hoy existe
   `--no-tasks`, sustituirlo) y `tools/list` solo lista esas. Los adaptadores (`src/mcp/adapters.ts`) reciben la
   lista: Claude `--allowedTools` con cada `mcp__orchestos__<tool>`; Codex app-server `config` del hilo; `codex exec`
   por `-c`.
2. **Codex app-server**: la regla de AT.20 "si el hilo se abrió sin la herramienta, hilo nuevo con transcripción"
   pasa a comparar el conjunto de herramientas (y la raíz) con el del hilo, no un booleano.
3. **API (OpenRouter)**: `run_readonly` también como herramienta nativa en `runToolLoop`, misma función de
   validación y ejecución que el servidor MCP (capa común en `src/mcp/`, sin duplicar). Ollama sin herramientas: nada.
4. **Endurecimiento extra de `rg`** (además de lo de arriba; test por cada uno): rechazar `--pre`, `--pre-glob`,
   `-z`/`--search-zip` (ejecutan programas), `--hostname-bin` (ejecuta un binario), `-L`/`--follow` (sale del
   proyecto por symlinks) y `--ignore-file`/`--ignore-file-case-insensitive` con ruta fuera; env sin
   `RIPGREP_CONFIG_PATH`. `ls`: sin flags de escritura posibles; rutas dentro del proyecto. `git`: además de la lista,
   rechazar `--paginate`/`-p` global y `--textconv`; `blame --contents <ruta>` y cualquier ruta tras `--` se validan.
   Comprobar con `rg --help` y `git help <sub>` del binario instalado si hay otro flag que ejecute programas o escriba
   archivos, y cubrirlo; listar en el reporte lo revisado.
5. **Prompt**: el texto de herramientas de `buildChatSystemPrompt` (`toolText`) se deriva de las herramientas reales
   ofrecidas en ese turno (incluida `run_readonly`), no de frases fijas por agente.
6. **Lint**: `bun run lint` con 0 errores (biome revisa también `.mjs`).
7. **Gate en vivo**: añadir un flujo o pasos en uno existente (`chat-context` o nuevo `chat-readonly-shell`) que pida
   "¿cuál es el último commit?" con Claude y con Codex y afirme: paso visible con `run_readonly`/`git log`, y SHA real
   (`git rev-parse --short HEAD` del fixture) en la respuesta. Si es flujo nuevo y usa CLIs reales, decir si entra al
   pre-push (los de chat entran por ruta, ver `scripts/pre-push.sh`).
