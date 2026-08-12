const KEY = 'room-inventory.lastContainer'

/**
 * Session scoped on purpose. A tidying session usually fills one box at a
 * time, but tomorrow's session probably starts somewhere else.
 */
export function readLastContainer(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function writeLastContainer(code: string): void {
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // No storage: the picker simply falls back to the first container.
  }
}
