import { Link } from 'react-router'
import { site, formatPrice } from '../config'
import Price, { onSale } from './Price'

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
        לרכישת הספר <Price className="btn__price" />
      </Link>
      {showNote && <p className="buy__note">{onSale() ? `במבצע כרגע. ${deliveryNote()}` : deliveryNote()}</p>}
    </div>
  )
}
