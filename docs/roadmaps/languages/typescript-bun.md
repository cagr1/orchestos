---
language: TypeScript
runtime: Bun
package_manager: Bun
state: detected
last_verified: 2026-07-29
evidence:
  - "bun --version" → 1.3.14
  - "bunx tsc --version" → Version 6.0.3
  - "bunx tsc --noEmit" → exit 0
  - "package.json" + "bun.lock" existen
---

# Perfil de lenguaje — TypeScript / Bun

Este perfil es la capa secundaria de ecosistema. Las decisiones de arquitectura, seguridad, testing
y operación viven en `docs/roadmaps/disciplines/`; aquí solo se describen las diferencias prácticas
de TypeScript/Bun y la evidencia del proyecto detectado.

## Toolchain y versiones — estado: verified

- Runtime: Bun `1.3.14` — verificado con `bun --version`.
- Lenguaje/typecheck: TypeScript `6.0.3` — verificado con `bunx tsc --version`.
- Package manager: Bun, con `package.json` y `bun.lock` presentes.
- Módulos: ESM (`"type": "module"` en `package.json`).

## Framework, persistencia y entrega — estado: detected

- Framework: no se detecta un framework web; el proyecto usa TypeScript/Bun con dashboard HTML/JS
  propio y Commander para CLI.
- Persistencia: SQLite mediante `bun:sqlite`, con migraciones versionadas y DB aislable por
  `ORCHESTOS_HOME`.
- Entrega: paquete/CLI local (`package.json` expone `src/cli.ts`) y dashboard local; el deploy real
  se debe determinar por proyecto, no por este perfil.
- Arquitectura de ejecución: código de servidor, CLI, scripts y frontend estático comparten repo;
  no tratarlos como si tuvieran los mismos riesgos o comandos.

## Desarrollo y compilación — estado: verified/detected

- Typecheck: `bunx tsc --noEmit` → exit 0 en OrchestOS.
- Scripts y CLI: leer `package.json` y ejecutar el script exacto definido por el proyecto.
- Bundling: no se detecta script de bundling genérico; estado `missing` para una etapa que lo exija.
- Framework/build adicional: no detectado; no inventar Vite, Next, Webpack o esbuild como requisito.

## Tests — estado: detected

- Runner: Bun Test (`bun test`) es el runner configurado en CI y en el gate de seguridad.
- La suite puede requerir DB temporal/aislada, serialización o variables de entorno; usar el comando
  del proyecto (`bun run security:gate`) cuando se necesite el contrato completo.
- Unit, integración, E2E y cobertura se evalúan según la disciplina QA; `bun test` por sí solo no
  prueba que exista cobertura E2E ni que una prueba no sea vacía.

## Formato y lint — estado: missing

No se detectó un lint/formatter universal obligatorio en `package.json`. Si una tarea necesita uno,
detectar primero la configuración del proyecto y declarar la herramienta como `detected` antes de
usarla como gate.

## Dependencias y seguridad — estado: detected

- Dependencias: `package.json` + `bun.lock`; revisar lockfile y `bun audit` cuando el proyecto lo
  permita.
- Secretos: no imprimir API keys; revisar asignaciones, `.env`, logs y respuestas con el gate de
  secretos del proyecto.
- Código servidor/CLI: revisar filesystem, subprocesses, SSRF, permisos y datos persistidos.
- Código frontend: revisar XSS, CSP, origen/CSRF, exposición de datos y diferencias entre HTML estático
  y handlers de servidor.

## No asumir

- `bun test` no implica lint, typecheck, integración, E2E ni cobertura suficiente.
- Que exista TypeScript no implica que haya bundler o framework.
- Bun puede ejecutar `.ts` directamente, pero el deploy puede requerir otro artefacto o runtime.
- Un script disponible en `package.json` puede depender de DB, red, credenciales o binarios externos.
- Si no existe comando equivalente, marcar `missing`/`blocked`; nunca reportar `pass` por omisión.
- Para una library, service, CLI o dashboard, detectar entrypoints y entrega por separado.

