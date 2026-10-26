# SET — Settings de OrchestOS al nivel de los ADEs (referencia + traspaso a Claude Desktop)

Pedido de Carlos (2026-10-26): no se quitan secciones; se pule la falla visual y de conexión de Settings. Patrón de
T3 Code, Monocode y Orca: iconos, look, la interfaz explica sola, **sin texto sobre texto**. Detección de CLIs como
ellos ("API & Models" no tiene sentido para un usuario de CLIs). La parte visual se hace en Claude Desktop mirando las
apps reales (`/Applications/Orca.app`, `T3 Code (Beta).app`, `MonoCode.app`), no leyendo código.

Fuente de lo de abajo: lectura de código (clones en `/tmp/ade-ref/{t3code,monocode,orca}`, no se ejecutó nada). Es
"qué hay"; cómo se ve hay que confirmarlo abriendo las apps.

## OrchestOS hoy (`src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`, 3.2k líneas)
Secciones: General (Appearance: Canvas/Surface/Accent) · Health · API & Models · Model routing · Executor (+ CLIs
propios, AT.11.3) · Usage · Danger zone · Language. Proyecto: Tasks, Runs, Graph, Memory, Specs, Skills, Instincts, Plan.
Diferencias con los tres ADEs:
- Barra "N unsaved changes · Save" — los tres guardan al instante.
- 10 páginas con descripción larga bajo el título (texto sobre texto).
- Sin buscador que salte a la fila (hay buscador; verificar si resalta la fila).
- Sin Keybindings. Appearance mínimo y metido en General.
- CLIs: no hay vista "Providers/Agents" con estado por CLI (instalado, versión, sesión, modelos); la detección
  (`cli-registry.ts` `detectInstalledClis`) solo mira PATH y se reparte entre Model routing y Executor.

## Patrón común de los tres
- Nav lateral con grupos + buscador arriba que salta a la fila y la resalta.
- Página = tarjetas que agrupan filas; fila = etiqueta (+ descripción corta opcional) a la izquierda, control a la
  derecha. Controles: toggle, select, segmented, slider, grabador de atajos.
- Guardado instantáneo. Reset por fila: T3 en todo; Monocode/Orca solo en atajos.
- Secciones en los tres: **General, Appearance, Keybindings/Shortcuts, Providers/Agents**. Casi todos: Git/Source
  control, Connections, Chat, Archive.
- Grupos de nav: Monocode `App / Agents / Workspace`; Orca 8 grupos (`AI Capabilities, Set Up, Workflows, Interface…`).
- Título de página: T3 sin título+descripción (breadcrumb + scope); Monocode y Orca título + 1 línea.

## Detección de CLIs (cómo lo hacen)
| | T3 Code | Monocode | Orca |
|---|---|---|---|
| Catálogo | `apps/server/src/provider/builtInDrivers.ts:29`; snapshot `ServerProvider` (`packages/contracts/src/server.ts:205`) con `installed, version, status, auth{status,email}, models[]` | por `HarnessId` (`src/features/sessions/model/session.ts:18`) + `availability.ts:38` (nombre CLI, cómo instalar) | `AgentCatalogEntry` (`renderer/src/lib/agent-catalog.tsx:19`) + `TuiAgentConfig` (`shared/tui-agent-config-types.ts:24`), 30+ agentes |
| Instalado | PATH propio + PATH del login shell (`packages/shared/src/shell.ts:596`, `:290`) | login shell `$SHELL -lic printenv` + rutas conocidas (`~/.local/bin`, `~/.bun/bin`, `/opt/homebrew/bin`…) `src-tauri/src/harness.rs:2789` | PATH + dirs de instalación (`shared/system-cli-install-dirs.ts:8`) + login shell `-ilc` |
| Versión | `claude --version`; Codex vía `app-server` | `--version` al inspeccionar | no por agente |
| Sesión/auth | Codex RPC `account/read`; Claude init del SDK sin prompt → email; si falta: "Run `codex login`" | lee `~/.claude.json` (`oauthAccount`) y `$CODEX_HOME/auth.json` (`account_identity.rs:22`) | cuentas aparte (`claude auth login`, `codex login`) |
| Modelos | en vivo (Codex `model/list`), manifiesto (Claude), + modelos propios | fijos + en vivo por CLI (`opencode models`, `cursor --list-models`) | semilla + `listModels` |
| CLI propio | sí (ACP: comando local o registry) | no (solo override de ruta) | no (override cmd/args/env) |
| Refresco | al arrancar + cada 5 min + botón | al arrancar / abrir Settings (TTL 30 s) + reintentar | bajo demanda + botón Refresh |
| UI | tarjeta por CLI: toggle, versión, email, ruta, args, modelos, Instalar/Autenticar (`ProviderInstanceCard.tsx`) | fila: icono, "N modelos", modelo por defecto, "Show in picker", ruta+versión, cuentas "Sign in" (`SettingsView.tsx:3968`) | "Installed (N)" / "Available to install", toggle, default, link Install (`AgentDetectionCatalog.tsx`) |

Lo que OrchestOS ya tiene y encaja: registro de datos `KNOWN_CLIS` + `allClis()` (AT.11.2), CLIs propios (como el
ACP local de T3), cuotas por parseo. Falta: PATH del login shell + rutas conocidas (hoy un CLI en `~/.bun/bin` puede no
verse si el dashboard arranca sin ese PATH), versión, sesión/email leídos de disco (gratis, 0 tokens), modelos por CLI,
y una vista Providers que lo muestre con iconos.

## Traspaso a Claude Desktop — prompt para pegar

> Proyecto `~/Projects/projects/orchestos`. Lee `CLAUDE.md`, `NEXT.md` y `docs/specs/SET-ref.md` (no releas los repos
> de referencia: ya está resumido ahí). Tarea: diseñar con Carlos el pulido de Settings de OrchestOS, sin quitar
> secciones.
> 1. Abre lado a lado Settings de Orca, T3 Code (Beta) y MonoCode (apps instaladas) y el de OrchestOS
>    (`ORCHESTOS_HOME=<tmp con copia de la DB> PORT=4343 bun src/dashboard/server.ts`, ver `NEXT.md` § Trampas). Captura
>    General, Appearance, Keybindings y Providers/Agents de cada uno.
> 2. Lista, con captura, lo que en OrchestOS está desconectado (control que no guarda, dato que no se refleja, sección
>    vacía) y todo texto que repite lo que la interfaz ya dice.
> 3. Propón (en mockup o capturas anotadas, no en prosa): nav agrupada con iconos, guardado instantáneo, página
>    Providers con una fila por CLI detectado (icono, versión, sesión/email, modelos, modelo por defecto) + CLIs propios,
>    Appearance propia, Keybindings, y dónde van API keys y Model routing. Una sola ronda de preguntas a Carlos, con
>    recomendación.
> 4. Con el GO, escribe los ítems `SET.1…` en `PLAN.md` y un spec por ítem (`docs/specs/SET.N.md`); la implementación
>    sigue el ciclo normal (delegate + gates + `ui:gate` en vivo). Reglas de UI vigentes: `MEMORY.md` (prototipo es la
>    esencia; texto que no aporta desaparece; React+Tailwind+shadcn; no sumar CSS).
