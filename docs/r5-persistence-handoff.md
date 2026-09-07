# R.5 — diagnóstico y traspaso de implementación

Fecha: 2026-09-07. Base inspeccionada: `8ad2d46`, master limpio al comenzar.
Carlos autorizó R.5 y pidió parar dejando el trabajo documentado si resultaba largo.
Se entrega diagnóstico y diseño propuesto; **R.5 sigue abierta, sin cambios de runtime**.
La autorización explícita permite a Codex tomar este ítem 🧠.

## Estado de verificación

- Leídos AGENTS.md, CLAUDE.md, protocolo, bloque R, H.9.4 y contexto de tasks.yaml.
- `bun run agent:preflight -- --item R.5 --agent codex`: PASS.
- `bunx tsc --noEmit`: PASS.
- `bun test src/dashboard/__tests__/chat-sessions.test.ts src/dashboard/__tests__/chat-read-boundary.test.ts`:
  9 pass, 0 fail, 51 assertions. Son baseline; no demuestran atomicidad ni reintentos.
- Knowledge radar: sin insights aplicables. Hub y decisiones del proyecto consultados:
  conservar SQLite local y tasks.yaml como fuente de tareas. El snapshot del vault está
  desactualizado respecto al repo; no se usó para inferir estado actual.
- Los hallazgos siguientes son revisión del código, **no sondas de fallo en producción**.
  No se ejecutaron proveedores, tareas reales, migraciones sobre la DB del usuario ni gate H.9.4.

## Qué está roto y dónde

1. `src/dashboard/handlers/chat.ts:442`, `logChatRun()`: atrapa cualquier error de
   `insertRun()` sin comunicarlo; devuelve void y pierde el id del run. Puede continuar
   hasta HTTP 200 y mensajes persistidos aunque haya fallado la evidencia.
2. `chat.ts:1031`, `persistResponse()`: llama por separado a `appendChatExchange()`.
   En los caminos que registran run primero, un fallo al guardar mensajes deja un run
   `done` y devuelve 502. El catch lo presenta como error de chat/proveedor.
3. `src/db/chat-sessions.ts:157`: la transacción cubre solo dos mensajes, título y fecha.
   No existe turno durable antes de llamar al proveedor. Sin respuesta no queda el mensaje
   del usuario en esta tabla. `chat_messages` no tiene turn_id/run_id ni estado.
4. `src/db/runs.ts:88`: `insertRun()` genera UUID internamente y devuelve el id;
   RunRecord solo permite done/blocked/failed. Preserva redacción de secretos.
   No ampliar estados globales de runs sin revisar todos sus consumidores.
5. `chat.ts:1234` aprox., rama Ollama: solo persiste mensajes. `llm/clients.ts` devuelve
   text/model y descarta usage. No inventar tokens/costo medidos al incorporar su run (R.6
   aborda costo canónico; esta pasada debe declarar los datos desconocidos).
6. Fallos: Claude registra failed solo cuando el error trae readAudit; el tool loop API
   registra snapshot incompleto. Codex, OpenCode, Ollama y API plana no tienen registro
   equivalente en sus catches. Hay retornos y awaits previos al try principal (clasificador,
   OCR, contexto) que también deben tener política de turno explícita.
7. `chat.ts:780–829`: buildNaturalDraft → createTaskRecord → posible spawnTaskRun ocurre
   **antes** de proveedor principal y persistencia. Una respuesta fallida puede coexistir
   con una tarea ya ejecutándose. `handlers/tasks.ts:251` renombra un id repetido con
   Date.now(): reenviar no es idempotente, puede crear otra tarea.
8. No hay request/turn id en el body ni claim durable. El bloqueo chatPendingBySession
   es memoria de una pestaña; no coordina dos pestañas/procesos ni sobrevive a recarga.
9. Los callers de logChatRun usan `session?.project_id ?? project.id`: en una sesión
   general el null explícito puede reemplazarse por el proyecto fallback. Usar la
   distinción sesión existente/general versus request legacy al asociar evidencia.
10. DELETE borra mensajes por CASCADE; no hay vínculo con runs. El handler conserva
    un objeto session capturado antes del await: si se borra mientras espera, puede
    insertar el run y fallar luego en appendChatExchange. Definir qué evidencia sobrevive.
