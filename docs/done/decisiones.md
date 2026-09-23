# Decisiones de Carlos — archivadas

<a id="entregable-rapido"></a>
## Entregable rápido: usarlo ya para decidir si sirve — decisión de Carlos (2026-09-17)

**Pedido textual:** *"yo pedí un entregable rápido para comenzar a probar ya y ver si esta
solución es mejor o peor y mejorarla"*. El orden de los bloques existe para eso, no para
completarse entero antes de probar.

**Lo que ya está listo para usar hoy** (cerrado y verificado en vivo esta semana): shell Chat | Dev
completo (`UI.9.1`–`UI.9.4`), inspector contextual (`UI.9.5`), el puente de estado sin el
`TypeError` que rompía el cambio de modo (`UI.9.6`), agregar proyecto desde la UI (`UI.9.4`), y el
chat con **Codex** sin caída silenciosa a OpenRouter (`AT.10`, tramo Codex cerrado con evidencia).

**Lo que falta para que la prueba no mienta, en orden:**

0. **`UI.9.7` — los cinco bugs que impiden probar** (abierto 2026-09-18, ver más abajo). Va
   primero por dependencia dura, no por prioridad: el botón de agregar proyecto está borrado
   por una regresión, así que el punto 1 de esta lista **no se puede ejecutar desde la UI**.
   Corrección de rumbo del 2026-09-18: el punto 1 no se resuelve "sembrando" datos a mano —
   Carlos los va a crear usando el producto, que es de lo que se trata la prueba.
1. **Datos reales de trabajo, creados usándolo.** Requisito heredado de `NEXT.md` (graduado acá
   el 2026-09-17): **≥2 proyectos, ≥3 sesiones por proyecto, ≥5 chats sin proyecto**. Hoy la DB
   real tiene ~1 y 1, y eso **ya invalidó un gate**: `UI.9.5` no pudo observar "Open in
   Workspace" porque no había sesiones elegibles (`docs/done/evidence/UI.9.5-live.json`). Con
   volumen de 1 no se puede juzgar ni el layout ni si la herramienta sirve.
2. **`AT.10` cerrado del todo** — hoy Codex cierra y OpenCode queda bloqueado por configuración de
   la máquina, no por el código. Si el chat cae en silencio a otro proveedor, la prueba miente
   sobre qué se está evaluando.
3. **`H.5.3` — primera corrida medida real** (ya `GATED` por Carlos): es el "antes" contra el que
   se compara cualquier mejora posterior. Sin ese número no se puede afirmar que una versión es
   mejor que otra, que es exactamente la pregunta que este entregable quiere responder.

**Explícitamente fuera del entregable rápido:** `UI.4` (9 pantallas sin migrar), `UI.5`, el resto
de `UI.3.5` (`.card`, componentes de `UI.2`, shell), `UI.8.5`/`UI.8.6`, y los bloques `ERP.2`–`ERP.5`.
Ninguno bloquea empezar a usarlo.

**Deuda técnica registrada al graduar `NEXT.md` (2026-09-17):** la pantalla legacy `tasks`
(`App.go('tasks')`) sigue viva y era el "hermano observado" anotado en aquel archivo; no tiene
ítem propio todavía. No bloquea el entregable rápido; se anota para que no se pierda otra vez.

<a id="ruta-erp"></a>
## Ruta mínima al piloto ERP — decisión de Carlos (2026-09-15)

**Objetivo de aceptación:** desarrollar y utilizar un módulo completo de ERP en un proyecto
real, conservando plan, decisiones, tareas, conversación y evidencia al reabrirlo. Una landing
page o una respuesta marcador no acreditan este objetivo. Este orden pasa delante del backlog
general; no exige terminar todos los bloques H/S/UI antes de empezar el piloto.

**Estado contrastado con código, no probado en vivo en esta revisión:** IDEAS #56 ya pide
proyecto como unidad de contexto; UI.8.3–UI.8.5 ya describen navegación y Settings. Siguen abiertos.
`Sidebar.tsx:35-36,75-96` (`src/dashboard/public-src/islands/shell/`) aún renderiza la navegación
plana y el modo avanzado. `src/dashboard/handlers/memory.ts:7-24` lista/busca memoria global sin
filtro de proyecto, aunque `src/db/memory.ts:122-137` ya ofrece consultas por proyecto. Esto
confirma mezcla en la superficie, no demuestra por sí solo contaminación de todos los prompts.
`app.js:2908` aún bloquea Codex/OpenCode; `screens-core.js:982-1004` cambia config global desde
el selector. AT.8 es un hook de desarrollo del repo, no el switch del producto solicitado.

