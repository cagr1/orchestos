import { parse } from 'yaml'
import { type SkillDef, validateSkill } from './registry.ts'

/** GitHub blob/tree URLs are UI links; fetch only the corresponding raw file. */
export function skillMarkdownUrl(input: string): { fetchUrl: URL; sourceUrl: string } {
  const url = new URL(input)
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('Skill URL must use HTTP or HTTPS')
  if (url.username || url.password) throw new Error('Skill URL must not contain credentials')
  const parts = url.pathname.split('/').filter(Boolean)
  if (url.hostname === 'github.com') {
    const [owner, repo, kind, ref, ...path] = parts
    if (!owner || !repo || !ref || (kind !== 'blob' && kind !== 'tree'))
      throw new Error('Expected a GitHub SKILL.md or folder URL')
    if (kind === 'tree') path.push('SKILL.md')
    if (path.at(-1) !== 'SKILL.md') throw new Error('Expected a SKILL.md URL')
    const file = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.join('/')}`
    return {
      fetchUrl: new URL(file),
      sourceUrl: `https://github.com/${owner}/${repo}/tree/${ref}/${path.slice(0, -1).join('/')}`,
    }
  }
  if (parts.at(-1) !== 'SKILL.md') throw new Error('Expected a SKILL.md URL')
  if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
    const [owner, repo, ref, ...path] = parts
    return {
      fetchUrl: url,
      sourceUrl: `https://github.com/${owner}/${repo}/tree/${ref}/${path.slice(0, -1).join('/')}`,
    }
  }
  return { fetchUrl: url, sourceUrl: new URL('.', url).href }
}

export function convertSkillMarkdown(
  markdown: string,
  sourceUrl: string,
): { skill: SkillDef; warnings: string[] } {
  const match = markdown
    .replace(/^\uFEFF/, '')
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/)
  if (!match) throw new Error('SKILL.md must contain YAML frontmatter and a Markdown body')
  const frontmatter = parse(match[1]!)
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter))
    throw new Error('Invalid SKILL.md frontmatter')
  if (typeof frontmatter.name !== 'string') throw new Error('SKILL.md requires a name')
  const id = frontmatter.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const instructions = match[2]!.trim()
  const skill = validateSkill(
    {
      id,
      version: '1.0.0',
      name: frontmatter.name,
      description: frontmatter.description,
      instructions,
      targets: ['claude', 'openai'],
      source: { url: sourceUrl, fetchedAt: new Date().toISOString() },
    },
    'SKILL.md',
  )
  // Preserve links literally in instructions, but do not fetch auxiliary files.
  const links = new Set<string>()
  for (const link of instructions.matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)|^\[[^\]]+\]:\s*(\S+)/gm,
  )) {
    const target = link[1] ?? link[2]!
    if (/^(?:mailto:|#)/.test(target)) continue
    if (/^(?:https?:|\/\/)/.test(target)) {
      const linked = new URL(target, sourceUrl)
      const source = new URL(sourceUrl)
      const repo = source.pathname.split('/').filter(Boolean).slice(0, 2).join('/')
      if (linked.hostname !== source.hostname || !linked.pathname.startsWith(`/${repo}/`)) continue
    }
    links.add(target)
  }
  return { skill, warnings: [...links].map((link) => `Auxiliary file was not imported: ${link}`) }
}
