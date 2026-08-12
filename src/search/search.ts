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

const NO_MATCH = 99

/**
 * Where a single word landed, best first. Name beats everything, per the
 * brief; a prefix match beats one buried mid-word, because that is what typing
 * feels like.
 */
const NAME_PREFIX = 0
const NAME_CONTAINS = 1
const ALIAS = 2
const CODE = 3
const NOTES = 4
/** Last resort, and always below every exact tier. */
const FUZZY = 5

/** Below this a typo is indistinguishable from a different word: cat / car. */
const MIN_FUZZY_LENGTH = 4

function editBudget(token: string): number {
  return token.length >= 7 ? 2 : 1
}

/**
 * Bounded Damerau-Levenshtein, optimal string alignment variant.
 *
 * Swapping two adjacent letters counts as one edit, not two. That distinction
 * is the whole point here: transposition is what thumbs actually do, and
 * "hmdi" for "hdmi" has to stay inside a budget of one or the feature does not
 * earn its keep.
 *
 * Bails out as soon as the budget is blown, which for inventory-length words is
 * almost immediately.
 */
export function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  if (a === b) return true

  let twoBack: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowBest = i

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + cost, // substitution
      )

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1) // transposition
      }

      current.push(value)
      if (value < rowBest) rowBest = value
    }

    // No cell in this row is within budget, so no later row can be either.
    if (rowBest > max) return false
    twoBack = previous
    previous = current
  }

  return previous[b.length] <= max
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
}

function tokenTier(item: Item, token: string): number {
  const name = item.name.toLowerCase()
  if (name.startsWith(token)) return NAME_PREFIX
  if (name.includes(token)) return NAME_CONTAINS

  for (const alias of item.aliases) {
    if (alias.toLowerCase().includes(token)) return ALIAS
  }
  if (item.containerCode.toLowerCase().includes(token)) return CODE
  if (item.notes.toLowerCase().includes(token)) return NOTES

  // Nothing matched exactly. Allow for a fat-fingered word, but only against
  // name and alias words, and only at the very bottom of the ranking, so a
  // typo can never displace something the query actually matched.
  if (token.length >= MIN_FUZZY_LENGTH) {
    const budget = editBudget(token)
    const candidates = [...words(item.name), ...item.aliases.flatMap(words)]
    for (const word of candidates) {
      if (word.length >= MIN_FUZZY_LENGTH && withinEditDistance(word, token, budget)) {
        return FUZZY
      }
    }
  }

  return NO_MATCH
}

/**
 * Every word in the query has to land somewhere on the item, in any order, and
 * the item is judged by its weakest word. Matching the query as one contiguous
 * string would mean "anker charger" missed "Anker 65W charger", which is the
 * most natural thing in the world to type while standing in front of a box.
 *
 * A contiguous hit on the name still wins outright, so typing the start of a
 * name puts it top where you expect it.
 */
function rank(item: Item, tokens: string[], phrase: string): number {
  const name = item.name.toLowerCase()
  if (name.startsWith(phrase)) return 0
  if (name.includes(phrase)) return 1

  let weakest = 0
  for (const token of tokens) {
    const tier = tokenTier(item, token)
    if (tier === NO_MATCH) return NO_MATCH
    weakest = Math.max(weakest, tier)
  }
  return 2 + weakest
}

function byRankThenName(a: [Item, number], b: [Item, number]): number {
  if (a[1] !== b[1]) return a[1] - b[1]
  return a[0].name.localeCompare(b[0].name)
}

/**
 * Case-insensitive matching across name, aliases, containerCode and notes, run
 * over the whole collection in memory. At 200 items this is instant and more
 * forgiving than a server query would be.
 */
export function searchItems(items: Item[], query: string): SearchResults {
  const phrase = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!phrase) return { live: [], gone: [] }

  const tokens = phrase.split(' ').filter(Boolean)

  const live: Array<[Item, number]> = []
  const gone: Array<[Item, number]> = []

  for (const item of items) {
    const score = rank(item, tokens, phrase)
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

/**
 * Items that look like the one being typed on the Add screen, so a second HDMI
 * cable is caught before it becomes a second record. Name-tier matches only:
 * a hit buried in someone's notes is not a duplicate.
 */
export function likelyDuplicates(items: Item[], name: string, limit = 3): Item[] {
  const phrase = name.trim().toLowerCase().replace(/\s+/g, ' ')
  if (phrase.length < 3) return []

  const tokens = phrase.split(' ').filter(Boolean)

  return items
    .filter((item) => item.status === 'have')
    .map((item) => [item, rank(item, tokens, phrase)] as [Item, number])
    // 2 + NAME_CONTAINS is the weakest tier that still means every word landed
    // on the name itself.
    .filter(([, score]) => score <= 2 + NAME_CONTAINS)
    .sort(byRankThenName)
    .slice(0, limit)
    .map(([item]) => item)
}
