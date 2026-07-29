# L.1 — Inventario de superficie y secretos

Fecha: 2026-07-29. Alcance: herramienta local de un usuario; no sustituye la revisión de
autenticación/multiusuario de L.2.

## Inventario

| Superficie | Ubicación principal | Datos o capacidad sensible |
|---|---|---|
| Dashboard HTTP | `src/dashboard/server.ts`, `src/dashboard/handlers/` | endpoints de tareas, runs, skills, configuración, memoria, chat y filesystem |
| CLI | `src/cli.ts`, `src/cli-skill-curate.ts` | lectura/escritura de tareas, specs, configuración, runs, skills y llamadas al dashboard |
| Tools del chat | `src/dashboard/handlers/chat.ts`, `src/providers/tool-call.ts` | fetch externo, lectura de proyecto, ejecución de herramientas y prompts |
| Subprocesses | `src/run/checks.ts`, `src/run/sandbox.ts`, `src/run/executors/`, handlers de proyecto/tareas/specs | `Bun.spawn`, CLIs externos, git, `cwd`, stdout/stderr y entorno heredado |
| Filesystem | proyecto (`tasks.yaml`, `AGENTS.md`, `CONTEXT.md`, `runs/`, `skills/`, specs) | código, instrucciones, resultados y logs |
| Configuración local | `~/.orchestos/.env`, `orchestos.config.yaml`, `ORCHESTOS_HOME`, `PORT` | API keys, host de dashboard, modos de executor y catálogos |
| Persistencia/export | `~/.orchestos/*.sqlite`, `runs-summary.json` | prompts, resultados, errores, diagnósticos, costos, pasos y metadatos |

Los proveedores usan `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` y `OPENAI_API_KEY`; `OLLAMA_HOST`
es un endpoint local, no un secreto. Los subprocesses usan arrays de argumentos según el inventario
de L.0; la auditoría de timeouts, entorno mínimo y cleanup continúa en L.3.

## Control automatizado

`src/security/secrets.ts` detecta private keys PEM, claves conocidas de OpenRouter/Anthropic/OpenAI,
tokens GitHub, AWS access keys, Bearer tokens y asignaciones genéricas de credenciales. No imprime el
valor encontrado. `scripts/check-secrets.ts --staged` revisa únicamente líneas añadidas del diff
staged; también acepta rutas explícitas para revisar archivos generados.

El check está conectado al pre-commit mediante `bun run security:secrets`. Los fixtures positivos se
construyen dinámicamente para demostrar detección sin convertirse ellos mismos en secretos literales.
Fixtures negativos (`test`, `fake`, `example`, etc.) se aceptan explícitamente como placeholders.

## Redacción y persistencia

`redactSensitive()` se aplica antes de escribir en:

- `RunLogger` y sus archivos `runs/*.log`.
- columnas textuales de `runs`, incluyendo prompt, resultado, razones, checks, diffs y diagnósticos.
- `run_steps.label` y `run_steps.detail`.
- mensajes enviados por `errorResponse()`.

Los exports derivados de `runs` reciben datos ya redactados. La prueba `secrets.test.ts` verifica que
un secreto no aparece en logs ni respuestas HTTP y que los patrones positivos/negativos funcionan.
Los datos históricos ya persistidos no se reescriben automáticamente: si se sospecha exposición,
deben revocarse las claves y eliminarse los registros/logs afectados mediante un procedimiento explícito.

## Rotación y revocación

1. Revocar la clave comprometida en el panel del proveedor correspondiente.
2. Generar una clave nueva con el menor alcance posible.
3. Sustituirla en `~/.orchestos/.env` o en el entorno del proceso; no commitear el archivo.
4. Reiniciar OrchestOS y ejecutar una llamada de prueba no sensible.
5. Eliminar o retener según política los logs, runs y exports que pudieran contener la clave.

La protección en reposo sigue siendo una decisión pendiente: no se implementa cifrado propio. Si se
requiere protección contra otro proceso local, la opción a evaluar es el keychain del sistema o un
mecanismo equivalente; el archivo `.env` actual continúa siendo texto plano dentro del modelo local.
