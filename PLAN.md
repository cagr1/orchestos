---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: fase-2--solo-fiabilidad-abierta
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo

Orden de Carlos (2026-09-22): *"Terminar interfaz, luego producto mínimo para entrega y luego corregir"*. Lo que no
está en una fase no se abre sin GO de Carlos.

- **Fase 1 — Terminar la interfaz:** cerrada.
- **Fase 2 — Producto mínimo para entrega:** en curso. Sus bloques de producto están cerrados (el último, ADE, el
  2026-11-09); quedan abiertos solo los ítems de fiabilidad de abajo.
- **Fase 3 — Correr dentro de OrchestOS igual que el CLI directo:** todos sus ítems nombrados (AT.11, AT.13,
  AT.19–21, CX.6, ERP.5–7, H.7.2c, H.7.3) están cerrados.
- **Siguiente:** decide Carlos — otro bloque de producto o el mes de uso real.
- **Fuera de fase (2026-11-10):** la auditoría abrió AUD.1–AUD.10 (§ "Abiertos — auditoría"). Ninguno tiene fase ni
  prioridad: las asigna Carlos. Antes de esta nota, el Rumbo no los mencionaba.

Rumbo y notas anteriores: `docs/done/plan-historico-2026-11-09.md` (histórico).

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

## Abiertos — fiabilidad de los gates

Esperan su próximo fallo; el diagnóstico de cada uno está en su ítem.

