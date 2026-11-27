import { Link } from 'react-router'
import { site } from '../config'

export default function ThankYou() {
  const { business, delivery } = site
  return (
    <div className="page page--paper">
      <div className="prose">
        <h1>תודה, ההזמנה התקבלה</h1>
        <p>אישור התשלום נשלח אליכם במייל מ-PayPal.</p>
        <p>
          בחרתם משלוח? הספר יישלח לכתובת שמילאתם בעמוד התשלום
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
