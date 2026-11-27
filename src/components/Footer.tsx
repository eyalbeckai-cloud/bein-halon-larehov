import { Link } from 'react-router'
import { site } from '../config'

export default function Footer() {
  const { business } = site
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          © {new Date().getFullYear()} {site.book.author}. כל הזכויות שמורות.
        </p>
        <nav aria-label="קישורים בתחתית">
          <Link to="/checkout">רכישת הספר</Link>
          <Link to="/terms">תקנון ומדיניות ביטולים</Link>
          <Link to="/privacy">מדיניות פרטיות</Link>
          {business.email && <a href={`mailto:${business.email}`}>{business.email}</a>}
          {business.phone && <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>{business.phone}</a>}
        </nav>
      </div>
    </footer>
  )
}
