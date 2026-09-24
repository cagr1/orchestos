import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_PLAN_BYTES = 1_048_576

export interface PlanDocItem {
  checked: boolean
  text: string
  depth: number
}

export interface PlanDocSection {
  title: string
  level: number
  items: PlanDocItem[]
  text: string
}

export interface PlanDoc {
  exists: boolean
  sections: PlanDocSection[]
}

function emptyPlanDoc(): PlanDoc {
  return { exists: false, sections: [] }
}

/** Read a project's PLAN.md as inert, display-only markdown structure. */
export function readPlanDoc(root: string): PlanDoc {
  const path = join(root, 'PLAN.md')
  let stat
  try {
    stat = statSync(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyPlanDoc()
    throw error
  }
  if (!stat.isFile()) return emptyPlanDoc()
  if (stat.size > MAX_PLAN_BYTES)
    throw new Error(`PLAN.md exceeds the 1 MB read limit (${stat.size} bytes)`)

  const source = readFileSync(path, 'utf8')
  if (Buffer.byteLength(source, 'utf8') > MAX_PLAN_BYTES)
    throw new Error('PLAN.md exceeds the 1 MB read limit')

  const sections: PlanDocSection[] = []
  for (const line of source.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      const [, hashes, title] = heading
      if (!hashes || !title) continue
      sections.push({ title, level: hashes.length, items: [], text: '' })
      continue
    }

    const section = sections.at(-1)
    if (!section) continue
    const item = /^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/.exec(line)
    if (item) {
      const [, whitespace, marker, text] = item
      if (whitespace === undefined || !marker || text === undefined) continue
      const indentation = whitespace.replace(/\t/g, '  ').length
      section.items.push({
        checked: marker.toLowerCase() === 'x',
        text,
        depth: Math.floor(indentation / 2),
      })
      continue
    }
    if (line.trim()) section.text = section.text ? `${section.text}\n${line}` : line
  }

  return { exists: true, sections }
}
