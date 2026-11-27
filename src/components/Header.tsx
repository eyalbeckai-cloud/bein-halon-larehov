import { Link, useLocation } from 'react-router'
import { site, formatPrice } from '../config'

export default function Header() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const isCheckout = pathname.startsWith('/checkout')

  return (
    <header className={`site-header${isLanding ? '' : ' site-header--solid'}`}>
      <a className="skip-link" href="#main">
        דילוג לתוכן
      </a>
      <Link to="/" className="site-header__brand">
        {site.book.title}
      </Link>
      {!isCheckout && (
        <Link to="/checkout" className="btn btn--gold btn--small btn--header">
          לרכישה <span className="btn__price">{formatPrice(site.book.price)}</span>
        </Link>
      )}
    </header>
  )
}
