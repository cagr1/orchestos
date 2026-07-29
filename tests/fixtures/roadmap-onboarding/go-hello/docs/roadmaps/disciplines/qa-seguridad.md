---
source: MemoriesMD/wiki/roadmaps/qa-seguridad.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — QA y Seguridad

Estado global: `known`. El vault agrupa QA, seguridad web y seguridad de API porque forman el gate
previo a shippear; este documento no afirma que un proyecto concreto ya cumpla estos controles.

## Núcleo QA — estado: known

- Aplicar la pirámide unit → integration → funcional/E2E, con smoke y regression antes del release.
- Mantener casos y planificación de testing manual; automatizar no reemplaza verificar y validar.
- Priorizar automatización de backend antes que UI cuando el objetivo pueda probarse más barato.
- Integrar CI/CD con testing, no dejarlo como paso manual final.
- Tratar performance/load/stress y accesibilidad como parte del criterio de terminado.

## Núcleo de seguridad — estado: known

- Usar CIA triad, separar autenticación de autorización y conocer el ciclo de respuesta a incidentes:
  preparación, identificación, contención, erradicación, recuperación y lecciones aprendidas.
- OWASP Top 10 como checklist obligatorio antes de exponer una superficie.
- Higiene mínima: bcrypt/scrypt, HTTPS/TLS, gestión de secretos y MFA/2FA cuando aplique.

## Checklist de seguridad de API — estado: known

- Auth: no Basic Auth en producción; JWT con secreto fuerte, TTL corto, payload mínimo y algoritmo
  validado en backend, nunca confiado desde el header.
- Acceso: rate limiting/throttling, HTTPS + HSTS, allowlists para APIs privadas y sin directory listing.
- Entrada/salida: `X-Content-Type-Options`, `X-Frame-Options`, CSP; nunca devolver credenciales o
  tokens; considerar UUID en URLs de recursos.
- Procesamiento: autenticación explícita por endpoint, XXE deshabilitado y debug apagado en producción.
- CI/CD: tests de seguridad en pipeline, auditoría de dependencias y sin auto-aprobación de PRs.

## Fuera de foco — estado: known

Certificaciones, forensics, reverse engineering, red/blue/purple team formal y cloud security profundo
son especializaciones, no gates universales de un producto propio.

## No asumir

Detectar el modelo de despliegue, auth existente, superficie de red, secretos, datos sensibles, runner
de tests, auditoría de dependencias y herramientas de seguridad. Si un check no existe, declararlo
`missing` o `blocked`; nunca convertir la ausencia en un `pass` implícito.

