/**
 * ===========================================================
 *  כל ההגדרות של האתר במקום אחד.
 *  משנים כאן מחיר, טקסטים קבועים, פרטי עסק ו-PayPal.
 * ===========================================================
 */

const env = import.meta.env

/** https://abcd.supabase.co/rest/v1 → https://abcd.supabase.co */
function originOf(url?: string): string {
  try {
    return url ? new URL(url.trim()).origin : ''
  } catch {
    return ''
  }
}

export const site = {
  book: {
    title: 'בין חלון לרחוב',
    author: 'ד״ר שמואל בק',
    /** מחיר עותק אחד בשקלים. זה המחיר שנגבה (חייב להתאים ל-BOOK_PRICE בפונקציית השרת) */
    price: 55,
    /**
     * מבצע: המחיר הרגיל, שמוצג עם קו חוצה ליד price.
     * 0 = אין מבצע (מוצג רק price).
     */
    regularPrice: 65,
    /**
     * תמונת כריכה קדמית (לא חובה).
     * שימו קובץ בתיקייה public, למשל public/cover.jpg, וכתבו כאן 'cover.jpg'.
     * כל עוד זה ריק, האתר מציג כריכה מעוצבת.
     */
    coverImage: 'cover.jpg',
  },

  delivery: {
    shipping: {
      label: 'משלוח עד הבית',
      note: 'את הכתובת ממלאים למטה',
      /** מחיר משלוח להזמנה (חייב להתאים ל-SHIPPING_PRICE בפונקציית השרת) */
      price: 30,
    },
    pickup: {
      /** false = רק משלוח. true = הלקוח יכול לבחור גם איסוף עצמי */
      enabled: true,
      label: 'איסוף עצמי מרמת גן',
      note: 'ניצור קשר לתיאום מקום ושעה',
      price: 0,
    },
    /** לדוגמה: 'עד 7 ימי עסקים'. ריק = לא מוצג */
    deliveryTime: 'עד 14 ימי עסקים',
    },

  /** כמה עותקים אפשר להזמין בהזמנה אחת (חייב להתאים ל-MAX_QUANTITY בפונקציית השרת) */
  maxQuantity: 5,

  paypal: {
    /** Client ID של אפליקציית PayPal (ציבורי). מוגדר ב-GitHub Secrets בשם PAYPAL_CLIENT_ID */
    clientId: env.VITE_PAYPAL_CLIENT_ID || '',
    currency: 'ILS',
  },

  /**
   * כתובת הפרויקט ב-Supabase, למשל https://abcd1234.supabase.co (GitHub Secrets: SUPABASE_URL).
   * לוקחים רק את הדומיין, כך שגם כתובת עם תוספת (למשל /rest/v1) עובדת.
   */
  supabaseUrl: originOf(env.VITE_SUPABASE_URL),

  /** פרטי העסק — מופיעים בתקנון ובתחתית האתר. חובה למלא לפני עלייה לאוויר */
  business: {
    name: 'ד״ר שמואל בק',
    registrationNumber: '012345678',
    email: 'shmuelbeck54@gmail.com',
    phone: '050-6966817',
    address: 'זבוטינסקי, 5, רמת גן',
  },
}

export const formatPrice = (n: number) => `${n} ₪`
