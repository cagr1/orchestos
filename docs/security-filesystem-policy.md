# OrchestOS — Filesystem y subprocesses

Bloque L.3, 2026-07-29. Esta política es la frontera común para paths recibidos de tareas o
LLMs y para los checks/CLIs que OrchestOS ejecuta.

## Matriz de operaciones

| Operación | Aceptado | Rechazado |
|---|---|---|
| `read_file` / `list_dir` | Path relativo, dentro del root real | Absoluto, `..`, traversal URL-encoded, destino fuera por symlink |
| `enforceContract` | Output declarado, archivo regular y parent chain dentro del root | Output no declarado, symlink de escritura, archivo especial, escape |
| `run_check.cwd` | `.` o directorio existente dentro del root | `../`, absoluto fuera, archivo, symlink que escape |
| diff de worktree | Archivos regulares reportados por Git dentro del worktree | Path que no se puede resolver dentro del worktree |
| worktree | Repositorio Git con branch y root válido | Root inexistente/no Git, branch inválida, estado sucio en modo worktree |

`src/run/path-policy.ts` hace la normalización, decodifica hasta tres capas de encoding,
rechaza traversal lexical y verifica `realpath` del segmento existente. En escrituras también
rechaza atravesar symlinks, incluso si apuntan a otra ubicación dentro del proyecto: evita que
el destino cambie entre validación y escritura.

## Subprocesses

Los comandos se entregan a `Bun.spawn` como arrays; no se usa shell interpolation. El `cwd` de
checks se valida con la misma política y el entorno se filtra mediante `safeChildEnv()`. Se
conservan solo variables operativas (`PATH`, locale/temp, CI), configuración `ORCHESTOS_*` y
credenciales explícitas de proveedores. stdout/stderr de checks se limita antes de persistirse
en el resultado y todos los runners tienen timeout y señal de terminación.

La prueba `src/__tests__/path-policy.test.ts` demuestra el rechazo observable de traversal,
symlinks, `cwd` externo, metacaracteres de shell y variables arbitrarias heredadas. No se trata
de una garantía contra un proceso local ya comprometido con el mismo UID; ese actor está fuera
del modelo L.0.
