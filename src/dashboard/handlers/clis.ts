import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isMap, parse, parseDocument } from 'yaml'
import { loadOrcheConfig } from '../../config/load.ts'
import { orchestosDir } from '../../config/orchestos-home.ts'
import type { CustomCliConfig } from '../../config/schema.ts'
import { whichCli } from '../../run/executors/cli-discovery.ts'
import {
  configuredClis,
  customCliValidationError,
  KNOWN_CLIS,
} from '../../run/executors/cli-registry.ts'
import { errorResponse, jsonResponse } from '../http.ts'

function hiddenClis(): string[] {
  try {
    const value = parse(readFileSync(join(orchestosDir(), 'config.yaml'), 'utf8'))?.hiddenClis
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : []
  } catch {
    return []
  }
}

export function handleApiClisGet(): Response {
  return jsonResponse({
    hiddenClis: hiddenClis(),
    clis: configuredClis().map((cli) => ({ ...cli, installed: whichCli(cli.command) !== null })),
  })
}

export async function handleApiClisSet(req: Request, root = process.cwd()): Promise<Response> {
  let body: { clis?: unknown; hiddenClis?: unknown }
  try {
    body = await req.json()
  } catch {
    return errorResponse('JSON inválido', 400)
  }
  if (!body || (body.clis === undefined && body.hiddenClis === undefined))
    return errorResponse('clis debe ser una lista', 400)
  if (body.clis !== undefined && !Array.isArray(body.clis))
    return errorResponse('clis debe ser una lista', 400)
  if (
    body.hiddenClis !== undefined &&
    (!Array.isArray(body.hiddenClis) ||
      !body.hiddenClis.every((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id)))
  )
    return errorResponse('hiddenClis debe ser una lista de IDs', 400)
  const entries = (body.clis ?? configuredClis()) as unknown[]
  const ids = new Set(KNOWN_CLIS.map((cli) => cli.id))
  for (const [index, entry] of entries.entries()) {
    const error = customCliValidationError(entry, ids)
    if (error)
      return errorResponse(`clis[${index}]${error.startsWith('.') ? '' : ' '}${error}`, 400)
    ids.add((entry as CustomCliConfig).id)
  }
  const clis = entries as CustomCliConfig[]
  const kept = new Set(clis.map((cli) => cli.id))
  const removed = configuredClis().filter((cli) => !kept.has(cli.id))
  const config = loadOrcheConfig(root)
  for (const cli of removed) {
    if (config.roles.executor?.agent === cli.id)
      return errorResponse('Está asignado como Ejecutor: cambia el Ejecutor antes de quitarlo', 400)
    if (config.taskAgentRules?.some((rule) => rule.agent === cli.id))
      return errorResponse('Está asignado en una regla: cambia la regla antes de quitarlo', 400)
  }
  const directory = orchestosDir()
  const path = join(directory, 'config.yaml')
  const document = parseDocument(existsSync(path) ? readFileSync(path, 'utf8') : '')
  if (document.errors.length || (document.contents !== null && !isMap(document.contents)))
    return errorResponse('Config global inválida', 400)
  // Persist only the declaration fields; `installed` is derived from PATH.
  if (body.hiddenClis !== undefined)
    document.set('hiddenClis', [...new Set(body.hiddenClis as string[])])
  if (body.clis !== undefined && clis.length)
    document.set(
      'clis',
      clis.map(({ id, label, command, args, modelArgs, models, timeoutMs }) => ({
        id,
        label,
        command,
        args,
        ...(modelArgs === undefined ? {} : { modelArgs }),
        ...(models === undefined ? {} : { models }),
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      })),
    )
  else if (body.clis !== undefined) document.delete('clis')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, document.toString(), 'utf8')
  return jsonResponse({ ok: true })
}
