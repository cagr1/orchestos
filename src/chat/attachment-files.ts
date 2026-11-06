import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/

/** UI.24.6a — data URL de imagen → bytes + extensión; `null` si no es png/jpeg/gif/webp en base64. */
export function decodeImageDataUrl(url: string): { bytes: Buffer; ext: string } | null {
  const match = IMAGE_DATA_URL.exec(url)
  if (!match) return null
  const bytes = Buffer.from(match[2]!, 'base64')
  if (bytes.length === 0) return null
  return { bytes, ext: match[1] === 'jpeg' ? 'jpg' : match[1]! }
}

export interface ChatImageDir {
  dir: string
  /** Una ruta absoluta por imagen escrita, en el orden de entrada; `null` si esa imagen no se pudo escribir. */
  paths: (string | null)[]
  cleanup(): void
}

/**
 * UI.24.6a — escribe las imágenes del turno en un directorio temporal FUERA del
 * proyecto, para pasarlas al CLI como archivo. Quien llama borra con `cleanup()`.
 */
export function writeChatImages(dataUrls: string[]): ChatImageDir {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-chat-att-'))
  const paths = dataUrls.map((url, i) => {
    const decoded = decodeImageDataUrl(url)
    if (!decoded) return null
    try {
      const path = join(dir, `image-${i + 1}.${decoded.ext}`)
      writeFileSync(path, decoded.bytes)
      return path
    } catch {
      return null
    }
  })
  return { dir, paths, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
