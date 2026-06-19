import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { getSkillPath, getProSkillPath, loadSkill, listSkillFiles, listProSkillFiles, validateSkill } from '../../skills/registry.ts'
import { compileSkill } from '../../skills/compile.ts'
import { chat as openrouterChat } from '../../providers/openrouter.ts'
import { parse, stringify } from 'yaml'
import type { SkillRow, SkillBuildResponse, SkillProRow, SkillCurateResponse, SkillImportResponse, MutationResult } from '../types.ts'
import { jsonResponse, errorResponse } from '../http.ts'
import { CURATOR_SYSTEM, IMPORT_SYSTEM } from '../prompts/curator.ts'

function handleApiSkillsList(): Response {
  try {
    const files = listSkillFiles()
    const skills: SkillRow[] = []
    for (const f of files) {
      try {
        const s = loadSkill(f)
        skills.push({
          id: s.id,
          name: s.name,
          description: s.description,
          version: s.version,
          targets: [...s.targets],
          instructionSummary: s.instructions.length > 100
            ? s.instructions.slice(0, 100) + '...'
            : s.instructions,
        })
      } catch {}
    }
    return jsonResponse(skills)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsGet(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)
  try {
    const skill = loadSkill(path)
    return jsonResponse(skill)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsExport(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)\/export$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)
  try {
    const yaml = readFileSync(path, 'utf-8')
    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(id)}.yaml"`,
      },
    })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

