# Baseline universal de ingeniería

Última verificación: 2026-07-29  
Alcance: orden mínimo de trabajo aplicable a cualquier proyecto, disciplina y lenguaje.

## Propósito y supuestos

Esta guía define qué averiguar y en qué orden antes de modificar código, y qué evidencia reunir
antes de cerrar una tarea. No reemplaza la guía de una disciplina, el perfil de un lenguaje ni las
instrucciones específicas del proyecto. Tampoco prescribe una herramienta concreta: cada comando
debe salir de la configuración real del repositorio.

La regla central es fail-closed:

- `verified` exige ejecutar el comando exacto en el proyecto y citar su salida real.
- `detected` significa que un archivo o configuración lo sugiere, pero aún no se ejecutó.
- `known` es conocimiento general, no evidencia del proyecto.
- `missing` significa que se buscó y no existe.
- `not-applicable` requiere una decisión explícita y su motivo.

Un estado no se puede convertir en `verified` por intuición ni por una respuesta del LLM. Si una
etapa obligatoria está `missing`, el resultado correcto es `blocked` o `missing`, nunca `pass`.

## Orden de trabajo

Cada etapa debe quedar en `verified` o `not-applicable` antes de avanzar a las etapas que dependen
de ella. Las etapas y sus salidas mínimas son:

| # | Etapa | Qué confirmar | Evidencia mínima |
|---|---|---|---|
| 1 | Entorno | runtime, lenguaje, versiones y package manager | comandos de versión ejecutados |
| 2 | Estructura | entrypoints, módulos, datos y límites de confianza | mapa basado en archivos reales |
| 3 | Dependencias | manifiesto, lockfile e instalación reproducible | archivo fuente + instalación/check |
| 4 | Build | cómo compila, empaqueta o arranca | comando de build ejecutado |
| 5 | Formato/lint | herramienta configurada y alcance | comando ejecutado, o `missing` |
| 6 | Tests unitarios | suite rápida y determinista | comando + resultado |
| 7 | Integración/E2E | flujos entre módulos o servicios | escenario real + resultado |
| 8 | Seguridad | secretos, dependencias, inputs y límites de confianza | auditoría y hallazgos |
| 9 | Observabilidad | logs, errores, métricas y trazabilidad | fallo controlado o inspección verificable |
| 10 | CI/CD | gates reproducibles y artefactos | pipeline/check local equivalente |
| 11 | Despliegue | proceso, configuración y migraciones | procedimiento o dry-run ejecutado |
| 12 | Rollback/recuperación | camino seguro ante release o migración rota | procedimiento probado o `not-applicable` justificado |

El orden no obliga a que todos los proyectos tengan las doce etapas. Sí obliga a declarar por qué
una etapa no aplica. Un proyecto puede empezar a medio camino: primero se detecta el estado actual,
se resuelven los prerequisitos faltantes y recién después se trabaja sobre la etapa objetivo.

## Auditoría inicial antes de tocar código

1. Entender el dominio, el objetivo de la tarea y los criterios de aceptación.
2. Leer las instrucciones del proyecto y localizar la fuente de verdad de tareas, configuración y
   estado.
3. Identificar entrypoints, datos persistidos, servicios externos y límites de confianza.
4. Detectar runtime, lenguaje, framework, package manager, lockfile, CI, deploy y base de datos.
5. Buscar comandos existentes en manifiestos, scripts, Makefiles, documentación y workflows.
6. Confirmar qué comandos pueden ejecutarse sin costo, red, escritura sensible o mutación externa.
7. Definir el scope, los archivos que pueden cambiar y la evidencia que cerrará la tarea.

No se debe instalar una herramienta, crear una configuración o elegir un workflow porque sea común
en otro ecosistema. Primero se detecta; luego se ejecuta; si no existe, se registra como `missing`.

## Matriz mínima de calidad

La siguiente matriz es un inventario de controles, no una lista de herramientas obligatorias. Cada
fila debe tener un estado explícito y, cuando sea `verified`, el comando literal y su salida.

