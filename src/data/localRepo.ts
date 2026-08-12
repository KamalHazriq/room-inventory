import sampleCsv from '../../sample-data.csv?raw'
import { parseItemsCsv } from './csv'
import { DEFAULT_CONTAINERS, DEFAULT_ZONES } from './defaults'
import type {
  AuthApi,
  AuthState,
  Container,
  ContainerPatch,
  Item,
  ItemPatch,
  NewContainer,
  NewItem,
  Repo,
  Snapshot,
} from './types'

const STORE_KEY = 'room-inventory.local.v1'

const DAY = 24 * 60 * 60 * 1000

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

/**
 * Builds the starting state from sample-data.csv. Timestamps are spread across
 * the past few weeks rather than all set to now, so "last seen" relative times
 * read like a real inventory instead of seventeen identical "just now"s.
 */
function seed(): Snapshot {
  const { items } = parseItemsCsv(sampleCsv)
  const now = Date.now()

  return {
    zones: DEFAULT_ZONES.map((z) => ({ ...z })),
    containers: DEFAULT_CONTAINERS.map((c) => ({ ...c })),
    items: items.map((input, i) => ({
      id: newId(),
      name: input.name,
      aliases: input.aliases,
      containerCode: input.containerCode,
      status: input.status ?? 'have',
      qty: input.qty,
      notes: input.notes,
      createdAt: now - (60 + i * 3) * DAY,
      lastSeenAt: now - (i * 2 + 1) * DAY,
    })),
  }
}

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot
      if (Array.isArray(parsed.items) && Array.isArray(parsed.containers)) return parsed
    }
  } catch {
    // Corrupt or unavailable storage: fall through and reseed.
  }
  const fresh = seed()
  write(fresh)
  return fresh
}

function write(snapshot: Snapshot): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private browsing with no quota. The session still works in memory.
  }
}

/**
 * In-memory repo backed by localStorage, seeded from sample-data.csv.
 *
 * This exists so the whole app can be built, used and reviewed before the
 * Firebase project exists. It has no access control of any kind, which is why
 * vite.config.ts refuses to produce a production build in this mode.
 */
export const localRepo: Repo = {
  async load() {
    return read()
  },

  async addItem(input: NewItem) {
    const snapshot = read()
    const now = Date.now()
    const item: Item = {
      id: newId(),
      name: input.name,
      aliases: input.aliases,
      containerCode: input.containerCode,
      status: input.status ?? 'have',
      qty: input.qty,
      notes: input.notes,
      createdAt: now,
      lastSeenAt: now,
    }
    snapshot.items.push(item)
    write(snapshot)
    return item
  },

  async updateItem(id: string, patch: ItemPatch) {
    const snapshot = read()
    const at = snapshot.items.findIndex((i) => i.id === id)
    if (at === -1) throw new Error(`No item ${id}`)
    snapshot.items[at] = { ...snapshot.items[at], ...patch }
    write(snapshot)
  },

  async deleteItem(id: string) {
    const snapshot = read()
    snapshot.items = snapshot.items.filter((i) => i.id !== id)
    write(snapshot)
  },

  async addContainer(input: NewContainer) {
    const snapshot = read()
    const code = input.code.toUpperCase()
    if (snapshot.containers.some((c) => c.code === code)) {
      throw new Error(`Container ${code} already exists.`)
    }
    const container: Container = {
      code,
      zoneId: input.zoneId,
      label: input.label,
      order: input.order ?? snapshot.containers.length + 1,
    }
    snapshot.containers.push(container)
    write(snapshot)
    return container
  },

  async updateContainer(code: string, patch: ContainerPatch) {
    const snapshot = read()
    const at = snapshot.containers.findIndex((c) => c.code === code)
    if (at === -1) throw new Error(`No container ${code}`)
    snapshot.containers[at] = { ...snapshot.containers[at], ...patch }
    write(snapshot)
  },

  async renameContainer(from: string, to: string) {
    const next = to.toUpperCase()
    const snapshot = read()
    const at = snapshot.containers.findIndex((c) => c.code === from)
    if (at === -1) throw new Error(`No container ${from}`)
    if (snapshot.containers.some((c) => c.code === next)) {
      throw new Error(`${next} already exists.`)
    }
    snapshot.containers[at] = { ...snapshot.containers[at], code: next }
    snapshot.items = snapshot.items.map((item) =>
      item.containerCode === from ? { ...item, containerCode: next } : item,
    )
    write(snapshot)
  },

  async deleteContainer(code: string, reassignTo: string) {
    const snapshot = read()
    if (!snapshot.containers.some((c) => c.code === reassignTo)) {
      throw new Error(`No container ${reassignTo} to move the contents into.`)
    }
    snapshot.items = snapshot.items.map((item) =>
      item.containerCode === code ? { ...item, containerCode: reassignTo } : item,
    )
    snapshot.containers = snapshot.containers.filter((c) => c.code !== code)
    write(snapshot)
  },
}

/** Auth stubbed as signed in, so local mode goes straight to the app. */
export const localAuth: AuthApi = {
  observe(listener: (state: AuthState) => void) {
    const timer = setTimeout(() => listener({ status: 'ready', uid: 'local-user' }), 0)
    return () => clearTimeout(timer)
  },
  async signIn() {},
  async signOut() {},
  reportUnauthorised() {},
}
