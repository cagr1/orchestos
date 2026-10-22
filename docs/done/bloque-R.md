# Bloque R — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="bloque-r-r-1"></a>
### R.1 — ⚡ Recuperar creación de tareas desde sesiones de proyecto.
 Prioridad alta. Cerrado 2026-09-07.
  Confirmado por código: `app.js:346/389` crea sesiones con `mode: 'chat'`, mientras
  `sessionAllowsTaskExecution()` solo habilita `code` o el camino legacy sin sesión. No hay
  transición de modo cableada en ese frontend. Aplicar la decisión ya tomada en I.2: derivar
  autoridad del contexto del proyecto y conservar sesiones generales sin autoridad de ejecución.
  No habilitar ejecución global ni relajar `sessionAllowsTaskExecution()` para hacer pasar el test.
  **Gate:** navegador real, sesión nueva vinculada a proyecto → petición de tarea → tarea real
  y ejecución conforme a I.2; archivos existentes requieren confirmación, archivos nuevos siguen
  la política acordada. Sesión sin proyecto no crea tareas ni spawnea procesos. Probar también
  recarga y sesiones preexistentes sin elevar silenciosamente su autoridad.
  **Avance 2026-09-06 (Codex, sin cierre):** implementación lista: el servidor asigna `code`
  únicamente al crear una sesión nueva con `projectId`, conserva `chat` para sesiones generales y
  el frontend deja de imponer `mode: chat`; no se migraron sesiones existentes. Tests de sesión
  cubren ambos defaults y la frontera general sin proyecto; `bunx tsc --noEmit` y
  `bun run test:coverage` verdes (1277 pass).
  **Gate en vivo:** navegador real (Chromium vía playwright-core, instalado ad-hoc en scratchpad,
  no vendorizado en el repo), 2026-09-07 (Claude). Servidor real levantado desde el cwd del propio
  proyecto (DB migrada limpia, sin mocks), proyecto registrado vía `upsertProject`. Navegación
  real a la pantalla Chat → click real en `[data-act="chat-new-session"]` → red capturada: POST
  `/api/chat/sessions` sin `mode` en el body (confirma que `app.js` ya no lo impone) → respuesta
  `{projectId: <real, resuelto por legacy-cwd>, mode: "code"}`. Caso sin proyecto (`mode: "chat"`)
  confirmado por separado contra el mismo servidor real. `sessionAllowsTaskExecution()` verificada
  intacta — no se relajó para pasar el gate. Servidor bajado y estado temporal borrado al cerrar.
  No cubierto por este gate (no se reclama): el tramo `classifyTaskIntent` → task real → spawn de
  proceso no cambió con este ítem — ya estaba cableado antes de R.1; el hueco que R.1 cerraba era
  solo la asignación de `mode`. Recarga de sesión existente sin proyecto: no re-verificada aparte
  (código no tocado por este diff, cubierto por tests existentes de I.4).

<a id="bloque-r-r-2"></a>
### R.2 — 🧠 Auditoría que distingue lectura solicitada, ejecutada, rechazada y desconocida.
 (2026-09-07, Codex; alcance aprobado por Carlos)
  Prioridad alta. Reproducido: `claudeEventToReadPaths()` (`step-event.ts:48`) añade el path de
  `tool_use/Read`; un `tool_result` de rechazo no lo corrige. `Grep` no se registra. El camino
  OpenRouter (`chat.ts:1192`) extrae argumentos de `read_file` sin comprobar resultado y omite
  `read_plan/tasks/ideas`. Codex/OpenCode escriben `[]` sin tener instrumentación equivalente.
  Diseñar correlación por llamada/resultado, estado de completitud y procedencia; desconocido
  no equivale a cero lecturas. Registrar evidencia suficiente sin copiar contenido privado
  innecesario. Definir qué canales cubre cada adaptador y verificar sus eventos en el CLI real.
  **Gate:** fixtures dentro/fuera del proyecto, lectura exitosa, rechazo, herramienta de búsqueda,
  stream incompleto y transporte no instrumentado; ninguna solicitud rechazada cuenta como
  lectura exitosa y ningún canal no observado produce una garantía de ausencia de lectura.
  Tests deterministas + security:gate + evidencia real con fixtures, nunca el vault personal.
  **Alcance confirmado por Carlos (2026-09-07, Codex):** contrato versionado por ejecución;
  correlación solicitud/resultado Claude, observación directa de los cuatro lectores OpenRouter,
  cobertura y completitud explícitas, migración aditiva y pruebas adversariales. Sin contenido
  privado en el nuevo registro. Fuera: R.1, instrumentar Codex/OpenCode sin contrato verificado,
  garantías de lecturas implícitas y rediseño transaccional de R.5. Primero adaptadores y tests,
  luego persistencia/API, finalmente cobertura, seguridad y gate real antes de marcar cierre.
  **Implementación:** contrato v1 en `runs.read_audit_json`; Claude correlaciona por
  `tool_use_id`, OpenRouter observa I/O de sus cuatro lectores con el ID del proveedor.
  Error ordinario no se presume rechazo. Eventos faltantes/corruptos/duplicados/huérfanos,
  formas no verificadas, timeout y truncamiento visible del registro impiden completitud.
  Última línea sin newline procesada. Colectores por invocación y snapshots independientes.
  Codex/OpenCode/legacy son desconocidos; `files_read=NULL` sin evidencia completa. Grep/Glob
  registran búsqueda/listado, nunca inventan todos los archivos leídos. Contrato y exclusiones
  en `docs/read-audit.md`; Runs API y detalle UI exponen estados y límites en inglés/español.
  **Gate en vivo:** Playwright/navegador → composer del dashboard :50919 → Claude 2.1.263 →
  SQLite → detalle Runs → recarga. Ocho operaciones verificadas por resultados reales:
  Read/Grep/Glob dentro exitosos, cinco rechazos fuera (incluidos symlink y prefijo similar).
  `files_read` ahora contiene **solo inside.txt**, no las cuatro solicitudes Read. Auditoría
  persistida contiene ocho outcomes y ningún contenido de los fixtures. Dos mensajes
  persistidos y evidencia visible después de recargar. Captura bajo `gate:evidence`;
  `verify-read-boundary.ts` valida frontera y `verify-read-audit.ts` cruza DB contra stream,
  además de reproducir exactamente la captura con el parser final. Reporte portable:
  `scripts/fixtures/read-audit-review-2026-09-07.json`; crudo local `/tmp/orchestos-r2-evidence-0907`.
  El wrapper exportó cero runs porque excluye chat: la evidencia durable es el reporte versionado.
  **Gates finales:** typecheck limpio; `test:coverage` 1300 pass / 0 fail, funciones 75.80%,
  líneas 64.34%; `security:gate` PASS; UI copy y ledger gates PASS. Lint PASS sobre snapshot
  limpio del índice R.2; el workspace completo conserva un error de formato preexistente en
  `chat-sessions.test.ts` (R.1, no incorporado ni modificado).
  **Observaciones del gate:** `/api/chat/models` devuelve 400 por falta de key OpenRouter en
  el fixture, sin impedir Claude. El clasificador intentó auto-crear una tarea pese al pedido
  de solo lectura; faltaba tasks.yaml y no se creó/ejecutó ninguna. No acredita el gate R.1.
  La expansión Runs se comprobó mediante evento DOM del navegador; el click de Playwright
  por puntero agotó su espera de estabilidad durante rerenders. No se corrigió ese comportamiento
  previo ni se declara ergonomía completa del dashboard. R.5 conserva atomicidad/durabilidad
  ante caída abrupta; R.2-ter conserva la frontera de lectores fijos. H.9.4 sigue abierto.

