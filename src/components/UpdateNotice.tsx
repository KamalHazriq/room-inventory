import { useSyncExternalStore } from 'react'
import {
  applyUpdate,
  subscribeToUpdates,
  updateWaiting,
  updateWaitingOnServer,
} from '../lib/swUpdate'

/**
 * A new app shell has downloaded and is waiting.
 *
 * Deliberately not automatic: swapping the running app out from under someone
 * mid-edit is worse than a version being a day old. One quiet line, one action,
 * and it is dismissible by ignoring it.
 */
export function UpdateNotice() {
  const waiting = useSyncExternalStore(
    subscribeToUpdates,
    updateWaiting,
    updateWaitingOnServer,
  )

  if (!waiting) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-safe z-30" role="status">
      <div className="mx-auto flex w-full max-w-[560px] justify-start px-5">
        <button
          onClick={applyUpdate}
          className="pointer-events-auto inline-flex min-h-[44px] items-center rounded-ui border border-rule bg-surface px-4 text-base text-ink transition-opacity active:opacity-70"
        >
          New version ready. Reload
        </button>
      </div>
    </div>
  )
}
