# ERP.7.1a — aprobación por acción y tareas Codex

2026-10-20. Implementado por el ejecutor Codex; sin delegar, hacer commits ni editar PLAN.md/NEXT.md.
El ítem queda abierto para la verificación y QA del cerebro. El baseline global sigue rojo; no se declara cierre.

Diff: el commit `feat(ERP.7.1a)` (código, tests, gate reproducible `evidence/ERP.7.1a/live.ts` y LEDGER).
Excluye los cambios preexistentes de PLAN.md, feature-status.json y runs-summary.json.

## Cambio entregado

- `Task.approvalMode` opcional, validado y conservado en YAML y creación por API. Ausente o `full` mantiene la ruta
  existente. `supervised`/`auto-edit` usan el adaptador de tareas `codex app-server` con `untrusted`.
- Capa genérica `ApprovalAdapter` y `decideApproval`; persistencia en migración 29 de sesiones, solicitudes y eventos.
  La identidad del run se reserva antes del executor y coincide con la fila final. `/api/tasks` expone esa identidad
  mientras corre; cada consulta usa el scope de proyecto.
- `GET /api/runs/:id/approval` devuelve `{pending, events}`; POST valida `approvalId` y `decision`, conserva CSRF,
  aislamiento por proyecto, 404 y 409. `approve-always` devuelve `scope: task|once` y usa coincidencia exacta del comando
  estructurado o del envoltorio verificado, sin prefijos. Ediciones externas nunca heredan la concesión.
- Lecturas según `CommandAction` de Codex (`read`, `search`, `listFiles`), desconocidas preguntan. Patches se obtienen
  de `item/started`; se comprueban rutas y destinos de renombre con ancestros reales para detectar symlinks.
  Aprobaciones automáticas persisten `approval_resolved` con `decision: auto`.
- Limpieza al finalizar/fallar el executor y el harness. Un proceso dueño muerto se detecta al consultar su sesión y
  sus pendientes se rechazan; no hay aprobación por timeout. El timeout del executor termina el CLI.
- Sin cambios en el método de chat, sus políticas `never`/solo lectura, UI, ni adaptadores Claude/OpenCode.
  Se actualizan las expectativas de migraciones y se agrega la entrada de procedencia en LEDGER.md.

