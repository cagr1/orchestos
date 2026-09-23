# Retirados — superados por UI.13 / UI.14

Retirados el 2026-09-22 con GO de Carlos. No se hicieron: la plantilla React de AI Studio (UI.13) y el Dev como
chat-CLI (UI.14) los dejaron sin objeto. Texto original intacto abajo; no reabrir sin decisión nueva de Carlos.
UI.8.6 (permisos visibles) NO se retiró: pasó a la Fase 2 de PLAN.md.


Superados por UI.13 (el prototipo es el frontend) o por UI.14. Carlos decide si se retiran; no se cierran como hechos.

- [ ] **UI.3.5 — 🧠 Sistema visual: que se sienta herramienta, no panel de administración.**
  (EN CURSO, abierto 2026-08-30 — decidido en sesión previa con Opus, retomado y confirmado
  aquí). **Pausa `UI.4`**: las 9 pantallas que faltan no se migran con paridad al look viejo
  para no tocarlas dos veces — nacen ya con el sistema nuevo cuando les toque.

  **Motivo, con Carlos preguntando directo:** "cuando dije cambiar la apariencia no era solo
  usar React sino que el dashboard se sienta como herramienta" — comparando con Claude Code,
  Codex, Orca, Hermes. Medido en el CSS, no opinado: 15 tamaños de fuente + 86 `font-size`
  inline (vs. 4–5 en una herramienta real), 10 radios de borde distintos, 253 `style="..."`
  inline, 33 `.card` (cada cosa en su caja). Eso es lo que lee como "panel de administración":
  no hay sistema, hay 253 excepciones.

  **Decisión (confirmada por Carlos, dos preguntas cerradas):**
  1. El sistema visual entra **ahora**, en una sola pasada — no se migran las 9 pantallas
     restantes con el look viejo para reajustarlas después.
  2. **UI.6** (capas de proyectos/carpetas, sidebar Chat|Code) se queda donde está en el
     roadmap; no se adelanta.
  3. El **carril de estado** (glifo + peso tipográfico en vez de badges de color) — confirmado
     como la pieza más visible del cambio.

  **Qué NO se toca:** los hex base y los 4 temas existentes. El problema medido no es la
  paleta (`#0d1117` + acento azul ya es la familia correcta, tipo GitHub Dark/Zed) sino cómo
  se usa — decorativa en vez de señal.

  **Tokens nuevos:**
  - Tipografía: de 15 tamaños a 5 (`11·12·13·15·19`, 13 = cuerpo, 19 = título de pantalla).
    Regla de reparto explícita: mono para todo dato (id, modelo, costo, fecha, ruta), sans solo
    para prosa y labels — hoy están mezclados sin criterio.
  - Radios: de 10 a 2 (4px controles, 8px contenedores). `999px` sobrevive solo para el pill
    de estado del header — único elemento que debe leerse como pill.
  - Color = señal, nunca decoración: reservado a error, en-ejecución, y acción primaria. Todo
    lo demás vive en la escala de grises.
  - Densidad: altura de fila fija y compacta; muere `.card` como contenedor por defecto — la
    jerarquía pasa a hacerse con línea de 1px + espaciado, no caja con borde+fondo+sombra.
  - Acciones que no compiten: en cards, los botones aparecen en hover (o en menú `⋯` para la
    acción destructiva), no los 5 siempre visibles que tiene `skills` hoy.
  - **Carril de estado** en vez de badges de colores en filas de tabla/lista: un glifo (`●`
    `✗` `○`) + peso tipográfico mono, separador de 1px sin caja. Ej.: `● spec-activa-1  draft
    ok` en vez de `[draft][PASS] sí` con 4 badges de color.

  **Alcance de esta pasada:** tokens en `ui.css`, componentes de `UI.2` reajustados, el shell
  de `UI.3`, y `specs`+`skills` (ya son React — barato reajustarlos). Matar los `style=` inline
  ya introducidos en ese React. **Fuera de alcance, explícito:** las 9 pantallas de `UI.4` que
  faltan (nacen con el sistema nuevo al migrarse) y `UI.6`.

  **Gate, invertido respecto del resto de la migración:** los gates existentes de
  `specs`/`skills` miden *paridad* contra el vanilla — hay que reescribirlos para que midan que
  el look **cambió** de forma consistente: 5 tamaños de fuente, 2 radios, cero `style=` inline
  en el React tocado, carril de estado presente donde antes había badges.

  **Progreso (2026-08-30):**
  - [x] Tokens en `ui.css`/`styles.css`: `--fs-1..5` (11/12/13/15/19), `--radius` 6→4,
    `--radius-lg` 8, `--radius-pill` 999px (única sobreviviente del pill de estado del
    header). Utilidades `.fs-1..5` para reemplazar `font-size` inline en React.
  - [x] **Carril de estado** en `SpecsScreen.tsx`: fusiona las columnas Estado+Lint en una
    (`● draft ok` / `✗ approved 3 findings` / `○ archived —`), clase `.status-rail` nueva en
    `styles.css`. `.badge` no se toca: lo siguen usando las 9 pantallas sin migrar.
    **Gate en vivo:** navegador real (Playwright) contra el dashboard corriendo en :4325 —
    capturas confirman el carril sin la línea de `border-left` que traía por colisión de
    nombre con `.detail` (el span interno se renombró a `.rail-detail` tras verlo en pantalla;
    `.detail` ya era una clase global del panel expandible).
  - [x] **Acciones que no compiten** en `SkillsScreen.tsx`: `.skill-card-actions` pasa a
    `opacity:0` con reveal en `:hover`/`:focus-within` (sin cambiar alto, sin salto de layout).
    **Gate en vivo:** navegador real (Playwright) — captura sin hover no muestra los 5 botones,
    captura con hover sí.
  - [x] `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet sin
    mover).
  - [ ] Pendiente de esta pasada: barrido de `font-size`/`border-radius` en el resto de
    `styles.css`/`screens.css` (vanilla compartido, ~80 sitios — se hará agrupado por pantalla
    para poder verificar en vivo cada tanda, no en un sólo sed masivo); reajuste de
    `Button`/`Input`/`Combobox`/`Dialog`/`Toast`/`Tabs` (`UI.2`) a los tokens nuevos; el shell
    (`UI.3`); reescribir `ui4-specs-screen.mjs`/`ui4-skills-screen.mjs` para medir el look
    nuevo en vez de paridad contra vanilla (quedaron en rojo en las 2 aserciones de paridad de
    columnas/badges — esperado, hay que reemplazarlas, no arreglarlas).
- [ ] **UI.4 — 🧠 Pantallas, en orden de valor.** (PAUSADO por `UI.3.5` — 2 de 11 migradas con
  el look viejo: `specs` ✅ `skills` ✅. Al retomar, reciben el sistema nuevo de `UI.3.5`; las 9
  que faltan nacen ya con él.)
  **Recolocado 2026-09-02 (UI.8):** las 9 pantallas restantes **no se migran hasta que exista el
  gate de `UI.8.1` y esté hecho `UI.8.3`**. Motivo medido: sin el gate, cada pantalla nueva
  reproduce el problema de UI.3.5 (tokens definidos, 4.5% de adopción); y migrarlas antes de
  `UI.8.3` las hace nacer dentro de la navegación que el documento de dirección declara
  anti-patrón.

  **Progreso**
  - [x] **`specs`** (2026-08-30) — la primera. **Gate en vivo:** navegador real (Playwright),
    **21/21 PASS** (`scripts/ui-gates/ui4-specs-screen.mjs`); `tsc` ✅; `test:coverage` ✅
    (1174 pass / 0 fail); sin regresión en los 4 gates anteriores (27+32+19+9, todos verdes).
  - [x] **`skills`** (2026-08-30) — **implementada por Codex, gate escrito por Claude en
    paralelo y sin ver su código** (roles invertidos respecto de UI.3, donde fue al revés).
    **Gate en vivo:** navegador real (Playwright), **22/22 PASS**
    (`scripts/ui-gates/ui4-skills-screen.mjs`); `tsc` ✅; `test:coverage` ✅; los 6 gates del
    mes en verde.
    Ejercita lo que `specs` no tenía: layout de cards en vez de tabla, confirmación de borrado
    **inline** dentro de la card (no un modal) y una segunda sección con las skills "pro"
    importables. Codex resolvió bien el punto delicado por su cuenta: `useState` **solo** para
    estado efímero de interacción (qué card pide confirmación, "copiado", botón ocupado) y los
    datos siempre desde `window.state` — que es exactamente la frontera correcta.
    **Lo que hubo que corregirle:** dejó las 260 líneas del render/wire viejos **comentadas**
    en vez de borrarlas. Es el código muerto que `UI.5` tendría que limpiar, y peor: código
    comentado que parece vigente y vuelve intocable el archivo. Se borraron; el historial de
    git ya las conserva.
    **Y tres fallos seguidos del gate, todos por lo mismo** — el elemento de referencia no era
    equivalente: primero comparó badges contra Runs (que solo tiene `.badge` pill, 999px),
    después contra Tasks (cuyo primer `.badge.square` lleva un `font-size` **inline** propio de
    esa fila). Se resolvió con la técnica del gate de UI.2: **crear un elemento limpio con las
    mismas clases** en vez de buscar uno existente. Es la forma robusta de medir paridad y
    conviene usarla desde el principio en las 9 pantallas que faltan.
  - [ ] `chat`, `tasks`, `runs`, `graph`, `settings`, y las de Observabilidad.

  **El mecanismo que hizo falta inventar acá, y que usan las 10 que faltan.** Una pantalla no
  se puede migrar como se migró el combobox. `App.rerender()` hace `main.innerHTML = …`, así
  que el registro de islas remontaría la pantalla entera **en cada poll de 30s**: se perderían
  el scroll de la tabla, la fila abierta y cualquier input a medio escribir. En un combo no se
  nota; en una pantalla la vuelve inusable. Solución: un flag `react: true` en el objeto de
  `SCREENS`. Para esas pantallas `rerender()` cambia de significado — ya no es "repintá el
  DOM" sino **"avisale a React que el estado cambió"**: el contenedor se escribe una sola vez
  al entrar y después se deja quieto. El gate lo verifica marcando el nodo del DOM y
  comprobando que la marca sobrevive al repintado.

  **El estado NO se copia a React** (`lib/app-state.ts`). Una pantalla lee cualquier cosa de
  `state` —`specs`, `specsStatus`, `openSpec`, `archOpen`, `bulkSelected`— y cada una un
  subconjunto distinto: enumerarlos en un store tipado sería mantener once copias del estado
  que ya existe. El componente lee `window.state` directamente, igual que hacía el `render(st)`
  al que reemplaza, y `useAppVersion()` solo le avisa cuándo releer. El acoplamiento es
  deliberado y temporal: mientras `app.js` sea el dueño de los fetch, duplicar los datos crea
  dos fuentes de verdad. Se invierte en `UI.5`.

  **Cómo se mide "no cambió el aspecto", ahora que no hay código viejo con qué comparar:** el
  gate compara el estilo computado de la tabla de Specs (React) contra la de **Runs, que sigue
  100% en vanilla** y usa las mismas clases. Padding, tipografía y borde dan idénticos. Cuando
  Runs se migre habrá que mover esa referencia a otra pantalla que siga en vanilla.

  **Dos hallazgos de la primera pasada:**
  1. **Un crash real, preexistente, que la migración expuso.** El handler de `lint` hacía
     `if (d.findings && d.findings.length === 0) … else d.findings.length` — o sea, una
     respuesta SIN `findings` (un 404, un error del servidor) caía al `else` y explotaba con
     *"Cannot read properties of undefined"*. Estaba igual en el vanilla. Se vio al correr el
     gate contra una spec inexistente. Arreglado con una guarda: un error de la API sale como
     aviso, no como crash. **No es rediseño** — un crash no es una funcionalidad que preservar.
  2. **Dos fallos del gate, no del código** (mismo patrón que en UI.3, y conviene reconocerlo
     rápido): la paridad visual comparaba contra **Skills, que no usa tabla** —su layout es de
     cards—, así que no medía nada; y el chequeo de "las activas no llevan checkbox" usaba el
     índice de card equivocado y medía justamente la tabla que sí debe llevarlo.

  **Refactor sin cambio de comportamiento:** `bulkDelete()` estaba inline dentro del listener
  de `wireBulkSelect()`; se extrajo tal cual para que las pantallas React lo invoquen sin
  duplicar la lógica ni el copy de confirmación.

  `specs` y `skills` primero (las más chicas — validan el patrón de migración de pantalla completa),
  después `chat` (la home, mayor valor visual), `tasks`, `runs`, `graph`, y `settings` al final
  (la más grande, ~900 líneas).
  **Una pantalla = un commit = verificación en vivo.** Sin acumular (regla de cadencia de commits).
  **Migrar ≠ rediseñar**: primero paridad funcional, las mejoras visuales vienen después.
- [ ] **UI.5 — 🧠 Limpieza.**
  Borrar el `render()`/`wire()` muerto; `screens.css`/`styles.css` reducidos a tokens;
  `index.html` con un solo `<script>`.
- [ ] **UI.6 — 🧠 Dos profundidades, una sola realidad: Chat | Workspace (backend ya listo por CC.2/CC.3).**
  Absorbida desde el Sprint 29 el 2026-08-18: CC.2 y CC.3 entregan schema + endpoints + tests, y toda
  su superficie visual se construye acá, en React, **nunca en vanilla**.
  Sidebar izquierdo: **Chat | Workspace** arriba (shadcn `Tabs`), y debajo el árbol de proyectos
  como carpetas colapsables (shadcn `Collapsible`/`Sidebar`) con sus sesiones. En `Workspace` se
  ven los proyectos con sus agentes; en `Chat` se ven las conversaciones — incluidas las
  "generales" (`project_id NULL`). Se reemplaza el nombre previo `Code`: OrchestOS no se limita a
  proyectos de software. Cada sesión muestra su agente (inmutable) y su modo (mutable).
  El picker de agente de CC.D2 se reconstruye acá apuntando a `PATCH /api/chat/sessions/:id`,
  ya no a `PUT /api/config`.

  **Dirección confirmada por Carlos (2026-09-02):** Chat es la entrada por defecto para usuario
  normal; Workspace es la profundidad operativa para trabajo serio. Ambos representan los mismos
  chats, proyectos, tareas y runs — nunca se duplican ni se migran entre dos productos. Cuando
  una conversación genera trabajo persistente, `Ver espacio de trabajo` abre el proyecto, agente
  y ejecución de origen. La fuente completa de investigación, reglas de componentes, seguridad y
  criterios de aceptación es `docs/dashboard-experience-direction.md`.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` se regenera automáticamente desde
  `PLAN.md` por el pre-commit; no es una edición manual ni un cambio de producto adicional.
