# Protocolo universal de trabajo para agentes

Este archivo es la fuente común para Claude, Codex, DeepSeek, OpenCode y cualquier otro LLM o CLI
que trabaje en OrchestOS. `AGENTS.md` y `CLAUDE.md` pueden añadir reglas del host, pero no cambiar
este orden ni relajar sus gates.

## Principio

Una regla escrita no es enforcement. Hay tres niveles y deben reportarse sin confundirlos:

1. **Mecánico**: un script, hook, test o política bloquea la operación.
2. **Verificado**: existe evidencia reproducible, pero el agente debe ejecutar el gate.
3. **Narrativo**: guía de conducta; no debe presentarse como garantía automática.

Si un gate requerido no puede ejecutarse, el trabajo queda abierto o bloqueado. Nunca se declara
terminado basándose solo en revisión visual del código, mocks o la afirmación de otro agente.

## Orden obligatorio

1. Leer `AGENTS.md`, `CLAUDE.md`, este protocolo y la sección activa de `PLAN.md`. Si existe
   `.orchestos/handoff.md`, leerlo primero — es el clock-out de la sesión anterior (H.4.2, PLAN.md
   § Bloque H): apunta a un ítem que quedó a medias y a cambios sin commitear, sin duplicar lo que
   ya está en `PLAN.md`/`LEDGER.md`/commits.
2. Ejecutar `bun run agent:preflight -- --item <ID> --agent <nombre>` antes de editar.
3. Revisar `git status` y `git log`: los cambios existentes pertenecen a otra sesión hasta demostrar
   lo contrario. No modificarlos, revertirlos ni incluirlos en el commit.
4. Confirmar que el ítem está abierto, autorizado para el agente y sin prerequisitos abiertos. Un
   pedido explícito de Carlos puede cambiar la asignación, pero no elimina los gates.
5. Si el cambio cruza módulos/capas o redefine comportamiento central, documentar alcance, pasos,
   validación y exclusiones antes de editar (`INS-2026-005`). Cuando el alcance se pueda anticipar
   como un glob (no una lista exacta — la mayoría de ítems 🧠 no lo permite), declararlo con
   `agent:preflight -- --item <ID> --scope "<globs separados por coma>"` (H.4.1, PLAN.md § Bloque
   H): el pre-commit exige entonces una línea `**Fuera de scope declarado:**` en `PLAN.md` para
   cualquier path staged fuera del glob — no bloquea trabajo transversal legítimo, exige que quede
   documentado en el mismo commit. Es opt-in: sin declaración, el gate no aplica.
6. Ejecutar baseline: `bunx tsc --noEmit` y la suite relevante. Si falla por trabajo ajeno, parar y
   reportar el archivo/error; no absorber el refactor sin autorización.
7. Implementar solo el ítem elegido. Hallazgos adyacentes se documentan; no se corrigen en caliente.
8. Ejecutar los gates de la matriz siguiente.
9. Añadir en `PLAN.md` evidencia concreta y comandos/resultados. Solo entonces marcar `[x]`.
10. Commit por ítem sin `--no-verify`. Tras 2–3 commits locales, push normal autorizado.
11. Si la sesión termina (por cualquier motivo) con un ítem sin cerrar o cambios sin commitear,
    correr `bun run agent:handoff` antes de parar — escribe `.orchestos/handoff.md` para que la
    próxima sesión, de cualquier CLI, sepa dónde retomar. No es un gate mecánico: no existe un
    evento "fin de sesión" uniforme entre Claude/Codex/DeepSeek/OpenCode para bloquear sobre él
    (investigado antes de diseñar, PLAN.md § H.4.2) — es responsabilidad narrativa de quien cierra
    la sesión, igual que el resto de este paso 11 hasta que exista un trigger mecánico real.

Cuando un gate en vivo ejecute el harness con `ORCHESTOS_HOME` temporal, el paso 8 debe usar
`bun run gate:evidence -- --label <gate-id> -- <comando> [args...]`. El wrapper exporta los runs
reales a la DB durable antes del cleanup. Crear/borrar el temporal manualmente deja la medición
incompleta y no satisface el gate de evidencia, aunque el comando haya terminado verde.

## Matriz mínima de cierre

| Cambio | Gates requeridos |
|---|---|
| Documentación/reglas | revisión de contradicciones, preflight y diff acotado |
| TypeScript/backend | typecheck + tests relevantes + `bun run test:coverage` antes del push |
| Seguridad/límite de confianza | tests relevantes + `bun run security:gate`; declarar qué puede y no puede hacer cada tool |
| Dashboard/UI | tests relevantes + dashboard real + navegador real; probar acción, endpoint, persistencia y estado visible |
| Configuración | PUT/lectura efectiva + reinicio/recarga + consumidor real; no basta comprobar que el YAML cambió |
| Regla crítica ya regresionada | gate determinista existente y mutation testing acotado cuando la suite esté estable (`INS-2026-004`) |

Para dashboard o configuración, el pre-commit exige que el mismo commit cierre un ítem de `PLAN.md`
y añada una línea `Gate en vivo:` que mencione navegador, browser o Playwright. El hook comprueba la
presencia de la evidencia, no su veracidad: ejecutar y observar el flujo sigue siendo una obligación
verificada, no una garantía mecánica.

## Condiciones de parada

El agente debe parar sin declarar éxito cuando ocurra cualquiera de estas condiciones:

- no existe un ítem abierto o el scope es ambiguo;
- hay cambios ajenos que se solapan;
- falla baseline, test, hook o gate requerido;
- una UI/config no se pudo probar en el sistema real;
- una acción destructiva no tiene confirmación explícita;
- la evidencia proviene únicamente del mismo agente que implementó y el ítem exige revisión 🔍.

La salida correcta es describir el bloqueo y conservar el trabajo recuperable. Nunca usar
`--no-verify`, relajar tests, inventar evidencia o marcar `[x]` para silenciar el proceso.
