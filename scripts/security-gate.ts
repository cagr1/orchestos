import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface GateCommand {
  label: string
  args: string[]
  env?: Record<string, string>
}

function run(command: GateCommand): void {
  console.log(`\n[security-gate] ${command.label}`)
  const result = Bun.spawnSync({
    cmd: command.args,
    env: { ...process.env, ...command.env },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (result.exitCode !== 0) {
    throw new Error(`${command.label} failed with exit code ${result.exitCode}`)
  }
}

const tempHome = mkdtempSync(join(tmpdir(), 'orchestos-security-gate-'))
const isolatedEnv = { ORCHESTOS_HOME: tempHome, NODE_ENV: 'test' }

try {
  run({ label: 'typecheck', args: ['bun', 'run', 'typecheck'] })
  run({ label: 'initialize isolated database', args: ['bun', 'run', 'db:migrate'], env: isolatedEnv })
  run({
    label: 'full test matrix with coverage',
    args: [
      'bun', 'test', '--coverage', '--timeout', '30000', '--isolate', '--parallel=1',
      '--reporter', 'dots', '--coverage-dir', 'coverage/security-gate',
    ],
    env: isolatedEnv,
  })
  run({ label: 'dependency audit (high+)', args: ['bun', 'audit', '--audit-level=high'] })
  console.log('\n[security-gate] PASS')
} finally {
  rmSync(tempHome, { recursive: true, force: true })
}
