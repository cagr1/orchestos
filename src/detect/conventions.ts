import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'

export interface TsConfig {
  target?: string
  module?: string
  strict?: boolean
}

export interface Conventions {
  editorconfig: string | null
  prettier: string | null
  eslint: string | null
  tsconfig: TsConfig | null
}

function readTruncated(path: string, maxLines = 40): string {
  const lines = readFileSync(path, 'utf-8').split('\n')
  return lines.slice(0, maxLines).join('\n')
}

export async function readConventions(root: string): Promise<Conventions> {
  const result: Conventions = { editorconfig: null, prettier: null, eslint: null, tsconfig: null }

  // .editorconfig
  const editorPath = join(root, '.editorconfig')
  if (existsSync(editorPath)) result.editorconfig = readTruncated(editorPath)

  // prettier — varios nombres posibles
  const prettierCandidates = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.ts', 'prettier.config.js', 'prettier.config.ts', 'prettier.config.mjs']
  for (const candidate of prettierCandidates) {
    const p = join(root, candidate)
    if (existsSync(p)) { result.prettier = readTruncated(p); break }
  }

  // eslint — varios nombres posibles
  const eslintCandidates = await glob('{eslint.config.*,.eslintrc,.eslintrc.*}', { cwd: root })
  if (eslintCandidates.length > 0) result.eslint = readTruncated(join(root, eslintCandidates[0]))

  // tsconfig.json — extraer target, module, strict
  const tsconfigPath = join(root, 'tsconfig.json')
  if (existsSync(tsconfigPath)) {
    try {
      const raw = readFileSync(tsconfigPath, 'utf-8')
        .replace(/\/\/.*$/gm, '')   // strip // comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // strip /* */ comments
      const tsconfig = JSON.parse(raw)
      const co = tsconfig.compilerOptions ?? {}
      result.tsconfig = {
        target: co.target,
        module: co.module,
        strict: co.strict,
      }
    } catch { /* malformed tsconfig, skip */ }
  }

  return result
}
