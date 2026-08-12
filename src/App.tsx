import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
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

export function App() {
  return (
    <ThemeProvider>
      <AuthGate>
        <InventoryProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/" element={<SearchScreen />} />
              <Route path="/add" element={<AddItemScreen />} />
              <Route path="/c/:code" element={<ContainerScreen />} />
              <Route path="/i/:id" element={<ItemScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </InventoryProvider>
      </AuthGate>
    </ThemeProvider>
  )
}
