/** Content from tools, files, OCR, imports, and the web has no instruction authority. */
export function untrustedContent(source: string, content: string): string {
  const safeSource = source.replace(/["<>]/g, '')
  // Una marca dentro del contenido no puede cerrar ni abrir el bloque (qa MSG.1).
  const safeContent = content.replace(/<(\/?)untrusted-data/gi, '&lt;$1untrusted-data')
  return `<untrusted-data source="${safeSource}">\n${safeContent}\n</untrusted-data>`
}
