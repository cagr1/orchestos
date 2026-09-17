# Incidente de consumo de agentes — 2026-09-14

## Resumen

El agotamiento rápido de Claude y el salto de uso de Codex tuvieron el mismo multiplicador:
contexto grande reenviado muchas veces dentro de una sola unidad de trabajo. No hay evidencia de
una degradación diaria de los modelos; sí hay evidencia directa de fan-out y tool loops costosos.

## Claude Code

- Sonnet 5, transcript `31bbf495-2009-4116-b1a5-7ed37a159af0`: 169 requests únicas en 36
  minutos, 178 tools (138 Bash), contexto de 36.611 a 206.091 tokens y 21.951.947 tokens de
  entrada acumulados; 21.745.520 fueron `cache_read`. Hubo solo cuatro filas de prompt humano.
- Opus 5, transcript `092b85d9-1cc7-4065-8f1e-0862f5ba836e`: 71 requests, 127 tools, contexto
  de 24.500 a 215.604 y 9.685.268 tokens de entrada acumulados.
- El guard de AT.5 corre en `UserPromptSubmit`: puede bloquear el siguiente prompt humano, pero
  no corta las llamadas autónomas de tools que ya están ocurriendo dentro del turno.
- `.claude/settings.local.json` apunta a un hook Impeccable inexistente y produjo 19 errores
  `MODULE_NOT_FOUND` en Sonnet y 15 en Opus. Es desperdicio secundario, no la causa dominante.

## Codex

Rollout local `01a0a0b8-ebdd-7222-bd16-74bcdabb70d8`:

- Primera respuesta: 31.810 tokens de entrada; el indicador de 5 h ya registró 52%.
- Seis respuestas del agente raíz acumularon 241.084 tokens de entrada, 191.488 cacheados.
- El indicador pasó 52% → 54% en el agente raíz y 54% → 71% durante el intervalo sin respuesta
  del raíz en el que trabajaron tres subagentes con historial completo; después llegó a 73%.
- El indicador semanal pasó 51% → 54%.

La atribución exacta de cada punto de cuota no es pública. La coincidencia temporal y la ausencia
de otra sesión Codex activa hacen del fan-out full-history la explicación más fuerte, no una
conversión contractual token→porcentaje.

## Decisiones

1. Máximo dos subagentes activos simultáneos por agente raíz.
2. Luna es el ejecutor Codex por defecto.
3. Delegaciones Codex usan `fork_turns: "none"` o el mínimo historial necesario; no `"all"` por
   comodidad.
4. Con la ventana de 5 h en 70% o más, no se delega salvo pedido explícito de Carlos.
5. Claude necesita enforcement durante el turno autónomo, no únicamente en `UserPromptSubmit`.

## Límites

El repositorio puede instalar hooks para Claude Code. No puede interceptar ni bloquear
`spawn_agent` del host de Codex; allí los puntos 1–4 son reglas narrativas y deben reportarse como
tales. No se añadirá un script post-hoc que pretenda ser un freno mecánico si solo detecta el gasto
después de ocurrido.
