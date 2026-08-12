import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getFirebaseApp } from './firebase'

let db: Firestore | undefined

/**
 * Firestore with its IndexedDB cache switched on, so the app opens with the
 * last known inventory when there is no signal, and edits made in a dead spot
 * queue up and sync when there is one again.
 *
 * Single-tab manager: this is a one-person phone app, and multi-tab
 * synchronisation costs more than it could ever be worth here.
 *
 * Kept out of firebase.ts so this module, and the large Firestore SDK behind
 * it, only loads once someone is actually signed in.
 */
export function firestore(): Firestore {
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
    })
  }
  return db
}
