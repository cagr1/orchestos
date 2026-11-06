import { afterEach, describe, expect, it } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { orchestosDir, orchestosHome } from '../config/orchestos-home.ts'

const originalHome = process.env.ORCHESTOS_HOME

afterEach(() => {
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
})

describe('orchestos-home', () => {
  it('usa ORCHESTOS_HOME para resolver .orchestos', () => {
    process.env.ORCHESTOS_HOME = '/tmp/orchestos-home-test'
    expect(orchestosDir()).toBe('/tmp/orchestos-home-test/.orchestos')
  })

  it('usa el home del usuario cuando ORCHESTOS_HOME no está definido', () => {
    delete process.env.ORCHESTOS_HOME
    expect(orchestosHome()).toBe(homedir())
    expect(orchestosDir()).toBe(join(homedir(), '.orchestos'))
  })

  it('lee ORCHESTOS_HOME en cada llamada', () => {
    process.env.ORCHESTOS_HOME = '/tmp/orchestos-home-first'
    expect(orchestosDir()).toBe('/tmp/orchestos-home-first/.orchestos')
    process.env.ORCHESTOS_HOME = '/tmp/orchestos-home-second'
    expect(orchestosDir()).toBe('/tmp/orchestos-home-second/.orchestos')
  })
})
