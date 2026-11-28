import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { site } from '../config'
import {
  AdminError,
  addressLine,
  adminErrorMessage,
  adminList,
  adminLogin,
  adminUpdate,
  formatDate,
  formatMoney,
  isSessionError,
  isSold,
  ordersToCsv,
  session,
  statusLabel,
  telLink,
  whatsappLink,
  type AdminOrder,
  type AdminStatus,
  type OrderChange,
  type OrderDetails,
} from '../lib/admin'
// שדות הטופס והספינר משותפים לעמוד הרכישה
import '../styles/checkout.css'
import '../styles/admin.css'

/* =====================================================================
   עמוד ניהול הזמנות (/admin)
   לא מקושר מהאתר, לא נסרק במנועי חיפוש, ונכנסים אליו רק עם סיסמה.
   ===================================================================== */

export default function Admin() {
  const [token, setToken] = useState(() => session.get())
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const prevTitle = document.title
    document.title = `ניהול הזמנות | ${site.book.title}`
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => {
      document.title = prevTitle
      robots.remove()
    }
  }, [])

  const logout = useCallback((message?: string) => {
    session.clear()
    setToken(null)
    setNotice(message ?? null)
  }, [])

  if (!token) {
    return (
      <Login
        notice={notice}
        onLogin={(t) => {
          setNotice(null)
          setToken(t)
        }}
      />
    )
  }
  return <Dashboard token={token} onLogout={logout} />
}

/* ------------------------------ כניסה ------------------------------ */

function Login({ notice, onLogin }: { notice: string | null; onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cover = site.book.coverImage ? `${import.meta.env.BASE_URL}${site.book.coverImage}` : ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, expiresAt } = await adminLogin(password)
      session.set(token, expiresAt)
      onLogin(token)
    } catch (err) {
      setError(adminErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="admin admin--login" id="main">
      <form className="admin-login" onSubmit={submit} noValidate>
        {cover && <img className="admin-login__cover" src={cover} alt="" width={96} height={139} />}
        <div>
          <h1 className="admin-login__title">ניהול הזמנות</h1>
          <p className="admin-login__sub">{site.book.title}</p>
        </div>

        {notice && <p className="admin-msg admin-msg--info">{notice}</p>}

        <div className="field">
          <label className="field__label" htmlFor="admin-password">
            סיסמה
          </label>
          <div className="admin-login__pw">
            <input
              id="admin-password"
              className="field__input"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'admin-login-error' : undefined}
              autoFocus
            />
            <button type="button" className="admin-link" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? 'הסתרה' : 'הצגה'}
            </button>
          </div>
        </div>

        {error && (
          <p className="admin-msg admin-msg--error" id="admin-login-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary admin-login__submit" disabled={busy || !password}>
          {busy ? 'נכנסים…' : 'כניסה'}
        </button>
      </form>
    </main>
  )
}

/* ------------------------------ לוח ------------------------------ */

type TabId = 'todo' | 'transit' | 'done' | 'closed' | 'unpaid'

const TABS: { id: TabId; label: string; match: (o: AdminOrder) => boolean; empty: string; intro?: string }[] = [
  {
    id: 'todo',
    label: 'לטיפול',
    match: (o) => o.status === 'paid' || o.status === 'payment_review',
    empty: 'אין הזמנות שמחכות לטיפול. כשתגיע הזמנה חדשה, היא תופיע כאן.',
    intro: 'הזמנות ששולמו, מהישנה לחדשה. אחרי ששולחים או שהלקוח אוסף, מסמנים כאן.',
  },
  {
    id: 'transit',
    label: 'בדרך',
    match: (o) => o.status === 'shipped',
    empty: 'אין הזמנות שנשלחו ועוד לא הגיעו.',
    intro: 'הזמנות שנשלחו. כשהלקוח מאשר שקיבל, מסמנים שהגיעה.',
  },
  { id: 'done', label: 'הושלמו', match: (o) => o.status === 'delivered', empty: 'עדיין אין הזמנות שהושלמו.' },
  {
    id: 'closed',
    label: 'בוטלו',
    match: (o) => o.status === 'cancelled' || o.status === 'refunded',
    empty: 'אין הזמנות שבוטלו.',
  },
  {
    id: 'unpaid',
    label: 'לא שולמו',
    match: (o) => o.status === 'pending' || o.status === 'failed',
    empty: 'אין הזמנות שלא שולמו.',
    intro: 'אנשים שהתחילו להזמין ולא סיימו לשלם. לא חויבו, ולא צריך לשלוח להם כלום.',
  },
]

