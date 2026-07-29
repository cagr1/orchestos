import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findSecrets, redactSensitive } from '../security/secrets.ts'
import { RunLogger } from '../run/logger.ts'
import { errorResponse } from '../dashboard/http.ts'

describe('secret detection and redaction', () => {
  it('detects provider keys, bearer tokens, private keys, and credential assignments', () => {
    const providerKey = ['sk-or-v1-', '12345678901234567890123456789012'].join('')
    const bearer = ['Bearer ', 'abcdefghijklmnopqrstuvwxyz123456'].join('')
    const privateKey = ['-----BEGIN RSA ', 'PRIVATE KEY-----', 'secret', '-----END RSA ', 'PRIVATE KEY-----'].join('\n')
    const credentialName = ['pass', 'word'].join('')
    const credentialValue = ['correct-horse-', 'battery-staple-1234'].join('')
    const text = [
      `OPENROUTER_API_KEY=${providerKey}`,
      `Authorization: ${bearer}`,
      privateKey,
      `${credentialName} = "${credentialValue}"`,
    ].join('\n')

    expect(findSecrets(text).map(finding => finding.kind).sort()).toEqual([
      'bearer-token', 'credential-assignment', 'private-key', 'provider-key',
    ])
  })

  it('does not flag documented placeholders used by tests and examples', () => {
    const text = 'OPENROUTER_API_KEY=sk-test-or-key\nTOKEN=example-token-value\npassword=fake-password-value'
    expect(findSecrets(text)).toEqual([])
  })

  it('redacts values without returning their contents', () => {
    const secret = ['sk-or-v1-', '12345678901234567890123456789012'].join('')
    const redacted = redactSensitive(`Authorization: Bearer ${secret}`)
    expect(redacted).not.toContain(secret)
    expect(redacted).toContain('[REDACTED:provider-key]')
  })

  it('redacts secrets before writing logs and HTTP errors', async () => {
    const secret = ['sk-or-v1-', '12345678901234567890123456789012'].join('')
    const root = mkdtempSync(join(tmpdir(), 'secrets-log-test-'))
    try {
      const logger = new RunLogger(root, 'secret-fixture')
      logger.error(`provider failed: ${secret}`)
      const log = readFileSync(join(root, 'runs', readdirSync(join(root, 'runs'))[0]!), 'utf8')
      expect(log).not.toContain(secret)
      expect(log).toContain('[REDACTED:provider-key]')

      const response = errorResponse(`provider failed: ${secret}`, 502)
      const body = await response.json() as { error: string }
      expect(body.error).not.toContain(secret)
      expect(body.error).toContain('[REDACTED:provider-key]')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
