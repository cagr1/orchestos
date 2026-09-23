# UI.14 — Copiar la plantilla nueva de AI Studio y cablearla

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. No invoques `codex exec` ni delegues. Reglas: `PLAN.md` § UI.13
y § UI.14.

**Plantilla:** `~/Documents/screens/orchestos-ai-agent-dashboard/src` (actualizada 2026-09-22 por Carlos en AI
Studio). Se copia **tal cual** (JSX, className, animaciones, tooltips `title`/`aria-label`); lo único que se
escribe es el origen del dato. No sumar CSS.

## Principio que manda en todo el spec (Carlos 2026-09-22)

*"Esas envolturas deben ser mecánicas, no debe costarle nada al usuario."* Toda fila, agrupación, icono, cuota,
anillo y estado se deriva **mecánicamente** (parseo de lo que ya existe). **Ningún LLM** para resumir, rotular o
clasificar. Si un dato no sale mecánicamente, el elemento no se muestra — nunca un número o texto inventado, y
nunca los datos de ejemplo de la plantilla en una sesión real.

## 1. Copiar

Archivos nuevos: `common/AgentComposer.tsx`, `common/ContextRing.tsx`, `layout/ShellStatusBar.tsx`. Reescritos en
la plantilla: `dev/OrchestDevWorkspace.tsx`, `chat/OrchestChatView.tsx`, `layout/ShellSidebar.tsx`,
`dev/OrcaRightInspector.tsx`, `common/ProviderLogos.tsx`, `App.tsx`, `types/orchestos.ts`, `layout/ShellHeader.tsx`
y los demás que difieran (comparar con el mismo formateo biome, como en UI.13.5). Al copiar un archivo que la app
ya cableó (UI.13.2–13.5), **conservar el cableado**: el JSX es el de la plantilla, los datos siguen saliendo de
`src/dashboard/app/src/api/*`. `ShellStatusBar` reemplaza a `SessionStatusBar` y hereda su lógica de UI.13.5
(cuota 5h por `windowMinutes`, vencida → `—`, panel 5h + semanal).

## 2. Logos

Carlos dejó los SVG en `~/Downloads/Icons`. Copiarlos a `src/dashboard/app/src/assets/providers/` y usarlos en
`ProviderLogos` por id del registro (`cli.icon` / `provider`), sin recolorear:
Claude Code → `claude.svg`; Codex → `codex.svg`; modelos OpenAI/ChatGPT por API → `chatgpt.svg`; DeepSeek →
`deepseek.svg`; OpenCode → `opencode.svg`; Gemini → `gemini.svg`; Kimi → `kimi.svg`; Grok → `grok-(xai).svg`
(renombrar a `grok.svg`); Ollama → `ollama-icon.svg`. Id sin logo → icono genérico. Comprobar a 14px y 18px en
tema oscuro y claro; si alguno es monocromo negro y desaparece en oscuro, decirlo en el reporte (no editarlo).

## 3. Cablear

- **Composer (Chat y Dev):** mismo envío que hoy (`/api/chat`, sesión activa). Selector de CLI = CLIs detectados
  (registro, no lista escrita). Dropdown modelo · esfuerzo = los modelos reales del CLI/API
  (`/api/chat/models` y los del CLI); el modelo lo elige Carlos, nunca uno implícito. En Dev, `!cmd` →
  `POST …/exec` de UI.13.4b (misma frontera) y su resultado entra como fila Bash. `/` abre el menú de la plantilla
  solo con comandos que ya existan; si no hay ninguno real, `/` no abre nada.
- **Timeline de Dev:** turnos de la sesión con sus pasos persistidos (`run_steps`, `ExecutorStepEvent` de
  `src/run/executors/step-event.ts`, que ya traduce el stream de claude/opencode/codex sin LLM). Mapeo mecánico:
  `tool_use` Read/Grep/Glob → Read/Search; Edit/Write/MultiEdit → Edit con `+N −M` contado del input; Bash →
  Bash con ✕/✓ por exit code; lecturas consecutivas → una fila "Read N files". Texto del asistente → respuesta
  final en markdown. Medir primero si los turnos de chat/Dev **persisten** sus pasos hoy (UI.13.4b vio 0 turnos
  con pasos en la DB): si no, persistirlos en el mismo flujo que ya los emite en vivo, con test. "Thought · Ns"
  solo si el stream trae razonamiento con duración; si no, no se muestra.
- **Aprobaciones:** no hay backend → la tarjeta no aparece en sesiones reales. Anotar en el reporte.
- **Estado de la sesión (punto de color):** working / done / failed desde el estado real del turno
  (`turn-status`, ya usado en `api/projects.ts`); waiting-for-approval no existe todavía → no se usa.
- **ContextRing (Chat y Dev):** contexto de **esa** sesión — tokens del último turno sobre `contextWindow` del
  modelo. Sin dato → sin anillo.
- **Sidebar:** tiempo transcurrido del agente = el que ya se calcula (UI.13.4a). Sin bloque de cuotas.

## Qué va a medir el gate (Opus, en vivo, :4330, navegador real)

- Capturas lado a lado con la plantilla (`scripts/ui-fidelity/capture.mjs`, ajustar el guion a la vista nueva
  de Dev) — mismo look, con datos reales.
- Un turno real en una sesión de Dev con un CLI (el que elija Carlos): aparecen sus filas Read/Edit/Bash
  derivadas del stream, sin llamadas extra a modelos (comprobar en `runs`: un solo run por turno).
- `!ls` en Dev → fila Bash con ✓ y su salida.
- Tooltip presente en cada botón que es solo icono (Archive, Stop, logos, anillo, barra).
- Logos de `~/Downloads/Icons` en composer, header de sesión, barra y History.
- 0 `pageerror`, 0 `console.error`, 0 HTTP ≥ 400; `typecheck`, `lint`, `test:coverage` en verde (pegar salida).

## Reporte final (corto)

Qué quedó real, qué no se muestra por falta de dato mecánico, y cualquier archivo de la plantilla que no se
copió tal cual (con el motivo).

## Adición (Carlos, 2026-09-22) — botón de actualizar usage

*"quiero un botón de update en los usages porque no se cargan y debo esperar un largo tiempo… solo el icono
refresh-cw pegado al final del último CLI que se muestre"*.

- En `ShellStatusBar`, inmediatamente después del último CLI: botón solo icono `RefreshCw` (lucide, mismo tamaño
  y color muted que los iconos de la barra), `title`/`aria-label` "Refresh usage". Al clic vuelve a pedir
  `/api/session/status`; mientras carga, el icono gira (`animate-spin`) y el botón queda deshabilitado.
- Causa medida por el cerebro: `App.tsx:234-249` pide `/api/session/status` **una sola vez** por proyecto; el
  vanilla refrescaba cada 5 s. Además del botón: refresco automático cada 60 s y al volver el foco a la ventana
  (`visibilitychange`), sin solapar peticiones (abortar la anterior).
