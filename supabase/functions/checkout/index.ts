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
 *   BOOK_PRICE       (לא חובה, ברירת מחדל 55 — מחיר עותק)
 *   SHIPPING_PRICE   (לא חובה, ברירת מחדל 30 — משלוח להזמנה; איסוף עצמי חינם)
 *
 * מיילים אחרי תשלום (לא חובה — בלי אלה פשוט לא נשלחים מיילים):
 *   SMTP_USER        כתובת ה-Gmail שממנה נשלחים המיילים
 *   SMTP_PASS        סיסמת אפליקציה (App Password) של אותו Gmail
 *   NOTIFY_EMAILS    כתובות שמקבלות התראה על כל הזמנה, מופרדות בפסיק
 *   MAIL_FROM_NAME   (לא חובה) שם השולח, ברירת מחדל: בין חלון לרחוב
 *   SMTP_HOST / SMTP_PORT  (לא חובה) ברירת מחדל smtp.gmail.com / 465
 *
 * SUPABASE_URL והמפתח הסודי מוזרקים אוטומטית.
 */

import nodemailer from 'npm:nodemailer@6.9.16'

const BOOK_TITLE = 'בין חלון לרחוב'
const MAX_QUANTITY = 5
const CURRENCY = 'ILS'

const env = (name: string) => Deno.env.get(name)?.trim() ?? ''

const BOOK_PRICE = Number(env('BOOK_PRICE') || '55')
const SHIPPING_PRICE = Number(env('SHIPPING_PRICE') || '30')
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
  const shipping = input.delivery_method === 'shipping'
  const itemsTotal = Math.round(BOOK_PRICE * input.quantity * 100) / 100
  const shippingFee = shipping ? SHIPPING_PRICE : 0
  const total = Math.round((itemsTotal + shippingFee) * 100) / 100

  const [row] = await db<OrderRow[]>('orders', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      ...input,
      status: 'pending',
      unit_price: BOOK_PRICE,
      shipping_fee: shippingFee,
      total,
      currency: CURRENCY,
      terms_accepted_at: new Date().toISOString(),
    },
  })

  const unit: Record<string, unknown> = {
    reference_id: row.id,
    custom_id: row.id,
    invoice_id: `BHL-${row.order_number}`,
    description: `הזמנה ${row.order_number} — ${BOOK_TITLE} — ${shipping ? 'משלוח עד הבית' : 'איסוף עצמי מרמת גן'}`,
    amount: {
      currency_code: CURRENCY,
      value: money(total),
      breakdown: {
        item_total: { currency_code: CURRENCY, value: money(itemsTotal) },
        shipping: { currency_code: CURRENCY, value: money(shippingFee) },
      },
    },
    items: [
      {
        // מספר ההזמנה בשם הפריט: PayPal מציגים אותו ללקוח בעמוד התשלום ובמייל האישור
        name: `${BOOK_TITLE} — עותק מודפס (הזמנה ${row.order_number})`,
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
    `orders?paypal_order_id=eq.${encodeURIComponent(orderID)}&select=*`,
  )
  const order = rows[0]
  if (!order) throw new HttpError(404, 'order_not_found')
  // כבר טופלה (למשל לחיצה כפולה): מחזירים את המצב הקיים בלי לגבות שוב
  if (['paid', 'shipped', 'delivered', 'payment_review'].includes(order.status)) {
    return { ok: true, orderNumber: order.order_number, status: order.status }
  }
  if (order.status === 'cancelled' || order.status === 'refunded') throw new HttpError(409, 'order_closed')

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
    await queueEmails(order, 'paid')
    return { ok: true, orderNumber: order.order_number, status: 'paid' }
  }

  // התשלום עבר אבל משהו חריג (סכום שונה, או תשלום בבדיקה אצל PayPal) — מסמנים לבדיקה ידנית
  if (capture?.status === 'COMPLETED' || capture?.status === 'PENDING') {
    await updateOrder(order.id, {
      ...common,
      status: 'payment_review',
      admin_notes: amountOk ? `PayPal capture ${capture.status}` : `Amount mismatch: ${JSON.stringify(capture?.amount)}`,
    })
    await queueEmails(order, 'review')
    return { ok: true, orderNumber: order.order_number, status: 'payment_review' }
  }

  await updateOrder(order.id, { ...common, status: 'failed', admin_notes: `PayPal status ${data?.status}` })
  throw new HttpError(502, 'payment_not_completed')
}

