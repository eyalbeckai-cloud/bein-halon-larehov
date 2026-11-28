/**
 * Edge Function: admin
 * ------------------------------------------------------------
 * השרת של עמוד הניהול באתר (/admin). רק מי שיודע את הסיסמה נכנס.
 *
 *   action: "login"  — בודק את הסיסמה ומחזיר אסימון כניסה (תקף 14 יום)
 *   action: "list"   — כל ההזמנות
 *   action: "update" — שינוי מצב הזמנה, תיקון פרטי לקוח, הערות פנימיות
 *
 * Secrets שצריך להגדיר (Supabase > Edge Functions > Secrets):
 *   ADMIN_PASSWORD   הסיסמה לעמוד הניהול (לפחות 10 תווים)
 *   ALLOWED_ORIGINS  כבר מוגדר בשביל checkout, משמש גם כאן
 *
 * הגנה מניחוש סיסמה: אחרי 8 ניסיונות שגויים מאותה כתובת ברבע שעה
 * (או 60 בסך הכול) הכניסה ננעלת לרבע שעה.
 * החלפת ADMIN_PASSWORD מנתקת מיד את כל מי שמחובר.
 *
 * SUPABASE_URL והמפתח הסודי מוזרקים אוטומטית.
 */

const SESSION_DAYS = 14
const LOCK_MINUTES = 15
const MAX_FAILS_PER_IP = 8
const MAX_FAILS_TOTAL = 60

const env = (name: string) => Deno.env.get(name)?.trim() ?? ''

const ALLOWED_ORIGINS = env('ALLOWED_ORIGINS')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean)

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code)
  }
}

/* ----------------------------- CORS ----------------------------- */

function isAllowedOrigin(origin: string) {
  if (!ALLOWED_ORIGINS.length) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) && origin ? origin : ALLOWED_ORIGINS[0] ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/* --------------------------- Database --------------------------- */

function serviceKey(): string {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}')
    if (keys.default) return keys.default
  } catch {
    /* ignore */
  }
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!legacy) throw new Error('Missing Supabase secret key')
  return legacy
}

class DbError extends Error {}

async function db<T = unknown>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const key = serviceKey()
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  if (init.prefer) headers.Prefer = init.prefer

  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  if (!res.ok) throw new DbError(`Database ${res.status}: ${text}`)
  // return=minimal מחזיר תשובה ריקה (201/204)
  return (text ? JSON.parse(text) : null) as T
}

/** עמודות שעמוד הניהול מקבל */
const COLUMNS = [
  'id',
  'order_number',
  'created_at',
  'updated_at',
  'status',
  'delivery_method',
  'quantity',
  'unit_price',
  'shipping_fee',
  'total',
  'full_name',
  'phone',
  'email',
  'city',
  'street',
  'house_number',
  'apartment',
  'zip',
  'delivery_notes',
  'paypal_order_id',
  'paypal_capture_id',
  'paypal_payer_email',
  'paypal_payer_name',
  'paid_at',
  'shipped_at',
  'delivered_at',
  'customer_email_sent_at',
  'notify_email_sent_at',
  'email_error',
  'admin_notes',
].join(',')

type OrderRow = {
  id: string
  status: string
  delivery_method: 'shipping' | 'pickup'
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
}

/* ---------------------------- Session ---------------------------- */

const enc = new TextEncoder()

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))

function adminPassword(): string {
  const password = env('ADMIN_PASSWORD')
  if (password.length < 10) throw new HttpError(503, 'not_configured')
  return password
}

/** מפתח החתימה נגזר מהסיסמה ומהמפתח הסודי: החלפת סיסמה = כל האסימונים הישנים לא תקפים */
async function sign(data: string): Promise<string> {
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`bhl-admin|${adminPassword()}|${serviceKey()}`))
  const key = await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** משווים חתימות (באורך קבוע) ולא את הסיסמאות עצמן, כדי שזמן התגובה לא ידליף כלום */
async function passwordMatches(given: string) {
  return safeEqual(await sign(`pw|${given}`), await sign(`pw|${adminPassword()}`))
}

async function issueToken() {
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000
  const payload = b64url(enc.encode(JSON.stringify({ exp: expiresAt })))
  return { token: `${payload}.${await sign(`session|${payload}`)}`, expiresAt }
}

export async function requireSession(token: unknown) {
  if (typeof token !== 'string' || token.length > 400) throw new HttpError(401, 'unauthorized')
  const [payload, sig, extra] = token.split('.')
  if (!payload || !sig || extra !== undefined) throw new HttpError(401, 'unauthorized')
  if (!safeEqual(sig, await sign(`session|${payload}`))) throw new HttpError(401, 'unauthorized')
  let exp = 0
  try {
    exp = Number(JSON.parse(fromB64url(payload)).exp)
  } catch {
    /* ignore */
  }
  if (!exp || exp < Date.now()) throw new HttpError(401, 'session_expired')
}

/* ----------------------------- Login ----------------------------- */

function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]
  return (forwarded || req.headers.get('cf-connecting-ip') || 'unknown').trim().slice(0, 64)
}

