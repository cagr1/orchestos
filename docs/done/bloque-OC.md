## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-oc-oc-1"></a>
- [x] **OC.1 — ⚡ El modelo por defecto de OpenCode es `opencode/deepseek-v4.1-flash-free`.**
  (2026-10-20, Carlos: "4.1-flash-free o algún LLM free por default, de preferencia DeepSeek".) `opencode.json` apuntaba a
  `opencode/deepseek-v4-flash-free`, retirado (`ProviderModelNotFoundError`, hallado en H.7.2c): OpenCode no arrancaba con
  la config del repo. Gate: `opencode run` sin `-m` en este repo responde con `deepseek-v4.1-flash-free`.
  **Cerrado 2026-10-20.** `opencode.json`: `model` y la clave de `provider.opencode.models` pasan a
  `deepseek-v4.1-flash-free` y `reasoningEffort` baja de `high` a `medium` (Carlos, 2026-10-20: "el reasoning siempre en medium por default" para DeepSeek). Catálogo: costo 0, ventana 200 000. Gate del cerebro:
  `opencode run "Responde solo: ok"` sin `-m` → `build · deepseek-v4.1-flash-free`, `ok`; sesión de prueba borrada.
  Ejecutado por: mecanico · Spec: docs/specs/OC.1.md

- [x] **OC.1 — La terminal de Dev lanza OpenCode con `--standalone`.** (abierto 2026-11-03, GO de Carlos al plan
  OC.1–OC.4) Con OpenCode 2.2.5 y el servicio compartido desincronizado, la TUI sale a los ~20 s.
  Hecho: `resolveOpenCodeCommand` devuelve `[binary, '--standalone']` (servidor privado por pestaña).
  Gates del cerebro: tsc, tests 36/0, `ui:gate opencode-terminal` 13/13 con el servicio compartido aún roto.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus

- [x] **OC.2 — El catálogo de OpenCode usa `api --standalone model.list`.** (abierto 2026-11-03) 2.2.5 quitó
  `models --verbose`; catálogo vacío y `model-routing` rojo bloquean el push.
  Hecho: `parseOpencodeModels` lee `data[]` (`providerID/id`, esfuerzos = `variants[].id`); sale la llamada a
  `run --help`. En vivo (Sol): `/api/models/catalog` 361 modelos, 230 con esfuerzos y 131 sin.
  Gates del cerebro: tsc, tests 36/0, `ui:gate model-routing` 19/19.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · revisión Opus

- [x] **OC.2.1 — `opencode-engine.test.ts` simula el catálogo con el formato viejo.** (abierto 2026-11-03, regresión
  de OC.2 vista en el pre-push; el cerebro corrió 3 archivos en vez de `test:coverage`)
  Hecho: el mock responde a `model.list` con el JSON nuevo. Gate del cerebro: `test:coverage` 2240/0.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus

- [x] **OC.3 — El ejecutor `opencode run` usa `--standalone` y `--model prov/modelo#variante`.** (abierto 2026-11-03)
  2.2.5 quitó `--variant`; sin `--standalone` depende del servicio. Hecho: tarea, display y chat pasan `--standalone` y
  `--model <modelo>#<variante>`; parser intacto (`part.type` sigue `step-finish`). Gates del cerebro: tsc, lint,
  `test:coverage` 2243/0. Gate en vivo: inferencia real con los args del chat, `docs/done/evidence/OC.3-live.json`.
  Revisión: Opus.
  Ejecutado por: codex gpt-6-luna (mecanico r1)

- [x] **OC.4 — El adaptador HTTP de aprobaciones migra a la API v2 de OpenCode.** (abierto 2026-11-03) Cambiaron
  banner, `/api/session`, prompt, modelo y permisos (`src/run/executors/opencode-server.ts`). Hecho: rutas `/api`,
  envoltura `data`, reglas `{action,resource,effect}`, variante dentro de `model`, `decision` once/reject (nunca always),
  `session/active`, mensajes paginados y traducidos al NDJSON de siempre; permisos v2 en `opencode-approval.ts`.
  r1: el test del motor seguía simulando la API v1. Gates del cerebro: tsc, lint, `test:coverage` 2250/0.
  Gate en vivo: `opencode serve` real, edición aprobada crea el archivo con costo y tokens; shell rechazado falla la
  tarea; sin servidores huérfanos (`docs/done/evidence/OC.4-live.json`).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico r1)