**Contrato vigente (aclara y prevalece sobre los textos anteriores; se conserva su historia):**
- Proyecto → Chats, Plan/Tareas, Runs/Resultados, Memoria, Skills, Specs y Graph. El proyecto
  activo gobierna consultas, acciones y contexto enviado al agente; no basta ocultar filas.
- Nuevo chat elige **un CLI**, persistido desde su creación. Ese transporte permanece fijo;
  para usar otro se crea otro chat. El selector dentro del chat cambia **modelo y esfuerzo**
  compatibles con ese CLI, persistidos por sesión, sin modificar otros chats ni config global.
- Settings global: cuentas/CLIs, apariencia e integraciones. Settings del proyecto: preferencias,
  skills habilitadas y orquestación. Las bibliotecas compartidas se distinguen explícitamente
  de lo activado en el proyecto; memoria de proyecto no se comparte implícitamente.
- Subagentes **apagados por defecto**, con habilitación explícita y límites efectivos. Abrir
  varios chats manualmente no habilita delegación automática. El consumo de suscripción no se
  puede inferir de dólares API ni del porcentaje de contexto.
- Referencias existentes: `docs/ui-reference-patterns.md` y
  `docs/dashboard-experience-direction.md`; capturas identificadas en el primer documento.
  La primera entrega visual debe cambiar navegación, jerarquía y Settings de forma observable.

**Orden y estimación inicial** (jornadas efectivas de implementación + verificación, un ejecutor
Luna y cerebro integrando; incertidumbre alta hasta los primeros gates, no fecha comprometida):

| Entrega | Ítems y alcance mínimo | Estimación |
| --- | --- | --- |
| 1. Chat utilizable | AT.4 + AT.10 + ERP.1: respuesta sin congelamiento, CLI fijo, modelo/esfuerzo | 2–3 días |
| 2. Proyecto visible y aislado | UI.8.3 + porción necesaria de UI.8.4/UI.8.5 + ERP.2; capturas antes/después | 3–5 días |
| 3. Consumo controlable | ERP.3: OFF efectivo, límites y llamadas auxiliares visibles | 1–2 días |
| 4. Entrada segura al piloto | R.7 + H.9.4 + recorrido inicial R.8; gates del flujo elegido | 2–3 días |
| 5. Módulo ERP real | ERP.4 y evidencia de utilidad de R.8, mientras se corrigen bloqueos observados | según módulo |

**Estimado para empezar el módulo: 8–13 jornadas efectivas**, más margen si aparecen defectos de
adaptadores/aislamiento. No incluye construir el ERP. Primer cambio visible previsto en entrega 2;
no esperar migrar las nueve pantallas restantes. UI.8.1 acompaña esa entrega con sus gates existentes;
no se omite la prueba en navegador. UI.8.2 se aplica donde el recorrido requiera integridad,
sin hacer de una entidad nueva `agents` un prerrequisito de listar chats existentes.

