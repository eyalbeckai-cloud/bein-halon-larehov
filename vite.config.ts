import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH מגיע אוטומטית מ-GitHub Actions (למשל "/bein-halon-larehov").
// בדומיין מותאם אישית הוא ריק, ובפיתוח מקומי האתר רץ מ-"/".
const basePath = (process.env.BASE_PATH ?? '').replace(/\/$/, '')

// כתובת האתר המלאה — לתגיות השיתוף (og:image צריך כתובת מלאה).
const siteUrl = (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')

export default defineConfig({
  base: `${basePath}/`,
  plugins: [
    react(),
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl || basePath),
    },
  ],
})
