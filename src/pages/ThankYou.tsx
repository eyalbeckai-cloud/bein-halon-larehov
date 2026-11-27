import { Link, useSearchParams } from 'react-router'
import { site } from '../config'

export default function ThankYou() {
  const { business, delivery } = site
  const [params] = useSearchParams()
  const orderNumber = params.get('order')
  const review = params.get('review') === '1'

  return (
    <div className="page page--soft">
      <div className="prose">
        <h1>תודה, ההזמנה התקבלה</h1>
        {orderNumber && (
          <p>
            מספר ההזמנה שלך: <strong>{orderNumber}</strong>
          </p>
        )}
        {review ? (
          <p>התשלום התקבל וממתין לאישור סופי של PayPal. ניצור קשר אם יהיה צורך במשהו נוסף.</p>
        ) : (
          <p>אישור התשלום נשלח אליכם במייל מ-PayPal.</p>
        )}
        <p>
          בחרתם משלוח? הספר יישלח לכתובת שמילאתם
          {delivery.deliveryTime ? `, ${delivery.deliveryTime}` : ''}.
        </p>
        {delivery.pickup.enabled && <p>בחרתם איסוף עצמי מרמת גן? ניצור איתכם קשר לתיאום מקום ושעה.</p>}
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
