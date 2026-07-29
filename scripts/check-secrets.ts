#!/usr/bin/env bun
import { readFileSync } from 'fs'
import { findSecrets } from '../src/security/secrets.ts'

function runGitDiff(staged: boolean): string {
  const args = ['git', 'diff', '--no-ext-diff', '--unified=0']
  if (staged) args.splice(2, 0, '--cached')
  const result = Bun.spawnSync(args)
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || 'git diff failed')
  return result.stdout.toString()
}

function trackedPaths(): string[] {
  const result = Bun.spawnSync(['git', 'ls-files', '-z'])
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || 'git ls-files failed')
  return result.stdout.toString().split('\0').filter(Boolean)
}

function scanDiff(diff: string): Array<{ line: string; kind: string }> {
  const findings: Array<{ line: string; kind: string }> = []
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    for (const finding of findSecrets(line.slice(1))) findings.push({ line, kind: finding.kind })
  }
  return findings
}

const args = process.argv.slice(2)
const paths = args.includes('--tracked') ? trackedPaths() : args.filter(arg => !arg.startsWith('--'))
const diff = args.includes('--staged') ? runGitDiff(true) : ''
const findings = [
  ...scanDiff(diff),
  ...paths.flatMap(path => findSecrets(readFileSync(path, 'utf-8')).map(finding => ({ line: path, kind: finding.kind }))),
]

if (findings.length > 0) {
  console.error(`secret check failed: ${findings.length} possible secret(s) found`)
  for (const finding of findings) console.error(`  ${finding.kind} in ${finding.line.startsWith('+') ? 'added diff line' : finding.line}`)
  process.exit(1)
}

console.log('secret check passed: no supported secret patterns found')