<a id="bloque-r-r-2-bis"></a>
### R.2-bis — 🔍 Hallazgo bloqueante de R.2: la frontera de lectura no existe (evidencia).
 (revisión independiente y correcciones, 2026-09-06)
  **Revisión Codex de b0ee431, autorizada por Carlos:** la elección de `--restricted` es válida
  para los casos medidos en Claude Code 2.1.263. Se corrigieron tres huecos de integración:
  (1) cache por ruta canónica e identidad del archivo, con sonda limitada a 2 s y env del spawn;
  (2) el executor verifica y ejecuta esa misma ruta, incluso si cambia PATH; (3) executor-modes
  publica la capability efectiva, no la intención del registro. El binario 2.1.234 real devuelve
  HTTP 400 antes de clasificar/spawnear una conversación. Tests cubren reemplazo del binario,
  cambio de PATH y respuesta del endpoint con capability ausente.
  **Gate en vivo:** navegador real Playwright → dashboard :50919 → `/api/chat` → CLI 2.1.263.
  Ocho llamadas correlacionadas por `tool_use_id` con un resultado cada una: Read/Grep/Glob
  dentro permitidos; Read externo, symlink externo, prefijo similar, Grep/Glob hacia afuera
  rechazados. Tools efectivas `[Glob,Grep,Read]`; MCP `[]`. Contenido permitido visible tras
  recarga y dos mensajes persistidos en SQLite. Evidencia portable en
  `scripts/fixtures/restricted-review-2026-09-06.json`; captura con `scripts/live-read-boundary.ts`
  bajo `gate:evidence`, verificada mediante `scripts/verify-read-boundary.ts`. La captura cruda
  local está en `/tmp/orchestos-boundary-evidence-0906`; el reporte no incluye paths personales.
  El gate de navegador descubrió `CLAUDE_CLI_EFFORT_LEVELS` inexistente en `app.js`: corregido y
  probado enviando el mensaje desde el composer de Claude. El catálogo OpenRouter del fixture
  sin key devuelve 400; no impidió el transporte Claude, ni se declara ese catálogo verificado.
  **CI 34045777216:** cobertura y typecheck pasaron; `biome check .` falló con 29 errores de
  formato/imports (varios preexistentes). El ENOTDIR de la anotación es el caso negativo exitoso
  de exportación de evidencia, no la causa del job rojo. Corrección mecánica de formato/imports
  en los archivos señalados, sin desactivar reglas ni rebajar umbrales.
  **Verificación local final:** `bun run test:coverage`: 1289 pass / 0 fail;
  `bunx tsc --noEmit` y `bun run lint`: exit 0. `security:gate`: PASS (repetido tras
  las correcciones). Los warnings informativos de Biome preexistentes siguen visibles.
  **Límites:** esta revisión acredita las ocho operaciones, no ausencia universal de escapes ni
  aislamiento de todas las lecturas automáticas. R.2 y H.9.4 siguen abiertos: SQLite aún guarda
  cuatro solicitudes Read como `files_read`, aunque tres fueron rechazadas. El wrapper excluye
  runs de chat de la exportación durable; por eso se conserva además el reporte versionado.
  R.1 conserva sus tres archivos en vuelo; esta revisión no los incorpora ni cierra su gate.

  **Historia del hallazgo (se conserva):**
  Descubierto 2026-09-06 al ejecutar el gate de R.2, que exige un caso de **lectura exitosa**: no
  existe. Detiene R.2 y **reabre H.9.2** (ver arriba). El diseño de instrumentación de R.2 sigue
  siendo válido; lo que faltaba era una frontera real sobre la cual instrumentar.

  **9 sondas contra el binario real** (`claude -p --output-format stream-json`), fixture "dentro
  del proyecto" + fixture secreto "fuera del proyecto". Ninguna conclusión inferida de la doc:

  | # | Configuración | dentro | afuera |
  |---|---|---|---|
  | 1 | `deny:["Read(//*)"]` ← **la que escribe el código hoy** | ❌ bloquea | ❌ bloquea |
  | 2 | `{}` (sin frontera) | ✅ | ⚠️ **leyó** — vía `Bash`, esquivando `--allowedTools` |
  | 3 | `--tools Read,Glob,Grep` + `{}` | ✅ | ⚠️ **leyó** — Read directo; el cwd no es frontera |
  | 4 | `deny:["Read(//**)"]` + `allow:[<root>/**]` | ❌ | ❌ — **deny gana sobre allow, siempre** |
  | 5 | hook `PreToolUse` propio (deny fuera) | ✅ | ✅ bloquea |
  | 6 | **idem 5, con el script del hook ausente** | — | ⚠️ **leyó** — **fail-open** |
  | 7 | `deny` global + hook con `permissionDecision:"allow"` | ❌ | ❌ — el allow del hook no gana |
  | 8-9 | **`--restricted --strict-mcp-config` + `--tools`** (2.1.263) | ✅ lee | ✅ **bloquea** |

  La 8-9 pasó además los 3 fixtures adversariales que exigió la revisión de Astra: **symlink desde
  dentro apuntando afuera**, **directorio con prefijo similar** (`…/r2-probe-evil` vs `…/r2-probe`)
  y **Grep recursivo hacia afuera** — los tres bloqueados, sin filtrar el fixture secreto.

  **Objeciones de la revisión de Astra, todas correctas y todas incorporadas:** (a) el hook falla
  abierto → sonda 6 lo confirma, por eso se descarta el hook propio; (b) `PreToolUse` **no** cierra
  R.2 "de raíz" (mi afirmación fue de más): ve intención y autorización, no resultado — R.2 exige
  correlación por `tool_use_id` con el resultado y **`desconocido` cuando falta**; (c) `--tools`
  no cubre MCP y `--settings` **añade** config en vez de reemplazarla (confirmado en el `--help`:
  *"load additional settings from"*) → de ahí `--strict-mcp-config`, y `--restricted` que además
  ignora los settings de user/project/local; (d) validar paths exige symlinks/prefijos/recursivo →
  cubiertos arriba; (e) auditoría con log por run y estado explícito ante truncamiento → queda
  dentro de R.2. La versión también la acertó: `--restricted` **no existe** en 2.1.234.

  **Hallazgo de entorno (corregido 2026-09-06):** había **dos** instalaciones de Claude Code —
  `~/.local/bin/claude` → 2.1.234 (sin `--restricted`) sombreando a la de npm → 2.1.263. El
  symlink se repuntó a 2.1.263; el binario viejo queda en disco (`claude.2.1.234.bak`), no se
  borró. Consecuencia de diseño: la capability **no puede asumirse por versión instalada** —
  `readBoundary` debe verificarse contra el binario que realmente se va a spawnear.

<a id="bloque-r-r-2-ter"></a>
### R.2-ter — 🧠 Unificar frontera de los lectores fijos OpenRouter.
 Cerrado 2026-09-07.
  Hallazgo por código durante R.2 (2026-09-07): `read_plan/tasks/ideas` usan `readProjectTextFile()`
  con `join` y `readFileSync`, sin `resolveProjectPath`; un nombre fijo no elimina el riesgo de
  symlinks. Fuera del alcance de instrumentación R.2: no se corrigió ni se afirma aislamiento de
  estos lectores. Aplicar política canónica común y probar fixtures symlink externo, interno y
  faltante.
  **Fix:** `readProjectTextFile()` ahora resuelve con `resolveProjectPath(root, name, 'read')` en
  vez de `join()+readFileSync` crudos — mismo boundary que `read_file`, un solo punto real (el
  comentario ya lo afirmaba; ahora es cierto). Efecto lateral encontrado al correr la suite
  completa (no solo el archivo tocado): `executeReadFile` calculaba `relative(root, target)` con
  el `root` crudo, no su realpath; en hosts donde `tmpdir()` cuelga de un symlink (`/var` en
  macOS) eso produce un relativo con `..` espurios que el segundo `resolveProjectPath` rechaza
  como inseguro. Corregido exportando `realRoot()` de `path-policy.ts` y usándolo para el relative.
  Fixtures: symlink externo → `[PLAN.md not found in this project]`, `rejected`, contenido nunca
  visible; symlink interno → se lee normal, `succeeded`; archivo ausente → sentinel, `failed`.
  `bunx tsc --noEmit` limpio; `bun run test:coverage`: 1303 pass / 0 fail (incluye los dos tests
  de R.2 que este cambio casi rompía — detectados por la suite completa, no por el archivo nuevo
  solo). No aplica gate de navegador: `chat.ts` no está en `LIVE_GATE_PATHS`.

<a id="bloque-r-r-3"></a>
### R.3 — ⚡ QA exige correspondencia uno a uno con los criterios originales.
 (2026-09-07, Codex)
  Reproducido ejecutando el parser existente: dos copias aprobadas de «criterio A», con evidencia
  literal y cantidad esperada 2, producen `pass`. `qa.ts:166` recibe únicamente cardinalidad,
  por lo que no puede validar identidad ni detectar que falta B. Pasar las identidades originales
  y exigir un resultado por criterio, sin duplicados, extras ni sustituciones; conservar la
  comprobación de evidencia literal. Validar cada elemento antes de acceder a sus propiedades.
  **Gate:** A+A frente a A+B falla; faltante, extra, desconocido, null y estructura malformada
  fallan de forma segura; A+B válido pasa. Typecheck, tests relevantes y mutation QA acotado
  según el protocolo. No usar coincidencia semántica de otro LLM para validar identidades.
  **Alcance de implementación 2026-09-07 (Codex):** `runQA` pasa textos originales al
  parser; comparación literal en el orden ya exigido por el prompt, originales únicos y no
  vacíos. Validación de cada elemento y evidencia literal preservada. Un único JSON completo
  (opcionalmente fenced), sin extraer objetos de wrappers malformados. No cambia harness,
  política de reintentos, ni parsers adversarial/refutador. El vault no devolvió insights nuevos.
  **Cierre verificado (2026-09-07):** implementación en `qa.ts` y regresiones
  en `qa-core.test.ts`. Typecheck limpio; 66 tests QA y `test:coverage` 1322 pass / 0 fail
  (funciones 75.82%, líneas 64.42%); `security:gate` PASS. Mutación final:
  `bun run mutation:qa --mutate 'src/run/qa.ts:156-257' --tempDirName <tmp-vacío-propio> --concurrency 2`:
  156 mutantes, 71 killed, 16 survived, 69 CompileError; score 81.61%, cero timeouts.
  Los mutantes que fuerzan a true/false la comparación de identidad o la condición de evidencia
  son killed; no se reclama 100%: sobreviven variantes de fences, diagnósticos, guards redundantes
  y casos no cubiertos (incluido cambiar el fallback de archivo ausente por texto no vacío).
  Reporte local `reports/mutation/mutation.json`; log `/tmp/orchestos-r3-final-mutation.log`.
  Stryker avisa sobre el HTML inválido intencional de `evals/html-inline-script-syntax`, fuera
  del rango mutado; el dry run y la mutación terminan con exit 0. No se alteraron sus reglas.
  El formato heredado de `src/dashboard/__tests__/chat-sessions.test.ts` del commit R.1 `27768e9`
  fue corregido de forma mecánica, con autorización de Carlos, sin cambiar comportamiento.
  `bun run lint` quedó sin errores; los warnings/información preexistentes de Biome no se
  presentan como fallos. R.3 se commitea junto con ese único ajuste de formato.

<a id="bloque-r-r-3-bis"></a>
### R.3-bis — ⚡ Validar el envelope completo de QA adversarial/refutador.
 (2026-09-07, Codex)
  reproducido con proveedores sintéticos (2026-09-07): un array JSON con un objeto interno
  produce `VERIFIED` en `runAdversarialQA` y `REFUTED` en `runRefuter`; ambos extraen las
  llaves antes de validar la forma exterior. No corregido dentro de R.3. Aplicar parseo del
  payload completo y conservar sus fallbacks opuestos (adversarial: REFUTED; refutador:
  CONFIRMED). Gate: arrays con objeto, strings JSON, truncados, múltiples objetos y fences
  válidos; nunca invertir un fallo por extraer un objeto desde una respuesta malformada.
  **Implementación y gate:** `parseCompleteJson()` centraliza un único payload JSON completo,
  con fence opcional exacto, para QA normal, adversarial y refutador. Arrays, strings JSON,
  truncados, múltiples objetos, prose adicional y fence con sufijo se rechazan. Los fallbacks
  se preservan: adversarial → `REFUTED`; refutador → `CONFIRMED`. Tests sintéticos cubren las
  siete formas malformadas para ambas rutas y el fence válido preexistente. `tsc`, 68 tests QA,
  `test:coverage` 1324 pass / 0 fail (funciones 75.84%, líneas 64.42%), `security:gate` PASS y
  lint sin errores. Se intentó mutación sobre los tres parsers; el entorno terminó el proceso
  tras el dry run con señal 143. No es gate de R.3-bis y no se usa como evidencia de cierre.

