/**
 * ===========================================================
 *  כל ההגדרות של האתר במקום אחד.
 *  משנים כאן מחיר, טקסטים קבועים, פרטי עסק ו-PayPal.
 * ===========================================================
 */

const env = import.meta.env

export const site = {
  book: {
    title: 'בין חלון לרחוב',
    author: 'ד״ר שמואל בק',
    /** מחיר הספר בשקלים, כולל משלוח */
    price: 84,
    /**
     * תמונת כריכה קדמית (לא חובה).
     * שימו קובץ בתיקייה public, למשל public/cover.jpg, וכתבו כאן 'cover.jpg'.
     * כל עוד זה ריק, האתר מציג כריכה מעוצבת.
     */
    coverImage: '',
  },

  delivery: {
    shipping: {
      label: 'משלוח עד הבית',
      note: 'את הכתובת ממלאים בעמוד התשלום',
    },
    pickup: {
      /** false = רק משלוח. true = הלקוח יכול לבחור גם איסוף עצמי */
      enabled: true,
      label: 'איסוף עצמי',
      note: 'ניצור קשר לתיאום מקום ושעה',
    },
    /** לדוגמה: 'עד 7 ימי עסקים'. ריק = לא מוצג */
    deliveryTime: '',
  },

  paypal: {
    /** Client ID של PayPal. עדיף להגדיר ב-GitHub Variables בשם VITE_PAYPAL_CLIENT_ID */
    clientId: env.VITE_PAYPAL_CLIENT_ID || '',
    /** מזהי הכפתורים שנוצרים בדשבורד של PayPal (hostedButtonId) */
    buttons: {
      shipping: env.VITE_PAYPAL_BUTTON_SHIPPING || '',
      pickup: env.VITE_PAYPAL_BUTTON_PICKUP || '',
    },
    currency: 'ILS',
  },

  /** פרטי העסק — מופיעים בתקנון ובתחתית האתר. חובה למלא לפני עלייה לאוויר */
  business: {
    name: '',
    registrationNumber: '',
    email: '',
    phone: '',
    address: '',
  },
}

export const formatPrice = (n: number) => `${n} ₪`
