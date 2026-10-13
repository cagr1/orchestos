# ERP.4.10 — el borrador de tarea lee el hilo y declara la clase de la tarea

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`/`NEXT.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.10 --agent claude --scope "src/**,scripts/ui-gate/**,NEXT.md,PLAN.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques. Prohibido `prettier`, `git stash`, `git commit`, `git checkout` de archivos.
NO corras `bun run test:coverage` ni te detengas por el baseline: lo corre el cerebro.

## Síntomas (piloto ERP.4, `docs/done/evidence/ERP.4/piloto-2026-10-12.md`)
- Hallazgo 2: el usuario pide algo, el orquestador responde nombrando los archivos, y el seguimiento "crea la tarea
  tal como la describiste" termina en "⚠ No task created: the draft named no output files."
- Hallazgo 16: `runs.task_class` de siete tareas pedidas como "Crear …" = `review`, `review`, `review`, `implement`,
  `implement`, `fix`, `fix`.

## Causas (leídas en el código)
1. `settleTaskIntent` llama `buildNaturalDraft(message, root)` (`src/dashboard/handlers/chat.ts:1128`) con solo el
   mensaje actual. En ese punto ya existen `history` (últimos 10 turnos de la sesión, `chat.ts:1111`) y `text` (la
   respuesta del orquestador de este turno, sin el marcador, `chat.ts:1124`).
2. `buildNaturalDraft` (`src/dashboard/handlers/project.ts:206-286`) manda al LLM un único mensaje `user` con `input`,
   y el respaldo `extractMentionedPaths(input, root)` (`project.ts:260`) solo mira ese mismo texto.
3. `classifyTask(t.description)` (`src/run/harness.ts:242`, `src/router/classify.ts:15-31`) decide por palabras
   sueltas de la descripción generada (`error`, `check`, `falla`, `doc`…), no por lo que se pidió.

## Comportamiento exigido
- `buildNaturalDraft(input, root, context?)` con `context?: { history?: { role: string; content: string }[];
  assistantReply?: string }`. Sin `context` se comporta como hoy (lo usa `handleApiNatural`, `project.ts:299`).
- Con `context`, el LLM recibe los turnos previos y la respuesta del orquestador de este turno, y el prompt de sistema
  dice que la tarea a definir es **la que el orquestador acaba de anunciar en su última respuesta**, completando lo
  que el mensaje actual no repite (archivos, alcance) con los turnos previos. Acotar: como mucho los últimos 6 turnos
  y 4 000 caracteres por turno (recortar el resto). No inventar archivos que nadie nombró.
- El respaldo de rutas, cuando `output` viene vacío, busca también en `assistantReply` y luego en los turnos previos
  del más reciente al más antiguo; se queda con el primer texto que nombre rutas. Ojo: `extractMentionedPaths` solo
  devuelve rutas que **existen** (`realpathSync`); no cambies esa regla.
- `chat.ts:1128` pasa `{ history, assistantReply: text }`.
- Clase de tarea: el JSON del borrador trae una clave nueva `"task_class"` con uno de `plan|implement|fix|review|doc`,
  definida en el prompt por la **intención del pedido** (crear/añadir/cambiar código = `implement`; corregir un defecto
  existente = `fix`; solo revisar sin escribir = `review`; solo documentación = `doc`; solo planificar = `plan`).
  Valor inválido o ausente → no se guarda nada. `NaturalDraft` gana `taskClass?: TaskClass`.
- `tasks.yaml`: campo opcional `task_class` en el esquema (`src/tasks/schema.ts`, validado contra los 5 valores; valor
  desconocido = error de validación, como `engine`). `createTaskRecord` (`src/dashboard/handlers/tasks.ts:207-300`)
  acepta `task_class` y lo escribe si es válido. `chat.ts` se lo pasa desde el borrador.
- `harness.ts:242`: `ctx.taskClass = t.task_class ?? classifyTask(t.description)`. `classifyTask` no se toca: sigue
  siendo el respaldo de tareas sin clase declarada (las creadas a mano o antiguas).
- Busca los hermanos: `grep -rn "classifyTask(" src` y aplica la misma preferencia donde se clasifique una **tarea**
  de `tasks.yaml` (no donde se clasifique texto libre de un eval o del chat). Di en el reporte cuáles tocaste y cuáles no.

## Tests
- `buildNaturalDraft` con proveedor falso (mira cómo lo inyectan los tests existentes del borrador; si no hay costura,
  extrae a funciones puras exportadas la construcción de mensajes y el respaldo de rutas, y testea esas):
  - seguimiento sin rutas + `assistantReply` que nombra `src/a.ts` (existente en el fixture) → `output` lo incluye;
  - sin `context` → mismos mensajes que hoy;
  - `task_class` válido se devuelve; inválido → `undefined`.
- Esquema: `task_class: 'implement'` valida; `task_class: 'otro'` da error.
- Harness o función pura equivalente: tarea con `task_class: 'implement'` y descripción "Crear el check de errores"
  → clase `implement` (con la lógica vieja daría `fix`). Compruébalo contra la lógica vieja y dilo en el reporte.

## Gate en vivo (lo escribes tú, lo corre el cerebro)
Flujo nuevo `scripts/ui-gate/flows/chat-followup-task.mjs`, copiando el andamiaje de
`scripts/ui-gate/flows/auto-flow.mjs` (proyecto temporal, chat real con el orquestador, navegador real):
1. Mensaje 1: pide un plan sin ejecutar, p. ej. "Quiero un archivo `notas/seguimiento.md` con una sola línea: hola.
   Todavía no crees la tarea; dime solo qué harías." → pasa si la respuesta **no** contiene "Started task" ni
   "Created task".
2. Mensaje 2: "Crea la tarea tal como la describiste." (sin nombrar el archivo) → pasa si la respuesta contiene
   "▶ Started task" o "⏸ Created task", y **no** contiene "No task created".
3. La tarea existe en `tasks.yaml` del proyecto con `notas/seguimiento.md` en `output` y `task_class: implement`.
4. La tarea termina `done` y el archivo existe.
Sin pasos `true` literales (el linter de flujos lo impide); cada paso con su `note` de diagnóstico. No lo añadas a la
lista del pre-push.

## No tocar
`classifyTask` (su cuerpo), el formato del marcador `[[orchestos:task]]`, el frontend, `styles.css`, el campo
`executor` del borrador (es ERP.4.11), `PLAN.md`.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test <los archivos de test que tocaste>` · `node --check
scripts/ui-gate/flows/chat-followup-task.mjs`.