- Es mecánico: `account/rateLimits/read` del app-server de Codex y transcripts locales; 0 tokens.

## Ronda 2 — gate del cerebro sobre la ronda 1 (2026-09-22)

La ronda 1 **no copió la plantilla**: `OrchestDevWorkspace.tsx` quedó en 198 líneas contra 737 de la plantilla
(la vista de filas, agrupación, diff inline, salida Bash y tarjeta de aprobación se reemplazaron por un render
propio de líneas de texto con el tipo adivinado); `ShellStatusBar.tsx` es el `SessionStatusBar` viejo renombrado
(308 líneas de diferencia con la plantilla); falta el botón de refresh (Adición); se agregaron textos "No persisted
steps for this session." / "No persisted file diffs for this project." (texto que no aporta: si no hay dato, el
elemento no se muestra). Idénticos a la plantilla y bien: `ContextRing`, `ShellSidebar`. El lint **pasa** — no
volver a llamar "preexistente" a nada sin comprobarlo.

**Medido por el cerebro en `~/.orchestos/db.sqlite`:** `run_steps` solo guarda pasos de **tareas**
(`task_id NOT NULL`; 45 filas, la última del 2026-08-19). Los turnos de chat/Dev no persisten pasos, y
`handlers/chat.ts` no usa `ExecutorStepEvent`. Además `claudeEventToStep` solo mapea `tool_use`, no el resultado
(`tool_result` con `is_error`), así que hoy no hay ✕/✓ mecánico.

1. **Backend mecánico de pasos del turno** (0 LLM):
   - Encontrar dónde el chat invoca cada CLI (Claude Code, Codex, OpenCode) y consumir su stream estructurado
     (`claude … --output-format stream-json --verbose`, `codex exec --json`, `opencode run --format json`) con los
     traductores existentes de `step-event.ts`. Si hoy el chat lee salida de texto plano, cambiarlo al modo JSON
     del mismo CLI sin cambiar modelo ni flags de permisos; la respuesta final sigue siendo el texto del asistente.
   - Extender los traductores, con test por CLI, para: resultado de herramienta (éxito/error y exit code si viene),
     ruta objetivo, y `+N −M` de Edit/Write contado del input (`old_string`/`new_string`, `content`).
   - Migración nueva: tabla `chat_turn_steps(session_id, turn_id, seq, type, tool, target, added, removed,
     exit_code, ok, output, created_at)` (output recortado a 4 KB). `GET /api/chat/sessions/:id/timeline` →
     turnos con sus pasos en orden. Los `!cmd` de `console_commands` entran en el mismo timeline como pasos Bash.
