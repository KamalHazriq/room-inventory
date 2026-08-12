import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * The UID the Firestore rules are locked to.
 *
 * This is presentation only. It decides whether a signed-in stranger sees "this
 * account does not have access" or an infinite spinner. It is not access
 * control — the rules on Google's servers are, and they do not consult this
 * value. A UID is not a secret either, so shipping it in the bundle costs
 * nothing.
 */
export const ALLOWED_UID: string = import.meta.env.VITE_ALLOWED_UID ?? ''

/** Names of any env var that is missing, so the UI can say which. */
export function missingConfig(): string[] {
  const required: Array<[string, string | undefined]> = [
    ['VITE_FIREBASE_API_KEY', config.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', config.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', config.projectId],
    ['VITE_FIREBASE_APP_ID', config.appId],
  ]
  return required.filter(([, value]) => !value).map(([name]) => name)
}

let app: FirebaseApp | undefined

function getApp(): FirebaseApp {
  if (!app) app = initializeApp(config)
  return app
}

export function firebaseAuth(): Auth {
  return getAuth(getApp())
}

export function firestore(): Firestore {
  return getFirestore(getApp())
}
