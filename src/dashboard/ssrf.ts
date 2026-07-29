import { lookup } from 'dns/promises'

// Wrapper to normalize dns/promises return type (LookupAddress[] | LookupAddress → array)
async function defaultLookup(hostname: string, options: { all?: boolean; family?: number }): Promise<Array<{ address: string; family: number }>> {
  return lookup(hostname, options) as Promise<Array<{ address: string; family: number }>>
}

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0'])

export type LookupFn = (hostname: string, options: { all?: boolean; family?: number }) => Promise<Array<{ address: string; family: number }>>

function ipv6ToBigInt(ip: string): bigint | null {
  let value = ip.toLowerCase().split('%')[0] ?? ''
  if (!value.includes(':')) return null
  const dotted = value.match(/(^|:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted?.[2]) {
    const octets = dotted[2].split('.').map(Number)
    if (octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null
    value = value.slice(0, -(dotted[2].length)) + `${((octets[0]! << 8) | octets[1]!).toString(16)}:${((octets[2]! << 8) | octets[3]!).toString(16)}`
  }
  const halves = value.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const groups = [...left, ...(halves.length === 2 ? Array(8 - left.length - right.length).fill('0') : []), ...right]
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.reduce((acc, group) => (acc << 16n) | BigInt(parseInt(group, 16)), 0n)
}

function ipv6InRange(ip: bigint, base: bigint, bits: number): boolean {
  const shift = 128n - BigInt(bits)
  return (ip >> shift) === (base >> shift)
}

export function ipToUint32(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map(Number)
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0
}

export function isPrivateIP(ip: string): boolean {
  const addr = ipToUint32(ip)
  if (addr !== null) {
    if ((addr & 0xff000000) >>> 0 === 0x7f000000) return true  // 127.0.0.0/8
    if ((addr & 0xff000000) >>> 0 === 0x0a000000) return true  // 10.0.0.0/8
    if ((addr & 0xfff00000) >>> 0 === 0xac100000) return true  // 172.16.0.0/12
    if ((addr & 0xffff0000) >>> 0 === 0xc0a80000) return true  // 192.168.0.0/16
    if ((addr & 0xffff0000) >>> 0 === 0xa9fe0000) return true  // 169.254.0.0/16
    return false
  }

  const v6 = ipv6ToBigInt(ip)
  if (v6 === null) return false
  // IPv4-mapped IPv6 addresses must receive the IPv4 policy too.
  if (v6 >> 32n === 0xffffn) return isPrivateIP(`${Number((v6 >> 24n) & 255n)}.${Number((v6 >> 16n) & 255n)}.${Number((v6 >> 8n) & 255n)}.${Number(v6 & 255n)}`)
  return v6 === 0n || v6 === 1n || ipv6InRange(v6, 0xfc000000000000000000000000000000n, 7) ||
    ipv6InRange(v6, 0xfe800000000000000000000000000000n, 10) ||
    ipv6InRange(v6, 0xff000000000000000000000000000000n, 8)
}

/**
 * SSRF guard — checks whether a URL is safe to fetch.
 * Returns null if safe, or an error string describing why it was blocked.
 * Same rigor pattern as enforceContract in src/run/contract.ts.
 * @param lookupFn — test-only injection seam; defaults to dns/promises.lookup
 */
export async function checkSsrSafe(parsed: URL, lookupFn?: LookupFn): Promise<string | null> {
  const resolveDns = lookupFn ?? defaultLookup
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return `[SSRF blocked: unsupported URL scheme — ${parsed.protocol}]`
  if (parsed.username || parsed.password) return '[SSRF blocked: URL credentials are not allowed]'
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)

  if (LOCALHOST_NAMES.has(hostname)) {
    return `[SSRF blocked: cannot fetch from localhost — ${parsed.hostname}]`
  }

  if (!isIPv4 && isPrivateIP(hostname)) {
    return `[SSRF blocked: cannot fetch from IPv6 localhost/link-local — ${parsed.hostname}]`
  }

  if (isIPv4) {
    if (isPrivateIP(hostname)) {
      return `[SSRF blocked: cannot fetch from private IP range — ${parsed.hostname}]`
    }
    return null
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return `[SSRF blocked: non-standard port ${parsed.port} is not allowed]`

  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    return `[SSRF blocked: cannot fetch from local/reserved domain — ${parsed.hostname}]`
  }

  try {
    // Uses the OS resolver (getaddrinfo) — same resolution path as fetch() itself,
    // unlike dns.resolve4() which queries DNS servers directly over port 53 and
    // fails with ECONNREFUSED in networks that block/restrict raw DNS queries
    // (corporate proxies, VPNs, sandboxes) even though normal hostname resolution
    // works fine there.
    const addresses = await resolveDns(hostname, { all: true })
    for (const { address } of addresses) {
      if (isPrivateIP(address)) {
        return `[SSRF blocked: ${parsed.hostname} resolves to private IP ${address}]`
      }
    }
  } catch {
    return `[SSRF blocked: cannot resolve ${parsed.hostname} — refusing to fetch]`
  }

  return null
}
