import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { NOT_FILED_ZONE, zoneIdFor } from './defaults'
import { firestore } from './firestoreDb'
import { firebaseAuthApi } from './firebaseAuth'
import type {
  Container,
  ContainerPatch,
  Item,
  ItemPatch,
  NewContainer,
  NewItem,
  NewZone,
  Repo,
  Snapshot,
  Zone,
  ZonePatch,
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
function report(error: unknown): void {
  if ((error as { code?: string }).code === 'permission-denied') {
    firebaseAuthApi.reportUnauthorised()
  }
}

function rethrow(error: unknown): never {
  report(error)
  throw error
}

/** How long to wait for a server acknowledgement before assuming we are offline. */
const ACK_TIMEOUT_MS = 1200

/**
 * A Firestore write promise does not settle until the server acknowledges it,
 * so offline it stays pending forever and any UI that awaits it hangs on
 * "Saving…". The write is already in the local cache and the outbound queue by
 * then, so waiting past this point buys nothing.
 *
 * Give the server a moment to object — a rules rejection arrives fast and
 * should still surface — then let the UI move on. Genuine failures that arrive
 * later are still reported.
 */
async function settleOrQueue(write: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const acknowledged = write.then(
    () => true as const,
    (error) => {
      report(error)
      throw error
    },
  )

  try {
    await Promise.race([
      acknowledged,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ACK_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }

  // The write is still in flight. Keep watching it so a late rejection is not
  // swallowed, but do not make the interface wait.
  void acknowledged.catch(() => {})
}

export const firebaseRepo: Repo = {
  /**
   * One read of everything on open. At 50 to 200 items this is a couple of
   * small queries, and with the persistent cache it also succeeds offline.
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
    // The id is generated on the client, so the item is complete without
    // waiting for the server to hear about it.
    await settleOrQueue(setDoc(ref, payload))
    return toItem(ref.id, payload)
  },

  async updateItem(id: string, patch: ItemPatch): Promise<void> {
    const payload: DocumentData = { ...patch }
    if (patch.lastSeenAt !== undefined) {
      payload.lastSeenAt = Timestamp.fromMillis(patch.lastSeenAt)
    }
    await settleOrQueue(updateDoc(doc(firestore(), 'items', id), payload))
  },

  async deleteItem(id: string): Promise<void> {
    await settleOrQueue(deleteDoc(doc(firestore(), 'items', id)))
  },

  async addContainer(input: NewContainer): Promise<Container> {
    const code = input.code.toUpperCase()
    const container: Container = {
      code,
      zoneId: input.zoneId,
      label: input.label,
      order: input.order ?? 50,
    }
    // The code IS the doc id, so this also enforces uniqueness.
    await settleOrQueue(
      setDoc(doc(firestore(), 'containers', code), {
        zoneId: container.zoneId,
        label: container.label,
        order: container.order,
      }),
    )
    return container
  },

  async updateContainer(code: string, patch: ContainerPatch): Promise<void> {
    await settleOrQueue(updateDoc(doc(firestore(), 'containers', code), { ...patch }))
  },

  async renameContainer(from: string, to: string): Promise<void> {
    const next = to.toUpperCase()
    const db = firestore()

    try {
      const [existing, current, contents] = await Promise.all([
        getDocs(query(collection(db, 'containers'), where('__name__', '==', next))),
        getDocs(query(collection(db, 'containers'), where('__name__', '==', from))),
        getDocs(query(collection(db, 'items'), where('containerCode', '==', from))),
      ])

      if (!existing.empty) throw new Error(`${next} already exists.`)
      if (current.empty) throw new Error(`No container ${from}.`)

      // One batch, so the new container, the repointed items and the removal of
      // the old code either all land or none of them do.
      const batch = writeBatch(db)
      batch.set(doc(db, 'containers', next), current.docs[0].data())
      for (const item of contents.docs) {
        batch.update(item.ref, { containerCode: next })
      }
      batch.delete(doc(db, 'containers', from))
      await settleOrQueue(batch.commit())
    } catch (error) {
      rethrow(error)
    }
  },

  async deleteContainer(code: string, reassignTo: string): Promise<void> {
    const db = firestore()

    try {
      const contents = await getDocs(
        query(collection(db, 'items'), where('containerCode', '==', code)),
      )

      const batch = writeBatch(db)
      for (const item of contents.docs) {
        batch.update(item.ref, { containerCode: reassignTo })
      }
      batch.delete(doc(db, 'containers', code))
      await settleOrQueue(batch.commit())
    } catch (error) {
      rethrow(error)
    }
  },

  async addZone(input: NewZone): Promise<Zone> {
    const db = firestore()
    const name = input.name.trim()
    if (!name) throw new Error('A zone needs a name.')

    try {
      const existing = await getDocs(collection(db, 'zones'))
      const id = input.id ?? zoneIdFor(name, new Set(existing.docs.map((d) => d.id)))
      if (existing.docs.some((d) => d.id === id)) throw new Error(`Zone ${id} already exists.`)

      const zone: Zone = { id, name, order: input.order ?? existing.size + 1 }
      await settleOrQueue(
        setDoc(doc(db, 'zones', id), { name: zone.name, order: zone.order }),
      )
      return zone
    } catch (error) {
      rethrow(error)
    }
  },

  async updateZone(id: string, patch: ZonePatch): Promise<void> {
    await settleOrQueue(updateDoc(doc(firestore(), 'zones', id), { ...patch }))
  },

  async deleteZone(id: string, reassignTo: string): Promise<void> {
    if (id === NOT_FILED_ZONE) throw new Error('The "Not filed" zone cannot be deleted.')
    const db = firestore()

    try {
      const affected = await getDocs(
        query(collection(db, 'containers'), where('zoneId', '==', id)),
      )

      const batch = writeBatch(db)
      for (const container of affected.docs) {
        batch.update(container.ref, { zoneId: reassignTo })
      }
      batch.delete(doc(db, 'zones', id))
      await settleOrQueue(batch.commit())
    } catch (error) {
      rethrow(error)
    }
  },
}
