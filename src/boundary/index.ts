import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

export { z }

export type BoundaryResult<T> = { ok: true; data: T } | { ok: false; error: string }

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

export function check<S extends z.ZodType>(schema: S, value: unknown): BoundaryResult<z.infer<S>> {
  let result: z.ZodSafeParseResult<z.infer<S>>
  try {
    result = schema.safeParse(value) as z.ZodSafeParseResult<z.infer<S>>
  } catch (error) {
    // Un transform o refine que lanza no debe escapar de la puerta: todo error vuelve como ok:false.
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: formatIssues(result.error.issues) }
}

export function parseJson<S extends z.ZodType>(
  schema: S,
  text: string,
): BoundaryResult<z.infer<S>> {
  const source = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1')
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    return {
      ok: false,
      error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return check(schema, value)
}

export function parseYamlText<S extends z.ZodType>(
  schema: S,
  text: string,
): BoundaryResult<z.infer<S>> {
  let value: unknown
  try {
    value = parseYaml(text)
  } catch (error) {
    return {
      ok: false,
      error: `invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return check(schema, value)
}

export async function readBody<S extends z.ZodType>(
  schema: S,
  req: Request,
): Promise<BoundaryResult<z.infer<S>>> {
  let value: unknown
  try {
    value = await req.json()
  } catch {
    return { ok: false, error: 'invalid JSON body' }
  }
  return check(schema, value)
}

export function badRequest(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const timeoutMs: z.ZodNumber = z.number().int().min(1).max(2_147_483_647)
