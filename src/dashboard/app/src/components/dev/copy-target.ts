export function assistantCopyTarget(
  exchange: { id: string; assistantMessage?: { id: number | string; content: string } },
  visibleText: string,
): { id: string; text: string } | null {
  if (!visibleText) return null
  if (exchange.assistantMessage) {
    return {
      id: exchange.assistantMessage.id.toString(),
      text: visibleText,
    }
  }
  return { id: `live-${exchange.id}`, text: visibleText }
}
