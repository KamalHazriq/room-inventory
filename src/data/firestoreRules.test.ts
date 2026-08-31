/**
 * Tests firestore.rules itself, against the emulator.
 *
 * The brief is explicit that these rules are the only access control: the URL
 * is public, the bundle is public, the API key is public, and the only thing
 * between a stranger and the data is this file evaluated on Google's servers.
 * That deserves a test that both halves work — that the owner is let in, not
 * merely that everyone else is kept out.
 *
 * Skipped unless FIRESTORE_EMULATOR_HOST is set. Uses its own project id so the
 * locked ruleset here cannot leak into the other emulator tests.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, collection, getDocs, setLogLevel } from 'firebase/firestore'

// Every denial below is an assertion passing, and Firestore logs each one as an
// error. Silence it so a real failure is the only thing in the output.
setLogLevel('silent')

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST
const describeIfEmulator = EMULATOR ? describe : describe.skip

const OWNER = 'owner-uid-under-test'
const STRANGER = 'someone-elses-google-account'

const RULES_PATH = resolve(__dirname, '../../firestore.rules')
const PLACEHOLDER = 'PASTE_YOUR_UID_HERE'

describe('firestore.rules as committed', () => {
  const source = readFileSync(RULES_PATH, 'utf8')

  it('still ships the UID placeholder rather than a real UID', () => {
    // Guards two things: the README instruction stays true, and nobody has
    // committed their own UID by accident.
    expect(source).toContain(PLACEHOLDER)
  })

  it('locks every collection the app uses', () => {
    for (const collectionName of ['zones', 'containers', 'items']) {
      expect(source).toContain(`match /${collectionName}/`)
    }
  })
})

describeIfEmulator('firestore.rules enforced by the emulator', () => {
  let env: RulesTestEnvironment

  beforeAll(async () => {
    const [host, port] = (EMULATOR ?? '').split(':')
    env = await initializeTestEnvironment({
      projectId: 'rules-under-test',
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(RULES_PATH, 'utf8').replace(PLACEHOLDER, OWNER),
      },
    })
  })

  afterAll(async () => env?.cleanup())
  beforeEach(async () => env.clearFirestore())

  const paths: Array<[string, string]> = [
    ['zones', 'trolley'],
    ['containers', 'T2'],
    ['items', 'item-1'],
  ]

  describe('the allowed UID', () => {
    it.each(paths)('can write and read %s', async (col, id) => {
      const db = env.authenticatedContext(OWNER).firestore()
      await assertSucceeds(setDoc(doc(db, col, id), { name: 'x', label: 'x' }))
      await assertSucceeds(getDoc(doc(db, col, id)))
      await assertSucceeds(getDocs(collection(db, col)))
    })
  })

  describe('a different Google account', () => {
    // The case the brief calls out: anyone can create an auth record by signing
    // in with their own account. The rules are what make that worthless.
    it.each(paths)('is denied reading %s', async (col, id) => {
      const db = env.authenticatedContext(STRANGER).firestore()
      await assertFails(getDoc(doc(db, col, id)))
      await assertFails(getDocs(collection(db, col)))
    })

    it.each(paths)('is denied writing %s', async (col, id) => {
      const db = env.authenticatedContext(STRANGER).firestore()
      await assertFails(setDoc(doc(db, col, id), { name: 'nope' }))
    })
  })

  describe('a signed-out visitor', () => {
    it.each(paths)('is denied reading %s', async (col, id) => {
      const db = env.unauthenticatedContext().firestore()
      await assertFails(getDoc(doc(db, col, id)))
    })

    it.each(paths)('is denied writing %s', async (col, id) => {
      const db = env.unauthenticatedContext().firestore()
      await assertFails(setDoc(doc(db, col, id), { name: 'nope' }))
    })
  })

  it('denies even the owner on a collection the rules do not name', async () => {
    const db = env.authenticatedContext(OWNER).firestore()
    await assertFails(setDoc(doc(db, 'secrets', 'x'), { a: 1 }))
    await assertFails(getDoc(doc(db, 'secrets', 'x')))
  })

  it('lets the owner delete, since gone and delete are different actions', async () => {
    const db = env.authenticatedContext(OWNER).firestore()
    await assertSucceeds(setDoc(doc(db, 'items', 'doomed'), { name: 'x' }))
    const { deleteDoc } = await import('firebase/firestore')
    await assertSucceeds(deleteDoc(doc(db, 'items', 'doomed')))
  })
})
