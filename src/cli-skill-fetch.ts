import { Command } from 'commander'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fetchSkill, listRemoteSkills } from './skills/fetch'

/**
 * Registers the "skill fetch" subcommands on the given skill Command object.
 */
export function registerSkillFetchCommands(skill: Command): void {
  skill
    .command('fetch')
    .description('Fetch or list skills from the autoskills registry')
    .option('--language <lang>', 'Language to fetch skills for')
    .option('--name <name>', 'Skill name to download')
    .option('--list', 'List available skills for common languages')
    .action(async (opts) => {
      if (opts.list) {
        const languages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp']
        for (const lang of languages) {
          try {
            const skills = await listRemoteSkills(lang)
            if (skills.length === 0) {
              console.log(`${lang}: (no skills found)`)
            } else {
              console.log(`${lang}: ${skills.join(', ')}`)
            }
          } catch (err: any) {
            console.error(`${lang}: error listing skills: ${err.message}`)
          }
        }
      } else if (opts.language && opts.name) {
        try {
          const yamlContent = await fetchSkill(opts.language, opts.name)
          const destDir = join(process.cwd(), 'skills')
          const destPath = join(destDir, opts.name + '.yaml')
          mkdirSync(destDir, { recursive: true })
          writeFileSync(destPath, yamlContent, 'utf-8')
          console.log(`[skill] Downloaded ${opts.name} → skills/${opts.name}.yaml`)
        } catch (err: any) {
          console.error(`Error: ${err.message}`)
        }
      } else if (opts.language) {
        // Only language provided, list skills for that language
        try {
          const skills = await listRemoteSkills(opts.language)
          skills.forEach(skillName => console.log(skillName))
        } catch (err: any) {
          console.error(`Error listing skills for ${opts.language}: ${err.message}`)
        }
      } else {
        console.error(`Usage: orchestos skill fetch [options]`)
        console.error(`  Use --list to see available skills for common languages`)
        console.error(`  Use --language <lang> to list skills for a specific language`)
        console.error(`  Use --language <lang> --name <name> to download a specific skill`)
      }
    })
}