| Control | Pregunta | Estado permitido |
|---|---|---|
| Typecheck/compile | ¿El código puede compilar o tiparse? | `verified`, `missing`, `not-applicable` |
| Unit | ¿Las unidades principales tienen pruebas deterministas? | `verified`, `missing`, `not-applicable` |
| Integration | ¿Los módulos colaboran correctamente? | `verified`, `missing`, `not-applicable` |
| E2E | ¿Existe un camino de usuario o sistema probado de extremo a extremo? | `verified`, `missing`, `not-applicable` |
| Coverage | ¿Se mide y existe un umbral vigente? | `verified`, `missing`, `not-applicable` |
| Mutation | ¿Mutation testing aporta señal para este cambio? | `verified`, `missing`, `not-applicable` |
| Seguridad | ¿Se revisan secretos, inputs, dependencias y permisos? | `verified`, `missing`, `not-applicable` |
| Performance | ¿Hay un riesgo de latencia, memoria, costo o volumen? | `verified`, `missing`, `not-applicable` |
| Observabilidad | ¿Un fallo deja evidencia accionable? | `verified`, `missing`, `not-applicable` |
| Documentación | ¿El contrato, operación o decisión quedó actualizada? | `verified`, `missing`, `not-applicable` |

`missing` no significa que el control haya fallado: significa que el proyecto no lo tiene. No se
debe convertir automáticamente en `pass`; el impacto se evalúa según la etapa y el riesgo de la
tarea. `not-applicable` siempre incluye una razón concreta.

## Evidencia reproducible

Para cada control o etapa verificada, registrar:

```text
Estado: verified
Comando: <comando exacto, incluyendo flags y entorno relevante>
Salida: <resultado resumido literalmente: exit code, tests, coverage, artefacto>
Fecha: <YYYY-MM-DD>
Alcance: <proyecto, fixture o directorio usado>
```

Si el comando no se pudo ejecutar por falta de herramienta, permisos, red, credenciales o entorno,
el estado no es `verified`: usar `missing`, `known` o `blocked` según la causa y dejarla explícita.

## Antes de cerrar una tarea

### Scope y cambios

- [ ] El diff coincide con el objetivo y no incluye archivos ajenos.
- [ ] Los criterios de aceptación están cubiertos con evidencia, no solo con una explicación.
- [ ] Los cambios de configuración, migración, documentación y tests están incluidos cuando aplican.
- [ ] No se modificaron secretos, identidad Git, ramas remotas ni datos reales sin autorización.

### Comportamiento y errores

- [ ] Se probaron el camino feliz, inputs inválidos y límites relevantes.
- [ ] Los errores, timeouts, retries, cancelaciones y estados parciales tienen comportamiento definido.
- [ ] No existe un `pass` por omisión cuando falta un check obligatorio.
- [ ] Los logs y respuestas no exponen credenciales, tokens, prompts sensibles o datos innecesarios.

### Datos, seguridad y operación

- [ ] Migraciones, concurrencia, integridad, backup y rollback fueron revisados si hay persistencia.
- [ ] Inputs externos, filesystem, subprocesses, red, permisos y límites de confianza fueron revisados.
- [ ] Compatibilidad hacia atrás y cambios de deploy están documentados.
- [ ] El procedimiento de recuperación existe o la no-aplicabilidad está justificada.

### Evidencia y handoff

- [ ] Se ejecutaron typecheck/compile y la suite relevante.
- [ ] Se registraron comandos exactos, resultados, versiones y limitaciones.
- [ ] Se actualizó la memoria durable del proyecto (`PLAN.md`, `CONTEXT.md`, `DONE.md` o docs aplicables).
- [ ] Se indicó cualquier gap que queda abierto y quién debe decidirlo.

## No asumir

- No asumir que existe lint, formatter, coverage, mutation testing, CI, Docker, deploy automático o
  rollback: detectarlo en archivos y comandos reales.
- No asumir que `test` significa unit, integration o E2E; identificar qué ejecuta realmente.
- No asumir que un lockfile garantiza instalación reproducible si el package manager o versión no
  coinciden.
- No asumir que una migración es segura por ser idempotente; revisar concurrencia, rollback y datos.
- No asumir que un servicio local es seguro por estar en localhost; revisar origen, puertos, SSRF,
  secretos y exposición accidental.
- No asumir que un comando de desarrollo sirve para CI o producción; verificar flags, entorno y
  artefactos.
- No asumir que una herramienta faltante se puede sustituir sin declarar el cambio de cobertura.
- No asumir que una tarea cerrada está lista para deploy si faltan gates posteriores en la secuencia.