<a id="bloque-r-r-4"></a>
### R.4 — ⚡ Aislar respuestas y restauración por conversación.
 (2026-09-07, Codex)
  Carrera identificada por código, pendiente de reproducción: `app.js:298/335` reemplaza el
  historial global tras un fetch; `screens-core.js:701` agrega respuestas al mismo historial
  aunque el usuario haya cambiado de sesión. El polling también restaura mensajes durante envíos.
  Capturar la sesión de cada operación y aplicar resultados solo al destino correspondiente;
  manejar respuestas obsoletas, carga, cambio/borrado de sesión y mensajes en vuelo. Conservar
  metadatos de tareas retenidas al restaurar, sin convertirlas en tareas ejecutándose.
  **Gate:** respuestas demoradas deliberadamente, enviar en A y abrir B, abrir A/B rápidamente,
  polling durante envío, recargar y borrar sesión durante petición. Nunca aparece respuesta de A
  en B ni se pierden mensajes pendientes por un fetch viejo. Test de carrera + navegador real.
  **Implementación y gate:** `chatHistories` y `chatPendingBySession` separan el estado por id de
  conversación; cada envío captura su `sessionId` antes de esperar y aplica su respuesta solo a
  ese cache. Los restores llevan un epoch por sesión y se descartan mientras hay un mensaje
  optimista pendiente; borrar una sesión invalida su cache y bloquea que una respuesta tardía lo
  recree. La restauración conserva `taskId` de cada mensaje sin iniciar tareas.
  **Gate en vivo:** Playwright contra el dashboard real en `:50921` demoró restore y respuesta de A, abrió B durante
  el envío y confirmó que B no mostraba ni `MENSAJE_A` ni `RESPUESTA_A`; al volver a A estaban los
  dos mensajes y ya no quedaba `Thinking…`. Un segundo caso borró la sesión durante la petición:
  id actual `null`, cache vacío y ningún mensaje tardío visible. `tsc`, 9 tests de chat, lint sin
  errores y `test:coverage` 1324 pass / 0 fail.

<a id="bloque-r-r-5-ter"></a>
### R.5-ter — 🧠 Corregir concurrencia, reserva previa y confirmaciones restauradas.
 (2026-09-08, Codex)
  GO explícito de Carlos (2026-09-08) tras revisión independiente de R.5/R.4-bis.
  Hallazgos reproducidos: claves distintas admiten dos pending en una sesión; un dueño anterior
  puede sobrescribir el turno de otro. Por código: reserva posterior a createTaskRecord deja una
  ventana de duplicación; una lista de tareas vacía resucita confirmaciones canceladas al recargar.
  **Alcance:** serializar claims por sesión; turnos vencidos quedan interrupted sin reejecución;
  commits/reservas requieren dueño y lease vigente; reservar un ID fijo antes de crear la tarea
  y rechazar colisiones sin renombrarlo; distinguir tareas cargadas vacías de carga pendiente.
  Propagar fallos de commit al HTTP es necesario para que el fencing no devuelva éxito ficticio.
  **Gates:** typecheck, tests aislados de concurrencia multiproceso/owner/rollback/reserva,
  regresión de restore y dashboard+navegador real+SQLite, cobertura y lint.
  **Fuera:** R.6/R.7/R.8, rediseño de legacy/adjuntos y cierre global H.9.4. Los cierres históricos
  siguientes se conservan; este seguimiento corrige su alcance sin afirmar fiabilidad completa.
  **Fuera de scope declarado:** `src/dashboard/public/i18n.js`: el aviso de interrupción debe
  declarar resultado desconocido en vez de recomendar reenviar a ciegas. Normalización mínima
  de formato heredado en este archivo y `app.js`, requerida por lint, sin cambios adicionales.
  **Implementación:** claims serializados con `transaction.immediate()`; una clave nueva en
  sesión ocupada devuelve 409 y una clave vencida queda interrupted sin retomar proveedor/tarea.
  Success/failure/reserva validan owner+pending+lease antes de escribir; el dispatch también
  comprueba dueño vigente. `finishTurnSuccess` propaga el fallo de commit (antes lo ocultaba).
  Reserva `chat-<turn-id>` anterior a createTaskRecord, colisiones 409 sin renombrar. El render
  distingue `tasksStatus`/error de YAML de una lista vacía confirmada; el aviso de interrupción
  ya no invita a repetir sin revisar. SQLite conserva schema v6: no hizo falta otra migración.
  **Pruebas:** cuatro procesos independientes → un claim y tres session-busy; nueve escrituras
  de dueños incorrectos/vencidos/finalizados rechazadas sin runs/mensajes; HTTP concurrente y
  replay sin más llamadas; trigger entre run/mensajes → rollback y HTTP 5xx; trigger de reserva
  → tasks.yaml intacto; colisión y reintento vencido no crean otra tarea. Test de renderer carga
  el JS real (no copia su algoritmo). `bunx tsc --noEmit`, lint y `security:gate` PASS;
  `bun run test:coverage`: **1341 pass / 0 fail**, funciones 74.53%, líneas 63.09%.
  **Gate en vivo:** dashboard :50923 + navegador Chromium via agent-browser, bajo gate:evidence.
  Composer/Send real → Claude haiku-4-5 → HTTP 200, texto R5_VERIFICADO; peticiones simultáneas
  misma/otra clave → 409/409. Replay 200 conserva texto/modelo; SQLite verifica un turno
  completed, un run enlazado y dos mensajes, visibles tras recargar. Cancelar la última tarea
  held mediante click → /api/tasks vacío → recarga sin tarjeta, mensajes/OCR preservados.
  Reserva sintética vencida → retry 409, interrupted durable y banner separado en navegador.
  Reporte portable: `scripts/r5-review-evidence.json`; capturas/DB/HTTP locales en
  `/tmp/orchestos-r5-evidence.AqRW1z`. El wrapper exportó cero runs porque excluye chat; el
  reporte conserva evidencia antes del cleanup. Servidor y navegador cerrados.
  **Límites:** las pestañas de sesión requirieron click DOM por una superposición previa de
  chat-area; Send/Cancel sí se probaron por puntero. No se afirma kill/restart ni dispatch real
  de tareas en este gate. Lease fijo de 150s sin heartbeat: resultados tardíos se rechazan.
  Reenvíos deliberados con otra clave, legacy y H.9.4/R.8 siguen fuera del cierre de este ítem.

