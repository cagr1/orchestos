import { lookup } from 'dns/promises'

// Wrapper to normalize dns/promises return type (LookupAddress[] | LookupAddress → array)
async function defaultLookup(hostname: string, options: { all?: boolean; family?: number }): Promise<Array<{ address: string; family: number }>> {
  return lookup(hostname, options) as Promise<Array<{ address: string; family: number }>>
}

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0'])

type LookupFn = (hostname: string, options: { all?: boolean; family?: number }) => Promise<Array<{ address: string; family: number }>>

export function ipToUint32(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map(Number)
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0
}

export function isPrivateIP(ip: string): boolean {
  const addr = ipToUint32(ip)
  if (addr === null) return false

  if ((addr & 0xff000000) >>> 0 === 0x7f000000) return true  // 127.0.0.0/8
  if ((addr & 0xff000000) >>> 0 === 0x0a000000) return true  // 10.0.0.0/8
  if ((addr & 0xfff00000) >>> 0 === 0xac100000) return true  // 172.16.0.0/12
  if ((addr & 0xffff0000) >>> 0 === 0xc0a80000) return true  // 192.168.0.0/16
  if ((addr & 0xffff0000) >>> 0 === 0xa9fe0000) return true  // 169.254.0.0/16

  return false
}

/**
 * SSRF guard — checks whether a URL is safe to fetch.
 * Returns null if safe, or an error string describing why it was blocked.
 * Same rigor pattern as enforceContract in src/run/contract.ts.
 * @param lookupFn — test-only injection seam; defaults to dns/promises.lookup
 */
export async function checkSsrSafe(parsed: URL, lookupFn?: LookupFn): Promise<string | null> {
  const resolveDns = lookupFn ?? defaultLookup
  const hostname = parsed.hostname.toLowerCase()

  if (LOCALHOST_NAMES.has(hostname)) {
    return `[SSRF blocked: cannot fetch from localhost — ${parsed.hostname}]`
  }

  if (hostname === '::1' || hostname === '::' || hostname.startsWith('fe80:')) {
    return `[SSRF blocked: cannot fetch from IPv6 localhost/link-local — ${parsed.hostname}]`
  }

  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  if (isIPv4) {
    if (isPrivateIP(hostname)) {
      return `[SSRF blocked: cannot fetch from private IP range — ${parsed.hostname}]`
    }
    return null
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    return `[SSRF blocked: cannot fetch from local/reserved domain — ${parsed.hostname}]`
  }

  try {
    // Uses the OS resolver (getaddrinfo) — same resolution path as fetch() itself,
    // unlike dns.resolve4() which queries DNS servers directly over port 53 and
    // fails with ECONNREFUSED in networks that block/restrict raw DNS queries
    // (corporate proxies, VPNs, sandboxes) even though normal hostname resolution
    // works fine there.
    const addresses = await resolveDns(hostname, { all: true, family: 4 })
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
