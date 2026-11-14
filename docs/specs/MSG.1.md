# MSG.1 — Una sesión propone un mensaje a otra sesión del mismo proyecto (escribir la spec)

Origen: tarea que creó el chat de Carlos el 2026-11-13 (`chat-c608f987-032e-46c3-ac7a-550ce66c5a7e`), sacada de `tasks.yaml` por USO.10:
el chat no debe lanzar cambios sobre OrchestOS. Texto original:

Escribir la spec `docs/specs/MSG.1.md` (en español, con el mismo estilo que `docs/specs/ACT.1.md`: "Qué existe (verificado)", "Qué cambiar", "Qué no tocar", "Verificación"). Solo la spec: no tocar código. GO de Carlos el 2026-11-13. Va después de ACT.1 y USO.7.

Objetivo: que el chat de una sesión pueda proponer un mensaje para otra sesión del mismo proyecto. Carlos lo aprueba en una tarjeta y el mensaje queda en el hilo destino. Origen: Carlos quiso que el chat de Claude le pasara a la sesión de Codex una revisión y tuvo que copiarla y pegarla a mano.

Decisiones ya tomadas (registrarlas en la spec):
- D1: el mensaje entregado **solo queda en el hilo destino**, marcado como "Mensaje de la sesión «Y»". **No dispara un turno.** El usuario decide cuándo responder.
- D2: cada envío necesita aprobación explícita en una tarjeta (Aprobar / Descartar). No hay envíos automáticos ni cadenas entre agentes.
- D3: el contenido llega al agente destino dentro de marcas `<untrusted-data>` (el límite de seguridad que ya existe) cuando forme parte del contexto de su siguiente turno: es información, no instrucciones del usuario.
- D4: solo entre sesiones del mismo proyecto. Máximo 1 propuesta por turno y un tope de longitud razonable que la spec debe fijar.

Verificar en el código y citar archivo:línea en "Qué existe". El patrón a copiar es `propose_lesson`:
- `src/mcp/server.ts:29-36`: constantes y respuestas de `create_task` y `propose_lesson`. El servidor MCP solo valida, la fuente de verdad es el stream.
- `src/mcp/adapters.ts:99` (`taskProposalFromStep`), `:148-152` (`lessonProposalFromStep`) y `:154` (`proposeLessonApiTool`, para el chat por API).
- `src/dashboard/handlers/chat.ts:1101-1105` y `:1125`: recoge propuestas del stream. `:1702-1716`: las persiste al terminar el turno. `:1913`: herramienta por API.
- `src/chat/chat-context.ts:152-154`: dónde se arma la lista de tareas del contexto. Ahí iría la lista de sesiones recientes del proyecto (id, título, CLI y última actividad, con tope).
- Buscar cómo se guardan las sesiones y los turnos (store de sesiones) y cómo la UI muestra hoy las tarjetas de propuesta de tarea o lección. Citarlo.

"Qué cambiar" debe cubrir, con archivos concretos:
1. La herramienta `message_session({ session_id, content })`: schema, descripción y respuesta en el servidor MCP, su reconocimiento en el stream y su versión API.
2. La lista de sesiones en el contexto del chat.
3. Persistir la propuesta como pendiente y mostrar la tarjeta en el hilo de origen.
4. Al aprobar: insertar en la sesión destino un mensaje con rol y marca de origen, sin lanzar turno. Al descartar: marcarla descartada.
5. La forma en que ese mensaje entra al contexto del CLI destino, envuelto en `<untrusted-data>`.
6. Tests por pieza y un gate en vivo: Claude propone un mensaje a una sesión de Codex, Carlos aprueba y el mensaje aparece en el hilo de Codex sin que se dispare ningún turno.

"Qué no tocar": ejecutores (`run/executors/`) salvo lo imprescindible; nada de envíos sin aprobación. Incluir el costo en RAM: debe ser ~0, sin procesos residentes nuevos (restricción de harness liviano de `PLAN.md`).

Si algo de lo listado no coincide con el código, la spec lo dice y propone la alternativa. No inventar rutas.

## Criterios
- docs/specs/MSG.1.md existe en español con las secciones Qué existe (verificado), Qué cambiar, Qué no tocar y Verificación
- Registra las decisiones D1-D4, incluida que el mensaje no dispara un turno en la sesión destino
- Cada referencia a código en 'Qué existe' cita archivo:línea, y las referencias comprobadas coinciden con el repositorio
- Incluye un gate en vivo Claude→Codex con aprobación del usuario
- No modifica ningún archivo de código
