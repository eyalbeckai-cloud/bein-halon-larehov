import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { site, formatPrice } from '../config'

/** מציג את הערך מ-config, ואם הוא ריק — סימון בולט שצריך למלא */
function Fill({ value, label }: { value: string; label: string }): ReactNode {
  return value ? value : <span className="fill-me">[למלא ב-config: {label}]</span>
}

export default function Terms() {
  const { book, business, delivery } = site

  return (
    <div className="page page--soft">
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
          הספר ״{book.title}״ מאת {book.author}, עותק מודפס: {formatPrice(book.price)} לעותק
          {book.regularPrice > book.price && ` (מחיר מבצע, במקום ${formatPrice(book.regularPrice)})`}. משלוח עד הבית בישראל:{' '}
          {formatPrice(delivery.shipping.price)} להזמנה.{' '}
          {delivery.pickup.enabled && 'איסוף עצמי: ללא עלות. '}
          המחיר הסופי לתשלום מוצג בעמוד הרכישה לפני התשלום.
        </p>

        <h2>הזמנה ותשלום</h2>
        <p>
          ההזמנה מתבצעת בעמוד הרכישה: ממלאים פרטים, מאשרים את התקנון ואת מדיניות הפרטיות, ומשלמים. התשלום מתבצע
          באמצעות PayPal, בחשבון PayPal או בכרטיס אשראי. פרטי האשראי מוזנים בעמוד המאובטח של PayPal ולא מגיעים
          אלינו. ההזמנה נחשבת מאושרת רק אחרי שהתשלום הושלם, ומספר ההזמנה מוצג בסיומה.
        </p>
        <p>
          אנו רשאים לבטל הזמנה במקרה של טעות מהותית במחיר או בתיאור, אם המלאי אזל, או אם יש חשד לשימוש לרעה.
          במקרה כזה יוחזר מלוא הסכום ששולם.
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
          הפרטים שתמסרו בהזמנה נשמרים ומשמשים רק לטיפול בהזמנה ולמשלוח. הפרטים המלאים — ב
          <Link to="/privacy">מדיניות הפרטיות</Link>.
        </p>

        <h2>אחריות</h2>
        <p>
          אם הספר הגיע פגום או שגוי, פנו אלינו תוך 14 ימים מקבלתו ונחליף אותו או נחזיר את התשלום, ללא עלות. האחריות
          שלנו מוגבלת לסכום ששולם עבור ההזמנה, ככל שהחוק מתיר.
        </p>

        <h2>שינויים בתקנון</h2>
        <p>
          אנו רשאים לעדכן את התקנון מעת לעת. על כל הזמנה חל התקנון שהיה בתוקף ביום ביצועה. על התקנון חלים דיני מדינת
          ישראל.
        </p>

        <h2>נגישות</h2>
        <p>
          אנחנו פועלים כדי שהאתר יהיה נגיש לכל אחד. הפרטים המלאים ודרכי הפנייה בנושא נגישות —
          ב<Link to="/accessibility">הצהרת הנגישות</Link>.
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
