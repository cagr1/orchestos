# Cerrados de ONB

- [x] **ONB.1 — El primer arranque usa una CLI instalada, no OpenRouter.** (abierto 2026-11-04, GO de Carlos) Clon
  limpio: `setup` exigía `OPENROUTER_API_KEY`, el chat nacía en `api` con `typesafe/jev-router` (precio -1 ordenado
  primero) rotulado "ChatGPT" y el primer mensaje fallaba.
  Texto visible: mensaje de error sin CLI ni clave (dice qué instalar; un ícono no lo explica) y la etiqueta
  "OpenRouter" (reemplaza "ChatGPT", que era falsa).
  Hecho: `default-chat-agent.ts` (config → primera CLI instalada, con chat y funcional en orden del registro →
  `api` con clave → nada); sesiones, `GET /api/chat/default-agent`, composer sin hilo y `setup` lo usan; catálogo
  sin precios negativos; clave de OpenRouter opcional. Gates del cerebro: tsc, lint, `test:coverage` 2264/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.1-live.json` (`ORCHESTOS_HOME` vacío → "Message Claude…",
  primer mensaje respondido por la CLI en 2,4 s, sin error). Sin probar en vivo: el caso sin ninguna CLI (tests).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio r1)

- [x] **ONB.2 — Model routing propone la CLI detectada para los roles vacíos.** (abierto 2026-11-04, GO de Carlos,
  opción 1) Clon limpio: los cuatro roles nacen sin asignar y la primera tarea falla con "Rol 'executor' sin asignar";
  el error no lleva a Settings. Detectar no es decidir: se propone, Carlos confirma con un clic y guarda.
  Texto visible: "Use <CLI> for unassigned roles" y "Model routing" junto al error de tarea; un ícono no dice
  qué CLI se detectó ni adónde lleva. El mensaje del rol sin asignar pasa al inglés, como el resto de la UI.
  Hecho: `routing-roles.ts` (filtros y modelo compartidos entre selector y botón); la sugerencia sale de
  `/api/chat/default-agent`; correr una tarea sin rol devuelve `code: 'role_unassigned'` y el error muestra el botón
  "Model routing"; `createSession` sin agente deja que el servidor lo resuelva (hermanos de ONB.1). r1: nombre visible
  "Claude" (como el selector) y botón compacto. Gates del cerebro: tsc, lint, `test:coverage` 2275/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.2-live.json`; `ui:gate model-routing` 24/24
  repetido por el cerebro (error 400 `role_unassigned` → botón → Model routing; "Use Claude for unassigned roles" →
  guardar → los 4 roles en `claude`/`claude-opus-5-5`; el botón desaparece). Captura mirada a ojo.
  Anotado: con una sola CLI el Reviewer queda igual que el Executor (la UI ya avisa "errors may correlate").
  Revisión: Opus (diff de Sol leído completo; r1 de Luna verificado en la captura).
  Ejecutado por: codex gpt-6.1-sol (criterio) + luna (mecanico r1)
