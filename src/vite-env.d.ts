/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** `local` or `firebase`. Defaults to firebase; see BUILD-ORDER.md. */
  readonly VITE_DATA_MODE?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** Presentation only. The Firestore rules are the access control. */
  readonly VITE_ALLOWED_UID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
