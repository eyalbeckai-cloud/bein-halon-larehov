import { lazy, Suspense, useEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Header from './components/Header'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Checkout from './pages/Checkout'
import ThankYou from './pages/ThankYou'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Accessibility from './pages/Accessibility'
import NotFound from './pages/NotFound'

// עמוד הניהול נטען רק כשנכנסים אליו
const Admin = lazy(() => import('./pages/Admin'))

const TITLES: Record<string, string> = {
  '/': 'בין חלון לרחוב | ספרו של ד״ר שמואל בק',
  '/checkout': 'רכישת הספר | בין חלון לרחוב',
  '/thank-you': 'תודה על ההזמנה | בין חלון לרחוב',
  '/terms': 'תקנון ומדיניות ביטולים | בין חלון לרחוב',
  '/privacy': 'מדיניות פרטיות | בין חלון לרחוב',
  '/accessibility': 'הצהרת נגישות | בין חלון לרחוב',
}

/** בכל מעבר עמוד: גלילה לראש, כותרת מתאימה, והעברת הפוקוס לתוכן (לקוראי מסך ולמקלדת) */
function ScrollToTop() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  useEffect(() => {
    window.scrollTo(0, 0)
    const path = pathname.replace(/(.)\/+$/, '$1')
    document.title = TITLES[path] ?? 'העמוד לא נמצא | בין חלון לרחוב'
    if (previous.current !== pathname) {
      previous.current = pathname
      document.getElementById('main')?.focus({ preventScroll: true })
    }
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()

  // עמוד הניהול: בלי הכותרת והתחתית של האתר
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    )
  }

  return (
    <>
      <ScrollToTop />
      <Header />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
