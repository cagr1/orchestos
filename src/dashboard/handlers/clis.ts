import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isMap, parseDocument } from 'yaml'
import { loadOrcheConfig } from '../../config/load.ts'
import { orchestosDir } from '../../config/orchestos-home.ts'
import type { CustomCliConfig } from '../../config/schema.ts'
import {
  configuredClis,
  customCliValidationError,
  KNOWN_CLIS,
} from '../../run/executors/cli-registry.ts'
import { errorResponse, jsonResponse } from '../http.ts'

export function handleApiClisGet(): Response {
  return jsonResponse({
    clis: configuredClis().map((cli) => ({ ...cli, installed: Bun.which(cli.command) !== null })),
  })
}

export async function handleApiClisSet(req: Request, root = process.cwd()): Promise<Response> {
  let body: { clis?: unknown }
  try {
    body = await req.json()
  } catch {
    return errorResponse('JSON inválido', 400)
  }
  if (!body || !Array.isArray(body.clis)) return errorResponse('clis debe ser una lista', 400)
  const ids = new Set(KNOWN_CLIS.map((cli) => cli.id))
  for (const [index, entry] of body.clis.entries()) {
    const error = customCliValidationError(entry, ids)
    if (error)
      return errorResponse(`clis[${index}]${error.startsWith('.') ? '' : ' '}${error}`, 400)
    ids.add(entry.id)
  }
  const clis = body.clis as CustomCliConfig[]
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
  if (clis.length)
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
  else document.delete('clis')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, document.toString(), 'utf8')
  return jsonResponse({ ok: true })
}
