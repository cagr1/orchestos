import { homedir } from 'node:os'
import { join } from 'node:path'

export function orchestosHome(): string {
  return process.env.ORCHESTOS_HOME || homedir()
}

export function orchestosDir(): string {
  return join(orchestosHome(), '.orchestos')
}
