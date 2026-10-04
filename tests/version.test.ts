import { describe, expect, it } from 'vitest'
import { compareVersions, plainNotes } from '@shared/version'

describe('compareVersions', () => {
  it('orders semantic versions numerically', () => {
    expect(compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('v1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
    expect(compareVersions('1.0.9', '1.1.0')).toBeLessThan(0)
    expect(compareVersions('2.0', '1.99.99')).toBeGreaterThan(0)
  })
})

describe('plainNotes', () => {
  it('strips HTML from release notes', () => {
    expect(plainNotes('<h2>New</h2><p>Faster sync&nbsp;and <b>fixes</b></p>')).toBe('New\nFaster sync and fixes')
    expect(plainNotes([{ version: '1.1.0', note: '<p>A</p>' }, { note: 'B' }])).toBe('A\n\nB')
    expect(plainNotes(null)).toBe('')
  })
})
