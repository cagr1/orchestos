# Diseño — detección de intención de tarea en el Chat (Mes 18, Bloque A.1)

## Punto de partida

`chat-create-task-bar` ([screens-core.js:60](../src/dashboard/public/screens-core.js#L60)) ya
existe desde el Mes 10: aparece cuando `history.length >= 3` y ofrece un botón que pre-llena el
composer de Tasks con el contexto de la conversación. Es una heurística ciega — no mira el
contenido de los mensajes, solo cuenta cuántos hubo. El chat hoy no tiene ninguna tool de lectura
de proyecto (`PLAN.md`/`tasks.yaml`/`IDEAS.md`); solo `FETCH_URL_TOOL` y `SEARCH_MEMORY_TOOL`
([tool-call.ts:285](../src/providers/tool-call.ts#L285),
[tool-call.ts:301](../src/providers/tool-call.ts#L301)), registradas vía `runToolLoop()` en
`handleApiChat` ([chat.ts:334](../src/dashboard/handlers/chat.ts#L334)).

Este documento decide las cuatro cosas que Carlos pidió fijar antes de tocar código (A.1),
para revisión en A.2. B/C no arrancan hasta que A.2 lo apruebe.

## (a) El LLM call clasificador

**No se implementa en A.1 / Bloque B sin evidencia primero.** Regla de seguridad #2 del eje de
mes: "el clasificador no debe alucinar tareas que no existen — gatear en evidencia real de que
la heurística de 3+ mensajes genera falsos negativos frecuentes, no implementarlo porque se
puede." Hoy no existe esa evidencia — nadie ha medido cuántas veces un usuario describe trabajo
ejecutable en el chat y la barra de 3+ mensajes no aparece (falso negativo) o aparece con una
conversación puramente conversacional (falso positivo, menos grave porque el usuario simplemente
la ignora).

**Criterio de evidencia que gatea B.1** (mismo patrón que IDEAS.md #4, clasificador semántico de
`clarify`, también gated y nunca implementado sin datos): instrumentar la barra actual para
registrar, por sesión de chat, si el usuario terminó usando `chat-create-task` o no, y correlacionar
con el contenido del último mensaje del usuario. Si tras uso real aparecen casos donde el usuario
escribió algo accionable ("lee X y ejecuta Y", "corrige el bug en Z") y la barra no ofreció nada
útil porque el heurístico de conteo no había llegado a 3, o el usuario tuvo que reformular porque
la barra no entendía qué archivo target usar — eso es el falso negativo que justifica el LLM call.
**No se instrumenta en A.1**; instrumentar es trabajo de B.1 antes de escribir el clasificador,
no un bloque separado — no vale la pena abrir un bloque solo para telemetría de un botón que ya
existe.

Si la evidencia aparece, la forma del call (decidida ahora para no re-abrir la discusión después):

- **Modelo**: el más barato disponible con tool-calling — mismo modelo por defecto del chat hoy
  (`deepseek/deepseek-v4-flash`) si soporta la clasificación con un prompt de una sola pregunta
  binaria; si no, usar `supportsToolCalling()` para elegir el primer modelo Claude/GPT/Gemini
  disponible en el catálogo del usuario, priorizando el más barato por `model-catalog.ts`. Nunca
  el modelo elegido por el usuario para conversar — la clasificación es un call de servicio, no
  debe heredar el modelo caro que el usuario eligió para razonar.
- **Prompt**: una sola pregunta binaria — "¿el último mensaje del usuario describe trabajo
  ejecutable sobre este repositorio (código, archivos, comandos) o es una pregunta/comentario
  conversacional?" — con el mensaje del usuario como único input, sin el historial completo (para
  mantener el call barato y determinista). Salida: JSON `{ isTask: boolean, reason: string }`,
  parseado con el mismo patrón defensivo que ya usa `needsClarify`/`clarifyReason`
  ([clarify.ts:31](../src/spec/clarify.ts#L31)) — si el parseo falla, `isTask: false` (fail-safe:
  ante duda, no sugerir, la barra de 3+ mensajes sigue como red de respaldo).
- **Costo**: un call adicional por mensaje de usuario enviado al chat (no por conversación) —
  solo si el mensaje aún no disparó la barra de 3+ mensajes (si ya se muestra por conteo, no hace
  falta gastar el call, ver (c)). Costo estimado con el modelo barato: <100 tokens de input,
  <50 de output — despreciable comparado con el costo de la respuesta conversacional misma.

## (b) Tools de lectura a exponer

Cuando B.2 las registre, siguen exactamente el patrón de `FETCH_URL_TOOL`/`SEARCH_MEMORY_TOOL`:
`ToolDef` + executor en `handlers/chat.ts`, sumadas al array `tools: [...]` de
`runToolLoop()` ([chat.ts:337](../src/dashboard/handlers/chat.ts#L337)) y ruteadas por
`createToolRouter()`. Las tres:

```ts
export const READ_PLAN_TOOL: ToolDef = {
  name: 'read_plan',
  description:
    'Reads PLAN.md, the project\'s execution plan (active blocks, done history reference). ' +
    'Use when the user references a plan, block, or "what\'s next" for this project.',
  input_schema: { type: 'object', properties: {} },
}

export const READ_TASKS_TOOL: ToolDef = {
  name: 'read_tasks',
  description:
    'Reads tasks.yaml, the source of truth for executable tasks (id, description, status, ' +
    'dependencies). Use when the user asks about existing tasks or wants to reference one by id.',
  input_schema: { type: 'object', properties: {} },
}

export const READ_IDEAS_TOOL: ToolDef = {
  name: 'read_ideas',
  description:
    'Reads IDEAS.md, the backlog of ideas not yet scheduled into PLAN.md. Use when the user asks ' +
    'about backlog items or unscheduled ideas.',
  input_schema: { type: 'object', properties: {} },
}
```

Los tres ejecutores son lectura pura de archivo (`readFileSync` + el wrapper de "esto es dato
externo" **no aplica aquí** — a diferencia de `fetch_url`, el contenido es del propio repo del
usuario, ya confiable, mismo nivel de confianza que el system prompt). `read_tasks` reusa
`loadTasks(root)` (ya importado en `chat.ts:6`) y serializa a YAML compacto o resumen (decidir en
B.2 si el archivo completo cabe en el budget de contexto — `tasks.yaml` puede crecer; si excede
un umbral, truncar igual que `SEARCH_MEMORY_TOOL` limita resultados, no fallar).

**Explícitamente fuera de alcance de esta pieza de trabajo** (regla de seguridad #3): ninguna tool
de escritura (`write_plan`, `write_tasks`) ni de ejecución (`run_task`, `create_task`). Esas viven,
si acaso, en una pieza de trabajo futura con su propio gate de seguridad — no se mezclan con B.2.

## (c) El punto de control humano — cómo se ve "sugerir" sin cruzar a auto-run

Regla de seguridad #1: nunca auto-run silencioso. La superficie (C.1) es una **extensión de la
barra existente, no un mecanismo nuevo**:

- Hoy: `chat-create-task-bar` aparece por conteo (`history.length >= 3`), siempre con el mismo
  texto genérico (`chat.createTaskHint`).
- Con el clasificador: si `isTask === true` en el LLM call, la barra aparece **inmediatamente**
  (sin esperar a 3+ mensajes) y el hint puede citar la `reason` devuelta por el clasificador en vez
  del texto genérico — pero el botón sigue haciendo exactamente lo mismo que hoy: pre-llenar el
  composer de Tasks y esperar que el usuario revise `description`/`output`/`executor` y confirme
  manualmente. Ningún tool call nuevo dispara `task run` ni `run --graph`.
- La heurística de 3+ mensajes **no se elimina** — sigue como red de respaldo para el caso en que
  el clasificador no corrió (mensaje ya procesado antes de que hubiera evidencia para activar B.1)
  o para conversaciones donde la intención se acumula a lo largo de varios mensajes en vez de
  estar en uno solo.
- Las tools de lectura (`read_plan`/`read_tasks`/`read_ideas`) son ortogonales a la sugerencia:
  el LLM puede usarlas para responder una pregunta conversacional ("¿qué bloque sigue en el Mes
  18?") sin que eso dispare la barra — leer no es lo mismo que detectar intención de tarea nueva.

## (d) Resumen del gate de evidencia

No se abre B.1 (clasificador) hasta que exista un registro concreto (no anecdótico) de falsos
negativos de la heurística de 3+ mensajes, recolectado instrumentando la barra actual como primer
paso de B.1. B.2 (tools de lectura) **no depende de esa evidencia** — es de bajo riesgo (mismo
boundary que `fetch_url`/`search_memory`) y puede implementarse independientemente del
clasificador; de hecho da valor por sí sola (el chat puede responder preguntas sobre el estado del
proyecto sin necesitar la detección de intención). El orden real de trabajo cuando se abra el
Bloque B es: **B.2 primero (bajo riesgo, valor inmediato), B.1 después y solo si aparece
evidencia**.

## Qué NO cambia

- `chat-create-task-bar`, su HTML y el flujo manual de confirmación en Tasks: intactos.
- `runToolLoop()`, `FETCH_URL_TOOL`, `SEARCH_MEMORY_TOOL`, `createToolRouter()`: sin tocar, se
  reusan tal cual.
- Ninguna tool de escritura o de ejecución se introduce en este mes.
