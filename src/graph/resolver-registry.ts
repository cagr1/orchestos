/**
 * src/graph/resolver-registry.ts
 *
 * Pluggable import resolvers per language. Each language can register a
 * resolver that converts an import string to a relative file path within the project.
 *
 * Built-in JS/TS/Python relative resolution remains in index.ts's resolveImport().
 * This registry extends resolution for languages that need project-wide lookup
 * (C# namespaces, Rust crate paths, Go module paths, Java packages).
 */

export interface RepoIndex {
  projectRoot: string
  projectId: string
  /** All indexed files with their declared namespaces/packages (populated per resolver) */
  files: RepoFile[]
}

export interface RepoFile {
  path: string
  language: string
}

export interface Resolver {
  /** Language tag this resolver handles (e.g. 'cs', 'rs', 'go', 'java') */
  language: string
  /**
   * Given an import string from a file, return the resolved relative path
   * inside the project, or null if this resolver cannot resolve it.
   */
  resolve(importStr: string, fromFile: string, repo: RepoIndex): string | null
}

const registry = new Map<string, Resolver>()

export function registerResolver(resolver: Resolver): void {
  registry.set(resolver.language, resolver)
}

export function getResolver(language: string): Resolver | undefined {
  return registry.get(language)
}

export function resolveWithRegistry(
  language: string,
  importStr: string,
  fromFile: string,
  repo: RepoIndex,
): string | null {
  const resolver = registry.get(language)
  if (!resolver) return null
  return resolver.resolve(importStr, fromFile, repo)
}

export function listResolvers(): string[] {
  return Array.from(registry.keys())
}
