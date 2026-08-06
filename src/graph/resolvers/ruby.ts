import { existsSync } from 'fs'
import { dirname, join, normalize } from 'path'
import type { Resolver, RepoIndex } from '../resolver-registry.ts'

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

export const rubyResolver: Resolver = {
  // languageFor() en graph/index.ts produce la extensión sin punto — 'rb'
  // para archivos .rb, mismo criterio que 'go'/'java' (S.1 destapó que
  // 'rust'/'csharp' no seguían este criterio; acá se sigue desde el inicio).
  language: 'rb',
  resolve(importStr: string, fromFile: string, repo: RepoIndex): string | null {
    // `extractRubyImports()` ya normalizó todo `require_relative` con `./` al
    // frente (siempre relativo, por semántica del lenguaje) — acá alcanza con
    // mirar el prefijo para saber cuál de las dos formas es.
    if (importStr.startsWith('.')) {
      const base = toPosix(normalize(join(dirname(fromFile), importStr)))
      const candidate = `${base}.rb`
      return existsSync(join(repo.projectRoot, candidate)) ? candidate : null
    }

    // `require 'foo/bar'` es resolución por $LOAD_PATH — puede ser una gema
    // externa (no hay archivo local, y NO se adivina uno). Se prueban las dos
    // convenciones reales más comunes de un repo Ruby: relativo a la raíz del
    // proyecto, y relativo a `lib/` (el directorio que casi todo proyecto/gema
    // agrega al load path). Sin match en ninguna, `null` — cero invención.
    for (const candidate of [`${importStr}.rb`, `lib/${importStr}.rb`]) {
      if (existsSync(join(repo.projectRoot, candidate))) return candidate
    }
    return null
  },
}
