import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { ALLOWED_UID, firebaseAuth, missingConfig } from './firebase'
import type { AuthApi, AuthState } from './types'

const listeners = new Set<(state: AuthState) => void>()
let current: AuthState = { status: 'loading' }
/** Set when Firestore rejects a read, so the UI can drop out of 'ready'. */
let rulesRejected = false
let started = false

function publish(next: AuthState) {
  current = next
  for (const listener of listeners) listener(next)
}

function stateFor(user: User | null): AuthState {
  if (!user) {
    rulesRejected = false
    return { status: 'signed-out' }
  }
  // Belt: the configured UID mismatches. Braces: a read already came back
  // permission-denied, which catches the case where VITE_ALLOWED_UID was never
  // filled in. Either way this renders a real screen, never a spinner.
  if ((ALLOWED_UID && user.uid !== ALLOWED_UID) || rulesRejected) {
    return { status: 'unauthorised', email: user.email, uid: user.uid }
  }
  return { status: 'ready', uid: user.uid }
}

function start() {
  if (started) return
  started = true

  const missing = missingConfig()
  if (missing.length > 0) {
    publish({
      status: 'signed-out',
      error: `Firebase is not configured. Missing ${missing.join(', ')}. Copy .env.example to .env and fill it in.`,
    })
    return
  }

  const auth = firebaseAuth()
  // Survive app restarts, so signing in is a once-per-install event.
  void setPersistence(auth, browserLocalPersistence)
  onAuthStateChanged(auth, (user) => publish(stateFor(user)))
}

export const firebaseAuthApi: AuthApi = {
  observe(listener) {
    listeners.add(listener)
    start()
    listener(current)
    return () => {
      listeners.delete(listener)
    }
  },

  async signIn() {
    const missing = missingConfig()
    if (missing.length > 0) {
      publish({
        status: 'signed-out',
        error: `Firebase is not configured. Missing ${missing.join(', ')}.`,
      })
      return
    }

    const auth = firebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      // Popup, not redirect. Redirect flows have been unreliable inside
      // installed iOS PWAs because of Safari storage partitioning.
      await signInWithPopup(auth, provider)
    } catch (error) {
      const code = (error as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        publish({ status: 'signed-out' })
        return
      }
      publish({
        status: 'signed-out',
        error:
          code === 'auth/unauthorized-domain'
            ? 'This domain is not in the Firebase authorized domains list. Add it under Authentication, Settings.'
            : `Sign-in failed (${code || 'unknown error'}).`,
      })
    }
  },

  async signOut() {
    rulesRejected = false
    await signOut(firebaseAuth())
  },

  reportUnauthorised() {
    rulesRejected = true
    const user = firebaseAuth().currentUser
    if (user) publish({ status: 'unauthorised', email: user.email, uid: user.uid })
  },
}
