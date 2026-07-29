/** Content from tools, files, OCR, imports, and the web has no instruction authority. */
export function untrustedContent(source: string, content: string): string {
  const safeSource = source.replace(/["<>]/g, '')
  return `<untrusted-data source="${safeSource}">\n${content}\n</untrusted-data>`
}
