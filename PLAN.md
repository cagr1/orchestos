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

- [ ] **AUD.5 — Tras cada tarea `done` por CLI, una llamada LLM oculta sobre los runs de todos los proyectos.**
  (abierto 2026-11-10) En `orchestos task run` (`cli.ts:1303-1331`), al terminar `done` se lee `listRuns(20)`
  (`runs.ts:197-207`, sin filtro de proyecto) y, con 3 o más, `analyzeRunPatterns` hace una llamada al rol Auxiliar
  (`analyze/patterns.ts:144-150`) y puede crear propuestas de instinto. Gasto no declarado en `LIMITATIONS.md` y mezcla
  de proyectos en el análisis. Verificación: o se quita del camino de la tarea (queda en `--analyze`, `cli.ts:855`), o
  se filtra por proyecto y se declara en el resumen del run; test que cuente las llamadas al LLM de una tarea `done`.

- [ ] **AUD.6 — Los motores matan solo al hijo directo, no al grupo de procesos.** (abierto 2026-11-10)
  `external.ts:329-339` y `397` (`proc.kill('SIGTERM')`/`SIGKILL`), `opencode-server.ts:293-296` y `dashboard/terminal.ts:86-90`
  no lanzan `detached` ni matan `-pid`; solo `mcp/readonly.ts:619-624` mata el grupo (`process.kill(-proc.pid)`, lanzado
  con `detached: true`, `readonly.ts:652`). No verificado en vivo: si los CLIs de agente dejan nietos vivos tras un
  timeout o abort. Verificación: fixture con un CLI falso que lance un nieto; tras abortar la tarea no queda ese PID.

- [ ] **AUD.7 — Servidor local sin token: cualquier proceso local puede lanzar agentes.** (abierto 2026-11-10)
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
