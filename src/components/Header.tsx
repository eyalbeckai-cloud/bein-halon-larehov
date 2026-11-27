import { Link, useLocation } from 'react-router'
import { site, formatPrice } from '../config'

export default function Header() {
  const { pathname } = useLocation()
  const isCheckout = pathname.startsWith('/checkout')

  return (
    <header className="site-header">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        דילוג לתוכן
      </a>
      <Link to="/" className="site-header__brand">
        {site.book.title} <span className="site-header__author">/ {site.book.author}</span>
      </Link>
      {!isCheckout && (
        <Link to="/checkout" className="btn btn--primary btn--small">
          לרכישה <span className="btn__price">{formatPrice(site.book.price)}</span>
        </Link>
      )}
      <span className="site-header__progress" aria-hidden="true" />
    </header>
  )
}
