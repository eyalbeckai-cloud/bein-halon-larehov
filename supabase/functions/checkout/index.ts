/**
 * Edge Function: checkout
 * ------------------------------------------------------------
 * השרת היחיד של האתר. רץ ב-Supabase (חינם בהיקף הזה).
 *
 *   action: "create"  — שומר את פרטי המזמין (pending) ופותח הזמנה ב-PayPal
 *   action: "capture" — גובה את התשלום ב-PayPal, בודק סכום, ומסמן "paid"
 *
 * המחיר נקבע כאן בשרת — לא סומכים על מה שהדפדפן שולח.
 *
 * Secrets שצריך להגדיר (Supabase > Edge Functions > Secrets):
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV (live | sandbox),
 *   ALLOWED_ORIGINS  (למשל https://eyalbeckai-cloud.github.io)
 *   BOOK_PRICE       (לא חובה, ברירת מחדל 84)
 * SUPABASE_URL והמפתח הסודי מוזרקים אוטומטית.
 */

const BOOK_TITLE = 'בין חלון לרחוב'
const MAX_QUANTITY = 5
const CURRENCY = 'ILS'

const env = (name: string) => Deno.env.get(name)?.trim() ?? ''

const BOOK_PRICE = Number(env('BOOK_PRICE') || '84')
const PAYPAL_API = env('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
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
  // פיתוח מקומי
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
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/* --------------------------- Database --------------------------- */

function serviceKey(): string {
  // מפתחות חדשים (sb_secret_...) או המפתח הישן service_role
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
  if (!res.ok) throw new Error(`Database ${res.status}: ${await res.text()}`)
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

type OrderRow = {
  id: string
  order_number: number
  status: string
  delivery_method: 'shipping' | 'pickup'
  quantity: number
  total: number | string
  paypal_order_id: string | null
}

const updateOrder = (id: string, patch: Record<string, unknown>) =>
  db(`orders?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' })

/* ---------------------------- PayPal ---------------------------- */

async function paypalToken(): Promise<string> {
  const id = env('PAYPAL_CLIENT_ID')
  const secret = env('PAYPAL_CLIENT_SECRET')
  if (!id || !secret) throw new Error('Missing PayPal credentials')
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal auth ${res.status}: ${await res.text()}`)
  return (await res.json()).access_token
}

async function paypal(path: string, method: string, token: string, body?: unknown, requestId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  if (requestId) headers['PayPal-Request-Id'] = requestId
  const res = await fetch(`${PAYPAL_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const money = (n: number) => n.toFixed(2)
const firstIssue = (data: any): string => data?.details?.[0]?.issue ?? data?.name ?? 'UNKNOWN'

/* -------------------------- Validation -------------------------- */

type OrderInput = {
  delivery_method: 'shipping' | 'pickup'
  quantity: number
  full_name: string
  phone: string
  email: string
  city: string | null
  street: string | null
  house_number: string | null
  apartment: string | null
  zip: string | null
  delivery_notes: string | null
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

export function validateOrder(body: Record<string, unknown>): OrderInput {
  const errors: Record<string, string> = {}

  // שדה מלכודת לבוטים — אנשים לא רואים אותו
  if (clean(body.company, 100)) throw new HttpError(400, 'rejected')

  const delivery_method = body.delivery_method === 'pickup' ? 'pickup' : 'shipping'
  if (body.delivery_method !== 'pickup' && body.delivery_method !== 'shipping') errors.delivery_method = 'required'

  const quantity = Number(body.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) errors.quantity = 'invalid'

  const full_name = clean(body.full_name, 80)
  if (full_name.length < 2) errors.full_name = 'required'

  const phone = clean(body.phone, 20)
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 13 || !/^[\d\s+()-]+$/.test(phone)) errors.phone = 'invalid'

  const email = clean(body.email, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'invalid'

  const shipping = delivery_method === 'shipping'
  const city = clean(body.city, 60)
  const street = clean(body.street, 80)
  const house_number = clean(body.house_number, 10)
  const apartment = clean(body.apartment, 10)
  const zip = clean(body.zip, 10)
  const delivery_notes = clean(body.delivery_notes, 300)
  if (shipping) {
    if (city.length < 2) errors.city = 'required'
    if (street.length < 2) errors.street = 'required'
    if (!house_number) errors.house_number = 'required'
    if (zip && !/^\d{5,7}$/.test(zip)) errors.zip = 'invalid'
  }

  if (body.terms_accepted !== true) errors.terms_accepted = 'required'

  if (Object.keys(errors).length) throw new HttpError(422, 'validation', errors)

  return {
    delivery_method,
    quantity,
    full_name,
    phone,
    email,
    city: shipping ? city : null,
    street: shipping ? street : null,
    house_number: shipping ? house_number : null,
    apartment: shipping && apartment ? apartment : null,
    zip: shipping && zip ? zip : null,
    delivery_notes: delivery_notes || null,
  }
}

/* ---------------------------- Actions ---------------------------- */

async function createOrder(body: Record<string, unknown>) {
  const input = validateOrder(body)
  const total = Math.round(BOOK_PRICE * input.quantity * 100) / 100

  const [row] = await db<OrderRow[]>('orders', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      ...input,
      status: 'pending',
      unit_price: BOOK_PRICE,
      total,
      currency: CURRENCY,
      terms_accepted_at: new Date().toISOString(),
    },
  })

  const shipping = input.delivery_method === 'shipping'
  const unit: Record<string, unknown> = {
    reference_id: row.id,
    custom_id: row.id,
    invoice_id: `BHL-${row.order_number}`,
    description: `${BOOK_TITLE} — ${shipping ? 'משלוח עד הבית' : 'איסוף עצמי מרמת גן'}`,
    amount: {
      currency_code: CURRENCY,
      value: money(total),
      breakdown: {
        item_total: { currency_code: CURRENCY, value: money(total) },
        shipping: { currency_code: CURRENCY, value: '0.00' },
      },
    },
    items: [
      {
        name: `${BOOK_TITLE} — עותק מודפס`,
        quantity: String(input.quantity),
        unit_amount: { currency_code: CURRENCY, value: money(BOOK_PRICE) },
        category: 'PHYSICAL_GOODS',
      },
    ],
  }
  if (shipping) {
    unit.shipping = {
      name: { full_name: input.full_name },
      address: {
        address_line_1: `${input.street} ${input.house_number}`,
        ...(input.apartment ? { address_line_2: `דירה ${input.apartment}` } : {}),
        admin_area_2: input.city,
        ...(input.zip ? { postal_code: input.zip } : {}),
        country_code: 'IL',
      },
    }
  }

  const orderBody = (shippingPreference: string, withAddress: boolean) => ({
    intent: 'CAPTURE',
    purchase_units: [withAddress ? unit : { ...unit, shipping: undefined }],
    application_context: {
      brand_name: BOOK_TITLE,
      locale: 'he-IL',
      shipping_preference: shippingPreference,
      user_action: 'PAY_NOW',
    },
  })

  const token = await paypalToken()
  let res = await paypal(
    '/v2/checkout/orders',
    'POST',
    token,
    orderBody(shipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING', shipping),
    `create-${row.id}`,
  )

  // אם PayPal לא מקבלים את פורמט הכתובת — ממשיכים בלי להעביר אותה (היא שמורה אצלנו)
  if (!res.ok && shipping && JSON.stringify(res.data).includes('SHIPPING')) {
    console.warn('PayPal rejected shipping address, retrying without it', firstIssue(res.data))
    res = await paypal('/v2/checkout/orders', 'POST', token, orderBody('NO_SHIPPING', false), `create2-${row.id}`)
  }

  if (!res.ok || !res.data?.id) {
    console.error('PayPal create failed', res.status, JSON.stringify(res.data))
    await updateOrder(row.id, { status: 'failed', admin_notes: `PayPal create: ${firstIssue(res.data)}` })
    throw new HttpError(502, 'paypal_create_failed')
  }

  await updateOrder(row.id, { paypal_order_id: res.data.id })
  return { orderID: res.data.id as string, orderNumber: row.order_number }
}

async function captureOrder(body: Record<string, unknown>) {
  const orderID = typeof body.orderID === 'string' ? body.orderID : ''
  if (!/^[A-Z0-9-]{5,40}$/.test(orderID)) throw new HttpError(400, 'invalid_order_id')

  const rows = await db<OrderRow[]>(
    `orders?paypal_order_id=eq.${encodeURIComponent(orderID)}&select=id,order_number,status,delivery_method,quantity,total,paypal_order_id`,
  )
  const order = rows[0]
  if (!order) throw new HttpError(404, 'order_not_found')
  if (order.status === 'paid' || order.status === 'shipped') {
    return { ok: true, orderNumber: order.order_number, status: order.status }
  }

  const token = await paypalToken()
  let res = await paypal(`/v2/checkout/orders/${orderID}/capture`, 'POST', token, {}, `capture-${order.id}`)

  if (!res.ok) {
    const issue = firstIssue(res.data)
    if (issue === 'INSTRUMENT_DECLINED') throw new HttpError(402, 'instrument_declined')
    if (issue === 'ORDER_ALREADY_CAPTURED') {
      res = await paypal(`/v2/checkout/orders/${orderID}`, 'GET', token)
    } else {
      console.error('PayPal capture failed', res.status, JSON.stringify(res.data))
      throw new HttpError(502, 'paypal_capture_failed', issue)
    }
  }

  const data = res.data
  const pu = data?.purchase_units?.[0]
  const capture = pu?.payments?.captures?.[0]
  const payerName = [data?.payer?.name?.given_name, data?.payer?.name?.surname].filter(Boolean).join(' ')
  const common = {
    paypal_capture_id: capture?.id ?? null,
    paypal_payer_email: data?.payer?.email_address ?? null,
    paypal_payer_name: payerName || null,
    paypal_shipping: pu?.shipping ?? null,
  }

  const amountOk =
    capture?.amount?.currency_code === CURRENCY && Number(capture?.amount?.value) === Number(order.total)

  if (capture?.status === 'COMPLETED' && amountOk) {
    await updateOrder(order.id, { ...common, status: 'paid', paid_at: new Date().toISOString() })
    return { ok: true, orderNumber: order.order_number, status: 'paid' }
  }

  // התשלום עבר אבל משהו חריג (סכום שונה, או תשלום בבדיקה אצל PayPal) — מסמנים לבדיקה ידנית
  if (capture?.status === 'COMPLETED' || capture?.status === 'PENDING') {
    await updateOrder(order.id, {
      ...common,
      status: 'payment_review',
      admin_notes: amountOk ? `PayPal capture ${capture.status}` : `Amount mismatch: ${JSON.stringify(capture?.amount)}`,
    })
    return { ok: true, orderNumber: order.order_number, status: 'payment_review' }
  }

  await updateOrder(order.id, { ...common, status: 'failed', admin_notes: `PayPal status ${data?.status}` })
  throw new HttpError(502, 'payment_not_completed')
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
    if (body.action === 'create') return json(await createOrder(body), 200, cors)
    if (body.action === 'capture') return json(await captureOrder(body), 200, cors)
    return json({ error: 'unknown_action' }, 400, cors)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, details: e.details }, e.status, cors)
    console.error(e)
    return json({ error: 'server_error' }, 500, cors)
  }
}

Deno.serve(handler)
