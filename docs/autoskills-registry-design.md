# Decisión de arquitectura — registry de skills (Mes 13, Bloque B1)

## La pregunta

¿Registry propio (mantenido por OrchestOS) o wrappear `autoskills` (midudev) como fuente?

## Lo que investigué

**`autoskills` (midudev)** — [github.com/midudev/autoskills](https://github.com/midudev/autoskills).
Es un CLI (`npx autoskills`) que detecta el stack de un proyecto (50+ tecnologías vía
`package.json`/lockfiles/Gradle/etc.) e instala skills curadas para Cursor/Claude Code. No es
él mismo el registry — usa **skills.sh** por debajo: descarga desde un registry curado,
verifica cada archivo contra un manifest con hash SHA-256, escribe `skills-lock.json`. Wrappear
el *CLI* de autoskills no tiene sentido para OrchestOS (es una herramienta de instalación local
con su propio lockfile, pensada para escribir directo en `.claude/skills/` o `.cursor/`, no una
librería ni una API que se pueda importar).

**skills.sh** — sí expone una API HTTP real: `/api/v1/skills` (listado/búsqueda),
`/api/v1/skills/{id}` (contenido), `/api/v1/skills/audit/{id}` (auditoría de seguridad/supply
chain). Esto es lo que de verdad sirve como fuente externa: JSON sobre HTTPS, sin necesidad de
depender del paquete npm de autoskills.

**agentskills.io** — el estándar abierto que define el formato `SKILL.md`: frontmatter YAML
(`name` obligatorio = nombre de la carpeta, `description` obligatorio) + cuerpo Markdown con las
instrucciones. Es el formato que sirven tanto skills.sh como el registry "oficial"
(officialskills.sh). Claude Code, Codex CLI, Gemini CLI y otros ya lo soportan — es portable
entre harnesses, tal como anticipaba IDEAS.md.

## La decisión

**No construir registry propio. No wrappear el CLI de autoskills. Consumir la API HTTP de
skills.sh directamente como fuente, y reusar `normalizeImport()` para la conversión de formato.**

Razón clave: `normalizeImport()` ([src/dashboard/handlers/skills.ts:233](../src/dashboard/handlers/skills.ts:233))
ya es agnóstica al formato de entrada — toma `rawYaml: string` (en realidad "texto crudo de
origen desconocido"), lo manda a un LLM curador con instrucciones de producir un `SkillDef`
válido, y reintenta hasta 2 veces si la validación falla. No le importa si el texto de entrada
es YAML mal formado o un `SKILL.md` con frontmatter + Markdown — el curador ya hace esa
traducción de formato. **No hay que escribir un parser de `SKILL.md`.** Esto es exactamente el
patrón "no reconstruir infraestructura que ya existe" del eje de Mes 13.

Esto evita:
- Mantener un catálogo propio (curación, actualización, moderación — trabajo continuo sin fin).
- Depender de un paquete npm (`autoskills`) pensado para otro caso de uso (instalación CLI local
  con lockfile), cuando solo necesitamos lectura HTTP de un catálogo.

## Cómo se conecta con B2/B3

- `orchestos skill fetch --list` → `GET https://www.skills.sh/api/v1/skills` (con filtro por
  query si la API lo soporta; si no, filtrar client-side por `language`/`framework` sobre el
  campo de metadata que devuelva el listado).
- `orchestos skill fetch --language rust` → resuelve el `id` del listado, `GET
  /api/v1/skills/{id}` para el contenido (`SKILL.md` crudo: frontmatter + cuerpo).
- El contenido crudo se pasa tal cual a `normalizeImport(rawContent, ...)` — sin parseo previo
  de frontmatter. El curador LLM ya sabe producir `SkillDef` (`id`, `version`, `name`,
  `description`, `instructions`, `targets`, etc. — ver
  [src/skills/registry.ts:18](../src/skills/registry.ts#L18)) a partir de cualquier formato de
  entrada razonable.
- Skills con `description` larga (>200 chars) se normalizan con warning — comportamiento ya
  existente en `normalizeImport`, no hay que reimplementarlo (gate B4 lo confirma).
- B3 (superficie en el dashboard) reusa el mismo endpoint nuevo (`GET /api/skills/registry` o
  similar) que B2 expone vía CLI — un solo backend, dos fachadas (CLI + dashboard), igual patrón
  que el resto de "puertas" del proyecto (escribir/importar/exportar en Mes 11).

## Qué NO se construye

- Registry propio con su propia base de datos de skills de la comunidad.
- Wrapper del paquete npm `autoskills`.
- Parser dedicado de frontmatter `SKILL.md` — el curador LLM ya cubre esa traducción.

## Riesgo abierto para B2

La API de skills.sh es de terceros y puede cambiar de forma (endpoints, shape del JSON, rate
limits — 600/min por team/project si se autentica via Vercel OIDC, sin esa auth probablemente
más restrictivo o público). B2 debe aislar la llamada HTTP en una función propia
(`fetchSkillsRegistry()`) para que un cambio de la API externa no obligue a tocar
`normalizeImport` ni el resto del pipeline de import.