- [x] **ERP.1 — 🧠 Un CLI por chat; modelo y esfuerzo propios de la sesión.** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/ERP.1.md
  Mini-menú en "+ / Nuevo chat" (`screens-core.js`) gateado por `st.executorModes.modes[].detected`;
  elegir CLI crea sesión con `agent` explícito (`app.js: startNewChatSession(agent)`, sin fallback a
  config global); cancelar (click afuera/Escape) no crea sesión ni fetch. Composer perdió el nav
  "agent" — solo modelo/esfuerzo, el CLI queda como etiqueta fija (`buildChatModelFx`). Se borró el
  handler `data-modelfx-agent`/`PUT /api/config` desde el chat (el agente de sesión sigue inmutable
  por `chat-sessions.ts:227`). Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/ERP.1-live.json`
  — 5 CLIs listados, cancelar no cambia el conteo de sesiones,
  elegir crea+activa, Codex y OpenCode coexisten sin pisarse, recargar conserva el CLI. `bunx tsc
  --noEmit` y `bun run test:coverage` (1430 pass) verdes. Dashboard bajado al cierre.
  Complementa AT.10: su exclusión de modelo interno describe solo el arreglo inicial, no el mínimo
  de este piloto. El selector de CLI de AT.10 se ubica en **Nuevo chat**, no como cambio de agente
  dentro del composer. Usar sesiones existentes como fuente de filas, sin nueva tabla `agents`.
  **Aclaración explícita de Carlos (2026-09-15, referencia visual inspeccionada):** al pulsar
  `+ / Nuevo chat`, abrir primero un **mini menú de CLIs**, antes de crear la sesión o mostrar
  su compositor. Cada opción presenta icono y nombre del CLI; elegirla crea y abre el chat en
  el proyecto activo con ese CLI fijado. Cerrar/cancelar el menú no crea una conversación vacía
  ni lanza un proceso. Mostrar disponibilidad real; un CLI sin adaptador o no detectado no
  puede iniciar una sesión. Dentro del chat solo se seleccionan **modelo y esfuerzo** compatibles;
  el CLI se identifica como etiqueta, no como opción intercambiable del selector.
  Referencia: `/Users/carlosgallardo/Desktop/Screenshot 2026-09-15 at 9.20.19 AM.png`, menú de
  nueva pestaña de Orca con filas de agentes. Se adopta ese paso previo para **chats** de OrchestOS;
  la captura no amplía el alcance a terminal, navegador, emulador, Hermes ni Agent Teams.
  Dónde: `src/dashboard/public/app.js:2908`, `screens-core.js:965-1012`,
  `src/dashboard/handlers/chat-sessions.ts`, `chat.ts:1098`, adaptadores `src/run/executors/`.
  Gate: dos chats con CLIs distintos, cambiar modelo/esfuerzo en uno, enviar y recargar; comprobar
  argumentos efectivos, transporte, persistencia y que el otro no cambia. Opciones no soportadas
  se explican; cero fallback API silencioso. Gate AT.10 conserva sus dos CLIs requeridos.
  Añadir al gate en navegador: `Nuevo chat → menú → elegir CLI → chat`, cancelación sin sesión
  ni proceso nuevos, opción no disponible sin creación, y selector posterior limitado a modelo
  y esfuerzo. Recargar conserva el CLI elegido desde ese menú.

- [ ] **ERP.2 — 🧠 Alcance de proyecto real en navegación, memoria y capacidades.**
  Completa UI.8.3–UI.8.5, no crea una segunda migración visual. Dónde: Sidebar citado arriba,
  estado del shell y `src/dashboard/handlers/memory.ts:7-24,58-90`; revisar los consumidores
  equivalentes de tasks/skills/specs/runs/graph y la selección de memoria para prompts.
  Implementar filtros y validación del proyecto también en lectura, búsqueda y mutaciones;
  datos históricos sin dueño quedan identificados, nunca reasignados o borrados por inferencia.
  Gate: proyectos A/B con centinelas, navegar/buscar/editar y reabrir; A no muestra ni utiliza datos
  de B, tampoco con ID ajeno enviado al endpoint. Biblioteca global y activación local distinguibles.
  Navegador real: proyecto → chat → tarea → resultado → memoria, con Settings separados y
  capturas antes/después contrastadas con las referencias. No cerrar con solo tokens CSS cambiados.

- [ ] **ERP.3 — 🧠 Orquestación opcional con freno efectivo de consumo.**
  Hueco nuevo: `src/config/schema.ts:72-103` tiene opciones de ejecutor y QA opt-in, pero no el
  contrato unificado OFF/límite solicitado. Dónde: schema/loader, handler de config, Settings,
  `src/agents/sub-agent.ts`, `src/run/scheduler.ts` y entradas de expansión desde CLI/dashboard.
  Config por proyecto: `enabled=false` si ausente; al activar, límites explícitos de simultáneos
  y total por ejecución (incluye descendientes y relanzamientos; solo limitar concurrencia no
  limita consumo acumulado). Validar antes de lanzar cada hijo, también al reanudar.
  OFF impide delegación/autoexpansión de OrchestOS y permite trabajo con un ejecutor. Inventariar
  además planner/QA/retries/dreaming: mostrar qué llamadas adicionales siguen activas y no
  confundirlas con subagentes. Conservar checks/QA requeridos, sin prometer costo cero.
  Verificar por CLI si puede impedirse su delegación interna: si no, mostrar límite no garantizado
  y no ofrecer ese adaptador como modo de cero subagentes. No basta una instrucción en el prompt.
  Gate: configuración ausente y OFF → cero hijos; ON → admite N y rechaza N+1 antes del spawn;
  recarga/reinicio mantienen política; intentos concurrentes no la saltan. Estado visible de
  activos/total y consumo observado; cuota no disponible se rotula desconocida.

- [ ] **ERP.4 — 🔍 Piloto de módulo ERP y decisión de utilidad.**
  Entrada: entregas 1–4 anteriores verificadas para el recorrido real. Elegir con Carlos módulo,
  repo, stack, criterios funcionales, CLI/modelos y presupuesto antes de corridas que consuman uso.
  No asumir que conversar con un CLI demuestra que planificar/ejecutar/QA usan el mismo transporte:
  el gate previo debe registrar cada etapa y no usar proveedores/cuentas no elegidos.
  Recorrido mínimo del módulo: modelo de datos + migración, reglas de negocio y validaciones,
  permisos aplicables, API + UI, tests de aceptación y resultado utilizado por Carlos.
  Interrumpir/reabrir al menos una vez; recuperar siguiente tarea, decisiones, error aprendido y
  evidencia sin reconstruirlos a mano. Medir intervenciones, bloqueos, tiempo y uso disponible;
  verificar que una corrección guardada se recupera en el siguiente trabajo del mismo proyecto.
  Reutilizar R.8 para la revisión independiente; no afirmar aprendizaje por solo guardar memoria.

- [ ] **ERP.5 — 🔍 Revisar sobrecarga: qué quitar manteniendo fiabilidad y control humano.**
  Pedido de Carlos (2026-09-15). Hacer después de iniciar ERP.4, con evidencia del trabajo real;
  no bloquear AT.10 ni el piloto con otra auditoría extensa. Alcance: reglas/documentos cargados,
  contexto repetido, delegación, planner/QA/retries/dreaming y pasos de planificación/revisión.
  Usar registros existentes; distinguir tokens, contexto, cuota CLI y costo API, sin convertir
  unos en otros por suposición. Cada hallazgo muestra costo observado, beneficio demostrado y
  propuesta concreta de eliminar, simplificar o conservar. Revisar también el propio proceso de
  desarrollo de OrchestOS: una auditoría que añade ceremonia puede agravar lo que intenta resolver.
  Comparar antes/después sobre la misma tarea, modelo, esfuerzo y criterios de aceptación;
  medir resultado útil, errores, intervenciones y consumo disponible. Pi es una hipótesis de
  referencia por investigar, no superioridad acreditada ni motivo para migrar; cualquier comparación
  requiere condiciones equivalentes y presupuesto elegido por Carlos.
  **Dirección de trabajo solicitada:** reglas claras y cortas, alcance y aceptación breves →
  implementación → checks relevantes → resultado revisable por Carlos (**human in the loop**).
  El agente prepara evidencia, límites y decisiones pendientes para que el humano pueda aceptar
  o corregir el resultado sin reconstruir todo el proceso ni aprobar cada paso reversible.
  Mantener confirmación previa para acciones destructivas/irreversibles; la revisión final no
  autoriza ejecutarlas antes. Conservar controles de pérdida de datos, aislamiento y QA honesto.
  Gate: informe corto con evidencia y simplificaciones propuestas; Carlos revisa utilidad y
  tradeoffs antes de adoptarlas. No añadir reglas, hooks o agentes como salida automática del estudio.

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.

<a id="i-0-el-orden"></a>
### I.0 — El orden, que Carlos marcó como MUY IMPORTANTE

> *"no se puede hacer una cosa por que otra está dañada, por eso el orden es MUY IMPORTANTE"*.
> De acuerdo, y por eso el orden cambia respecto de lo que se propuso el mismo día. **Corrección
> honesta de una recomendación previa:** primero se dijo "H.9 entero antes del rediseño". Es
> incorrecto en un punto concreto, y el argumento en contra es técnico, no una concesión:
> **H.9.1 (persistir el chat) y el rediseño del chat tocan el mismo archivo y el mismo flujo**
> (`src/dashboard/public/screens-core.js:592-613` + `src/dashboard/handlers/chat.ts`). Cablear
> `sessionId` sobre un front que se va a reescribir es hacer el trabajo dos veces. Por eso H.9.1
> se **absorbe** en este bloque como I.4 y deja de ser un ítem suelto de H.9.
>
> **Tercera corrección de orden (2026-09-04, misma sesión, decisión final explícita de Carlos):**
> hubo una vuelta más. Primero se puso H.9.3/H.9.2 antes del Bloque I. Después, ante la pregunta de
> por qué H.5.3 nunca se corrió, se propuso posponerlos ("se atacan después, según se avance").
> Carlos revisó esa segunda versión y la revirtió: **H.9.x se cierran primero, el Bloque I espera.**
> Queda como el orden vigente; las dos versiones anteriores se conservan arriba solo como historial
> de por qué se llegó acá — no reabrir esta secuencia sin una razón nueva. Orden ejecutable:
>
>     1. H.8.3'  recortado a backend         ✅ cerrado 2026-09-04
>     2. H.9.3   aislamiento de config-home  ← que el bug no viaje; siguiente paso
>     3. H.9.2   frontera de lectura por CLI
>     4. H.9.4   gate de privacidad ejecutable
>     5. BLOQUE I (este)  ← el front se toca UNA sola vez, con I.4 adentro
>     6. H.5.3   primera corrida medida real
>
> El argumento de "medir/rediseñar sobre superficie temporal es desperdicio" sigue siendo válido
> para H.5.3 (por eso se queda al final, después de I) — lo que cambió es que H.9.x **no** cuenta
> como esa superficie temporal: son huecos de spawn/backend que no compiten por archivo con el
> Bloque I y no se vuelven a tocar cuando I lo reescriba.
>
> **Cuarta corrección de orden (2026-09-04, misma sesión, decisión explícita de Carlos):** Codex
> intentó H.9.4 y reportó, honestamente, que no puede cerrarse: el gate necesita evidencia real de
> "qué archivos leyó el CLI", y esa persistencia se absorbió en I.4 (arriba) — no existe en ningún
> otro lado todavía. Es una dependencia cruzada que el orden de arriba no contempló. Decisión de
> Carlos: **H.9.4 queda pendiente/bloqueado, se avanza a I.1 ahora, y H.9.4 se resuelve cuando se
> llegue a I.4** (no antes, no en paralelo). No se reabre esta secuencia otra vez sin razón nueva.

<a id="sprint-30-decision"></a>
### Decisión y por qué (2026-08-18, NO RE-LITIGAR)

Carlos decide adoptar el estándar de facto de la industria para la UI del dashboard. La decisión
**está tomada y no se vuelve a discutir** — ningún LLM debe re-proponer "hacerlo a mano en vanilla",
pedir que se re-justifique, ni volver a plantear el trade-off. Si un LLM cree que hay un problema
técnico concreto en la *ejecución*, lo dice; la *dirección* no se re-abre.

**La evidencia que motivó la decisión sale de este mismo archivo:**

- v0.12 (Sprint 21) tuvo que **inventar 4 reglas de diseño propias desde cero** (anclaje de elementos
  fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS) — ver línea del cierre de
  v0.12 más abajo. Son problemas que Radix UI resuelve de fábrica hace años.
- Sprint 21 registró **13 ajustes "premium dashboard"** con causa raíz individual cada uno.
- El patrón `render()` → `innerHTML` → `wire()` (62 `innerHTML` + 186 `addEventListener`) **es** un
  mini-framework escrito a mano. La pregunta nunca fue "¿meto un framework?" sino "¿mantengo el mío
  o uso el que ya resolvió esto?".
- Costo real medido por Carlos: horas por un `<select>`. Meses de "hacerlo sencillo" salieron **más
  caros en tiempo** que adoptar la librería.

**Verificación externa (2026-08-18)**: Claude Desktop es Electron; el combo dominante en apps de
este tipo es React + Vite/Bun + Tailwind + shadcn/ui. Codex integra shadcn/ui vía MCP como registry
de referencia. shadcn/ui está construido sobre **Radix Primitives** (accesibilidad, foco, teclado,
overflow, z-index ya resueltos) + Tailwind. No hay equivalente igual de maduro para vanilla JS.

