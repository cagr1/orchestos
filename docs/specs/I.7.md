# I.7 — Gate: la puerta manual no existe y el flujo automático se ve (spec para Luna)

Ítem: PLAN.md § I.7. Tipo 🔍: se entrega **un flujo de ui-gate** que mide; no se arregla producto aquí.
Si un paso falla porque el producto falla, el flujo debe fallar con detalle honesto — **prohibido** aflojar
un assert, saltar un paso o cambiar código de `src/` para que pase. El cerebro decide qué hacer con el fallo.

## Qué crear

Un solo archivo nuevo: `scripts/ui-gate/flows/auto-flow.mjs`. No tocar `src/`, `run.mjs`, `lib.mjs`, otros
flujos ni `scripts/pre-push.sh` (este flujo NO entra al pre-push: hace corridas reales de dos CLIs).

Copiar el patrón de fixture de `scripts/ui-gate/flows/chat-turn-details.mjs:64-130` (proyecto git temporal,
`cli.ts init`, `writeGateRoles`, `task init`, commit, registro en `/api/projects`, `cleanup` con purge + rm).
Toda llamada `api()` a rutas con scope manda `x-orchestos-project-id` (regla de ERP.2). Navegación solo por
clics (`run.mjs` rechaza `window.state`/`location`).

Antes del commit del fixture, escribir en `orchestos.config.yaml` del proyecto temporal (después de
`writeGateRoles`, mismo merge YAML que hace ese helper):

```yaml
taskAgentRules:
  - { match: { output: ["claude-*.md"] }, agent: claude }
  - { match: { output: ["codex-*.md"] }, agent: codex }
```

## Pasos (cada uno es un `step`, con `shot` en los puntos marcados)

1. **Sin puerta manual** (I.1). En Chat, Dev y Settings → pestañas Tasks y Plan del proyecto:
   - 0 `textarea`/`input` dentro de un formulario de alta de tarea y 0 botones con texto que contenga
     `Append to tasks.yaml`, `Create task`, `New task` (case-insensitive) visibles.
   - Los botones `Add task` (Plan) y `Create First Task` (Tasks vacía) existen hoy: hacer clic en cada uno
     que esté visible y afirmar que lo único que pasa es que se muestra el composer del Chat
     (`textarea` del composer visible) y que no aparece ningún `dialog`. `shot('no-manual-door')`.
2. **Mensaje que no es tarea no dispara nada** (I.2). Nuevo chat con Codex (igual que `chat-turn-details`).
   Enviar `¿Qué es un DAG? Responde en una frase, sin crear ni modificar archivos.` Esperar la respuesta
   (`div.prose`, hasta 180 s). Afirmar: `/api/tasks` tiene el mismo conjunto de ids que antes del mensaje,
   no hay texto `Task ready to run` ni botón `Approve & Run`, y el árbol git del proyecto sigue limpio.
3. **Mensaje que es tarea → confirma → ejecuta → reporta inline** (I.2, I.4). Enviar
   `Crea el archivo claude-nota.md con una sola línea: "nota de claude".`
   - Si aparece tarjeta `Task ready to run`, pulsar `Approve & Run`; si la tarea arrancó sola (archivo nuevo
     → `chat.ts:1100-1104` la lanza sin retener), seguir. Registrar en el detalle cuál de los dos ocurrió.
   - Esperar hasta 10 min a que la tarea salga de `pending`/`running` (patrón `waitForTaskFinished` de
     `tasks.mjs:20-45`).
   - **Inline**: sin salir de Chat, el texto de `main` (respuestas del modelo **incluidas**: el aviso
     `▶ Started task <id>` de `chat.ts:1119` se añade a la respuesta) contiene el id de la tarea **y** su
     estado final (`finished.status`, palabra completa, case-insensitive). No exigir `runs.result` literal en
     la UI. Detalle: `task id visible=<bool>; final status "<status>" visible=<bool>`. No crear UI nueva si
     falla. `shot('task-inline-report')`.
   - **Ronda 2 (corrección del cerebro):** la r1 excluía `div.prose` y exigía `runs.result` literal en la UI
     (`auto-flow.mjs:326-348`). Reemplazar ese bloque por lo de arriba; el resto del archivo se queda igual.
   - **Persistencia**: con `bun -e` sobre la DB (patrón `chat-roles.mjs:130-140`) afirmar: hay filas en
     `chat_messages` de la sesión con el mensaje del usuario y la respuesta; y la fila de `runs` con
     `task_id` = id de la tarea tiene `result` no vacío. Detalle: `status`, `provider`, `model`,
     longitud de `result`.
