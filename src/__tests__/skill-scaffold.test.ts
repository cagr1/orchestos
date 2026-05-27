import { describe, it, expect } from 'bun:test'
import { scaffoldSkillYaml, SUPPORTED_LANGUAGES } from '../skills/scaffold.ts'
import { parse as parseYaml } from 'yaml'

describe('scaffoldSkillYaml', () => {
  it('generates valid YAML for TypeScript', () => {
    const yaml = scaffoldSkillYaml('TypeScript')
    expect(() => parseYaml(yaml)).not.toThrow()
  })

  it('generates valid YAML for C#', () => {
    const yaml = scaffoldSkillYaml('C#')
    expect(() => parseYaml(yaml)).not.toThrow()
  })

  it('generates valid YAML for Rust', () => {
    const yaml = scaffoldSkillYaml('Rust')
    expect(() => parseYaml(yaml)).not.toThrow()
  })

  it('generates valid YAML for R', () => {
    const yaml = scaffoldSkillYaml('R')
    expect(() => parseYaml(yaml)).not.toThrow()
  })

  it('generates valid YAML for unknown language (graceful fallback)', () => {
    const yaml = scaffoldSkillYaml('COBOL')
    expect(() => parseYaml(yaml)).not.toThrow()
  })

  it('respects custom skill id', () => {
    const yaml = scaffoldSkillYaml('Rust', 'my-rust-skill')
    const parsed = parseYaml(yaml)
    expect(parsed.id).toBe('my-rust-skill')
  })

  it('uses language name in default id', () => {
    const yaml = scaffoldSkillYaml('Visual Basic')
    const parsed = parseYaml(yaml)
    expect(parsed.id).toBe('visual-basic-development')
  })

  it('includes language_targets section', () => {
    const yaml = scaffoldSkillYaml('Go')
    expect(yaml).toContain('language_targets:')
  })

  it('includes real Go verifier (cargo → go test)', () => {
    const yaml = scaffoldSkillYaml('Go')
    expect(yaml).toContain('go test')
  })

  it('includes real Rust verifier (cargo test)', () => {
    const yaml = scaffoldSkillYaml('Rust')
    expect(yaml).toContain('cargo test')
  })

  it('includes dotnet test for C#', () => {
    const yaml = scaffoldSkillYaml('C#')
    expect(yaml).toContain('dotnet test')
  })

  it('includes dotnet test for Visual Basic', () => {
    const yaml = scaffoldSkillYaml('Visual Basic')
    expect(yaml).toContain('dotnet test')
  })

  it('includes pytest for Python', () => {
    const yaml = scaffoldSkillYaml('Python')
    expect(yaml).toContain('pytest')
  })

  it('generates the 3 standard targets', () => {
    const yaml = scaffoldSkillYaml('TypeScript')
    const parsed = parseYaml(yaml)
    expect(parsed.targets).toContain('claude')
    expect(parsed.targets).toContain('cursor')
    expect(parsed.targets).toContain('openai')
  })

  it('anti_patterns is non-empty', () => {
    for (const lang of ['TypeScript', 'Rust', 'Go', 'R', 'SQL']) {
      const yaml = scaffoldSkillYaml(lang)
      const parsed = parseYaml(yaml)
      expect(parsed.anti_patterns.length).toBeGreaterThan(0)
    }
  })
})
