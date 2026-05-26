import type { StackProfile } from './agents-md.ts'

export function generateContextJson(profile: StackProfile): object {
  const { manifest, languages, conventions, commands } = profile
  return {
    version: 1,
    name: manifest.name,
    runtime: manifest.runtime,
    framework: manifest.framework,
    languages: languages.map(l => ({ lang: l.lang, pct: l.pct })),
    conventions: {
      prettier: !!conventions.prettier,
      eslint: !!conventions.eslint,
      editorconfig: !!conventions.editorconfig,
      tsconfig: conventions.tsconfig ?? null,
    },
    commands,
  }
}