4. **Dos tareas del mismo DAG con agentes distintos** (I.3). En el mismo chat enviar
   `Crea el archivo codex-nota.md con una sola línea: "nota de codex".` y repetir aprobar/esperar.
   Afirmar desde `tasks.yaml` y `runs`: la tarea de `claude-nota.md` tiene `engine: external` y su run
   `provider`/`model` de Claude; la de `codex-nota.md` tiene `engine: codex` y su run `provider`/`model` de
   Codex; ambos pares son distintos entre sí y ninguno está vacío. Detalle con los cuatro valores crudos.
   Si la tarea Claude falló, el detalle incluye `status` y `result`/`retry_reason` crudos.
5. **Ningún texto de implementación visible** (I.5). Sobre el texto visible de Chat al final **excluyendo
   las respuestas del modelo** (`div.prose`; el texto libre del modelo no es UI): ausentes
   `[[orchestos:task]]`, `tasks.yaml`, `engine:`, `executor_model`, `Error:` seguido de ruta `src/`, y
   cualquier ruta absoluta del proyecto temporal. El marcador `[[orchestos:task]]` sí se busca también dentro
   de `div.prose`. `shot('final-chat')`.

## Verificación que debe correr Luna antes de reportar

- `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`
- `bunx biome check scripts/ui-gate/flows/auto-flow.mjs`
- `node --check scripts/ui-gate/flows/auto-flow.mjs`
- `bun test` completo (su sandbox falla siempre `adversarial-review` ×2 y `csrf-origin`: reportarlos como
  conocidos, no detenerse por ellos).

Luna **no** puede correr `ui:gate` en su sandbox: el cerebro lo corre fuera. Reportar el diff completo.

## Ronda 3 (corrección del cerebro, tras gate en vivo r2)
FAIL `locator.click: getByRole('button', { name: 'Chat' })` tras inspeccionar Settings: en Settings no hay
botón `Chat`; la salida visible es el botón `Back to app` (captura `no-manual-door.png`). Antes del
`page.getByRole('button', { name: 'Chat', exact: true }).click()` que sigue a `inspectManualDoor(... 'Settings')`,
pulsar `Back to app` y esperar que `Chat` sea visible. Nada más cambia.

## Ronda 4 (tras gate en vivo r3)
FAIL `page.waitForResponse` 180 s en el primer mensaje: nunca salió el POST `/api/chat` (dashboard.log sin
peticiones). Causa: tras `Start Chat` no se elige modelo/esfuerzo. En `startChat`, después de `Start Chat`,
copiar literal el bloque de `chat-turn-details.mjs:135-161` (modelControl visible → gpt-6-luna → medium →
cerrar popover, con sus `step`). Además, en `sendMessage`, envolver la espera del POST para que si vence haga
`shot('send-timeout')` y falle con un `step` (`chat request sent`, false, texto visible del composer) en vez
de lanzar excepción. Nada más cambia.

## Ronda 5 (tras gate en vivo r4)
La vista Chat no tiene `<main>` (solo Settings/Dev, `grep -rn "<main" src/dashboard/app/src`): los tres
`page.locator('main').innerText()` devuelven `''`, así que el reporte inline dio id no visible (la captura sí lo
muestra) y el paso 5 pasó en vacío. Reemplazar los tres por `page.locator('body').innerText()`, y en el paso 5
afirmar además que el texto leído no está vacío (`chatText.trim().length > 0` dentro de la condición). Nada más.
