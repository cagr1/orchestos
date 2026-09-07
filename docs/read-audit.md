# Auditoría de lecturas — R.2

`runs.read_audit_json` guarda el contrato v1 por run. `GET /api/runs/:id` y el
detalle de Runs publican `readAudit`; registros legacy/corruptos/versiones desconocidas
se presentan como cobertura desconocida. Nunca reconstruir éxito desde `files_read` legacy.

## Qué acredita

- Claude: llamadas explícitas Read/Grep/Glob en `assistant.message.content`, correlacionadas
  por `id` con `user.message.content.tool_result.tool_use_id`. Ausencia de `is_error` es
  éxito según la captura real de CLI 2.1.263; `true` es error. Solo el mensaje de rechazo
  de `--restricted` medido se clasifica como rechazo; otros errores permanecen errores.
- OpenRouter: los cuatro lectores locales reportan la rama real de I/O. El ID del proveedor
  atraviesa loop/router hasta el lector. El contenido del archivo nunca decide el estado.
- Codex/OpenCode y los caminos sin adaptador: `uninstrumented`, no un historial vacío fiable.

Cada operación contiene ID, herramienta, tipo, ruta **solicitada**, resultado observado y
estado `succeeded/rejected/failed/unknown`. No contiene texto leído, patrones de búsqueda,
prompts ni errores crudos. Las rutas son metadatos potencialmente sensibles y reciben la
redacción habitual de runs; este registro no es anónimo ni un artefacto publicable sin revisar.

`complete` se refiere exclusivamente a la cobertura declarada, nunca al filesystem completo.
Grep exitoso (incluso sin coincidencias) y Glob exitoso no enumeran todos los archivos leídos.
Lecturas implícitas del CLI, carga de contexto, adjuntos, memoria y actividad fuera del
adaptador no están observadas por este contrato.

## Integridad y límites

Sin resultado, el estado es desconocido. Stream sin terminal, corrupción, IDs duplicados,
resultados huérfanos, herramientas no cubiertas o errores de proceso producen incompletitud.
La última línea válida sin newline sí se procesa. El registro se limita a 512 operaciones,
IDs de 256 caracteres y rutas de 2048; un exceso queda explícito, nunca como evidencia completa.
Cada invocación usa su propio colector; los snapshots no comparten objetos mutables.

`files_read` queda como proyección compatible de lecturas directas exitosas **solo** cuando
la evidencia está completa; búsquedas no agregan paths. Evidencia incompleta/no instrumentada
produce SQL NULL. Para interpretar cualquier proyección se debe consultar `readAudit`.

Errores del stream/loop conservan el snapshot disponible en un run fallido. No se infieren
tokens/costo desconocidos de esos errores. La escritura de runs aún es best-effort: R.5 debe
resolver atomicidad turno/run y fallos de DB. El registro no garantiza sobrevivir a una caída
abrupta del proceso ni haber sido confirmado por disco antes de responder al usuario.

Esto es observabilidad, no una frontera de seguridad. No modifica permisos del CLI ni amplía
herramientas. Las pruebas usan fixtures sintéticos; jamás archivos privados del usuario.
