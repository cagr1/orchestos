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
