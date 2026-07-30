# Política de datos, privacidad y retención de OrchestOS

Estado: baseline local, usuario único — 2026-07-29.

## Clasificación

| Datos | Ejemplos | Clasificación | Regla |
|---|---|---|---|
| Credenciales | API keys, Bearer tokens, private keys | Restringido | Nunca persistir sin redacción; no exportar |
| Contenido de trabajo | prompts, resultados, errores, diffs, checks, memoria | Sensible | Local por defecto; redacción antes de enviar a un proveedor |
| Código/contexto | `agents_md`, `CONTEXT.md`, snippets indexados, contenido OCR | Sensible | No exportar por defecto; depende del proyecto y del usuario |
| Metadatos operativos | modelo, proveedor, tokens, costo, estado, duración, task/run id | Interno | Puede entrar en summaries; no implica que el contenido sea público |
| Índices derivados | hashes, edges, embeddings, FTS | Interno/sensible | Borrar junto con el proyecto; embeddings no deben interpretarse como anónimos |
| Configuración | stack profile, rutas, comandos, preferencias | Interno | Retener mientras exista el proyecto; revisar rutas en exports |

## Retención

- `projects`, `files`, `code_edges`, `context_chunks` y `memory_entries`: retención indefinida
  mientras el usuario conserve el proyecto; borrado manual cuando el proyecto deje de existir.
- `runs`: retención indefinida por defecto porque contienen evidencia histórica de calidad y costo;
  borrado individual o masivo es explícito desde el usuario.
- `run_steps`: datos efímeros de streaming; se pueden purgar manualmente después de 30 días.
- `chat_task_bar_events`: instrumentación operativa; se pueden purgar manualmente después de 30 días.
- `instincts`: retención indefinida hasta revisión/borrado manual; los no verificados siguen sujetos
  al reset de datos de prueba existente.
- Backups: no se purgan automáticamente; el usuario debe conservarlos y eliminarlos según su propio
  backup policy. Nunca se deben guardar en Git ni subir a un proveedor sin decisión explícita.

## Exportación y diagnóstico

- `runs-summary.json` es un resumen operativo: no incluye prompt, resultado crudo, checks completos,
  diffs ni contenido de memoria.
- Las respuestas del dashboard de runs exponen metadatos y diffs ya persistidos, no credenciales.
- El diagnóstico LLM recibe solo la información necesaria y debe pasar por `redactSensitive()`;
  el proveedor externo nunca debe recibir una API key encontrada en un run antiguo.
- Un backup SQLite es una copia sensible completa, no un export anonimizado: permisos `0600`, manejo
  local y sin automatizar su envío.

## Borrado y recuperación

- Toda purga debe ofrecer primero un preview de filas afectadas y devolver conteos por tabla.
- La purga efímera es transaccional y solo afecta `run_steps` y `chat_task_bar_events`.
- El borrado de runs/memoria/proyectos continúa siendo explícito por id o acción del usuario.
- Antes de un borrado masivo se recomienda crear un backup validado. La recuperación se hace a un
  archivo nuevo validado; reemplazar la DB activa requiere detener el proceso y una acción operativa
  explícita.