/* ---------------------------- Emails ---------------------------- */
/*  אחרי תשלום: מייל תודה ללקוח + התראה לבעלי האתר.
    נשלח ברקע — אם השליחה נכשלת, ההזמנה עדיין נשמרת והלקוח רואה את עמוד התודה.
    התוצאה נרשמת בטבלה: customer_email_sent_at / notify_email_sent_at / email_error. */

function mailConfig() {
  const user = env('SMTP_USER')
  const pass = env('SMTP_PASS').replace(/\s+/g, '') // Gmail מציג את סיסמת האפליקציה עם רווחים
  if (!user || !pass) return null
  const port = Number(env('SMTP_PORT') || '465')
  return {
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port,
    secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === '1' : port === 465,
    user,
    pass,
    fromName: env('MAIL_FROM_NAME') || BOOK_TITLE,
    replyTo: env('REPLY_TO') || user,
    notify: env('NOTIFY_EMAILS')
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
  }
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const ils = (n: number | string | null) => {
  const v = Number(n ?? 0)
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ₪`
}

function orderFacts(o: OrderRow) {
  const shipping = o.delivery_method === 'shipping'
  const fee = Number(o.shipping_fee ?? 0)
  const address = shipping
    ? [`${o.street ?? ''} ${o.house_number ?? ''}`.trim(), o.apartment ? `דירה ${o.apartment}` : '', o.city, o.zip]
        .filter(Boolean)
        .join(', ')
    : ''
  return {
    shipping,
    books: `${BOOK_TITLE}, עותק מודפס × ${o.quantity}`,
    booksAmount: ils(Number(o.unit_price) * o.quantity),
    delivery: shipping ? 'משלוח עד הבית' : 'איסוף עצמי',
    deliveryAmount: fee ? ils(fee) : 'חינם',
    total: ils(o.total),
    address,
  }
}

const row = (label: string, value: string, bold = false) =>
  `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;${bold ? 'font-weight:bold;font-size:18px;' : ''}">${label}</td>` +
  `<td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;${bold ? 'font-weight:bold;font-size:18px;' : ''}">${value}</td></tr>`

function layout(title: string, inner: string) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#eef4f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#b5402a;color:#ffffff;padding:22px 28px;text-align:right">
<div style="font-size:14px;opacity:0.85">${esc(BOOK_TITLE)} / ד״ר שמואל בק</div>
<div style="font-size:26px;font-weight:bold;margin-top:6px">${esc(title)}</div></td></tr>
<tr><td style="padding:24px 28px;text-align:right;font-size:16px;line-height:1.6">${inner}</td></tr>
</table></td></tr></table></body></html>`
}

function customerEmail(o: OrderRow) {
  const f = orderFacts(o)
  const subject = `תודה על ההזמנה! מספר הזמנה ${o.order_number} — ${BOOK_TITLE}`
  const html = layout(
    'תודה על ההזמנה!',
    `<p style="margin:0 0 12px">שלום ${esc(o.full_name)},</p>
<p style="margin:0 0 16px">קיבלנו את ההזמנה שלך לספר ״${esc(BOOK_TITLE)}״ מאת ד״ר שמואל בק, והתשלום עבר בהצלחה.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:0 0 20px;text-align:center">
<div style="font-size:13px;color:#475569">מספר הזמנה</div>
<div style="font-size:32px;font-weight:bold;letter-spacing:1px">${o.order_number}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px">
${row(esc(f.books), f.booksAmount)}${row(f.delivery, f.deliveryAmount)}${row('סה״כ שולם', f.total, true)}
</table>
<p style="margin:20px 0 0">${
      f.shipping
        ? `<strong>כתובת למשלוח:</strong> ${esc(f.address)}`
        : '<strong>איסוף עצמי:</strong> ניצור איתך קשר לתיאום מקום ושעה.'
    }</p>
<p style="margin:20px 0 0">יש שאלה? אפשר פשוט להשיב למייל הזה.</p>
<p style="margin:16px 0 0">תודה ומקווים שתיהנו מהקריאה!</p>`,
  )
  const text = [
    `שלום ${o.full_name},`,
    `קיבלנו את ההזמנה שלך לספר "${BOOK_TITLE}" מאת ד״ר שמואל בק, והתשלום עבר בהצלחה.`,
    '',
    `מספר הזמנה: ${o.order_number}`,
    `${f.books}: ${f.booksAmount}`,
    `${f.delivery}: ${f.deliveryAmount}`,
    `סה״כ שולם: ${f.total}`,
    f.shipping ? `כתובת למשלוח: ${f.address}` : 'איסוף עצמי: ניצור איתך קשר לתיאום מקום ושעה.',
    '',
    'יש שאלה? אפשר פשוט להשיב למייל הזה.',
  ].join('\n')
  return { subject, html, text }
}

function ownerEmail(o: OrderRow, kind: 'paid' | 'review') {
  const f = orderFacts(o)
  const flag = kind === 'review' ? ' — לבדיקה ב-PayPal' : ''
  const subject = `הזמנה חדשה ${o.order_number}: ${o.quantity} ${o.quantity === 1 ? 'עותק' : 'עותקים'}, ${f.delivery}, ${f.total}${flag}`
  const details: [string, string][] = [
    ['מספר הזמנה', String(o.order_number)],
    ['שם', esc(o.full_name)],
    ['טלפון', `<a href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}">${esc(o.phone)}</a>`],
    ['אימייל', `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`],
    ['כמות', String(o.quantity)],
    ['אופן מסירה', f.delivery],
    ...(f.shipping ? ([['כתובת', esc(f.address)]] as [string, string][]) : []),
    ...(o.delivery_notes ? ([['הערות', esc(o.delivery_notes)]] as [string, string][]) : []),
    ['ספרים', f.booksAmount],
    ['משלוח', f.deliveryAmount],
    ['סה״כ שולם', f.total],
  ]
  const html = layout(
    `הזמנה חדשה ${o.order_number}`,
    `${
      kind === 'review'
        ? '<p style="margin:0 0 16px;padding:12px;background:#fef3c7;border-radius:8px"><strong>שימו לב:</strong> התשלום התקבל אבל מסומן לבדיקה (סכום חריג או תשלום בהמתנה אצל PayPal). כדאי לבדוק את העסקה ב-PayPal לפני שליחה.</p>'
        : ''
    }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px">
${details.map(([k, v], i) => row(k, v, i === details.length - 1)).join('')}
</table>
<p style="margin:20px 0 0;font-size:14px;color:#475569">כל ההזמנות בעמוד הניהול של האתר (בכתובת האתר, ‎/admin). אפשר להשיב למייל הזה כדי לכתוב ישירות ללקוח.</p>`,
  )
  const text = [
    `הזמנה חדשה ${o.order_number}${flag}`,
    `שם: ${o.full_name}`,
    `טלפון: ${o.phone}`,
    `אימייל: ${o.email}`,
    `כמות: ${o.quantity}`,
    `אופן מסירה: ${f.delivery}`,
    f.shipping ? `כתובת: ${f.address}` : '',
    o.delivery_notes ? `הערות: ${o.delivery_notes}` : '',
    `סה״כ שולם: ${f.total}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

async function sendOrderEmails(o: OrderRow, kind: 'paid' | 'review') {
  const cfg = mailConfig()
  if (!cfg) {
    console.warn('SMTP_USER / SMTP_PASS not set — order emails skipped')
    return
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    ...(env('SMTP_INSECURE') === '1' ? { tls: { rejectUnauthorized: false } } : {}),
  })
  const from = { name: cfg.fromName, address: cfg.user }
  const now = () => new Date().toISOString()
  const patch: Record<string, unknown> = {}
  const errors: string[] = []

  if (kind === 'paid') {
    try {
      await transporter.sendMail({ from, to: o.email, replyTo: cfg.replyTo, ...customerEmail(o) })
      patch.customer_email_sent_at = now()
    } catch (e) {
      errors.push(`customer: ${(e as Error).message}`)
    }
  }

  if (cfg.notify.length) {
    try {
      await transporter.sendMail({ from, to: cfg.notify, replyTo: o.email, ...ownerEmail(o, kind) })
      patch.notify_email_sent_at = now()
    } catch (e) {
      errors.push(`notify: ${(e as Error).message}`)
    }
  }

  transporter.close()
  if (errors.length) {
    console.error('Order email errors', errors)
    patch.email_error = errors.join(' | ').slice(0, 500)
  }
  try {
    if (Object.keys(patch).length) await updateOrder(o.id, patch)
  } catch (e) {
    console.error('Could not record email status (run schema.sql again?)', e)
  }
}

/** שולח ברקע אם אפשר (EdgeRuntime.waitUntil), כדי שהלקוח לא יחכה למיילים */
function queueEmails(o: OrderRow, kind: 'paid' | 'review'): Promise<void> | undefined {
  const task = sendOrderEmails(o, kind).catch((e) => console.error('Order emails failed', e))
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(task)
    return undefined
  }
  return task
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
