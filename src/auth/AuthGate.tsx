import { useEffect, useState, type ReactNode } from 'react'
import { auth } from '../data'
import type { AuthState } from '../data/types'
import { Button, Screen } from '../components/ui'

/** Centred, no marketing copy, one thing to do. */
function Centred({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center pt-safe pb-safe">
      <Screen>
        <div className="mx-auto max-w-[340px] text-center">{children}</div>
      </Screen>
    </div>
  )
}

/**
 * Three states, each with a real screen.
 *
 * The third one matters most: anyone can create an auth record by signing in
 * with their own Google account, and the Firestore rules will then reject
 * every read. That has to say so, not spin forever.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => auth.observe(setState), [])

  if (state.status === 'loading') {
    // Deliberately blank rather than a spinner: this resolves from local
    // persistence in a few milliseconds, and a flash of spinner is worse.
    return <div className="min-h-dvh bg-bg" />
  }

  if (state.status === 'signed-out') {
    return (
      <Centred>
        <p className="text-lg text-ink">Room inventory</p>
        <p className="mt-2 text-base text-muted">Sign in to see what is in the boxes.</p>
        <div className="mt-7">
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await auth.signIn()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </Button>
        </div>
        {state.error ? <p className="mt-6 text-sm text-muted">{state.error}</p> : null}
      </Centred>
    )
  }

  if (state.status === 'unauthorised') {
    return (
      <Centred>
        <p className="text-lg text-ink">This account does not have access.</p>
        <p className="mt-2 text-base text-muted">
          {state.email ? `Signed in as ${state.email}.` : 'Signed in.'} This inventory is
          locked to one account.
        </p>
        <div className="mt-7">
          <Button onClick={() => void auth.signOut()}>Sign out</Button>
        </div>
        <p className="mt-6 font-mono text-sm text-muted">{state.uid}</p>
      </Centred>
    )
  }

  return <>{children}</>
}
