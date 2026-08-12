import type { Item } from '../data/types'

/**
 * Below this many live results, matching `gone` items are worth showing. "You
 * had four of these and used the last one" is a better answer to "do I already
 * own this" than nothing at all.
 */
export const GONE_THRESHOLD = 3

export interface SearchResults {
  live: Item[]
  /** Only populated when `live` is short. Rendered dimmed under a rule. */
  gone: Item[]
}

/**
 * Match tiers, lowest first. Name beats everything, per the brief; a prefix
 * match beats a match buried mid-word because that is what typing feels like.
 */
const NO_MATCH = 99
const NAME_PREFIX = 0
const NAME_CONTAINS = 1
const ALIAS_PREFIX = 2
const ALIAS_CONTAINS = 3
const CODE_MATCH = 4
const NOTES_MATCH = 5

function rank(item: Item, needle: string): number {
  const name = item.name.toLowerCase()
  if (name.startsWith(needle)) return NAME_PREFIX
  if (name.includes(needle)) return NAME_CONTAINS

  let best = NO_MATCH
  for (const alias of item.aliases) {
    const a = alias.toLowerCase()
    if (a.startsWith(needle)) return ALIAS_PREFIX
    if (a.includes(needle)) best = Math.min(best, ALIAS_CONTAINS)
  }
  if (best !== NO_MATCH) return best

  if (item.containerCode.toLowerCase().includes(needle)) return CODE_MATCH
  if (item.notes.toLowerCase().includes(needle)) return NOTES_MATCH

  return NO_MATCH
}

function byRankThenName(a: [Item, number], b: [Item, number]): number {
  if (a[1] !== b[1]) return a[1] - b[1]
  return a[0].name.localeCompare(b[0].name)
}

/**
 * Case-insensitive substring across name, aliases, containerCode and notes,
 * run over the whole collection in memory. At 200 items this is instant and
 * forgiving in a way a server query would not be.
 */
export function searchItems(items: Item[], query: string): SearchResults {
  const needle = query.trim().toLowerCase()
  if (!needle) return { live: [], gone: [] }

  const live: Array<[Item, number]> = []
  const gone: Array<[Item, number]> = []

  for (const item of items) {
    const score = rank(item, needle)
    if (score === NO_MATCH) continue
    ;(item.status === 'gone' ? gone : live).push([item, score])
  }

  live.sort(byRankThenName)

  // Gone items are excluded from normal results and only surface when the live
  // answer is thin enough that "you used to have one" is still useful.
  if (live.length >= GONE_THRESHOLD) return { live: live.map(([i]) => i), gone: [] }

  gone.sort(byRankThenName)
  return { live: live.map(([i]) => i), gone: gone.map(([i]) => i) }
}
