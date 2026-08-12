import { firebaseAuthApi } from './firebaseAuth'
import { firebaseRepo } from './firebaseRepo'
import { localAuth, localRepo } from './localRepo'
import type { AuthApi, Repo } from './types'

export type DataMode = 'local' | 'firebase'

/**
 * Defaults to firebase. `local` is a development convenience only, and
 * vite.config.ts refuses to produce a production build in that mode.
 */
export const DATA_MODE: DataMode =
  import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'firebase'

export const repo: Repo = DATA_MODE === 'local' ? localRepo : firebaseRepo
export const auth: AuthApi = DATA_MODE === 'local' ? localAuth : firebaseAuthApi
