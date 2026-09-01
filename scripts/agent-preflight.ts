import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkHooks, findOpenPlanItem, runCommand } from './agent-governance.ts'

interface Args {
  item?: string
  agent?: string
  hooksOnly: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { hooksOnly: argv.includes('--hooks-only') }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--item') args.item = argv[++i]
    if (argv[i] === '--agent') args.agent = argv[++i]
  }
  return args
}

export function main(argv = process.argv.slice(2), root = resolve('.')): number {
  const args = parseArgs(argv)
  const hookErrors = checkHooks(root)
  if (hookErrors.length > 0) {
    console.error('✗ Hooks inválidos:')
    for (const error of hookErrors) console.error(`  - ${error}`)
    console.error('  Ejecuta: bun run hooks:install')
    return 1
  }
  if (args.hooksOnly) {
    console.log('✓ Hooks instalados y sincronizados')
    return 0
  }

  for (const file of ['AGENTS.md', 'CLAUDE.md', 'docs/agent-work-protocol.md', 'PLAN.md']) {
    if (!existsSync(resolve(root, file))) {
      console.error(`✗ Falta regla obligatoria: ${file}`)
      return 1
    }
  }
  if (!args.item) {
    console.error('✗ Falta --item <ID>; ningún agente puede editar sin un ítem abierto de PLAN.md')
    return 1
  }

  const plan = readFileSync(resolve(root, 'PLAN.md'), 'utf8')
  if (!findOpenPlanItem(plan, args.item)) {
    console.error(`✗ El ítem ${args.item} no existe o no está abierto en PLAN.md`)
    return 1
  }

  const status = runCommand(['git', 'status', '--short', '--branch'], root)
  if (status.exitCode !== 0) {
    console.error(status.stderr.trim())
    return 1
  }

  console.log(`✓ Preflight ${args.item}${args.agent ? ` · agente: ${args.agent}` : ''}`)
  console.log(
    'Reglas leídas requeridas: AGENTS.md · CLAUDE.md · docs/agent-work-protocol.md · PLAN.md',
  )
  console.log('Estado actual (cambios existentes se consideran ajenos hasta verificarlo):')
  console.log(status.stdout.trim() || '(limpio)')
  console.log('Siguiente gate: bunx tsc --noEmit + suite relevante antes de editar')
  return 0
}

if (import.meta.main) process.exit(main())
