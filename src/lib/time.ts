const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * Quiet relative time for `lastSeenAt`. Deliberately coarse: the useful signal
 * is "recently" versus "a while ago", not the exact minute.
 */
export function relativeTime(millis: number, now: number = Date.now()): string {
  const delta = now - millis
  if (delta < 0) return 'just now'
  if (delta < MINUTE) return 'just now'
  if (delta < HOUR) {
    const n = Math.floor(delta / MINUTE)
    return n === 1 ? '1 minute ago' : `${n} minutes ago`
  }
  if (delta < DAY) {
    const n = Math.floor(delta / HOUR)
    return n === 1 ? '1 hour ago' : `${n} hours ago`
  }
  if (delta < WEEK) {
    const n = Math.floor(delta / DAY)
    return n === 1 ? 'yesterday' : `${n} days ago`
  }
  if (delta < MONTH) {
    const n = Math.floor(delta / WEEK)
    return n === 1 ? 'last week' : `${n} weeks ago`
  }
  if (delta < YEAR) {
    const n = Math.floor(delta / MONTH)
    return n === 1 ? 'last month' : `${n} months ago`
  }
  const n = Math.floor(delta / YEAR)
  return n === 1 ? 'last year' : `${n} years ago`
}
