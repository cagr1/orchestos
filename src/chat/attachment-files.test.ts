import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'
import { decodeImageDataUrl, writeChatImages } from './attachment-files.ts'

const PNG = `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`
const JPEG = `data:image/jpeg;base64,${Buffer.from('jpg-bytes').toString('base64')}`

describe('decodeImageDataUrl', () => {
  it('acepta png y jpeg (jpeg → .jpg)', () => {
    expect(decodeImageDataUrl(PNG)?.ext).toBe('png')
    expect(decodeImageDataUrl(JPEG)?.ext).toBe('jpg')
    expect(decodeImageDataUrl(PNG)?.bytes.toString()).toBe('png-bytes')
  })
  it('rechaza mime raro, no-base64 y vacío', () => {
    expect(decodeImageDataUrl('data:image/svg+xml;base64,AAAA')).toBeNull()
    expect(decodeImageDataUrl('data:text/plain;base64,AAAA')).toBeNull()
    expect(decodeImageDataUrl('data:image/png;utf8,hola')).toBeNull()
    expect(decodeImageDataUrl('data:image/png;base64,')).toBeNull()
  })
})

describe('writeChatImages', () => {
  it('escribe fuera del proyecto, conserva el orden y borra el directorio', () => {
    const out = writeChatImages([PNG, 'data:image/svg+xml;base64,AAAA', JPEG])
    expect(dirname(out.dir)).toBe(tmpdir().replace(/\/$/, ''))
    expect(out.paths[1]).toBeNull()
    expect(readFileSync(out.paths[0]!, 'utf8')).toBe('png-bytes')
    expect(out.paths[2]!.endsWith('image-3.jpg')).toBe(true)
    out.cleanup()
    expect(existsSync(out.dir)).toBe(false)
  })
})
