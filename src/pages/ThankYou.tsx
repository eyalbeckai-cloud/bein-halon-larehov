import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { site } from '../config'

export default function ThankYou() {
  const { business, delivery } = site
  const [params] = useSearchParams()
  const orderNumber = params.get('order')
  const review = params.get('review') === '1'
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!orderNumber) return
    try {
      await navigator.clipboard.writeText(orderNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* הדפדפן לא איפשר העתקה — המספר עדיין מוצג על המסך */
    }
  }

  return (
    <div className="page page--soft">
      <div className="prose">
        <h1>תודה, ההזמנה התקבלה</h1>

        {orderNumber && (
          <div className="order-number">
            <div>
              <p className="order-number__label">מספר הזמנה</p>
              <p className="order-number__value">{orderNumber}</p>
            </div>
            <button type="button" className="btn btn--ink btn--small" onClick={copy}>
              {copied ? 'הועתק' : 'העתקת המספר'}
            </button>
          </div>
        )}

        <p>
          {review
            ? 'התשלום התקבל וממתין לאישור סופי של PayPal. ניצור קשר אם יהיה צורך במשהו נוסף.'
            : 'אישור התשלום נשלח אליכם במייל מ-PayPal, ומספר ההזמנה מופיע בו.'}{' '}
          כדאי לשמור את המספר — איתו אפשר לפנות אלינו לגבי ההזמנה.
        </p>
        <p>
          בחרתם משלוח? הספר יישלח לכתובת שמילאתם
          {delivery.deliveryTime ? `, ${delivery.deliveryTime}` : ''}.
        </p>
        {delivery.pickup.enabled && <p>בחרתם איסוף עצמי? ניצור איתכם קשר לתיאום מקום ושעה.</p>}
        {business.email && (
          <p>
            שאלות על ההזמנה: <a href={`mailto:${business.email}`}>{business.email}</a>
          </p>
        )}
        <p style={{ marginTop: '2rem' }}>
          <Link to="/" className="btn btn--ink">
            חזרה לעמוד הספר
          </Link>
        </p>
      </div>
    </div>
  )
}