- [ ] **CI.19 — El `git commit` del fixture falla a veces en el andamiaje de los ui-gates.** Visto 1 vez en
  `qa-negative` (2026-10-11, 1 de 9): `Command failed: git … commit -qm task fixture`, sin motivo porque el helper
  `run` usa `stdio: 'ignore'`. `qa-negative` ya reporta stdout/stderr y exit; los otros 20 flows con el mismo helper no.
  Al próximo fallo, leer el motivo en el `result.json` antes de arreglar; llevar el helper a `scripts/ui-gate/lib.mjs`.
  Fase 1 (2026-10-23): `run` vive en `scripts/ui-gate/lib.mjs` y los 27 flows lo importan; todo fallo dice
  `failed (exit N): <stdout+stderr>`. Gates (cerebro): `plan-doc` 16/16, `project-tabs` 39/39, `model-routing` 18/18;
  `test:coverage` 2012/0 (ejecutor). Sigue abierto hasta el próximo fallo: leer el motivo y escribir la fase 2.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.19-live.json`
  Ejecutado por: claude sonnet (criterio-alt; Sol sin cupo de 5 h)
  Bucle aislado 2026-11-03 (en serie, sin carga): `qa-negative` 3/3 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.76 — `notifications`: a veces el diálogo "Launch Agent" no lista Claude.** (abierto 2026-11-09) En la
  corrida de CI.75 el paso que abre un agente en Dev esperó 30 s `getByRole('dialog').getByRole('button', { name:
  /Claude/ })` (`notifications.mjs:303`): el diálogo mostraba solo Codex y opencode, aunque Claude había respondido
  3 turnos de chat segundos antes en la misma corrida. La lista sale de `GET /api/system/executor-modes`
  (`NewAgentSelectorModal.tsx:48`, `server.ts:561`). Al repetir pasó 10/10. Evidencia:
  `docs/done/evidence/CI.76-notifications-claude-missing.json`. Fase 1: que el fallo deje la respuesta de
  `executor-modes` y la razón por la que Claude salió no disponible.

- [ ] **CI.69 — `usage-bar`: a veces el Enter del composer no envía el turno.** (abierto 2026-11-08) Falló en el
  pre-push de ADE.7/8 (`2e9aae2d`, `1355590c`): `page.waitForResponse` 180 s sin `POST /api/chat`
  (`usage-bar.mjs:309`). Captura: picker de modelo abierto (Luna · medium) y el texto sigue en la caja, así que
  `handleSend` (`AgentComposer.tsx:468`) salió temprano (`orchestratorLoading`, `isLoadingModels` →
  `sendWhenReadyRef`, o catálogo vacío) o el Enter no llegó. Aislado pasó 2/2. Corrió en paralelo con los gates del
  ejecutor de ADE.9 (carga). Mismo terreno que CI.57 (elegir modelo de Codex). Fase 1: que el fallo deje evidencia
  (valor del textarea, picker abierto, `isLoadingModels`/catálogo, requests tras Enter).

- [ ] **CI.57 — `composer-picker`: a veces elegir otro modelo de Codex en Chat no queda aplicado.** (abierto
  2026-11-03) Falló 4 seguidas (pre-push del lote UI.57/58, 2 aisladas, una en worktree de `82820986`) en `Codex
  effort levels remain available` (`composer-picker.mjs:75-87`): tras clic en GPT-6.1-Sol el selector sigue en
  GPT-6-Luna. Luego pasó 11/11 en `50e087e2`, `a4beb111`, y 5 veces en HEAD (Sol 3, cerebro 2): intermitente, la
  bisección no prueba que sea UI.58. Sospecha (opinión de LLM): una actualización tardía del estado del chat pisa
  la selección. Fase 1: que el fallo deje evidencia (modelo del chat en API antes/después del clic, requests entre
  clic y reapertura, captura).
  Fase 1 hecha: si el paso falla, guarda `composer-picker-model-missing.json` y su captura en el `runDir` (red
  `/api/chat*` y `/api/config*` con ms desde el clic, sesión antes/después/al reabrir, botones marcados, esfuerzos
  visibles, estado del botón). Contraprueba forzada con todas las partes (Sol; `lastModel` de la sesión es `null` antes
  de enviar, la red es la evidencia útil); corrida normal 11/11 (Sol y cerebro, `gate:evidence`
  `CI.57-composer-picker`). Abierto hasta el próximo fallo. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `composer-picker` 15/15 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.55 — `tasks`: la tarea real `gate-role-task` a veces no deja `ROLE.md` en el primer intento.** (abierto 2026-11-02)
  Visto 1 vez (pre-push del lote UI.49–55, 2026-11-02): el gate corre Codex real (`gpt-6-luna`); la corrida
  terminó con `retryReason: "missing declared output(s): ROLE.md"`, `retryCount: 1`, `runId: null`, `qaVerdict: fail`, y
  `waitForTaskFinished` (`tasks.mjs:39`) lo toma como fin. Aislado pasa 43/43 justo después. El lote no tocó tareas.
  Evidencia: `docs/done/evidence/CI.55-prepush-fail.log`. Falta: que el próximo fallo deje la salida del CLI de esa
  corrida (stdout/stderr o el log del run) para distinguir modelo, cuota o sandbox.
  Fase 1 hecha: si el paso falla, guarda `role-task-missing-output.json` en el `runDir` del gate con la tarea, las
  filas de run con su detalle (`result`, `executorReply` completo, archivos, checks), las líneas `[cli-spawn]` del
  `dashboard.log` y el estado git/worktrees con `ROLE.md`; el detalle del paso lleva un resumen y la ruta. Contraprueba
  forzada con las 4 partes (Sol); corrida normal 43/43 (Sol y cerebro, `gate:evidence` `CI.55-tasks`). Abierto hasta
  el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `tasks` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Reproducido 2026-11-05 (ejecutor de RUN.1 r2, `tasks` 38/43, con RUN.2 aplicado: no es el bug de `notice`).
  Evidencia `$TMPDIR/ui-gate-88246/role-task-missing-output.json`: run `codex exec --sandbox workspace-write`
  `gpt-6-luna`, 1 iteración, 30 tokens de salida, `executorReply` "I can't make or verify this change because no
  file-editing tool is available in this session"; `retryCount 1`, tarea `pending` (reintento programado). Fase 2,
  dos hallazgos: (a) Codex a veces dice no tener herramienta de edición con `workspace-write` (causa sin aislar);
  (b) `waitForTaskFinished` (`tasks.mjs:39`) toma `pending` con reintento programado como fin.
  Fase 2 hecha: (b) `gate-role-task` sigue el reintento del producto como `gate-first-task` (hasta 3 intentos, cada
  uno con nota `gate-role-task retried` en el resumen); (a) cada intento fallido guarda
  `role-task-missing-output-attempt-<n>.json` con `codexRollouts` (primera línea y últimas 60 del rollout de Codex
  del proyecto temporal). Contraprueba forzada del ejecutor: rollout de 21 líneas capturado. Gates del cerebro: tsc,
  biome, `tasks` 43/43 (`gate:evidence` `CI.55-fase2-tasks`). Abierto hasta el próximo fallo: leer `codexRollouts`
  para aislar (a). Anotado: la escritura del JSON por intento no va envuelta en `capture`.
  Fase 2 por codex gpt-6-luna (mecanico).

- [ ] **CI.54 — `codex-live`: la burbuja del usuario a veces no aparece en 2 s.** (abierto 2026-11-02)
  Visto 1 de 3 (2026-11-02, "turn 1 user message appears before completion"); el pre-push reintenta y lo oculta.
  Fase 1: que el fallo deje evidencia (captura, DOM, composer, timeline, log); fase 2: causa con esa evidencia.
  Fase 1 hecha: si la burbuja falta a los 2 s, el paso guarda `turn1-bubble-missing.png` y un JSON con burbujas,
  cola del hilo, composer, botón, timeline, status del POST, `[chat-turn]` y a qué ms apareció (sigue hasta 15 s).
  Contraprueba forzada (filtro inexistente) con la evidencia completa; corrida normal 14/14 (Sol y cerebro). Abierto
  hasta el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1, r2).
  Bucle aislado 2026-11-03 (en serie, sin carga): `codex-live` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.81 — La corrida nocturna de ui-gates registró sus proyectos de prueba en el `~/.orchestos` real.**
  (abierto 2026-11-09) El dashboard de Carlos tenía 80 proyectos: 78 eran fixtures `orchestos-ui-*` en carpetas
  temporales; 61 nacieron entre las 02:33 y las 08:33 del 2026-11-09 (`last_updated` 12:11Z, misma hora que la
  corrida nocturna sobre `d32a935`), 16 apuntaban a carpetas ya borradas y cada carga de la UI pedía
  `/api/config` por proyecto (149 peticiones, 410 por cada carpeta inexistente). Uno (14:21) lo dejó el runner de
  diagnóstico de CI.78 corrido sin `ORCHESTOS_HOME`. Las corridas manuales de `ui:gate` del mismo día no dejaron
  nada. Limpieza hecha con `POST /api/projects/<id>/purge` (copia previa de la DB en `/tmp/ci78/`); quedan 2
  proyectos. Falta: ver si la corrida nocturna con el código actual (después de CI.72) sigue filtrando — contar
  proyectos `orchestos-ui-*` en `~/.orchestos/db.sqlite` tras la corrida del 2026-11-10 — y, si filtra, cortar la
  causa en `scripts/nightly-ui-gates.ts`/`scripts/ui-gate/run.mjs`.
  Ampliado 2026-11-10 (auditoría, sin causa probada): `run.mjs:391` propaga el home temporal mutando
  `process.env.ORCHESTOS_HOME` del proceso del runner; el hijo del dashboard sí recibe `ORCHESTOS_HOME` explícito
  (`run.mjs:68`), pero `run` de `scripts/ui-gate/lib.mjs:79-81` usa `execFileSync` sin `env` y hereda lo que tenga el
  proceso en ese momento. Cualquier subproceso lanzado antes de la línea 391, o por un camino que no pase `env`
  (p. ej. el runner de diagnóstico de CI.78 que no llevaba `ORCHESTOS_HOME`, ver arriba), cae en el `~/.orchestos`
  real. Hipótesis, no verificada como causa de la fuga del 2026-11-09. Verificación del arreglo: tras la corrida
  nocturna, 0 proyectos `orchestos-ui-*` nuevos en `~/.orchestos/db.sqlite`; y que `run` pase `env` explícito.
  Visto 2026-11-10: tras la corrida nocturna sobre `a3c6648` (50 flows), `~/.orchestos/db.sqlite` tiene 5 proyectos;
  los 2 `orchestos-ui-*` son del 2026-09-24. 0 nuevos. Falta solo que `run` pase `env` explícito.

- [x] **CI.82 — La nocturna corre con el Mac dormido y reporta sus timeouts como rojos.** (abierto 2026-11-10)
  La corrida sobre `a3c6648` duró 01:40–08:50 en batería; `pmset -g log` muestra un `Sleep` cada ~16 min. 13 rojos y
  3 flaky, casi todos timeouts (`build:app` de `auto-flow`: 917135 ms), publicados por el startup-guard como reales.
  Hecho: `runNightly` mantiene `caffeinate -i -s -w <pid>` durante la corrida y guarda en `sleeps` las líneas `Sleep`
  de `pmset -g log` dentro de `[startedAt, finishedAt]`; el startup-guard reporta esa corrida como inválida en vez de
  listar rojos. En batería con la tapa cerrada el Mac duerme igual: la corrida queda marcada, no salvada.
  Gates del cerebro: sonda con el log real (7 MB) → 32 `Sleep` en la corrida del 2026-11-10 (la 1.ª entrega devolvía
  0 por `ENOBUFS` del `maxBuffer` de 1 MB; corregido); `bun test scripts/nightly-ui-gates.test.ts` 12/12;
  `bun run test:coverage` 2492 pass / 0 fail; guard con JSON de prueba → "corrida inválida en a3c6648 — el Mac durmió
  2 veces…". Revisión `qa`: test de publicación intermitente (truncado a segundos) → fixture en el borde de segundo.
  Ejecutado por: codex (mecanico) · Spec: docs/specs/CI.82.md
  Repetidos despierto (2026-11-10, una vez): `appearance` y `opencode-terminal` verdes; `providers`,
  `project-isolation` y `terminal-settings` rojos deterministas (CI.83).

- [x] **CI.83 — `providers`, `project-isolation` y `terminal-settings` rojos por deriva del gate.** (abierto
  2026-11-10) Settings abre en la página del proyecto con dos botones "General" (`providers.mjs:97`); la UI dice
  `Project`/`Library` y el gate espera `Proyecto`/`Biblioteca` (`project-isolation.mjs:289-290`); tras subir la
  fuente, el refit parte `echo ui58-focus` entre filas y `waitEcho` (`terminal-settings.mjs:89-98`) ya no cuenta dos
  apariciones (diagnóstico de `analizar`, reproducido con el xterm instalado; socket y buffer intactos).
  Hecho: clics de Settings acotados al menú lateral (`providers`, y el hermano latente en `shell-look`); orígenes
  `Project`/`Built-in` (SK.1 renombró `library` → `built-in`); `waitOutputLine` exige la línea de salida exacta.
  Gates del cerebro (una vez cada uno, Mac despierto): `providers` 12/12, `shell-look` 75/75, `project-isolation`
  14/14; `terminal-settings` pasa el refit y cae después en el paso del mouse al 125 % (CI.84).
  Evidencia: `docs/done/evidence/CI.83-live.json`.
  Ejecutado por: codex (mecanico) · Spec: docs/specs/CI.83.md

- [x] **CI.84 — `terminal-settings`: al 125 % de escala, arrastrar el mouse no selecciona texto.** (abierto
  2026-11-10) Visible tras CI.83: el paso "mouse selects correct cells at 125 percent"
  (`terminal-settings.mjs:239-264`, de ADE.11 `4631c4fd`) devuelve selección vacía (`detalle: failed`; evidencia
  `ui-gate-26363/result.json`). La evidencia de ADE.11 no registra ese paso. Después tocaron `components/dev/`:
  CI.74, CI.75 (dependencias de hooks), CI.77, CI.79, CI.78. Diagnóstico (`analizar`, 2026-11-10): el gate arrastra
  fuera de `.xterm` (`mousedown` en `x=259` sobre la barra lateral, o en `y=-31`), y además el producto desborda: al
  125 % el host de xterm mide 775×1050 en un panel de 640×860 (`OpenCodeTerminal.tsx:182`, `zoom 1/s` +
  `width/height s·100%`, desde ADE.9 `4ad5dd8e`) → filas y prompt recortados. Spec: `docs/specs/CI.84.md`.
  Hecho: el host de xterm va a `width/height 100%` conservando `zoom: 1/uiScale` (Chromium ya resuelve el `%` contra
  el padre). El gate suma "terminal screen fits panel" al 100 % y 125 %, y comprueba con `elementFromPoint` que el
  arrastre empieza y termina dentro de `.xterm` antes de exigir la selección.
  Gates del cerebro: `terminal-settings` 19/19 (al 125 %: panel 640×860, `.xterm-screen` 600×816; selección
  `ADE9-selection`), `dev-terminal` 16/16, `tsc`, `lint`. Revisión: el cerebro (otro proveedor) leyó el diff: el gate
  queda más estricto.
  Gate en vivo: Playwright `terminal-settings` 19/19 y `dev-terminal` 16/16, `docs/done/evidence/CI.84-live.json`.
  Ejecutado por: codex (criterio) · Spec: docs/specs/CI.84.md

## Abiertos — auditoría 2026-11-10

Hallazgos de una auditoría del código, cada cita verificada en lectura el 2026-11-10. Ninguno implementado. Sin fase ni
prioridad hasta que Carlos las asigne.

- [x] **AUD.1 — El contrato se puede saltar con borrados, prefijos de tooling y rutas raras.**
  (abierto 2026-11-10) Llegan a la rama base sin pasar por él. `readWorktreeDiff` alimenta al contrato desde `git status --porcelain -uall`
  (`worktree-diff.ts:56`) y descarta (a) archivos borrados, `if (!existsSync(full)) continue` (`worktree-diff.ts:117`);
  (b) todo lo que empiece por `.impeccable/`, `.claude/`, `.codex/`, `.opencode/`, `.cursor/`, `.aider/` o termine en
  `.DS_Store` salvo que la tarea lo declare en `output[]` (`worktree-diff.ts:79-92`); (c) rutas con espacios o no ASCII:
  se parsea sin `-z` (`parseGitStatusPorcelain`, `worktree-diff.ts:15-29`), git las entrecomilla, `resolveProjectPath` /
  `existsSync` no encuentran la ruta con comillas y cae en (a). Pero el merge hace `git add -A -- . :!node_modules`
  (`sandbox.ts:205`): todo eso se commitea en la rama de la tarea y se integra a la base. Los 3 executors que usan
  `readWorktreeDiff` (`generic-cli.ts:64`, `opencode.ts:362`, `external.ts:754`) lo comparten. No verificado: si otra
  capa (QA, checks) cubre los borrados. Verificación: test con fixture git real que demuestre que lo commiteado en el
  merge es exactamente el conjunto que el contrato aprobó: un borrado no declarado, un `.claude/hooks/x` no declarado y
  un archivo `con espacio.txt` no declarado hacen fallar la tarea o quedan fuera del commit.
  Hecho: puerta del harness tras `enforceContract` con `listWorktreeChanges` contra el punto de bifurcación
  (`branch.<rama>.orchestosForkPoint`, guardado por `createWorktree`): cubre commits del worktree, staged, borrados y
  rutas con espacios (`-z`). Tooling sin commitear y artefactos del `setup_script` (`orchestosSetupArtifact`) = ruido;
  commiteados = violación. `mergeWorktreeBack` exige las rutas declaradas, rechaza lo commiteado no declarado, agrega
  solo lo declarado con `--literal-pathspecs` y descarta lo excluido antes del rebase. Los commits del worktree se
  conservan (estrategia `commit` intacta). `readWorktreeDiff` omite los artefactos del setup (antes los ejecutores CLI
  fallaban el contrato con cualquier `setup_script` que creara archivos).
  Gates del cerebro: `tsc`, `lint` (282, sin subir), `test:coverage` 2508 pass / 0 fail, 58/58 en los 6 archivos
  tocados. Revisión `qa` (otro proveedor): P1 pathspec glob y P2 rebase bloqueado por lo excluido → corregidos, con
  tests (`worktree-contract.test.ts:348`, `:362`). El spec se amplió 5 veces por casos que no cubría.
  Evidencia: `docs/done/evidence/AUD.1-live.json`.
  Ejecutado por: codex (criterio) · Spec: docs/specs/AUD.1.md

- [x] **AUD.2 — El producto ejecuta `git checkout -- runs-summary.json` en cualquier proyecto del usuario.**
  (abierto 2026-11-10) Es un arreglo específico de este repo (el hook que exporta `runs-summary.json`) metido en el
  producto: `sandbox-policy.ts:94` lo hace al empezar la corrida y `sandbox.ts:229` antes del merge (solo si la base
  está en el checkout); `sandbox-policy.ts:50` además lo excluye del listado de cambios sucios. En un proyecto ajeno con
  un `runs-summary.json` propio, se descartan sus cambios sin avisar. Verificación: test con un proyecto que tenga un
  `runs-summary.json` tracked y modificado: tras la corrida sigue modificado; el comportamiento actual queda detrás de
  una señal del propio repo (config o detección de `scripts/export-runs-summary.ts`).
  Hecho: campo `sandbox.derivedFiles` en `orchestos.config.yaml` (por defecto vacío; este repo declara
  `runs-summary.json`). Rutas validadas una vez en `parseSandboxConfig` (`load.ts`), literales, sin `.`/`..`/absolutas.
  `discardDerivedFiles` solo hace `checkout` de un archivo trackeado exacto (`ls-files -z` = la ruta), uno por uno; el
  chequeo de "sucio" parsea `status --porcelain -z`. Ningún literal `runs-summary` en `src` fuera de tests/comentarios.
  Gates del cerebro: `tsc`, `lint` (282, sin subir), `test:coverage` 2514 pass / 0 fail. Revisión `qa` (otro
  proveedor), 3 rondas: P1 directorio declarado descartaba todo, P1 doble normalización `%xx`, P2 rutas
  entrecomilladas → corregidos con test; slice(3) de la 1.ª línea y checkout múltiple que fallaba entero → los vio el
  cerebro. Queda (anotado en `NEXT.md`, falla hacia el lado seguro): un derivado sin trackear dentro de un directorio
  nuevo bloquea el sandbox (`?? build/`).
  Gate en vivo: sin navegador, clones reales del repo `docs/done/evidence/AUD.2-live.json`
  (declarado → `worktree` y limpio; no declarado → `DirtyTreeError` y el cambio se conserva). El campo vive solo en el
  yaml, sin control en Settings por decisión del spec, así que no hay superficie que abrir en el dashboard.
  Ejecutado por: codex (mecanico) · Spec: docs/specs/AUD.2.md

- [x] **AUD.3 — Una excepción inesperada en el harness no deja fila de run.** (abierto 2026-11-10) El `catch` general
  de `runTask` (`harness.ts:1061-1074`) devuelve `status: 'failed'`, `runId: ''` y `retryReason: unexpected: …` sin
  llamar a `insertRun` (los demás caminos sí lo hacen: `harness.ts:441`, `490`, `543`, `615`, `725`, `900`). La UI y el
  historial no ven ese fallo: rompe "o el porqué del fallo". Verificación: test que fuerce una excepción tras el inicio
  de la corrida y compruebe que existe una fila `runs` `failed` con el motivo.
  Hecho: el `catch` general inserta una fila `failed` con `result: unexpected: …` y devuelve su `runId`, salvo que la
  corrida ya tuviera fila (`runInserted`, marcado tras los 7 `insertRun`); el `insertRun` del catch no lanza. Sin
  `RunContext` o sin routing, `model`/`provider` = `unknown`. Tests: throw antes de `createRunContext` (gate de spec)
  y dentro de la cadena (`harness-evidence.test.ts`). Prueba en vivo por CLI con home temporal: tarea sin Reviewer
  asignado → fila `failed` con el motivo, `docs/done/evidence/AUD.3-live.json`. Gates del cerebro: `tsc`, `lint`
  (282, sin subir; la 1.ª versión lo subía y se corrigió), `test:coverage` 2516 pass / 0 fail. Revisión `qa`: sin
  defectos. La prueba en vivo destapó `model = ''` (corregido) y que `requireSpec` del yaml no se lee (anotado).
  Ejecutado por: codex (mecanico) · Spec: docs/specs/AUD.3.md

- [x] **AUD.4 — El fallo no se guarda como causa clasificada y las piezas de diagnóstico no llegan a la UI.**
  (abierto 2026-11-10) (a) La tabla `runs` no tiene columna de tipo de fallo (`migrate.ts:1320-1340` y los
  `ALTER TABLE runs` posteriores; solo `result`, `qa_reason`, `executor_reply`). (b) El clasificador determinista
  `src/run/executors/cli-failure.ts` lo usan los adaptadores de chat y el executor externo para generar avisos
  (`CliNotice`: `external.ts:2`, `chat-adapters.ts:11`, `codex-app-server.ts:10`, `step-event.ts:1`), no se persiste por
  run. (c) `src/agents/diagnose.ts` clasifica con LLM y describe `parse_error` como "could not be parsed as valid JSON"
  (`diagnose.ts:47`), pero el contrato usa delimitadores `<<<FILE:…>>>` (`contract.ts:37-41`, error en `contract.ts:55`).
  (d) `GET /api/tasks/:id/diagnose` y `POST /api/run/graph` existen (`server.ts:283`, `296`) y nada en
  `src/dashboard/app/src` los llama (el `diagnose?:` de `types/orchestos.ts:111` es solo un campo de tipo). Verificación:
  migración numerada con la causa clasificada; el clasificador determinista rellena la columna; la descripción de
  `parse_error` coincide con el contrato; la UI muestra la causa de un run fallido.
  **Cerrado 2026-11-11**: migración 38 `runs.failure_kind`, los 7 caminos de fallo de `harness.ts` la rellenan
  (`src/run/failure-kind.ts` para el proveedor), chip en la tarjeta del hilo y en Runs, `diagnoseTask` sin LLM cuando
  hay causa. Evidencia: `docs/done/evidence/AUD.4-live.json` (ui:gate `chat-retry-report` 27/27 con step AUD.4;
  `test:coverage` 2523/0). (d) queda para AUD.8.
  Gate en vivo: navegador (Playwright, `ui:gate chat-retry-report` 27/27), `docs/done/evidence/AUD.4-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, enmienda 2) · Spec: docs/specs/AUD.4.md

