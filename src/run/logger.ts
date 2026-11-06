import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { redactSensitive } from '../security/secrets.ts'
import { excludeRuntimeArtifacts } from './git-exclude.ts'

/** Writes structured run events to runs/YYYY-MM-DD-HH-mm.log in the project root. */
export class RunLogger {
  private readonly logPath: string
  private readonly prefix: string // e.g. "[t1-normal]"
  private writeWarningEmitted = false

  constructor(root: string, taskId: string) {
    excludeRuntimeArtifacts(root)
    const now = new Date()
    const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-')
    const logsDir = join(root, 'runs')
    mkdirSync(logsDir, { recursive: true })
    this.logPath = join(logsDir, `${stamp}.log`)
    this.prefix = `[${taskId}]`
    this.write('START')
  }

  done() {
    this.write('DONE')
  }
  qaPass(reason: string) {
    this.write(`QA:pass  ${reason}`)
  }
  qaFail(reason: string, retry: number, max: number) {
    this.write(`QA:fail  retry=${retry}/${max}  ${reason}`)
  }
  failedPermanent(reason: string) {
    this.write(`FAILED_PERMANENT  ${reason}`)
  }
  blocked(dep: string) {
    this.write(`BLOCKED  dep="${dep}"`)
  }
  contractViolation(paths: string[]) {
    this.write(`CONTRACT_VIOLATION  ${paths.join(', ')}`)
  }
  error(msg: string) {
    this.write(`ERROR  ${msg}`)
  }
  info(msg: string) {
    this.write(`INFO   ${msg}`)
  }

  private write(event: string) {
    const ts = new Date().toISOString().slice(11, 23) // HH:mm:ss.mmm
    const line = `${ts}  ${this.prefix}  ${redactSensitive(event)}\n`
    try {
      appendFileSync(this.logPath, line, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          mkdirSync(dirname(this.logPath), { recursive: true })
          appendFileSync(this.logPath, line, 'utf-8')
          return
        } catch (retryError) {
          this.warnWriteFailure(retryError)
          return
        }
      }
      this.warnWriteFailure(error)
    }
  }

  private warnWriteFailure(error: unknown) {
    if (this.writeWarningEmitted) return
    this.writeWarningEmitted = true
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[run-logger] no se pudo escribir ${this.logPath}: ${message}\n`)
  }
}
