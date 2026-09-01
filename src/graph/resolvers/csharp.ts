import { readFileSync } from 'fs'
import { join } from 'path'
import type { RepoIndex, Resolver } from '../resolver-registry.ts'

// namespace → file paths, keyed by projectRoot
const nsCache = new Map<string, Map<string, string[]>>()

function buildNsMap(repo: RepoIndex): Map<string, string[]> {
  const hit = nsCache.get(repo.projectRoot)
  if (hit) return hit

  const map = new Map<string, string[]>()
  for (const f of repo.files) {
    if (f.language !== 'cs') continue
    try {
      const src = readFileSync(join(repo.projectRoot, f.path), 'utf-8')
      const m = src.match(/\bnamespace\s+([\w.]+)/)
      if (m?.[1]) {
        const ns = m[1]
        const list = map.get(ns) ?? []
        list.push(f.path)
        map.set(ns, list)
      }
    } catch {
      /* unreadable — skip */
    }
  }

  nsCache.set(repo.projectRoot, map)
  return map
}

export const csharpResolver: Resolver = {
  // S (Mes 26, 2026-08-06) — debe ser 'cs' (el valor real de languageFor()),
  // mismo bug que rust.ts: con 'csharp' el registry nunca encontraba este
  // resolver Y el filtro interno de buildNsMap() de abajo tampoco matcheaba
  // ningún archivo — doble fallo, 0/3 edges resueltos en los fixtures reales.
  language: 'cs',
  resolve(importStr: string, _fromFile: string, repo: RepoIndex): string | null {
    // Handle: "using X.Y.Z;" or bare "X.Y.Z"
    const ns = importStr
      .replace(/^using\s+/, '')
      .replace(/;$/, '')
      .trim()
    // Skip: using static X, using Alias = X (contain spaces or =)
    if (!ns || /[\s=()]/.test(ns)) return null

    const map = buildNsMap(repo)
    const files = map.get(ns)
    if (!files || files.length === 0) return null
    if (files.length === 1) return files[0] ?? null

    // Multiple files share the namespace — prefer the one whose basename matches
    // the last namespace segment (e.g. "Services" → Services.cs)
    const lastSeg = (ns.split('.').at(-1) ?? '').toLowerCase()
    const best = files.find((f) => {
      const base = (f.split(/[\\/]/).at(-1) ?? '').replace(/\.cs$/i, '').toLowerCase()
      return base === lastSeg
    })
    return best ?? files[0] ?? null
  },
}
