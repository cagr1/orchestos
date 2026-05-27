import { mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

/** Writes structured run events to runs/YYYY-MM-DD-HH-mm.log in the project root. */
export class RunLogger {
  private readonly logPath: string
  private readonly prefix: string   // e.g. "[t1-normal]"

  constructor(root: string, taskId: string) {
    const now = new Date()
    const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-')
    const logsDir = join(root, 'runs')
    mkdirSync(logsDir, { recursive: true })
    this.logPath = join(logsDir, `${stamp}.log`)
    this.prefix  = `[${taskId}]`
    this.write('START')
  }

  done()                             { this.write('DONE') }
  qaPass(reason: string)             { this.write(`QA:pass  ${reason}`) }
  qaFail(reason: string, retry: number, max: number) {
    this.write(`QA:fail  retry=${retry}/${max}  ${reason}`)
  }
  failedPermanent(reason: string)    { this.write(`FAILED_PERMANENT  ${reason}`) }
  blocked(dep: string)               { this.write(`BLOCKED  dep="${dep}"`) }
  contractViolation(paths: string[]) { this.write(`CONTRACT_VIOLATION  ${paths.join(', ')}`) }
  inputAutoSuggested(paths: string[]) { this.write(`INPUT:auto-suggested ${paths.join(', ')}`) }
  error(msg: string)                 { this.write(`ERROR  ${msg}`) }
  info(msg: string)                  { this.write(`INFO   ${msg}`) }

  private write(event: string) {
    const ts = new Date().toISOString().slice(11, 23)   // HH:mm:ss.mmm
    appendFileSync(this.logPath, `${ts}  ${this.prefix}  ${event}\n`, 'utf-8')
  }
}
