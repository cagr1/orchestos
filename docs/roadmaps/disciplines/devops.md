---
source: MemoriesMD/wiki/roadmaps/devops.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — DevOps / AWS

Estado global: `known`. Es una referencia de infraestructura cloud basada en AWS; no sustituye el
perfil real de deploy del proyecto ni convierte AWS en dependencia de OrchestOS.

## Progresión de infraestructura — estado: known

1. Esenciales: IAM, VPC y EC2.
2. Siguiente capa: S3, Route53, CloudWatch, CloudFront y SES.
3. Managed services: RDS/DynamoDB, ElastiCache y ECS/EKS.
4. Serverless: Lambda y ECS Fargate.

Well-Architected Framework y Shared Responsibility Model son el marco previo para separar lo que
opera AWS de lo que debe operar el equipo.

## Buenas prácticas — estado: known

- Seguridad: roles IAM en vez de credenciales embebidas, permisos por grupos/roles, auditoría y
  CloudTrail, mínimo privilegio.
- Desarrollo: aplicaciones stateless, SDK oficial y logs con contexto accesible.
- Operación: automatización, evitar IPs estáticas por servidor y alertas que notifiquen realmente.
- Billing: alertas granulares desde el inicio.
- Redundancia: availability zones y límites de servicio conocidos antes del despliegue.

## Decisiones recurrentes — estado: known

- IaaS/PaaS/SaaS y cloud público/privado/híbrido antes de elegir un servicio.
- ECS/Fargate frente a Lambda según carga continua o esporádica.

## Fuera de foco — estado: known

Kubernetes/EKS y servicios enterprise como EMR se activan con escala real. Para OrchestOS y CitasBot,
que usan Vercel, este perfil es referencia de infraestructura y operación, no checklist AWS literal.

## No asumir

Detectar proveedor, runtime de deploy, CI/CD, secretos, observabilidad, migraciones, costo, backup,
rollback y límites del proveedor real. No introducir AWS solo porque este roadmap lo use como fuente.

