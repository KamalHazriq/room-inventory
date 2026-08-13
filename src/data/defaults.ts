import type { Container, Zone } from './types'

/**
 * The physical room, in one place. Both the seed script and local mode build
 * from this list, so there is no second definition to drift out of sync.
 */
export const DEFAULT_ZONES: Zone[] = [
  { id: 'trolley', name: 'Trolley', order: 1 },
  { id: 'wardrobe', name: 'Wardrobe', order: 2 },
  { id: 'desk', name: 'Desk', order: 3 },
  { id: 'under-bed', name: 'Under-bed', order: 4 },
  { id: 'not-filed', name: 'Not filed', order: 99 },
]

/** The code a container is filed under is its document id. */
export const OUT_CODE = 'OUT'

/** Where containers land when their zone is deleted. Cannot itself be deleted. */
export const NOT_FILED_ZONE = 'not-filed'

/** Zone ids are readable rather than random, so a document is legible in the console. */
export function zoneIdFor(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'zone'

  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export const DEFAULT_CONTAINERS: Container[] = [
  { code: 'T1', zoneId: 'trolley', label: 'Trolley tier 1', order: 1 },
  { code: 'T2', zoneId: 'trolley', label: 'Trolley tier 2', order: 2 },
  { code: 'T3', zoneId: 'trolley', label: 'Trolley tier 3', order: 3 },
  { code: 'W-A', zoneId: 'wardrobe', label: 'Wardrobe shelf A', order: 4 },
  { code: 'D-1', zoneId: 'desk', label: 'Desk drawer 1', order: 5 },
  { code: 'U-1', zoneId: 'under-bed', label: 'Under-bed box 1', order: 6 },
  /**
   * Ordinary container, no special code path. Moving an item here is how I
   * record having taken something out and not put it back yet.
   */
  { code: OUT_CODE, zoneId: 'not-filed', label: 'Out of storage', order: 99 },
]

/** Sorts containers for display, with OUT pushed to the bottom of the list. */
export function compareContainers(a: Container, b: Container): number {
  if (a.code === OUT_CODE) return 1
  if (b.code === OUT_CODE) return -1
  if (a.order !== b.order) return a.order - b.order
  return a.code.localeCompare(b.code)
}
