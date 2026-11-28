import { Link, useLocation } from 'react-router'
import { site } from '../config'
import Price from './Price'

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
          לרכישה <Price className="btn__price" />
        </Link>
      )}
      <span className="site-header__progress" aria-hidden="true" />
    </header>
  )
}
