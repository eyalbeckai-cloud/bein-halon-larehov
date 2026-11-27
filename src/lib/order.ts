import { site } from '../config'

/** טופס ההזמנה — אותם שמות שדות כמו בטבלה ובפונקציית השרת */
export type OrderForm = {
  delivery_method: 'shipping' | 'pickup'
  quantity: number
  full_name: string
  phone: string
  email: string
  city: string
  street: string
  house_number: string
  apartment: string
  zip: string
  delivery_notes: string
  terms_accepted: boolean
  /** שדה מלכודת לבוטים — מוסתר מאנשים */
  company: string
}

export type FieldErrors = Partial<Record<keyof OrderForm, string>>

export const emptyForm: OrderForm = {
  delivery_method: 'shipping',
  quantity: 1,
  full_name: '',
  phone: '',
  email: '',
  city: '',
  street: '',
  house_number: '',
  apartment: '',
  zip: '',
  delivery_notes: '',
  terms_accepted: false,
  company: '',
}

const messages: Record<string, string> = {
  full_name: 'נא למלא שם מלא',
  phone: 'נא למלא מספר טלפון תקין',
  email: 'נא למלא כתובת אימייל תקינה',
  city: 'נא למלא עיר',
  street: 'נא למלא רחוב',
  house_number: 'נא למלא מספר בית',
  zip: 'מיקוד צריך להכיל 5 או 7 ספרות',
  quantity: 'כמות לא תקינה',
  delivery_method: 'נא לבחור איך לקבל את הספר',
  terms_accepted: 'כדי להמשיך יש לאשר את התקנון ואת מדיניות הפרטיות',
}

/** בדיקה בדפדפן — אותם כללים כמו בשרת, כדי להראות שגיאות מיד */
export function validate(f: OrderForm): FieldErrors {
  const e: FieldErrors = {}
  if (f.full_name.trim().length < 2) e.full_name = messages.full_name
  const digits = f.phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 13 || !/^[\d\s+()-]+$/.test(f.phone.trim())) e.phone = messages.phone
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = messages.email
  if (f.delivery_method === 'shipping') {
    if (f.city.trim().length < 2) e.city = messages.city
    if (f.street.trim().length < 2) e.street = messages.street
    if (!f.house_number.trim()) e.house_number = messages.house_number
    if (f.zip.trim() && !/^\d{5,7}$/.test(f.zip.trim())) e.zip = messages.zip
  }
  if (!Number.isInteger(f.quantity) || f.quantity < 1 || f.quantity > site.maxQuantity) e.quantity = messages.quantity
  if (!f.terms_accepted) e.terms_accepted = messages.terms_accepted
  return e
}

/** שגיאות שחזרו מהשרת → הודעות בעברית */
export function serverFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== 'object') return {}
  const out: FieldErrors = {}
  for (const key of Object.keys(details)) {
    out[key as keyof OrderForm] = messages[key] ?? 'ערך לא תקין'
  }
  return out
}

/* ------------------------- קריאות לשרת ------------------------- */

export class ApiError extends Error {
  constructor(
    public code: string,
    public details?: unknown,
  ) {
    super(code)
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${site.supabaseUrl}/functions/v1/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `http_${res.status}`, data.details)
  return data as T
}

export const createOrder = (form: OrderForm) =>
  call<{ orderID: string; orderNumber: number }>({ action: 'create', ...form })

export const captureOrder = (orderID: string) =>
  call<{ ok: true; orderNumber: number; status: 'paid' | 'payment_review' | 'shipped' }>({
    action: 'capture',
    orderID,
  })

export function errorMessage(code: string): string {
  switch (code) {
    case 'network':
      return 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.'
    case 'validation':
      return 'חלק מהפרטים חסרים או לא תקינים. בדקו את השדות המסומנים.'
    case 'paypal_create_failed':
      return 'לא הצלחנו לפתוח את התשלום. נסו שוב בעוד רגע.'
    case 'paypal_capture_failed':
    case 'payment_not_completed':
      return 'התשלום לא הושלם ולא חויבתם. אפשר לנסות שוב.'
    default:
      return 'משהו השתבש. נסו שוב, ואם זה חוזר — כתבו לנו.'
  }
}
