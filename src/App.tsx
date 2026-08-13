import { useEffect, useRef } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
import { UpdateNotice } from './components/UpdateNotice'
import { InventoryProvider } from './state/inventory'
import { ThemeProvider } from './theme/ThemeProvider'
import { AddItemScreen } from './screens/AddItemScreen'
import { ContainerScreen } from './screens/ContainerScreen'
import { ItemScreen } from './screens/ItemScreen'
import { SearchScreen } from './screens/SearchScreen'

/**
 * GitHub Pages serves the app from a subpath, so the router basename has to
 * match Vite's `base` or every route resolves one level too high.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

/**
 * Moves focus to the top of the new screen on every navigation.
 *
 * Without this a screen reader stays where the tapped link used to be and
 * announces nothing, and a keyboard user's next Tab resumes from a control that
 * no longer exists.
 */
function Screens() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const settled = useRef(pathname)

  useEffect(() => {
    // Only on an actual navigation. Comparing the path rather than tripping a
    // "first render" flag matters: StrictMode runs effects twice on mount, and
    // a flag would let the second pass steal focus from the search field that
    // just autofocused itself.
    if (settled.current === pathname) return
    settled.current = pathname
    main.current?.focus()
  }, [pathname])

  return (
    <main ref={main} tabIndex={-1} className="outline-none">
      <Routes>
        <Route path="/" element={<SearchScreen />} />
        <Route path="/add" element={<AddItemScreen />} />
        <Route path="/c/:code" element={<ContainerScreen />} />
        <Route path="/i/:id" element={<ItemScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AuthGate>
        <InventoryProvider>
          <BrowserRouter basename={basename}>
            <Screens />
            <UpdateNotice />
          </BrowserRouter>
        </InventoryProvider>
      </AuthGate>
    </ThemeProvider>
  )
}