- [x] **AUD.5 — Tras cada tarea `done` por CLI, una llamada LLM oculta sobre los runs de todos los proyectos.**
  (abierto 2026-11-10, cerrado 2026-11-12 junto con AUD.21; cierre en AUD.21) En `orchestos task run` (`cli.ts:1303-1331`), al terminar `done` se lee `listRuns(20)`
  (`runs.ts:197-207`, sin filtro de proyecto) y, con 3 o más, `analyzeRunPatterns` hace una llamada al rol Auxiliar
  (`analyze/patterns.ts:144-150`) y puede crear propuestas de instinto. Gasto no declarado en `LIMITATIONS.md` y mezcla
  de proyectos en el análisis. Verificación: o se quita del camino de la tarea (queda en `--analyze`, `cli.ts:855`), o
  se filtra por proyecto y se declara en el resumen del run; test que cuente las llamadas al LLM de una tarea `done`.
  Sin delegación: se ejecutó dentro del spec de AUD.21 (caso 9); evidencia y ejecutor en AUD.21.

- [x] **AUD.6 — Los motores matan solo al hijo directo, no al grupo de procesos.** (abierto 2026-11-10, cerrado
  2026-11-12 junto con AUD.22; cierre en AUD.22)
  `external.ts:329-339` y `397` (`proc.kill('SIGTERM')`/`SIGKILL`), `opencode-server.ts:293-296` y `dashboard/terminal.ts:86-90`
  no lanzan `detached` ni matan `-pid`; solo `mcp/readonly.ts:619-624` mata el grupo (`process.kill(-proc.pid)`, lanzado
  con `detached: true`, `readonly.ts:652`). No verificado en vivo: si los CLIs de agente dejan nietos vivos tras un
  timeout o abort. Verificación: fixture con un CLI falso que lance un nieto; tras abortar la tarea no queda ese PID.
  Sin delegación: se ejecutó dentro del spec de AUD.22; evidencia y ejecutor en AUD.22.

