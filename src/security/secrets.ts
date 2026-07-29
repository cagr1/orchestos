export type SecretKind =
  | 'private-key'
  | 'provider-key'
  | 'github-token'
  | 'aws-access-key'
  | 'bearer-token'
  | 'credential-assignment'

export interface SecretFinding {
  kind: SecretKind
}

const PLACEHOLDER_WORDS = [
  'test', 'fake', 'dummy', 'example', 'placeholder', 'changeme', 'redacted', 'not-a-real',
]

const DETECTORS: Array<{ kind: SecretKind; pattern: RegExp }> = [
  { kind: 'private-key', pattern: /-----BEGIN [A-Z0-9\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9\s]+PRIVATE KEY-----/g },
  { kind: 'provider-key', pattern: /\b(?:sk-or-v1-[A-Za-z0-9_-]{20,}|sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{24,})\b/g },
  { kind: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { kind: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi },
  {
    kind: 'credential-assignment',
    pattern: /\b(?:api[_-]?key|token|secret|password|private[_-]?key|authorization)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{16,})["']?/gi,
  },
]

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase()
  return PLACEHOLDER_WORDS.some(word => normalized.includes(word))
}

function hasSpecificSecretKind(value: string): boolean {
  return /^(?:sk-or-v1-|sk-ant-api\d{2}-|sk-|gh[pousr]_|github_pat_|AKIA|Bearer\s)/i.test(value)
}

export function findSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = []
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0
    for (const match of text.matchAll(detector.pattern)) {
      const value = match[0]
      const credential = detector.kind === 'credential-assignment' ? (match[1] ?? value) : value
      if (!isPlaceholder(credential) && !(detector.kind === 'credential-assignment' && hasSpecificSecretKind(credential))) {
        findings.push({ kind: detector.kind })
      }
    }
  }
  return findings
}

export function redactSensitive(text: string): string {
  let redacted = text
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0
    redacted = redacted.replace(detector.pattern, (...args: unknown[]) => {
      const full = String(args[0])
      const captures = args.slice(1, -2).map(value => typeof value === 'string' ? value : undefined)
      const credential = detector.kind === 'credential-assignment' ? (captures[0] ?? full) : full
      return isPlaceholder(credential) ? full : `[REDACTED:${detector.kind}]`
    })
  }
  return redacted
}
