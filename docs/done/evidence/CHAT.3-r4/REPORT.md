# CHAT.3 — corrección 4, ejecución 2026-10-25

Ejecutado por: gpt-6.1-sol, ejecutor. Sin commit ni cambios en PLAN.md/NEXT.md.
Se conserva el diff previo de CHAT.3; esta ronda cambia solo diagnóstico del app-server,
sus tests y conservación de evidencia en `scripts/ui-gate/run.mjs`.

## Resultado y límite

El fallo original de `chat-notices` citado en el spec tiene causa comprobada:
`ui-gate-48810/dashboard.log` identifica el hilo `01a173e8-8b06-70f3-b876-8edafa9307ef`.
La DB nativa `~/.orchestos/general-chat/logs_2.sqlite` registra a las 16:33:05 UTC
`429 Too Many Requests` y un reintento a **244.999839917 s**. OrchestOS interrumpe el turno
a los 120 s. La cuenta no informa que sea inválida: ese dato no se deriva de un 429.
La fila nativa literal está en [native-429.json](native-429.json).

No reproducido el fallo de `chat-notices` en **3 corridas** (una sola y dos combinadas),
todas 5/5. En la segunda combinada sí hubo 429: hilo
`01a173f4-65dc-7d41-99da-2e58d95e6174`, 16:46:01 UTC, reintento a 69.999812541 s,
primer delta a 75.191 s y final a 76.383 s. El protocolo registra `active`, sin flags,
`authMode=chatgpt`, `planType=plus`, y **ninguna notificación `error`**. La advertencia
del retry solo aparece en la DB nativa, no en stdout/stderr del app-server.

La premisa «solo falla chat-notices» no se sostiene: `codex-live` pasó 14/14 en la primera
combinada y falló en la segunda. Sus dos turnos agotaron 120 s sin deltas; estado `active`
sin flags, cuenta `chatgpt/plus`. No se atribuye ese fallo a 429 sin su log nativo.
Sus rollouts sí quedaron conservados en `ui-gate-56475/codex-home/5720cc86c870583e/sessions/`.

**Parada por alcance del spec:** Codex 0.164.0 guarda los errores nativos en
`logs_2.sqlite` (no existe `log/` en el home general observado). El spec define conservar
`log/` y `sessions/` y consumir notificaciones JSON-RPC; no define un lector de esa DB
para mostrar errores que el app-server no emite. No se añade ese mecanismo ni se cambia
el timeout/reintento. El aviso «no error reported by Codex» todavía significa que no hubo
un error por el protocolo; no garantiza ausencia de errores en la DB interna del CLI.
CHAT.3 no se declara cerrado.

## Cambios de esta ronda

- `[codex-turn]` registra tipo y flags del hilo y solo nombres de campos y enums de
  autenticación/plan. Los valores de email/tokens y el prompt no se registran.
- `systemError` genera un aviso literal `unknown`; `authMode=null` genera un aviso
  `auth` que dice exactamente que Codex no informó un modo de autenticación.
  El timeout conserva ese motivo en vez de decir que no se informó ningún error.
- Contratos comprobados con `codex app-server generate-json-schema --out
  /tmp/CHAT.3-r4-schema`, binario `codex-cli 0.164.0`. Esquemas adjuntos:
  [cuenta](AccountUpdatedNotification.json), [estado](ThreadStatusChangedNotification.json).
- `preserveCodexHome` incluye `~/.orchestos/general-chat`, que `runCodexChat` usa para
  chats sin proyecto; separa cada home por nombre/id al copiar. Copia real comprobada:
  17 entradas de sesiones. El fallo de `codex-live` activó también la copia automática
  del home general y del proyecto antes de limpiar el fixture.
- Cuatro tests nuevos cubren estados saludables, error del hilo, ausencia de auth y
  filtrado de valores desconocidos/confidenciales.

## Diff y salidas crudas

Diff incremental respecto al inicio de esta ronda:
[/tmp/CHAT.3-r4/changes.patch](/tmp/CHAT.3-r4/changes.patch).
El diff previo quedó en `/tmp/CHAT.3-r4/before.patch`.
Los logs enlazados contienen stdout/stderr originales sin resumir.

