import { hasLiveGateEvidence, requiresLiveGate, runCommand } from './agent-governance.ts'

export function main(root = process.cwd()): number {
  const names = runCommand(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
  if (names.exitCode !== 0) {
    console.error(names.stderr.trim())
    return 1
  }
  const paths = names.stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!requiresLiveGate(paths)) {
    console.log('✓ Gate en vivo: no aplica al diff staged')
    return 0
  }

  const planDiff = runCommand(['git', 'diff', '--cached', '--unified=0', '--', 'PLAN.md'], root)
  if (planDiff.exitCode !== 0) {
    console.error(planDiff.stderr.trim())
    return 1
  }
  if (!hasLiveGateEvidence(planDiff.stdout)) {
    console.error('✗ Cambio de dashboard/config sin cierre y evidencia en PLAN.md.')
    console.error(
      '  El mismo commit debe añadir [x] y una línea "Gate en vivo:" que cite navegador, browser o Playwright.',
    )
    return 1
  }
  console.log('✓ Gate en vivo documentado para dashboard/config')
  return 0
}

if (import.meta.main) process.exit(main())
