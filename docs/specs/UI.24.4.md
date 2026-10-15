# UI.24.4 — Respuesta en streaming con Streamdown

Ítem: PLAN.md § UI.24. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear
(`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Dirección y reglas visuales de UI.24 (PLAN.md § UI.24, "Dirección:"). **PROHIBIDO `git stash`, `git checkout` y
`git restore`**: la contraprueba se hace con copia en `/tmp` + `git show HEAD:<ruta> > <ruta>`, restaurar la copia y
confirmar con `cmp`.

## Objetivo

La respuesta del asistente en el hilo del chat (`src/dashboard/app/src/components/chat/OrchestChatView.tsx`) se dibuja
con Streamdown (2.7.0, Apache-2.0, verificado en npm) en lugar de `react-markdown`, en los dos sitios:
- mensaje persistido: `:415-416` (con el `components.input` de casillas, que se conserva);
- texto en vivo: `:575-576` (`liveText`, mientras `isWorking`).

Resultado esperado: el texto entra por palabra con un fundido corto, el markdown incompleto (negrita o bloque de código
a medio llegar) no parpadea ni muestra marcas sueltas, la altura crece suave, el scroll sigue pegado al final (ya lo
hace `useStickToBottom`, `:55`; no romperlo), y los bloques de código traen botón de copiar.

## Pasos

1. `bun add streamdown@2.7.0 remark-breaks` en la raíz (`package.json`). Leer el README/tipos de
   `node_modules/streamdown` antes de escribir: usar sus props reales para animación por palabra, markdown incompleto
   (`parseIncompleteMarkdown` o equivalente) y estado en curso (`isAnimating` o equivalente). Si la animación por
   palabra o el copiar del bloque de código exigen un plugin aparte (Shiki, `@streamdown/*`), **no** añadir resaltado
   de sintaxis: copiar sin resaltado basta; si el copiar no existe sin plugin, componer un `pre` propio con botón de
   copiar (`Button` de `@/components/ui/button`, solo icono, `aria-label="Copy code"`).
2. **Saltos simples** (hallazgo de UI.24.2): una respuesta pedida "uno por línea" se dibuja como un solo párrafo.
   Pasar `remark-breaks` junto a `remark-gfm` en ambos sitios.
3. Conservar la clase `prose` en el contenedor del texto de la respuesta (los flujos leen `div.prose`:
   `chat-streaming.mjs:165,190,261,394`, y otros). Las clases `[&>p]…` del contenedor se mantienen o se reescriben con
   el mismo resultado visual; tokens `app-*`, ningún color de paleta de Tailwind, sin degradados.
4. Mismo componente para persistido y en vivo: extraer `components/thread/ThreadMarkdown.tsx` (props: `text`,
   `streaming: boolean`) y usarlo en los dos sitios, para que al terminar el turno el texto no salte de un render a
   otro. Con `prefers-reduced-motion`, sin animación por palabra.
5. **Fila de fase (decisión del cerebro, 2026-10-14):** `ThreadThinking` sigue **debajo** del texto en vivo (como
   hoy, `:581`): con el scroll pegado al final queda a la vista donde crece el texto. No moverla.
6. `OrchestDevWorkspace.tsx` (fijado por `ui:fidelity:jsx`) sigue con `react-markdown`: no tocarlo, no quitar la
   dependencia.

## No tocar

Backend, `api/chat.ts`, `ThreadThinking.tsx`, `AgentComposer.tsx`, `components/dev/*`, `components/ui/*`, tarjetas de
tarea (UI.24.5), herramientas (UI.24.7). Selectores que leen los flujos: `div.prose`, `div.max-w-2xl`, `div.max-w-3xl`,
`textarea`, `aria-label="Send message"`, `[data-thread-working]`, "Approve & Run", "Commit & Run", "Retry".

## Gate

Ampliar `scripts/ui-gate/flows/thread-states.mjs` (lámina `ThreadStatesSheet.tsx`, sin LLM) con un estado de
respuesta que tenga: una lista "uno por línea" con saltos simples, negrita, un bloque de código y markdown incompleto
(`**negrita sin cerrar` y un bloque ``` sin cerrar). Pasos:
- `single line breaks`: las 3 líneas se ven en 3 líneas distintas (altura del párrafo ≥ 3 × line-height, o 2 `<br>`).
- `incomplete markdown clean`: el texto visible no contiene `**` ni ```` ``` ````.
- `code block copy`: el bloque de código tiene un botón de copiar visible; al pulsarlo, el portapapeles (o el estado
  "copiado" del botón) refleja el contenido.
- `no palette in thread markdown`: ninguna clase de la regex `PALETTE` de `shell-look.mjs:8` dentro del contenedor.
En `chat-streaming.mjs` (turno real), que siga pasando sin cambiar sus aserciones; si alguna depende del DOM de
`react-markdown`, ajustarla y decir cuál y por qué.
Contraprueba: con `OrchestChatView.tsx` de HEAD (método de arriba), `thread-states` falla en `single line breaks`;
pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check <archivos tocados>
    bun run build:app
    bun run ui:fidelity:jsx
    bun test src/dashboard/app/src/components/thread
    bun run ui:gate thread-states chat-streaming codex-live chat-turn-details text-sweep smoke

Si un gate falla por Codex (`workspace routing discovery failed`, HTTP 502) y no por el hilo, decirlo con la línea del
log y seguir; no es de este ítem.

Reportar: archivos tocados, props de Streamdown usadas (con la cita del README/tipos), cómo se resolvió el copiar, el
tamaño de `main.js` antes y después (`build:app`), y lo que no se pudo cumplir tal cual.

Antes de reportar: `bunx biome format --write <archivos tocados>` (el pre-push corre `lint` y el formato lo bloquea).
