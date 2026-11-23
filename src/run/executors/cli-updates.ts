import { parseJson, z } from '../../boundary/index.ts'
import type { CliLatestSource } from './cli-install-method.ts'

const LatestVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
})

export type CliLatestFetcher = (
  url: string,
  init: { signal: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; text(): Promise<string> }>

export function compareVersions(a: string, b: string): number {
  const left = a.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const right = b.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference) return Math.sign(difference)
  }
  return 0
}

function createCachedReader(
  lookup: (key: string, signal: AbortSignal) => Promise<string | null>,
  now: () => number = Date.now,
) {
  const cache = new Map<string, { expires: number; value: Promise<string | null> }>()
  return (npmPackage: string, refresh = false): Promise<string | null> => {
    const cached = cache.get(npmPackage)
    if (!refresh && cached && cached.expires > now()) return cached.value
    const entry = { expires: Number.POSITIVE_INFINITY, value: Promise.resolve<string | null>(null) }
    entry.value = (async () => {
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const version = await Promise.race([
          lookup(npmPackage, controller.signal),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              resolve(null)
              controller.abort()
            }, 5_000)
          }),
        ])
        entry.expires = now() + (version === null ? 60 * 60_000 : 6 * 60 * 60_000)
        return version
      } catch {
        entry.expires = now() + 60 * 60_000
        return null
      } finally {
        clearTimeout(timer)
      }
    })()
    cache.set(npmPackage, entry)
    return entry.value
  }
}

export function createCliLatestReader(fetcher: CliLatestFetcher = fetch, now = Date.now) {
  return createCachedReader(async (pkg, signal) => {
    const response = await fetcher(`https://registry.npmjs.org/${pkg}/latest`, { signal })
    if (!response.ok) return null
    const parsed = parseJson(LatestVersionSchema, await response.text())
    return parsed.ok ? parsed.data.version : null
  }, now)
}

const ReleasesSchema = z.array(
  z.object({ tag_name: z.string(), draft: z.boolean(), prerelease: z.boolean() }),
)
export function createGithubLatestReader(fetcher: CliLatestFetcher = fetch, now = Date.now) {
  return createCachedReader(async (repo, signal) => {
    const response = await fetcher(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'orchestos' },
    })
    if (!response.ok) return null
    const parsed = parseJson(ReleasesSchema, await response.text())
    if (!parsed.ok) return null
    const versions = parsed.data
      .filter(
        (release) =>
          !release.draft && !release.prerelease && /^v?\d+\.\d+\.\d+$/.test(release.tag_name),
      )
      .map((release) => release.tag_name.replace(/^v/, ''))
    return versions.sort((a, b) => compareVersions(b, a))[0] ?? null
  }, now)
}
export const readCliLatest = createCliLatestReader()
export const readGithubLatest = createGithubLatestReader()
export function readLatestFor(source: CliLatestSource, refresh = false): Promise<string | null> {
  return source.kind === 'npm'
    ? readCliLatest(source.pkg, refresh)
    : readGithubLatest(source.repo, refresh)
}
