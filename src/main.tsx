import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router'
import App from './App'
// גופן מאוחסן באתר עצמו (בלי תלות ב-Google Fonts)
import '@fontsource-variable/rubik'
import './styles/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.VITE_HASH_ROUTER ? (
      // תצוגה מקדימה במקומות שלא תומכים בכתובות כמו /checkout (למשל ארטיפקט של Claude)
      <HashRouter>
        <App />
      </HashRouter>
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
