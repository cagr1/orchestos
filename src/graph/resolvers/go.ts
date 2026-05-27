import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Resolver, RepoIndex } from '../resolver-registry.ts'

// module path cache keyed by projectRoot (empty string = no go.mod found)
const modCache = new Map<string, string>()

function readModulePath(projectRoot: string): string {
  const hit = modCache.get(projectRoot)
  if (hit !== undefined) return hit

  const goMod = join(projectRoot, 'go.mod')
  if (!existsSync(goMod)) { modCache.set(projectRoot, ''); return '' }

  try {
    const src = readFileSync(goMod, 'utf-8')
    const m = src.match(/^module\s+(\S+)/m)
    const mod = m?.[1] ?? ''
    modCache.set(projectRoot, mod)
    return mod
  } catch {
    modCache.set(projectRoot, '')
    return ''
  }
}

export const goResolver: Resolver = {
  language: 'go',
  resolve(importStr: string, _fromFile: string, repo: RepoIndex): string | null {
    // importStr: `"github.com/user/repo/pkg/foo"` or bare path
    const raw = importStr.replace(/^["']|["']$/g, '').trim()

    const modulePath = readModulePath(repo.projectRoot)
    if (!modulePath || !raw.startsWith(modulePath)) return null

    // Strip module prefix → local package directory, e.g. "pkg/foo"
    const localPkg = raw.slice(modulePath.length).replace(/^\//, '')
    if (!localPkg) return null

    // Find any indexed .go file whose path starts with that package directory
    const match = repo.files.find(
      f => f.language === 'go' && f.path.startsWith(localPkg + '/'),
    )
    return match?.path ?? null
  },
}
