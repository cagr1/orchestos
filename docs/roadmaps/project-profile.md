# project-profile.md — perfil efectivo del proyecto

Generado: 2026-07-29T21:33:05.852Z. Regenerar con `orchestos roadmap check`.

## Entorno

- Runtime/framework detectado: Node.js / none
- `bun` **verified**: 1.3.14
- `typescript` **verified**: 6.0.3

## Lenguajes detectados (políglota, no reducido a uno solo)

| Lenguaje | % | Estado | Roadmap |
|---|---:|---|---|
| TypeScript | 80% | `known` | 80% del código, roadmap de lenguaje disponible |
| JavaScript | 5% | `missing` | 5% del código, sin roadmap de lenguaje todavía (eje secundario, M.2 pendiente) |
| HTML | 3% | `missing` | 3% del código, sin roadmap de lenguaje todavía (eje secundario, M.2 pendiente) |
| Rust | 3% | `known` | 3% del código, roadmap de lenguaje disponible |
| C# | 3% | `missing` | 3% del código, sin roadmap de lenguaje todavía (eje secundario, M.2 pendiente) |

## Disciplinas aplicables

| Disciplina | Estado | Evidencia |
|---|---|---|
| backend | `detected` | servidor custom detectado en src/dashboard/server.ts |
| frontend | `detected` | archivos .html detectados |
| qa-seguridad | `detected` | 98 archivos de test encontrados |
| devops | `detected` | 3 workflow(s) de CI |
| architecture | `detected` | incluida explícitamente por docs/roadmaps/project-overrides.yaml |
| ai-agents | `detected` | incluida explícitamente por docs/roadmaps/project-overrides.yaml |

## Infraestructura

- CI: `detected` — 3 workflow(s): ci.yml, mutation-nightly.yml, security-secrets.yml
- Docker: `not-applicable` — sin Dockerfile/docker-compose.yml — no necesariamente aplica
- Base de datos: `detected` — uso de 'bun:sqlite' encontrado en el código fuente

## Archivos de instrucciones

- AGENTS.md: `detected`
- CLAUDE.md: `detected`
- CONTEXT.md: `detected`
- PLAN.md: `detected`

## Comandos detectados (package.json scripts)

- `bun run typecheck`
