---
source: MemoriesMD/wiki/roadmaps/ai-agents.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — AI Agents

Estado global: `known`. Es la disciplina más directamente relacionada con OrchestOS, pero sus
recomendaciones siguen necesitando evidencia contra el código y la tarea concreta.

## Núcleo no negociable — estado: known

- Agent loop: input/percepción → razonamiento/plan → acción/tool → observación/reflexión.
- Tools con nombre, descripción, schema de entrada/salida, errores y ejemplos claros.
- Memoria como decisión explícita: corto/largo plazo, episódica/semántica, compresión y olvido.
- Evaluación real: unit de tools, integración de flujos completos y human-in-the-loop donde no haya
  medición automática.
- Observabilidad desde el diseño: logs y tracing estructurado, no debugging posterior.

## Seguridad y ética — estado: known

- Prompt injection y jailbreak como amenazas de primera clase.
- Sandboxing y permissioning explícitos para filesystem, DB, APIs y tools.
- Redacción de PII y guardrails de bias/toxicidad cuando existan datos reales.
- Red team testing antes de dar acceso a producción.

## Decisiones de arquitectura — estado: known

- Function calling nativo frente a parsing manual según control, portabilidad y costo.
- Framework (LangChain, LlamaIndex, CrewAI, AutoGen, LangGraph) frente a llamadas directas según
  velocidad inicial, complejidad y control.
- MCP cuando la interoperabilidad con tools externas aporte valor real.

## Fuera de foco — estado: known

Fine-tuning, tokenización y pricing son fundamentos útiles, pero no bloquean construir un agente si
no son parte del problema concreto.

## No asumir

Verificar modelo, provider, presupuesto, ventana de contexto, tools permitidas, sandbox, fuentes de
datos, evaluación, memoria, observabilidad, privacidad y fallback. Un agente que responde bien en
happy path no está verificado si no se probaron fallos, abuso, límites y recuperación.

