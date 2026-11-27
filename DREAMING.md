# DREAMING.md — 2026-11-27

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-26T13:29Z: **sin runs nuevos** desde el
> informe del 2026-11-26 (mismos 20 runs, mismos ids). Los patrones y propuestas se mantienen; ninguna se aplicó.
> Segundo informe consecutivo sin datos nuevos: refuerza la propuesta 4.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-23T21:24:34Z → 2026-11-26T11:55:45Z
- failed: 8 | blocked: 0 | done: 12 | qa_failed: 8

Distribución: 3 `chat` (claude-opus-5-5, 3/3 done), 9 `gate:uso.49:implement` (gpt-6-luna: 3 done, 6 failed),
8 `gate:uso.50:implement` (`openai/gpt-6-luna` 6, `anthropic/haiku` 2: 6 done, 2 failed). Sin gates: 0/3 fallos.

## Patrones detectados

### Gate USO.49: tres rechazos seguidos y luego pase
- Evidencia: dos rondas idénticas — `5db164a4`, `a539d52e`, `231e0525` → `050d1e2a` (pass) y `050d7fb7`,
  `9bb9c14c`, `cecd53c7` → `cc33ae6f` (pass); más `5b742245` (pass). Todos gpt-6-luna.
- Frecuencia: 6/20 fallidos; `gate:uso.49:implement` con 67 % de fallo (> 50 %).
- qa_reason recurrente: "check failed: bunx tsc --noEmit exit 2 (expected 0) … broken.ts(1,7): error TS2322" (6 veces).
- Lectura: fallo provocado por el gate (archivo `broken.ts` sembrado) para probar el reintento automático de USO.49.
  Cada intento rechazado queda como run `failed` propio, así que un reintento que termina bien suma 3 fallos al resumen.

### Gate USO.50: un rechazo y pase en el reintento
- Evidencia: `0e022895` → `f9cee405` y `38d62634` → `8f1e0257` (openai/gpt-6-luna).
- Frecuencia: 2/20.
- qa_reason recurrente: "nota.txt contains ROJO, not the required AZUL line." (2 veces, fallo buscado).

### `checks_failed > 0` recurrente — solo gate USO.49
- Evidencia: los 6 fallos de USO.49 tienen `checks_failed: 1`; ningún otro run.
- Frecuencia: 6/20.

### gpt-6-luna con `qa_verdict: fail` en 8 runs, nombre de modelo inconsistente
- Evidencia: USO.49 registra `gpt-6-luna`; USO.50 registra `openai/gpt-6-luna` (y `anthropic/haiku`). Es el mismo
  modelo con dos identificadores: cualquier agregado por `model` lo parte en dos.
- Frecuencia: 8/20 con fail (6 + 2); los 8 son fallos buscados por los gates.

### Los gates desplazan el uso real de la ventana
- Evidencia: 17/20 runs y 8/8 fallos son `gate:*`. La ventana de 20 dejó fuera los 7 `chat` y el `doc` del informe
  anterior. Es la tercera vez que se ve (P3 del 2026-11-24), ahora más marcado.

## Propuestas

### Propuesta 1 — Separar los gates del resumen (P3 del 2026-11-24, reforzada)
- Qué cambiar: `scripts/export-runs-summary.ts` — excluir `task_class` `gate:*` de la ventana de 20 o exportarlos en
  un bloque aparte con su propio conteo.
- Por qué: 17/20 runs y el 100 % de los fallos de esta ventana son fallos provocados; el análisis no ve uso real.
- Riesgo: bajo

### Propuesta 2 — Normalizar el identificador de modelo
- Qué cambiar: el punto donde se guarda `model` del run (`src/run/harness.ts` o el adaptador del executor) o, como
  mínimo, `scripts/export-runs-summary.ts`: un solo formato (`proveedor/modelo` o sin prefijo).
- Por qué: `gpt-6-luna` y `openai/gpt-6-luna` aparecen el mismo día para el mismo modelo.
- Riesgo: bajo (verificar qué consume el campo antes de cambiar el formato guardado).

### Propuesta 3 — Agrupar los intentos de un reintento
- Qué cambiar: `scripts/export-runs-summary.ts` — exportar el id de la tarea y el número de intento, o contar como
  fallo solo el último intento de cada tarea.
- Por qué: con el reintento de USO.49 una tarea que termina `done` aporta hasta 3 runs `failed` al resumen.
- Riesgo: bajo

### Propuesta 4 — No repetir el informe sin runs nuevos (2026-11-25 P1, reforzada)
- Qué cambiar: prompt del scheduled task `orchestos-dreaming` — si el `exported_at` o los ids de runs no cambiaron
  desde el último DREAMING.md, actualizar solo la fecha o no commitear.
- Por qué: el informe de hoy y el de ayer analizan exactamente los mismos 20 runs; el commit diario no aporta.
- Riesgo: bajo

### Propuestas vigentes sin aplicar
- 2026-11-24 P1: `failure_kind` de configuración para "requires worktree sandbox mode". Riesgo bajo.
- 2026-11-24 P2: reintento de `doc` con el `qa_reason` — posiblemente cubierto por el reintento de USO.49; verificar.
- 2026-11-24 P4: exportar `failure_kind` y motivo corto. Riesgo bajo.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
