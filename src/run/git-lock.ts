import { join } from 'path'
import { withFileLock } from './file-lock.ts'

export function withGitLock<T>(projectRoot: string, fn: () => T): T {
  return withFileLock(join(projectRoot, '.orchestos', 'git.lock'), fn)
}
