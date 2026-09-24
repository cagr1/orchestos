# CI.2 — ui-gates exigibles

Diagnóstico histórico en PLAN.md § CI.2. Parte está superado: los 13 scripts de `scripts/ui-gates/` se
borraron en UI.13.3 (ff090e3); `CI.2.A` (despodrir esos 13) queda sin objeto. Hoy los gates son los
flujos de `scripts/ui-gate/flows/` que corre `bun run ui:gate <flujo…>` (CI.2.B), y la propiedad 1
(llegar clickeando) ya la hace cumplir `lintFlowSource` (`scripts/ui-gate/lib.mjs:1`).

## Medición (2026-09-24, cerebro, fuera del sandbox, en serie)
| flujo | turno real Codex | s |
|---|---|---|
| smoke | no | 24 |
| plan-doc | no | 13 |
| project-delete | no | 9 (FAIL intermitente: `HTTP 404 /api/tasks` en consola; 2.ª corrida 11/11) |
| usage-bar | sí | 42 |
| text-sweep | sí | 24 |
| chat-turn-details | sí | 67 |
| tasks | sí | 34 |
| runs-graph | sí | 28 (1.ª corrida: FAIL "Run Next Task enabled" tras 940 s; 2.ª 16/16) |
| project-tabs | sí | 44 |
Total ≈ 285 s (~5 min). Sin turno real: ≈ 46 s.

## Decisión (del cerebro, con el número)
- 7 de 9 hacen un turno real con Codex: en GitHub Actions no hay sesión de Codex, así que **no pueden ir a CI**.
- **Workflow aparte** `.github/workflows/ui-gate.yml` (no el job de `ci.yml`): push/PR a master, bun +
  `bunx playwright install --with-deps chromium` + `db:migrate` + `bun run ui:gate smoke plan-doc project-delete`.
  Sube `result.json` como artifact.
- **pre-push condicional** para los 9: si el rango que se empuja toca `src/dashboard/**`, `scripts/ui-gate/**`
  o `src/run/**`, corre `bun run ui:gate` con los 9 flujos en serie (~5 min); si no, lo salta con una línea que lo dice.
  Así no suma 5 min a cada push (el veredicto del 2026-09-18 sigue en pie) y ningún cambio de UI llega a
  origin sin ellos.
- Orden obligado: **primero verdes, después exigibles**. Los dos intermitentes se arreglan en este ítem.

## Cambios
1. **Aislamiento del dashboard del gate.** `scripts/ui-gate/run.mjs:242` levanta el dashboard con el `env` real:
   los flujos escriben proyectos y sesiones en `~/.orchestos`. Pasar `ORCHESTOS_HOME=<runDir>/home` (con lo
   que el dashboard necesite para arrancar, p. ej. migraciones) y **verificarlo en el propio runner**: abortar
   si la DB que abre el dashboard no cae dentro de `runDir`. Las credenciales de Codex (`~/.codex`) no se
   tocan: los turnos reales tienen que seguir funcionando.
2. **`project-delete` intermitente.** Tras borrar el proyecto, algo sigue pidiendo `/api/tasks` del proyecto
   borrado y sale `HTTP 404` en consola. Reproducir (correr el flujo en bucle hasta verlo) y arreglar la causa
   en el producto (petición en vuelo del proyecto borrado), no silenciar el paso del flujo.
3. **`runs-graph` intermitente.** "Run Next Task" quedó deshabilitado y la corrida duró 940 s. Reproducir,
   encontrar por qué no estaba habilitado (¿carrera con la carga de tasks tras registrar el proyecto?) y por qué
   el flujo tardó 15 min en vez de fallar rápido; arreglar ambas cosas.
4. **Workflow** `ui-gate.yml` como arriba.
5. **pre-push** (`scripts/pre-push.sh`, después de lint): paso condicional como arriba. Recordar que el hook
   instalado se sincroniza con `bun run hooks:install`.
6. PLAN.md § CI.2 no se toca (lo cierra el cerebro).

## Fuera de esta pasada
Inventario de afordancias (propiedad 2 de PLAN.md § CI.2): va como ítem propio si Carlos lo quiere.

## Gate (lo que el cerebro va a medir)
- Cada uno de los 9 flujos: 3 corridas seguidas en verde (`project-delete` y `runs-graph` incluidos).
- `~/.orchestos/db.sqlite`: mismos conteos de `projects`/`chat_sessions` antes y después de los 9 flujos.
- `ui-gate.yml` verde en GitHub Actions tras el push.
- pre-push: salta con un push sin UI; corre los 9 con uno que toca `src/dashboard/**`.
- `bun run gate:all` verde; `git status --porcelain` sin residuos.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. No re-ejecutes `agent:preflight`. El dashboard real corre en :4242: no lo
mates. `bun run typecheck` completo; `bunx biome check . --diagnostic-level=error` = 0. Lista TODOS los archivos
que toques. Si algo falla por el sandbox (EADDRINUSE, EPERM, red), dilo así. No hagas commit ni push.