## Gate real

Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1a/round3-live-verified.log`.
Comando: `bun run gate:evidence -- --label erp.7.1a -- bun run docs/done/evidence/ERP.7.1a/live.ts` (exit 0).
Dashboard real, fixtures git temporales con identidad propia por `git -c`, tareas mediante `runTask` real y modelo
Codex del rol executor del proyecto, sin sustituirlo. Navegador accede al dashboard y responde por HTTP con scope.
La tarea no tiene criterios ni gates de revisión aplicables: el harness omite QA LLM según la regla existente.

En ambos casos el patch ocurrió antes de la respuesta del usuario y produjo resolución automática. El único pendiente
fue `mkdir command-marker`; el JSON completo del GET y POST está en el log y en los archivos siguientes:

- [Approve](evidence/ERP.7.1a/live-approve.json): POST 200, `scope: once`; marcador observado; tarea `done`.
- [Reject](evidence/ERP.7.1a/live-reject.json): POST 200; marcador nunca observado; tarea `done`, conservando el patch.
- [Limpieza consultada](evidence/ERP.7.1a/round3-cleanup.log): ambos repos eliminados, cero proyectos temporales en la
  DB durable, cero sesiones activas de aprobación. El wrapper exportó dos runs `done`, `project_id=NULL`,
  `task_class=gate:erp.7.1a:fix`, antes de eliminar el home temporal. Dashboard detenido.

Capturas del dashboard: [approve](evidence/ERP.7.1a/dashboard-approve.png) y
[reject](evidence/ERP.7.1a/dashboard-reject.png). No muestran tarjeta nueva: la UI pertenece a ERP.7.1b.
La evidencia funcional es la API real y los efectos en el fixture, no esas capturas.

## Gates y salidas crudas

| Comando | Resultado | Salida íntegra |
|---|---|---|
| `bun run agent:preflight -- --item ERP.7.1a --agent codex` | exit 0 | [preflight](evidence/ERP.7.1a/round3-preflight.log) |
| `bunx tsc --noEmit` | exit 0, salida vacía | [tsc](evidence/ERP.7.1a/round3-tsc.log) |
| `bun run typecheck` | exit 0, ambos tsconfig | [typecheck](evidence/ERP.7.1a/round3-typecheck.log) |
| Tests relevantes (comando abajo) | 66 pass, 0 fail | [tests](evidence/ERP.7.1a/round3-final-tests.log) |
| `bun run lint` | exit 0, warnings/infos | [lint](evidence/ERP.7.1a/round3-lint.log) |
| `bun run test:coverage` | exit 1: 1818 pass, 2 skip, 6 fail (baseline sin aumento) | [coverage](evidence/ERP.7.1a/round3-coverage-final.log) |
| `bun run security:gate` | exit 1: 5 fallos del baseline | [security](evidence/ERP.7.1a/round3-security.log) |
| Gate real | exit 0, 2 runs exportados | [live](evidence/ERP.7.1a/round3-live-verified.log) |

Tests relevantes: `bun test src/__tests__/action-approvals.test.ts src/__tests__/codex-task-approvals.test.ts src/__tests__/codex-app-server.test.ts src/__tests__/migration.test.ts src/__tests__/run-revert.test.ts`.
Cubren política, alcance y concesiones, persistencia, limpieza/muerte del CLI, JSON-RPC simulado con la forma verificada,
validación/404/409/scope/CSRF del endpoint, migraciones y regresión del chat/revert.

La última corrida de cobertura, con todo el código y el test CSRF nuevo, dio 1818 pass, 2 skip, 6 fail en 1826 tests
(170.44 s): [log completo](evidence/ERP.7.1a/round3-coverage-final.log). Son los mismos seis fallos documentados antes del cambio:
`adversarial-review` ×2, `run_readonly` con worktree enlazado, timeout de `runGraph`, timeout de Codex y puerto de
`csrf-origin`. No se corrigieron fuera del alcance. `security:gate` encuentra cinco de ellos (no falla `runGraph`),
se detiene en la matriz de tests y no llega a `bun audit`. No cuenta como PASS de seguridad.

## Intentos conservados y límites

La primera corrida de coverage de esta ronda tuvo siete fallos adicionales por las expectativas de la versión del
esquema, corregidos y verificados después: [salida original](evidence/ERP.7.1a/round3-coverage-final.log).
Los intentos de gate fallidos se conservan:
[puerto bloqueado en sandbox](evidence/ERP.7.1a/round3-live.log),
[puerto dinámico que no coincide con CSRF](evidence/ERP.7.1a/round3-live-expanded.log),
[lectura compuesta clasificada unknown por Codex](evidence/ERP.7.1a/round3-live-final.log).
El último falló porque el modelo hizo `pwd && cat edit.txt` antes del patch: conforme al spec, `unknown` pregunta.
El fixture final exige explícitamente no inspeccionar nada antes del patch. No se cambió la política para el gate.
El wrapper preservó el primer home al fallar su exportación en sandbox; no se borró manualmente.

La revisión independiente `qa` queda al cerebro; el ejecutor no delegó. Los logs de tests que nombran otros CLI usan
los dobles ya existentes de la suite, no nuevas delegaciones ni ejecuciones reales de esos modelos.

## Ronda 1 histórica (bloqueo resuelto por la ronda 2 del spec)

### Informe original de ronda 1

Ítem abierto. No se implementó código ni se modificó PLAN.md/NEXT.md. Se detuvo por la condición
explícita del spec: verificar la semántica nativa antes de implementar y reportar si no corresponde.

Binario instalado: `codex-cli 0.163.0`. Esquema generado con
`codex app-server generate-json-schema --out /tmp/ERP.7.1a/schema`.
El esquema expone `untrusted`, `on-request`, `never` y un objeto `granular` con controles por
categoría (`rules`, `sandbox_approval`, etc.); no un modo separado de aprobación de comandos y patches.

Prueba real por stdio de `codex app-server`: `initialize`, `thread/start` con
`sandbox: "workspace-write"`, `approvalsReviewer: "user"`, `ephemeral: true`, y `turn/start`.
Modelo efectivo devuelto por el binario: `gpt-6-sol` (default del host, no sustituido).
Fixture git temporal con `edit.txt` conteniendo `before`, prompt que exige cambiarlo mediante
apply_patch a `after` y ejecutar `mkdir command-marker`. Todas las solicitudes se respondieron
con `{ "decision": "decline" }`. Ambos fixtures se eliminaron al finalizar.

Resultados crudos:

```text
RESULT {"policy":"on-request","approvals":0,"edit":"after\n","commandMarkerExists":true}
RESULT {"policy":"untrusted","approvals":2,"edit":"before\n","commandMarkerExists":false}
```

`on-request` permitió el comando no de lectura sin preguntar (`commandActions: [{type: "unknown",
command: "mkdir command-marker"}]`, exitCode 0). `untrusted` preguntó también por el patch.
Ninguna de las dos políticas verificadas cumple Auto-edición como está definido en el spec.
No se afirma haber probado toda configuración posible. Elegir una semántica distinta o una
intercepción adicional requiere decisión del cerebro/Carlos; no se implementó una alternativa.

Se verificaron solicitudes reales `item/fileChange/requestApproval` y
`item/commandExecution/requestApproval` con `id` JSON-RPC y respuestas `{id, result: {decision:
"decline"}}`. Los logs contienen mensajes y respuestas completos:

- [on-request](evidence/ERP.7.1a/on-request-expanded.log)
- [untrusted](evidence/ERP.7.1a/untrusted-expanded.log)

Gates previos a editar:

- Preflight `bun run agent:preflight -- --item ERP.7.1a --agent executor`: PASS.
- `bunx tsc --noEmit`: exit 0, [stdout/stderr vacío](evidence/ERP.7.1a/ERP.7.1a-baseline-tsc.log).
- `bun test src/__tests__/codex-app-server.test.ts src/__tests__/codex-engine.test.ts`:
  30 pass, 1 fail. [Salida cruda](evidence/ERP.7.1a/ERP.7.1a-baseline-tests.log).
- Repetición `bun test src/__tests__/codex-engine.test.ts`: 20 pass, 1 fail.
  [Salida cruda](evidence/ERP.7.1a/ERP.7.1a-baseline-tests-retry.log).
  Ambos fallan antes de cambios: test de timeout espera `timed out` y recibe
  `codex produced no turn.completed event — cost unknown, not reported as $0`.
- `bun run test:coverage`: exit 1; 1781 pass, 2 skip, 6 fail, 4601 expect() calls,
  1789 tests across 203 files, 170.11 s. [Salida cruda completa](evidence/ERP.7.1a/round3-coverage-final.log).
  Fallos: dos de `adversarial review` (sandbox), `run_readonly` (worktree enlazado),
  `runGraph` (timeout), el timeout de `codexEngine` ya reproducido y `csrf-origin` (`EADDRINUSE`).
  No se corrigieron ni se atribuyen a esta implementación: no hay cambios de código.

El primer arranque real fue bloqueado por el sandbox (`Operation not permitted`); los dos
probes concluyentes se ejecutaron con permiso ampliado aprobado. No se ejecutó el gate de
dashboard/tarea/API del spec: requiere la implementación detenida. No cuenta como PASS.

## Ronda 2 histórica (bloqueo resuelto por la ronda 3 del spec)

### Informe original de ronda 2

2026-10-20. Ítem abierto; no se modificó código de producto, PLAN.md ni NEXT.md y no se hizo commit.
La instrucción del usuario exige detenerse si hay una decisión que el spec no cubre.

La ronda 2 resuelve el bloqueo anterior: `untrusted` más `decideApproval` de OrchestOS.
El bloqueo nuevo está en la identidad de ejecutable para `approve-always`.
La solicitud real conservada de Codex 0.163.0 contiene:

```json
{
  "command": "/bin/zsh -lc 'mkdir command-marker'",
  "commandActions": [{ "type": "unknown", "command": "mkdir command-marker" }],
  "proposedExecpolicyAmendment": ["mkdir", "command-marker"]
}
```

Usar el ejecutable literal `zsh` como clave común autorizaría también otros comandos
envueltos por el mismo shell durante esa tarea. Usar el primer elemento de
`proposedExecpolicyAmendment` es otra interpretación: el esquema describe una propuesta
opcional de regla, no una identidad obligatoria del ejecutable. `command` y
`commandActions` también admiten null; solo itemId, startedAtMs, threadId y turnId son
obligatorios. No está definida la conducta de aprobar-siempre ante un shell compuesto,
intérprete o solicitud sin una identidad verificable. Elegirla cambia el alcance de permisos.

Recomendación para que el cerebro complete el contrato: definir una clave estable a partir
de la información estructurada del CLI, sin usar el shell envolvente; cuando no se pueda
determinar esa clave, `approve-always` aprueba solo la solicitud actual y no crea una concesión.
No se implementó esta recomendación ni se asumió que esté autorizada.

Evidencia: [solicitud y fragmento del esquema](evidence/ERP.7.1a/round2-executable-contract.json),
extraídos del esquema y del probe real de la ronda anterior. En esta ronda no se volvió
a invocar el app-server real. El bloqueo anterior y su evidencia se conservan en
[ERP.7.1a-blocked.md](ERP.7.1a.md#ronda-1-histórica-bloqueo-resuelto-por-la-ronda-2-del-spec); no se elimina ni se declara cerrado su informe
hasta completar la implementación y el gate en vivo.

Gates ejecutados en esta ronda (salidas crudas completas):

- `bun run agent:preflight -- --item ERP.7.1a --agent codex`: exit 0;
  [log](evidence/ERP.7.1a/round2-preflight.log).
- `bunx tsc --noEmit`: exit 0, stdout/stderr vacíos;
  [log vacío](evidence/ERP.7.1a/round2-baseline-tsc.log).
- `bun test src/__tests__/codex-app-server.test.ts src/__tests__/codex-engine.test.ts`:
  30 pass, 1 fail, 126 expect() calls; [log](evidence/ERP.7.1a/round2-baseline-tests.log).
  Es el fallo de timeout documentado antes de esta ronda: esperaba `timed out` y recibe
  `codex produced no turn.completed event — cost unknown, not reported as $0`.
  Este fallo no motivó la parada y no se corrigió fuera de alcance.

No ejecutados: `bun run test:coverage`, gates de implementación, seguridad ni dashboard/tarea/API.
La parada ocurre antes de implementar. No se afirma que se mantengan los seis fallos del
coverage anterior: no se midió en esta ronda. El diff de esta ronda contiene exclusivamente
este informe y cuatro archivos de evidencia; los cambios anteriores del árbol se preservan.

## Verificación del cerebro (Opus, 2026-10-20, fuera del sandbox)
- `bunx tsc --noEmit`: exit 0. `bun run test:coverage`: **1824 pass, 0 fail**, funciones 79.17 %, líneas 66.09 %. Los 6
  fallos de arriba eran del sandbox del ejecutor.
- `bun run security:gate`: la matriz de tests pasa; falla `bun audit` por 4 vulnerabilidades altas en dependencias
  transitivas (`brace-expansion`, `fast-uri`), ajenas a este diff (`package.json`/`bun.lock` sin cambios). Ítem SEC.1.
- QA adversarial (Sol) halló un bloqueante: `approve-always` de `bun test` cubría `bun test; rm -rf x`, porque la clave
  salía de `commandActions` (análisis aproximado según el esquema). Ronda 4 (mecanico): la clave sale siempre del comando
  completo y "lectura" exige además que no haya operadores de shell (`; & | > < `` ` `` $( \n`). Tests de la reproducción
  de QA incluidos; 48/48 en verde con comandos del cerebro.