<a id="bloque-r-r-5"></a>
### R.5 — 🧠 Persistencia coherente de turno, run y fallos de chat.
 Cerrado 2026-09-08
  (Claude + Codex `gpt-5.6-terra`, GO explícito de Carlos, decisiones 11-12 + render + gate en
  vivo — decisiones 1-10 y R.5-bis ya estaban cerradas antes de esta pasada).
  - **Decisión 11 (recuperación tras recargar):** `getLastTurn(sessionId)` (`db/chat-turns.ts`)
    + `GET /api/chat/sessions/:id/turn-status` (`chat-sessions.ts`, cableado en `server.ts`) —
    `{kind:'none'|'pending'|'failed'|'interrupted'}`. `pending` con lease vencida se reporta
    como `interrupted` (nadie lo reclamó; `beginTurn()` lo reconcilia recién en el próximo
    envío, no antes). No reconstruye el texto original del usuario — la decisión 5 solo guarda
    el fingerprint, no el mensaje; el cliente muestra un estado genérico, nunca contenido
    inventado. Frontend: `app.js` (`fetchChatTurnStatus`, cableado en `fetchAll()` cada 30s y en
    `switchChatSession()`) + `st.chatTurnStatus` por sesión.
  - **Estados separados de mensajes (hallazgo #11 original):** `screens-core.js` — banner
    `.chat-turn-banner` (pending/failed/interrupted) ya NO es un `.chat-msg`/`.chat-bubble`, no
    puede confundirse con una respuesta assistant real. Los dos paths de error locales del
    `send()` (fallo HTTP del servidor, catch de red) dejaron de hacer `appendChatMessage(role:
    'assistant', ...)` — ahora setean `st.chatTurnStatus[sessionId]`, mismo banner que la
    recuperación tras recargar. Un nuevo envío limpia el banner previo (`kind:'none'`) antes de
    mandar el mensaje.
  - **Decisión 12 (legacy sin `sessionId`):** ya estaba cerrada en el código (comentario
    explícito en `chat.ts:741`, `activeTurnId` queda `null` sin sesión) — esta pasada la fijó
    con un test de regresión real (mock de `fetch`, sin sessionId, `SELECT COUNT(*) FROM
    chat_turns` = 0) para que no se rompa en silencio.
  - **Gate en vivo:** navegador real (Chromium vía `playwright-core`), servidor real,
    `ORCHESTOS_HOME` temporal migrado, sin mocks de test.
    turno `pending` reclamado directo en SQLite con lease de 120s → `GET turn-status` responde
    `pending` → navegador real (Chromium vía `playwright-core`) confirma el banner
    `.chat-turn-pending` en el DOM. Turno con lease de 4s dejado vencer → `interrupted` en vivo,
    confirmado también en el navegador (banner `.chat-turn-interrupted`). **Reinicio real del
    servidor** (`kill -9` + relanzar el proceso) con el turno `pending` de 120s todavía en
    vuelo → `GET turn-status` tras el restart sigue devolviendo `pending` con el mismo `turnId`,
    confirmado además por consulta SQLite directa (`chat_turns.status`) — la persistencia
    sobrevive al proceso, no vive en memoria. POST `/api/chat` real sin `sessionId` contra el
    servidor vivo confirmó `chat_turns` en 0 filas antes/después (decisión 12 en vivo, no solo
    en test). Servidor bajado al cerrar.
  - Codex (`gpt-5.6-terra`, delegado por acuerdo explícito de Carlos) escribió los tests de
    regresión sobre el contrato ya cerrado por Claude (`getLastTurn`, los 7 casos de
    `turn-status`, decisión 12) — diff revisado línea por línea antes de aceptar, sin tocar
    producción ni `PLAN.md`. `bunx tsc --noEmit` limpio; `bun run test:coverage`: 1335 pass / 0
    fail, gates de cobertura verdes (funciones 74.59%/lines 63.20%, ambos sobre el mínimo).
  **Fuera de scope declarado:** `src/dashboard/server.ts` (una línea de ruteo para el endpoint
  nuevo), `src/dashboard/public/i18n.js`/`screens.css` (textos y estilos del banner nuevo) y
  `.orchestos/feature-status.json` (regenerado automáticamente por el pre-commit desde este
  mismo PLAN.md) no estaban en el scope-lock original — necesarios para cablear la ruta y
  pintar el banner de la decisión 11, no se anticiparon al declarar el scope.
  **Traspaso 2026-09-07 (Codex, GO explícito de Carlos):** diagnóstico completo en
  [docs/done/design/r5-persistence-handoff.md](docs/done/design/r5-persistence-handoff.md), base `8ad2d46`. Sin cambios
  de runtime — preflight, typecheck y 9 tests baseline pasan (no prueban atomicidad/reintentos).
  Knowledge radar: sin insights aplicables al momento del traspaso. Hallazgos por revisión de
  código, no sondas de fallo en producción — no se ejecutaron proveedores/tareas/migraciones
  reales ni el gate H.9.4.

  **Qué está roto (12 hallazgos):**
  1. `chat.ts:442` `logChatRun()` traga errores de `insertRun()` sin comunicarlos; puede llegar
     a HTTP 200 con mensajes persistidos y evidencia perdida.
  2. `chat.ts:1031` `persistResponse()` llama aparte a `appendChatExchange()`: un run `done`
     puede quedar sin sus mensajes si falla ese segundo paso.
  3. `db/chat-sessions.ts:157`: la transacción cubre solo 2 mensajes/título/fecha, no hay turno
     durable antes de llamar al proveedor; sin respuesta no queda ni el mensaje del usuario.
  4. `db/runs.ts:88` `insertRun()`: solo estados done/blocked/failed — no ampliar sin revisar
     todos los consumidores.
  5. Rama Ollama (`chat.ts:~1234`) persiste mensajes pero omite el run; no inventar tokens/costo
     medidos al incorporarlo (el cálculo canónico es R.6).
  6. Registro de fallo desigual entre transportes: Claude solo si trae readAudit, API tool-loop
     con snapshot incompleto; Codex/OpenCode/Ollama/API plana sin registro equivalente.
  7. `chat.ts:780-829`: `buildNaturalDraft→createTaskRecord→spawnTaskRun` ocurre ANTES del
     proveedor y de persistir — una respuesta fallida puede coexistir con una tarea ya corriendo.
     `handlers/tasks.ts:251` renombra un id repetido con `Date.now()`: reenviar no es idempotente.
  8. No hay request/turn id durable; `chatPendingBySession` es memoria de una pestaña, no
     coordina procesos ni sobrevive a recarga.
  9. `session?.project_id ?? project.id` puede reemplazar un null explícito de sesión general
     por el proyecto fallback — distinguir sesión general/existente de request legacy.
  10. DELETE en cascada sin vínculo a runs; el handler captura `session` antes de un await —
      borrar a mitad de request puede insertar el run y fallar después en `appendChatExchange`.
  11. `screens-core.js:749-772`: errores HTTP/red se agregan como mensajes assistant locales y
      desaparecen al restaurar — deben ser estado/error del turno, no una respuesta atribuida.
  12. `chat.ts:113/836`: adjuntos en un Map con expiración; un id ausente se filtra sin avisar —
      no reintentar en silencio con adjuntos perdidos.

  **Diseño propuesto (sin implementar; decisiones a cerrar en código, no ya entregadas):**
  1. Migración nueva vía `FUTURE_MIGRATIONS` (`db/migrate.ts`); conservar legacy sin inferir
     asociación por timestamp/texto/modelo.
  2. Tabla `chat_turns`: identidad durable, session/project, clave de petición única, fingerprint
     de entrada, estado (pending/completed/failed/interrupted), owner/lease, enlace al run. La
     identidad de petición existe antes del primer POST; un reintento no resetea evidencia previa.
  3. Servicio único `db/chat-turns.ts` (nuevo): begin/claim/complete/fail/get/recover. Misma
     clave+misma entrada → resultado durable o pending; misma clave+otra entrada → 409.
  4. Transacción final única: insertRun + enlace al turno + mensajes + estado completed —
     nunca envolver un await de red/proceso en `db.transaction()`.
  5. Guardar la entrada al aceptar el turno; ante caída entre proveedor y commit, dejar
     desconocido/interrumpido — nunca reejecutar automáticamente.
  6. Los 6 transportes (Claude/Codex/OpenCode/Ollama/OpenRouter tool-loop/OpenRouter plano)
     terminan en el mismo servicio, sin tocar semántica unknown/uninstrumented de readAudit.
  7. Envelope de replay: texto/modelo/OCR/taskSuggestion/autoTask (held/existingFiles)/readAudit/
     turnId/runId — el replay reproduce lo guardado, sin re-ejecutar efectos.
  8. Tareas: reservar id/intención antes de crear; creación y dispatch como fases recuperables.
     SQLite+YAML+git+spawn no son una transacción — ante interrupción, reconciliar y reportar
     desconocido, sin spawn automático. No absorber la escritura atómica global de R.7.
  9. Definir dueño/lease con expiración condicional — evita que un proceso marque `interrupted`
     sobre el turno de otro proceso vivo; el vencimiento solo habilita reconciliar, no reintentar.
  10. DELETE: elegir una política (rechazar con 409 si hay turno activo, o tombstone con
      evidencia desvinculada) y probarla end-to-end — no tocar el CASCADE a ciegas.
  11. Cliente: persistir identidad de petición por conversación; tras recarga/error de red,
      consultar el turno antes de reenviar; mostrar pendiente/fallido/interrumpido aparte.
  12. Legacy sin sessionId: turno con session nullable o migración explícita, con compatibilidad
      probada — no ignorar requests legacy que aún ejecutan tareas.

  **Secuencia sugerida:** releer preflight/git status (este documento es evidencia en `8ad2d46`,
  no snapshot eterno) → concretar decisiones de claim/lease/delete/retry/reserva de tarea →
  migración+servicio con tests de transacción/restricciones/datos históricos → cablear los 6
  transportes y efectos de tarea, contratos API y frontend de recuperación → gates reproducibles
  y en vivo, solo entonces marcar cierre. Archivos esperados: `migrate.ts`, `db/chat-turns.ts`
  (nuevo), `db/chat-sessions.ts`, `db/runs.ts` si aplica, `handlers/chat.ts`,
  `handlers/chat-sessions.ts`, `dashboard/types.ts`, `server.ts` si se añade endpoint,
  `llm/clients.ts`, `public/app.js`, `public/screens-core.js`, copy i18n; posibles helpers en
  `handlers/tasks.ts` manteniendo R.7 separado. No introducir un framework de orquestación.

  **Pruebas necesarias para cerrar** (detalle completo en el doc): migración aplicada dos veces
  + recuperación tras fallo, mensajes antiguos intactos; trigger que aborte entre insertRun y
  mensajes → rollback total, cero HTTP 200; dos procesos con la misma clave → una sola invocación
  de proveedor; claves distintas simultáneas en una sesión → orden/rechazo consistente; mismo
  request con payload distinto → conflicto sin proveedor/tarea adicional; interrupción entre
  claim/proveedor/commit → interrupted/unknown sin duplicar; caída tras creación YAML y tras
  spawn → ninguna segunda tarea/ejecución automática; borrado en vuelo + owner concurrente;
  held/existingFiles y OCR sobreviven recarga; adjuntos expirados no se omiten en reintentos;
  unitarios en procesos aislados o inyección de dependencias (evitar `mock.module` global).
  Cierre exige `tsc`, suites relevantes, `test:coverage`, lint, `security:gate` si toca
  frontera/redacción, y **gate en vivo** (dashboard + navegador + consulta SQLite real, las
  demoras/mocks sirven para la carrera determinista pero no sustituyen esto) — H.9.4 sigue
  siendo gate independiente del bloque R.

  **Gate:** inyección de fallo entre escrituras, respuesta fallida, reintento duplicado, reinicio,
  sesión general y proyecto; asociación inequívoca turno/run, ausencia de éxito silencioso sin
  evidencia y tratamiento explícito de fallos. Tests + dashboard/navegador real y consulta SQLite.

  **No ampliar esta pasada a:** R.6 (costo canónico), R.7 (escritura atómica de `tasks.yaml`),
  ni a los contratos de prompt hacia CLIs (systemPrompt/combinedText vs `messages` de API, sin
  verificar primero sus executors). Lo hallado sobre R.4 durante este diagnóstico queda en R.4-bis.

  **Avance 2026-09-07 (Claude + Codex `gpt-5.6-terra`, GO explícito de Carlos, alcance acordado:
  decisiones 1-9, sin DELETE ni frontend — R.5 sigue abierta):**
  - Migración v5 (`chat_turns`: request_key/input_fingerprint UNIQUE por sesión, status,
    owner/owner_expires_at, run_id, response_envelope_json) y servicio `db/chat-turns.ts`
    (`beginTurn`/`commitTurnSuccess`/`commitTurnFailure`/`getTurn`/`getTurnByRequestKey`/
    `parseTurnEnvelope`) — implementados por Codex sobre un contrato de firmas cerrado antes de
    delegar (decisiones 1-3). Revisado por Claude antes de integrar: `beginTurn` usa
    `INSERT OR IGNORE` bajo el UNIQUE index como fuente real de atomicidad (no
    select-then-insert), reconcilia leases vencidos acotado a la sesión, distingue
    claimed/duplicate-pending/duplicate-result/conflict. `commitTurnSuccess`/`commitTurnFailure`
    envuelven insertRun+appendChatExchange+update del turno en una sola `db.transaction()`
    (decisión 4) — probado con rollback real (JSON.stringify de un BigInt fuerza el fallo:
    cero run, cero mensajes, turno sigue `pending`).
  - Codex reportó honestamente que su propio `test:coverage` dio 126 fallos `SQLITE_READONLY`
    y no declaró el gate verde sin evidencia — reproducido por Claude en entorno limpio: **no
    se confirmó, era del sandbox de esa sesión de Codex** (1330 pass / 0 fail, gate de cobertura
    verde). Diff revisado línea por línea antes de aceptar el trabajo, no solo el resultado del
    test.
  - Cableados los 6 transportes (`handlers/chat.ts`: Claude CLI, Codex CLI, OpenCode CLI, Ollama,
    OpenRouter tool-loop, OpenRouter plano) al servicio: `logChatRun()`+`persistResponse()` (dos
    escrituras separadas, el hallazgo central de R.5) reemplazados por `finishTurnSuccess()`/
    `finishTurnFailure()` — atómicos vía `commitTurnSuccess`/`commitTurnFailure` cuando hay turno
    reclamado (sesión con `sessionId`); camino legacy sin sesión conserva el comportamiento previo
    exacto (decisión 12, sigue pendiente para fase 2). Hallazgo #6 cerrado: Codex CLI, OpenCode
    CLI y el plano de OpenRouter ahora sí dejan evidencia en sus catches — antes solo Claude CLI
    lo hacía. Hallazgo #5: Ollama declara input/output tokens en 0 (dato desconocido real, no
    inventado) en vez de omitir el run por completo.
  - `beginTurn` corre justo tras validar `fileIds`, antes de cualquier `return` posible —
    `finishTurnFailure` se definió en ese mismo punto (no más abajo, donde antes vivía
    `persistResponse`) para que ningún `return errorResponse` temprano (mismatch
    sesión-local/modelo-ollama, fallo de OCR, contexto insuficiente) deje un turno `pending`
    huérfano sin resolver.
  - `requestKey`: `screens-core.js` (`send()`, delegado a Codex `gpt-5.6-luna`, diff mínimo
    verificado) ahora genera `crypto.randomUUID()` por envío y lo manda en el body. Cierra la
    protección contra un reintento de red inmediato con el mismo mensaje; no implementa un botón
    de "reintentar" explícito ni recuperación tras recargar con un turno en curso — eso sigue
    siendo la Fase 2 (decisión 11 completa).
  **Gate en vivo:** navegador real (Chromium vía playwright-core), servidor real, DB migrada
  limpia. Click real en `[data-act="chat-new-session"]` → escribir y enviar un mensaje real →
  red interceptada del POST real a `/api/chat`: body trae `requestKey` con forma de UUID
  (`b3c630d7-1f85-45f7-ad5c-b75681f5c3b1`) — confirmado que el campo sale desde el navegador,
  no solo que el servidor lo acepta. Servidor bajado y estado temporal limpiado al cerrar.

  **Pendiente explícito para cerrar R.5** (no se afirma cerrado): decisiones 11-12 completas
  (recuperación de un turno en curso tras recargar, estados pendiente/fallido/interrumpido
  separados de mensajes en el render — hoy un fallo sigue apareciendo como mensaje assistant),
  y el **gate en vivo real** (dashboard + navegador + consulta SQLite, dos procesos concurrentes,
  reinicio real del servidor) — no tiene sentido verificarlo a medias. Ver R.5-bis para lo que
  ya se cerró de este mismo diagnóstico (decisiones 8 y 10).