11. `screens-core.js:749–772`: los errores HTTP/red se agregan como mensajes assistant
    locales y desaparecen al restaurar. Deben representarse como estado/error del turno,
    sin atribuir al proveedor una respuesta que no produjo.
12. `chat.ts:113/836`: adjuntos viven en un Map con expiración; ids ausentes se filtran.
    Una recuperación no debe volver a ejecutar silenciosamente con adjuntos perdidos.

## Diseño propuesto para implementar

No es un contrato ya entregado. Resolver estas decisiones en código/tests antes de cerrar.

1. Añadir migración numerada posterior a la última que exista al retomar (hoy 3), mediante
   FUTURE_MIGRATIONS en `src/db/migrate.ts`. Conservar mensajes/runs legacy y dejar su
   asociación desconocida: nunca inferirla por timestamps, texto o modelo.
2. Tabla `chat_turns`: identidad durable, session/project, clave de petición única,
   fingerprint de entrada, estado, owner/lease, fechas, error, response envelope y enlace
   al run. Estados propuestos: pending, completed, failed, interrupted. La identidad de
   petición debe existir antes del primer POST y mantenerse al retransmitir la misma petición.
   Un reintento explícito tras fallo crea un intento vinculado; no resetea evidencia anterior.
3. Servicio único en `src/db/chat-turns.ts` (nuevo): begin/claim, complete, fail, get/recover.
   Claim con constraint/transacción breve antes del clasificador o efectos externos.
   Misma clave + misma entrada: devolver resultado durable o estado pendiente, sin otra llamada.
   Misma clave + otra entrada: 409. Concurrencia de turnos distintos en una sesión: rechazar
   o serializar de forma durable para no construir dos respuestas con el mismo historial viejo.
4. Transacción final única: insertRun + enlace al turno + respuesta/mensajes + metadatos
   + estado completed. Reutilizar insertRun para conservar redacción y capturar su retorno.
   No envolver ningún await/red/proceso en db.transaction(). Si falla commit, no devolver
   éxito. Un error de almacenamiento se distingue del fallo del proveedor.
5. Guardar la entrada al aceptar el turno; guardar fallos sin assistant ficticio. En caso
   de caída entre proveedor y commit, mantener resultado desconocido/interrumpido, nunca
   reejecutar automáticamente. Si la DB no admite escrituras, no es posible prometer un
   error durable: devolver error de persistencia y conservar el pending ya comprometido.
6. Encapsular los seis caminos: Claude, Codex, OpenCode, Ollama, OpenRouter tool loop y
   OpenRouter plano. Todos terminan en el mismo servicio. Capturar auditoría parcial en
   fallos, sin cambiar semántica unknown/uninstrumented ni volver files_read=[] por defecto.
   Las ramas CLI bloqueadas por readBoundary no se habilitan para poder probarlas.
7. Guardar envelope suficiente para replay: texto/modelo, OCR, taskSuggestion, autoTask
   (incluido held/existingFiles), readAudit, turnId/runId. El replay debe reproducir la
   respuesta ya guardada y conservar asociación, sin ejecutar efectos secundarios.
8. Tareas: reservar y guardar intención/id antes de crear; registrar creación y dispatch
   como fases recuperables. SQLite + YAML + git + spawn **no** forman una transacción.
   Ante interrupción ambigua, reconciliar el id reservado con tasks.yaml/runs y reportar
   desconocido; no hacer spawn automático. Elegir mecanismo concreto de reserva/reconciliación
   antes de afirmar que el reintento no duplica tareas. No absorber la escritura atómica global R.7.
9. Reinicios/múltiples dashboards: no marcar todos los pending como interrupted cada vez
   que un proceso abre la DB. Definir dueño/lease y actualización condicional que impida
   a un owner vencido cerrar sobre otro. El vencimiento solo permite reconciliar, no repetir
   automáticamente proveedor o tarea. Documentar plazo y condiciones de recuperación.
10. DELETE: definir conservación del run y política de turnos en vuelo. Una opción acotada
    es rechazar borrado activo con 409 y permitir borrar cuando sea terminal; otra es tombstone
    con evidencia desvinculada. Elegir una y probarla end-to-end; no cambiar CASCADE a ciegas.
11. Cliente/endpoint: generar y persistir identidad de petición por conversación, consultar
    el turno tras recarga/error de red antes de reenviar, mostrar pendiente/fallido/interrumpido
    separado de mensajes. El contexto para proveedores solo incorpora intercambios pertinentes;
    no duplicar el user actual ni inyectar errores técnicos como assistant.
