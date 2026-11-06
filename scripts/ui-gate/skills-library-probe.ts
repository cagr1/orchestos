// Loaded only by ui-gate when running skills-library. The application never
// reads this fixture capability or relaxes SSRF checks from an environment flag.
import { __setLibraryUrlCheckForTests } from '../../src/dashboard/handlers/skills.ts'
import { checkSsrSafe } from '../../src/dashboard/ssrf.ts'

const fixture = process.env.ORCHESTOS_GATE_SKILL_FIXTURE
if (fixture) {
  const url = new URL(fixture)
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/SKILL.md')
    throw new Error('Invalid skills-library fixture capability')
  __setLibraryUrlCheckForTests(async (candidate) =>
    candidate.href === url.href ? null : checkSsrSafe(candidate),
  )
}
