import { existsSync } from 'fs'
import { join } from 'path'
import type { RepoIndex, Resolver } from '../resolver-registry.ts'

export const rustResolver: Resolver = {
  // S (Mes 26, 2026-08-06) — debe ser 'rs', el valor real que produce
  // languageFor() (extensión de archivo sin punto) en graph/index.ts, que es
  // la clave con la que resolveWithRegistry() busca en el registry. Con
  // 'rust' el registry nunca encontraba este resolver — 0/2 edges resueltos
  // en los fixtures reales, verificado antes del fix.
  language: 'rs',
  resolve(importStr: string, _fromFile: string, repo: RepoIndex): string | null {
    let crateRelative: string

    // S (Mes 26, 2026-08-06) — `importStr` acá es `edge.specifier`, no `edge.raw`.
    // `extractRustImports()` (graph/index.ts) captura el grupo de la regex SIN
    // el prefijo `use `/`mod ` (ej. specifier = "crate::models::User", nunca
    // "use crate::models::User"). El check original comparaba contra el string
    // CON el prefijo — nunca podía ser true, este resolver no resolvía nada,
    // para ningún input, desde que se escribió (verificado con los fixtures
    // reales: 0/2 edges antes de este fix).
    if (importStr.startsWith('crate::')) {
      crateRelative = importStr
        .replace(/^crate::/, '')
        .replace(/;$/, '')
        .trim()
    } else {
      // `mod foo;` no tiene equivalente hoy en `extractRustImports()` (solo
      // extrae `use` y `extern crate`) — no hay ningún specifier con esa forma
      // que llegue hasta acá. No se agrega esa extracción en este fix.
      return null
    }

    // Strip alias ("foo::Bar as Alias") and brace groups ("foo::{A, B}")
    crateRelative = crateRelative
      .replace(/\s+as\s+\w+/, '')
      .replace(/\{[^}]*\}/, '')
      .trim()

    const segments = crateRelative.split('::').filter(Boolean)
    if (segments.length === 0) return null

    // Try from longest prefix down — last segments may be items (structs/fns), not files
    for (let len = segments.length; len >= 1; len--) {
      const prefix = segments.slice(0, len).join('/')
      for (const candidate of [`src/${prefix}.rs`, `src/${prefix}/mod.rs`]) {
        if (existsSync(join(repo.projectRoot, candidate))) return candidate
      }
    }

    return null
  },
}
