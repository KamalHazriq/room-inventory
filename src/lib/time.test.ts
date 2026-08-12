import { describe, expect, it } from 'vitest'
import { relativeTime } from './time'

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)
const ago = (ms: number) => relativeTime(NOW - ms, NOW)

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTime', () => {
  it('collapses anything under a minute to just now', () => {
    expect(ago(0)).toBe('just now')
    expect(ago(59 * SECOND)).toBe('just now')
  })

  it('never reports a negative age', () => {
    // Clock skew between the phone and Firestore should not read "in 3 hours".
    expect(relativeTime(NOW + HOUR, NOW)).toBe('just now')
  })

  it('singularises', () => {
    expect(ago(MINUTE)).toBe('1 minute ago')
    expect(ago(HOUR)).toBe('1 hour ago')
    expect(ago(DAY)).toBe('yesterday')
    expect(ago(7 * DAY)).toBe('last week')
    expect(ago(30 * DAY)).toBe('last month')
    expect(ago(365 * DAY)).toBe('last year')
  })

  it('pluralises', () => {
    expect(ago(5 * MINUTE)).toBe('5 minutes ago')
    expect(ago(3 * HOUR)).toBe('3 hours ago')
    expect(ago(3 * DAY)).toBe('3 days ago')
    expect(ago(21 * DAY)).toBe('3 weeks ago')
    expect(ago(90 * DAY)).toBe('3 months ago')
    expect(ago(3 * 365 * DAY)).toBe('3 years ago')
  })

  it('steps up cleanly at each boundary', () => {
    expect(ago(59 * MINUTE)).toBe('59 minutes ago')
    expect(ago(23 * HOUR)).toBe('23 hours ago')
    expect(ago(6 * DAY)).toBe('6 days ago')
  })
})
