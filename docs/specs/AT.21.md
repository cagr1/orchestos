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

## Ronda 2 (cerebro, 2026-10-17) — dos agujeros de ejecución de código, medidos con git 2.50.1
La revisión del cerebro ejecutó código de proyecto a través de `planReadonly` (las 5 entradas dieron "PASA"):
- `["git","grep","-iOsh","PWNED"]` → git agrupa opciones cortas en los subcomandos con parse-options (grep, blame,
  status, ls-files, branch, rev-parse); `-O` con valor pegado `sh` ejecutó `sh a.sh` (archivo creado en `/tmp`).
- `["git","grep","--open-files=sh","x"]`, `--open=sh` → git acepta **abreviaturas** de opciones largas en esos
  subcomandos; `matchesFlag` solo compara el nombre exacto. Ejecutó `sh a.sh`. `git log --outp=…` y
  `git status --porc` también pasan el plan (diff/log rechazan la abreviatura en el binario, pero no hay que depender
  de eso).

Corregir:
1. **Abreviaturas**: añadir `GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS=1` al env de git (medido: `fatal: disallowed
   abbreviated or ambiguous option 'open-files'`, sin ejecutar nada). Además, en el plan, rechazar todo nombre largo
   que sea prefijo estricto de un flag denegado (defensa propia, no solo del binario).
2. **Opciones cortas agrupadas**: en todo token de un solo guion de git, examinar cada letra como hace parse-options:
   rechazar si contiene `O` (en cualquier subcomando) o `o` en diff/log/show; y si contiene una letra de flag con ruta
   (`f` en grep, `X` en ls-files, `S` en blame) con el valor pegado, validar ese valor como ruta. Lo más simple y
   seguro: rechazar en git todo token corto agrupado (más de una letra tras `-`) que contenga una de esas letras.
3. **Tests**, uno por caso, con las 5 entradas exactas de arriba más `-Osh`, `-iO`, `--open-files-in-pager=sh`, y uno
   de integración que ejecute `runReadonly` con `git grep -iOsh` en un repo temporal y compruebe que el archivo
   centinela NO se crea.
4. Revisar con la misma lógica `rg` (sin abreviaturas en ripgrep 14: confirmarlo con el binario embebido que ya usaste)
   y `ls` (BSD `ls` no ejecuta nada; confirmar).

Verificación: typecheck, `bun run lint` (0 errores), `test:coverage`, `bun run ui:gate chat-readonly-shell`.

## Ronda 3 (cerebro, 2026-10-17) — hallazgos de la revisión adversarial `qa` (reproducidos con salida cruda)
Modelo de amenaza: el chat no escribe, pero un ejecutor de tareas (workspace-write) o el usuario pueden dejar
`.git/config`/`.gitattributes` hostiles; `run_readonly` no debe ejecutar nada de ahí.
1. **Config del repo que ejecuta programas.** `filter.<x>.clean` (vía `.gitattributes`) se ejecutó con `git diff` y
   `git blame a.txt`; `log.showSignature=true` + `gpg.program=<script>` se ejecutó con `git log -1` y `git show`.
   Corregir así (genérico, no por nombre fijo): antes de cada llamada, listar la config efectiva con
   `git config --list --includes --name-only` (mismo env endurecido; solo lee) y, por cada clave cuyo nombre sea de
   ejecución, pasar un `-c <clave>=` de neutralización: `filter.*.clean|smudge|process` → vacío (y
   `filter.*.required=false`), `diff.*.textconv|command` → vacío, `gpg.program`, `gpg.*.program` → `false`
   (binario que no hace nada) , `core.pager`, `pager.*` → `cat`, `core.fsmonitor=false`, `core.sshCommand`,
   `credential.helper` → vacío, `core.hooksPath=/dev/null`. Además siempre: `-c log.showSignature=false`,
   `--no-show-signature` en log/show, `GIT_CONFIG_GLOBAL=/dev/null` NO (rompe la identidad de lectura; no hace falta).
   Si alguna clave no admite valor vacío, usar la variante que la desactiva; medir cada una con git 2.50.1.
   Tests de integración (repo temporal, centinela que NO debe crearse) para: filtro clean en diff y blame;
   gpg verifier con `log -1` y `show --no-patch HEAD`; `diff.<x>.textconv` con `--textconv` ya prohibido y sin él;
   `core.pager` hostil; `include.path` que trae un `filter.*.clean`.
2. **Timeout que no corta hijos.** `runReadonly(["git","diff"], root, 100)` tardó 2106 ms. Al vencer: matar el
   proceso y su grupo si Bun lo permite (`detached`/`process.kill(-pid)`), y en todo caso cancelar los lectores de
   stdout/stderr y resolver de inmediato con `[timed out after Ns]`. Test: un hijo que duerme 5 s con streams
   abiertos → la llamada vuelve en < 1 s con timeout de 100 ms.
3. Menor: `git log --text` se rechaza por ser prefijo de `--textconv`; permitir nombres exactos que sean opciones
   reales (lista corta de excepciones: `--text`), con test.

Verificación: typecheck, `bun run lint` (0 errores), `test:coverage`, `bun run ui:gate chat-readonly-shell`.
