import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { orchestosDir } from './orchestos-home.ts'

export interface UserProfile {
  codes: boolean | null
}

export function readUserProfile(): UserProfile {
  try {
    const value = JSON.parse(readFileSync(join(orchestosDir(), 'profile.json'), 'utf8'))
    return { codes: typeof value?.codes === 'boolean' ? value.codes : null }
  } catch {
    return { codes: null }
  }
}

export function writeUserProfile(profile: { codes: boolean }): void {
  const directory = orchestosDir()
  mkdirSync(directory, { recursive: true })
  const path = join(directory, 'profile.json')
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify({ codes: profile.codes })}\n`, { mode: 0o600 })
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}