type Toast = { id: number; message: string; tone?: 'error'; undo?: () => Promise<void> }

type UpdateFn = (order: AdminOrder, change: OrderChange) => Promise<AdminOrder>
type StatusFn = (order: AdminOrder, status: AdminStatus, message: string) => Promise<void>

function Dashboard({ token, onLogout }: { token: string; onLogout: (message?: string) => void }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabId>('todo')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)

  const handleSession = useCallback(
    (e: unknown) => {
      if (isSessionError(e)) {
        onLogout('עבר זמן רב מהכניסה האחרונה. נא להיכנס שוב.')
        return true
      }
      return false
    },
    [onLogout],
  )

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const { orders } = await adminList(token)
      setOrders(orders)
      setLoadError(null)
    } catch (e) {
      if (!handleSession(e)) setLoadError(adminErrorMessage(e))
    } finally {
      setRefreshing(false)
    }
  }, [token, handleSession])

  useEffect(() => {
    load()
  }, [load])

  // חוזרים ללשונית (למשל אחרי שבדקו מייל) — מרעננים
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const showToast = useCallback((t: Omit<Toast, 'id'>) => setToast({ ...t, id: Date.now() }), [])

  const update: UpdateFn = useCallback(
    async (order, change) => {
      try {
        const { order: updated } = await adminUpdate(token, order.id, change)
        setOrders((list) => list?.map((o) => (o.id === updated.id ? updated : o)) ?? list)
        return updated
      } catch (e) {
        handleSession(e)
        throw e
      }
    },
    [token, handleSession],
  )

  const setStatus: StatusFn = useCallback(
    async (order, status, message) => {
      const previous = order.status
      const updated = await update(order, { status })
      const canUndo = ['paid', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(previous)
      showToast({
        message,
        undo: canUndo
          ? async () => {
              try {
                await update(updated, { status: previous as AdminStatus })
                showToast({ message: `הזמנה ${order.order_number} חזרה למצב הקודם.` })
              } catch (e) {
                showToast({ message: adminErrorMessage(e), tone: 'error' })
              }
            }
          : undefined,
      })
    },
    [update, showToast],
  )

  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<TabId, number>
    for (const o of orders ?? []) for (const t of TABS) if (t.match(o)) c[t.id]++
    return c
  }, [orders])

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!orders) return []
    if (q) {
      const digits = q.replace(/\D/g, '')
      return orders.filter(
        (o) =>
          o.full_name.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          (o.city ?? '').toLowerCase().includes(q) ||
          (digits.length >= 1 && String(o.order_number).includes(digits)) ||
          (digits.length >= 3 && o.phone.replace(/\D/g, '').includes(digits)),
      )
    }
    const current = TABS.find((t) => t.id === tab)!
    const list = orders.filter(current.match)
    // לטיפול: מי שמחכה הכי הרבה זמן — ראשון
    if (tab === 'todo') list.sort((a, b) => (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at))
    return list
  }, [orders, tab, q])

  const exportCsv = () => {
    const csv = ordersToCsv(visible)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    const name = q ? 'חיפוש' : TABS.find((t) => t.id === tab)!.label
    a.download = `הזמנות-${name}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const currentTab = TABS.find((t) => t.id === tab)!

  return (
    <main className="admin" id="main">
      <header className="admin-bar">
        <div className="admin-bar__brand">
          <p className="admin-bar__title">ניהול הזמנות</p>
          <Link to="/" className="admin-bar__site">
            {site.book.title}
          </Link>
        </div>
        <div className="admin-bar__actions">
          <button type="button" className="admin-btn" onClick={load} disabled={refreshing}>
            <Icon name="refresh" spinning={refreshing} />
            רענון
          </button>
          <button type="button" className="admin-btn" onClick={exportCsv} disabled={!visible.length}>
            <Icon name="download" />
            הורדה לאקסל
          </button>
          <button type="button" className="admin-btn" onClick={() => onLogout()}>
            יציאה
          </button>
        </div>
      </header>

      <div className="admin__body">
        {loadError && (
          <div className="admin-msg admin-msg--error admin__load-error" role="alert">
            <span>{loadError}</span>
            <button type="button" className="admin-link" onClick={load}>
              לנסות שוב
            </button>
          </div>
        )}

        {orders === null && !loadError && (
          <div className="admin__loading" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            טוען הזמנות…
          </div>
        )}

        {orders && (
          <>
            <Overview orders={orders} />

            <div className="admin-tools">
              <nav className="admin-tabs" aria-label="סינון הזמנות">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="admin-tabs__tab"
                    aria-pressed={!q && tab === t.id}
                    onClick={() => {
                      setTab(t.id)
                      setQuery('')
                    }}
                  >
                    {t.label}
                    <span className="admin-tabs__count">{counts[t.id]}</span>
                  </button>
                ))}
              </nav>
              <div className="admin-search">
                <label className="visually-hidden" htmlFor="admin-search">
                  חיפוש הזמנה
                </label>
                <Icon name="search" />
                <input
                  id="admin-search"
                  type="search"
                  className="admin-search__input"
                  placeholder="חיפוש: שם, טלפון או מספר"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <p className="admin__intro" aria-live="polite">
              {q
                ? visible.length
                  ? visible.length === 1
                    ? 'נמצאה הזמנה אחת.'
                    : `נמצאו ${visible.length} הזמנות.`
                  : 'לא נמצאו הזמנות שמתאימות לחיפוש.'
                : currentTab.intro}
            </p>

            {!q && !visible.length && <p className="admin__empty">{currentTab.empty}</p>}

            <ol className="admin-orders">
              {visible.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} update={update} setStatus={setStatus} />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {toast && <ToastBar key={toast.id} toast={toast} onClose={() => setToast(null)} />}
    </main>
  )
}

/* ------------------------------ סיכום ------------------------------ */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

function Overview({ orders }: { orders: AdminOrder[] }) {
  const waiting = (method: 'shipping' | 'pickup') =>
    orders.filter((o) => o.status === 'paid' && o.delivery_method === method).length
  const toShip = waiting('shipping')
  const toPickup = waiting('pickup')
  const review = orders.filter((o) => o.status === 'payment_review').length
  const sold = orders.filter(isSold)
  const books = sold.reduce((n, o) => n + o.quantity, 0)
  const revenue = sold.reduce((n, o) => n + Number(o.total), 0)

  return (
    <section className="admin-overview" aria-label="מצב ההזמנות">
      {toShip || toPickup ? (
        <ul className="admin-overview__todo">
          {toShip > 0 && <li>{plural(toShip, 'הזמנה אחת מחכה', 'הזמנות מחכות')} למשלוח</li>}
          {toPickup > 0 && <li>{plural(toPickup, 'הזמנה אחת מחכה', 'הזמנות מחכות')} לאיסוף עצמי</li>}
        </ul>
      ) : (
        <p className="admin-overview__todo admin-overview__todo--clear">אין הזמנות שמחכות לטיפול.</p>
      )}
      {review > 0 && (
        <p className="admin-msg admin-msg--warn">
          {plural(review, 'תשלום אחד מחכה', 'תשלומים מחכים')} לבדיקה ב-PayPal לפני שליחה.
        </p>
      )}
      <p className="admin-overview__totals">
        {sold.length
          ? `עד היום נמכרו ${plural(books, 'ספר אחד', 'ספרים')} ${sold.length === 1 ? 'בהזמנה אחת' : `ב-${sold.length} הזמנות`}, בסך ${formatMoney(revenue)}.`
          : 'עדיין אין מכירות.'}
      </p>
    </section>
  )
}

/* ------------------------------ הזמנה ------------------------------ */

type Panel = null | 'details' | 'notes' | 'more' | 'refund'

function primaryAction(o: AdminOrder): { label: string; status: AdminStatus; done: string } | null {
  const n = o.order_number
  if (o.status === 'paid' && o.delivery_method === 'shipping')
    return { label: 'סימון: נשלחה', status: 'shipped', done: `הזמנה ${n} סומנה כנשלחה.` }
  if (o.status === 'paid') return { label: 'סימון: נאספה', status: 'delivered', done: `הזמנה ${n} סומנה כנאספה.` }
  if (o.status === 'shipped')
    return { label: 'סימון: הגיעה ללקוח', status: 'delivered', done: `הזמנה ${n} סומנה כהגיעה ללקוח.` }
  if (o.status === 'payment_review')
    return { label: 'בדקתי ב-PayPal, התשלום תקין', status: 'paid', done: `התשלום של הזמנה ${n} אושר.` }
  return null
}

function stepBack(o: AdminOrder): { label: string; status: AdminStatus } | null {
  if (o.status === 'shipped') return { label: 'החזרה ל"מחכה למשלוח"', status: 'paid' }
  if (o.status === 'delivered' && o.delivery_method === 'shipping') return { label: 'החזרה ל"נשלחה"', status: 'shipped' }
  if (o.status === 'delivered') return { label: 'החזרה ל"מחכה לאיסוף"', status: 'paid' }
  if (o.status === 'refunded' || o.status === 'cancelled') return { label: 'שחזור ההזמנה', status: 'paid' }
  return null
}

function OrderCard({ order: o, update, setStatus }: { order: AdminOrder; update: UpdateFn; setStatus: StatusFn }) {
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shipping = o.delivery_method === 'shipping'
  const paid = o.status !== 'pending' && o.status !== 'failed'
  const closed = o.status === 'cancelled' || o.status === 'refunded'
  const primary = primaryAction(o)
  const back = stepBack(o)
  const address = addressLine(o)
  const wa = whatsappLink(o.phone)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      if (!isSessionError(e)) setError(adminErrorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status: AdminStatus, message: string) =>
    run(async () => {
      await setStatus(o, status, message)
      setPanel(null)
    })

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText([o.full_name, address, o.phone].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* הכתובת מוצגת על המסך */
    }
  }

  const timeline = [
    o.paid_at ? `שולמה ב-${formatDate(o.paid_at)}` : `הוזמנה ב-${formatDate(o.created_at)}`,
    o.shipped_at && `נשלחה ב-${formatDate(o.shipped_at, false)}`,
    o.delivered_at && `${shipping ? 'הגיעה' : 'נאספה'} ב-${formatDate(o.delivered_at, false)}`,
  ].filter(Boolean)

  return (
    <article className={`order-card order-card--${o.status}${paid ? '' : ' order-card--muted'}`} aria-busy={busy}>
      <div className="order-card__stub">
        <span className="order-card__stub-label">הזמנה</span>
        <span className="order-card__number">{o.order_number}</span>
        <span className="order-card__method">{shipping ? 'משלוח' : 'איסוף עצמי'}</span>
      </div>

      <div className="order-card__main">
        <header className="order-card__head">
          <h2 className="order-card__name">{o.full_name}</h2>
          <span className={`status-pill status-pill--${o.status}`}>{statusLabel(o)}</span>
        </header>

        <p className="order-card__what">
          {o.quantity === 1 ? 'עותק אחד' : `${o.quantity} עותקים`}, {formatMoney(o.total)}
          {Number(o.shipping_fee) > 0 && <span className="order-card__fee"> (כולל משלוח {formatMoney(o.shipping_fee)})</span>}
        </p>

        {shipping && (
          <div className="order-card__address">
            <p>{address}</p>
            <button type="button" className="admin-link" onClick={copyAddress}>
              <Icon name="copy" />
              {copied ? 'הועתק' : 'העתקת שם וכתובת'}
            </button>
          </div>
        )}

        <ul className="order-card__contact">
          <li>
            <a href={telLink(o.phone)} className="contact-link">
              <Icon name="phone" />
              <span dir="ltr">{o.phone}</span>
            </a>
          </li>
          {wa && (
            <li>
              <a href={wa} className="contact-link" target="_blank" rel="noreferrer">
                <Icon name="chat" />
                וואטסאפ
              </a>
            </li>
          )}
          <li>
            <a href={`mailto:${o.email}`} className="contact-link">
              <Icon name="mail" />
              <span dir="ltr">{o.email}</span>
            </a>
          </li>
        </ul>

        {o.delivery_notes && (
          <p className="order-card__customer-note">
            <span className="order-card__note-label">הערת הלקוח:</span> {o.delivery_notes}
          </p>
        )}

        {o.status === 'payment_review' && (
          <p className="admin-msg admin-msg--warn">
            PayPal סימנו את התשלום לבדיקה. כדאי לוודא ב-PayPal שהכסף התקבל במלואו לפני ששולחים.
            {o.paypal_capture_id && (
              <>
                {' '}
                <a href={`https://www.paypal.com/activity/payment/${o.paypal_capture_id}`} target="_blank" rel="noreferrer">
                  פתיחת העסקה ב-PayPal
                </a>
              </>
            )}
          </p>
        )}

        {paid && o.email_error && !o.customer_email_sent_at && (
          <p className="admin-msg admin-msg--warn">מייל האישור לא נשלח ללקוח. כדאי ליצור איתו קשר.</p>
        )}

        <p className="order-card__meta">{timeline.join(', ')}.</p>

        {o.admin_notes && panel !== 'notes' && (
          <div className="order-card__admin-note">
            <span className="order-card__note-label">הערה פנימית:</span>
            <p>{o.admin_notes}</p>
          </div>
        )}

        {error && (
          <p className="admin-msg admin-msg--error" role="alert">
            {error}
          </p>
        )}

        {panel === 'details' && (
          <DetailsForm
            order={o}
            onCancel={() => setPanel(null)}
            onSave={async (details) => {
              await update(o, { details })
              setPanel(null)
            }}
          />
        )}

        {panel === 'notes' && (
          <NotesForm
            order={o}
            onCancel={() => setPanel(null)}
            onSave={async (admin_notes) => {
              await update(o, { admin_notes })
              setPanel(null)
            }}
          />
        )}

        {panel === 'refund' && (
          <div className="order-card__confirm" role="group" aria-label="אישור ביטול">
            <p>
              את החזר הכסף עצמו עושים ב-PayPal (בעסקה, <strong>Refund</strong>). כאן רק מסמנים שההזמנה בוטלה. לסמן?
            </p>
            <div className="order-card__actions">
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                disabled={busy}
                onClick={() => changeStatus('refunded', `הזמנה ${o.order_number} סומנה כמבוטלת.`)}
              >
                כן, לסמן כמבוטלת
              </button>
              <button type="button" className="admin-btn" onClick={() => setPanel('more')}>
                לא
              </button>
            </div>
          </div>
        )}

        {panel === 'more' && (
          <div className="order-card__more">
            {paid && (
              <button type="button" className="admin-btn" onClick={() => setPanel('details')}>
                עריכת פרטי הלקוח
              </button>
            )}
            {back && (
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => changeStatus(back.status, `הזמנה ${o.order_number} עודכנה.`)}
              >
                {back.label}
              </button>
            )}
            {paid && !closed && (
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => setPanel('refund')}>
                ביטול הזמנה והחזר כספי
              </button>
            )}
            {(o.paypal_capture_id || o.paypal_payer_email) && (
              <p className="order-card__paypal">
                {o.paypal_capture_id && (
                  <>
                    מזהה עסקה ב-PayPal: <span dir="ltr">{o.paypal_capture_id}</span>{' '}
                    <a href={`https://www.paypal.com/activity/payment/${o.paypal_capture_id}`} target="_blank" rel="noreferrer">
                      פתיחה ב-PayPal
                    </a>
                    <br />
                  </>
                )}
                {o.paypal_payer_email && (
                  <>
                    שילם/ה דרך PayPal: {o.paypal_payer_name ? `${o.paypal_payer_name}, ` : ''}
                    <span dir="ltr">{o.paypal_payer_email}</span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {panel !== 'details' && panel !== 'notes' && panel !== 'refund' && (
          <div className="order-card__actions">
            {primary && (
              <button
                type="button"
                className="btn btn--primary order-card__primary"
                disabled={busy}
                onClick={() => changeStatus(primary.status, primary.done)}
              >
                {busy ? 'שומר…' : primary.label}
              </button>
            )}
            <button type="button" className="admin-btn" onClick={() => setPanel('notes')}>
              {o.admin_notes ? 'עריכת הערה' : 'הוספת הערה'}
            </button>
            {(paid || o.paypal_capture_id) && (
              <button
                type="button"
                className="admin-btn"
                aria-expanded={panel === 'more'}
                onClick={() => setPanel(panel === 'more' ? null : 'more')}
              >
                {panel === 'more' ? 'פחות' : 'עוד פעולות'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/* --------------------------- עריכת פרטים --------------------------- */

const fieldMessages: Record<string, string> = {
  full_name: 'נא למלא שם מלא',
  phone: 'מספר טלפון לא תקין',
  email: 'כתובת אימייל לא תקינה',
  city: 'נא למלא עיר',
  street: 'נא למלא רחוב',
  house_number: 'נא למלא מספר בית',
  zip: 'מיקוד: 5 או 7 ספרות',
}

function DetailsForm({
  order,
  onSave,
  onCancel,
}: {
  order: AdminOrder
  onSave: (d: OrderDetails) => Promise<void>
  onCancel: () => void
}) {
  const shipping = order.delivery_method === 'shipping'
  const [form, setForm] = useState<OrderDetails>({
    full_name: order.full_name,
    phone: order.phone,
    email: order.email,
    city: order.city ?? '',
    street: order.street ?? '',
    house_number: order.house_number ?? '',
    apartment: order.apartment ?? '',
    zip: order.zip ?? '',
    delivery_notes: order.delivery_notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof OrderDetails) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await onSave(form)
    } catch (err) {
      if (err instanceof AdminError && err.code === 'validation' && err.details) {
        setErrors(Object.fromEntries(Object.keys(err.details).map((k) => [k, fieldMessages[k] ?? 'ערך לא תקין'])))
      }
      if (!isSessionError(err)) setError(adminErrorMessage(err))
      setBusy(false)
    }
  }

  const field = (k: keyof OrderDetails, label: string, opts: { ltr?: boolean; type?: string; optional?: boolean } = {}) => (
    <div className={`field${errors[k] ? ' has-error' : ''}`}>
      <label className="field__label" htmlFor={`${order.id}-${k}`}>
        {label} {opts.optional && <span className="field__opt">(לא חובה)</span>}
      </label>
      <input
        id={`${order.id}-${k}`}
        className="field__input"
        type={opts.type ?? 'text'}
        dir={opts.ltr ? 'ltr' : undefined}
        value={form[k] ?? ''}
        onChange={set(k)}
        aria-invalid={errors[k] ? true : undefined}
      />
      {errors[k] && <span className="field__error">{errors[k]}</span>}
    </div>
  )

  return (
    <form className="order-card__form" onSubmit={submit} noValidate>
      <p className="order-card__form-title">עריכת פרטי הלקוח</p>
      {field('full_name', 'שם מלא')}
      <div className="fields__row">
        {field('phone', 'טלפון', { ltr: true, type: 'tel' })}
        {field('email', 'אימייל', { ltr: true, type: 'email' })}
      </div>
      {shipping && (
        <>
          {field('city', 'עיר')}
          <div className="fields__row fields__row--street">
            {field('street', 'רחוב')}
            {field('house_number', 'מספר בית')}
          </div>
          <div className="fields__row">
            {field('apartment', 'דירה', { optional: true })}
            {field('zip', 'מיקוד', { optional: true, ltr: true })}
          </div>
        </>
      )}
      <div className="field">
        <label className="field__label" htmlFor={`${order.id}-delivery_notes`}>
          הערת הלקוח <span className="field__opt">(לא חובה)</span>
        </label>
        <textarea
          id={`${order.id}-delivery_notes`}
          className="field__input admin-textarea"
          rows={2}
          maxLength={300}
          value={form.delivery_notes ?? ''}
          onChange={set('delivery_notes')}
        />
      </div>
      {error && (
        <p className="admin-msg admin-msg--error" role="alert">
          {error}
        </p>
      )}
      <div className="order-card__actions">
        <button type="submit" className="btn btn--ink btn--small" disabled={busy}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          ביטול
        </button>
      </div>
    </form>
  )
}

/* ---------------------------- הערה פנימית ---------------------------- */

function NotesForm({
  order,
  onSave,
  onCancel,
}: {
  order: AdminOrder
  onSave: (notes: string) => Promise<void>
  onCancel: () => void
}) {
  const [notes, setNotes] = useState(order.admin_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(notes)
    } catch (err) {
      if (!isSessionError(err)) setError(adminErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="order-card__form" onSubmit={submit}>
      <div className="field">
        <label className="field__label" htmlFor={`${order.id}-notes`}>
          הערה פנימית <span className="field__opt">(רק אתם רואים אותה, למשל מספר מעקב של הדואר)</span>
        </label>
        <textarea
          id={`${order.id}-notes`}
          className="field__input admin-textarea"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoFocus
        />
      </div>
      {error && (
        <p className="admin-msg admin-msg--error" role="alert">
          {error}
        </p>
      )}
      <div className="order-card__actions">
        <button type="submit" className="btn btn--ink btn--small" disabled={busy}>
          {busy ? 'שומר…' : 'שמירת ההערה'}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          ביטול
        </button>
      </div>
    </form>
  )
}

/* ------------------------------ הודעה ------------------------------ */

function ToastBar({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [undoing, setUndoing] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => {
    timer.current = window.setTimeout(onClose, toast.undo ? 9000 : 5000)
    return () => window.clearTimeout(timer.current)
  }, [toast, onClose])

  return (
    <div className={`admin-toast${toast.tone === 'error' ? ' admin-toast--error' : ''}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          className="admin-toast__undo"
          disabled={undoing}
          onClick={async () => {
            window.clearTimeout(timer.current)
            setUndoing(true)
            await toast.undo!()
          }}
        >
          {undoing ? 'מבטל…' : 'ביטול'}
        </button>
      )}
      <button type="button" className="admin-toast__close" onClick={onClose} aria-label="סגירת ההודעה">
        <Icon name="close" />
      </button>
    </div>
  )
}

/* ------------------------------ אייקונים ------------------------------ */

const paths: Record<string, ReactNode> = {
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
      <path d="M20 21v-5h-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  phone: (
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z" />
  ),
  chat: <path d="M4 19.5 5.3 16A8 8 0 1 1 8.4 19L4 19.5Z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
}

function Icon({ name, spinning }: { name: keyof typeof paths; spinning?: boolean }) {
  return (
    <svg
      className={`admin-icon${spinning ? ' admin-icon--spin' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