- [ ] **UI.7 — 🧠 Navegación progresiva: muere "modo avanzado".**
  Absorbe el ex-CC.4 y el ex-BB.3. Elimina `navModeBtn` y el flag
  `localStorage['orchestos-mode']` (`app.js:1593`, `2263`, `2286-2337`) — el eje deja de ser un
  modo etiquetado y pasa a ser profundidad contextual: Chat | Workspace.
  Observabilidad no compite como navegación primaria: Tasks, Runs, Graph, Specs, Skills, Memory e
  Instincts aparecen dentro del proyecto, agente o ejecución pertinente. `Activity` queda como la
  única vista transversal explícita para cruzar proyectos. Settings conserva sólo configuración
  global; Project/Memory/Instincts no se esconden allí si pertenecen a una entidad seleccionada.
  El inspector derecho pasa de riel siempre presente a detalle condicional de la entidad elegida.
  `SCREENS.runner` se borra (deuda CC.0-D5).
  **Gate 🔍 en vivo**: es el equivalente visual de CC.5 — dos proyectos, una sesión por proyecto,
  cada una con un CLI distinto, verificado con navegador real.

### UI.8 — El cambio real: mecanismo, datos y anatomía (ABIERTO 2026-09-02)

> **Origen: auditoría crítica pedida por Carlos el 2026-09-02**, con su veredicto textual:
> *"el cambio que está en UI no hay cambio real, OrchestOS sigue viéndose igual"* y *"si le
> estamos haciendo ya meses a esto, no solo que trabaje bien, también que se vea excelente"*.
>
> **Por qué UI.3.5 no produjo cambio visible — medido, no opinado (2026-09-02):**
>
> | UI.3.5 declaró | Medido hoy en `styles.css` + `screens.css` + los 3 `.js` |
> | --- | --- |
> | "de 15 tamaños de fuente a 5" | **8** usos de `var(--fs-*)` vs **~168** `font-size` hardcodeados → **4.5% de adopción**; siguen vivos `12.5px`, `11.5px`, `13.5px`, `10.5px`, `14.5px`, `0.84em` |
> | "de 10 radios a 2" | **15** valores distintos de `border-radius` (45 usos de token vs 52 crudos) |
> | "253 `style=` inline" como diagnóstico | **270** hoy (app.js 119 · screens-ops.js 80 · screens-core.js 54) — **subió 17** |
> | "muere `.card` como contenedor" | **33** usos, el mismo número del diagnóstico original |
>
> **Causa raíz, y no es de diseño:** UI.3.5 exigía textualmente un *gate invertido* que midiera
> que el look **cambió**. Nunca se escribió — `scripts/ui-gates/` va de `ui0` a `ui4`, no existe
> `ui35-*`. Es la Regla Cero de `CLAUDE.md` en su forma más pura: *una regla escrita que nadie
> hace cumplir mecánicamente deja de existir en la práctica*. Agregar más dirección visual sin
> ese gate reproduce el mismo resultado con más páginas de documento.
>
> **Segundo hallazgo, que convierte UI.6/UI.7 en trabajo de backend antes que de interfaz.** El
> documento de dirección afirma *"el chat, la tarea, el run y el proyecto son los mismos
> objetos"*. El schema no lo sostiene:
> - `runs.project_id TEXT` **sin FOREIGN KEY** (`src/db/migrate.ts:197-217`), mientras
>   `context_chunks` sí la tiene (línea 194). Un run puede apuntar a un proyecto inexistente.
> - `projects.id` es `TEXT PRIMARY KEY` (181) pero `files.project_id` (221) y
>   `code_edges.project_id` (233) son `INTEGER NOT NULL`, sin FK. Y
>   `src/graph/index.ts:172,180` (`upsertFile(projectId: string, …)`) **inserta un string en esa
>   columna INTEGER**: funciona sólo por la tipificación laxa de SQLite; el schema declarado
>   miente sobre lo que guarda. UI.7 exige "Graph dentro del proyecto" — ese join no está
>   garantizado.
> - **No existe entidad `agents`.** El groupbox de agente que la dirección pide no tiene de dónde
>   leer estado propio.
>
> **Carlos autorizó explícitamente el trabajo de backend (2026-09-02):** *"si por hacer esto toca
> agregar código en el back, pues que así sea"*.
>
> **Conflicto de decisiones resuelto.** `index.html:35-42` documenta el panel derecho como
> *"SIEMPRE presente… el toggle nunca cambia de posición"* — corrección de Carlos del 2026-07-13,
> ronda 4. La dirección del 2026-09-02 lo prohíbe (*"inspector condicional… no existe como riel
> vacío permanente"*). Carlos zanjó el 2026-09-02: *"el rumbo que quiero llevar es el mencionado,
> no el anterior"*. **Gana el inspector condicional; la decisión del 2026-07-13 queda revertida**
> — se conserva escrita, no se borra (memoria evolutiva).
>
> **Anatomía concreta: `docs/ui-reference-patterns.md`** (nuevo, 2026-09-02). Extraída de las
> capturas que Carlos tomó de Orca y Lightdash (`~/Documents/screens/`, fuera del repo por peso) y
> del README de `pi-agent-dashboard`. Ningún ítem de abajo se diseña por intuición: la anatomía ya
> está escrita ahí y se cita por sección.
- [ ] **UI.8.4 — 🧠 Shell Chat | Workspace (absorbe UI.6).**
  Inspector **condicional** (0px cerrado, no riel), con ancho persistido y una sola fuente de
  selección en el estado del shell. Árbol de proyectos con agentes como filas colapsables
  (§A.2), selección como único contenedor con borde (§A.3), anomalías inline (§A.4).
  **Contrato de la transición Chat → Workspace**, que hoy no está definido:
  1. Si la conversación **no** generó trabajo persistente, la acción **no aparece** (no aparece
     deshabilitada — un botón que a veces no lleva a ningún lado es el "botón que no hace nada"
     de la Regla Cero).
  2. Si lo generó: abre **proyecto + entidad de origen ya seleccionada**, misma pestaña, con el
     chat conservado y accesible en un gesto de vuelta.
  Gate 🔍 en vivo con los dos casos de (1) y (2).
  **Progreso — 3 piezas (árbol de agentes, contrato Chat→Workspace, inspector condicional); UI.8.4c/UI.9.5 cerradas, padre pendiente del gate agregado:**
  - [x] **UI.8.4a — agentes como filas colapsables** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-agents.md
    Header `N agents ⌄` por proyecto en `Sidebar.tsx`, filas = sesiones de `chat_sessions`
    (icono+título+tiempo relativo, sin borde/caja), click abre esa sesión en Chat, fila activa
    marcada con borde (§A.3). Sesiones de un proyecto no-cwd se listan con `?project=<id>`
    puntual (el backend ya lo soportaba) — no es ERP.2, ningún otro endpoint quedó filtrado por
    proyecto. Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4-agents-live.json` — dos proyectos reales, sesiones no se mezclan.
    Límite menor conocido: el contador muestra `0 agents` hasta el primer expand (carga
    perezosa a propósito, no dato falso).
  - [x] **UI.8.4b — contrato Chat→Workspace** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-workspace.md
    `sessionHasPersistentWork`/`getLastPersistentTaskId` (`src/db/chat-turns.ts`) leen
    `chat_turns.task_id`; `toSessionRow` expone `hasPersistentWork`/`lastPersistentTaskId`.
    Botón "Open in Workspace" en `SCREENS.chat` solo existe en el DOM si la sesión activa
    generó una tarea — nunca deshabilitado. Click navega a `workspace` con el proyecto de la
    sesión, tab `tasks` activo, y abre `SidePanel.openTask` con la tarea real. Volver a `Chat`
    desde el riel conserva la sesión sin tocar nada nuevo.
    Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4b-live.json`
    — caso 1 (sin trabajo persistente) confirma el botón ausente del DOM; caso 2, con un turno
    real apuntando a una tarea real (`crypto-page-v1`), confirma workspace+tab+SidePanel
    correctos y la sesión preservada al volver. `bunx tsc --noEmit`, `bunx biome check` (0
    errores) y `bun run test:coverage` (1431 pass) verdes.
  - [x] **UI.8.4c — inspector condicional** (0px cerrado, ancho persistido), retomada por UI.9.5
    tras UI.9.1–9.4; spec re-leído y actualizado contra el shell Chat | Dev actual
    (`docs/specs/UI.8.4c.md`).
    Ejecutado por: luna · Spec: docs/specs/UI.8.4c.md
    Gate en vivo: navegador real (Playwright/dashboard), evidencia en `docs/done/evidence/UI.9.5-live.json`; el flujo UI.9.2 Open in Workspace no fue observable porque no había sesiones persistentes elegibles en la base real, y queda documentado en la evidencia junto al error preexistente de Sidebar al cambiar Dev→Chat.

  **Anotado por Carlos (2026-09-15), pendiente de planificar, no implementado todavía:** donde
  hoy dice "Projects" en el riel debería tener un ícono `+`/carpeta-con-agregar para dar de alta
  un proyecto nuevo desde la UI (hoy solo se registra vía `orchestos index`/CLI o
  `POST /api/project/index`, nunca desde el dashboard). Al agregarlo, tiene que poder verse y
  editarse las opciones de ESE proyecto — esto viviría en Settings, en una sección de proyectos
  (encaja con `UI.8.5` § Settings agrupado por alcance: `Global · Proyecto · Agente`, ver
  `PLAN.md` línea ~1780). Carlos también notó que el tab `Runs` se siente duplicado con
  `Activity` (que hoy reusa literalmente `SCREENS.runs` — ver decisión de UI.8.3 arriba); a
  revisar si `Activity` debe ser una vista distinta (cruzando proyectos, per
  `dashboard-experience-direction.md` línea 84) en vez de un alias del mismo contenido que ya
  vive dentro del workspace de cada proyecto.
- [ ] **UI.8.5 — 🧠 Composición visual: barra de estado, Settings y controles.**
  Recién acá entra "que se vea excelente", y con la anatomía ya escrita:
  - **Barra de estado inferior permanente** (§A.5): `% de contexto + tiempo de sesión` a la
    izquierda, avisos al centro, recursos a la derecha. **Es la superficie que `H.7.5` necesita**
    — el % de contexto no va en una card del home. Resuelve también dónde vive el costo en Chat.
  - **Settings agrupado por alcance** (§B.1): `Global` · `Proyecto` · `Agente`, con la anatomía de
    fila de §A.9 (label + descripción de una línea + control a la derecha, sin divisores).
    Corrige el reclamo textual de Carlos: *"Settings no parece usable, hay cosas que hay que
    desaparecer o darles sentido"*.
  - **Selector de agente como chips con icono** (§A.10), no `<select>`; `Combobox` se reserva para
    listas largas (`reference-model-combo-pattern`).
  - **Barra de uso de contexto** en la fila de sesión (§C.2).
  Gate 🔍: el de UI.8.1 en verde sobre estas pantallas, más navegador real.
### UI.9 — Shell de dos modos: Chat | Dev (ABIERTO 2026-09-15)

> **Revierte una decisión, sin borrarla.** El 2026-09-02 (UI.7/UI.8.3) se decidió que Chat |
> Workspace fuera profundidad contextual y no un modo etiquetado, y se borró el "modo avanzado".
> El 2026-09-15 Carlos pidió textualmente un switch explícito arriba a la izquierda, como Claude
> Desktop: *"poner el switch en la parte de arriba para hacer un chat normal donde ahí sí se puede
> seleccionar cualquier modelo… y los chats se van acumulando en ese mismo lado izquierdo"* y
> *"si quiero dev entonces ahí se activa el 'modo orca' donde puedo abrir proyectos (carpetas) y
> así mismo los agentes se verán del lado del aside debajo del proyecto"*. **Gana el switch
> explícito.** El texto de UI.7/UI.8.3 queda como historial.
>
> **Motivo medido (auditoría en vivo 2026-09-15):** la lista de sesiones aparece dos veces
> (sidebar `Sidebar.tsx:111-179` rotulada "N agents" + aside del chat `screens-core.js:474-529`);
> las "agents" del sidebar son `chat_sessions`; el rail colapsado amontona "Projects" y
> "0 agents". Referencias: Dev = `~/Documents/screens/Orca1_main.png` (`docs/ui-reference-patterns.md`
> A.1–A.7); Chat = captura de Claude Desktop de Carlos (2026-09-15).
>
> **Decisiones de Carlos (2026-09-15):** (1) cada modo muestra lo suyo — Chat lista sesiones
> `project_id NULL`, Dev las de cada proyecto; (2) "agente" en Dev = sesión de chat con CLI dentro
> del proyecto, tareas/runs siguen en Workspace/Activity; (3) agregar proyecto = diálogo nativo de
> macOS abierto por el servidor; (4) el switch cambia sidebar **y** canvas (último chat general o
> vacío ↔ último proyecto/agente). Plan completo: absorbido en este PLAN.md el 2026-09-17 al borrar `NEXT.md`; sus dos requisitos huérfanos (datos sembrados y pantalla legacy `tasks`) viven ahora en § Entregable rápido.

> **Orden (Carlos, 2026-09-15): UI.9.4 va primero.** OrchestOS se prueba desde la interfaz: *"si
> funciona ya en back se lo debe mostrar en el front, sino no existe"*. El gate de UI.9.1 necesita
> ≥2 proyectos y registrar un proyecto hoy solo existe por CLI — ningún gate puede exigirle un
> comando a Carlos.
- [ ] **UI.11 — 🧠 Sidebar de proyectos con la cara nueva (pieza 1 del orden de arriba).** (abierto 2026-09-21)
  Decisiones 1, 3 y 5 de Carlos + loader/check, sin pill `IDLE`, temas renombrados y botón fijo
  del panel derecho. **Ajuste del cerebro al orden:** si el clic en el proyecto deja de abrir el
  workspace, Tasks/Runs/Graph/Memory/Instincts quedan sin camino hasta la pieza 2, y los botones
  Explorer/Diff/Terminal también (viven en la barra del workspace desde `UI.9.A`). Por eso esta
  pieza suma esas pestañas a la página del proyecto en Settings (`UI.10`), el ítem *Project
  settings* del menú `…` y el toggle `#rpToggle`. *Delete project* sigue en `UI.9.9`.
  Spec: `docs/specs/UI.11.md`. Ejecuta Luna después de `CI.2.A`; gate
  `scripts/ui-gates/ui11-sidebar-projects.mjs`, 3 corridas verdes, captura revisada contra Orca y
  Circle.
  **PAUSADO 2026-09-21 (Luna detenida con SIGSTOP a mitad de ejecución, diff sin commitear en el
  working tree).** Carlos trajo una **guía visual nueva**: un prototipo hecho en Google AI Studio,
  `~/Documents/screens/orchestos-ai-agent-dashboard` (Vite + React 19 + Tailwind v4 +
  lucide-react, solo datos mock). Palabras de Carlos: *"esta va a ser la guía visual que vamos a
  tener para este proyecto… es solo un ejemplo, algunos botones no valen, otros están repetidos,
  pero la intención de cómo luce está ahí"*. Pidió auditar el código y darle un prompt para
  completarlo en AI Studio. UI.11 se re-especifica contra esa guía antes de reanudar.
  **Aclaración de Carlos (mismo día), regla para todo el rediseño:** el prototipo es la **esencia
  del look**, no el default funcional: *"me gusta como se ve pero no necesariamente vamos a
  aplicarlo al pie de la letra sino ordenado a como ya lo tenemos aquí"*. Si una pantalla del
  prototipo contradice una decisión ya tomada, gana la decisión; si no queda claro, se pregunta.
  Pestaña "Props" del panel derecho: **se elimina** (vino de la captura de Orca). Ronda 2 del
  prototipo verificada en vivo; ronda 2 del prompt en `docs/ui-aistudio-prompt.md`.
  **2026-09-21, cierre del prototipo:** Carlos da por terminado el prototipo (3 rondas de prompt) y
  pide implementar. `UI.11` queda **reemplazado por `UI.12`**; el diff parcial de Luna (medidas de
  Circle) se guardó en `git stash` ("UI.11 parcial de Luna…"), sin commitear.
- [ ] **UI.12 — 🧠 Look nuevo sobre el producto real, desde el prototipo de AI Studio.** (abierto 2026-09-21)
  **2026-09-21: reemplazado por `UI.13`** (decisión de Carlos: el prototipo es el frontend, no se trasplanta al vanilla).
  Guía: `~/Documents/screens/orchestos-ai-agent-dashboard` (esencia del look, no spec funcional;
  memoria `feedback-prototipo-es-esencia-no-spec`). **Dos cosas que NO se copian (Carlos):** el
  uso de los CLI se queda **como está hoy** en el producto (no las barras "CLI QUOTAS" del sidebar
  ni la barra "SESSION CONTEXT" del prototipo); y en la página del proyecto en Settings, *Delete
  project* **no** va al pie de cada pestaña sino como **una pestaña más** del proyecto.
  **Por qué empieza por tokens:** todo el producto (vanilla + islas) lee un solo juego de
  variables (`styles.css:6-80`, mapeado a Tailwind en `ui.css:32-64`). Cambiar sus valores a los del
  prototipo reviste la app entera en un solo paso barato; el resto es estructura, pantalla a
  pantalla. Fases, una por ítem, en orden:
  1. `UI.12.1` Tokens, temas, fuentes, radios y escala tipográfica del prototipo.
  2. `UI.12.2` Shell: header, sidebar de proyectos (decisiones 1 y 5, loader/check), estado vacío
     con logo, panel derecho Files | Diff | History con toggle único.
  3. `UI.12.3` Settings: navegación con los grupos del producto, un ítem por proyecto, página del
     proyecto con pestañas + pestaña de borrado, Executor como un solo *Default agent*.
  4. `UI.12.4` Chat: mensajes, filas de herramientas, compositor con agente/modelo/esfuerzo.
  5. `UI.12.5+` Pestañas del proyecto (Tasks, Runs, Graph, Memory, Specs, Skills, Instincts, Plan),
     una por ítem.
  Fuera: History con archivo real de agentes y *Delete project* con su back (`UI.9.9`) son ítems de
  producto aparte; esta cadena es el look.
- [ ] **I.5 — 🧠 Rediseño del chat: sacar la implementación de la cara del usuario.**
  Carlos comparó contra Orca, Xirp, Hermes, ChatGPT y Claude: *"hay mucho texto, una interfaz poco
  amigable y moderna"*. Los textos ofensores están verificados en `src/dashboard/public/i18n.js`:
  - `:1003` — `"Sin cablear para el chat todavía — cae a OpenRouter"` ← una **nota de
    implementación** en la cara del usuario.
  - `:994-996` — `"Claude · tu suscripción"`, `"Codex · tu suscripción"`, `"OpenCode · tu
    suscripción"`.
  - `:984` — `"Esfuerzo de razonamiento"`; `:1005` — `"Restablecer a lo predeterminado"`.

  Objetivo: **una sola píldora compacta**, con todo lo demás dentro de un popover.

      ┌──────────────────────────────────────────────┐
      │  ¿Qué querés construir?                      │
      │                                              │
      │  [◈ Codex] GPT-5.4 · Medio        [↑ Enviar] │
      └──────────────────────────────────────────────┘

  Y el trabajo se reporta **inline en el hilo** — sin navegación, sin modal:

      ⏺ Voy a tocar 3 archivos en src/auth/          [Ver] [Cancelar]
      ⏵ Ejecutando · 1 de 3 · src/auth/login.ts             [Detener]
      ✓ Listo · 3 archivos · 47s                    [Ver cambios]

  Se hace en React sobre el design system existente ([[feedback-no-reinventar-ui-usar-libreria]] —
  decisión cerrada, no re-litigar) y con el estándar de acabado permanente
  ([[feedback-acabados-elegantes-siempre]]). Barra de usage por agente
  (`[icono] Claude 61%  [icono] Codex 34%`): **iterar sobre lo que H.7.5 ya entregó, verificando
  primero qué muestra hoy** — y sin confundir los dos ejes, porque ese % es **cupo de cuenta**, no
  ventana de contexto ([[reference-orca-rate-limit-no-contexto]], INS-2026-016).

  **5 defectos concretos ya reportados por Carlos en vivo (2026-09-04), verificados en el código,
  a corregir dentro de este mismo ítem — no antes, para no tocar `SessionStatusBar.tsx` dos veces
  (decisión explícita de Carlos: "esperar al Bloque I"):**
  1. Los íconos de marca (Claude/OpenAI/DeepSeek/...) se ven todos azules — `ui.css:141`
     (`.session-statusbar-cli-icon { color: var(--metric-color) }`) pensado para un glifo
     monocromo de estado, y los SVG nuevos heredan ese `currentColor` en vez de su color real de
     marca. Hay que separar "color de marca" de "color de estado" (el tono warn/critical/idle).
  2. El popover repite el nombre del agente dos veces — `SessionStatusBar.tsx:40`:
     `<strong>{cli.label}</strong>` + `<small>{cli.binary}</small>`, y para casi todos los CLIs
     `label` y `binary` son la misma palabra ("Codex" / "codex").
  3. El punto verde del popover (`ui.css:163`, `.session-statusbar-popover-dot`) no aporta —
     redundante con el color que ya comunica el ícono/barra.
  4. El popover queda pegado al borde izquierdo de la pantalla — falta separación
     (`sideOffset`/`alignOffset` o padding del contenedor, hoy `align="end"` sin margen).
  5. El refresh es `setInterval` fijo cada 5s (`SessionStatusBar.tsx:24`) sin disparo por evento.
     Debe refrescar también al montar el dashboard (ya lo hace) y **tras cada respuesta del
     chat** — hoy no hay ningún trigger ligado al flujo de chat.
- [ ] **I.6 — ⚡ "Actividad", no "Tasks": la vista secundaria.**
  El nombre importa y es parte del arreglo: *"Tasks"* invita a crear una, *"Actividad"* invita a
  mirar. Lista cronológica con estado; el detalle técnico (engine, modelo, effort, diff, checks,
  **archivos leídos**) solo al abrir un ítem. Es donde aterriza el draft manual que I.1 saca de la
  pantalla principal, y donde viven historial, pendientes, errores, reintentos y recuperación
  manual cuando algo falla.
