import { Link } from 'react-router'
import { site, formatPrice } from '../config'

type Props = {
  tone?: 'gold' | 'ink'
  showNote?: boolean
}

export default function BuyButton({ tone = 'gold', showNote = true }: Props) {
  return (
    <div className="buy">
      <Link to="/checkout" className={`btn btn--${tone}`}>
        לרכישת הספר <span className="btn__price">{formatPrice(site.book.price)}</span>
      </Link>
      {showNote && <p className="buy__note">כולל משלוח חינם עד הבית</p>}
    </div>
  )
}
