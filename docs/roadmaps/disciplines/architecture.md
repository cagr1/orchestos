---
source: MemoriesMD/wiki/roadmaps/architecture.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — Arquitectura de Software

Estado global: `known`. Consolida diseño de código, arquitectura de módulos/servicios y system design
a escala. No prescribe microservicios ni una solución única.

## Nivel 1: diseño de código y módulo — estado: known

- Clean code: nombres significativos, funciones pequeñas/puras y evitar flags booleanos o `null` como
  control de flujo cuando una abstracción expresa mejor la intención.
- SOLID, DRY y YAGNI como criterios de revisión, no como checklist mecánico.
- Composición sobre herencia; programar contra abstracciones.
- Separar comandos y queries (CQS) y organizar por actor/responsabilidad, no solo por tipo técnico.

## Nivel 2: patrones y estilos — estado: known

- Conocer capas, event-driven, microservicios, monolito modular, serverless, pub/sub y cliente-servidor
  para elegir con intención.
- Usar DDD, CQRS y Event Sourcing cuando la complejidad del dominio lo justifique, no para cualquier CRUD.
- Evaluar coupling, cohesion y boundaries antes de separar un servicio.

## Nivel 3: system design — estado: known

- Hacer explícitos trade-offs de performance/escalabilidad, latencia/throughput y disponibilidad/
  consistencia (CAP).
- Elegir consistencia débil, eventual o fuerte; failover activo-activo/activo-pasivo y replicación
  según el fallo tolerable.
- Caching con estrategia explícita: cache-aside, write-through, write-behind o refresh-ahead.
- Diagnosticar busy database, chatty I/O, retry storm, ausencia de caching y noisy neighbor.
- Usar circuit breaker, bulkhead, throttling, strangler fig y gateway aggregation como catálogo cuando
  el problema lo requiera, no como requisitos universales.

## Fuera de foco — estado: known

TOGAF/PMI/ITIL, enterprise suites y enterprise architecture no bloquean evaluar un producto pequeño.

## No asumir

Antes de elegir arquitectura, registrar dominio, límites, carga, disponibilidad requerida, equipo,
operación, costo, datos y estrategia de recuperación. “Escalable” no es una evidencia si no hay
escenario, métrica, restricción y prueba asociados.

