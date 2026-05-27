import { existsSync } from 'fs'
import { join } from 'path'
import type { Resolver, RepoIndex } from '../resolver-registry.ts'

export const rustResolver: Resolver = {
  language: 'rust',
  resolve(importStr: string, _fromFile: string, repo: RepoIndex): string | null {
    let crateRelative: string

    if (importStr.startsWith('use crate::')) {
      crateRelative = importStr.replace(/^use crate::/, '').replace(/;$/, '').trim()
    } else if (importStr.startsWith('mod ')) {
      // "mod foo;" — single-segment module declaration
      crateRelative = importStr.replace(/^mod\s+/, '').replace(/;$/, '').trim()
    } else {
      return null
    }

    // Strip alias ("foo::Bar as Alias") and brace groups ("foo::{A, B}")
    crateRelative = crateRelative.replace(/\s+as\s+\w+/, '').replace(/\{[^}]*\}/, '').trim()

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
