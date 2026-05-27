import type { Resolver, RepoIndex } from '../resolver-registry.ts'

const JVM_LANGS = new Set(['java', 'kotlin', 'scala', 'groovy'])
const JVM_EXTS = ['.java', '.kt', '.scala', '.groovy']

export const javaResolver: Resolver = {
  language: 'java',
  resolve(importStr: string, _fromFile: string, repo: RepoIndex): string | null {
    // Strip: "import static com.example.Util.method;" → "com.example.Util"
    //        "import com.example.Foo;"               → "com.example.Foo"
    const raw = importStr
      .replace(/^import\s+(static\s+)?/, '')
      .replace(/;$/, '')
      .trim()

    if (!raw) return null

    const isWildcard = raw.endsWith('.*')
    const dotPath = isWildcard ? raw.slice(0, -2) : raw
    const slashPath = dotPath.replace(/\./g, '/')

    if (isWildcard) {
      // Any file inside that package directory
      const prefix = slashPath + '/'
      return repo.files.find(f => JVM_LANGS.has(f.language) && f.path.includes(prefix))?.path ?? null
    }

    // Specific class — try each JVM extension, match file ending with slashPath + ext
    for (const ext of JVM_EXTS) {
      const suffix = slashPath + ext
      const found = repo.files.find(f => f.path === suffix || f.path.endsWith('/' + suffix))
      if (found) return found.path
    }

    return null
  },
}
