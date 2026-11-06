import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { checkHooks, findOpenPlanItem, runCommand } from './agent-governance.ts'
import { parseScopeArg } from './scope-lock.ts'

interface Args {
  item?: string
  agent?: string
  scope?: string
  hooksOnly: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { hooksOnly: argv.includes('--hooks-only') }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--item') args.item = argv[++i]
    if (argv[i] === '--agent') args.agent = argv[++i]
    if (argv[i] === '--scope') args.scope = argv[++i]
  }
  return args
}

const ACTIVE_ITEM_PATH = '.orchestos/active-item.json'

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

  function readActiveItem(dir: string): { item: string } | null {
    try {
      const parsed = JSON.parse(readFileSync(resolve(dir, ACTIVE_ITEM_PATH), 'utf8')) as unknown
      const item = (parsed as { item?: unknown })?.item
      return typeof item === 'string' ? { item } : null
    } catch {
      return null
    }
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

  if (args.scope) {
    const scopePath = resolve(root, ACTIVE_ITEM_PATH)
    mkdirSync(dirname(scopePath), { recursive: true })
    writeFileSync(
      scopePath,
      JSON.stringify(
        {
          item: args.item,
          scope: parseScopeArg(args.scope),
          declaredAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
    console.log(`🔒 Scope declarado (${ACTIVE_ITEM_PATH}): ${args.scope}`)
  } else {
    // H.7.4 (2026-09-03) — `--item` y `--scope` eran independientes: sin `--scope`
    // el preflight validaba un ítem y dejaba OTRO declarado en active-item.json,
    // en silencio. Eso no era cosmético desde H.7.4: ese archivo alimenta el
    // handoff que el hook SessionStart inyecta en cada sesión nueva, así que el
    // asistente arrancaba afirmando un ítem activo equivocado — peor que no
    // inyectar nada. Caso real: preflight de H.7.4 con H.7.3 declarado del día
    // anterior. Se avisa, no se corrige solo: declarar scope es un acto
    // deliberado del agente, no un efecto secundario.
    const declared = readActiveItem(root)
    if (declared && declared.item !== args.item) {
      console.warn(
        `⚠ ${ACTIVE_ITEM_PATH} sigue declarando ${declared.item}, pero este preflight es de ${args.item}.`,
      )
      console.warn(
        `  El handoff y el scope-lock leen ese archivo: volvé a correr con --scope para actualizarlo.`,
      )
    }
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
