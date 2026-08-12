import { registerSW } from 'virtual:pwa-register'

let waiting = false
const listeners = new Set<() => void>()

/**
 * Applies the waiting service worker and reloads. Set once the new shell has
 * downloaded, so the app never swaps itself out mid-task.
 */
let apply: (reload?: boolean) => Promise<void> = async () => {}

apply = registerSW({
  immediate: true,
  onNeedRefresh() {
    waiting = true
    for (const listener of listeners) listener()
  },
})

export function subscribeToUpdates(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updateWaiting(): boolean {
  return waiting
}

/** Server snapshot for useSyncExternalStore; there is no SW during SSR or tests. */
export function updateWaitingOnServer(): boolean {
  return false
}

export function applyUpdate(): void {
  void apply(true)
}
