# Recetas y trampas — referencia (no se carga al arrancar)

Reglas puntuales restauradas en DOC.8 desde `docs/done/poda-instrucciones-2026-11-03.md`. Se consultan cuando el
trabajo toca el tema; las reglas generales viven en `AGENTS.md`.

## Delegación y ejecutores

- Una corrida de un ejecutor puede colgarse horas (Luna >12 h): vigilarla con un Monitor de 20 min y matarla por PID.
- Cambios sin commitear de una ronda previa: nombrarlos en el spec y correr `bun run agent:handoff` antes de
  redelegar (un `.orchestos/handoff.md` viejo detiene a `mecanico`).
- El spec abre con `Ítem: **<ID>**` y dice que los cambios en vuelo del mismo ítem no son ajenos.
- Antes de delegar, mirar los agentes activos (máximo dos). En Codex, `fork_turns: "none"` o el menor entero que
  alcance; `"all"` solo con necesidad explícita escrita en el spec.
- Antes de proponer cambiar de motor o subir de modelo: revisar los cinco subsistemas del harness (spec, contexto,
  herramientas, sandbox, verificación); casi siempre el fallo está ahí.

## Tests y gates

- Un test que llega al QA fija `OPENROUTER_API_KEY` en su env; no depende del `.env` del host.
- `bunx tsc` en un repo sin TypeScript instala paquetes: no correrlo ahí; si se corrió, revisar lockfile y
  `git status`.
- Una desaparición asíncrona (fila, proceso, archivo) se sondea hasta un plazo; una sola consulta no prueba nada.
- Los gates de chat leen el texto final de la respuesta de `POST /api/chat`, además del DOM.
- Selectores de un flujo acotados al componente: el dashboard real tiene datos de Carlos que colisionan con textos
  genéricos.
- `qa-negative` que falla porque el modelo no cumplió la premisa: reintentar una vez antes de diagnosticar.
- Para probar Codex sin proyecto: flujos `chat-notices` o `chat-timeout`; `codex-live` usa proyecto.
- Mutación: excluir los tests co-localizados; dividir shards por archivos completos o entre métodos, nunca a mitad de
  uno (se pierden mutantes).
- `bun audit fix` no existe: las vulnerabilidades se resuelven con `overrides` en `package.json`.
- Dashboard aislado sin tocar el de Carlos: `ORCHESTOS_HOME=<tmp>` con `sqlite3 .backup` en
  `<tmp>/.orchestos/db.sqlite` (en `<tmp>/db.sqlite` sale "no such table: projects") + `PORT=4343 bun
  src/dashboard/server.ts` + Playwright `channel: 'chrome'` (revalidar si el chromium de Playwright ya está).

## Front

- `border-app/NN` no acepta variante de opacidad: usar el valor arbitrario (`border-[color-mix(...)]`).
- Antes de afirmar que algo no existe en la UI, buscar su handler en todas las pestañas, no solo en la vista abierta.

## Código y repo

- Identidad o clasificación de un comando de Codex: mirar el comando completo, nunca solo `commandActions`.
- Tras borrar un símbolo, revisar los comentarios que lo nombraban: quedan falsos.
- Commits retrofechados: fijar `GIT_AUTHOR_DATE` y `GIT_COMMITTER_DATE`, mantener el orden cronológico y `--amend`
  solo sobre lo no empujado.
- Limpieza de artefactos versionados (H.1.4): verificar referencias y retirarlos del índice (`git rm --cached`), no del
  disco.
- Specs de recorte o de estados: nombrar los estados intermedios rechazados y el algoritmo completo, incluido el caso
  sin saltos.