| Comando | Resultado | Salida cruda |
|---|---|---|
| `bunx tsc --noEmit` (baseline) | exit 0 | [log](/tmp/CHAT.3-r4-baseline-tsc.log) |
| `bun test src/__tests__/codex-app-server.test.ts` (baseline) | 20/20, exit 0 | [log](/tmp/CHAT.3-r4-baseline-tests.log) |
| `bun run typecheck` | exit 0, ambos tsconfig | [log](/tmp/CHAT.3-r4/typecheck.log) |
| `bunx biome check src/run/executors/codex-app-server.ts src/__tests__/codex-app-server.test.ts scripts/ui-gate/run.mjs` | exit 0, 34 warnings | [log](/tmp/CHAT.3-r4/biome.log) |
| `bun run lint` | exit 0, 1012 warnings y 381 infos | [log](/tmp/CHAT.3-r4/lint.log) |
| `bun test` de los 8 tests tocados por CHAT.3 | 145/145, exit 0 | [log](/tmp/CHAT.3-r4/tests-all-touched.log) |
| `bun run test:coverage` | 2073/2073, exit 0; funciones 80.77%, líneas 68.37% | [log](/tmp/CHAT.3-r4/coverage.log) |
| `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows` | exit 0 | [log](/tmp/CHAT.3-r4/flow-lint.log) |
| comprobación real de copia del home general | 17 entradas iguales, exit 0 | [log](/tmp/CHAT.3-r4/preserve-check.log) |

Tests tocados: `src/__tests__/{chat-turns,claude-chat,codex-app-server,migration,cli-failure}.test.ts`,
`src/dashboard/app/src/api/chat.test.ts`,
`src/dashboard/app/src/components/thread/thinking.test.ts`, `src/db/chat-turn-steps.test.ts`.

Todos los gates de navegador usaron el wrapper oficial `bun run gate:evidence -- --label
<label> -- <comando>`. Exportación durable: 0 runs no-chat en todos; exit 0 de exportación.

| Label / comando | Resultado | Salida cruda / evidencia |
|---|---|---|
| `CHAT.3-r4-notices-solo` / `bun run ui:gate chat-notices` | exit 0, 5/5 | [log](/tmp/CHAT.3-r4/notices-solo-live.log), [JSON](chat-notices-solo.json) |
| `CHAT.3-r4-chat-set1` / `bun run ui:gate chat-streaming codex-live chat-notices` | exit 0, 27/27 + 14/14 + 5/5 | [log](/tmp/CHAT.3-r4/chat-set1.log), [JSON](chat-set1.json) |
| `CHAT.3-r4-chat-set2` / mismo set | exit 1: streaming 27/27, codex-live FAIL, notices 5/5 | [log](/tmp/CHAT.3-r4/chat-set2.log), [JSON](chat-set2.json) |
| `CHAT.3-r4-streaming3` / `bun run ui:gate chat-streaming` | exit 0, 27/27 | [log](/tmp/CHAT.3-r4/streaming3.log), [JSON](chat-streaming3.json) |
| `CHAT.3-r4-timeout` / `env ORCHESTOS_CHAT_TURN_TIMEOUT_MS=4000 bun run ui:gate chat-timeout` | exit 0, 9/9 | [log](/tmp/CHAT.3-r4/timeout.log), [JSON](chat-timeout.json) |

La primera tentativa de navegador dentro del sandbox falló al abrir el puerto
(`listen EPERM 127.0.0.1`): [salida cruda](/tmp/CHAT.3-r4/notices-solo.log).
Los gates reales se corrieron después con la escalación autorizada.

Gate en vivo: navegador real (Playwright), `docs/done/evidence/CHAT.3-r4/chat-timeout.json`.
Capturas nuevas del timeout (espera, fallo y recarga):

- [espera](/var/folders/wv/rp5p2q612rn3t4lq69w5tj9w0000gn/T/ui-gate-5975/chat-timeout/timeout-waiting.png)
- [fallo](/var/folders/wv/rp5p2q612rn3t4lq69w5tj9w0000gn/T/ui-gate-5975/chat-timeout/timeout-failed.png)
- [recarga](/var/folders/wv/rp5p2q612rn3t4lq69w5tj9w0000gn/T/ui-gate-5975/chat-timeout/timeout-reloaded.png)

El gate comprueba contador único, mensaje del usuario visible, aviso sin encabezado
Thought, Details expandible, restauración tras reload y exactamente una fila timeout.
Se inspeccionó la captura de fallo. `chat-streaming` pasó las tres repeticiones 27/27,
incluido seguimiento al fondo; no se modificó ese flujo.