- [x] **AUD.7 — Servidor local sin token: cualquier proceso local puede lanzar agentes.** (abierto 2026-11-10,
  cerrado 2026-11-12; GO de Carlos 2026-11-12) Cierre: `guardRequest` en el `fetch` de `startServer`, antes de
  `route()`: `Host`/`Origin` locales (403) y token en `/api/*` (401; el WebSocket de terminal lo lleva en `t`).
  Token persistente en `~/.orchestos/dashboard-token` (600), no por arranque: un reinicio no invalida la pestaña;
  rotar = borrar el archivo. La UI lo toma de `#t=` (URL que imprime `orchestos dashboard`), lo guarda en
  `localStorage` y lo agrega a cada fetch `/api/`; sin token, pantalla "Dashboard token required". Runner de
  ui-gates, `skill curate/fetch` y tests con servidor real lo pasan. qa: P2 (pegar la URL en pestaña bloqueada no
  recuperaba) → corregido + test. Visto y corregido: regresión de AUD.19, cuatro GET globales (`health`, `settings`,
  `setup`, `executor-modes`) exigían proyecto y el runner de ui-gates no arrancaba.
  Texto visible: "Dashboard token required" (identifica la credencial que falta; un ícono no explica el bloqueo).
  Texto visible: "Run orchestos dashboard and open the URL printed in the terminal." (el paso para recuperar acceso).
  Gates: tsc (server y app), lint, `build:app`, `test:coverage` 2612/0; ui-gates smoke, dev-terminal, user-profile.
  Gate en vivo: dashboard real con navegador Playwright y home aislado `docs/done/evidence/AUD.7-live.json`
  (sin token 401, Host/Origin ajenos 403, UI con `#t=` carga y limpia el hash, recarga sin hash sigue, WS sin `t` falla).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.7.md
  `isSameOrigin` devuelve `true` si la petición no trae `Origin` (`http.ts:95-107`); solo se aplica a POST/PUT/PATCH/
  DELETE (`server.ts:177-182`); los GET no se comprueban y no hay chequeo de `Host` (rebinding de DNS). El servidor
  escucha en `127.0.0.1` (`server.ts:615`), lo que cubre la red pero no a otros procesos del usuario ni a páginas de
  otros puertos en GET. Es además prerrequisito de cualquier empaquetado desktop (IDEAS #41). Verificación: token por
  arranque exigido en `/api/*` (o `Host` + `Origin` obligatorios), test de petición sin credencial = 403.

- [ ] **AUD.8 — Código y endpoints sin uso.** (abierto 2026-11-10) Módulos que nada importa fuera de `src/__tests__/`
  (grep del 2026-11-10 en `src/`, `scripts/`, `package.json`): `src/db/backup.ts` (`db-backup.test.ts`),
  `src/db/retention.ts` (`retention.test.ts`; `LIMITATIONS.md` ya lo decía) y `src/agents/hardening.ts` (ni siquiera
  un test lo importa). Endpoints servidos por `server.ts` que nada de `src/dashboard/app/src` llama: `/api/run/graph`
  (`server.ts:296`), `/api/instincts/propose` (`320`), `/api/runs/analyze` (`211`), `/api/skills/curate` (`377`),
  `/api/skills/pro` (`356`), `/api/project/context/regenerate` (`412`), `/api/tasks/init` (`261`); además
  `scripts/ui-gate/flows/project-tabs.mjs:207` sí llama `/api/instincts/propose`. Verificación: por cada pieza, o se
  cablea a una interfaz, o se borra con su test y el grep queda vacío.

- [ ] **AUD.9 — ui-gates: `chat-timeout` rojo permanente en la nocturna y cobertura solo en Chromium.**
  (abierto 2026-11-10) (a) `chat-timeout.mjs:5-6` lanza error si `ORCHESTOS_CHAT_TURN_TIMEOUT_MS !== '4000'`; ninguna
  parte del repo la fija (grep: solo el flow y `handlers/chat.ts:1669`); `nightly-ui-gates.ts` ejecuta todos los flows
  de `scripts/ui-gate/flows` (`:238-246`) con `env` sin esa variable (`:165`) y `run.mjs:62-68` solo hereda
  `process.env`. Inferido por lectura, no confirmado en el resultado de una corrida nocturna. (b) Todos los gates usan
  `chromium.launch()` (`run.mjs:222`); Safari/WebKit no se prueba (relevante para IDEAS #41, Tauri). (c) Lo del home
  temporal está en CI.81 (ampliado). Verificación: la nocturna deja `chat-timeout` verde sin intervención (el flow o
  el runner fijan el valor); decisión de Carlos sobre añadir WebKit.

- [ ] **AUD.10 — Mutación: `harness.ts` y `contract.ts` no están en ningún shard de la nocturna.** (abierto 2026-11-10)
  `.github/workflows/mutation-nightly.yml:20-40` corre 11 shards (`executors-engines`, `-engines-b`, `-routing`,
  `-routing-b`, `-routing-c`, `-codex-server`, `-codex-server-b`, `-codex-server-c`, `-codex-engines`,
  `runtime-boundaries`, `context-routing`) y ninguna de sus configs nombra `harness.ts` ni `contract.ts` (grep en
  `stryker*.config.mjs`). Solo `stryker.run.config.mjs` los cubre con el glob `src/run/**/*.ts`, y el workflow no la
  usa. Configs en la raíz que el workflow no ejecuta: `stryker.config.mjs` (`qa.ts`), `stryker.checks.config.mjs`,
  `stryker.sandbox-policy.config.mjs`, `stryker.graph-runner.config.mjs`, `stryker.run.config.mjs`,
  `stryker.run-executors.config.mjs`, `stryker.run-executors-codex.config.mjs` (los scripts `mutation:*` existen en
  `package.json:54-71`). No verificado: si alguna se corre a mano o desde otro workflow (`ci.yml` no menciona
  mutación). Verificación: un shard nuevo para `harness.ts`/`contract.ts` en el workflow, o la decisión escrita de
  dejarlos fuera con su motivo.
- [x] **AUD.11 — Validación a mano de `tasks.yaml` deja pasar valores inválidos.** (abierto y cerrado 2026-11-11)
  `src/tasks/schema.ts`: `output`/`input`/`depends_on` revisan cada elemento, `status`/`qa_verdict` el conjunto,
  `timeout_ms`/`expect_exit` exigen entero en rango, raíz no-mapping da error propio. Evidencia:
  `src/__tests__/tasks-schema-strict.test.ts` 22 pass; `bun run test:coverage` 2545 pass 0 fail; los 6 `tasks.yaml`
  reales de la máquina cargan igual antes y después; `qa` (Sol): sin defectos. La auditoría de los demás validadores
  abrió AUD.12–AUD.17 (lectura de un subagente; 1–5 contrastados por el cerebro en el código).
- [x] **AT.22 — El cerebro hace fixes chicos él mismo; el hook solo bloquea los grandes.** (abierto y cerrado
  2026-11-11, pedido de Carlos: "si son fixes pequeños los hagas tú") `.claude/hooks/brain-no-code.js` deja pasar
  `Edit`/`MultiEdit` en `src/`, `tests/`, `scripts/` de hasta 20 líneas por llamada; `Write`, Bash, `replace_all` y
  `.claude/hooks/` siguen bloqueados; las rutas se normalizan (`src/../.claude/hooks/x` → bloqueado). Evidencia:
  `tests/hooks/brain-no-code.test.ts` 23 pass; `qa` (Sol) encontró `replace_all` y `../` sin tope, corregidos y
  re-verificados por el cerebro reproduciendo sus payloads (deny) y un edit chico en `src/` (allow).
- [x] **AUD.18 — Sellar la validación de entradas externas: una puerta con Zod y un gate que solo deja bajar.**
  (abierto y cerrado 2026-11-11, GO de Carlos) `src/boundary/index.ts` (`check`, `parseJson`, `parseYamlText`,
  `readBody`, `badRequest`, `timeoutMs`; nunca lanza) sobre Zod 4.6.7, ya dependencia directa. Gate
  `scripts/boundary-budget.ts` en pre-commit: cuenta sobre el AST de TypeScript las llamadas a `JSON.parse`, `.json()`
  y `parse` de `yaml` (alias y namespace incluidos) fuera de `src/boundary/`, contra `scripts/boundary-budget.json`
  (63/64/13 = 140), que solo baja. Evidencia: 14 tests (boundary + gate); contraprueba `JSON.parse('1')` → exit 1;
  `bun run test:coverage` 2569 pass 0 fail. `qa` (Sol) halló 1 P1 (un transform que lanza escapaba) y 4 P2 de
  evasión del contador por regex; el P1 lo arregló el cerebro (fix chico, AT.22) con test, y el contador pasó a AST;
  el cerebro reprodujo los 10 casos de evasión. No cubre: alias de la función (`const p = JSON.parse; p(x)`). La
  migración de los 140 sitios va con AUD.12–AUD.17: cada ítem baja el presupuesto.
  Ejecutado por: gpt-6-luna (mecanico); fix del P1 Claude Opus 5.5 (cerebro) · Spec: docs/specs/AUD.18.md
  **Fuera de scope declarado:** `PLAN.md` registra el cierre y `.orchestos/feature-status.json` lo refleja.
- [ ] **AUD.12 — Timeouts e iteraciones de config sin tope: un valor grande mata el run al instante o lo deja sin fin.**
  (abierto 2026-11-11) `setTimeout` con más de 2^31−1 ms, negativo o NaN dispara a 1 ms (reproducido en Bun). Entradas:
  `src/config/load.ts:298-302` (`external.timeoutMs`, solo `typeof`), `src/dashboard/handlers/config.ts:304-310` y
  `:380-386` (`externalTimeoutMinutes`, sin tope), `src/run/executors/cli-registry.ts:257-263`; destino
  `src/run/executors/external.ts:337-340`, `generic-cli.ts:26,40`. `agentic.maxIterations` (`load.ts:290-294`,
  `config.ts:297-303`) acepta `.inf`/`1e12`/`0`/`2.5` y es la única cota del loop (`src/providers/tool-call.ts:642`).
  Verificación: entero en rango en carga y en PUT, test por borde.
- [x] **AUD.13 — Seguridad: aprobación automática de comandos "read-only" de Codex sin mirar la ruta.** (cerrado
  2026-11-12 junto con AUD.23, mismo diff y evidencia `docs/done/evidence/AUD.23-live.json`) Cierre: `readOnly` exige
  `cwd`, `commandActions[].path` y rutas del comando dentro del proyecto; opciones con ruta, comillas o cualquier `$`
  → se pregunta (lista permitida de caracteres: sin `$ \ {} [] * ? ~`); el permiso "siempre" no aplica con `cwd` fuera; OpenCode con una entrada sin `file` → se pregunta.
  Spec compartido con AUD.23 (`docs/specs/AUD.23.md`, nunca commiteado).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.13.md
  (abierto
  2026-11-11) `src/run/executors/codex-approval.ts:54-66` marca `readOnly` solo por `commandActions[].type` y un regex;
  no cruza `cwd` ni la ruta de cada acción con `projectRoot`, y `src/run/approvals.ts:49` aprueba solo en `supervised`
  (p. ej. `cat ~/.ssh/id_rsa`). Igual en `src/run/executors/opencode-approval.ts:18-22`: entradas de `metadata.files` sin
  `file` se descartan. No verificado: que Codex clasifique así ese comando. Verificación: test con ruta fuera del
  proyecto → pide aprobación.
- [ ] **AUD.14 — Salidas de LLM sin validar tumban el run.** (abierto 2026-11-11) `JSON.parse(tc.function.arguments)`
  sin `try` y `data.choices[0]` sin comprobar (`src/providers/tool-call.ts:216-220`, `:581-586`,
  `src/providers/openrouter.ts:118-124`); input de herramientas casteado en `src/run/executors/agentic.ts:194-200`
  (`write_file` sin `path` → `TypeError` en `path-policy.ts:21`, run abortado); borrador del planner
  (`src/dashboard/handlers/project.ts:268-283`); `frequency` declarada por el LLM en `src/analyze/patterns.ts:181-186`;
  campos de streams de CLI (`external.ts:612-623`, `opencode.ts:141-146`, `codex.ts:276-287`). Verificación: el error
  vuelve al modelo como resultado de herramienta, no aborta el run.
- [ ] **AUD.15 — `effort` y `roles.*.agent` sin comprobar contra el conjunto permitido.** (abierto 2026-11-11)
  `src/dashboard/handlers/chat.ts:1380-1385` (`chatEffortLevelsForAgent` existe en `:157` y nadie lo llama),
  `tasks.ts:307-308`, `config.ts:188,231`; `src/config/load.ts:162-165` castea `obj.agent as RoleAgent`. Falla tarde, en
  la CLI, a veces tras crear el worktree.
- [ ] **AUD.16 — Skills: `validateSkill` devuelve el objeto crudo y el id de la URL no se cruza con el del contenido.**
  (abierto 2026-11-11) `src/skills/registry.ts:138-226` (`when_to_use: "x"` → `.map is not a function` en
  `src/skills/targets/_shared.ts:15`, rompe el prompt de QA); `src/dashboard/handlers/skills.ts:160-186`, `:593-622`;
  índice del registry casteado en `src/skills/fetch.ts:47-48,73`; el import ignora `review.status: rejected`.
- [ ] **AUD.17 — Bodies y archivos con tipo incorrecto dan 500 en vez de 400; `.env` admite saltos de línea.**
  (abierto 2026-11-11) `POST /api/settings` (`src/dashboard/handlers/setup.ts:172-186` → `settings-store.ts:62-66`)
  escribe `"x\nOPENROUTER_API_KEY=…"` como línea nueva en `~/.orchestos/.env`. Resto: casts `as T` en `tasks.ts:276-295`,
  `instincts.ts:58-62,84-88,117`, `specs.ts:12-16`, `chat.ts:142-145,253,876`; body `null` en `run-graph.ts:75`,
  `system.ts:8`, `skills.ts:217`; `package.json.name` no string (`src/detect/manifest.ts:20`); línea JSON-RPC `null`
  (`src/mcp/server.ts:125,232`, `codex-app-server.ts:173-177`); precios de OpenRouter sin rango
  (`src/router/model-catalog.ts:166-172`).

### Abiertos — auditoría 2026-11-11

Segunda auditoría, completa (`docs/auditoria-2026-11-11.md`: evidencia `archivo:línea` por ítem, qué se contrastó y
qué no). Cada ítem es una clase de falla con varios sitios; el spec comprueba antes los marcados "sin contrastar".

- [x] **AUD.19 — Aislamiento entre proyectos: datos de un proyecto se leen, mezclan o borran desde otro.** (abierto y
  cerrado 2026-11-11) Cierre: reset, `run_steps` (migración 39, filas viejas con `project_id` null), costes, PDF,
  `CONTEXT.md`, reporte de tarea, sesión general, skills/specs y instintos, por proyecto; `requireProject` en las rutas
  de archivos/procesos (lista en la evidencia); `App.tsx` conserva el proyecto al cerrar agente, en pestañas y en Run.
  qa vuelta 1: `qa_reason` del chat solo por `task_id` → corregido + test. Vuelta 2: `/api/providers` sin proyecto
  lanza la sonda de la CLI sin `cwd` → descartado (sonda global, igual con proyecto). Visto en vivo y corregido: con
  cero proyectos `GET /api/config` daba 400 al cargar; GET config/providers no exigen proyecto (solo lectura).
  Gates: tsc, lint, `test:coverage` 2603/0; los 12 tests nuevos fallan sin el arreglo. Sin probar a ojo: las tres
  carreras de cambio de proyecto de `App.tsx` (cubiertas por el diff, no por gate en vivo).
  Gate en vivo: dashboard real con navegador Playwright y home aislado, dos proyectos `docs/done/evidence/AUD.19-live.json`
  (`project=none` 400 sin escribir en el cwd, reset de B conserva A, UI carga sin pageerror ni 4xx/5xx).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.19.md
  `db/reset.ts:16` borra los runs de todos; `db/run-steps.ts:69-80` identifica pasos solo por `task_id`;
  `handlers/project.ts:340` y `context/compress.ts:45` usan runs globales; `skills/compile.ts:8` y
  `handlers/specs.ts:26-37` asumen que el proyecto es el cwd/OrchestOS; `server.ts:166` da el cwd a `project=none`;
  `App.tsx:1053,845,1505` pierde o cruza el proyecto. Verificación: test con dos proyectos y el mismo id de tarea por
  cada sitio; `project=none` rechaza rutas de proyecto.
- [x] **AUD.20 — Pérdida de datos del usuario: escrituras que pisan sin resguardo.** (abierto y cerrado 2026-11-11)
  Cierre: 9 casos + 3 vueltas de qa (8 defectos corregidos: temporales ajenos/propios, rollback y limpieza que no
  tapan el error, permisos tras rename, versión de archivo `~N`, `..` en `validateTaskId`, detect por `readBody`).
  `specPath` acepta el mismo id que el dashboard salvo `..`. Gates: tsc, lint, `test:coverage` 2592/0; los tests
  nuevos fallan sin el arreglo. Queda: el YAML inválido de config se sigue reemplazando entero (`config.ts`, fuera
  de alcance).
  `detect`/`init` sobrescriben `AGENTS.md` (`cli.ts:84,104`, `handlers/project.ts:71`); `spec/store.ts:57-63` escribe
  en la ruta que diga el id del frontmatter (`../../README`); `spec/archive.ts:44-48,66,77` pisa, borra por sufijo y
  pierde campos; escritura parcial del contrato en cwd (`contract.ts:103`); PUT de config sin serializar
  (`handlers/config.ts:326,402`). Verificación: test por caso; el archivo previo se conserva o se pide confirmación.
  Gate en vivo: sin navegador, dashboard real por HTTP `docs/done/evidence/AUD.20-live.json` (home aislado; ninguna
  pantalla usa estas rutas): detect sin force 409 y AGENTS.md intacto; spec `foo..bar` 400; dos PUT de config
  simultáneos conservan ambos campos y el modo 600.
  Ejecutado por: gpt-6.1-sol (criterio) + mecanico + claude-opus-5-5 (fixes chicos)
- [x] **AUD.21 — Ejecución de tareas: errores aceptados como éxito y límites que no se aplican.** (abierto 2026-11-11,
  cerrado 2026-11-12 con AUD.5)
  `dryRun` después de crear worktree y correr `setup_script` (`harness.ts:190-197` vs `:283`); sandbox explícito sin
  rama corre en el cwd (`graph-runner.ts:472`, `harness.ts:196`); `is_error` de Claude sin mirar en tareas
  (`external.ts:733-755`); `task run --id` sale 0 al fallar (`cli.ts:1401`); `retry_count`, `--all` y límites del
  grafo (`cli.ts:1359,1411`, `graph-runner.ts:160,211,428,546`). Verificación: test por caso con CLI falso.
  Cierre: `dryRun` sin sandbox ni worktree; el grafo resuelve rama con `resolveSandboxMode(root, mode)`; `is_error`/
  `api_error` de Claude falla la tarea; `task run --id` sale 1 si no es `done` (id inexistente incluido); los fallos
  suben `retry_count`; `--all` lista lo no `done`, avisa el tope de 20 y para en `blocked`; límites de costo y tiempo
  antes de cada intento y cada tarea (`skipped_circuit_breaker`); `blocked` del harness sin reintento ni diagnose.
  AUD.5: borrada la llamada al Auxiliar tras `done`; `runs --analyze` filtra por proyecto como el dashboard. Fuera:
  `agentic.ts`, `providers/codex.ts`, `tool-call.ts` (resto del anexo). Gates: tsc, lint, `test:coverage` 2672/0;
  afectados 43/0 corridos por el cerebro. Gate en vivo: sin navegador (ninguna pantalla), CLI real con home y repo
  temporales, `docs/done/evidence/AUD.21-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio), diff revisado por claude-opus-5-5 · Spec: docs/specs/AUD.21.md
- [x] **AUD.22 — Procesos, streams y sesiones de motor.** (abierto 2026-11-11, cerrado 2026-11-12 con AUD.6) `opencode.ts:174-216` no drena
  `stderr`; timeouts sin SIGKILL (`codex.ts:199`, `external.ts:337`, `opencode.ts:182`, `checks.ts:225`); el `exit`
  de un app-server viejo rompe el nuevo (`codex-app-server.ts:142,1089`); quitar todas las herramientas no recrea el
  hilo de Codex (`codex-app-server.ts:746-751`); carrera al recuperar el candado (`file-lock.ts:77-84`). Va junto con AUD.6. Verificación: CLI falso que llena `stderr`, que
  ignora SIGTERM y que cambia de herramientas entre turnos.
  Cierre: `src/run/process-tree.ts` (`spawnTree` detached, `killTree` al grupo, `terminateTree` SIGTERM→SIGKILL a
  los 2 s también a nietos tras salir el líder, `killAllTrees` en la parada del dashboard y en `exit`) en claude,
  codex, opencode, checks, `opencode serve`, terminal, readonly y app-server; opencode drena stderr; error leyendo
  stdout termina proceso y timer (un fallo de `onStep` sigue sin abortar); el `exit` de un app-server viejo no toca
  al nuevo; quitar las herramientas reemplaza el hilo; el candado se recupera bajo `.recover` con token releído.
  Fuera: ruta `exec` de codex, sondas `--version` síncronas, spawn fallido de la terminal, caché del OCR. Gates: tsc,
  lint, `test:coverage` 2686/0. qa: 3 vueltas, 1 P2 corregido (nieto vivo si Bun salía antes del plazo). Gate en
  vivo: sin navegador, procesos reales con CLIs falsos, `docs/done/evidence/AUD.22-live.json`. Sin probar en vivo:
  cerrar una terminal real del dashboard con un nieto dentro.
  Ejecutado por: codex gpt-6.1-sol (criterio) + mecanico (enmienda) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.22.md
- [x] **AUD.23 — Seguridad: confinamiento por symlink y redacción de secretos.** (abierto 2026-11-11, cerrado
  2026-11-12 junto con AUD.13) Cierre: `realPathWithin` resuelve symlinks segmento a segmento (colgantes y encadenados
  con `..`) y lo usan explorer, git diff, specs, skills, `task.input` del prompt, `approvalPathWithin` y
  `resolveProjectPath`; symlink roto no tumba el listado; `redactSensitive` sin excepción de placeholder; PEM
  multilínea staged → `check-secrets` rojo; `spawn-trace` redacta args y stderr; `.env` 600 y atómico; puerto no
  estándar bloqueado también en IPv4. Fuera: destino de clon (lo elige el usuario; AUD.7 exige token). qa: 4 vueltas,
  5 P1 corregidos (symlink encadenado, `--file=/ruta`, comillas/`$HOME`, `\/etc`, comodines): la regla de Codex pasó a
  lista permitida de caracteres + realpath de cada argumento. Residual aceptado: `-fleak.txt` con symlink preexistente. Gates: tsc, lint, `test:coverage` 2635/0
  (+ tests afectados 100/0 tras las correcciones). Sin probar en vivo: las aprobaciones (requieren un turno de Codex
  real; cubiertas por tests con el código real del adaptador).
  Gate en vivo: dashboard real por HTTP con home aislado y symlinks hacia fuera, sin navegador (ninguna pantalla nueva) `docs/done/evidence/AUD.23-live.json`
  (árbol 200 con symlink roto, archivo/carpeta/git diff por symlink → 403 sin filtrar contenido).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.23.md
  `handlers/explorer.ts:44-48,120` confina lecturas solo por texto de ruta; `security/secrets.ts:47-50` no redacta un
  secreto que contenga `test`/`example`; `scripts/check-secrets.ts:19-26` no ve claves multilínea;
  `spawn-trace.ts:8-10,57` registra argumentos cortos y `stderr` crudos; symlink colgante pasa `path-policy.ts:63-72` y
  `approvals.ts:30-34`; `prompt.ts:43-47` lee inputs sin política de rutas; permiso "siempre" sin `cwd`
  (`approvals.ts:54`); `.env` sin 0600 (`settings-store.ts:62-67`); puerto sin validar en IPv4 (`ssrf.ts:105-112`). Verificación: test con symlink hacia fuera →
  403; secreto con `test` dentro → redactado; PEM staged → gate rojo.
- [x] **AUD.24 — Chat: turnos que quedan pendientes o no se pueden guardar.** (abierto 2026-11-11, cerrado 2026-11-12) Lease de 150 s sin
  renovar (`db/chat-turns.ts:45`, `handlers/chat.ts:1015`, sin contrastar la renovación); error antes del `catch`
  interno (`chat.ts:1944`); repetir un turno fallido da 500 (`chat.ts:1051`); adjunto ausente descartado en silencio
  (`chat.ts:1304`); recarga durante un turno pierde la actividad (`OrchestChatView.tsx:88`). Verificación: turno de
  más de 150 s con CLI falso queda guardado; ui-gate de recarga a mitad de turno.
  Cierre: `renewTurnLease` (no resucita un lease vencido) renovado cada lease/5 mientras vive el turno;
  `registerChatTurn` dentro del `try` y el `catch` externo marca `failed` (500) en vez de dejar `pending`; `requestKey`
  de un turno `failed` → 409 con el error guardado; adjunto ausente → 400 y turno `failed` antes del proveedor;
  `OrchestChatView` trabaja con `isWorking || thread.running` (Stop y actividad tras recargar) y `settleChatTurn`
  (`App.tsx`) recarga el hilo al terminar, con reintento 1/2/4 s y generación por envío local; POST correcto + GET
  fallido ya no restaura el borrador. También en AUD.24 (informe): `App.tsx:1374,1427`. Gates: tsc, lint,
  test:coverage 2693/0; qa 4 vueltas (3 P2 de la recarga corregidos); `docs/done/evidence/AUD.24-live.json`.
  Gate en vivo: navegador Playwright, `chat-stop` 24/24, `docs/done/evidence/AUD.24-chat-stop-result.json`.
  Con Claude real: recargar a mitad de turno devuelve Stop y la respuesta queda guardada.
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes de revisión) · Spec: docs/specs/AUD.24.md
- [x] **AUD.25 — UI que no hace lo que muestra.** (abierto 2026-11-11, cerrado 2026-11-12) `!comando` no ejecuta en Dev
  (`OrchestDevWorkspace.tsx:432`, `App.tsx` no pasa `onRunCommand`) ni en Chat (`OrchestChatView.tsx:310`); el kanban
  no tiene columna `failed` (`PlanBoardView.tsx:98-104`); `purgingProjectIds` no se limpia al terminar bien
  (`App.tsx:1094-1143`); regla "Executor model" inválida (`OrchestSettingsView.tsx:1048,3727`); Enter confirma con el foco en Cancel
  (`ConfirmDialog.tsx:38-42`); búsqueda del
  inspector (`OrcaRightInspector.tsx:297,576`). Verificación: en vivo en el dashboard, un step de ui-gate por caso.
  Cierre: `!cmd` en Dev se escribe en el PTY del tab terminal (lo reabre si la shell terminó); en Chat `!` es texto;
  columna `failed` en el kanban; "Plan" pide y limpia su resultado (solo escribe la última petición); la purga limpia
  `purgingProjectIds` en `finally`; "Executor model" válido para el agente Ejecutor; Enter sobre un botón no confirma;
  el árbol muestra carpetas con descendientes que coinciden y "contents" usa `GET /api/explorer/search` (`git grep`
  sin shell, tope 200, 5 s); Dev muestra todas las lecturas, ediciones y comandos; Instincts/Memory esperan el
  guardado; subidas abortadas al desmontar; del informe: consumo Codex por evento, cada `<script type="module">`
  por separado, clave de lenguaje normalizada en scaffold. Hallado al verificar (ya existía): tras purgar, `/branches`
  en vuelo daba 404; General se desmonta durante la purga y aborta la petición. Gates: tsc, lint,
  test:coverage 2706/0; qa 4 vueltas (4 P2 corregidos). Punto 4 en vivo solo "purga correcta": re-añadir el
  proyecto exige el selector nativo de carpetas; el set lo cubre el test unitario.
  Texto visible: "Bash" y "Copy output" (las mismas etiquetas que ya tenía la fila de comando, ahora una por comando).
  Gate en vivo: navegador Playwright, `aud25-ui` 14/14 y `project-delete` 12/12, `docs/done/evidence/AUD.25-ui-result.json`.
  Ejecutado por: gpt-6.1-sol (criterio, 2 tandas) + claude-opus-5-5 (fixes de revisión) · Spec: docs/specs/AUD.25.md
- [ ] **AUD.26 — Gates que no pueden fallar.** (abierto 2026-11-11) `check-coverage.ts:14-16` da 100 % a un LCOV
  vacío; `check-test-assertions.ts:5` cuenta `expect(` en comentarios; `check-scope-lock.ts:48` ignora eliminaciones;
  `nightly-ui-gates.ts:322,228` sale 0 con todo rojo y su candado no se recupera; `adversarial-review.ts:775,796`
  avanza el SHA tras un fallo de infraestructura. Verificación: test rojo por cada caso antes del arreglo.
- [ ] **AUD.27 — Código sin uso (amplía AUD.8).** (abierto 2026-11-11) `src/index.ts` y `"module"` de `package.json`;
  `app/src/data/orcaProjectData.ts`; 5 scripts sin invocador; 77 exports y 104 tipos sin importador (`knip`); bloque
  `{false && …}` en `AgentComposer.tsx:1042`; tablas `orchestration_*` y `planner_model` sin consumidor;
  `buildCodexPrompt` duplicado; rama `/legacy` de `http.ts:58`. Verificación: `knip` con la config del informe baja a
  0 archivos y exports de backend sin uso; `tsc` y suite verdes.
- [ ] **AUD.28 — Funciones que mezclan responsabilidades: cortar las cinco más grandes.** (abierto 2026-11-11)
  `runTask`, `handleApiChat`, `route`, `App` y `OrchestSettingsView`: 1045, 1122, 430, 1982 y 3843 líneas; cortes con nombres y rangos en el
  informe. Mover sin cambiar comportamiento, un corte por commit. Necesita GO de Carlos (cambio grande; en los
  componentes del prototipo choca con la comparación 1:1). Verificación: ninguna función de `src/run` ni de
  `handlers/` sobre 300 líneas; suite y ui-gates del área verdes antes y después.

### Abiertos — ciclo de vida de sesiones

- [ ] **SES.1 — Cerrar una sesión de verdad.** (abierto 2026-11-12; Carlos: va justo después del lote AUD) La X del
  tab (`App.tsx:172`, `closeDevTab`) solo quita el tab de la UI: la sesión sigue activa y su turno corriendo. Archivar
  (`handlers/chat-sessions.ts:551`, `handleApiChatSessionArchive`) marca `archived` sin detener el turno en curso: el
  CLI queda vivo y la sesión desaparece del sidebar. Borrar ya rechaza con turno activo (409). Diseño (patrón de
  JetBrains "Terminate / Disconnect", VS Code `confirmOnKill`, tmux detach/kill): **tab = vista, sesión = proceso**.
  (1) Cerrar un tab ocioso: se cierra sin preguntar. (2) Cerrar un tab con turno en curso: diálogo "Detener y cerrar"
  / "Dejar corriendo" / "Cancelar", con "recordar" en Settings. (3) Sesiones en segundo plano: punto de "corriendo"
  en el sidebar y contador en la barra; al terminar, aviso. (4) Archivar = detener turno (`stopChatTurn`, grupo de
  procesos completo vía AUD.6) + archivar, nunca sin detener. (5) Cerrar la app o el dashboard con turnos vivos:
  aviso con la lista. (6) Al arrancar, turnos huérfanos (proceso muerto, turno `pending`) se marcan y se ofrecen
  reanudar. Verificación: test que archiva con turno en curso y comprueba que no queda proceso; test del diálogo
  por estado del tab; prueba en vivo en el dashboard de los tres caminos (ocioso, detener, dejar corriendo).

## Decisiones pendientes de Carlos

- Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no (anotado en UI.8;
  sin verificar si sigue vigente).
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
→ [cerrados de UI](docs/done/bloque-UI.md)
→ [cerrados de CTX-GUARD](docs/done/bloque-CTX-GUARD.md)
→ [cerrados de SEC](docs/done/bloque-SEC.md)
→ [cerrados de OC](docs/done/bloque-OC.md)
→ [cerrados de ADE](docs/done/bloque-ADE.md)
→ [cerrados de DEV](docs/done/bloque-DEV.md)
→ [cerrados de ONB](docs/done/bloque-ONB.md)
→ [cerrados de RUN](docs/done/bloque-RUN.md)
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
→ [cerrados de SET](docs/done/bloque-SET.md)
→ [cerrados de TRUST](docs/done/bloque-TRUST.md)
→ [cerrados de CHAT](docs/done/bloque-CHAT.md)
→ [cerrados de SKILLS](docs/done/bloque-SKILLS.md)
→ [cerrados de CFG](docs/done/bloque-CFG.md)
→ [cerrados de TCLI](docs/done/bloque-TCLI.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
