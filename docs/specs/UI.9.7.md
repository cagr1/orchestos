# UI.9.7 — los cuatro bugs que impiden probar el producto

Reportados por Carlos el 2026-09-18 usando el dashboard real. Los cinco son arreglos
acotados: cuatro de front, uno con una línea de backend. **Ninguno inventa superficie nueva**
— tres restauran o corrigen algo que ya existe en el repo, uno cablea un flag que el ejecutor
de tareas ya usa y el último borra una pantalla duplicada.

Fuera de alcance, con ítem propio: picker de modelo para Codex (no hay catálogo verificado),
menú de tres puntos por proyecto + `Delete project` (necesita endpoint nuevo), migración de la
pantalla `chat`.

## 1. El botón "+ Add project" volvió a existir (REGRESIÓN)

`UI.9.4` lo implementó en `d388392` y **`UI.9.1` (`4e8578e`) lo borró** al reescribir el
sidebar. El backend, el i18n y el CSS siguen vivos y sin consumidor:

- `POST /api/projects/choose` → `src/dashboard/server.ts:280`
- handler con `osascript … choose folder` → `src/dashboard/handlers/projects.ts:41-43`
- `nav.project.add` / `nav.project.add.error` → `src/dashboard/public/i18n.js:18-19,921-922`
- `.sidebar-project-add` (incluye `[data-disabled]` y `[data-tip]`) → `src/dashboard/public/styles.css:708-730`

**Qué hacer:** recuperar de `git show d388392 -- src/dashboard/public-src/islands/shell/Sidebar.tsx`
el `chooseProject()`, el estado `isChoosingProject` y el `NavButton` con
`className="sidebar-project-add"`, y montarlo en la cabecera de la sección Projects
(`Sidebar.tsx:215-218`, el `div.sidebar-section-label` que hoy solo dice "Projects").
No reescribir la función: el original ya maneja `cancelled`, error con `pushToast` y
recarga con `loadProjects()`. Confirmar que `pushToast` se vuelve a importar.

**Por qué importa más que el botón:** un ítem cerrado con evidencia en vivo fue borrado por
otro ítem y nadie lo notó en 3 días. El gate del punto 5 tiene que cubrir esto, no solo que
el botón aparezca.

## 2. El icono de Codex sale del catálogo equivocado

`agentIconFor()` (`src/dashboard/public/data.js:126-129`) resuelve el alias contra `ICON`,
no contra `AGENT_ICONS`:

```
agentIconFor('codex') → AGENT_ICONS['codex']         (no existe)
                      → ICON[ALIASES['codex']]
                      → ICON.openai  ← data.js:57, trazo aproximado
```

La barra de uso no pasa por ahí: usa `window.OrchestOS.icons`, que es
`{ ...ICON, ...AGENT_ICONS }` (`src/dashboard/public/app.js:3357`), y ahí
`AGENT_ICONS.openai` (`data.js:104`, la marca real) **pisa** a `ICON.openai`. De ahí que el
mismo CLI se vea distinto en dos lugares de la misma pantalla.

**Qué hacer:** en `agentIconFor()`, resolver el alias primero contra `AGENT_ICONS` y recién
después contra `ICON`:

```js
const aliased = AGENT_ICON_ALIASES[key]
return AGENT_ICONS[key] || AGENT_ICONS[aliased] || ICON[aliased] || ICON.spark
```

`api`→`globe` y `local`→`term` no están en `AGENT_ICONS`, así que siguen cayendo a `ICON`
igual que hoy — verificar que no cambian.

**No** borrar `ICON.openai`: hay que comprobar por grep si alguien más lo usa antes de
tocarlo; si nadie lo usa, decirlo en el commit y dejarlo para `UI.5`.

## 3. El panel del composer, para Codex, es texto muerto

En `buildChatModelFx()` (`src/dashboard/public/app.js:2868` en adelante):

- `modelHiddenAgent` (`:2874`) es verdadero para todo lo que no sea `api`/`claude`, así que
  la fila "Model" se renderiza como `<div>` no clickeable con
  `chat.modelfx.modelDecidedBy` → "Decided by Codex · your subscription" (`:2955-2961`).
- La fila "Agent" (`:2975-2978`) es otro `<div>` estático que repite el mismo `agentLabel`.
- El trigger cerrado muestra `agentLabel` cuando `modelHiddenAgent` (`:2943`), o sea
  "Codex · your subscription" en la barra, sin abrir nada.

Resultado: tres repeticiones del mismo dato y cero controles.

**Qué hacer:**

- Borrar la rama `<div>` de "Model" cuando `modelHiddenAgent`: si no hay modelo para elegir,
  **no se muestra la fila**. Nada de una fila informativa que parece un control.