async function login(body: Record<string, unknown>, ip: string) {
  adminPassword()

  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString()
  const recent = await db<{ ip: string }[]>(
    `admin_login_attempts?select=ip&created_at=gte.${encodeURIComponent(since)}&limit=500`,
  )
  const fromThisIp = recent.filter((r) => r.ip === ip).length
  if (fromThisIp >= MAX_FAILS_PER_IP || recent.length >= MAX_FAILS_TOTAL) {
    throw new HttpError(429, 'too_many_attempts')
  }

  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : ''
  if (password && (await passwordMatches(password))) return issueToken()

  await db('admin_login_attempts', { method: 'POST', body: { ip }, prefer: 'return=minimal' })
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  await db(`admin_login_attempts?created_at=lt.${encodeURIComponent(dayAgo)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  }).catch(() => {})
  await new Promise((r) => setTimeout(r, 600))
  throw new HttpError(401, 'wrong_password')
}

/* ----------------------------- Orders ----------------------------- */

async function listOrders() {
  const orders = await db(`orders?select=${COLUMNS}&order=created_at.desc&limit=2000`)
  return { orders }
}

/** מצבים שאפשר לקבוע מעמוד הניהול */
const ADMIN_STATUSES = ['paid', 'shipped', 'delivered', 'cancelled', 'refunded'] as const
type AdminStatus = (typeof ADMIN_STATUSES)[number]

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** כמו בבדיקה של checkout, כדי שהפרטים המתוקנים יישארו תקינים */
function validateDetails(raw: unknown, deliveryMethod: 'shipping' | 'pickup') {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'invalid_details')
  const d = raw as Record<string, unknown>
  const errors: Record<string, string> = {}

  const full_name = clean(d.full_name, 80)
  if (full_name.length < 2) errors.full_name = 'required'

  const phone = clean(d.phone, 20)
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 13 || !/^[\d\s+()-]+$/.test(phone)) errors.phone = 'invalid'

  const email = clean(d.email, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'invalid'

  const delivery_notes = clean(d.delivery_notes, 300)
  const patch: Record<string, unknown> = { full_name, phone, email, delivery_notes: delivery_notes || null }

  if (deliveryMethod === 'shipping') {
    const city = clean(d.city, 60)
    const street = clean(d.street, 80)
    const house_number = clean(d.house_number, 10)
    const apartment = clean(d.apartment, 10)
    const zip = clean(d.zip, 10)
    if (city.length < 2) errors.city = 'required'
    if (street.length < 2) errors.street = 'required'
    if (!house_number) errors.house_number = 'required'
    if (zip && !/^\d{5,7}$/.test(zip)) errors.zip = 'invalid'
    Object.assign(patch, { city, street, house_number, apartment: apartment || null, zip: zip || null })
  }

  if (Object.keys(errors).length) throw new HttpError(422, 'validation', errors)
  return patch
}

function statusPatch(order: OrderRow, status: unknown): Record<string, unknown> {
  if (!ADMIN_STATUSES.includes(status as AdminStatus)) throw new HttpError(422, 'invalid_status')
  // אפשר לנהל רק הזמנות ששולמו (או שמחכות לבדיקת תשלום)
  if (!order.paid_at && order.status !== 'payment_review') throw new HttpError(409, 'not_paid')
  if (status === 'shipped' && order.delivery_method !== 'shipping') throw new HttpError(409, 'pickup_not_shipped')

  const now = new Date().toISOString()
  switch (status as AdminStatus) {
    case 'paid':
      // חזרה ל"מחכה לטיפול" (או אישור של תשלום שהיה בבדיקה)
      return { status, shipped_at: null, delivered_at: null, paid_at: order.paid_at ?? now }
    case 'shipped':
      return { status, shipped_at: order.shipped_at ?? now, delivered_at: null }
    case 'delivered':
      return { status, delivered_at: order.delivered_at ?? now }
    default:
      return { status }
  }
}

async function updateOrder(body: Record<string, unknown>) {
  const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : ''
  if (!id) throw new HttpError(400, 'invalid_id')

  const [order] = await db<OrderRow[]>(
    `orders?id=eq.${id}&select=id,status,delivery_method,paid_at,shipped_at,delivered_at`,
  )
  if (!order) throw new HttpError(404, 'order_not_found')

  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) Object.assign(patch, statusPatch(order, body.status))
  if (body.details !== undefined) Object.assign(patch, validateDetails(body.details, order.delivery_method))
  if (body.admin_notes !== undefined) {
    const notes =
      typeof body.admin_notes === 'string'
        ? body.admin_notes.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 2000)
        : ''
    patch.admin_notes = notes || null
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'nothing_to_update')

  const [row] = await db<unknown[]>(`orders?id=eq.${id}&select=${COLUMNS}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  return { order: row }
}

/* ---------------------------- Server ---------------------------- */

export async function handler(req: Request): Promise<Response> {
  const origin = (req.headers.get('origin') ?? '').replace(/\/$/, '')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)
  if (origin && !isAllowedOrigin(origin)) return json({ error: 'forbidden_origin' }, 403, cors)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400, cors)
  }

  try {
    if (body.action === 'login') return json(await login(body, clientIp(req)), 200, cors)

    await requireSession(body.token)
    if (body.action === 'list') return json(await listOrders(), 200, cors)
    if (body.action === 'update') return json(await updateOrder(body), 200, cors)
    return json({ error: 'unknown_action' }, 400, cors)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, details: e.details }, e.status, cors)
    // טבלה או עמודה חסרה: צריך להריץ שוב את schema.sql
    if (e instanceof DbError && /42P01|42703|PGRST20[0-9]/.test(e.message)) {
      console.error(e.message)
      return json({ error: 'setup_incomplete' }, 503, cors)
    }
    console.error(e)
    return json({ error: 'server_error' }, 500, cors)
  }
}

Deno.serve(handler)
