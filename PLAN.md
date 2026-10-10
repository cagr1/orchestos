---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: sprint-30-abierto--fiabilidad-del-recorrido-y-shell-chat-workspace
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo — orden cerrado por Carlos (2026-09-22)

*"Terminar interfaz, luego producto mínimo para entrega y luego corregir"* lo que Opus detectó corriendo dentro de
OrchestOS. Una fase a la vez; lo que no está en una fase no se abre sin GO de Carlos. Restricción que manda en las
tres: harness liviano (ver abajo) — la respuesta dentro de OrchestOS tiene que sentirse igual que el CLI directo,
sin peso extra y con reglas claras.

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13) — CERRADA
Todos sus ítems están archivados en `docs/done/` (UI.13.x, UI.9.8/9.9, UI.10.A, CI.2; el selector nativo de nuevo proyecto lo cerró UI.15).

### Fase 2 — Producto mínimo para entrega (ruta ERP)
**Decisión de Carlos 2026-10-05:** *"primero lo primero, que funcione"* — ERP.4 no se abre hasta que R.8 diga, con
evidencia, que el recorrido funciona; las fallas que R.8 encuentre se corrigen antes. Cerrados y archivados: AT.10,
R.7, ERP.2, ERP.3, I.7, H.5.3, H.9.4. R.8 corto hecho (veredicto: no listo). Abiertos, en orden: R.8.1 → R.8.2 →
R.8.3 → R.8.4 → R.8.5 → R.8.6 (endurecer gates y arreglar lo que rompan) → ERP.4 (piloto) → UI.8.6 (permisos visibles: aprobar en el
chat lo que el CLI va a hacer).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → ERP.5 (qué quitar) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.10.2 (H.9.4 entró a la Fase 2 el 2026-10-05). Los 11 superados por UI.13/UI.14 se retiraron el 2026-09-22 (`docs/done/retirados.md`).

## Restricción de producto: harness liviano — decisión de Carlos (2026-09-17)

**Pedido textual:** *"quiero un harness o orquestador light sin ahogar el trabajo de los agentes
cerebro"*. Origen: usando Orca, Carlos observa que consume ~2 GB de RAM y concluye que OrchestOS
no debe ir por ahí.

**Medición del 2026-09-17, no estimación** (`ps -o rss=`, ambos corriendo en la misma máquina):

| Proceso | RSS |
| --- | --- |
| OrchestOS (`bun run src/cli.ts dashboard`) | **121 MB** |
| Orca (suma de sus procesos, en ese momento) | **1,270 MB** |

OrchestOS ya es ~10× más liviano. **Eso deja de ser una casualidad y pasa a ser un invariante que
se defiende:** toda propuesta que agregue un runtime residente (swarms, memoria vectorial, índice
persistente, servidor extra) declara su costo en RAM antes de entrar, y se compara contra estos
121 MB. Es el mismo criterio con el que `IDEAS.md#64` deja a Serena MCP condicionada a medición
antes/después en vez de adoptarla por fe.

**"Sin ahogar al cerebro" es la otra mitad y limita lo anterior:** liviano no puede significar
recortarle contexto, herramientas o criterio al modelo que piensa. El ahorro sale de *dónde corre
el trabajo* (delegar al ejecutor, que gasta su propio contexto y su propio cupo — medido: 145,664
tokens de Luna que nunca entraron en el contexto del cerebro), no de podar al cerebro.

## Fase 1 — Terminar la interfaz

Cerrada. Todos sus ítems están archivados en `docs/done/` (ver "Cerrados — evidencia archivada" al final).

## Fase 2 — Producto mínimo para entrega

### H.7 — El contexto se llena en silencio y nadie avisa (ABIERTO 2026-09-02)

> **Origen: dogfooding real, sesión del 2026-09-02.** Carlos pasó de 9% a 25% de contexto
> cambiando de Sonnet a Opus, y de 25% a 50% en un chat "prácticamente nuevo". El sistema
> nunca avisó. El síntoma se atribuye normalmente a "el modelo es verboso"; la medición dice
> otra cosa (ver abajo). Es el mismo patrón de fondo que la Regla Cero de `CLAUDE.md`: una
> regla escrita ("cortar a sesión nueva al 70%", [[feedback-limite-contexto-70]]) que ningún
> mecanismo hace cumplir, deja de existir en la práctica.
>
> **Mediciones de esta sesión (evidencia, no estimación).** Del transcript real
> `~/.claude/projects/<slug>/<session-id>.jsonl`, último mensaje `assistant`:
>
> ```
> used = input_tokens(2) + cache_creation_input_tokens(1465) + cache_read_input_tokens(82893)
>      = 84,360 tokens        model = claude-opus-5 (viene en la propia línea del JSONL)
> ```
>
> **Los dos ejes que la UI no separa, y que este ítem sí debe separar:**
> 1. **Ventana de contexto** — se llena dentro del tab, se resetea al abrir uno nuevo.
> 2. **Cupo/costo facturado** — NO se resetea al abrir tab; el tab nuevo re-lee archivos.
>
> **Por qué cambiar de modelo dispara el consumo (mecanismo, no anécdota):** cambiar de modelo
> **invalida el prompt cache**. Todo el historial se re-procesa como `cache_creation` (precio
> completo) en vez de `cache_read` (~10% del precio). En la medición de arriba, 82,893 de los
> 84,360 tokens fueron `cache_read` **porque no hubo cambio de modelo en la sesión**. Regla
> operativa que sale de esto y que vale para cualquier proyecto: **cambiar de modelo al abrir
> un tab, nunca a mitad de una sesión larga.**
>
> **Lo que ya existe y NO se rehace:** `scripts/handoff.ts` + `scripts/agent-handoff.ts`
> (H.4.2, commit `c1c6edc`) ya escriben `.orchestos/handoff.md`. Su propio comentario de
> cabecera declara el hueco: *"no es un gate: no existe un evento 'fin de sesión' universal
> entre Claude/Codex/DeepSeek/OpenCode para engancharlo mecánicamente"*. **El umbral de
> contexto ES ese evento.** H.7 es el disparador que a H.4.2 le faltaba, no un sistema nuevo.
>
> **Viabilidad verificada antes de escribir el ítem** (contra el binario 2.1.234, para que
> nadie la re-investigue): `strings claude.exe` confirma `transcript_path` (11 ocurrencias),
> `SessionStart` (117), `hookSpecificOutput` (124) y `additionalContext` (186). El payload
> que necesita el hook existe.
>
> **Restricciones duras del diseño, no negociables por quien implemente:**
> - **Nada de compactación automática** ([[feedback-no-compactar-contexto]]): se avisa y se le
>   pide a Carlos cerrar el tab. Nunca se comprime la conversación por cuenta propia.
> - **Nada de cambio automático de modelo** ([[feedback-modelo-decision-final-carlos]]).
> - **Costo cero por debajo del umbral**: el hook no imprime nada. Un aviso por turno sería
>   exactamente el mal que este ítem intenta curar.
> - **El handoff lo escribe un script determinista, no un LLM.** Carlos lo planteó explícito:
>   "guardar a cada momento también me consumiría tokens".
> - El umbral es un **porcentaje**, y la ventana se **deriva del modelo del turno** — no un
>   número fijo de tokens. Modelos distintos, ventanas distintas.
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
- [x] **CI.14 — 🔍 GitHub Actions deja de fallar por la misma clase de bug.** (abierto 2026-10-06, GO de Carlos)
  Datos 2026-09-05→10-05: CI rojo en 42/73 pushes en 3 rachas (lint 11-22 sep; `process.env`/HOME 23-24 sep; fixture git
  sin identidad 4-5 oct), todas "pasa en el Mac, falla en Linux". Mutation Shards cancelado 4 noches (10-03→10-06):
  cada mutante corre `src/__tests__` entero; R.7 (`934c7b4`) sumó `tasks-concurrency` (9.5 s) y el dry run pasó de 8 s a
  21 s × 2,227 mutantes > 180 min. Partes: (A) cada shard corre solo los tests que alcanzan sus archivos mutados;
  (B) pre-push corre `test:coverage` sin config global de git, con HOME temporal y PATH mínimo; (C) startup-guard avisa
  al arrancar si el último CI/Mutation/Secret Check/UI gate terminó distinto de `success`. Gate: dry run por shard
  medido; contraprueba de (B) con el fixture sin identidad; tests del guard; disparo manual de Mutation Shards.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/CI.14.md
  Cerrado 2026-10-06. (A) Mutation Shards manual `37480050158` verde 4/4: executors 121 min, orchestration 65,
  runtime-boundaries 37, context-routing 26 (antes: 2 shards cancelados a 180 min las 4 noches). Scores más bajos que el
  10-02 porque el 10-02 contaba kills falsos de un test flaky (`enforceContract`): 615 de 1,881 → ahora 1. Evidencia:
  `docs/done/evidence/CI.14-mutation-2026-10-06.md`. (B) pre-push verde con HOME/PATH/gitconfig tipo CI; contraprueba:
  sin `-c user.*` en el fixture de `tasks.test.ts` falla "Author identity unknown" (con `GIT_CONFIG_GLOBAL=/dev/null` NO
  fallaba: git del Mac deduce la identidad). Destapó y arregló un bug real: el perfil Seatbelt de adversarial-review no
  resolvía symlinks (`/var`→`/private/var`) y la regla de credenciales no aplicaba. (C) startup-guard: 4 consultas
  `gh api` en paralelo, 1.3 s, avisó la Mutation cancelada; sin remoto falla abierto. CI/UI gate/Secret Check verdes en `9fda072`.
  Visto sin ítem: `enforceContract` flaky bajo Stryker → CI.15.

