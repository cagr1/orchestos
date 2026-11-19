import { check, z } from './index.ts'

const resultSchema = z.object({
  content: z.unknown().optional(),
  structuredContent: z.unknown().optional(),
})
const contentSchema = z.array(z.unknown())
const wrappedContentSchema = z.object({ content: contentSchema })
const textSchema = z.object({ type: z.literal('text'), text: z.string() })

/** Keep textual MCP output in timeline steps without copying image/base64 payloads. */
export function mcpResultText(input: unknown): string | undefined {
  const result = check(resultSchema, input)
  if (!result.ok) return undefined
  const structured = check(wrappedContentSchema, result.data.structuredContent)
  const content = check(
    contentSchema,
    result.data.content ??
      (structured.ok ? structured.data.content : result.data.structuredContent),
  )
  if (!content.ok) return undefined
  const texts = content.data.flatMap((block) => {
    const text = check(textSchema, block)
    return text.ok ? [text.data.text] : []
  })
  return texts.join('\n') || undefined
}
