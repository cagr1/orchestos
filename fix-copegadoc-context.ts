import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const db = new Database(join(homedir(), '.orchestos', 'db.sqlite'))
const path = 'E:\\Carlos\\Development Tools\\Proyectos\\CopegaDoc'
const agentsMd = readFileSync('E:\\Carlos\\Development Tools\\Proyectos\\CopegaDoc\\AGENTS.md', 'utf-8')

const r = db.run('UPDATE projects SET agents_md = ? WHERE path = ?', [agentsMd, path])
console.log(`Updated ${r.changes} row(s). agents_md length: ${agentsMd.length} chars`)