- [x] **CI.15 — 🔍 `contract.test.ts` falla en el sandbox de Stryker por un tmp fijo compartido.** (abierto 2026-10-06)
  Evidencia (reportes `mutation.json` de `36987578986` y `37480050158`): 189 kills falsos en 10-02 y 1 en 10-06 con la
  misma firma: `ENOENT: realpath '.stryker-tmp/sandbox-*/tmp/contract-a1'` justo después de `mkdirSync` del mismo path,
  a veces en `path-policy.ts:60` y a veces en `:74` (el directorio desaparece en una ventana < 1 ms de código síncrono →
  otro proceso lo borra). 77 de los 189 son mutantes cosméticos (strings de `graph-summary.ts`) donde solo falla
  contract: no lo causa el mutante. No reproduce en el Mac: 5/5 corridas de `bun test src/__tests__` verdes y ningún
  `bun test` anidado al muestrear `ps`. Quién borra en Linux queda sin identificar. Arreglo: `TMP_ROOT` único por test
  con `mkdtempSync(tmpdir())` (convención del repo), sin path compartido en `tmp/` del repo. Gate: `contract.test.ts`
  verde, `test:coverage`, y próxima Mutation Shards sin `contract-a1` en ningún `statusReason`.
  Ejecutado por: Luna (gpt-6-luna) · 2026-10-06: arreglo aplicado; `contract.test.ts` 18/18; `test:coverage` verde 3 de
  4 corridas (la 1.ª: 1 fail + 1 error no capturados; las 3 siguientes 1636/0).
  Cerrado 2026-10-10: Mutation nightly `38040297323` (commit `96446ec`, incluye el arreglo) verde 4/4 y 0 menciones
  de `contract-a1` en los 4 `mutation.json`. Quién borraba el path en Linux sigue sin identificar (ya no afecta).
  Sin delegación: este cierre es solo verificación; el arreglo lo aplicó Luna en `42775b5` (spec no versionado).

- [x] **CI.16 — 🔍 `usage-bar` intermitente: la barra muestra la cuota de Claude vieja.** (abierto 2026-10-09)
  Falló 2 de 4 corridas el 2026-10-09 (`an expired Claude window is shown as fully available: Claude Code: 61%`;
  61 % = 100 − 39 del fixture `new-session` anterior). Mecanismo verificado leyendo el código: `handleApiSessionStatus`
  (`src/dashboard/handlers/session-status.ts`) espera el refresco como mucho 3 s y si no, devuelve la caché vieja. El
  refresco (`readActiveSessionStatuses`) incluye la lectura en vivo de la cuota de Codex y tarda 1.5–2.2 s sin carga,
  más de 3 s bajo la carga del gate. La cuota de Claude es una lectura de archivo barata, pero queda atada a la lenta de
  Codex. Es el pendiente anotado "usage-bar falla a veces por `account/rateLimits/read`". Contraprueba: sin la caché de
  R.8.1.1 pasó 1/1, y con ella falló 2 y pasó 2: no lo causa R.8.1.1. Arreglo (GO de Carlos 2026-10-10): separar la cuota de
  Claude (statusline, se lee en cada request) del refresco lento de Codex.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/CI.16.md
  Cerrado 2026-10-10. `withFreshClaudeQuota` en `src/dashboard/handlers/session-status.ts` relee el statusline de Claude
  en las 3 respuestas del GET (la caché sigue para Codex). Tests 6/6; `test:coverage` 1646/0; `gate:evidence
  CI.16-usage-bar` 4 corridas seguidas PASS 18/18 c/u (antes 2/4 fallaban). Sin contraprueba determinista: el fallo
  dependía de que Codex tardara >3 s; queda la serie de 4 verdes como evidencia.