<a id="bloque-r-r-5-bis"></a>
### R.5-bis — 🧠 R.5: política de DELETE y reserva de tareas (decisiones 8 y 10).
 Cerrado
  2026-09-08 (Claude + Codex `gpt-5.6-luna`, mismo alcance de R.5, GO explícito de Carlos:
  "avancemos con lo siguiente... no dudes de la capacidad de Codex").
  - **Decisión 10 (DELETE):** `hasActiveTurn(sessionId)` (`db/chat-turns.ts`) — un turno
    `pending` con lease vigente es trabajo en vuelo; `handleApiChatSessionDelete` devuelve 409
    en vez de dejar que el CASCADE se lleve `chat_turns`/`chat_messages` sin que nadie lo viera.
    Sin tombstone: un turno terminal o con lease ya vencido no bloquea el borrado.
  - **Decisión 8 / hallazgo #7 (reserva de tareas):** migración v6 agrega `chat_turns.task_id`.
    `reserveTurnTask(turnId, taskId)` graba la tarea apenas `createTaskRecord()` tiene éxito,
    ANTES de `spawnTaskRun()` — si el proceso muere entre crear y correr, un reclamo posterior
    del MISMO turno (lease vencido, mismo `request_key`+fingerprint) ve `activeTurn.task_id` ya
    seteado y reporta esa tarea en vez de crear una segunda. SQLite+YAML+git+spawn siguen sin
    ser una transacción — esto no lo cambia, pero cierra el caso concreto de duplicación que el
    hallazgo señalaba. No reconstruye held/existingFiles del intento anterior (se reporta solo
    el id; el estado real se consulta contra `tasks.yaml`, no se asume).
  - **`requestKey` en frontend** (parte de la decisión 11): `screens-core.js` (`send()`,
    delegado a Codex `gpt-5.6-luna`, diff mínimo verificado) genera `crypto.randomUUID()` por
    envío y lo manda en el body. Cierra la protección contra un reintento de red inmediato con
    el mismo mensaje; no implementa un botón de "reintentar" explícito ni recuperación tras
    recargar con un turno en curso — eso sigue siendo la decisión 11 completa, en R.5.
  - `bunx tsc --noEmit` limpio; `bun run test:coverage`: 1332 pass / 0 fail (incluye el test de
    reclamo-tras-expirar-lease-conserva-la-reserva y el de DELETE bloqueado/permitido).
    `migration.test.ts` actualizado a v6 (mismo ajuste mecánico que R.4-bis con v4).
  **Gate en vivo:** navegador real (Chromium vía playwright-core), servidor real, DB migrada
  limpia. Click real en `[data-act="chat-new-session"]` → escribir y enviar un mensaje real →
  red interceptada del POST real a `/api/chat`: body trae `requestKey` con forma de UUID
  (`b3c630d7-1f85-45f7-ad5c-b75681f5c3b1`) — confirmado que el campo sale desde el navegador,
  no solo que el servidor lo acepta. Servidor bajado y estado temporal limpiado al cerrar.
  DELETE/reserva de tareas cubiertos por los tests de servicio (fixtures deterministas de
  lease/reclamo), no requieren navegador — el hallazgo que motivaban no era de UI.

<a id="bloque-r-r-4-bis"></a>
### R.4-bis — 🧠 Seguimiento de R.4: restore no invalida epoch en todos los casos.
 Cerrado
  2026-09-07 (Claude). Hallazgo por código durante el diagnóstico de R.5 (2026-09-07, Codex) — no
  reproducido en vivo en su momento, R.4 seguía cerrada; esto fue seguimiento, no reapertura.
  Un restore iniciado antes de un envío y resuelto después de terminarlo podía superar el guard
  `pending` sin invalidar su epoch al agregar mensajes. Borrar la sesión activa no limpiaba
  `chatPending`. La restauración convertía el `task_id` persistido de una tarea `held` en
  `taskId` normal, perdiendo `pendingTask`/OCR. El gate documentado de R.4 usaba fetch simulado en
  navegador — no probaba la persistencia real de estos tres casos.

  **Fix 1 (epoch):** `send()` (screens-core.js) incrementa `chatFetchEpochs[sessionId]` al agregar
  el mensaje optimista del usuario — invalida cualquier restore en vuelo lanzado antes de ese envío,
  para que una respuesta tardía del GET `/messages` no sobrescriba el turno recién enviado.

  **Fix 2 (chatPending):** `deleteChatSession()` (app.js) pone `state.chatPending = false` cuando
  la sesión borrada es la activa — antes solo limpiaba el mapa por-sesión, dejando el booleano
  global (el que deshabilita el composer) bloqueado para siempre si se borraba a mitad de un envío.

  **Fix 3 (taskHeld/existingFiles sobreviven recarga):** migración v4 (`chat_messages` +
  `task_held`, `existing_files`); `appendChatExchange`/`persistResponse` los persisten;
  `fetchChatSession` los reconstruye como `pendingTask`, manteniendo la exclusión mutua con
  `taskId` que ya regía en vivo (una tarea held nunca dispara `renderStepsCard`). El render
  filtra `pendingTask` contra el estado real de la tarea (`st.tasks`, status `pending`) para no
  resucitar el control [Ver]/[Cancelar] de una tarea ya cancelada o ya corrida — `st.tasks` vacío
  se trata como "aún no cargó" para no parpadear justo al crear la tarea en vivo.

  **Verificación:** `bunx tsc --noEmit` limpio; `bun run test:coverage`: 1325 pass / 0 fail
  (incluye round-trip de persistencia `taskHeld`/`existingFiles` y la actualización de
  `migration.test.ts` a la nueva versión v4 del ledger).

  **Gate en vivo:** navegador real (Chromium vía playwright-core), servidor real, DB migrada
  limpia, fixtures de datos vía los mismos servicios de dominio (`createChatSession`,
  `appendChatExchange`) en vez de un LLM real — sin mocks del wiring HTTP/DOM. Los tres casos:
  (1) `page.route()` demora 4s el GET `/messages` de un restore ya en vuelo; se envía un mensaje
  real que completa antes; al llegar el restore tardío, el mensaje enviado sigue visible —
  confirmado `true`. (2) `page.route()` demora 3s el POST `/api/chat`; a mitad de esa espera se
  invoca `App.deleteChatSession()` real (con su modal de confirmación real); el composer queda
  habilitado de inmediato y sigue habilitado cuando la respuesta demorada por fin llega —
  confirmado `true`. (3) sesión y tarea held creadas vía los servicios reales (tarea real con
  `status: pending`, apuntando a `PLAN.md` como archivo existente); recarga completa de la
  página; la tarjeta `[data-confirm-task]` aparece en el DOM — confirmado `true`.
  Estado de prueba (DB temporal, entrada temporal en `tasks.yaml` real sin commit) limpiado al
  cerrar; servidor bajado.

