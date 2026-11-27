import { Link } from 'react-router'
import { site, formatPrice } from '../config'

type Props = {
  tone?: 'primary' | 'ink' | 'light'
  showNote?: boolean
}

export default function BuyButton({ tone = 'primary', showNote = true }: Props) {
  return (
    <div className="buy">
      <Link to="/checkout" className={`btn btn--${tone}`}>
        לרכישת הספר <span className="btn__price">{formatPrice(site.book.price)}</span>
      </Link>
      {showNote && <p className="buy__note">משלוח חינם עד הבית</p>}
    </div>
  )
}
