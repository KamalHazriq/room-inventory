import { useEffect, useState } from 'react'

/**
 * Whether the browser thinks it has a network.
 *
 * Only used to say so quietly in the interface. Edits made offline are applied
 * locally and queued by Firestore either way, so nothing depends on this being
 * right — which is just as well, because `navigator.onLine` reports true on a
 * captive portal.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}
