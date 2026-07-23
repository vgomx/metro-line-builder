import { describe, expect, it } from 'vitest'
import type { Line, LineKind } from './types'
import { nextFreeLineNumber } from './lineNumber'

const line = (number: number, kind: LineKind): Line => ({
  id: `l-${number}-${kind}`,
  number,
  name: '',
  color: '#000000',
  nodes: [],
  visible: true,
  companyId: null,
  ...(kind === 'rail' ? { kind: 'rail' as const } : {}),
})

describe('nextFreeLineNumber', () => {
  it('numbers each kind from 1 independently', () => {
    // The point of the whole feature: metro and rail count in their own sequences.
    const lines = [line(1, 'metro'), line(2, 'metro'), line(1, 'rail')]
    expect(nextFreeLineNumber(lines, 'metro')).toBe(3)
    expect(nextFreeLineNumber(lines, 'rail')).toBe(2)
  })

  it('lets a metro 1 and a rail 1 coexist', () => {
    // A metro Line 1 must not consume rail's 1 — the badge tells them apart, not the number.
    expect(nextFreeLineNumber([line(1, 'metro')], 'rail')).toBe(1)
  })

  it('fills the lowest gap within a kind, not across kinds', () => {
    const lines = [line(1, 'metro'), line(3, 'metro'), line(2, 'rail')]
    expect(nextFreeLineNumber(lines, 'metro')).toBe(2)
  })

  it('starts at 1 for a kind with no lines yet', () => {
    expect(nextFreeLineNumber([line(1, 'metro'), line(2, 'metro')], 'rail')).toBe(1)
  })

  it('treats a line with no kind field as metro', () => {
    const noKind = { ...line(1, 'metro') }
    delete noKind.kind
    expect(nextFreeLineNumber([noKind], 'metro')).toBe(2)
    expect(nextFreeLineNumber([noKind], 'rail')).toBe(1)
  })
})