- Borrar la fila "Agent" del panel root. El CLI ya es etiqueta fija de la sesión (decisión de
  `ERP.1`, `PLAN.md:120-140`); repetirla dentro del panel de modelo/esfuerzo es ruido.
  Si queda una key i18n sin uso (`chat.modelfx.agent`, `chat.modelfx.modelDecidedBy`),
  borrarla también en ambos idiomas — no dejar keys huérfanas.
- `triggerBase` (`:2943`): cuando no hay modelo elegible, el trigger muestra **solo el
  esfuerzo** (que tras el punto 4 sí existe para Codex). No mostrar `agentLabel` ahí.
- Si tras esto el panel root de Codex quedara con una sola fila (Effort), está bien: un panel
  con un control real es mejor que uno con tres textos.

Revisar de paso si el patrón se repite para `opencode` y `local` — son el mismo
`modelHiddenAgent`. Aplicar el mismo criterio; no dejar el arreglo solo en Codex
(un solo call site deja el bug vivo).

## 4. El esfuerzo de Codex existe en el ejecutor y no llega al chat

`CLI_EFFORT_LEVELS.codex = ['minimal','low','medium','high','xhigh']` ya está declarado
(`data.js:277-280`) y el ejecutor de tareas ya lo aplica: `buildCodexArgs()` empuja
`-c model_reasoning_effort=<nivel>` (`src/run/executors/codex.ts:112`). El chat no:

- `chatEffortLevelsForAgent()` (`src/dashboard/handlers/chat.ts:91-95`) devuelve `[]` para
  `codex`, así que `chat.ts:773` rechaza con 400 cualquier `effort` enviado.
- `runCodexChat()` (`src/run/executors/codex.ts:252-258`) no tiene parámetro de esfuerzo y
  `buildCodexChatArgs(prompt, codexModel)` (`:276`) no lo pasa.
- `chat.ts:1140` solo calcula `cliEffort` para Claude.
- En el front, `effortAvailable` (`app.js:2939-2940`) es
  `useClaudeCli || (isApiAgent && …)` — nunca verdadero para Codex.

El comentario de `codex.ts:243-245` dice que el chat no tiene "flag verificado". **Verificarlo
es parte de este ítem**, no un motivo para dejarlo: es el mismo binario y el mismo `-c` que el
ejecutor de tareas ya usa en producción.

**Qué hacer:**

1. `buildCodexChatArgs(prompt, model, cliEffort)` empuja `-c model_reasoning_effort=<nivel>`
   igual que `buildCodexArgs`.
2. `runCodexChat(cwd, systemPrompt, userMessage, timeoutMs, model, cliEffort)`.
3. `chatEffortLevelsForAgent('codex')` devuelve los 5 niveles. **Importar la lista, no
   duplicarla** — hoy vive en `data.js` (browser) y el contrato tiene que ser uno solo;
   si no hay un módulo compartido, dejar la constante en TS y que `data.js` la consuma, o
   como mínimo un test que falle si las dos listas divergen.
4. `chat.ts:1140`: `cliEffort` también cuando `useCodexCli`.
5. `effortAvailable` en `app.js` pasa a ser `effortLevels.length > 0 && (useClaudeCli ||
   useCodexCli || (isApiAgent && modelSupportsReasoning(...)))` — o mejor, derivarlo de
   `effortLevels` a secas y que el contrato viva en un solo lado.
6. `applyChatSessionControls()` (`app.js:2849-2856`) ya normaliza el nivel contra
   `chatEffortLevels(agent)`: confirmar que para Codex cae en `medium` (está en la lista) y
   no en `minimal`.
7. La etiqueta del turno (`resultLabel`, `chat.ts:1374` para Claude) debe incluir el esfuerzo
   real también para Codex, con el mismo formato.

**Riesgo declarado:** si `codex exec` rechaza `-c model_reasoning_effort` con el modelo default
de la máquina, el punto 4 se revierte entero y el ítem se cierra con los puntos 1-3 y el error
exacto anotado. **No** dejar el selector visible si el flag no llega al binario — eso sería
exactamente el "botón que no hace nada" de la Regla cero.

## 5. Muere `Activity`: es la misma pantalla que `runs`, dos veces

**Decisión de Carlos, 2026-09-18:** *"quitar Activity, no runs, porque es lo mismo — ¿cuál es
el objetivo de tener 2 ventanas iguales?"*. Esto resuelve la pregunta que `PLAN.md:1888-1889`
dejó abierta ("a revisar si `Activity` debe ser una vista distinta, cruzando proyectos"): no.
Se borra.

No es una duplicación aproximada, es literal:

```js
// src/dashboard/public/screens-ops.js:2381-2388
SCREENS.activity = {
  render(st) { return SCREENS.runs.render(st) },
  wire(root, st) { return SCREENS.runs.wire(root, st) },
}
```

Ni siquiera filtra por proyecto, así que el argumento de "Activity es la vista global" tampoco
se sostiene en el código. Y `runs` ya vive como tab del workspace
(`screens-ops.js:8`, `['tasks','runs','graph',…]`).

**Qué hacer:**

1. Borrar `SCREENS.activity` (`screens-ops.js:2381-2388`).
2. Borrar la entrada `{ id: 'activity', … }` de `NAV` (`app.js:146`).
3. `Sidebar.tsx`: borrar `const activity = nav.find(…)` (`:53`) y el `<NavIcon>` que lo
   renderiza en modo Dev (`:212-214`).
4. `App.go()` (`app.js:831`): la condición `id === 'activity' || id === 'workspace'` queda
   solo con `'workspace'`.
5. **El fallback sin proyectos** (`app.js:757-758`, `else { this.go('activity') }`) es el punto
   delicado: hoy, con 0 proyectos, Dev caía en Activity. Sin Activity tiene que mostrar un
   **estado vacío de Dev** que apunte al botón del punto 1 ("No projects yet — Add project"),
   reusando `emptyState()` (`data.js:288`). No dejar `state.screen` en `'workspace'` sin
   `workspaceProjectId`: eso rompe el render.
6. Borrar las keys i18n `nav.activity` en ambos idiomas (`i18n.js:12,915`) si no quedan otros
   consumidores — verificar por grep antes.
7. Grep final de `'activity'` en `src/dashboard/` (incluido `localStorage`
   `orchestos-last-dev` y cualquier gate de `scripts/ui-gates/`): no puede quedar ninguna
   referencia viva. Los gates que naveguen a Activity hay que actualizarlos, no borrarlos.

**No tocar `SCREENS.runs`** ni la tab `runs` del workspace: esa es la que se queda.

## Cómo se verifica

1. `bunx tsc --noEmit` limpio.
2. `bun run test:coverage` (comando exacto de CI, no `bun test`) verde.
3. Test nuevo: `runCodexChat` con esfuerzo produce args que incluyen
   `-c model_reasoning_effort=high`; sin esfuerzo, no incluyen el flag.
4. Test nuevo: `POST /api/chat` con `session.agent='codex'` y `effort:'high'` ya no
   devuelve 400.
5. Test de no-divergencia entre la lista de niveles de `data.js` y la de TS.
6. **Gate en vivo, dashboard real (Playwright), obligatorio** — un solo recorrido:
   - "+ Add project" visible en la cabecera de Projects; click abre el diálogo nativo;
     **cancelarlo no crea proyecto ni deja toast de error**; elegir una carpeta agrega el
     proyecto a la lista sin recargar.
   - Dejar la DB con **≥2 proyectos** al terminar (es el requisito que hoy bloquea el
     entregable rápido, `PLAN.md:51-55`) y no borrarlos al cerrar.
   - El `outerHTML` del icono de Codex en el mini-menú de "Nuevo chat" es **idéntico** al de
     la tarjeta de Codex en la barra de uso inferior. Comparación de markup, no captura.
   - Abrir el panel del composer en una sesión Codex: **no aparece** la fila "Model" ni la
     fila "Agent"; **sí** aparece Effort con los 5 niveles; elegir `high` persiste al
     recargar.
   - Enviar un mensaje real en esa sesión con `effort=high` y confirmar en SQLite que el
     turno guardó `provider=codex` y el esfuerzo aplicado.
   - El riel de Dev **no** muestra "Activity"; la tab `runs` del workspace sigue
     renderizando la tabla de runs sin errores de consola.
   - Con la DB sin proyectos (o simulándolo), Dev muestra el estado vacío con el botón de
     agregar proyecto, no una pantalla rota ni en blanco.
   - Cero errores de consola en todo el recorrido (la trampa de `UI.9.6` fue exactamente esa).
   - Bajar el dashboard al terminar.
7. Evidencia en `docs/done/evidence/UI.9.7-live.json` con esos puntos como campos, cada uno
   con lo observado — no `true`/`false` sueltos. Si algo no se pudo observar, se dice cuál y
   por qué, y el ítem queda abierto (precedente: `UI.9.5` cerró con "Open in Workspace" no
   observable y eso se documentó).

## Evidencia de cierre

`docs/done/evidence/UI.9.7-live.json` + entrada en `docs/done/sprint-30.md`.
Marcar `[x]` con fecha en `PLAN.md` en el mismo turno del cierre.
Borrar este spec en el commit de cierre.
