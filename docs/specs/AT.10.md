# AT.10 — el chat usa de verdad el CLI elegido (backend + gating de detección)

Contrato completo en `PLAN.md:142-197`, actualizado por el contrato vigente de
`PLAN.md:30-45` y `ERP.1` (`PLAN.md:63-84`): el selector de CLI se mueve a "Nuevo chat"
(implementado en `docs/specs/ERP.1.md`, spec hermano). **Este spec cubre solo la parte de
backend y gating por detección; NO toca el picker del composer** — eso lo hace ERP.1 en el
mismo commit de cierre o el siguiente.

## Alcance de este spec

1. **Picker gateado por detección real.** `GET /api/system/executor-modes` ya expone
   `modes[].detected` (confirmar el campo exacto leyendo
   `src/dashboard/handlers/*executor-modes*` antes de codear). El picker de "Nuevo chat"
   (ERP.1) debe leer ese campo para habilitar/deshabilitar cada CLI — este spec solo se
   asegura de que el endpoint devuelva lo necesario; si ya lo hace, no tocar el backend
   de detección.
2. **Cero fallback de modelo a CLI** (`src/dashboard/handlers/chat.ts:1098` y de ahí en
   más): hoy `const model = body.model?.trim() || 'deepseek/deepseek-v4-flash'` se usa
   igual para las llamadas a `runCodexChat`/`runOpencodeChat`. Cambiar a: si
   `session.agent` es `'codex'` u `'opencode'` y `body.model` no vino, `model` queda
   `undefined` (no aplicar el default deepseek). Mantener el default actual solo para
   `session.agent === 'api'`. Verificado por qué importa:
   `src/run/executors/opencode.ts:56-60` (`orchestosModelToOpencodeModel`) SÍ traduce
   `deepseek/deepseek-v4-flash` → `openrouter/deepseek/deepseek-v4-flash` (está en el
   catálogo de `models.dev`) — eso es una fuga real a OpenRouter con el default actual.
   `src/run/executors/codex.ts:60-62` (`orchestosModelToCodexModel`) exige prefijo
   `openai/`, así que el default ya se omite ahí solo, pero dejar `model: undefined`
   explícito en ambos por claridad y para que el punto 3 (etiqueta) sea consistente.
3. **Error real, sin reintento silencioso.** Confirmar en vivo (no asumir desde el
   comportamiento de Codex) dónde lee OpenCode su autenticación/configuración —
   equivalente a como AT.9 resolvió `CODEX_HOME` para Codex
   (`src/run/executors/cli-registry.ts:153` y alrededores, symlink de
   `~/.codex/auth.json`). Si OpenCode usa un home distinto (`~/.local/share/opencode` u
   otro — verificar, no adivinar), aplicar el mismo patrón de symlink sin copiar
   secretos. El catch de `chat.ts` para la rama `useOpencodeCli` (cerca de la línea 1443
   en el código actual, verificar número tras el cambio del punto 2) debe devolver 502
   con `provider: 'opencode'` y el mensaje real del CLI — confirmar que hace exactamente
   lo mismo que la rama `useCodexCli` ya hace (`chat.ts:1425-1440`), sin ningún `fetch`
   hacia OpenRouter en ese catch.
4. **Etiqueta de transporte y modelo observado.** Ya existe
   `resultLabel = result.model + ' via Codex CLI'` en la rama Codex. Para OpenCode:
   cuando `orchestosModelToOpencodeModel` devuelva `undefined` (será el caso normal tras
   el punto 2, salvo que el usuario pida un modelo explícito compatible), la etiqueta
   debe decir `CLI default model` (usar/crear la key i18n correspondiente, revisar si ya
   existe algo parecido a `chat.modelfx.modelDecidedBy` en `app.js` y reusar el texto),
   nunca `deepseek-v4-flash` ni ningún modelo no solicitado por el usuario.

## Qué NO tocar en este spec

- `app.js:2908` (`CHAT_UNSUPPORTED_AGENTS`) y el picker del composer/vista `agent` —
  eso es ERP.1, que además **elimina** ese nav item del composer (se mueve a "Nuevo
  chat"). No lo borres ni lo edites desde este spec para no pisar el trabajo de ERP.1.
- `screens-core.js:982-1004` (el `PUT /api/config` del selector de agente) — también
  ERP.1.
- El motor de tareas, `orchestos.config.yaml`, otros CLIs del registro (eso es AT.11).

## Cómo se verifica

1. `bunx tsc --noEmit` limpio.
2. Test nuevo o extendido en `src/dashboard/__tests__/chat.test.ts` (o el archivo
   equivalente que ya cubre `chat.ts`): request con `session.agent='codex'` y sin
   `model` en el body → el mock/spy de `runCodexChat` recibe `model: undefined`, nunca
   `'deepseek/deepseek-v4-flash'`. Mismo test para `agent='opencode'` y
   `runOpencodeChat`.
3. Test: catch de OpenCode produce 502 con `provider: 'opencode'` cuando el spawn
   falla (mock), y ningún `fetch` a OpenRouter se dispara en ese camino (spy sobre
   `fetch` global en el test, o verificar que no hay import condicional a ese código).
4. `bun run test:coverage` verde (gates de cobertura del proyecto).
5. **Gate en vivo, obligatorio, sin credencial de OpenRouter disponible** (solo auth
   propia de cada CLI): dashboard real, dos sesiones ya creadas con Codex y OpenCode
   (pueden crearse a mano con `POST /api/chat/sessions {"agent":"codex"}` /
   `{"agent":"opencode"}` si ERP.1 todavía no tiene el mini-menú en pantalla), enviar un
   mensaje marcador en cada una y confirmar en SQLite (`chat_turns` o la tabla de runs)
   que `provider=codex` / `provider=opencode` respectivamente y que el modelo mostrado
   no es DeepSeek. Si falta un binario o su autenticación, este ítem queda abierto con
   el error exacto — no cerrar con solo uno de los dos CLIs probado.

## Evidencia de cierre

`docs/done/evidence/AT.10-live.json` con el resultado del gate en vivo. Cierre en
`docs/done/bloque-AT.md`. Borrar este spec en el commit de cierre.