12. Legacy sin sessionId: sostener un turno con session nullable o migrar explícitamente
    a sesión, con compatibilidad probada. No ignorar requests legacy que aún ejecutan tareas.

## Secuencia sugerida para el siguiente LLM

1. Releer preflight/git status; este documento es evidencia en 8ad2d46, no un snapshot eterno.
2. Concretar decisiones de claim, lease, delete, retry y reserva de tarea. Actualizar esta nota
   antes de tocar runtime. No se necesita reasignación: Carlos ya autorizó R.5.
3. Migración/servicio con tests de transacción, restricciones y datos históricos.
4. Cableado de los transportes y efectos de tarea; contratos API y frontend de recuperación.
5. Gates reproducibles y en vivo; solo entonces marcar R.5 y commitear cierre.

Archivos esperados: migrate.ts, nuevo db/chat-turns.ts, db/chat-sessions.ts, db/runs.ts si
es necesario, handlers/chat.ts, handlers/chat-sessions.ts, dashboard/types.ts, server.ts
si se añade endpoint, llm/clients.ts, public/app.js, public/screens-core.js y copy i18n.
La coordinación de tareas puede requerir helpers en handlers/tasks.ts; mantener R.7 separado.
No introducir un framework de orquestación ni rediseñar el cálculo de costos R.6.

## Pruebas necesarias para cerrar

- Migración sobre DB existente, aplicada dos veces y recuperada tras fallo; mensajes antiguos intactos.
- Trigger SQLite que aborte entre insertRun y mensajes: rollback del conjunto, cero HTTP 200.
- Fallo al insertar run; fallo también al registrar error: respuesta honesta y pending recuperable.
- Dos procesos envían la misma clave: una invocación del proveedor y un resultado/enlace.
- Dos claves distintas simultáneas en la misma sesión: orden/rechazo consistente.
- Mismo request con payload distinto: conflicto, sin proveedor ni tarea adicionales.
- Proveedor falla, CLI termina, tool stream truncado: fallos recuperables con auditoría disponible.
- Ollama y API plana producen run enlazado; sesión general mantiene project_id NULL.
- Terminar proceso entre claim/proveedor/commit y reabrir: interrupted/unknown sin duplicación.
- Respuesta HTTP perdida después del commit: replay exacto tras recarga, sin otra facturación.
- Caída después de creación YAML y después de spawn: ninguna segunda tarea/ejecución automática.
- Borrado en vuelo y owner concurrente: comportamiento elegido verificable sin evidencia huérfana.
- Held/existingFiles y OCR sobreviven recarga; adjuntos expirados no se omiten en reintentos.
- Unitarios en procesos aislados o inyección de dependencias (evitar mock.module global).
- `bunx tsc --noEmit`, suites relevantes, `bun run test:coverage`, lint y security:gate
  si se modifica frontera/redacción. Revisar `scripts/verify-read-audit.ts` para reutilizar evidencia.
- Dashboard + navegador + consulta SQLite reales: acción/endpoint/persistencia/estado visible.
  Las demoras/mocks sirven para carrera determinista, no sustituyen el gate real.
- H.9.4 sigue siendo gate independiente exigido por el bloque R: fixtures fuera/dentro y
  auditoría correlacionada; usar gate:evidence cuando se ejecuta harness con home temporal.

## Observaciones adyacentes, sin corregir en esta pasada

R.4 figura cerrada, pero el código inspeccionado aún tiene puntos que revisar: un restore
iniciado antes del envío y resuelto después de terminarlo supera el guard pending; no se
invalida su epoch al agregar mensajes. Al borrar sesión activa no se limpia chatPending.
La restauración transforma el task_id persistido de una tarea held en taskId normal y pierde
pendingTask/OCR. Su gate documentado usa fetch simulado en navegador y no prueba la persistencia
real de esos casos. Son observaciones estáticas: no se reabrió R.4 ni se afirma reproducción.
R.5 debe cubrir metadatos y estados que toque; coordinar los demás puntos con un seguimiento R.4.

La continuidad de historial hacia CLIs también queda para la revisión del recorrido: los
callers observados pasan systemPrompt y combinedText, mientras la lista messages se usa en API.
No ampliar R.5 a los contratos de prompt sin verificar primero sus executors.
