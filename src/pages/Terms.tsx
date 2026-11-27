import type { ReactNode } from 'react'
import { site, formatPrice } from '../config'

/** מציג את הערך מ-config, ואם הוא ריק — סימון בולט שצריך למלא */
function Fill({ value, label }: { value: string; label: string }): ReactNode {
  return value ? value : <span className="fill-me">[למלא ב-config: {label}]</span>
}

export default function Terms() {
  const { book, business, delivery } = site

  return (
    <div className="page page--paper">
      <article className="prose">
        <h1>תקנון ומדיניות ביטולים</h1>

        <h2>כללי</h2>
        <p>
          האתר מופעל על ידי <Fill value={business.name} label="שם העסק" />, מספר עוסק{' '}
          <Fill value={business.registrationNumber} label="מספר עוסק" />, כתובת{' '}
          <Fill value={business.address} label="כתובת" />. רכישה באתר מהווה הסכמה לתנאים שבתקנון זה.
        </p>

        <h2>המוצר והמחיר</h2>
        <p>
          הספר ״{book.title}״ מאת {book.author}, עותק מודפס. המחיר הסופי לתשלום הוא {formatPrice(book.price)},
          כולל משלוח עד הבית בישראל.
        </p>

        <h2>תשלום</h2>
        <p>
          התשלום מתבצע באמצעות PayPal, בחשבון PayPal או בכרטיס אשראי. פרטי האשראי מוזנים בעמוד המאובטח של
          PayPal ולא נשמרים באתר.
        </p>

        <h2>משלוח ואספקה</h2>
        <p>
          הספר יישלח לכתובת שנמסרה בעמוד התשלום. זמן האספקה:{' '}
          <Fill value={delivery.deliveryTime} label="זמן אספקה" />.
        </p>
        {delivery.pickup.enabled && (
          <p>בבחירה באיסוף עצמי ניצור קשר לתיאום מקום ושעה לאיסוף.</p>
        )}

        <h2>ביטול עסקה והחזרות</h2>
        <p>
          ניתן לבטל את העסקה בהתאם לחוק הגנת הצרכן, התשמ״א-1981, ולתקנות הגנת הצרכן (ביטול עסקה),
          התשע״א-2010: מיום ביצוע העסקה ועד 14 ימים מיום קבלת הספר. בביטול ייגבו דמי ביטול בשיעור 5% ממחיר
          העסקה או 100 ₪, הנמוך מביניהם, ככל שהחוק מתיר.
        </p>
        <p>
          הודעת ביטול שולחים למייל <Fill value={business.email} label="אימייל" /> או בטלפון{' '}
          <Fill value={business.phone} label="טלפון" />. ההחזר יבוצע לאמצעי התשלום שבו בוצעה הרכישה.
        </p>

        <h2>פרטיות</h2>
        <p>
          האתר עצמו לא שומר פרטים אישיים. שם, כתובת ומייל נמסרים ל-PayPal בעמוד התשלום, ומשמשים אותנו רק
          לטיפול בהזמנה ולמשלוח.
        </p>

        <h2>נגישות</h2>
        <p>
          אנחנו פועלים כדי שהאתר יהיה נגיש לכל אחד. נתקלתם בקושי? כתבו לנו ל-
          <Fill value={business.email} label="אימייל" /> ונטפל בזה.
        </p>

        <h2>יצירת קשר</h2>
        <p>
          מייל: <Fill value={business.email} label="אימייל" />
          <br />
          טלפון: <Fill value={business.phone} label="טלפון" />
        </p>
      </article>
    </div>
  )
}
