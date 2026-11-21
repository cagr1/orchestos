import { parseJson, z } from '../../boundary/index.ts'

const LatestVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
})

export type CliLatestFetcher = (
  url: string,
  init: { signal: AbortSignal },
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

export function createCliLatestReader(
  fetcher: CliLatestFetcher = fetch,
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
          (async () => {
            const response = await fetcher(`https://registry.npmjs.org/${npmPackage}/latest`, {
              signal: controller.signal,
            })
            if (!response.ok) return null
            const parsed = parseJson(LatestVersionSchema, await response.text())
            return parsed.ok ? parsed.data.version : null
          })(),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              resolve(null)
              controller.abort()
            }, 5_000)
          }),
        ])
        entry.expires = now() + (version === null ? 60 * 60_000 : 24 * 60 * 60_000)
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

export const readCliLatest = createCliLatestReader()
