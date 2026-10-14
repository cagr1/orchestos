# Protocolo universal de trabajo para agentes

Fuente común para Claude, Codex, DeepSeek, OpenCode y cualquier otro LLM/CLI. `AGENTS.md` y
`CLAUDE.md` añaden reglas del host; no cambian este orden ni relajan sus gates. Lo que ya está dicho
allí se enlaza, no se repite.

## Principio

Una regla escrita no es enforcement. Reportar sin confundir los tres niveles:
**mecánico** (script/hook/test bloquea), **verificado** (hay evidencia reproducible pero el agente
corre el gate), **narrativo** (guía de conducta, no garantía). Si un gate requerido no puede
ejecutarse, el trabajo queda abierto o bloqueado; nunca se declara terminado por revisión visual,
mocks o la afirmación de otro agente.

## Orden obligatorio

1. Leer `AGENTS.md`, `CLAUDE.md`, este protocolo y la sección activa de `PLAN.md`; si existe
   `.orchestos/handoff.md`, leerlo primero (apunta a un ítem a medias y cambios sin commitear).
2. `bun run agent:preflight -- --item <ID> --agent <nombre>` antes de editar.
3. `git status` y `git log`: los cambios existentes son de otra sesión hasta demostrar lo contrario;
   no modificarlos, revertirlos ni incluirlos en el commit.
4. Confirmar ítem abierto, autorizado para el agente y sin prerequisitos abiertos. Un pedido explícito
   de Carlos puede cambiar la asignación, no elimina los gates.
5. Si cruza módulos/capas o redefine comportamiento central: documentar alcance, pasos, validación y
   exclusiones antes de editar (`INS-2026-005`). Si el alcance es un glob, declararlo con
   `agent:preflight -- --item <ID> --scope "<globs,…>"`; el pre-commit exige entonces
   `**Fuera de scope declarado:**` en `PLAN.md` para todo path staged fuera del glob. Opt-in.
6. Baseline: `bunx tsc --noEmit` y la suite relevante. Si falla por trabajo ajeno, parar y reportar
   archivo/error; no absorber el refactor sin autorización.
7. Implementar solo el ítem elegido (scope-lock: `AGENTS.md` § Trabajo en equipo). Un hallazgo que
   daña el sistema se corrige antes del siguiente ítem sin preguntar; el resto va al reporte del lote.
8. Ejecutar los gates de la matriz. Con `ORCHESTOS_HOME` temporal, `bun run gate:evidence`
   (`AGENTS.md` § Evidencia de gates reales); crear/borrar el temporal a mano no satisface el gate.
9. Evidencia concreta (comandos/resultados) en el archivo de `docs/done/` del bloque y solo entonces
   `[x]` en `PLAN.md` (`AGENTS.md` § Reglas generales).
10. Commit por ítem, sin `--no-verify`; push según `AGENTS.md` § Reglas generales.
11. Si la sesión termina con un ítem sin cerrar o cambios sin commitear: `bun run agent:handoff`
    antes de parar. Es narrativo: no hay un evento "fin de sesión" uniforme entre CLIs para
    bloquearlo (PLAN.md § H.4.2).

## Matriz mínima de cierre

| Cambio | Gates requeridos |
|---|---|
| Documentación/reglas | revisión de contradicciones, preflight y diff acotado |
| TypeScript/backend | typecheck + tests relevantes + `bun run test:coverage` antes del push |
| Seguridad/límite de confianza | tests relevantes + `bun run security:gate`; declarar qué puede y no puede hacer cada tool |
| Dashboard/UI | tests relevantes + dashboard real + navegador real; acción, endpoint, persistencia y estado visible |
| Configuración | PUT/lectura efectiva + reinicio/recarga + consumidor real; no basta que el YAML cambie |
| Regla crítica ya regresionada | gate determinista existente y mutation testing acotado cuando la suite esté estable (`INS-2026-004`) |

Dashboard/configuración: el pre-commit exige que el mismo commit cierre un ítem de `PLAN.md` y añada
una línea `Gate en vivo:` que mencione navegador, browser o Playwright. Comprueba la presencia de la
evidencia, no su veracidad: ejecutar y observar el flujo es obligación verificada, no mecánica.

## Condiciones de parada

Parar sin declarar éxito si: no hay ítem abierto o el scope es ambiguo; hay cambios ajenos que se
solapan; falla baseline, test, hook o gate requerido; una UI/config no se probó en el sistema real;
una acción destructiva no tiene confirmación explícita; la evidencia viene solo del agente que
implementó y el ítem exige revisión 🔍.

Parar significa **no cerrar ese ítem**, no devolver el turno a Carlos: un test, hook o gate rojo se
diagnostica y corrige en el mismo lote. Se vuelve a Carlos solo por el mismo fallo tras 2 intentos con
diagnóstico distinto, una decisión de producto no prevista, una acción destructiva o el fin del lote;
entonces se describe el bloqueo y se conserva el trabajo recuperable. Nunca `--no-verify`, relajar
tests, inventar evidencia ni marcar `[x]` para silenciar el proceso.
