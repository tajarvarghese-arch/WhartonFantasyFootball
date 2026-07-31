import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { DataProvider } from './lib/data'
import { applyMotionPreference } from './lib/motion'
import './index.css'

applyMotionPreference()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing keeps deep links working on GitHub Pages without a server. */}
    <HashRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </HashRouter>
  </StrictMode>,
)
