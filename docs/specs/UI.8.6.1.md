# UI.8.6.1 — El hilo sigue pegado al fondo cuando cambia el alto del compositor

Fallo: pre-push 2026-10-16 tras UI.8.6, `FAIL chat-roles: chat follows content that grows after render:
{"grew":true,"atBottom":false}` (`scripts/ui-gate/flows/chat-roles.mjs:226-247`). Primera vez que falla ese paso.
Hipótesis (no probada): la tira de permisos (`OrchestChatView.tsx`, `data-permissions-strip`) monta tarde (llega con
`getConfig`) y cambia el alto de `data-composer-region`, que achica el contenedor del hilo. `useStickToBottom`
(`src/dashboard/app/src/hooks/useStickToBottom.ts:24`) solo observa `content`, no `container`: si el contenedor cambia
de alto, el hilo queda despegado del fondo. Mismo caso cuando el textarea del compositor crece con varias líneas.

## Qué cambiar
1. `useStickToBottom.ts`: el `ResizeObserver` observa también `container` (`observer.observe(container)`); misma
   regla: si `stuck.current`, `container.scrollTop = container.scrollHeight`.
2. `OrchestChatView.tsx`: la tira no provoca salto de layout. Mientras `permissions` es `null` y hay `thread?.projectId`,
   renderizar el mismo `<div>` con la misma clase y alto (`mb-1.5 px-1 text-xs`, contenido ` `, `aria-hidden`), sin
   `data-permissions-strip`. Así el alto del compositor no cambia cuando llega la config.
3. Test unitario del hook si existe uno (`rg useStickToBottom src/dashboard/app`); si no existe, no crear andamiaje nuevo.

## Qué no tocar
`chat-roles.mjs` y su paso de crecimiento; el resto del hook.

## Verificación
`bunx tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bun run lint`. El cerebro corre `chat-roles` en vivo.
