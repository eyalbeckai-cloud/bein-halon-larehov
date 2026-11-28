import { site } from '../config'

/* ------------------------------------------------------------------
   עמוד הניהול: קריאות לפונקציה admin בסופבייס.
   הדפדפן אף פעם לא ניגש לטבלה ישירות.
   ------------------------------------------------------------------ */

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'payment_review'
  | 'failed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type AdminOrder = {
  id: string
  order_number: number
  created_at: string
  updated_at: string
  status: OrderStatus
  delivery_method: 'shipping' | 'pickup'
  quantity: number
  unit_price: number | string
  shipping_fee: number | string | null
  total: number | string
  full_name: string
  phone: string
  email: string
  city: string | null
  street: string | null
  house_number: string | null
  apartment: string | null
  zip: string | null
  delivery_notes: string | null
  paypal_order_id: string | null
  paypal_capture_id: string | null
  paypal_payer_email: string | null
  paypal_payer_name: string | null
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  customer_email_sent_at: string | null
  notify_email_sent_at: string | null
  email_error: string | null
  admin_notes: string | null
}

export type OrderDetails = Pick<
  AdminOrder,
  'full_name' | 'phone' | 'email' | 'city' | 'street' | 'house_number' | 'apartment' | 'zip' | 'delivery_notes'
>

export type AdminStatus = 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export type OrderChange = { status?: AdminStatus; details?: OrderDetails; admin_notes?: string }

/* ----------------------------- כניסה ----------------------------- */

const TOKEN_KEY = 'bhl-admin-session'

export const session = {
  get(): string | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY)
      if (!raw) return null
      const { token, expiresAt } = JSON.parse(raw)
      if (typeof token !== 'string' || Number(expiresAt) < Date.now()) return null
      return token
    } catch {
      return null
    }
  },
  set(token: string, expiresAt: number) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }))
    } catch {
      /* מצב גלישה פרטית: הכניסה תחזיק עד סגירת הלשונית */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

/* ----------------------------- שרת ----------------------------- */

export class AdminError extends Error {
  constructor(
    public code: string,
    public details?: Record<string, string>,
  ) {
    super(code)
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!site.supabaseUrl) throw new AdminError('no_backend')
  let res: Response
  try {
    res = await fetch(`${site.supabaseUrl}/functions/v1/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AdminError('network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminError(data.error ?? `http_${res.status}`, data.details)
  return data as T
}

export const adminLogin = (password: string) =>
  call<{ token: string; expiresAt: number }>({ action: 'login', password })

export const adminList = (token: string) => call<{ orders: AdminOrder[] }>({ action: 'list', token })

export const adminUpdate = (token: string, id: string, change: OrderChange) =>
  call<{ order: AdminOrder }>({ action: 'update', token, id, ...change })

export const isSessionError = (e: unknown) =>
  e instanceof AdminError && (e.code === 'unauthorized' || e.code === 'session_expired')

export function adminErrorMessage(e: unknown): string {
  const code = e instanceof AdminError ? e.code : ''
  switch (code) {
    case 'wrong_password':
      return 'הסיסמה לא נכונה. נסו שוב.'
    case 'too_many_attempts':
      return 'היו יותר מדי ניסיונות שגויים. הכניסה נעולה לרבע שעה.'
    case 'not_configured':
      return 'עדיין לא הוגדרה סיסמה לעמוד הניהול (ADMIN_PASSWORD בסופבייס, לפחות 10 תווים).'
    case 'setup_incomplete':
      return 'צריך להריץ שוב את schema.sql בסופבייס (SQL Editor) כדי להשלים את ההגדרה.'
    case 'no_backend':
      return 'האתר לא מחובר לסופבייס (חסר SUPABASE_URL ב-GitHub Secrets).'
    case 'network':
      return 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.'
    case 'session_expired':
    case 'unauthorized':
      return 'צריך להיכנס שוב.'
    case 'validation':
      return 'חלק מהפרטים לא תקינים. בדקו את השדות המסומנים.'
    case 'not_paid':
      return 'אפשר לעדכן רק הזמנות ששולמו.'
    case 'forbidden_origin':
      return 'הכתובת של האתר לא מופיעה ב-ALLOWED_ORIGINS בסופבייס.'
    default:
      return 'משהו השתבש. נסו שוב בעוד רגע.'
  }
}

/* ------------------------- תצוגה ------------------------- */

export function statusLabel(o: Pick<AdminOrder, 'status' | 'delivery_method'>): string {
  const pickup = o.delivery_method === 'pickup'
  switch (o.status) {
    case 'paid':
      return pickup ? 'מחכה לאיסוף' : 'מחכה למשלוח'
    case 'payment_review':
      return 'תשלום לבדיקה'
    case 'shipped':
      return 'נשלחה, בדרך ללקוח'
    case 'delivered':
      return pickup ? 'נאספה' : 'הגיעה ללקוח'
    case 'refunded':
      return 'בוטלה, הכסף הוחזר'
    case 'cancelled':
      return 'בוטלה'
    case 'failed':
      return 'התשלום נכשל'
    default:
      return 'לא שולמה'
  }
}

export const isPaidOrder = (o: AdminOrder) => o.status !== 'pending' && o.status !== 'failed'
export const isSold = (o: AdminOrder) => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered'

export const formatMoney = (n: number | string | null) => {
  const v = Number(n ?? 0)
  return `${v.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`
}

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear()

export function formatDate(iso: string | null, withTime = true): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    ...(sameYear(d) ? {} : { year: 'numeric' }),
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Asia/Jerusalem',
  }).format(d)
}

export function addressLine(o: AdminOrder): string {
  if (o.delivery_method !== 'shipping') return ''
  return [
    `${o.street ?? ''} ${o.house_number ?? ''}`.trim(),
    o.apartment ? `דירה ${o.apartment}` : '',
    o.city ?? '',
    o.zip ? `מיקוד ${o.zip}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

/** קישור לוואטסאפ: 050-1234567 → 972501234567 */
export function whatsappLink(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `972${digits.slice(1)}`
  return digits.length >= 11 ? `https://wa.me/${digits}` : null
}

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/* --------------------------- אקסל --------------------------- */

export function ordersToCsv(orders: AdminOrder[]): string {
  const head = [
    'מספר הזמנה',
    'תאריך הזמנה',
    'מצב',
    'אופן מסירה',
    'כמות',
    'סה״כ',
    'שם',
    'טלפון',
    'אימייל',
    'עיר',
    'רחוב',
    'מספר בית',
    'דירה',
    'מיקוד',
    'הערות הלקוח',
    'הערות פנימיות',
    'נשלח',
    'הגיע / נאסף',
  ]
  const cell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = orders.map((o) => [
    o.order_number,
    formatDate(o.paid_at ?? o.created_at),
    statusLabel(o),
    o.delivery_method === 'shipping' ? 'משלוח' : 'איסוף עצמי',
    o.quantity,
    Number(o.total),
    o.full_name,
    o.phone,
    o.email,
    o.city,
    o.street,
    o.house_number,
    o.apartment,
    o.zip,
    o.delivery_notes,
    o.admin_notes,
    formatDate(o.shipped_at),
    formatDate(o.delivered_at),
  ])
  // BOM כדי שאקסל יציג עברית נכון
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
