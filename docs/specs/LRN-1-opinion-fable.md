# LRN-1 — Aprendizaje de errores: opinión independiente (Fable, 2026-11-13)

Opinión sobre `NEXT.md:37-41`; no es spec ejecutable hasta cerrar § 8. Datos medidos hoy en `~/.orchestos/db.sqlite`.

## 1. Veredicto

Hoy OrchestOS **no aprende**: 1.010 runs en 4 meses produjeron 2 instincts (1 manual, 1 auto sin aprobar). La
dirección de la propuesta es correcta (lección atómica, cita, aprobación humana, caducidad), pero **ataca primero la
pieza equivocada**. El cuello no es la extracción con LLM; son cuatro huecos mecánicos que la propuesta no nombra:
1. **El `trigger` no se usa.** `src/run/middlewares/instinct-apply.ts:23` inyecta el `action` de *todos* los
   instincts verificados del proyecto en *todas* las tareas. `trigger` es solo una etiqueta única
   (`idx_instincts_project_trigger`). No hay relevancia que "mejorar": no existe.
2. **No hay instincts globales en la práctica.** `src/instincts/store.ts:183` devuelve `[]` sin `projectId`, y la
   consulta filtra `project_id = ?`: una fila con `project_id NULL` nunca se aplica.
3. **No queda rastro de uso.** Ni la tabla `instincts` ni `runs` guardan qué lección se inyectó en qué run. Sin eso
   no se puede caducar "sin uso" ni medir si sirvió. Es prerequisito de todo lo demás.
4. **La señal de fallo está sucia.** Los motivos de QA fail más frecuentes de la DB real son residuos de gates
   (`TRUST1-MARKER` ×35, `README line absent` ×15, `ROJO/AZUL` ×11). Extraer "por cada fallo" generaría basura y
   gastaría el rol Auxiliar en fixtures. `analyze/patterns.ts:109-134` además solo pasa conteos y 5 motivos: no puede
   citar nada.

## 2. Qué cambiaría de la propuesta

| Propuesta | Mi cambio | Por qué |
|---|---|---|
| Fallo → Auxiliar propone | **Fallo repetido** (misma firma ≥2) o **par fallo→arreglo** → propone | Regla propia: "reglas nuevas solo ante un error que ya se repitió". Hay 19 tareas con `qa fail` seguido de `pass` y 10 runs revertidos: ahí está la lección (qué cambió), no en el fallo suelto |
| Llamada aparte de extracción (3–6k in) | En chat, **el modelo del turno propone** con una herramienta `propose_lesson`; en tareas, Auxiliar solo sobre el par fallo→arreglo | El modelo del turno ya tiene el contexto pagado: cuesta ~150 tokens de salida, no 3–6k de entrada |
| Inyección por relevancia | **Todo lo aprobado bajo un tope duro**, orden determinista; relevancia solo cuando el tope se llene | Con N=2 (y N<30 por mucho tiempo) un ranking es complejidad sin efecto. El tope es lo que protege |
| Exporta a AGENTS.md | **Graduar, no duplicar**: la lección probada pasa al archivo y se borra de instincts | "Un solo presente". Inyectada y además en AGENTS.md se paga dos veces y puede divergir |
| Caduca sin uso | Caduca por **cita rota** o **sin inyección útil en N días**; nunca se borra sola: pasa a "por revisar" | Borrado silencioso de una regla aprobada por Carlos contradice "historial al cambiar reglas" |
| (ausente) | **Medición por recurrencia** (§ 5) | Sin ella solo se sabe que existe, no que mejora |

Sobra por ahora: embeddings para poda (ACE), contador AGREE (ExpeL), auto-promoción por confianza: maquinaria sin
datos a este volumen. La aprobación humana no se negocia: es el único control real contra el envenenamiento.

## 3. Cómo detectar un error en el chat

`chat_turns.status` no sirve: 81 de 81 turnos están `completed`. `chat_turn_steps.ok = 0` da 2 de 97 tool calls.
Un error de chat casi nunca es un fallo técnico; es Carlos corrigiendo. Tres señales, de más a menos fiable:
1. **Explícita (principal):** acción "Esto estuvo mal → recordar" en el mensaje del asistente; crea la propuesta
   con cita al turno. Cero LLM, cero falsos positivos; es lo que ya hace la metodología interna.
2. **Propuesta del propio modelo:** herramienta `propose_lesson` en el chat, pedida solo cuando el usuario corrige
   un hecho o una conducta. Va a la cola sin verificar; nunca se aplica sola.
3. **Mecánica:** tool call con `ok = 0` repetida con la misma firma (`tool` + `target` + `exit_code`) en ≥2 sesiones.

Descarto un clasificador LLM por turno: cuesta en cada turno y un falso positivo enseña una regla falsa.

## 4. Diseño por fases (cada una se entrega y se verifica sola)

**F0 — Cimientos, sin LLM.** Lo que hace posible medir; sin esto no empezaría F1.
- Migración en `src/db/migrate.ts` (junto a `project-scope-instincts`, `:684`): a `instincts` sumar `evidence_json`
  (cita: run_id / turn_id / `archivo:línea` + firma del fallo), `why`, `injected_count`, `last_injected_at`,
  `status` (`proposed|active|review|retired`); a `runs` sumar `instinct_ids_json`.
- `src/instincts/store.ts:182` `listApplicable`: incluir globales (`project_id IS NULL OR project_id = ?`) y aplicar
  tope (D2). `src/instincts/schema.ts:31` y validadores `:74`, `:123`: campos nuevos. Excluir del análisis las
  tareas de gate y eval (§ 1.4).
- `src/run/middlewares/instinct-apply.ts:21-24`: registrar ids inyectados y subir contadores.