async function handleApiSkillsCreate(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return errorResponse('Invalid JSON', 400) }

  const id = body.id as string
  if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    return errorResponse('Invalid id — must be kebab-case', 400)
  }

  const path = getSkillPath(id)
  if (existsSync(path)) return errorResponse('Skill already exists', 409)

  try {
    const validated = validateSkill(body, `api:${id}`)
    const yaml = stringify(validated, { lineWidth: 120 })
    writeFileSync(path, yaml, 'utf-8')
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiSkillsUpdate(req: Request, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return errorResponse('Invalid JSON', 400) }

  try {
    const validated = validateSkill(body, `api:${id}`)
    const yaml = stringify(validated, { lineWidth: 120 })
    writeFileSync(path, yaml, 'utf-8')
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiSkillsDelete(req: Request, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  let body: { confirm?: boolean }
  try { body = await req.json() as { confirm?: boolean } } catch { return errorResponse('Invalid JSON', 400) }
  if (body.confirm !== true) return errorResponse('Confirmation required — send { confirm: true }', 400)

  try {
    unlinkSync(path)
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsBuild(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)\/build$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  try {
    const skill = loadSkill(path)
    const paths = compileSkill(skill)
    return jsonResponse({ ok: true, paths, skillId: id } satisfies SkillBuildResponse)
  } catch (e: any) {
    return jsonResponse({ ok: false, paths: [], skillId: id, error: e.message } as SkillBuildResponse & { error: string }, 500)
  }
}

function handleApiSkillsProList(): Response {
  try {
    const files = listProSkillFiles()
    const skills: SkillProRow[] = []
    for (const f of files) {
      try {
        const s = loadSkill(f)
        skills.push({
          id: s.id,
          name: s.name,
          description: s.description,
          targets: [...s.targets],
          imported: existsSync(getSkillPath(s.id)),
        })
      } catch {}
    }
    return jsonResponse(skills)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsProImport(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/pro\/([^/]+)\/import$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]

  const proPath = getProSkillPath(id)
  if (!existsSync(proPath)) return errorResponse('Pro skill not found', 404)

  const targetPath = getSkillPath(id)
  if (existsSync(targetPath)) return errorResponse('Skill already exists', 409)

  try {
    const skill = loadSkill(proPath)
    const yaml = stringify(skill, { lineWidth: 120 })
    writeFileSync(targetPath, yaml, 'utf-8')
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

async function handleApiSkillsImport(req: Request): Promise<Response> {
  let body: { type?: string; url?: string; yaml?: string }
  try { body = await req.json() as { type?: string; url?: string; yaml?: string } } catch { return errorResponse('Invalid JSON', 400) }

  let rawYaml: string
  let sourceDesc: string

  if (body.type === 'url') {
    if (!body.url) return errorResponse('url is required', 400)
    sourceDesc = `URL: ${body.url}`
    try {
      const resp = await fetch(body.url, { signal: AbortSignal.timeout(15000) })
      if (!resp.ok) return errorResponse(`HTTP ${resp.status} fetching URL`, 400)
      rawYaml = await resp.text()
    } catch (e: any) {
      return errorResponse(`Failed to fetch URL: ${e.message}`, 400)
    }
  } else if (body.type === 'yaml') {
    if (!body.yaml) return errorResponse('yaml content is required', 400)
    sourceDesc = 'pasted YAML'
    rawYaml = body.yaml
  } else {
    return errorResponse('type must be "url" or "yaml"', 400)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parse(rawYaml) as Record<string, unknown>
  } catch (e: any) {
    return normalizeImport(rawYaml, `YAML syntax error: ${e.message}`, sourceDesc)
  }

  if (typeof parsed.id === 'string') {
    parsed.id = parsed.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  try {
    validateSkill(parsed, 'import')
    return jsonResponse({ ok: true, skill: parsed, normalized: false, warnings: [], iterations: 0 } satisfies SkillImportResponse)
  } catch (e: any) {
    return normalizeImport(rawYaml, e.message, sourceDesc)
  }
}

async function normalizeImport(rawYaml: string, error: string, sourceDesc: string): Promise<Response> {
  const MAX_RETRIES = 2
  let lastError = error

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userMessage = attempt === 0
      ? `Fix this invalid skill definition:\n\n${rawYaml}\n\nValidation error: ${lastError}`
      : `Previous fix failed. Error: ${lastError}\n\nOriginal content:\n${rawYaml}\n\nPlease return a corrected JSON.`

    let raw: string
    try {
      const resp = await openrouterChat({
        model: 'anthropic/claude-haiku-4-5',
        system: IMPORT_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      })
      raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    } catch (e: any) {
      return errorResponse(`LLM normalization failed: ${e.message}`, 502)
    }

    let draft: Record<string, unknown>
    try {
      draft = JSON.parse(raw) as Record<string, unknown>
    } catch {
      lastError = 'Response was not valid JSON'
      continue
    }

    if (typeof draft.id === 'string') {
      draft.id = draft.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    }

    try {
      validateSkill(draft, 'import')
      return jsonResponse({ ok: true, skill: draft, normalized: true, warnings: [`Original ${sourceDesc} had issues: ${error}. Fixed by AI curator.`], iterations: attempt + 1 } satisfies SkillImportResponse)
    } catch (e: any) {
      lastError = e.message
    }
  }

  return jsonResponse(
    { ok: false, error: `Could not normalize after ${MAX_RETRIES + 1} attempts: ${lastError}`, normalized: false, warnings: [], iterations: MAX_RETRIES + 1 } satisfies SkillImportResponse,
    422
  )
}

async function handleApiSkillsCurate(req: Request): Promise<Response> {
  let body: { text?: string }
  try { body = await req.json() as { text?: string } } catch { return errorResponse('Invalid JSON', 400) }
  const text = body.text?.trim()
  if (!text) return errorResponse('text is required', 400)

  const MAX_RETRIES = 2
  let lastError = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userMessage = attempt === 0
      ? text
      : `${text}\n\nPrevious attempt failed validation with this error: ${lastError}\nPlease fix the issue and return a corrected JSON.`

    let raw: string
    try {
      const resp = await openrouterChat({
        model: 'anthropic/claude-haiku-4-5',
        system: CURATOR_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      })
      raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    } catch (e: any) {
      return errorResponse(`LLM call failed: ${e.message}`, 502)
    }

    let draft: Record<string, unknown>
    try {
      draft = JSON.parse(raw) as Record<string, unknown>
    } catch {
      lastError = 'Response was not valid JSON'
      continue
    }

    if (typeof draft.id === 'string') {
      draft.id = draft.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    }

    try {
      validateSkill(draft, 'curate')
      return jsonResponse({ ok: true, skill: draft, iterations: attempt + 1 } satisfies SkillCurateResponse)
    } catch (e: any) {
      lastError = e.message
    }
  }

  return jsonResponse(
    { ok: false, error: `Curator failed after ${MAX_RETRIES + 1} attempts: ${lastError}`, iterations: MAX_RETRIES + 1 } satisfies SkillCurateResponse,
    422
  )
}

export { handleApiSkillsList, handleApiSkillsGet, handleApiSkillsExport, handleApiSkillsCreate, handleApiSkillsUpdate, handleApiSkillsDelete, handleApiSkillsBuild, handleApiSkillsProList, handleApiSkillsProImport, handleApiSkillsImport, handleApiSkillsCurate }
