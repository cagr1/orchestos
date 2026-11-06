---
source: MemoriesMD/wiki/roadmaps/frontend.md
state: known
imported: 2026-07-29
---

# Roadmap de disciplina — Frontend

Estado global: `known`. Contenido promovido desde el vault; debe verificarse contra el proyecto real.

## Núcleo no negociable — estado: known

- HTML semántico, accesibilidad, SEO básico, formularios y validación.
- CSS con layout real (Grid/Flexbox) y responsive design antes de depender de utilidades.
- Entender DOM, JavaScript y fetch/Ajax sin delegar el razonamiento al framework.
- Git y un package manager como parte del entorno básico.
- Elegir un framework y profundizarlo, en vez de usar varios superficialmente.
- Testing unitario y una herramienta de integración/E2E.
- CORS, HTTPS, CSP y OWASP como seguridad frontend, no como nota exclusiva del backend.

## Performance medible — estado: known

Prioridad alta: peso de página menor a 1500 KB (ideal menor a 500 KB), carga menor a 3 s, GZIP/Brotli,
TTFB menor a 1.3 s, JavaScript no bloqueante, CSS crítico e imágenes comprimidas en formatos correctos,
con cache headers configurados.

Prioridad media: HTML/CSS minificados, CDN, lazy-loading fuera del viewport y dependencias al día.

Prioridad baja: preload, WOFF2, preconnect y prevención de FOIT.

Estas métricas deben medirse con la herramienta que el proyecto tenga disponible (Lighthouse,
PageSpeed, WebPageTest u otra), no declararse por inspección visual.

## Decisiones recurrentes — estado: known

- SSR/SSG solo si SEO o TTFB lo exige; no como default automático.
- TypeScript como mejora esperada cuando el ecosistema lo soporte.
- CSS plano, Modules, CSS-in-JS, Panda o shadcn son alternativas; ninguna reemplaza los fundamentos.

## Fuera de foco — estado: known

Web Components avanzados, PWAs, desktop, mobile y GraphQL client-side no bloquean evaluar un frontend
normal; se incorporan bajo demanda.

## No asumir

Detectar framework, bundler, runtime, package manager, lint/format, estrategia de renderizado, soporte
de navegadores, accesibilidad, E2E y métricas reales. Un frontend que “se ve bien” no equivale a uno
verificado en performance o accesibilidad.

