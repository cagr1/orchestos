import { describe, it, expect } from 'bun:test'
import { isPrivateIP, ipToUint32, checkSsrSafe } from '../dashboard/ssrf.ts'

describe('ipToUint32', () => {
  it('converts 127.0.0.1 correctly', () => {
    expect(ipToUint32('127.0.0.1')).toBe(0x7f000001)
  })

  it('converts 0.0.0.0 to 0', () => {
    expect(ipToUint32('0.0.0.0')).toBe(0)
  })

  it('converts 192.168.1.1 correctly', () => {
    expect(ipToUint32('192.168.1.1')).toBe(0xc0a80101)
  })

  it('returns null for non-IPv4 string', () => {
    expect(ipToUint32('not-an-ip')).toBe(null)
  })

  it('returns null for out-of-range octet', () => {
    expect(ipToUint32('999.999.999.999')).toBe(null)
  })
})

describe('isPrivateIP', () => {
  const PRIVATE_EXAMPLES = [
    ['127.0.0.1', 'loopback'],
    ['127.255.255.255', '127.0.0.0/8 boundary'],
    ['10.0.0.1', '10.0.0.0/8'],
    ['10.255.255.255', '10.0.0.0/8 boundary'],
    ['172.16.0.1', '172.16.0.0/12 start'],
    ['172.31.255.255', '172.16.0.0/12 boundary'],
    ['192.168.0.1', '192.168.0.0/16'],
    ['192.168.255.255', '192.168.0.0/16 boundary'],
    ['169.254.0.1', '169.254.0.0/16'],
  ]
  for (const [ip, label] of PRIVATE_EXAMPLES) {
    it(`returns true for ${ip} (${label})`, () => {
      expect(isPrivateIP(ip as string)).toBe(true)
    })
  }

  const PUBLIC_EXAMPLES = [
    ['8.8.8.8', 'Google DNS'],
    ['93.184.216.34', 'example.com'],
    ['172.32.0.1', 'outside 172.16.0.0/12'],
  ]
  for (const [ip, label] of PUBLIC_EXAMPLES) {
    it(`returns false for ${ip} (${label})`, () => {
      expect(isPrivateIP(ip as string)).toBe(false)
    })
  }

  it('returns false for invalid string', () => {
    expect(isPrivateIP('invalid')).toBe(false)
  })
})

const mockLookup: (hostname: string, _opts: any) => Promise<Array<{ address: string; family: number }>> =
  async (hostname: string, _opts: unknown) => {
    if (hostname === 'internal.server.com') return [{ address: '192.168.1.1', family: 4 }]
    if (hostname === 'public.example.com') return [{ address: '93.184.216.34', family: 4 }]
    if (hostname === 'multihome.example.com') return [{ address: '10.0.0.1', family: 4 }, { address: '93.184.216.34', family: 4 }]
    if (hostname === 'internal6.example.com') return [{ address: '::ffff:10.0.0.1', family: 6 }]
    throw new Error('ENOTFOUND ' + hostname)
  }

describe('checkSsrSafe — direct IP/localhost', () => {
  it('blocks localhost', async () => {
    expect(await checkSsrSafe(new URL('http://localhost:8080/path'), mockLookup)).toMatch(/SSRF blocked.*localhost/)
  })

  it('blocks 127.0.0.1', async () => {
    expect(await checkSsrSafe(new URL('http://127.0.0.1/'), mockLookup)).toMatch(/SSRF blocked/)
  })

  it('blocks 0.0.0.0', async () => {
    expect(await checkSsrSafe(new URL('http://0.0.0.0/'), mockLookup)).toMatch(/SSRF blocked/)
  })

  it('blocks 10.x.x.x', async () => {
    expect(await checkSsrSafe(new URL('http://10.0.0.5/'), mockLookup)).toMatch(/SSRF blocked.*private IP/)
  })

  it('blocks 172.16.x.x', async () => {
    expect(await checkSsrSafe(new URL('http://172.16.0.50/'), mockLookup)).toMatch(/SSRF blocked.*private IP/)
  })

  it('blocks 172.31.x.x (still within 172.16.0.0/12)', async () => {
    expect(await checkSsrSafe(new URL('http://172.31.0.1/'), mockLookup)).toMatch(/SSRF blocked.*private IP/)
  })

  it('allows 172.32.x.x (outside 172.16.0.0/12)', async () => {
    expect(await checkSsrSafe(new URL('http://172.32.0.1/'), mockLookup)).toBe(null)
  })

  it('blocks 192.168.x.x', async () => {
    expect(await checkSsrSafe(new URL('http://192.168.1.1/'), mockLookup)).toMatch(/SSRF blocked.*private IP/)
  })

  it('blocks 169.254.x.x (link-local)', async () => {
    expect(await checkSsrSafe(new URL('http://169.254.0.1/'), mockLookup)).toMatch(/SSRF blocked.*private IP/)
  })

  it('allows public IP 8.8.8.8', async () => {
    expect(await checkSsrSafe(new URL('http://8.8.8.8/'), mockLookup)).toBe(null)
  })
})

describe('checkSsrSafe — DNS resolution', () => {
  it('blocks domain that resolves to private IP', async () => {
    const result = await checkSsrSafe(new URL('http://internal.server.com/'), mockLookup)
    expect(result).toMatch(/SSRF blocked.*resolves to private IP/)
  })

  it('allows domain that resolves to public IP', async () => {
    expect(await checkSsrSafe(new URL('http://public.example.com/'), mockLookup)).toBe(null)
  })

  it('blocks domain where ANY resolved IP is private', async () => {
    const result = await checkSsrSafe(new URL('http://multihome.example.com/'), mockLookup)
    expect(result).toMatch(/SSRF blocked.*resolves to private IP/)
  })

  it('blocks unresolvable domain', async () => {
    const result = await checkSsrSafe(new URL('http://nonexistent.invalid/'), mockLookup)
    expect(result).toMatch(/SSRF blocked.*cannot resolve/)
  })
})

describe('checkSsrSafe — reserved domains', () => {
  it('blocks .local domain', async () => {
    expect(await checkSsrSafe(new URL('http://server.local/'), mockLookup)).toMatch(/SSRF blocked.*local\/reserved/)
  })

  it('blocks .localhost domain', async () => {
    expect(await checkSsrSafe(new URL('http://myapp.localhost/'), mockLookup)).toMatch(/SSRF blocked.*local\/reserved/)
  })
})
