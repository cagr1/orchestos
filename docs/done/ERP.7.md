# ERP.7 — T3 Code lado a lado con OrchestOS (usado 2026-10-19)

Pedido de Carlos (2026-10-17): no "adaptemos", sino instalarlo, usarlo y abrir un ítem por cada debilidad propia.

**Veredicto.** En peso por turno ganamos nosotros. En control humano del chat y en revertir lo que hizo un turno,
T3 está por delante: ahí se abren ERP.7.1 y ERP.7.2. Lo de proveedores extensibles ya está abierto como AT.11 y
H.7.2c; T3 lo confirma con evidencia. La tier list que pone a T3 arriba y a Orca en C no apareció: ni el
investigador ni yo la encontramos. Sin URL no se da por real.

## Método
- `t3@0.1.0` desde npm (binario `@t3code/t3-darwin-arm64`), instalado en `/tmp`. Corrió con
  `t3 start --mode web --host 127.0.0.1 --base-dir <tmp>` sobre un repo de prueba con un bug de una línea
  (`suma` resta). Lo manejé con Playwright, en navegador real y vía el pairing URL.
- Pedido: "En calc.py la función suma resta en vez de sumar. Arréglalo." Modelo GPT-6-Luna, esfuerzo medium, modo
  Supervised.
- Línea base: el mismo pedido con `codex exec -m gpt-6-luna` directo, con el mismo `CODEX_HOME`. Tokens tomados del
  rollout de Codex (`last_token_usage` del primer `token_count`), igual que en ERP.6.
- Lo que vale para OrchestOS se tomó del código, leído por `leer` (gpt-6-luna) y contrastado por el cerebro en
  `chat.ts:1588`, `server.ts:534` y `OrchestChatView.tsx:557`.

## Lo medido
| | T3 Code | Codex directo | OrchestOS (ERP.6) |
|---|---|---|---|
| Contexto de la 1.ª llamada (Codex Luna) | 21 496 | 20 441 | 23 890 contra 28 891 directo |
| Sobrecosto por llamada | +1 055 (herramientas MCP `t3-code`) | — | −5 001 contra directo |
| Entrada total del turno | 474 505 | 149 587 | — |
| Tiempo del turno | 10 min 16 s | — | — |

- Los 474 k y los 10 min tienen dos causas.
  - Luna delegó el arreglo, por la herramienta MCP `delegate-task` que T3 le inyecta, a un subagente Claude Haiku
    5.5, y se quedó sondeándolo.
  - Supervised pidió 6 aprobaciones para un arreglo de una línea, incluso para `cat calc.py`.
  - Parte de la delegación viene de las reglas globales de Carlos (`~/.codex/AGENTS.md`, "el cerebro delega").
    Codex directo también intentó delegar.
- Por defecto, T3 eligió GPT-6-Astra, el más caro, con "Full access".

## Lo que T3 hace y OrchestOS no (debilidades propias)
1. **Control por acción en el chat.** El composer trae 4 modos: Supervised, Auto-accept edits, Auto y Full access
   (`evidence/ERP.7/permisos.png`). Cada comando o edición del agente se aprueba o rechaza dentro del hilo
   (`evidence/ERP.7/aprobacion-edicion.png`). La barra lateral marca "Approval" en el hilo que espera.
   - OrchestOS muestra el modo, pero no deja elegirlo en el composer. Su aprobación inline es de tareas retenidas,
     no de comandos ni de ediciones (`OrchestChatView.tsx:557`, `AgentComposer.tsx:684`). → **ERP.7.1**
2. **Diff y deshacer por turno.** Cada turno cierra con "1 changed file +1 −1 · Open diff", y hay botón Commit en
   el panel (`evidence/ERP.7/turno-con-diff.png`). Los checkpoints van en refs ocultas de git: se revierte un turno
   sin ensuciar la rama, y si el proveedor no puede deshacer su conversación, el revert se rechaza.
   - El chat de OrchestOS no tiene diff por turno ni manera de revertir un turno. El revert existe solo en el
     harness de tareas (`src/run/harness.ts:13`). → **ERP.7.2**
3. **Proveedores por adaptador.** Detectó 8 proveedores sin configurar nada: codex, claudeAgent, cursor, opencode,
   grok, antigravity, pi y muse (`caches/*.json`). El chat de OrchestOS enruta por marca a Claude, Codex y API
   (`chat.ts:1588`). Ya está abierto como **AT.11**, y OpenCode como **H.7.2c**.
4. **Acceso remoto.** T3 ofrece pairing por token, LAN, Tailscale y apps móviles. OrchestOS enlaza a `127.0.0.1`,
   sin pairing (`server.ts:534`). No se abre ítem: es una decisión de producto de Carlos.

## Lo que no se copia
- Delegación dentro del turno sin tope. Un arreglo de una línea costó 3,2 veces la entrada del CLI directo y
  10 minutos. OrchestOS delega por tarea, con roles y QA, y el chat no sondea subagentes.
- Herramientas MCP inyectadas en cada llamada (+1 055 tokens por llamada en Codex).
- Defaults caros o abiertos: el modelo más caro y "Full access".

## Fuentes externas (investigador, sonnet)
- Arquitectura y permisos: github.com/pingdotgg/t3code (`docs/internals/overview.md`, `providers.md`,
  `docs/user/permission-modes.md`).
- Comparativas: vibecodinghub.org/blog/t3-code-vs-orca (T3 gana en control distribuido y Orca en revisión visual y
  terminal) y daily.dev (en la alpha de marzo de 2026, "good but not usable").
