import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { firestore } from './firebase'
import { firebaseAuthApi } from './firebaseAuth'
import type {
  Container,
  Item,
  ItemPatch,
  NewContainer,
  NewItem,
  Repo,
  Snapshot,
  Zone,
} from './types'

function millis(value: unknown, fallback: number): number {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'number') return value
  return fallback
}

function toItem(id: string, data: DocumentData): Item {
  const created = millis(data.createdAt, Date.now())
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    aliases: Array.isArray(data.aliases) ? data.aliases.filter((a) => typeof a === 'string') : [],
    containerCode: typeof data.containerCode === 'string' ? data.containerCode : '',
    status: data.status === 'gone' ? 'gone' : 'have',
    qty: typeof data.qty === 'number' && data.qty > 0 ? data.qty : 1,
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: created,
    lastSeenAt: millis(data.lastSeenAt, created),
  }
}

/**
 * Firestore rejections mean "signed in, but not the allowed UID". Routing them
 * through the auth API turns a dead screen into the access-denied state.
 */
function rethrow(error: unknown): never {
  if ((error as { code?: string }).code === 'permission-denied') {
    firebaseAuthApi.reportUnauthorised()
  }
  throw error
}

export const firebaseRepo: Repo = {
  /**
   * One read of everything on open. At 50 to 200 items this is a couple of
   * small queries, and every search afterwards runs against memory.
   */
  async load(): Promise<Snapshot> {
    try {
      const db = firestore()
      const [zoneDocs, containerDocs, itemDocs] = await Promise.all([
        getDocs(collection(db, 'zones')),
        getDocs(collection(db, 'containers')),
        getDocs(collection(db, 'items')),
      ])

      const zones: Zone[] = zoneDocs.docs.map((d) => ({
        id: d.id,
        name: typeof d.data().name === 'string' ? d.data().name : d.id,
        order: typeof d.data().order === 'number' ? d.data().order : 0,
      }))

      const containers: Container[] = containerDocs.docs.map((d) => ({
        code: d.id,
        zoneId: typeof d.data().zoneId === 'string' ? d.data().zoneId : '',
        label: typeof d.data().label === 'string' ? d.data().label : d.id,
        order: typeof d.data().order === 'number' ? d.data().order : 0,
      }))

      const items = itemDocs.docs.map((d) => toItem(d.id, d.data()))

      return { zones, containers, items }
    } catch (error) {
      rethrow(error)
    }
  },

  async addItem(input: NewItem): Promise<Item> {
    try {
      const db = firestore()
      const ref = doc(collection(db, 'items'))
      const now = Timestamp.now()
      const payload = {
        name: input.name,
        aliases: input.aliases,
        containerCode: input.containerCode,
        status: input.status ?? 'have',
        qty: input.qty,
        notes: input.notes,
        createdAt: now,
        lastSeenAt: now,
      }
      await setDoc(ref, payload)
      return toItem(ref.id, payload)
    } catch (error) {
      rethrow(error)
    }
  },

  async updateItem(id: string, patch: ItemPatch): Promise<void> {
    try {
      const payload: DocumentData = { ...patch }
      if (patch.lastSeenAt !== undefined) {
        payload.lastSeenAt = Timestamp.fromMillis(patch.lastSeenAt)
      }
      await updateDoc(doc(firestore(), 'items', id), payload)
    } catch (error) {
      rethrow(error)
    }
  },

  async deleteItem(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firestore(), 'items', id))
    } catch (error) {
      rethrow(error)
    }
  },

  async addContainer(input: NewContainer): Promise<Container> {
    try {
      const code = input.code.toUpperCase()
      const container: Container = {
        code,
        zoneId: input.zoneId,
        label: input.label,
        order: input.order ?? 50,
      }
      // The code IS the doc id, so this also enforces uniqueness.
      await setDoc(doc(firestore(), 'containers', code), {
        zoneId: container.zoneId,
        label: container.label,
        order: container.order,
      })
      return container
    } catch (error) {
      rethrow(error)
    }
  },
}
