// GitHub Pages מגיש קבצים סטטיים בלבד. כדי שכתובות כמו /checkout יעבדו גם
// בכניסה ישירה או ברענון, יוצרים עותק של index.html בכל נתיב,
// ו-404.html כגיבוי לכל כתובת אחרת.
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const routes = ['checkout', 'thank-you', 'terms']
const index = join(dist, 'index.html')

for (const route of routes) {
  mkdirSync(join(dist, route), { recursive: true })
  copyFileSync(index, join(dist, route, 'index.html'))
}
copyFileSync(index, join(dist, '404.html'))

console.log(`spa-routes: created ${routes.map((r) => `/${r}/`).join(', ')} and 404.html`)
