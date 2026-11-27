import { useState } from 'react'
import { Link } from 'react-router'
import Book from '../components/Book'
import PayPalHostedButton from '../components/PayPalHostedButton'
import { site, formatPrice } from '../config'
import '../styles/checkout.css'

type Method = 'shipping' | 'pickup'

export default function Checkout() {
  const { book, delivery, paypal } = site
  const [method, setMethod] = useState<Method>('shipping')
  const pickupEnabled = delivery.pickup.enabled

  const buttonId = method === 'pickup' ? paypal.buttons.pickup : paypal.buttons.shipping

  return (
    <div className="page checkout">
      <div className="checkout__grid">
        <aside className="checkout__book" aria-label="הספר">
          <div className="checkout__arch">
            <Book className="book--checkout" />
          </div>
          <p className="checkout__book-title">{book.title}</p>
          <p className="checkout__book-author">{book.author}</p>
        </aside>

        <section className="checkout__order" aria-labelledby="checkout-title">
          <h1 id="checkout-title" className="checkout__title">
            רכישת הספר
          </h1>

          {pickupEnabled ? (
            <fieldset className="delivery">
              <legend className="delivery__legend">איך לקבל את הספר?</legend>

              <label className={`delivery__option${method === 'shipping' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  value="shipping"
                  checked={method === 'shipping'}
                  onChange={() => setMethod('shipping')}
                />
                <span className="delivery__text">
                  <span className="delivery__label">{delivery.shipping.label}</span>
                  <span className="delivery__note">{delivery.shipping.note}</span>
                </span>
                <span className="delivery__price">חינם</span>
              </label>

              <label className={`delivery__option${method === 'pickup' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  value="pickup"
                  checked={method === 'pickup'}
                  onChange={() => setMethod('pickup')}
                />
                <span className="delivery__text">
                  <span className="delivery__label">{delivery.pickup.label}</span>
                  <span className="delivery__note">{delivery.pickup.note}</span>
                </span>
                <span className="delivery__price">חינם</span>
              </label>
            </fieldset>
          ) : (
            <p className="delivery__single">{delivery.shipping.label}, חינם.</p>
          )}

          <dl className="summary">
            <div className="summary__row">
              <dt>{book.title}, עותק מודפס</dt>
              <dd>{formatPrice(book.price)}</dd>
            </div>
            <div className="summary__row">
              <dt>{method === 'pickup' ? 'איסוף עצמי' : 'משלוח עד הבית'}</dt>
              <dd>חינם</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>סה״כ לתשלום</dt>
              <dd>{formatPrice(book.price)}</dd>
            </div>
          </dl>

          {delivery.deliveryTime && method === 'shipping' && (
            <p className="checkout__eta">זמן אספקה: {delivery.deliveryTime}</p>
          )}

          <div className="checkout__pay">
            <PayPalHostedButton key={`${method}-${buttonId}`} hostedButtonId={buttonId} />
          </div>

          <ul className="checkout__notes">
            <li>התשלום מתבצע בעמוד המאובטח של PayPal. פרטי האשראי לא עוברים דרך האתר.</li>
            <li>ברוב המקרים אפשר לשלם בכרטיס אשראי גם בלי חשבון PayPal.</li>
            <li>אחרי התשלום יישלח אליכם אישור במייל.</li>
          </ul>

          <p className="checkout__terms">
            ברכישה אתם מאשרים את <Link to="/terms">התקנון ומדיניות הביטולים</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
