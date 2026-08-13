/**
 * Integration tests against the Firestore emulator.
 *
 * Skipped unless FIRESTORE_EMULATOR_HOST is set, so CI stays free of a Java
 * dependency. To run them:
 *
 *   npx firebase-tools emulators:start --only firestore --project demo-room-inventory
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test
 *
 * These cover the writes that unit tests cannot reach: the ones whose whole
 * purpose is to be atomic on the server.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  initializeFirestore,
  memoryLocalCache,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
// vi.mock is hoisted above this, so the repo picks up the stubs below.
import { firebaseRepo } from './firebaseRepo'

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST
const describeIfEmulator = EMULATOR ? describe : describe.skip

// The real module uses persistentLocalCache, which needs IndexedDB and so
// cannot run under Node. Everything else about the repo is exercised for real.
let db: Firestore
vi.mock('./firestoreDb', () => ({ firestore: () => db }))

// The auth module reaches for browser APIs on import; the repo only calls it to
// report a rules rejection, which is not what these tests are about.
vi.mock('./firebaseAuth', () => ({ firebaseAuthApi: { reportUnauthorised() {} } }))

describeIfEmulator('firebaseRepo against the emulator', () => {
  beforeEach(async () => {
    const app = initializeApp({ projectId: 'demo-room-inventory' }, `t${Date.now()}${Math.random()}`)
    db = initializeFirestore(app, { localCache: memoryLocalCache() })
    const [host, port] = (EMULATOR ?? '').split(':')
    connectFirestoreEmulator(db, host, Number(port))

    for (const name of ['containers', 'zones', 'items']) {
      const existing = await getDocs(collection(db, name))
      await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)))
    }
  })

  describe('addContainer', () => {
    it('creates a container', async () => {
      const created = await firebaseRepo.addContainer({
        code: 'T4',
        label: 'Trolley tier 4',
        zoneId: 'trolley',
      })
      expect(created.code).toBe('T4')

      const stored = await getDoc(doc(db, 'containers', 'T4'))
      expect(stored.data()).toMatchObject({ label: 'Trolley tier 4', zoneId: 'trolley' })
    })

    it('uppercases the code', async () => {
      const created = await firebaseRepo.addContainer({
        code: 't5',
        label: 'Trolley tier 5',
        zoneId: 'trolley',
      })
      expect(created.code).toBe('T5')
      expect((await getDoc(doc(db, 'containers', 'T5'))).exists()).toBe(true)
    })

    it('refuses a code that already exists, and leaves it untouched', async () => {
      // The bug this test exists for: setDoc upserts, so a duplicate silently
      // overwrote the existing box's label and zone instead of failing.
      await setDoc(doc(db, 'containers', 'T6'), {
        label: 'Trolley tier 6',
        zoneId: 'trolley',
        order: 6,
      })

      await expect(
        firebaseRepo.addContainer({ code: 'T6', label: 'Something else', zoneId: 'desk' }),
      ).rejects.toThrow(/already exists/i)

      const after = await getDoc(doc(db, 'containers', 'T6'))
      expect(after.data()).toMatchObject({
        label: 'Trolley tier 6',
        zoneId: 'trolley',
        order: 6,
      })
    })
  })

  describe('addZone', () => {
    it('creates a zone with an id derived from the name', async () => {
      const created = await firebaseRepo.addZone({ name: 'Behind the door' })
      expect(created.id).toBe('behind-the-door')
      expect((await getDoc(doc(db, 'zones', 'behind-the-door'))).exists()).toBe(true)
    })

    it('refuses to overwrite an existing zone', async () => {
      await setDoc(doc(db, 'zones', 'trolley'), { name: 'Trolley', order: 1 })
      await expect(
        firebaseRepo.addZone({ name: 'Trolley', id: 'trolley' }),
      ).rejects.toThrow(/already exists/i)

      const after = await getDoc(doc(db, 'zones', 'trolley'))
      expect(after.data()).toMatchObject({ name: 'Trolley', order: 1 })
    })
  })

  describe('renameContainer', () => {
    it('moves the container and every item inside it', async () => {
      await setDoc(doc(db, 'containers', 'T7'), { label: 'Tier 7', zoneId: 'trolley', order: 7 })
      await firebaseRepo.addItem({
        name: 'Widget', aliases: [], containerCode: 'T7', qty: 1, notes: '',
      })

      await firebaseRepo.renameContainer('T7', 'T8')

      expect((await getDoc(doc(db, 'containers', 'T7'))).exists()).toBe(false)
      expect((await getDoc(doc(db, 'containers', 'T8'))).exists()).toBe(true)
      const items = await getDocs(collection(db, 'items'))
      expect(items.docs.map((d) => d.data().containerCode)).toEqual(['T8'])
    })

    it('refuses to rename onto an occupied code', async () => {
      await setDoc(doc(db, 'containers', 'T7'), { label: 'Tier 7', zoneId: 'trolley', order: 7 })
      await setDoc(doc(db, 'containers', 'T8'), { label: 'Tier 8', zoneId: 'trolley', order: 8 })

      await expect(firebaseRepo.renameContainer('T7', 'T8')).rejects.toThrow(/already exists/i)
      expect((await getDoc(doc(db, 'containers', 'T7'))).exists()).toBe(true)
      expect((await getDoc(doc(db, 'containers', 'T8'))).data()?.label).toBe('Tier 8')
    })
  })

  describe('deleteContainer', () => {
    it('refiles the contents rather than orphaning them', async () => {
      await setDoc(doc(db, 'containers', 'T9'), { label: 'Tier 9', zoneId: 'trolley', order: 9 })
      await setDoc(doc(db, 'containers', 'OUT'), { label: 'Out of storage', zoneId: 'not-filed', order: 99 })
      await firebaseRepo.addItem({
        name: 'Stray', aliases: [], containerCode: 'T9', qty: 1, notes: '',
      })

      await firebaseRepo.deleteContainer('T9', 'OUT')

      expect((await getDoc(doc(db, 'containers', 'T9'))).exists()).toBe(false)
      const items = await getDocs(collection(db, 'items'))
      expect(items.size).toBe(1)
      expect(items.docs[0].data().containerCode).toBe('OUT')
    })
  })
})
