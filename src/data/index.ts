import type { AuthApi, AuthState, Repo } from './types'

export type DataMode = 'local' | 'firebase'

/**
 * Defaults to firebase. `local` is a development convenience only, and
 * vite.config.ts refuses to produce a production build in that mode.
 */
export const DATA_MODE: DataMode =
  import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'firebase'

/**
 * Both implementations load on demand.
 *
 * The Firebase SDK is by far the largest thing in the bundle, and none of it is
 * needed to paint the sign-in screen. Importing it dynamically lets the shell
 * render from a small chunk while the SDK arrives in parallel, instead of
 * blocking first paint behind it. It also keeps sample-data.csv and the CSV
 * parser out of the production bundle entirely.
 */
let repoModule: Promise<Repo> | undefined

function loadRepo(): Promise<Repo> {
  if (!repoModule) {
    repoModule =
      DATA_MODE === 'local'
        ? import('./localRepo').then((m) => m.localRepo)
        : import('./firebaseRepo').then((m) => m.firebaseRepo)
  }
  return repoModule
}

let authModule: Promise<AuthApi> | undefined

function loadAuth(): Promise<AuthApi> {
  if (!authModule) {
    authModule =
      DATA_MODE === 'local'
        ? import('./localRepo').then((m) => m.localAuth)
        : import('./firebaseAuth').then((m) => m.firebaseAuthApi)
  }
  return authModule
}

export const repo: Repo = {
  async load() {
    return (await loadRepo()).load()
  },
  async addItem(input) {
    return (await loadRepo()).addItem(input)
  },
  async updateItem(id, patch) {
    return (await loadRepo()).updateItem(id, patch)
  },
  async deleteItem(id) {
    return (await loadRepo()).deleteItem(id)
  },
  async addContainer(input) {
    return (await loadRepo()).addContainer(input)
  },
  async updateContainer(code, patch) {
    return (await loadRepo()).updateContainer(code, patch)
  },
  async renameContainer(from, to) {
    return (await loadRepo()).renameContainer(from, to)
  },
  async deleteContainer(code, reassignTo) {
    return (await loadRepo()).deleteContainer(code, reassignTo)
  },
}

export const auth: AuthApi = {
  /**
   * Subscribing is synchronous from the caller's point of view even though the
   * module behind it is not, so unsubscribing before the import lands has to
   * cancel the pending subscription rather than leak it.
   */
  observe(listener: (state: AuthState) => void) {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    void loadAuth().then((api) => {
      if (cancelled) return
      unsubscribe = api.observe(listener)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  },

  async signIn() {
    return (await loadAuth()).signIn()
  },

  async signOut() {
    return (await loadAuth()).signOut()
  },

  reportUnauthorised() {
    void loadAuth().then((api) => api.reportUnauthorised())
  },
}
