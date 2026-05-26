import type { SkillDef } from '../registry.ts'

// Output: JSON tool definition — OpenAI / Responses API compatible
export function compileOpenAI(skill: SkillDef): string {
  const tool = {
    type: 'function',
    function: {
      name: skill.id.replace(/-/g, '_'),
      description: `${skill.description}\n\n${skill.instructions}`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }
  return JSON.stringify(tool, null, 2)
}
