# R.8.2.2 — El anillo de contexto de Dev mide la sesión abierta, no un transcript viejo (spec)

Reporte de Carlos 2026-10-11: en Dev, una sesión de Codex mostraba "71% context window" cuando no era cierto.

## Defecto (medido)
`OrchestDevWorkspace.tsx:292` toma `activeContext` de `apiSessionStatus.clis[cli].context` (`/api/session-status` →
`scripts/session-status.ts`), que es el transcript más nuevo en disco de ese CLI para el proyecto
(`~/.codex/sessions/**/rollout-*.jsonl`), sin relación con la sesión abierta. Medido:
- codex `used 184406 / window 258400 = 71.36%`, de un transcript del 2026-10-04 08:08;
- la sesión real `e7051452…` daba, por `/api/chat/sessions/<id>/context`, `26014 / 1050000 = 2.48%`.

La vista Chat ya lo hace bien (`OrchestChatView.tsx:97-116`, `getSessionContext`).

## Cambios
1. `src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx`:
   - Reemplazar `activeContext` (`:292`) por un estado `sessionContext` cargado con
     `getSessionContext(activeAgent.id, <modelo>, activeAgent.projectId ?? null, signal)`. Es el mismo patrón de
     efecto que `OrchestChatView.tsx:97-116`: abort al desmontar y `null` si falla.
   - El modelo es el que el composer de Dev tenga seleccionado si ya está en estado; si no, `activeAgent.model`.
   - Se recarga al cambiar de sesión o de modelo y al cambiar el número de turnos o mensajes del timeline. Si el
     timeline no expone ese conteo, usar `timeline?.pending` + `activeAgent.id`.
   - El `<ContextRing>` (`:983`) usa `sessionContext`, con los mismos props que `OrchestChatView.tsx:231-236`:
     `undefined` cuando es null.
   - `apiSessionStatus` sigue usándose donde ya se usa (`:195`, `:410`); solo deja de alimentar el anillo.
2. `scripts/ui-gate/flows/chat-continuity.mjs` — tras el turno 2 de Codex, el paso nuevo
   `Dev context ring matches the open session`:
   - lee `aria-label` de `[aria-label^="Context window usage:"]`, con el mismo parseo que
     `chat-streaming.mjs:237-241`;
   - pide `/api/chat/sessions/<codexSession.id>/context` con el `api()` del flujo;
   - exige que la diferencia entre ambos `pct` sea menor que 0.5. El ring se renderiza de forma asíncrona: esperar
     hasta 15 s.

## No tocar
`scripts/session-status.ts`, `ShellStatusBar` (las cuotas siguen saliendo de session-status) y `OrchestChatView`.

## Verificación (cerebro)
- `bunx tsc --noEmit`
- `tsc -p src/dashboard/app/tsconfig.json --noEmit`
- `bun run test:coverage`
- `bun run gate:evidence -- --label R.8.2.2 -- bun run ui:gate chat-continuity chat-streaming`
- Mirar la captura de Dev.
