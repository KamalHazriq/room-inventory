import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// Registers the service worker as a side effect and exposes the waiting-update
// state to UpdateNotice.
import './lib/swUpdate'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
