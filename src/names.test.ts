import { describe, expect, it } from 'vitest'
import { COMPANY_NAMES, pickCompanyName } from './names'

describe('company names', () => {
  it('never offers the same name twice', () => {
    // The pool is cross-produced, so a careless addition to either list can silently collide —
    // and a duplicate would quietly shrink the pool rather than fail.
    expect(new Set(COMPANY_NAMES).size).toBe(COMPANY_NAMES.length)
  })

  it('produces the names that prompted the formula', () => {
    // If a rework of the lists can no longer reach these, the register has drifted.
    for (const name of ['VIA Metro', 'Urban Rail', 'Metroway', 'Urban Subways', 'Metrolink']) {
      expect(COMPANY_NAMES).toContain(name)
    }
  })

  it('never says the mode twice', () => {
    expect(COMPANY_NAMES).not.toContain('Metropolitan Metro')
    // Nothing should read as "<mode> <same mode>" however the lists grow.
    const doubled = COMPANY_NAMES.filter(name => {
      const [first, second] = name.split(' ')
      if (!second) return false
      const a = first.toLowerCase()
      const b = second.toLowerCase()
      return a.startsWith(b) || b.startsWith(a)
    })
    expect(doubled).toEqual([])
  })

  it('skips names already on the map', () => {
    const taken = new Set(COMPANY_NAMES.slice(0, COMPANY_NAMES.length - 1))
    expect(pickCompanyName(taken)).toBe(COMPANY_NAMES[COMPANY_NAMES.length - 1])
  })

  it('stays unique once the bank is exhausted', () => {
    const taken = new Set(COMPANY_NAMES)
    const next = pickCompanyName(taken)
    expect(taken.has(next)).toBe(false)
    expect(next).toMatch(/ 2$/)
  })
})
