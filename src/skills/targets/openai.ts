import type { SkillDef } from '../registry.ts'
import { buildSections } from './_shared.ts'

// Output: JSON tool definition — OpenAI / Responses API compatible
export function compileOpenAI(skill: SkillDef, detectedLanguage?: string): string {
  const tool = {
    type: 'function',
    function: {
      name: skill.id.replace(/-/g, '_'),
      description: `${skill.description}\n\n${buildSections(skill, detectedLanguage).join('\n\n')}`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }
  return JSON.stringify(tool, null, 2)
}
