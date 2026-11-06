---
source: MemoriesMD/wiki/roadmaps/backend.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — Backend

Estado global: `known`. Este contenido fue destilado en el vault y todavía debe verificarse contra
el proyecto concreto antes de convertirse en un gate automático.

## Qué cubre

Backend de producción: APIs, persistencia relacional, autenticación/autorización, caching, testing,
CI/CD, seguridad web, performance y decisiones de arquitectura según contexto.

## Núcleo no negociable — estado: known

- Dominar un lenguaje backend en profundidad; no acumular lenguajes superficialmente.
- Entender bases relacionales: normalización, ACID, transacciones, índices y N+1 antes de usar un ORM.
- Diseñar APIs REST/JSON con códigos de respuesta correctos.
- Tratar autenticación (JWT/OAuth/session) como núcleo, no como avanzado.
- Tener caching en una capa apropiada antes de escalar.
- Mantener testing unitario e integración; testing manual solo no alcanza.
- Integrar CI/CD desde el flujo de desarrollo.
- Cubrir hashing seguro (bcrypt/scrypt, no MD5/SHA solos), HTTPS, CORS y riesgos OWASP.

## Diseño de API en profundidad — estado: known

- Contrato explícito: versionado, paginación, rate limiting, idempotencia, HATEOAS cuando aplique y
  errores estructurados como RFC 7807 Problem Details.
- Separar autenticación (quién es) de autorización (qué puede hacer): RBAC, ABAC, PBAC, ReBAC, DAC o
  MAC según el dominio.
- Documentar el contrato con OpenAPI/Swagger generado desde el código cuando sea posible.
- Elegir sync/async, webhooks/polling y API gateway según latencia y cantidad de servicios.
- Considerar GDPR/CCPA/PII desde el modelo si la API maneja datos reales.

## Performance y operación — estado: known

- Caching: cache-aside, write-through, read-through y una estrategia de invalidación definida.
- DB: connection pooling, índices eficientes, evitar `SELECT *`, paginación, slow-query logging y
  profiling del motor.
- SQL: elegir isolation level con intención, usar window functions/CTEs cuando simplifiquen consultas
  y revisar `EXPLAIN` antes de optimizar a ciegas.
- Red y respuesta: keep-alive, CDN donde aplique, límites de payload, compresión y evitar cómputo caro
  en el hot path.
- Escalado: considerar horizontal antes que vertical, con balanceo explícito.
- Monitoreo: métricas y logs desde el primer día, no después del primer incidente.

## Decisiones recurrentes — estado: known

- Monolito, monolito modular, microservicios o serverless según dominio y operación; entender Twelve
  Factor antes de elegir.
- SQL, NoSQL, document, key-value, graph o time-series según patrones de acceso, no por moda.
- Message broker solo cuando existe comunicación asíncrona real.
- CAP como marco para decidir replicación/sharding cuando un nodo ya no alcanza.

## Fuera de foco — estado: known

Service mesh, GraphQL federation, Elasticsearch/Solr, Kubernetes y otros componentes de escala no
bloquean evaluar un proyecto pequeño; se activan cuando el producto tiene una necesidad real.

## No asumir

Verificar framework, runtime, ORM, base de datos, proveedor, comandos de build/test, autenticación,
exposición de red, límites de payload y estrategia de deploy en el proyecto real. Esta página no
autoriza adoptar una arquitectura concreta ni convierte una práctica en `verified` automáticamente.