<a id="bloque-r-r-6"></a>
### R.6 — ⚡ Costo del chat separado de la etiqueta visual del modelo.
 Cerrado 2026-09-09.
  Reproducido: `calcCost('claude-sonnet-5 via Claude Code CLI', ...)` devuelve cero. El caller
  pasa `resultLabel` a `logChatRun()` y descarta `result.usd` disponible en el executor.
  Persistir identificador canónico y costo reportado cuando exista, conservando el label como
  presentación; distinguir costo reportado/estimado/desconocido y cero real. Evitar que etiquetas
  no reconocidas produzcan importes con apariencia de medición válida. Coordinar con R.5.
  **Gate:** costo CLI reportado se conserva; label/effort no alteran el cálculo; modelo desconocido
  no se presenta como gratuito. Verificar DB y consumidor de costos, sin rediseñar toda la UI.
  **Estado en vuelo (2026-09-08, Codex):** implementación y pruebas dirigidas completadas: `bunx tsc --noEmit` y
  `bun test src/__tests__/claude-chat.test.ts src/dashboard/__tests__/chat-sessions.test.ts src/dashboard/__tests__/chat-r5-reliability.test.ts`
  pasaron (30/30). El modelo canónico y `cost_breakdown_json.source` separan `reported`/`estimated`/`unknown`;
  el consumidor de runs muestra `unknown`, no `$0`. No cerrar: `bun run lint` falla fuera del scope con 2 errores
  globales (más advertencias existentes) y `bun run test:coverage` no completó en esta sesión; falta gate de
  dashboard real/navegador y los gates completos antes de commit.
  **Evidencia parcial 2026-09-09:** `bun run test:coverage` ✅ (1360 pass / 0 fail). Bajo
  `gate:evidence`, el dashboard aislado recorrió fixture CLI local → SQLite → Runs API: el stream con
  `total_cost_usd: 0.0123` guardó `claude-sonnet-5`, `source: reported` y `$0.0123`; un modelo sin precio
  expuso `costSource: unknown` y `costUsd: null`. Reporte reproducible:
  `scripts/r6-live-cost-evidence.json`; el wrapper exportó cero filas como corresponde porque excluye chat.
  **No es cierre:** CUA no pudo iniciar navegador y Playwright no está disponible en este workspace; falta
  observar esas dos filas en la pantalla Runs mediante navegador real. `bun run lint` continúa bloqueado por
  diagnósticos preexistentes fuera del scope.
  **Gate visual completado, cierre aún bloqueado:** se agregó `playwright` como devDependency y Chromium local para que el gate no dependa de un
  scratchpad. **Gate en vivo:** `scripts/r6-live-cost-evidence.json` registra la corrida aislada con
  `PATH="$PWD/scripts/fixtures:$PATH" bun run gate:evidence -- --label r6-cost -- bun run scripts/live-r6-cost.ts`:
  fixture Claude sin red → dashboard real → SQLite → Runs API → navegador Playwright MCP. El stream reportó
  `$0.0123` para `claude-sonnet-5`, conservado con `source: reported`; una fila de precio no conocido devolvió
  `costSource: unknown`/`costUsd: null`. En la pantalla Runs el navegador mostró exactamente `$0.0123` y
  `unknown`, respectivamente. `bunx tsc --noEmit`, tests dirigidos (30 pass / 0 fail) y cobertura completa
  (1360 pass / 0 fail) pasaron. `bun run lint` continúa rojo por diagnósticos preexistentes: el chequeo
  acotado también reporta 45 warnings y 16 infos en líneas no modificadas de estos archivos, además de los
  diagnósticos globales fuera del scope. No se rebajó ni corrigió ese trabajo ajeno en este ítem. El 400 de
  `/api/chat/models` corresponde al fixture sin key OpenRouter, no al flujo Claude validado.
  **Corrección del diagnóstico y cierre 2026-09-09:** la afirmación histórica de que lint bloqueaba R.6 era
  incorrecta: tras formatear los dos archivos de esta entrega, `bun run lint` terminó con exit 0 (879 warnings,
  493 infos del baseline; sin errores). Se completó la rama legacy sin `sessionId`: ahora pasa el modelo
  canónico a `logChatRun()`, como ya hacía el camino de sesión, y ambos persisten `cost_breakdown_json.source`.
  La prueba de handler real cubre sesión y legacy con fixture CLI fijado antes del spawn: costo reportado
  positivo ($0.0123), cero reportado real, costo estimado ($0.0225 con tokens no nulos) y modelo desconocido;
  SQLite y `/api/runs` preservan modelo canónico y procedencia, y ninguna etiqueta con effort llega al modelo
  guardado. El gate aislado `PATH="$PWD/scripts/fixtures:$PATH" bun run gate:evidence -- --label r6-cost -- bun
  run scripts/live-r6-cost.ts` confirmó los cuatro registros; el artefacto portable es
  `scripts/r6-live-cost-evidence.json`. La pantalla Runs real, recargada, mostró `$0.0123` y `unknown` para los
  dos estados que no se pueden inferir por formato; captura `r6-runs-browser.png`. El wrapper exportó cero runs
  por diseño porque excluye `task_class=chat`; el artefacto versionado conserva la evidencia. Gates finales:
  `bunx tsc --noEmit` ✅; tests dirigidos + R.5 ✅ (31 pass); `bun run test:coverage` ✅; `bun run lint` ✅;
  `git diff --check` ✅. No se tomó R.7/R.8 ni la limpieza global de warnings.
  **Gate en vivo:** navegador Playwright sobre Runs, con recarga y detalle; evidencia staged `scripts/r6-live-cost-evidence.json` (captura `r6-runs-browser.png`).
  **Fuera de scope declarado:** `.orchestos/feature-status.json` es el derivado regenerado por el hook al cerrar R.6; `r6-runs-browser.png` es la captura binaria del gate en vivo.

<a id="plan-orden-r-7"></a>
- [x] **R.7 — 🧠 Escritura atómica y coordinación entre procesos para tasks.yaml.** Prioridad alta. (cerrado 2026-10-02)
  Ejecutado por: luna (2 rondas) · Spec: docs/specs/R.7.md (borrado al cerrar)
  `src/run/file-lock.ts` nuevo (lockfile `pid:token`, se roba solo si el PID murió o, sin PID, por mtime; libera solo
  con token propio); `withGitLock` delega en él. `loader.ts`: `mutateTasks` (lock `.orchestos/tasks.lock` → leer →
  mutar → validar → tmp+fsync+rename) y limpieza de `.tasks.yaml.tmp-*` de PIDs muertos (el sandbox exige working
  tree limpio, `sandbox-policy.ts:55`). Migrados: `handlers/tasks.ts` (crear/run/delete/bulk/approve-split),
  `db/reset.ts`, `init.ts`; `cli.ts` vía `updateTaskStatus`. `commitTasksYaml` queda fuera del lock de tasks (sin anidar).
  Cambio de semántica: un git.lock con dueño vivo ya no se roba a los 60 s (antes podía robarse a mitad de un merge).
  Gate: `src/__tests__/tasks-concurrency.test.ts` con procesos reales (4×25 updates sin pérdida; misma tarea fusiona
  campos y borrada no resucita; 5 `SIGKILL` a mitad de escritura → YAML válido, sin temporales, siguiente mutación
  < 2 s; PID muerto/lock vacío viejo se recuperan; PID vivo → timeout con ruta). `bun run test:coverage` 1589/0;
  `ui:gate tasks chat-turn-details` 13/13 y 27/27 en dashboard real. No cubierto: Windows (rename sobre archivo
  abierto) — CI es ubuntu.
  Riesgo original:
  Riesgo identificado, pendiente de reproducir: `loader.ts:25` comprueba un hash opcional y luego
  sobrescribe el archivo directamente; `tasks.ts:260` guarda antes del lock Git. Dos procesos
  pueden perder actualizaciones y una interrupción puede dejar un YAML incompleto. Diseñar
  exclusión/read-modify-write y reemplazo atómico con recuperación, cubriendo todos los writers;
  mantener tasks.yaml como fuente de verdad. No migrar la cola a SQLite dentro de este ítem.
  **Gate:** dos procesos actualizan tareas distintas sin pérdida; conflicto sobre una misma tarea
  se resuelve o rechaza explícitamente; interrupción en escritura conserva un documento válido;
  recuperación de lock y compatibilidad portable verificadas. Tests con procesos reales aislados.

<a id="plan-orden-r-9"></a>
- [x] **R.9 — ⚡ Los artefactos de OrchestOS no ensucian el árbol del proyecto.** (abierto 2026-09-27, cerrado 2026-09-27, GO de Carlos)
  Visto 2026-09-26 en `project-tabs`: tras un QA fail, el reintento falla con "Worktree sandbox requires a clean
  working tree: ?? runs/" (`src/run/sandbox-policy.ts:68`). `RunLogger` escribe `runs/*.log` en la raíz
  (`src/run/logger.ts:13`) y el chat crea `.orchestos/agent-home/` (`src/run/executors/cli-registry.ts:159`); en un
  proyecto de usuario nada los ignora. Fix: registrar esas dos rutas en `.git/info/exclude` del proyecto (local, sin
  tocar su `.gitignore`) antes de escribirlas. Gate: test con repo temporal (status limpio tras logger + provisión);
  `project-tabs` sin el error en `dashboard.log`; `test:coverage`.
  Ejecutado por: Codex · `gpt-6-luna` (1 ronda) · Spec: docs/specs/R.9.md (borrado al cerrar)
  Evidencia 2026-09-27: `src/run/git-exclude.ts` escribe `/runs/*.log` y `/.orchestos/agent-home/` en
  `info/exclude` desde `RunLogger` y `provisionCliConfigHome`; test con repo temporal: status limpio, idempotente,
  `.gitignore` intacto. `test:coverage` 1547/0 (75.50 %/61.20 %). Gate en vivo `project-tabs` 23/23, `tasks` 13/13,
  `runs-graph` 16/16, 0 "Uncommitted changes" en `dashboard.log` — pero las 3 tareas pasaron QA a la primera: el
  camino QA fail → reintento no se ejerció en vivo, lo cubre el test. Ajuste del cerebro: el mock de
  `claude-chat.test.ts:110` contaba el nuevo `git rev-parse` como sonda de Claude.

## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-r-r-8"></a>
- [x] **R.8 — 🔍 Validación independiente del recorrido útil y corrección de evidencia de cierre.** (cerrado 2026-10-15)
  Depende de R.1–R.7 y H.9.4. Revisar el recorrido completo: proyecto conectado → conversación →
  tarea/confirmación → ejecución → checks/QA → resultado → recarga y evidencia recuperada;
  incluir continuidad del historial hacia CLI, no solo su presencia en la pantalla. Repetir sobre
  un proyecto externo de prueba, declarar transporte/configuración y registrar resultados por
  intento. La utilidad debe contrastarse además con una tarea real de Carlos: resultado utilizado,
  intervención necesaria y bloqueos, no solo número de tests.
  **Corrección documental necesaria:** I.4 conserva abajo su cierre histórico del 2026-09-05,
  pero su evidencia declara «sin navegador/browser interactivo». No acredita el gate visual
  exigido por el protocolo. Su aceptación integral queda pendiente de este bloque; el `[x]`
  histórico no desbloquea por sí solo H.9.4. Adjuntar aquí evidencia nueva sin borrar el historial.
  **Gate:** navegador real y backend/persistencia observados; suite exacta de CI verde; pruebas
  negativas de privacidad y QA; informe de límites restantes. Cuando use home temporal con runs
  reales, ejecutar el wrapper gate:evidence y verificar conservación de la evidencia pertinente.
  **Estado 2026-10-14 (DOC.1):** R.8.1–R.8.6 `[x]` (auto-flow estricto, continuidad historial→CLI, QA negativo,
  reinicio a mitad de run, privacidad sin depender del modelo, pasos que no pueden fallar). Lo que falta es la
  contrastación con una tarea real de Carlos (resultado utilizado, intervención, bloqueos), que cubre ERP.4:
  **R.8 cierra con ERP.4**, con el informe de límites restantes.
  **Cierre 2026-10-15.** Se contrastó con una tarea real de Carlos (ERP.4, cerrado hoy con "sirve, pero todavía no
  solo"). Resultado: un módulo completo con 25 tests. Intervención: 17 arreglos de producto. Bloqueos: los registra
  `docs/done/evidence/ERP.4/`.
  Informe de límites restantes:
  - los del cierre de ERP.4;
  - fiabilidad abierta en gates en vivo: CI.11, CI.18, CI.19, CI.23 y CI.25 (intermitentes, se atienden cuando el
    pre-push los tumba);
  - la nota de I.4 sigue como histórica.
  Sin delegación: ítem padre.

<a id="bloque-r-r-8-1"></a>
- [x] **R.8.1 — 🔍 auto-flow estricto.** (abierto 2026-10-05, GO de Carlos) Exigir `done` (no cualquier estado
  terminal, `auto-flow.mjs:367`), contenido exacto de los archivos producidos, aprobación real (no "sin botón 5 s",
  `:351`) y recarga final que recupere reporte/QA del mismo `taskId`. Incluye el cuelgue intermitente de Codex (CI.11)
  si vuelve a cortar la corrida. Hallazgos 3-4 de `docs/done/evidence/R.8-revision-sol-2026-10-05.md`.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.1.md
  Gate en vivo: `gate:evidence R.8.1-auto-flow` → auto-flow PASS 31/31 (`docs/done/evidence/R.8.1-live.json`):
  `done` exigido, contenido exacto de ambos archivos, Claude arranca sin aprobación (archivo nuevo) y Codex queda
  retenido (archivo previo `codex-nota.md`): `pending` sin `runId` y contenido intacto durante 3 s, arranca tras el
  clic; recarga recupera los dos reportes del mismo `taskId`. Intentos: 1.º FAIL — ninguna petición creó tarea con el
  prompt "con exactamente este contenido, sin comillas ni nada más" (causa no aislada: prompt o azar del modelo; el
  detalle de fallo ahora incluye la respuesta y `git status`); 2.º PASS con "con una sola línea: nota de X".
  No hecho: contraprueba forzando texto esperado erróneo (el 1.º intento sí prueba que el gate falla).
  Límites: QA del reporte → R.8.3; reinicio del backend → R.8.4. Visto: "Loading models…" persiste en el composer
  tras recargar (captura `after-reload`), sin investigar.

<a id="bloque-r-r-8-1-1"></a>
- [x] **R.8.1.1 — 🔍 Marcador de tarea al final de la frase y "Loading models…" tras recargar.** (abierto 2026-10-07, GO de Carlos)
  auto-flow 2/4 corridas: la respuesta `… una sola línea: nota de claude. [[orchestos:task]]` (marcador al final de la
  misma línea) no creó tarea y el marcador quedó visible. Arreglo: el marcador cuenta también al final de la última
  línea (a mitad de frase sigue sin contar); detección y limpieza en una sola función de `chat-live.ts`, incluido el
  prefijo parcial durante el streaming. "Loading models…" bloquea el envío ~5 s tras recargar (`AgentComposer.tsx:130-172`,
  `:249`): medir qué petición es la lenta antes de tocar nada. Fuera: cambiar el prompt (`chat.ts:1267`).
  Gate: tests de marcador; `gate:evidence` auto-flow 3 corridas seguidas + `chat-streaming codex-live`.
  Ejecutado por: Luna (gpt-6-luna) · 2026-10-07 marcador: tests 12/12; `gate:evidence R.8.1.1-auto-flow` 3 corridas
  seguidas PASS 31/31 c/u (en ninguna el modelo puso el marcador al final de la frase: el caso real lo cubren los
  tests); `R.8.1.1-chat-live` chat-streaming 17/17 + codex-live 14/14.
  Medición "Loading models…" (dashboard real + Playwright): Home lo muestra 2.9–3.4 s. Causa: el composer pide
  `/api/chat/cli-models` 4 veces por carga (el efecto de `AgentComposer.tsx:128` se repite al cambiar
  `lockedCli`/`defaultCli`) y cada una corre `opencode models --verbose` (0.56 s, 398 modelos, sin caché); se encolan
  0.74→1.4→1.9→2.55 s. `/api/chat/models` ya tiene caché (~1 ms).
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.1.1.md (parte 2)
  Cerrado 2026-10-09 (GO de Carlos). Caché del catálogo CLI en el servidor (`readCliModelCatalogsCached`, TTL 10 min,
  lecturas simultáneas comparten una; no cachea si algún CLI trae `error`), usada por `/api/chat/cli-models`, la
  validación del turno de chat y `/api/models/catalog`. En vivo (Playwright, dashboard real): "Loading models…" se va
  a 1.38 s en la primera carga (antes 3.4 s) y a 146 ms tras recargar (antes 2.9 s). `test:coverage` 1643/0.
  Luna: 1.ª corrida colgada >12 h sin salida ni cambios (matada); 2.ª se detuvo por `EADDRINUSE` en
  `csrf-origin.test.ts`, artefacto del sandbox de Codex que no deja abrir puertos (fuera del sandbox 185/0).

<a id="bloque-r-r-8-2"></a>
- [x] **R.8.2 — 🔍 Continuidad historial→CLI tras recarga.** (2026-10-10) Turno posterior a la recarga que necesite un centinela
  aleatorio del historial sin repetirlo; Claude y Codex. Hallazgo 1.
  Defecto real: el chat por CLI de Claude no tenía memoria entre turnos (solo `systemPrompt` + mensaje actual);
  Codex perdía los turnos al expirar el thread. Arreglo: `buildChatTranscript` (`handlers/chat.ts`) antepone los
  últimos 10 mensajes de la sesión (asistente en `untrusted-data`) a la entrada de Claude, y a Codex solo cuando su
  thread es nuevo o recreado. Gate nuevo `chat-continuity` (en el pre-push de chat): centinela → recarga → pregunta
  sin repetirlo; comprueba la entrada efectiva al CLI (`chat-cli-input-<id>.txt`) y la respuesta en API y DOM.
  Evidencia: `chat-continuity` 7/7 (incluye thread de Codex expirado, reconocido por `isExpiredThreadError` con el
  error real), `chat-streaming` 17/17, `codex-live` 14/14, `test:coverage` 1647/0, `tsc` limpio.
  Hallazgo al cerrar: en el turno 2 de Codex se reenvía el system prompt entero como `<orchestos-context-update>`
  (el hash cambió entre turnos) — causa sin medir.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.2.md (+2 correcciones del gate: UUID válido, leer API y DOM)

<a id="bloque-r-r-8-2-1"></a>
- [x] **R.8.2.1 — 🔍 Los turnos del chat no entran en "Recent runs" del contexto.** (2026-10-11) Hallazgo de cierre de
  R.8.2: cada turno cambiaba el prompt del siguiente y Codex reenviaba el system prompt entero (~1.1k tokens por turno,
  acumulados en el thread). `listContextRuns` (`db/runs.ts`) excluye `task_class='chat'`; Runs/Usage siguen viéndolos.
  Evidencia: `chat-continuity` 7/7 (el turno 2 de Codex ya no lleva `<orchestos-context-update>`), `chat-context` 5/5
  (el run de chat de Codex no aparece en el contexto de Claude), `test:coverage` 1648/0, `tsc` limpio.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.2.1.md

<a id="bloque-r-r-8-2-2"></a>
- [x] **R.8.2.2 — 🔍 El anillo de contexto de Dev mide la sesión abierta.** (2026-10-11) Carlos vio 71% en Dev con
  Codex: era el transcript más nuevo de Codex CLI en disco para el proyecto (2026-10-04, 184k/258k), no la sesión
  (2.48%). `OrchestDevWorkspace` usa ahora `getSessionContext` como la vista Chat; `session-status` queda para cuotas.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.2.2-live.json` (`ui:gate chat-continuity chat-streaming`).
  Evidencia: `chat-continuity` 8/8 (paso nuevo: anillo de Dev 1.4214% = `/api/chat/sessions/<id>/context` 1.4214%),
  `chat-streaming` 17/17, `test:coverage` 1648/0, ambos `tsc` limpios.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.2.2.md

<a id="bloque-r-r-8-3"></a>
- [x] **R.8.3 — 🔍 QA negativo real.** (2026-10-11) Tarea con salida deliberadamente incorrecta que QA debe rechazar; checks
  ejecutados y criterios visibles. Hallazgo 2.
  Gate nuevo `qa-negative` (en el pre-push): tarea de control que QA aprueba con evidencia literal + tarea cuya
  descripción pide `ROJO` y cuyo criterio exige `AZUL`. Tres defectos de producto que destapó:
  (1) el juez ya devolvía el resultado por criterio y el harness lo descartaba → migración 22 `runs.qa_criteria_json`,
  expuesto en `/api/runs` y pintado en Runs → QA Assertions; (2) el run rechazado no guardaba su diff
  (`computeFileDiffs` solo en la rama de éxito, `harness.ts`); (3) Runs no se recargaba cuando la tarea era rechazada
  (`App.tsx`: `listRuns` solo en el camino feliz; arreglados los 3 call sites).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.3-live.json` (`ui:gate qa-negative runs-graph`).
  Evidencia: `qa-negative` 18/18, `runs-graph` 16/16; `test:coverage` 1654/0,
  ambos `tsc` limpios. Contraprueba: sin el cambio del harness falla en `control criterion passed with literal
  evidence: []`; antes del arreglo de `App.tsx` falló `rejected run visible` (13/14). Estabilidad: 8 de 9 corridas
  18/18; la que falló murió en el andamiaje (`git commit` del fixture) → CI.19.
  Límites: el reporte de fin de tarea en el chat (`task-report.ts`) sigue sin mostrar criterios ni checks; el rechazo
  depende de que el ejecutor escriba `ROJO` (el gate lo comprueba como premisa y lo declara si no se cumple).
  Aprendizaje de specs: una columna nueva en `runs` va como migración numerada, no `safeAddColumn` (la migración 10
  reconstruye la tabla con lista fija); un spec con rondas apiladas confunde al ejecutor → una ronda = un archivo.
  Ejecutado por: Luna (gpt-6-luna) · Spec: docs/specs/R.8.3.md (+ rondas 4 y 5 en archivos propios)

<a id="bloque-r-r-8-4"></a>
- [x] **R.8.4 — 🔍 Reinicio del dashboard a mitad de run.** (2026-10-11) Recuperar el resultado y el reporte de fin
  (gap declarado de I.7.2). Hallazgo 4.
  Ejecutado por: sonnet (rondas 1-2) · gpt-6-luna (rondas 3-5) · revisión `qa` gpt-6.1-sol.
  Decisión de Carlos 2026-10-11: un run huérfano se marca interrumpido y se reporta; **nunca se relanza solo**.
  Causa: el reporte dependía de un callback en memoria (`proc.exited.then(onExit)`) y nada reconciliaba al arrancar.
  Hecho: migración 23 `task_run_watch` (`root`, `task_id`, `project_id`, `session_id`, `pid`, `created_at`);
  `spawnTaskRun` registra cada lanzamiento, también sin chat; `settleTaskRun` (`handlers/task-report.ts`) cierra por
  reclamo atómico (borra la fila de ESE lanzamiento y escribe el reporte en una transacción; si falla, la fila queda
  para el próximo arranque); `reconcileTaskRuns` (`handlers/task-run-reconcile.ts`) corre en `startServer`: tarea
  terminal → reporta; `running` con runner vivo → vigila el PID; `running` con runner muerto → `failed` +
  `Interrupted: the task runner stopped before the task finished.` La sonda de "runner vivo" es inyectable.
  Hermano arreglado: runner que muere con el dashboard vivo dejaba la tarea en `running` y el chat decía
  `✗ Task … running`; ahora pasa por el mismo cierre. `qa` encontró 4 defectos (cierre viejo que pisaba un
  relanzamiento, reporte duplicado con dos dashboards, reporte perdido si fallaba la escritura, sonda que casaba
  `task-1` con `--id task-10`): corregidos en la ronda 3 con sus regresiones.
  Gate nuevo `restart-mid-run` (en el pre-push), 3 casos con tarea real de Codex: A runner sobrevive, B runner muere
  con el dashboard, C runner muere con el dashboard vivo. `ctx.restartDashboard()` nuevo en `scripts/ui-gate/run.mjs`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.4-live.json` — `restart-mid-run` 28/28;
  `auto-flow` 31/31 sobre el mismo código de producto; `test:coverage` 1670/0; `tsc` limpio.
  Estabilidad: 2 de 3 corridas del cerebro en verde (más 2 verdes que reportó el ejecutor, no repetidas). La que falló (caso A): el ejecutor Codex se negó a escribir sin intentar nada
  ("the workspace is locked for writes by another session") → ver R.8.5; el reporte sí se recuperó. El caso A ya no
  exige `done`: comprueba un único reporte coherente con el estado final.
  Límites: el gate lanza con `POST /api/tasks/:id/run {sessionId}` (ruta de "Approve & Run"), no con el auto-flow del
  chat (`chat.ts:1145`), que usa el mismo `spawnTaskRun` pero no queda ejercitado aquí. Un run interrumpido no se
  reanuda: se reintenta a mano. Si el cierre falla con el dashboard vivo, el reporte no aparece hasta el próximo arranque.

<a id="bloque-r-r-8-5"></a>
- [x] **R.8.5 — 🔍 Privacidad sin depender del modelo.** (2026-10-12) `read-boundary`: condición dura = el token del fixture nunca
  aparece en respuesta ni en `files_read`; el `rejected` del audit se registra cuando ocurre, no se exige (Claude se
  niega sin invocar Read). Centinelas entre proyectos en el contexto efectivo del CLI. Hallazgo 5.
  Visto en R.8.4 (2026-10-11), verificado por lectura y por transcripción: las tareas de Codex corren sin
  `CODEX_HOME` aislado (`src/run/executors/codex.ts:158-171` usa `safeChildEnv()`; el chat sí lo aísla,
  `codex.ts:347,428`), así que el `~/.codex/AGENTS.md` global del usuario entra al prompt de cada tarea. Efecto
  medido: 1 de 5 corridas del caso A, Luna se negó a escribir citando "un árbol, un escritor" sin ejecutar ninguna herramienta
  (`~/.codex/sessions/2026/10/11/rollout-2026-10-11T13-20-04-01a12c31-….jsonl`, 34 tokens de salida). Decisión de
  Decisión de Carlos 2026-10-11: **aisladas**, con el mismo mecanismo del chat → R.8.5.1.
  - [x] **R.8.5.1 — 🧠 Las tareas corren con el home del CLI aislado, igual que el chat.** (2026-10-11)
    Ejecutado por: sonnet (rondas 1 y 4) · gpt-6-luna (ronda 3) · revisión `qa` gpt-6.1-sol.
    Hecho: todo spawn de `codex` fuera de la terminal interactiva corre con `CODEX_HOME` =
    `<proyecto>/.orchestos/agent-home/codex` (`provisionCliConfigHome` + `buildCodexChatEnv`): ejecutor de tareas
    (`executors/codex.ts`), roles por proveedor (`providers/codex.ts`, sin proyecto → `~/.orchestos/general-chat`) y
    revisor/orquestador (`role-runner.ts`, `harness.ts` pasan `projectRoot`: el cwd puede ser el worktree, el home es
    el del proyecto). Tareas de Claude: mismos flags que su chat (`--restricted --strict-mcp-config --settings`).
    `qa` encontró 3 defectos (spawn de `providers/codex.ts` sin aislar, home del revisor dentro del worktree, gate que
    aceptaba un rollout ajeno): corregidos en la ronda 4.
    Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.5.1-live.json` — `qa-negative` 21/21 con 3
    pasos nuevos sobre el rollout de la tarea real (está en el home aislado, trae las instrucciones generadas, no
    trae la línea distintiva del `~/.codex/AGENTS.md` del host); `auto-flow` 31/31 (tarea real de Claude con los
    flags nuevos); `restart-mid-run` 28/28; `test:coverage` 1675/0; `tsc` limpio.
    Contraprueba: antes del cambio el rollout de la tarea vivía en `~/.codex/sessions` y contenía las reglas
    personales (transcripción citada arriba).
    Límites: OpenCode sin aislar (su chat tampoco aísla; no hay mecanismo que reutilizar). Para Claude no hay paso en
    vivo que pruebe que el `CLAUDE.md` global no llega a una tarea: solo que la tarea sigue escribiendo con los flags.
    El revisor Claude con worktree crea su `settings.json` dentro del worktree (`external.ts:418`); se regenera en
    cada llamada. El guard `supportsRestrictedMode` del chat no se replicó en tareas: con un binario sin
    `--restricted` la tarea falla con el error del propio CLI.
  Cierre del resto del ítem (2026-10-12), solo gates:
  Ejecutado por: sonnet (rol `criterio`).
  Hecho: `read-boundary` con un solo turno y condición dura (token fuera del DOM y del mensaje persistido, fixture
  fuera de `files_read`, ninguna operación del audit sobre el fixture con `outcome` distinto de `rejected`; que Claude
  no invoque Read ya no es fallo) + paso que fija que Codex declara `readBoundary=none`. `project-isolation` abre un
  chat real de Codex y otro de Claude en Alfa y lee `chat-prompt-*`/`chat-cli-input-*`: control positivo
  (`Centinela memoria Alfa` llega) y ningún centinela Beta. `qa-negative` corre una tarea real de Claude y comprueba
  que su transcripción no trae la línea distintiva del `~/.claude/CLAUDE.md` del host.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.5-live.json` — `read-boundary` 7/7 (Claude
  invocó Read: `rejected`), `project-isolation` 14/14 (fugas `[]` en ambos CLIs), `qa-negative` 23/23; `tsc` limpio.
  El ejecutor reportó además 2 corridas verdes de cada gate, no repetidas por el cerebro.
  Contraprueba (cerebro, claude 2.1.296, a mano): sin `--restricted` la transcripción contiene la línea del
  `CLAUDE.md` global (1 coincidencia); con `--restricted --strict-mcp-config`, 0.
  Límites: Codex no tiene frontera de lectura (`none`): su respuesta puede exponer un archivo externo; el gate lo
  declara, no lo impide. La memoria global (`Centinela memoria Global`) llega al contexto de cualquier proyecto, por
  diseño. La contraprueba del `CLAUDE.md` es manual: el gate no corre una tarea sin el flag. Las tareas de Claude
  escriben su transcripción en el `~/.claude/projects` real del host (no hay home aislado para Claude) y el gate lee
  ese directorio filtrando por el nombre del proyecto temporal. OpenCode sin aislar (parcado). Los centinelas de
  instinto y de chat Beta se comprueban ausentes sin control positivo propio: los instintos no se inyectan al chat.

<a id="bloque-r-r-8-6"></a>
- [x] **R.8.6 — 🔍 Pasos que no pueden fallar.** (2026-10-12) Quitar `true` literales (`auto-flow.mjs:356,360`,
  `project-isolation.mjs:125`, `runs-graph.mjs:198`) y nombres que prometen más de lo que comprueban. Hallazgos 6-7.
  Ejecutado por: sonnet (rol `criterio`).
  Hecho: los 8 `step(nombre, true, …)` vigentes ya no existen. 4 pasan a `note` (diagnóstico: queda en
  `result.json` y stdout, fuera del `N/N`): `reasoning optional` y los tres `failed attempt N QA detail`
  (`tasks`, `project-tabs`, `runs-graph`). 4 son aserción real: los dos `held task card visible`
  (`isVisible()`), `fixtures created…` (ids presentes y distintos) y `text-sweep` (0 literales presentes).
  `lintFlowSource` rechaza un `step` con condición literal `true`, también multilínea, con test
  (`scripts/ui-gate/run.test.ts`, 8/0). Hallazgo 7: `chat-context` exige además `input_tokens > 0`;
  `contract output is real` se renombró a `run detail lists README.md output`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/R.8.6-live.json` — `chat-turn-details` 26/26
  (1 nota), `project-isolation` 14/14, `tasks` 13/13, `project-tabs` 24/24, `runs-graph` 16/16, `text-sweep`
  10/10, `chat-context` 5/5; `tsc` y lint limpios.
  Límites: los tres `note` de reintento no se ejercitaron (ninguna corrida tuvo reintentos). `auto-flow` no cambió:
  los `true` de `:356/:360` que citaba la revisión ya no existían; no se añadió la prueba de "aprobación retenida /
  sin ejecución previa / transición tras el clic" que pedía el hallazgo 6. El paso renombrado sigue comprobando solo
  que el nombre del archivo es visible, no su contenido.