- [ ] **CI.12 — 🔍 `tasks-concurrency` (5 SIGKILL) falla por timeout del lock dentro de la suite completa.** (abierto 2026-10-03)
  Visto 1 vez en el pre-push: `error: file-lock: timeout waiting for …/.orchestos/tasks.lock` → `(fail) … recovers valid
  YAML after five SIGKILL interruptions and accepts a following mutation quickly [14649.63ms]`. Solo pasa 3/3 y pasó en
  2 `test:coverage` completos del mismo día. Hipótesis sin verificar: bajo carga, un lock que dejó un proceso matado
  tarda más en declararse stale que el plazo del test. Archivo: `src/__tests__/tasks-concurrency.test.ts`.

- [ ] **CI.11 — 🔍 El turno 2 de Codex en `codex-live` tardó 180 s contra 22 s del turno 1.** (abierto 2026-10-03)
  Visto una vez en la corrida completa de ui-gates (`$TMPDIR/ui-gate-73235/result.json`, paso "turn 2 is faster than
  turn 1": 22141 ms vs 180113 ms, el timeout del flujo). Sin verificar si es latencia del modelo o un cuelgue al
  retomar el thread. Señalado por la QA de Sol: sacar el flujo del pre-push no puede silenciar este detector.
  Siguiente paso: reproducir con `gate:evidence` y leer el log del app-server de Codex en ese turno.

- [ ] **R.8 — 🔍 Validación independiente del recorrido útil y corrección de evidencia de cierre.**
  Depende de R.1–R.7 y H.9.4. Revisar el recorrido completo: proyecto conectado → conversación →
  tarea/confirmación → ejecución → checks/QA → resultado → recarga y evidencia recuperada;
  incluir continuidad del historial hacia CLI, no solo su presencia en la pantalla. Repetir sobre
  un proyecto externo de prueba, declarar transporte/configuración y registrar resultados por
  intento. La utilidad debe contrastarse además con una tarea real de Carlos: resultado utilizado,
  intervención necesaria y bloqueos, no solo número de tests.
  **Corrección documental necesaria:** I.4 conserva abajo su cierre histórico del 2026-09-05,
  pero su evidencia declara «sin navegador/browser interactivo». No acredita el gate visual
  exigido por el protocolo. Su aceptación integral queda pendiente de este bloque; el `[x]`
  histórico no desbloquea por sí solo H.9.4. Adjuntar aquí evidencia nueva sin borrar el historial.
  **Gate:** navegador real y backend/persistencia observados; suite exacta de CI verde; pruebas
  negativas de privacidad y QA; informe de límites restantes. Cuando use home temporal con runs
  reales, ejecutar el wrapper gate:evidence y verificar conservación de la evidencia pertinente.

- [x] **R.8.1 — 🔍 auto-flow estricto.** (abierto 2026-10-05, GO de Carlos) Exigir `done` (no cualquier estado
  terminal, `auto-flow.mjs:367`), contenido exacto de los archivos producidos, aprobación real (no "sin botón 5 s",
  `:351`) y recarga final que recupere reporte/QA del mismo `taskId`. Incluye el cuelgue intermitente de Codex (CI.11)
  si vuelve a cortar la corrida. Hallazgos 3-4 de `docs/done/evidence/R.8-revision-sol-2026-10-05.md`.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.1.md
  Gate en vivo: `gate:evidence R.8.1-auto-flow` → auto-flow PASS 31/31 (`docs/done/evidence/R.8.1-live.json`):
  `done` exigido, contenido exacto de ambos archivos, Claude arranca sin aprobación (archivo nuevo) y Codex queda
  retenido (archivo previo `codex-nota.md`): `pending` sin `runId` y contenido intacto durante 3 s, arranca tras el
  clic; recarga recupera los dos reportes del mismo `taskId`. Intentos: 1.º FAIL — ninguna petición creó tarea con el
  prompt "con exactamente este contenido, sin comillas ni nada más" (causa no aislada: prompt o azar del modelo; el
  detalle de fallo ahora incluye la respuesta y `git status`); 2.º PASS con "con una sola línea: nota de X".
  No hecho: contraprueba forzando texto esperado erróneo (el 1.º intento sí prueba que el gate falla).
  Límites: QA del reporte → R.8.3; reinicio del backend → R.8.4. Visto: "Loading models…" persiste en el composer
  tras recargar (captura `after-reload`), sin investigar.
- [x] **R.8.1.1 — 🔍 Marcador de tarea al final de la frase y "Loading models…" tras recargar.** (abierto 2026-10-07, GO de Carlos)
  auto-flow 2/4 corridas: la respuesta `… una sola línea: nota de claude. [[orchestos:task]]` (marcador al final de la
  misma línea) no creó tarea y el marcador quedó visible. Arreglo: el marcador cuenta también al final de la última
  línea (a mitad de frase sigue sin contar); detección y limpieza en una sola función de `chat-live.ts`, incluido el
  prefijo parcial durante el streaming. "Loading models…" bloquea el envío ~5 s tras recargar (`AgentComposer.tsx:130-172`,
  `:249`): medir qué petición es la lenta antes de tocar nada. Fuera: cambiar el prompt (`chat.ts:1267`).
  Gate: tests de marcador; `gate:evidence` auto-flow 3 corridas seguidas + `chat-streaming codex-live`.
  Ejecutado por: Luna (gpt-6-luna) · 2026-10-07 marcador: tests 12/12; `gate:evidence R.8.1.1-auto-flow` 3 corridas
  seguidas PASS 31/31 c/u (en ninguna el modelo puso el marcador al final de la frase: el caso real lo cubren los
  tests); `R.8.1.1-chat-live` chat-streaming 17/17 + codex-live 14/14.
  Medición "Loading models…" (dashboard real + Playwright): Home lo muestra 2.9–3.4 s. Causa: el composer pide
  `/api/chat/cli-models` 4 veces por carga (el efecto de `AgentComposer.tsx:128` se repite al cambiar
  `lockedCli`/`defaultCli`) y cada una corre `opencode models --verbose` (0.56 s, 398 modelos, sin caché); se encolan
  0.74→1.4→1.9→2.55 s. `/api/chat/models` ya tiene caché (~1 ms).
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.1.1.md (parte 2)
  Cerrado 2026-10-09 (GO de Carlos). Caché del catálogo CLI en el servidor (`readCliModelCatalogsCached`, TTL 10 min,
  lecturas simultáneas comparten una; no cachea si algún CLI trae `error`), usada por `/api/chat/cli-models`, la
  validación del turno de chat y `/api/models/catalog`. En vivo (Playwright, dashboard real): "Loading models…" se va
  a 1.38 s en la primera carga (antes 3.4 s) y a 146 ms tras recargar (antes 2.9 s). `test:coverage` 1643/0.
  Luna: 1.ª corrida colgada >12 h sin salida ni cambios (matada); 2.ª se detuvo por `EADDRINUSE` en
  `csrf-origin.test.ts`, artefacto del sandbox de Codex que no deja abrir puertos (fuera del sandbox 185/0).

- [ ] **R.8.2 — 🔍 Continuidad historial→CLI tras recarga.** Turno posterior a la recarga que necesite un centinela
  aleatorio del historial sin repetirlo; Claude y Codex. Hallazgo 1.
- [ ] **R.8.3 — 🔍 QA negativo real.** Tarea con salida deliberadamente incorrecta que QA debe rechazar; checks
  ejecutados y criterios visibles. Hallazgo 2.
- [ ] **R.8.4 — 🔍 Reinicio del dashboard a mitad de run.** Recuperar el resultado y el reporte de fin (gap declarado
  de I.7.2); probablemente requiere arreglo de producto. Hallazgo 4.
- [ ] **R.8.5 — 🔍 Privacidad sin depender del modelo.** `read-boundary`: condición dura = el token del fixture nunca
  aparece en respuesta ni en `files_read`; el `rejected` del audit se registra cuando ocurre, no se exige (Claude se
  niega sin invocar Read). Centinelas entre proyectos en el contexto efectivo del CLI. Hallazgo 5.
- [ ] **R.8.6 — 🔍 Pasos que no pueden fallar.** Quitar `true` literales (`auto-flow.mjs:356,360`,
  `project-isolation.mjs:125`, `runs-graph.mjs:198`) y nombres que prometen más de lo que comprueban. Hallazgos 6-7.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

- [ ] **UI.8.6 — 🧠 Permisos visibles (`INS-2026-014`).**
  Hoy **no existe** mecanismo de aprobación en el chat: el harness invoca los CLIs en modo no
  interactivo por diseño (`codex exec --sandbox workspace-write` en `src/run/executors/codex.ts`,
  equivalente en `external.ts`). El documento de dirección lo exige y sin este ítem queda como
  prosa incumplible — el mismo patrón que dejó a UI.3.5 sin efecto.
  Modelo tomado de Orca (§A.6, §A.11): tira permanente de una línea sobre el compositor
  declarando el estado real, más un segmented control honesto `Yolo | Manual` en Settings del
  agente. No un modal que se acepta una vez y se olvida.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

- [ ] **AT.13 — 🧠 El contexto que el chat inyecta al CLI dice la verdad.** (abierto 2026-09-22, pendiente)
  **Absorbido por MR.1.d (Carlos 2026-09-24):** se ejecuta dentro de MR.1, no por separado.
  Origen: autoevaluación de Claude corriendo como CLI dentro de OrchestOS, contrastada contra el
  código por el cerebro. Es backend de `handlers/chat.ts`, independiente del cambio de interfaz de
  esta semana. Confirmado por lectura, sin corrida en vivo:
  1. **El prompt promete herramientas que no tiene.** `chat.ts:1247` dice "may run the CLI tools";
     `run/executors/external.ts:322` solo habilita `Read,Glob,Grep`. El texto se deriva de las
     herramientas reales del adaptador, no de una frase fija.
  2. **Costo desconocido vuelve a ser `$0`.** `chat.ts:1123,1130` hace `Number(r.usd_cost)` y
     `Number(null) === 0`: rompe F0.8 (`run/executors/codex.ts:378`). Mostrar `n/a` y excluirlo del
     total, que pasa a decir que es parcial. Falta ubicar qué ruta guarda runs Codex con costo nulo.
  3. **No escala.** `chat.ts:1115` inyecta la descripción completa de cada task en cada turno.
     Una línea por task (id, estado, qa) y el detalle solo bajo demanda.
  4. **QA falla sin motivo.** Inyectar la última razón de fallo en tasks con `qa:fail`.
  Menor, en la misma pasada si es barato: `detect/profile.ts:15` ignora `typecheck` y
  `test:coverage` (el gate real de CI); `detect/manifest.ts` solo lee el `package.json` raíz y no ve
  React en `src/dashboard/app`. Descartado tras verificar: "runs sin task_id" (ya se imprime,
  `chat.ts:1130`). **Gate:** turno real de chat con Claude CLI y Codex; el contexto capturado muestra
  herramientas reales, `n/a` en costos desconocidos y tasks en una línea.

  **Ampliado 2026-09-22 (Carlos: "que se sienta que está corriendo sin mucho peso y con reglas claras").** Hallazgos
  del turno de Opus dentro de OrchestOS (run `560e910f`, 02:42 UTC) que faltaban: (5) nombres de modelo
  inconsistentes en runs (`codex`, `codex (cli default model)`, `gpt-5.6-luna via Codex CLI`) — normalizar;
  (6) fechas UTC sin etiqueta frente a la hora local; (7) el rol dice memoria/specs pero no llega ni un índice;
  (8) prompt base del CLI y prompt de OrchestOS apilados (ruido y contradicciones). Objetivo medible: el mismo
  pedido, directo al CLI y por OrchestOS, da una respuesta equivalente, con tokens de contexto inyectado medidos
  antes/después.
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
- [ ] **H.7.2c — ⚡ Registro de adaptadores: falta OpenCode.** Hallazgo por código
  (2026-09-08, Claude, verificando el hook H.7.3 a pedido de Carlos — "verifica que esto se
  cumpla para cualquier modelo"). `DEFAULT_ADAPTERS` en `scripts/context-adapters.ts:267` solo
  trae `[claudeAdapter, codexAdapter]`. El diseño del registro sí es genérico por modelo dentro
  de cada CLI (`readTranscriptUsage()` lee el `model` real de la última línea del transcript en
  cada disparo, nunca uno fijo) — pero por CLI es una lista cerrada de 2. Carlos usa OpenCode en
  este mismo proyecto ([[codex-delegation-workflow]] / uso real observado en sesión); con ese
  CLI activo, `readContextBudget()` no encuentra adaptador y el fail-open documentado en
  `context-adapters.ts:117` ("un hook que rompe el turno es peor que un hook que no avisa")
  hace que el aviso de 60%/65% **no aparezca en absoluto, en silencio** — no es un bug, es la
  consecuencia no señalada de una decisión de diseño correcta.
  Aplicar la misma regla ya escrita para este registro (`context-adapters.ts:10`, cita de
  Carlos): "las soluciones no las hacemos una por modelo sino para los LLMs que vengan" —
  agregar `opencodeAdapter` como entrada de datos en `DEFAULT_ADAPTERS`, no un `if` nuevo.
  Antes de escribirlo: verificar contra un transcript real de OpenCode dónde publica
  modelo/tokens/ventana (mismo método que H.7.2b usó para Codex — contrato verificado en vivo,
  no asumido de la documentación). Si OpenCode no publica la ventana en su transcript, resolver
  por catálogo igual que hace `claudeAdapter`, no inventar un fallback por familia.
  **Gate:** sesión real con OpenCode como agente activo, cruzar el 60%, ver el aviso en vivo —
  mismo criterio que el gate 🔍 de H.7.3, no un test que mockee el adaptador.
- [ ] **H.7.3 — ⚡ El hook: avisar al 60% y volcar el handoff una sola vez.**
  Depende de H.7.1, H.7.2 y **H.7.2b** (la fuente del número se rehizo como registro de
  adaptadores — no re-cerrar H.7.3 leyendo el JSONL directo). El hook debe consumir
  `readContextBudget()` del registro, sin saber qué CLI está corriendo.
  `.claude/hooks/context-budget.js`, registrado como
  `UserPromptSubmit` en el `settings.json` **del proyecto** (no el global — el global es
  portable entre máquinas, ver `~/.claude/CLAUDE.md`). Comportamiento:
  - Lee `transcript_path` del JSON de stdin. Si falta o el archivo no existe: **salir 0 sin
    imprimir nada**. Fallar abierto: un hook que rompe el turno es peor que un hook que no
    avisa.
  - `level === 'ok'` → **no imprime nada**. Cero tokens.
  - `level === 'warn'` (≥60%) → dispara `bun run agent:handoff` **una sola vez por sesión**
    (flag `{ sessionId, firedAt }` en `.orchestos/context-budget.json`, gitignored) e imprime
    un aviso de ≤4 líneas: % actual, modelo, ventana, y la instrucción de cerrar el tab.
  - `level === 'critical'` (**≥65%**, bajado desde 75% por decisión de Carlos el 2026-09-03 —
    ver punto 6 de la investigación: el autocompact dispara a ~78% y no se puede desactivar de
    forma fiable, así que el margen debe absorber un turno pesado entero) → aviso corto en cada
    turno. **Este es el único nivel que avisa en cada turno**; en `warn` el aviso es una sola vez
    por sesión (ver BUG-H.7.3-a abajo — hoy el código no cumple esto). Los dos umbrales son
    **dato del registro de H.7.2b**, no constantes en el hook.
  - Presupuesto de tiempo: el hook debe terminar en <500ms; `timeout` de 5000 en la config.
  Gate 🔍 (no se cierra sin esto): correr una sesión real hasta cruzar el 60% y **ver el aviso
  en vivo**, con `.orchestos/handoff.md` escrito y su timestamp posterior al cruce. No vale un
  test que mockee el hook — es exactamente el fallo de "interfaz que no aporta" de la Regla
  Cero, y la razón de [[feedback-verificar-gates-en-vivo]].
  **Implementación lista; gate 🔍 pendiente:** hook de comando registrado en el `settings.json`
  del proyecto con timeout real de 5 segundos (=5000 ms). Lee stdin, falla abierto ante ausencia,
  corrupción, timeout, modelo no publicado o fallo de handoff; `warn`/`critical` genera el
  handoff solo si el `{sessionId, firedAt}` no coincide y `critical` avisa en cada turno. El aviso
  ocupa 3 líneas. La resolución proveedor-neutral de H.7.1 usa solo una coincidencia única del
  catálogo. Prueba end-to-end de ruta normal con transcript real: `claude-sonnet-5` → ventana
  publicada 1,000,000, 17.6%, silencioso, 110 ms. Falta una sesión real ≥60% para verificar el
  aviso visible y el `mtime`; no se suplanta con fixture.
  **Observaciones corregidas (2026-09-02, pedido explícito de Carlos):** el fixture de eval
  crea su commit base con identidad efímera pasada como `git -c`, sin escribir configuración local
  ni global; su test anula configuración global/sistema para reproducir GitHub Actions. El
  pre-push mantiene el comando exacto de CI, pero guarda la salida completa en un log temporal y
  muestra solo las 6 líneas finales al pasar (80 líneas al fallar). Corrida real ✅: 1219 pass /
  0 fail, funciones 74.20%, líneas 63.32%; el output visible quedó acotado y el log conserva el
  diagnóstico completo.

  **Gate 🔍 corrido por Claude el 2026-09-03 — primera pasada, NO PASÓ (bugs abajo). Ambos
  bugs se arreglaron después, dentro del trabajo de H.7.2b (commit `8a6ea80`) — ver
  "BUG-H.7.3-a arreglado y verificado en vivo" / "BUG-H.7.3-b cerrado" más arriba en este
  bloque. Se deja la tabla y el diagnóstico original como evidencia de por qué se reabrió
  H.7.2b. Lo que sigue sin cerrar el ítem: el gate estricto pide una sesión en vivo cruzando
  el 60% dentro de un turno; lo verificado hasta ahora es contra transcripts reales pero
  históricos — falta esa corrida en caliente.**
  Método: se invocó el hook real (`node .claude/hooks/context-budget.js`) con el JSON de stdin
  que le pasa Claude Code, contra **transcripts reales de Carlos** de
  `~/.claude/projects/<slug>/` que ya habían cruzado el umbral — no fixtures sintéticos.
  Medición previa con `bun run context:budget --` sobre 8 transcripts: 3 en `warn`
  (61.5% / 64.2% / 71.9%) y 1 en `critical` (78.0%).

  | Prueba | Transcript | Resultado |
  |---|---|---|
  | `ok` | sesión actual, 17.6% | silencio, exit 0, **103 ms** |
  | `warn` | `b1bb946b…` 71.9% | aviso 3 líneas + handoff regenerado, 237 ms ✅ |
  | `warn`, 2º turno misma sesión | `b1bb946b…` | handoff **no** se regenera ✅ / aviso **se repite** ❌ |
  | `critical` | `7c87bf0a…` 78.0% | "Contexto crítico", exit 0 ✅ |
  | transcript inexistente | — | silencio, exit 0 ✅ |
  | stdin no-JSON | — | silencio, exit 0 ✅ |

  **BUG-H.7.3-a — el aviso de `warn` se imprime en cada turno, no una sola vez.**
  En `.claude/hooks/context-budget.js:18-19` el guard de `sessionId` protege **solo** la
  escritura del handoff; `printWarning(budget)` queda fuera del `if` y corre siempre:

      if (readState()?.sessionId !== sessionId && !writeHandoff(...)) return
      printWarning(budget)   // ← sin guard

  Rompe tres cosas a la vez: (1) el spec de arriba, donde la **única** diferencia declarada
  entre `warn` y `critical` es la frecuencia del aviso — con este bug `critical` no tiene
  comportamiento propio; (2) la propia nota de evidencia de Codex ("`critical` avisa en cada
  turno", que implica que `warn` no); (3) la regla global de `~/.claude/CLAUDE.md` § Costo de
  contexto, punto 4, textual: *"un aviso por turno es el mismo mal que intenta curar"* — 3
  líneas por turno desde el 60% hasta cerrar el tab, en el mecanismo cuyo propósito es
  **ahorrar** contexto. Fix: mover `printWarning` dentro del guard para `warn`, dejando el
  camino de cada turno solo para `critical`.

  **BUG-H.7.3-b — el hook `.js` no tiene test propio.** `scripts/context-budget.test.ts` cubre
  el script `.ts` de H.7.1, no `.claude/hooks/context-budget.js`; grep de `context-budget` en
  los tests no devuelve ninguna referencia al hook. Sin test, BUG-a podía existir con la suite
  en verde — y de hecho existió. Mismo patrón que el hook `pre-commit` desincronizado de la
  Regla Cero de `CLAUDE.md`.

  **Límites declarados de esta verificación** (no se presentan como cubiertos): los transcripts
  usados son reales pero **históricos** — no es una sesión en vivo cruzando el 60% dentro de un
  turno, que es la letra del gate. Y no se pudo distinguir si el hook estaba cargado en la
  sesión activa, porque en `level === 'ok'` su comportamiento correcto es indistinguible de no
  estar registrado ([[reference-settings-json-requires-restart]]). Estado restaurado al terminar:
  `.orchestos/handoff.md` con su contenido original y `.orchestos/context-budget.json` borrado.

  **Fuera de scope declarado:** ninguno.

  **Aclaración 2026-09-03 (evitar falsa alarma repetida): Orca no mide esto.** Carlos vio 84%
  en el indicador de Orca y preguntó por qué el hook no avisaba. Verificado con evidencia:
  Orca muestra el `rate_limits` nativo de la statusLine de Claude Code (`used_percentage` de
  las ventanas de 5h/7 días — cupo de cuenta, ver `~/.claude/cache/changelog.md:3181`),
  reenviado sin cálculo propio por `~/.orca/agent-hooks/claude-statusline.sh` (filtra por
  `"rate_limits"` en el payload). Es el eje **cupo/costo**, no el eje **ventana de contexto**
  que mide H.7.3 (`~/.claude/CLAUDE.md` § Costo de contexto, punto 3). Corrida real en paralelo
  esa misma sesión: hook contra el transcript real dio `pct: 10.66%, level: ok` — correcto para
  esa sesión, el hook no debía avisar. Si esto se repite, **no es un bug del hook**: pedir el
  número que muestra el propio indicador, no asumir que es contexto.
- [ ] **AT.11 — 🧠 Chat CLI extensible: cualquier adaptador registrado, no ramas hardcodeadas por marca.**
  Depende de AT.10. Extraer las ramas `claude`/`codex`/`opencode` de `handlers/chat.ts` a un contrato
  de adaptador que declare detección, comando, stdin/args, env/home de autenticación, parser de
  stream, modelo observado, esfuerzo y capabilities de lectura/escritura. El picker se deriva de
  `chatCapable + detected` del mismo registro: añadir un CLI no puede requerir otro `if` en backend
  y otra allowlist manual en frontend. Gate de arquitectura: registrar un adaptador fixture y un
  tercer CLI real disponible, ejecutar sesión→turno→persistencia sin tocar el router del chat;
  los registros sin adaptador deben decir `chat no soportado`, nunca caer a API/OpenRouter.

## Fuera de fase

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.10 — El gate de evidencia acepta prosa, no el hecho (ABIERTO 2026-09-08, GO de Carlos)

> Por qué existe: incidente R.5 del 2026-09-08 ([[feedback-verificar-gates-en-vivo]],
> [[feedback-revisor-adversarial-cruzado]]). Claude cerró R.5 declarando "Gate en vivo: navegador
> real..." en PLAN.md con `check-live-gate.ts` en verde — pero el gate solo verifica que esa
> *frase* exista (regex sobre `Gate en vivo:.*(navegador|browser|Playwright)`), nunca que el
> hecho (dos procesos concurrentes, exigido por el propio texto del ítem) haya ocurrido de
> verdad. No ocurrió. Lo encontró Astra (GPT, revisión independiente) horas después, junto con 4
> bugs reales de concurrencia/ownership que 1335 tests en verde no habían tocado — el mismo día,
> mismo ítem.
- [ ] **H.10.2 — 🧠 Revisor adversarial nocturno, de un modelo distinto al que implementó.**
  Reabierto 2026-09-08 por Carlos: corregir exclusivamente cinco fallos de H.10.1/H.10.2 antes de
  volver a declararlo cerrado: aislamiento efectivo (filesystem, credenciales, red y timeout) de
  tests generados; `test_path` canónico dentro de `review-evidence` sin traversal, absolutos,
  symlinks externos ni sobreescritura; clasificación de fallos que separa aserción de sintaxis,
  imports, infraestructura y timeout; fail-closed del estado `lastReviewedSha`; y evidencia del
  gate ligada al ítem que se cierra y presente en el contenido staged. Añadir regresiones
  adversariales, ejecutar los gates requeridos y documentar resultados/límites. No activar el
  LaunchAgent, no cambiar `gpt-5.6-sol` y dejar la revisión independiente pendiente: los tests de
  quien implementa no la sustituyen. **Scope declarado:** `scripts/adversarial-review.ts`,
  `scripts/adversarial-review.test.ts`, `scripts/agent-governance.ts`,
  `scripts/agent-governance.test.ts`, `scripts/check-live-gate.ts`, `PLAN.md` y, solo si hace
  falta para el sandbox verificable, el script mínimo versionado que aquel invoque. **Fuera de
  scope declarado:** LaunchAgent/launchd, `package.json`, prompt/modelo configurado, `REVIEW.md`,
  automatización nocturna y cualquier hallazgo ajeno. Estado previo: cerrado 2026-09-08 (Claude implementó + Codex `gpt-5.6-terra` escribió los tests unitarios
  sobre el contrato ya cerrado, delegación explícita de Carlos).
  1. `scripts/adversarial-review.ts` (funciones puras exportadas, `main()` orquesta): toma
     `git diff` desde el último sha revisado (`.orchestos/adversarial-review-state.json`) hasta
     `HEAD` — si ese sha ya no existe (rebase/force-push), cae a `HEAD~1..HEAD` en vez de asumir
     cuánto cubrir. Alcance acotado al diff, no barrido completo del repo (decisión de Carlos).
  2. Corre `codex exec -m gpt-5.6-sol --json --sandbox read-only --ignore-user-config`. El
     stream `--json` **no reporta el modelo usado** (verificado en vivo,
     [[reference-codex-modelo-real-rollout]]) — el script captura `thread_id` del stream
     (`extractThreadId`), busca `~/.codex/sessions/**/rollout-*-<thread_id>.jsonl`
     (`findRolloutPath`), lee el `model` real de la línea `type:"turn_context"`
     (`extractModelFromRollout` — path exacto verificado en el rollout real, no en memoria) y
     **aborta sin escribir nada** si no coincide con `gpt-5.6-sol` (`verifyModelUsed` +
     `main()`). El modelo de una corrida real no es una afirmación del LLM
     ([[feedback-modelo-decision-final-carlos]]).
  3. Prompt adversarial (`scripts/adversarial-review-prompt.md`) por los 4 dominios reales del
     incidente: concurrencia/ownership, frontera de seguridad, evidencia declarada vs.
     producida, contradicción comentario-vs-código. Contrato de salida: un único bloque
     ` ```json ` con un array (vacío si no hay nada real — explícitamente autorizado a no
     inventar).
  4. **Regla dura anti-ruido:** `runFindingTest()` escribe el `test_code` de cada hallazgo bajo
     `review-evidence/*.check.ts` (extensión deliberada, fuera del glob de descubrimiento de
     `bun test` — un hallazgo real no puede romper el CI del propio repo) y lo corre con
     `bun test <ruta explícita>`. Sobrevive solo si el proceso termina con código distinto de 0
     — si el test no falla, se descarta y el archivo se borra en el mismo `main()`, antes de
     tocar `REVIEW.md`.
  5. Hallazgos sobrevivientes → `REVIEW.md` (nuevo, en la raíz, mismo principio que `DREAMING.md`
     — nunca aplica cambios, Carlos decide qué promover a `PLAN.md`/`IDEAS.md`; entradas más
     recientes primero, sin duplicar el header entre corridas — `appendToReviewMd`). El script
     **nunca commitea** — deja el working tree con cambios locales para que Carlos los revise.
  6. `~/Library/LaunchAgents/dev.cagr1.orchestos.review.plist` (creado, **sin cargar todavía en
     launchd** — pendiente de que Carlos confirme activarlo) — mismo patrón que
     `dev.cagr1.memoriesmd.sync.plist` (ya en la máquina): `StartCalendarInterval` 3am, sin
     `pmset wake` (decisión explícita de Carlos: no vale el costo de forzar el despertar de la
     máquina por esto). `bun run review:nightly` (`package.json`) usa la suscripción de Codex ya
     pagada, no API key aparte — por eso no es GitHub Actions.
  **Gate:** `bun test scripts/adversarial-review.test.ts` — 10 pass / 0 fail / 35 expects
  (funciones puras: estado/rango, parseo de stream JSONL, verificación de modelo contra rollout,
  parseo de hallazgos, formato de `REVIEW.md`). Además, **corrida real contra `codex exec`**
  (no simulada) en dos repos git temporales — evidencia completa en
  `scripts/h10-gate-evidence.json`:
  (1) diff con un bug plantado de la misma forma que R.5 (comentario promete verificar el owner
  del lease, el código no lo hace) → el modelo lo encontró, escribió un test, ese test falló
  contra el código real, y la entrada quedó en `REVIEW.md` — texto y test verificados a mano;
  (2) diff limpio (trim de un string, sin nada en los 4 dominios) → cero hallazgos, cero ruido,
  no se crea ni `REVIEW.md` ni `review-evidence/`;
  (3) `expectedModel` deliberadamente distinto al real (`gpt-5.6-sol` corrió de verdad, se pidió
  verificar contra `"modelo-incorrecto-a-proposito"`) → abortó con exit code 1, no escribió
  nada, y **no actualizó el estado** (el sha revisado no avanza, así que la próxima corrida real
  vuelve a intentar ese mismo diff en vez de darlo por hecho).
  **Corrección en curso 2026-09-08 (Codex, no cerrar hasta gates pendientes):** los cinco
  hallazgos se corrigieron en el revisor y sus gates: las pruebas generadas corren bajo
  `sandbox-exec` de macOS con root temporal de escritura, repo solo lectura, `HOME`/
  `ORCHESTOS_HOME` limpios, red denegada y timeout de 30 s; si no existe ese sandbox, se rechaza
  la prueba sin fallback. `test_path` rechaza absolutos/traversal, comprueba ancestros canónicos
  (incluidos symlinks) y no pisa un destino existente. Solo una salida reconocible de aserción
  puede confirmar un hallazgo; sintaxis, import, infraestructura y timeout se registran en
  `*.result.json` con stdout/stderr y se descartan como prueba. El SHA queda inmóvil para spawn/
  timeout de Codex, respuesta ausente, JSON o hallazgos malformados. H.10.1 ahora exige que el
  artefacto sea un blob staged citado en la propia línea `Gate en vivo:` del mismo ítem cerrado.
  **Verificado:** `bunx tsc --noEmit`; `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` — 19 pass / 0 fail / 80 expects; sandbox real adversarial
  comprobó lectura externa, escritura fuera del temporal, credencial inyectada y red local
  denegadas. `bunx biome check` sobre los cinco scripts tocados pasó. **Pendiente, no se
  reclama:** `security:gate`/`test:coverage` completos no terminaron antes del límite de 30 s del
  runner de esta sesión; revisión independiente sigue pendiente y estos tests propios no la
  reemplazan. No se activó el LaunchAgent ni se cambió modelo, prompt o `package.json`.

  **H.10.2-bis — revisión independiente (Claude, 2026-09-08): dos bugs bloqueantes que se
  anulaban entre sí y hacían que el revisor NO pudiera confirmar ningún hallazgo jamás.**
  Encontrados corriendo el recorrido completo, no leyendo el diff.
  1. **El sandbox impedía ejecutar cualquier cosa.** El perfil `(deny default)` solo permitía
     `process*` y unas rutas de lectura; macOS 26 exige además las clases `mach*`, `sysctl*`,
     `signal`, `ipc*` y `system*` para que un binario arranque. Verificado a mano: hasta
     `/bin/echo` moría con SIGABRT (exit 134) y stdout/stderr **vacíos**. Como
     `classifyFindingFailure` clasifica por patrones en la salida, una salida vacía caía en
     `non-assertion-failure` → **todo hallazgo se descartaba, siempre, en silencio**. El revisor
     nocturno habría corrido cada noche reportando cero hallazgos, y eso se habría leído como
     "no hay bugs". Es exactamente el botón que no hace nada de la regla cero de `CLAUDE.md`.
  2. **`bun test <ruta>` sin `./` no ejecuta nada.** Bun trata el argumento como *filtro de
     nombre*; como la evidencia usa `.check.ts` (deliberado, para no entrar al glob de la suite
     del repo), no matcheaba ningún test y no corría ninguna aserción — devolviendo exit≠0
     igual. Con la regla original ("sobrevive si exit≠0"), **cualquier** hallazgo quedaba
     "confirmado" sin haberse probado nada. Verificado: sin `./` → `0 expect() calls`; con `./`
     → `1 fail, 1 expect() calls`. **Esto invalida retroactivamente el gate declarado en la
     primera pasada de H.10.2**: aquel "bug plantado detectado" fue un falso positivo — el test
     nunca corrió. Queda registrado en `scripts/h10-gate-evidence.json` § `invalidatedFirstPass`
     en vez de borrarse.
  **Por qué ningún test los atrapó:** los tests del sandbox verificaban que nada ESCAPARA, pero
  ninguno verificaba que algo FUNCIONARA dentro. Tercera repetición del mismo patrón en el día
  ([[feedback-revisor-adversarial-cruzado]]): un test escrito contra el propio contrato del autor
  hereda su punto ciego. Se agregó la regresión que faltaba — un hallazgo legítimo debe sobrevivir
  con `reason: 'assertion-failed'` **y** con prueba de ejecución (`expect() calls` en la salida),
  no solo con un exit code distinto de 0.
  **Decisión de seguridad, explícita:** se permite `file-read*` amplio (acotarlo volvía a impedir
  el arranque: el dyld cache de macOS 26 vive detrás de firmlinks). La frontera que sí se
  sostiene y se verificó en vivo es **escritura solo al temporal + red denegada + credenciales
  conocidas (`~/.ssh`, `~/.aws`, `~/.codex`, `~/.claude`, `~/.gnupg`, `~/.config/gh`) denegadas**.
  Sin red, leer no permite exfiltrar; residuo aceptado: un test podría copiar lo leído al
  `.result.json` local. `classifyFindingFailure` además distingue ahora `test-passed` (exit 0)
  de un fallo raro, para que el `.result.json` sea legible.
  **Gate (recorrido real, con Codex real, después del fix):** ver
  `scripts/h10-gate-evidence.json`. (1) bug plantado con la forma de R.5 → hallazgo confirmado,
  `reason: assertion-failed`, `1 fail / 3 expect() calls` — la aserción **corrió**; (2) diff
  limpio → cero hallazgos, sin `REVIEW.md` ni `review-evidence/`; (3) mismatch de modelo → aborta
  sin escribir y sin avanzar el SHA. Fronteras del sandbox probadas en vivo con un test que
  intenta violarlas: escritura externa, red y credencial → las tres bloqueadas, `3 pass /
  3 expect() calls` (probando que corrió). `bunx tsc --noEmit` limpio; `bun test` de los dos
  archivos: 20 pass / 0 fail / 84 expects.
  **Además — CI estaba rojo por `lint`, no por los tests.** `bun run lint` (Biome) fallaba con 7
  errores de formato/`organizeImports`; el job venía en rojo desde antes de este bloque (19 de
  los últimos 25 runs). Corregido con `bun run lint:fix` → `bun run lint` exit 0. Causa raíz de
  por qué nadie lo veía: **`lint` no está en `pre-commit` ni en `pre-push`**, así que el único
  lugar donde aparece es CI, y un CI siempre rojo deja de dar señal (mismo corolario ya escrito
  en `CLAUDE.md`). Sumarlo al `pre-push` queda propuesto a Carlos, no hecho.
  **Sigue pendiente, no se reclama:** el LaunchAgent quedó cargado en la pasada anterior
  (`launchctl list` → `dev.cagr1.orchestos.review`) **antes** de que estos dos bugs se
  descubrieran; con el fix ya aplicado el revisor funciona, pero su primera corrida nocturna real
  todavía no ocurrió — hasta que ocurra, el recorrido en condiciones de cron sigue sin evidencia.
  **Portabilidad CI en curso (Codex, 2026-09-08):** Ubuntu no tiene `sandbox-exec`; por ello las
  dos integraciones que ejercitan el sandbox real se saltan únicamente si la sonda inyectable
  declara que no hay sandbox macOS. La sonda cubre de forma determinista Darwin+binario,
  Darwin+ausente y Linux+aun-con-ruta simulada; en Linux el camino productivo conserva
  `infrastructure-error` y `survived:false`, nunca ejecuta evidencia sin aislamiento. En macOS,
  ambas integraciones corrieron: `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` → 21 pass / 0 fail / 87 expects; `bunx tsc --noEmit` y Biome
  de los dos archivos tocaron limpio. Límite explícito: CI acredita la selección portable y el
  fallo cerrado; la frontera real de sandbox se acredita solo en macOS. `test:coverage` y
  `security:gate` se iniciaron localmente pero esta terminal corta su proceso antes de resultado.
  **Evidencia remota:** commit `04e75bd` — CI
  [34285739231](https://github.com/cagr1/orchestos/actions/runs/34285739231) ✅: cobertura,
  typecheck y lint; Secret Check
  [34285739176](https://github.com/cagr1/orchestos/actions/runs/34285739176) ✅: typecheck y
  secretos tracked. No acredita el sandbox macOS, que quedó cubierto por la integración local.
  **Fuera de scope declarado:** `scripts/h10-gate-evidence.json` (el artefacto de evidencia del
  propio gate, exigido por H.10.1 — no estaba en el scope-lock que declaró la corrección) y
  `.orchestos/feature-status.json` (regenerado por el pre-commit desde este mismo PLAN.md).

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

## Retirados

→ [11 ítems superados por UI.13/UI.14, retirados 2026-09-22](docs/done/retirados.md)

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de CX](docs/done/bloque-CX.md)
→ [cerrados de MR](docs/done/bloque-MR.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
→ [cerrados de UI / Sprint 30](docs/done/sprint-30.md)
→ [cerrados de Sprint 1](docs/done/sprint-01.md)
→ [cerrados de Sprint 2](docs/done/sprint-02.md)
→ [cerrados de Sprint 3](docs/done/sprint-03.md)
→ [cerrados de Sprint 4](docs/done/sprint-04.md)
→ [cerrados de Sprint 5](docs/done/sprint-05.md)
→ [cerrados de Sprint 6](docs/done/sprint-06.md)
→ [cerrados de Sprint 7](docs/done/sprint-07.md)
→ [cerrados de Sprint 8](docs/done/sprint-08.md)
→ [cerrados de Sprint 9](docs/done/sprint-09.md)
→ [cerrados de Sprint 10](docs/done/sprint-10.md)
→ [cerrados de Sprint 11](docs/done/sprint-11.md)
→ [cerrados de Sprint 12](docs/done/sprint-12.md)
→ [cerrados de Sprint 13](docs/done/sprint-13.md)
→ [cerrados de Sprint 14](docs/done/sprint-14.md)
→ [cerrados de Sprint 15](docs/done/sprint-15.md)
→ [cerrados de Sprint 16](docs/done/sprint-16.md)
→ [cerrados de Sprint 17](docs/done/sprint-17.md)
→ [cerrados de Sprint 18](docs/done/sprint-18.md)
→ [cerrados de Sprint 19](docs/done/sprint-19.md)
→ [cerrados de Sprint 20](docs/done/sprint-20.md)
→ [cerrados de Sprint 21](docs/done/sprint-21.md)
→ [cerrados de Sprint 22](docs/done/sprint-22.md)
→ [cerrados de Sprint 23](docs/done/sprint-23.md)
→ [cerrados de Sprint 24](docs/done/sprint-24.md)
→ [cerrados de Sprint 25](docs/done/sprint-25.md)
→ [cerrados de Sprint 26](docs/done/sprint-26.md)
→ [cerrados de Sprint 27](docs/done/sprint-27.md)
→ [cerrados de Sprint 28](docs/done/sprint-28.md)
→ [cerrados de Sprint 29](docs/done/sprint-29.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
