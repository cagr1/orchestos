import { join } from 'node:path'
import { orchestosDir } from '../config/orchestos-home.ts'

export function previewDir(projectId: string): string {
  if (!projectId || /[/\\\0]/.test(projectId) || projectId.includes('..'))
    throw new Error('Invalid preview project id')
  return join(orchestosDir(), 'previews', projectId)
}

export function validPreviewShotName(name: string): boolean {
  return /^[\w.-]+\.png$/.test(name) && !name.includes('..')
}