2. **Front: copiar `OrchestDevWorkspace.tsx` de la plantilla tal cual** (sus componentes de fila, agrupación "Read N
   files", diff inline, salida Bash con copiar, "Thought", aprobación) y alimentarlo desde `/timeline`. Cada
   elemento sin dato real no se renderiza (sin aprobación, sin "Thought" si no hay razonamiento con duración).
   Nada de textos de relleno.
3. **Copiar `ShellStatusBar.tsx` de la plantilla tal cual** y alimentarlo con la lógica de UI.13.5 (cuota 5h por
   `windowMinutes`, vencida → `—`, panel 5h + semanal) + la Adición (botón refresh, auto-refresco 60 s y al
   volver el foco).
4. `AgentComposer` (103 líneas de diferencia) y `ProviderLogos` (33): explicar cada diferencia en el reporte;
   solo se admiten las del origen del dato y los SVG de `~/Downloads/Icons`.
5. Gate que voy a correr: diff contra la plantilla con el mismo formateo (≈0 en JSX salvo datos); un turno real
   en Dev con filas derivadas del stream y un solo run en `runs`; `!ls` → fila Bash ✓; refresh gira y actualiza;
   0 errores; `typecheck`, `lint`, `test:coverage` (pegar salida).

## Ronda 3 — cablear sobre la copia literal + pedidos de Carlos

**Gate de la ronda 2:** backend de pasos bien encaminado (`chat_turn_steps`, `persistChatStep`, `/timeline`),
pero **sin tests** (solo +6 líneas en `step-event.test.ts`). El front volvió a no copiar: Dev 354 líneas vs 737,
`ShellStatusBar` distinto de la plantilla (327 líneas de diff). Lint en verde (otra vez no era "preexistente").

**El cerebro ya copió con `cp`** la plantilla sobre `components/dev/OrchestDevWorkspace.tsx`,
`components/layout/ShellStatusBar.tsx` y `components/common/AgentComposer.tsx` (formateados con biome). Tus
versiones de la ronda 2 están en `/tmp/ui14-luna-r2/` **solo como referencia de cableado**. Regla de esta ronda:
en esos tres archivos **solo** se tocan las líneas que traen datos (props, hooks de fetch, mapeo de datos reales,
condiciones "sin dato → no se renderiza"). No se borra ni se reescribe JSX de la plantilla. El gate mide
`diff` contra la plantilla: cada línea distinta debe ser de datos o de los puntos 1–5 de abajo.

0. **Tests que faltan:** `chat-turn-steps` (insertar/leer por sesión en orden), `GET /api/chat/sessions/:id/timeline`
   (turnos + pasos + `!cmd` intercalados por tiempo), y un test por traductor (claude/codex/opencode) con
   resultado de herramienta, exit code y `+N −M`.

### Pedidos de Carlos 2026-09-22 (noche)

Textual: *"no separes codex… usa el logo de chatgpt y deja solo 1 para referirse a la misma compañía… en el usage
se sigue viendo un icono que no pertenece a nadie pero que al presionar dice Codex… se abre repetido 2 veces la
palabra codex, sucede lo mismo para claude y para todos… me quitaste el icono de bot que aparecía en el chat cuando
me respondía el LLM, déjalo me gusta, y al humano ponle el icono de user"*.

1. **Un logo por marca**: Codex CLI y modelos OpenAI/ChatGPT por API usan el **mismo** logo `chatgpt.svg`; Claude
   Code y Claude por API, el mismo `claude.svg`. `codex.svg` no se usa. Aplica en composer, barra, header de
   sesión, History y Runs.
2. **Barra de usage**: cada CLI con su logo de marca real (hoy Codex se ve con un icono que no se reconoce).
3. **Panel de usage sin repetir**: hoy muestra nombre + binario ("Codex / codex", "Claude Code / claude"). Solo
   el logo + un nombre; nada más en la cabecera. Revisar el mismo patrón de repetición en toda la vista copiada
   (tooltips incluidos: el tooltip no repite lo que ya dice el texto visible al lado).
4. **Avatares del chat** (Chat y Dev): mensajes del LLM con el icono **Bot** (lucide `Bot`) como antes de UI.14;
   mensajes del humano con el icono **User** (lucide `User`). Sin etiqueta "You" ni nombre de modelo repetido.
   Esto reemplaza "no avatar" del prompt de AI Studio.
5. **Logo de OpenCode invisible en oscuro** (Carlos: *"hazlo blanco"*): `opencode.svg` usa `fill="currentColor"`;
   cargado como `<img>` el `currentColor` queda negro. Renderizarlo inline (o con `mask`) y con la clase de texto
   del tema (`text-app`): blanco en los temas oscuros y oscuro en Light, sin editar el SVG. Revisar si otro logo de
   `~/Downloads/Icons` usa `currentColor` y aplicar lo mismo.

## Ronda 4 — freno mecánico primero, después cablear (2026-09-22)

Gate de la ronda 3: el front volvió a no copiar (Dev 54 className vs 154 de la plantilla; igual en `ShellStatusBar`
y `AgentComposer`). Backend y tests de la ronda 3 quedan como están. Esta ronda no se reporta hasta que el freno
esté en verde.

1. **Escribir `scripts/ui-fidelity/check-jsx.mjs`** (sin dependencias nuevas; TypeScript del repo o regex):
   `node scripts/ui-fidelity/check-jsx.mjs <archivo-plantilla> <archivo-app>` extrae de la plantilla el multiconjunto
   de (a) cada valor de `className` (literal, partes estáticas de template literal y strings dentro de `cn(...)`/
   ternarios) y (b) cada nombre de elemento JSX (`<div`, `<button`, componentes). Falla (exit 1) si en la app falta
   alguno o aparece menos veces, y lista cada faltante con su línea en la plantilla. Sin flag para desactivarlo.
   Única excepción: `scripts/ui-fidelity/jsx-allow.json` con `{archivo, valor, motivo}` para className que en la
   plantilla viven **solo en datos de ejemplo**; el script imprime cada excepción usada. El cerebro revisa cada una.
   Script `ui:fidelity:jsx` en `package.json` que lo corre para los 3 archivos de abajo (y los demás copiados de la
   plantilla que ya pasen).
2. **Test del script** (`scripts/ui-fidelity/check-jsx.test.ts` o equivalente en la suite): falla si falta un
   className, falla si falta un elemento, pasa con archivo idéntico, pasa si solo cambian datos.
3. **`cp` de nuevo** la plantilla sobre `components/dev/OrchestDevWorkspace.tsx`, `components/layout/ShellStatusBar.tsx`
   y `components/common/AgentComposer.tsx`, `biome format --write`, y correr el check: debe salir verde antes de tocar
   nada.
4. **Cablear** con las versiones de `/tmp/ui14-luna-r2/` como referencia de datos, corriendo el check después de
   cada archivo. Todo lo de §3, Adición y Ronda 3 (1–5) sigue vigente. Elemento sin dato real → se envuelve en
   condición (`{dato && …}`), no se borra: así el className sigue en el archivo y el check lo ve.
5. **Reporte:** salida literal de `bun run ui:fidelity:jsx`, `bun run typecheck`, `bun run lint`,
   `bun run test:coverage` (tests antes/después), conteo className app vs plantilla de los 3 archivos, y lista de
   excepciones de `jsx-allow.json` con motivo.

### Ronda 4b — logos monocromos en temas oscuros (Carlos 2026-09-22)

*"el icono de chatgpt está de color negro, asegúrate que sea de color blanco mientras los temas sean oscuros"*.
Medido por el cerebro: `chatgpt.svg` es `fill="black"` y `grok.svg` `fill="#1D1C1B"` (un solo color); en
`ProviderLogos.tsx:58` solo opencode/ollama van por `mask` + `bg-current`. Llevar chatgpt y grok al mismo camino
(comparar por asset, no por `norm`, porque codex/openai/api también resuelven a `chatgptAsset`). `kimi.svg` es
azul + negro: no pasarlo por mask (perdería el azul); anotar en el reporte si su parte negra se pierde en oscuro.

### Gate de la ronda 4 (cerebro, 2026-09-22)

`ui:fidelity:jsx` verde en los 3 (className Dev 154/154), sin excepciones. `typecheck` verde. `test:coverage` fuera
del sandbox: 1483 pass / 0 fail (los 3 fallos del reporte eran del sandbox). **Lint rojo por 4 archivos propios**
(`organizeImports` en `check-jsx.test.ts`, `AgentComposer.tsx`, `OrchestDevWorkspace.tsx`, `ShellStatusBar.tsx`):
por cuarta vez no era "preexistente". Ronda 4c = `biome check --write` de esos 4 + Ronda 4b, check JSX en verde.

## Ronda 5 — reporte de Carlos en vivo (2026-09-22)

*"el logo de chatgpt en el usage bar sigue negro, opencode igual… presiono el botón para que se actualice y no se
actualiza… no puedo seleccionar ni el modelo ni el esfuerzo… el icono de user debería estar del lado derecho…
hover sobre el anillo de contexto sale un puntero con ?"*. Diagnóstico del cerebro:

1. **Logos:** `src/dashboard/app/dist` era de las 17:32, anterior a la ronda 4c. Al terminar: `bun run build:app`.
2. **Modelo/esfuerzo:** `AgentComposer.tsx:18-23` declara cada CLI con `models: []`; solo la API trae modelos
   (`/api/chat/models`). Nuevo `GET /api/chat/cli-models` (mecánico, 0 tokens, con test) → por CLI detectado
   `{ id, models: [{id, name}], efforts: string[] }`:
   - Codex: `~/.codex/models_cache.json` (`slug`, `display_name` si existe, `supported_reasoning_levels[].effort`).
   - Claude Code: parsear `claude --help` (alias de `--model` y valores de `--effort`); medir primero qué trae.
   - OpenCode: `opencode models` (cachear); esfuerzo solo si el CLI lo expone (medir `opencode run --help`).
   - CLI sin fuente medible → sin modelos; el dropdown no se abre (no inventar). Esfuerzos del dropdown = los del
     modelo/CLI elegido, no la lista fija `EFFORT_STEPS`.
   Comprobar que `onSend` manda cli + modelo + esfuerzo y que `handlers/chat.ts` los usa de verdad para cada CLI
   (`--model`/`--effort` en Claude, `-m`/`-c model_reasoning_effort` en Codex, `-m` en OpenCode). Test por CLI de
   los argumentos armados.
3. **Avatar humano a la derecha** (Chat `OrchestChatView.tsx:112-113` y los dos bloques de Dev `:389`, `:754`): el
   icono `User` va **después** de la burbuja (a la derecha); el `Bot` sigue a la izquierda.
4. **Anillo de contexto:** `ContextRing.tsx:43` `cursor-help` → `cursor-default` (el `?` es ese cursor de la
   plantilla; Carlos no lo quiere). El tooltip `title` se conserva.
5. **Refresh de usage (UI.13.6, mismo turno):** el botón sí vuelve a pedir, pero el backend devuelve lo mismo: Codex
   `observedAt 2026-09-18` con reinicios vencidos (→ `—`), Claude `rateLimits: null`. Medir cuánto tarda
   `account/rateLimits/read` del app-server de Codex (`readCodexRateLimitsLive`, `scripts/context-adapters.ts:197`,
   timeout 1,5 s) y corregir para que devuelva el dato vivo (timeout adecuado o proceso reutilizado); test. Claude:
   no hay fuente mecánica persistida (IDEAS.md:832) → sigue `—`; decirlo en el reporte, no inventar.
6. Gate: `ui:fidelity:jsx`, `typecheck`, `biome check . --diagnostic-level=error`, `bun test` de lo tocado. El
   cerebro corre `test:coverage` fuera del sandbox.

### Ronda 5b — gate del cerebro sobre la ronda 5, fuera del sandbox (2026-09-22)

- `/api/chat/cli-models` en vivo: Codex 9 modelos + esfuerzos OK; OpenCode 377 modelos OK (`opencode models` solo
  falla dentro del sandbox); **Claude 0 modelos**. `claude --help` dice textual: *"Provide an alias for the latest
  model (e.g. 'fable', 'opus', or 'sonnet')"* → parsear esos alias del help (mecánico) como modelos de Claude.
- **Cuota Codex sigue vencida** (`observedAt 2026-09-18`): `readCodexRateLimitsLive` devuelve `[]` en 87 ms. Medido a
  mano: `codex app-server` (sin `--stdio`, que no figura en `codex app-server --help`), con `initialize` +
  notificación `initialized` + `account/rateLimits/read` y **stdin abierto**, responde en ~600 ms con
  `rateLimits.primary {usedPercent:3, windowDurationMins:300, resetsAt}` y `secondary {usedPercent:29, 10080}`.
  El `stdin.end()` de `scripts/context-adapters.ts:220` (y/o `--stdio`) hace que salga sin responder. Corregir:
  sin `--stdio`, enviar `initialized`, no cerrar stdin hasta tener la respuesta o el timeout, timeout 3 s. Test con
  binario falso que solo responde si stdin sigue abierto. Probar en vivo con un script fuera del sandbox no es
  posible para ti: el cerebro lo verifica.

## Ronda 6 — segundo reporte de Carlos en vivo + gate de 5b (2026-09-22)

Gate 5b (cerebro, fuera del sandbox): cuota Codex viva OK (3%/29%, 498 ms). Fallas:
- `test:coverage`: **2 fail** (`engine-selection.test.ts:457`, `tasks-api-engine.test.ts:240`): `schema.ts` sumó
  `max`/`ultra` a codex y esos tests exigen que se rechacen. `models_cache.json` confirma que Codex los soporta →
  actualizar los tests para rechazar un nivel que de verdad no exista (p. ej. `turbo`), no borrarlos.
- `/api/chat/cli-models` en vivo (4242 reiniciado) sigue con **Claude 0 modelos**. Reproducir contra el servidor
  real, no solo con test.

Carlos, textual: *"hay una cierta demora al cargar el usage bar… settings/usage ese gráfico está muy mal hecho,
debería ser tal cual el de GitHub, la separación está demasiado de los cuadros… muestra 'anthropic/claude-haiku-4
via Claude Code CLI' — este texto está demás; si acaso agrupar por uso de API o de CLI… escribí Hola y no hay una
animación mientras el agente está trabajando… salió al lado de mi palabra hola 'src/run/router.ts contextWindow'…
después contesta un 'Read 3 files'… no puedo copiar los mensajes, y la hora de los mensajes no es la de mi zona
horaria"*.

1. **Datos de ejemplo de la plantilla en sesión real (la falla más grave):** `OrchestDevWorkspace.tsx:389-440` y
   alrededores renderizan contenido fijo de la plantilla (`src/run/router.ts`, `contextWindow`, `Thought · 6s`,
   `Read 3 files`, `ContextExceededError`, salida de test). Esos bloques estáticos se convierten en el **renderer**
   de cada paso/mensaje real (mismo JSX/className, texto desde el dato); si no hay dato, no se renderizan. Extender
   `check-jsx.mjs`: además del multiconjunto, falla si el archivo de la app contiene un texto de ejemplo de la
   plantilla. Lista en `scripts/ui-fidelity/jsx-sample-text.json` (`{archivo, texto}`: rutas, nombres de test,
   código, duraciones, nombres de ejemplo). El cerebro revisa la lista. Revisar Chat y Dev enteros, no solo esas
   líneas.
2. **Indicador de trabajo:** mientras el turno esté `working` (estado real, `turn-status`), mostrar un indicador en
   el hilo (el de la plantilla si existe; si no, `Loader2 animate-spin` + puntos, mismos tokens de color) en Chat y
   Dev. Desaparece con `done`/`failed`.
3. **Copiar mensajes:** botón solo icono `Copy` (lucide) al hover en cada mensaje (usuario y asistente), Chat y
   Dev; `title`/`aria-label` "Copy"; al copiar cambia a `Check` 1,5 s. Copia el texto crudo (markdown).
4. **Hora local:** los mensajes muestran hora en la zona del navegador. Encontrar por qué no
   (`api/chat.ts:164` `toTimestamp`; ¿`createdAt` de SQLite sin `Z` interpretado como local, o formateo en UTC?).
   Test con un `createdAt` fijo.
5. **Usage bar lento:** `/api/session/status` tarda 2,5–4,7 s medido. Medir por CLI qué tarda (el cerebro no
   desglosó) y: sondas en paralelo, y el front pinta el último estado conocido al instante (guardado en memoria
   del servidor o `localStorage`) mientras refresca. Meta: barra visible < 300 ms tras abrir la app.
6. **Settings → Usage:**
   - Heatmap **como el de GitHub**: celdas cuadradas de 10 px, separación 3 px, `rounded-[2px]`, 7 filas (días) ×
     53 columnas (semanas), meses arriba, 4-5 niveles de intensidad con el color de acento; sin espacio extra
     entre cuadros.
   - Lista de consumo: agrupar en **CLI** y **API**; cada fila = logo + modelo corto (sin `anthropic/`, sin
     "via Claude Code CLI") + cifra. Nada más de texto.
7. **Claude sin modelos** y **2 tests rojos**: ver gate 5b arriba.
8. Gates: `ui:fidelity:jsx` (con la regla nueva de texto de ejemplo), `typecheck`,
   `biome check . --diagnostic-level=error`, `bun test` completo con 0 fail en lo que no dependa del sandbox (listar
   los que fallen por sandbox con el error literal).

Turno real del gate en vivo (Carlos): **Codex · gpt-5.6-luna · medium**.

## Ronda 7 — tercer reporte de Carlos (2026-09-22)

Textual: *"el gráfico de la barra en la cuota semanal no sale… no se ve la quota de Claude… en chat mode y dev mode
al iniciar una conversación solo se pueda usar 1 solo CLI, porque si cambiamos a medio camino el contexto no
serviría… así se cambie de modelo, el contexto debe ir acumulándose y el radio ponerse en rojo si ya hay mucho…
lo de esfuerzo está bien, solo depende de mí como usuario, no debería ser una regla de OrchestOS… el usage aún no
se ve como el de GitHub… esto ya estaba bien en la versión anterior… me gustan los colores, pero necesito que se
vea como estaba antes"*.

1. **Barra semanal invisible:** `ShellStatusBar.tsx` usa `bg-app-muted/60` para el relleno semanal; medir en el
   CSS compilado si esa clase existe (token con opacidad sobre variable). Si no, usar un token que sí se genere
   (mismo que la 5h o `bg-app-accent/60`). Verificar en `dist/main.css`. Quitar el texto de relleno "No quota limits
   configured or enforced for this CLI." (sin dato → sin panel de cuota, no una frase).
2. **Un CLI por sesión (Chat y Dev):** al primer mensaje, la sesión queda atada a su CLI (`chat_sessions.agent`).
   Después, el selector de CLI del composer queda bloqueado (se ve el logo, no se puede cambiar; tooltip con el
   motivo en pocas palabras). El modelo y el esfuerzo sí se pueden cambiar. El backend rechaza (400) un turno cuyo
   CLI no coincide con el de la sesión. Test.
3. **Anillo de contexto acumulado:** usado = tokens de entrada del **último** turno de esa sesión (que ya incluye
   todo el historial del hilo del CLI) sobre `contextWindow` del modelo actual; al cambiar de modelo el hilo sigue,
   así que el número sigue creciendo. Colores: < 60 % acento, 60–80 % ámbar, ≥ 80 % rojo (tokens de color que ya
   existan). Test del cálculo.
4. **Esfuerzo sin reglas de OrchestOS:** decisión de Carlos: el nivel es su elección. Quitar la validación de
   esfuerzo por engine (`src/tasks/schema.ts`), aceptar el nivel que el CLI reporte, y ajustar/eliminar los tests
   que exigían rechazar niveles (`engine-selection.test.ts:457`, `tasks-api-engine.test.ts:240`) — anotando en el
   reporte que se quitan por decisión de Carlos.
5. **Heatmap como estaba en la versión anterior (vanilla, `/legacy`):** fuente `src/dashboard/public/screens.css:
   1075-1130` + `public/screens-ops.js:1636-1644`: flex de columnas por semana, celda 11×11 px, `gap` 3 px en ambos
   ejes, fila de meses alineada a las columnas de semana (cada `span` de 11 px), 5 niveles por `color-mix` del
   acento sobre la superficie, leyenda debajo. Hoy la app usa `grid grid-flow-col grid-rows-7 min-w-[500px]`, que
   estira las columnas y separa los cuadros. Reproducirlo con Tailwind (`w-[11px] h-[11px] gap-[3px]`, colores
   actuales). Carlos compara con `/legacy`.
6. Gates como en la ronda 6; al final el cerebro compara el heatmap con `/legacy` en navegador.

**Claude quota (no delegar todavía):** la única fuente mecánica es el `rate_limits` del payload de la statusLine
de Claude Code (Orca la reenvía con `~/.orca/agent-hooks/claude-statusline.sh`). Requiere tocar
`~/.claude/settings.json` global → espera OK de Carlos. Solo se actualiza cuando corre una sesión interactiva de
Claude Code (no en `claude -p`).

## Ronda 8 — cuota de Claude Code (GO de Carlos 2026-09-22: *"necesitamos ver la quota de todos los CLI y siempre"*)

Medido por el cerebro: payload real de la statusLine de Claude Code (copia en `/tmp/claude-statusline-payload.json`):
`rate_limits: { seven_day: { used_percentage: 18, resets_at: 1790236800 } }` (esta vez sin `five_hour`; el
changelog de Claude Code documenta `five_hour` y `seven_day` con `used_percentage` y `resets_at`).

1. `scripts/claude-statusline-tee.sh` (POSIX sh, sin dependencias): lee todo stdin; si contiene `"rate_limits"`,
   escribe el payload de forma atómica (tmp + `mv`) en `${ORCHESTOS_HOME:-$HOME/.orchestos}/claude-statusline.json`;
   después reenvía el payload **idéntico** por stdin al comando original, cuya ruta/comando recibe en
   `$ORCHESTOS_STATUSLINE_NEXT` (si está vacío, no imprime nada). Nunca falla la statusLine: errores → silencio,
   exit 0. Test con `sh` y un payload de ejemplo (escribe el archivo, reenvía idéntico, sin rate_limits no escribe).
2. Lectura en `/api/session/status` para `claude`: leer ese archivo, mapear `five_hour` → `windowMinutes 300`,
   `seven_day` → `10080`, `usedPct = used_percentage`, `resetsAt = resets_at`; `observedAt` = mtime. Ventana con
   `resetsAt` pasado → no se muestra (misma regla de UI.13.5). Test.
3. En la barra: si un CLI solo tiene semanal, se muestra la semanal (el % de la barra = la ventana más corta
   disponible) — no `—`.
4. **No tocar `~/.claude/settings.json`:** la instalación la hace el cerebro. Dejar en el reporte el comando exacto a
   poner en `statusLine.command`.

### Gate de la ronda 6 (cerebro, fuera del sandbox)

`test:coverage`: 1489 pass / **1 fail** — `H.7.5 GET /api/session/status > sin transcript devuelve un estado vacío
explícito` (esperaba `available:false`, recibe `true`). Causa probable: la caché nueva de `session-status.ts` y/o
`readCodexRateLimitsLive` leyendo el Codex real del host dentro del test. Regla CI (CLAUDE.md): todo binario del
sistema va detrás de una sonda inyectable; la caché se aísla por test. Arreglarlo sin debilitar el test. Lint y
typecheck verdes.

## Ronda 9 — gate en vivo del cerebro (2026-09-22, :4242, Playwright, turno real Codex · gpt-5.6-luna · medium)

Verde: cuotas vivas Claude (5h 90 %, semanal 61 %) y Codex; selector con modelos/esfuerzos reales; CLI bloqueado
("CLI locked for this session"); un run por turno; pasos persistidos (2 comandos, exit 0); avatares; heatmap ya
con celdas de 11 px. Gates 1493/0. Fallas, **en este orden de prioridad**:

1. **El modelo elegido se descarta en silencio (grave, [[modelo = decisión de Carlos]]):** el composer manda
   `model: "gpt-5.6-luna"`; `orchestosModelToCodexModel` (`src/run/executors/codex.ts:60`) solo acepta `openai/*`
   → `undefined` → Codex corre su default y el run queda `codex (cli default model)`. Los ids que vienen de
   `/api/chat/cli-models` son ids **nativos del CLI** y se pasan tal cual (`-m gpt-5.6-luna` en Codex, alias
   `fable|opus|sonnet` en Claude, `provider/model` en OpenCode). Revisar los tres caminos (`codex.ts`,
   `external.ts` `orchestosModelToCliModel`, `opencode.ts`). `runs.model` = el modelo realmente pedido. Si un modelo
   pedido no se puede pasar, **error visible**, nunca caer al default. Test por CLI con los argumentos armados.
2. **Colores `app-*` sin variantes:** `index.css` define `.bg-app-surface{…}` etc. a mano, así que ninguna variante
   con opacidad ni `hover:`/`divide-`/`border-` sobre esos colores se genera (medido: `bg-app-accent/60`,
   `bg-app-surface/60`, `hover:bg-app-surface/60`, `bg-app-muted/60` **no existen** en `dist/main.css`; 62 usos en
   `src/dashboard/app/src`, heredados de la plantilla). Síntomas: relleno de la barra semanal invisible, bordes
   blancos en burbujas del asistente y filas de tablas. Arreglo: declarar los colores en `@theme inline`
   (`--color-app-surface: var(--app-surface)`, …) y **borrar** las utilidades escritas a mano que Tailwind pasa a
   generar (el CSS baja). Medir antes/después cuántas de esas 62 clases existen en `dist/main.css` (meta: todas).
3. **Timeline de Dev:** los pasos de Codex llegan como `tool_use` `command` **sin `target`** (no se ve el comando) y
   se pintan como "Thought"; los `text` no son razonamiento. Extraer el comando (`item.command`) y su salida/exit
   del stream de `codex exec --json` → filas Bash de la plantilla con ✓/✕ y salida. "Thought" solo si el stream
   trae razonamiento. `step_finish` no se pinta. Test del traductor con un evento real de Codex.
4. **Composer:** (a) al reabrir una sesión se resetea a `GPT-6-Astra · high`: debe mostrar el último modelo/esfuerzo
   usado en esa sesión; (b) en un chat de Claude el composer dice "Message ChatGPT…" y el botón de CLI sale vacío:
   placeholder y logo = CLI de la sesión; (c) el dropdown modelo/esfuerzo no se cierra con Escape ni al elegir
   modelo.
5. **Markdown de la respuesta:** los saltos de línea entre bloques de texto se pierden ("…sin editar nada. name:
   orchestos" en una sola línea). Unir los `text` del turno con `\n\n` y renderizar markdown.
6. **Anillo de contexto vacío** tras un turno de Codex con tokens: alimentarlo con el uso del turno (ronda 7 §3).
7. **Settings → Usage:** (a) etiquetas de mes fijas Ene–Dic, pero la actividad es de las últimas 53 semanas (hoy
   septiembre cae bajo "Nov/Dic"): calcular cada mes por la columna de su primera semana, como `screens-ops.js`;
   (b) filas duplicadas (error React de key duplicada `cli-codex (cli default model) via Codex CLI`): agrupar por
   CLI+modelo normalizado; (c) etiqueta: logo + modelo; `(cli default model)`/`via X CLI` → "default"; `unknown` →
   no se muestra la fila.
8. **Panel de cuota:** reinicio semanal muestra solo la hora ("resets 3:00 AM"); si falta más de 24 h, día + hora.
9. **Modal "Launch Agent":** "Claude Code" repetido a la derecha y "Detected CLI available for new sessions" en cada
   fila: texto que no aporta → fuera (logo + nombre).
10. **Prompt del chat con un CLI:** dice "You are running as model: GPT-5.6-Luna via OpenRouter" (es Codex CLI) y
    en Dev "you cannot modify files or run code" (en Dev sí actúa como CLI); el bloque "Security boundary" sale dos
    veces. Corregir las tres cosas; test del prompt armado.
11. `GET /api/plan` → 409 en un proyecto que no es la raíz → `console.error` en el navegador. El front no debe
    pedirlo o el back devuelve 200 con `unavailable`.
12. `ShellStatusBar.tsx:203-209`: `div` inalcanzable (`quota5h < 0`) solo para conservar una className en el check.
    Borrarlo y declarar la excepción en `jsx-allow.json` con motivo.
13. Gates: `ui:fidelity:jsx`, `typecheck`, `biome check . --diagnostic-level=error`, `bun test` de lo tocado. El
    cerebro corre `test:coverage` y repite el gate en vivo.

### Ronda 9b — gate del cerebro (suite completa fuera del sandbox: 1489 pass / 4 fail)

Luna corrió solo tests focalizados; la suite completa tiene 4 regresiones reales:
- `opencode-catalog.test.ts:192,196`: `orchestosModelToOpencodeModel('not-a-real/model')` ahora devuelve el id tal
  cual → inventa. Regla: un id es válido si está en el catálogo real de OpenRouter **o** en la lista de
  `opencode models` (la misma de `/api/chat/cli-models`); si no está en ninguno → `undefined` y el chat responde
  error visible. Los tests existentes siguen verdes; sumar uno para un id nativo de `opencode models`.
- `claude-chat.test.ts:385`: con un modelo que Claude no acepta, el run queda etiquetado
  `deepseek/deepseek-v4-flash` aunque no se pasó `--model` → **miente sobre el modelo**. Si el modelo pedido no se
  puede pasar: error visible (punto 1 de la ronda 9); si no se pidió modelo: `claude (cli default model)`.
- `claude-chat.test.ts:201`: la unión de textos cambió a `\n\n` (pedido en la ronda 9 §5): actualizar el test a la
  unión nueva, sin quitarlo.
- `border-app-accent/80` sigue sin generarse en `dist/main.css` (las otras 25 sí).
Gate: `bun test` **completo** (no focalizado) + los de siempre; listar cualquier fallo con su error literal.

### Ronda 9c — la app no carga (cerebro, navegador real)

Página en blanco, `pageerror: TypeError: Invalid option : option`. Causa: `ShellStatusBar.tsx:19-22` mezcla
`timeStyle` con `weekday/month/day` en `Intl.DateTimeFormat` (no se permite). Cambiar a `hour`/`minute` explícitos
(+ `weekday`/`month`/`day` si faltan > 24 h). Exportar `formatReset` y testearlo con < 24 h y > 24 h (el test debe
fallar con el código actual). Ningún otro cambio.

## Ronda 10 — CSS roto por la ronda 9 + cuarto reporte de Carlos (2026-09-22)

### 0. Urgente: la ronda 9 rompió los colores (medido en navegador real con `getComputedStyle`)
- `index.css` `@theme inline` usa `rgb(from var(--app-accent) r g b / <alpha-value>)`: `<alpha-value>` es sintaxis
  de Tailwind **v3**; en v4 la declaración es inválida → `bg-app-accent`, `border-app-accent`, success/warning/
  error computan `rgba(0,0,0,0)`. **Todas las barras de cuota** (5h y semanal) quedaron invisibles. En v4 basta
  `--color-app-accent: var(--app-accent);` — las variantes `/NN` salen solas con `color-mix`.
- Se borraron `.border-app`, `.text-app` (y `divide-app`) a mano, pero Tailwind **no** las genera (no hay color
  `app`): hoy no existen en `dist/main.css` → bordes blancos (`currentColor`) en paneles, composer, burbujas y
  tablas; `text-app` sin color. Restaurarlas con `@utility` de v4 (`border-app`, `divide-app`, `text-app`) con sus
  variables.
- **Freno mecánico nuevo** `scripts/ui-fidelity/check-css.mjs` (dentro de `ui:fidelity:jsx` o script propio en el
  mismo gate): extrae de `src/dashboard/app/src` cada clase `(variante:)*(bg|text|border|divide|ring|fill|stroke|
  from|to|via|outline|shadow)-app(-…)?(/NN)?`, y falla si alguna no existe en `dist/main.css` o si el CSS contiene
  `<alpha-value>`. Corre tras `build:app`. Test del script.

### Reporte de Carlos
Textual: *"no veo que se dibuje la barra de la cuota semanal… si ya elijo el CLI no tiene lógica mostrar el icono
dentro del chat (chat y dev), con que se vea arriba es suficiente… el icono de user está muy pegado al box, déjalo a
la misma distancia que el del bot… cuando abro un nuevo proyecto no se abre la ventana para indicar la ruta… los
modelos de Claude solo dicen Sonnet - Opus - Fable, no qué versión, cosa que sí hace Codex… en el lado izquierdo
sale 'Agent: Claude Code on Sala…': debería ponerle un nombre a la conversación diciendo con qué agente, p. ej.
'Claude: Ok', 'Codex: pregunta sobre estado…'… poder ejecutar comandos /usage /rename, etc. directo desde el chat"*.

1. **Barra semanal:** se resuelve con §0; verificar con `getComputedStyle` que el relleno no es transparente.
2. **Composer sin selector de CLI** (Chat y Dev): el botón de CLI del composer se quita; el CLI se ve en la cabecera
   de la sesión. Excepción declarada en `jsx-allow.json` con motivo "Carlos 2026-09-22". Modelo · esfuerzo queda.
3. **Avatar humano:** misma separación a la burbuja que el `Bot` (mismo `gap`/margen).
4. **Nuevo proyecto no abre selector de ruta (grave):** `AddProjectModal.tsx` es el de la plantilla (nombre + rama,
   `onCreate` sin backend). El backend ya tiene `POST /api/projects/choose` (selector nativo de macOS, devuelve el
   proyecto o `{cancelled:true}`). El botón abre el selector nativo, y al volver agrega/selecciona el proyecto real;
   cancelado → no pasa nada; error → mensaje visible. Si el modal de la plantilla no tiene dato real (nombre/rama se
   derivan de la carpeta), no se muestra. Test del handler si falta.
5. **Versiones de Claude** (mecánico): fuentes medidas por el cerebro: `~/.claude/stats-cache.json` `modelUsage`
   (ids completos usados: `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-8`, …) y la
   statusLine (`~/.orchestos/claude-statusline.json` → `model: {id: "claude-opus-5-5", display_name: "Opus 5.5"}`).
   Lista = unión de ids completos (sin sufijo de fecha duplicado), etiqueta derivada del id
   (`claude-opus-5-5` → "Opus 5.5", `display_name` si existe), ordenados por familia y versión descendente; se
   pasan tal cual a `--model`. Los alias `fable|opus|sonnet` quedan solo si no hay ningún id de esa familia.
6. **Título de sesión mecánico (0 tokens):** al primer mensaje, título = `<CLI corto>: <primer mensaje recortado a
   ~40 car.>` (p. ej. "Claude: Ok", "Codex: pregunta sobre estado…"). Sin LLM. Reemplaza "Agent: X on proyecto".
   Test.
7. **Comandos `/` en el composer (Chat y Dev):** la plantilla trae el menú `/`. Solo comandos que OrchestOS
   ejecuta de verdad, sin LLM: `/rename <título>` (renombra la sesión), `/usage` (abre el panel de cuota del CLI de
   la sesión), `/model` (abre el dropdown modelo·esfuerzo), `/archive` (archiva la sesión), `/clear` solo si existe
   un endpoint real. Medir si `claude -p "/usage"`, `codex exec "/status"` u otros comandos del CLI funcionan en
   modo no interactivo; los que funcionen se agregan y los que no, se listan en el reporte (no se inventan).
8. Gates: `build:app` → `check-css` + `ui:fidelity:jsx`, `typecheck`, `biome check . --diagnostic-level=error`,
   **`bun test` completo**. El cerebro repite el gate en navegador.

Nota del cerebro: el heatmap está bien — la primera fila de `runs` es del 2026-07-16 (por eso la actividad empieza
bajo "Jul") y el último cuadro es hoy.

### Ronda 11 — gate en navegador de la ronda 10 (cerebro)

Verde: colores (relleno 5h `rgb(56,189,248)`, semanal `oklab(… / 0.6)`), `check-css` 52 clases, bordes, suite
1498/0, heatmap. **Fallas** (reproducción: `/tmp/ui14-gate5.mjs` contra `:4242` — Dev → "Launch new agent" en
orchestos → Codex → Launch → dropdown modelo):

1. **Regresión grave:** sesión nueva de Codex → el dropdown modelo/esfuerzo abre **vacío**, la etiqueta dice
   `codex · high`, el placeholder "Message ChatGPT…". El turno se envió con modelo `codex` → `run.model = codex`,
   turno `failed: codex produced no turn.completed event`. El composer debe tomar CLI, modelos y esfuerzos del
   `agent` de la sesión (`/api/chat/cli-models`) desde el primer render, y el placeholder = nombre del CLI.
   Backend: un modelo que no está en el catálogo del CLI → 400 con mensaje visible **antes** de lanzar el CLI.
   Tests: composer con sesión `codex` (modelos cargados, etiqueta = primer modelo real o el último usado) y
   rechazo del modelo inválido.
2. **El icono del CLI sigue dentro del composer** (ronda 10 §2 no quedó): quitarlo en Chat y Dev.
3. **Etiquetas de Claude:** `claude-haiku-4-5-20251001` → "Haiku 4.5" (sin la fecha); orden por familia
   (Fable, Opus, Sonnet, Haiku) y versión descendente; ids con y sin fecha de la misma versión → uno solo.
4. **Gate en navegador obligatorio para ti:** intenta correr `/tmp/ui14-gate5.mjs` (cámbiale `B` a un dashboard tuyo
   en otro puerto: `bun run src/cli.ts dashboard --port 4331`); si el sandbox no te deja lanzar Chromium o el
   servidor, pega el error literal y no lo des por verificado.
5. Gates: `build:app`, `check-css`, `ui:fidelity:jsx`, `typecheck`, `biome`, `bun test` completo.

### Ronda 11b — gate del cerebro sobre la ronda 11 (2026-09-22, fuera del sandbox, :4242)

Verde: catálogo `/api/chat/cli-models` correcto (Codex con ids reales y esfuerzos por modelo; Claude "Haiku 4.5",
orden por familia), icono CLI fuera del composer. **Fallas medidas:**

1. **Causa raíz de "modelo `codex`":** `AgentComposer` espera `Promise.all([/api/session/status (1.8 s),
   getChatModels, getCliModels (1.1 s)])` antes de tener modelos. Hasta entonces `selectedModel = ''` (porque
   `defaultModel` = `session.agent` = `codex` se descarta, bien) → la etiqueta dice ` · high`, el dropdown abre vacío
   y si se envía, `model` va vacío → el backend usa el default del CLI y el run queda `model = codex`, `failed`.
   Arreglo:
   - Cargar el catálogo del CLI de la sesión sin depender de `/api/session/status` (promesas independientes; el
     CLI bloqueado no necesita la detección para mostrar sus modelos).
   - Mientras el catálogo del CLI de la sesión no llegó: etiqueta "Loading models…" (o equivalente corto), botón de
     enviar deshabilitado y Enter no envía. Nunca se envía un turno de CLI con `model` vacío.
   - Selección inicial = último modelo usado en la sesión (`lastModel`, si está en el catálogo) si no, el primero
     del catálogo. Esfuerzo inicial = uno válido para ese modelo (`model.efforts`), respetando el último usado.
   - Backend: sesión de CLI (`claude|codex|opencode`) con `model` vacío y catálogo no vacío → 400 con mensaje
     visible, igual que el modelo inválido, **antes** de lanzar el CLI y sin crear run `failed`.
   - Tests: composer con sesión `codex` sin catálogo → no envía; con catálogo → etiqueta = primer modelo real;
     con `lastModel` válido → ese. Handler: modelo vacío en sesión CLI → 400.
2. **Test roto** `chat-sessions.test.ts` "R.6 persiste el costo canónico del CLI…": manda
   `model: 'anthropic/claude-sonnet-5'` a una sesión `claude` → la validación nueva responde 400 ×4. Además
   `readCliModelCatalogs` lee el `HOME` **real** (`~/.claude/stats-cache.json`) dentro del test: en este Mac hay ids
   y valida; en CI no hay → no valida. El test depende del host (regla CLAUDE.md 2026-08-01). Arreglo: el test es
   hermético (`HOME` = el tmpdir de `runIsolated`, con los ids que necesite escritos ahí) y manda un id real del CLI
   (`claude-sonnet-5`); las aserciones de costo no cambian. Revisar si otros tests que postean a `/api/chat` con
   sesión CLI dependen del `HOME` real (grep `runIsolated` + `agent: 'claude'|'codex'|'opencode'`) y hacerlos
   herméticos también.
3. Gates tuyos: `build:app`, `ui:fidelity:jsx`, `bunx tsc --noEmit`, `bunx biome check . --diagnostic-level=error`,
   `bun test` completo. Sin commits, sin stash, sin tocar PLAN.md/NEXT.md ni el puerto 4242. No invoques codex exec ni
   delegues a otro agente. El gate en navegador y `test:coverage` los corre el cerebro.

### Ronda 11c — gate del cerebro sobre 11b (2026-09-22, :4242, navegador real)

Verde: `test:coverage` 1499/0, biome, typecheck, `build:app`, `ui:fidelity:jsx` + `check-css` (53). Turno real
Dev → Codex · GPT-5.6-Luna · medium: POST con `"model":"gpt-5.6-luna","effort":"medium"`, run `done`,
`runs.model = gpt-5.6-luna via Codex CLI (effort: medium)`. Colores de barras y heatmap por DOM (`/tmp/ui14-gate7.mjs`).
UI.13.6 commiteado aparte (`2b3a185`). **Fallas** (`/tmp/ui14-gate8.mjs`, Dev → proyecto orchestos → sesión):

1. **`/rename <título>`** guarda en la DB (`chat_sessions.title` cambió) pero la barra lateral y la cabecera
   siguen con el título viejo hasta recargar. Tras `renameSession`, actualizar el estado del front (threads /
   proyectos / historial) igual que después de crear una sesión. Test si hay dónde.
2. **`/model`** está en el menú `/` pero `handleSlashCommand` (`App.tsx:467`) no lo maneja: no pasa nada. Debe
   abrir el dropdown modelo·esfuerzo del composer (estado local del composer; resolverlo dentro de `AgentComposer`
   sin subir a App si es más simple).
3. **Heatmap de Usage recortado:** la tarjeta mide ~720 px y el grid llega a x≈1025 → septiembre (mes actual, el
   último cuadro "6 runs on Sep 22, 2026") queda fuera de la vista; la fila de meses termina en "Aug". Debe verse
   siempre el día de hoy: grid que entra en el ancho (celdas que escalan o menos semanas) o scroll inicial al final.
   Medirlo con `getBoundingClientRect` del último cuadro contra el de la tarjeta.
4. Gates tuyos: `build:app`, `ui:fidelity:jsx`, `bunx tsc --noEmit`, `bunx biome check . --diagnostic-level=error`,
   `bun test` completo. Sin commits, sin stash, sin tocar PLAN.md/NEXT.md ni el puerto 4242. No invoques codex exec ni
   delegues a otro agente.

### Ronda 11d — gate del cerebro sobre 11c (2026-09-22, :4242)

Verde: suite 1499/0, biome, typecheck, build, fidelidad; `/model` abre el dropdown; heatmap: último cuadro
"Sep 22, 2026" en x 972–983 dentro de la tarjeta (297–983). **Falla:** `/rename Gate r11c bis` guarda en DB
(`chat_sessions.title`), pero 1,5 s después la barra lateral y la cabecera siguen en "Gate r10" (captura
`/tmp/g8-rename.png`). Causa: `handleSlashCommand` (`App.tsx:470`) actualiza `threads` e `historySessions`, pero la
lista de Dev y la cabecera salen de `projects[].agents` (`api/projects.ts`, `listProjects`). Arreglo: tras renombrar,
refrescar `projects` igual que `handleCreateAgentInProject` (`setProjects(await listProjects())`). Mismo chequeo para
`/archive` y para el título mecánico del primer mensaje (`firstMessageTitle`, `App.tsx:524`): si solo tocan
`threads`, refrescar `projects` también. Gates: build, fidelidad, tsc, biome, `bun test`. Sin commits, stash, ni
tocar PLAN.md/NEXT.md/4242; no invoques codex exec ni delegues.