**F1 — Chat recibe lecciones y puede proponerlas.**
- `src/chat/chat-context.ts:222`: bloque `Lessons` junto a `Memory`, mismo `listApplicable`, mismo tope. Posición
  estable en el prompt para no romper el prompt cache del CLI.
- Acción "recordar" en el mensaje + herramienta `propose_lesson` → `src/dashboard/handlers/instincts.ts:95` (ruta
  auto ya existente, 0.6 sin verificar).
- `InstinctsView.tsx:179`: la tarjeta muestra cita, porqué y uso; aprobar permite **editar el texto antes** (hoy
  `approveInstinct`, `store.ts:161`, solo sube confianza). Sin vista nueva.

**F2 — Propuesta automática desde tareas.**
- Reemplazar el prompt de `src/analyze/patterns.ts:102-134` (conteos agregados) por uno sobre un caso concreto:
  `qa_reason` del fallo + diff del run que pasó (`file_diffs`) → una lección con cita. Se conserva
  `groupRunsByOutcome` (`:55`) y `parsePatternSuggestions` (`:167`).
- Disparo: al cerrar un run `pass` cuya tarea tuvo `fail` previo, o al revertir; nunca en cada fallo. Firma del
  fallo = `failure_kind` + `qa_reason` normalizado (hoy `failure_kind` está casi vacío: 1 de 1.010; hay que poblarlo).
- Duplicados y contradicciones: `judgeConflict` (`src/memory/judge.ts:112`) contra las lecciones activas del mismo
  alcance antes de encolar. Firma compatible (`{topicKey, content}` ← `{trigger, action}`); no leí `parseJudgment`.

**F3 — Ciclo de vida y graduación.**
- Cita rota (archivo o símbolo ya no existe) o sin inyección en N días → `review`, visible en la vista; Carlos
  retira o reafirma. Recurrencia tras aprobar (§ 5) → `review` con el run que la contradice.
- "Graduar a AGENTS.md": acción explícita por lección; escribe en un bloque delimitado del `AGENTS.md` del proyecto,
  muestra el diff y pasa la lección a `retired`. Nunca automático: es un archivo versionado del usuario.

## 5. Cómo se verifica que mejora

- **Métrica principal — recurrencia por firma:** para cada lección, fallos con su firma antes y después de aprobarla,
  en runs que la llevaron inyectada (`runs.instinct_ids_json`). Una lección buena lleva la firma a cero; una que no,
  cae a `review`. Es por lección, no un promedio, y funciona con poco volumen.
- **Costo y regresión:** `input_tokens`/`usd_cost` con y sin bloque; `eval_trials` (21 filas) antes de subir el tope.
- Con ~250 runs/mes un A/B global no detecta un +4 % de éxito; no lo prometería. Gates por fase: `bun run test:coverage`; F1 y F3 además en el dashboard real (regla cero), con evidencia de que
  la lección aprobada aparece en el prompt del turno siguiente y en el prompt de una tarea.

## 6. Costo real

Medido: un run promedia 12.697 tokens de entrada + 22.919 de caché leída, 416 de salida (927 runs).
- **Inyección:** un bloque de 1.000 tokens es ~2,8 % del prompt de un run (1.000 / 35.600); menos si cae en el
  prefijo cacheado (no medido). En chat no hay dato de tokens por turno para confirmar el "3–5 %" de la propuesta.
- **Extracción:** por par fallo→arreglo serían ~29 casos en 4 meses, no 124 fallos; a 3–6k de entrada cada uno es
  despreciable. En chat, ~150 tokens de salida por propuesta (estimado).
- **El costo verdadero es humano:** revisar la cola. Con más de unas pocas propuestas por semana Carlos deja de
  leerlas y el sistema muere como hoy; el umbral de repetición importa más que el modelo extractor.
- **Desarrollo (estimado):** F0 chico y mecánico; F1 mediano (chat + UI en vivo); F2 mediano, de criterio; F3 chico.

## 7. Riesgos y qué no tocar

- **Envenenamiento:** la lección sale de salida de LLM y texto de fallos, no confiables. Controles: aprobación
  humana siempre, texto editable, largo máximo del `action`; una propuesta sin verificar nunca llega a un prompt.
- **Colapso de contexto / regla vieja:** tope duro (aprobar una nueva obliga a retirar o graduar otra); cita + `review`.
- **No tocar:** umbrales (`schema.ts:155-158`); índice único proyecto+trigger; `src/memory/` salvo llamar a
  `judgeConflict`; la memoria del chat (hechos ≠ lecciones: no fusionar tablas); `db/reset.ts:26`.
- **No construir:** tabla nueva de "lessons", vista nueva, embeddings, auto-aprobación.

## 8. Decisiones que necesitan a Carlos

- **D1 — Alcance.** Recomiendo: por proyecto por defecto; global solo por promoción manual de una lección que ya
  funcionó en un proyecto. Una lección de un repo aplicada a otro es la forma más barata de empeorar resultados.
- **D2 — Tope de inyección.** Recomiendo 1.000 tokens o 15 lecciones, lo que ocurra primero, igual en chat y tareas.
- **D3 — Umbral de propuesta.** Recomiendo: misma firma ≥2 veces, o par fallo→arreglo, o acción explícita en chat.
- **D4 — Graduación a AGENTS.md.** Recomiendo incluirla (F3), manual y con diff; es lo único que llega a un CLI
  usado fuera de OrchestOS.
- **D5 — Caducidad.** Recomiendo 60 días sin inyección → `review`, no borrado (los 28 de Copilot suponen más tráfico).
- **D6 — Orden.** Recomiendo F0+F1 como un lote (Carlos enseña desde el chat y lo ve aplicado); F2 con datos de F0.
