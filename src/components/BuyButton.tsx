import { Link } from 'react-router'
import { site, formatPrice } from '../config'

type Props = {
  tone?: 'primary' | 'ink' | 'light'
  showNote?: boolean
}

/** משלוח עד הבית 30 ₪, איסוף עצמי בחינם */
export function deliveryNote() {
  const { shipping, pickup } = site.delivery
  const ship = `משלוח עד הבית ${formatPrice(shipping.price)}`
  return pickup.enabled ? `${ship}, איסוף עצמי בחינם` : ship
}

export default function BuyButton({ tone = 'primary', showNote = true }: Props) {
  return (
    <div className="buy">
      <Link to="/checkout" className={`btn btn--${tone}`}>
        לרכישת הספר <span className="btn__price">{formatPrice(site.book.price)}</span>
      </Link>
      {showNote && <p className="buy__note">{deliveryNote()}</p>}
    </div>
  )
}
