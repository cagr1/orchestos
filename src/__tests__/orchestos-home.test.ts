import { afterEach, describe, expect, it } from 'bun:test'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { orchestosDir, orchestosHome } from '../config/orchestos-home.ts'

const originalHome = process.env.ORCHESTOS_HOME

afterEach(() => {
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
})

describe('orchestos-home', () => {
  it('usa ORCHESTOS_HOME para resolver .orchestos', () => {
    const root = join(tmpdir(), 'orchestos-home-test')
    process.env.ORCHESTOS_HOME = root
    expect(orchestosDir()).toBe(join(root, '.orchestos'))
  })

  it('usa el home del usuario cuando ORCHESTOS_HOME no está definido', () => {
    delete process.env.ORCHESTOS_HOME
    expect(orchestosHome()).toBe(homedir())
    expect(orchestosDir()).toBe(join(homedir(), '.orchestos'))
  })

  it('lee ORCHESTOS_HOME en cada llamada', () => {
    const first = join(tmpdir(), 'orchestos-home-first')
    const second = join(tmpdir(), 'orchestos-home-second')
    process.env.ORCHESTOS_HOME = first
    expect(orchestosDir()).toBe(join(first, '.orchestos'))
    process.env.ORCHESTOS_HOME = second
    expect(orchestosDir()).toBe(join(second, '.orchestos'))
  })
})
