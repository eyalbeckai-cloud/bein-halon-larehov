import { useRef, useState, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router'
import Book from '../components/Book'
import PayPalButtons from '../components/PayPalButtons'
import { site, formatPrice } from '../config'
import Price, { onSale } from '../components/Price'
import {
  ApiError,
  captureOrder,
  createOrder,
  emptyForm,
  errorMessage,
  serverFieldErrors,
  validate,
  type FieldErrors,
  type OrderForm,
} from '../lib/order'
import '../styles/checkout.css'

export default function Checkout() {
  const { book, delivery } = site
  const navigate = useNavigate()
  const [form, setForm] = useState<OrderForm>(emptyForm)
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // PayPal קורא לפונקציות האלה מחוץ למחזור של React — לכן ref עם הערכים העדכניים
  const formRef = useRef(form)
  formRef.current = form

  const clientErrors = validate(form)
  const errors: FieldErrors = showErrors ? { ...clientErrors, ...serverErrors } : serverErrors
  const shipping = form.delivery_method === 'shipping'
  const booksTotal = book.price * form.quantity
  const deliveryFee = shipping ? delivery.shipping.price : delivery.pickup.price
  const total = booksTotal + deliveryFee
  const configured = Boolean(site.paypal.clientId && site.supabaseUrl)

  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (serverErrors[key]) setServerErrors(({ [key]: _, ...rest }) => rest)
  }

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs)[0]
    if (!first) return
    const el = document.getElementById(`f-${first}`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <div className="page checkout">
      <div className="checkout__grid">
        <aside className="checkout__book" aria-label="הספר">
          <div className="checkout__arch">
            <Book className="book--checkout" />
          </div>
          <p className="checkout__book-title">{book.title}</p>
          <p className="checkout__book-author">{book.author}</p>
          <p className="checkout__book-price">
            <Price />
            {onSale() && <span className="checkout__sale">במבצע כרגע</span>}
          </p>
        </aside>

        <form
          className="checkout__order"
          aria-labelledby="checkout-title"
          noValidate
          onSubmit={(e) => e.preventDefault()}
        >
          <h1 id="checkout-title" className="checkout__title">
            רכישת הספר
          </h1>

          {/* איך לקבל */}
          {delivery.pickup.enabled ? (
            <fieldset className="delivery">
              <legend className="checkout__legend">איך לקבל את הספר?</legend>
              {(['shipping', 'pickup'] as const).map((m) => (
                <label key={m} className={`delivery__option${form.delivery_method === m ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="delivery"
                    value={m}
                    checked={form.delivery_method === m}
                    onChange={() => set('delivery_method', m)}
                  />
                  <span className="delivery__text">
                    <span className="delivery__label">{delivery[m].label}</span>
                    <span className="delivery__note">{delivery[m].note}</span>
                  </span>
                  <span className={`delivery__price${delivery[m].price ? '' : ' is-free'}`}>{priceOrFree(delivery[m].price)}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="delivery__single">
              {delivery.shipping.label}: {priceOrFree(delivery.shipping.price)}
            </p>
          )}

          {/* כמות */}
          <div className="qty">
            <span className="checkout__legend" id="qty-label">
              כמות
            </span>
            <div className="qty__control" role="group" aria-labelledby="qty-label">
              <button
                type="button"
                className="qty__btn"
                aria-label="עותק אחד פחות"
                disabled={form.quantity <= 1}
                onClick={() => set('quantity', form.quantity - 1)}
              >
                <MinusIcon />
              </button>
              <output className="qty__value" aria-live="polite">
                {form.quantity}
              </output>
              <button
                type="button"
                className="qty__btn"
                aria-label="עותק אחד יותר"
                disabled={form.quantity >= site.maxQuantity}
                onClick={() => set('quantity', form.quantity + 1)}
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          {/* פרטים */}
          <fieldset className="fields">
            <legend className="checkout__legend">פרטים ליצירת קשר</legend>
            <Field id="full_name" label="שם מלא" autoComplete="name" value={form.full_name} error={errors.full_name}
              onChange={(v) => set('full_name', v)} />
            <div className="fields__row">
              <Field id="phone" label="טלפון" type="tel" inputMode="tel" autoComplete="tel" dir="ltr"
                value={form.phone} error={errors.phone} onChange={(v) => set('phone', v)} />
              <Field id="email" label="אימייל" type="email" inputMode="email" autoComplete="email" dir="ltr"
                value={form.email} error={errors.email} onChange={(v) => set('email', v)} />
            </div>
          </fieldset>

          {shipping && (
            <fieldset className="fields">
              <legend className="checkout__legend">כתובת למשלוח</legend>
              <Field id="city" label="עיר" autoComplete="address-level2" value={form.city} error={errors.city}
                onChange={(v) => set('city', v)} />
              <div className="fields__row fields__row--street">
                <Field id="street" label="רחוב" autoComplete="address-line1" value={form.street} error={errors.street}
                  onChange={(v) => set('street', v)} />
                <Field id="house_number" label="מס׳ בית" inputMode="numeric" value={form.house_number}
                  error={errors.house_number} onChange={(v) => set('house_number', v)} />
              </div>
              <div className="fields__row">
                <Field id="apartment" label="דירה" optional autoComplete="address-line2" value={form.apartment}
                  onChange={(v) => set('apartment', v)} />
                <Field id="zip" label="מיקוד" optional inputMode="numeric" autoComplete="postal-code" dir="ltr"
                  value={form.zip} error={errors.zip} onChange={(v) => set('zip', v)} />
              </div>
              <Field id="delivery_notes" label="הערות לשליח" optional value={form.delivery_notes}
                onChange={(v) => set('delivery_notes', v)} />
            </fieldset>
          )}

          {/* מלכודת לבוטים — מוסתרת מאנשים ומקוראי מסך */}
          <div className="hp" aria-hidden="true">
            <label>
              Company
              <input tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </label>
          </div>

          {/* סיכום */}
          <dl className="summary">
            <div className="summary__row">
              <dt>
                {book.title}, עותק מודפס × {form.quantity}
              </dt>
              <dd>
                <Price amount={booksTotal} regular={book.regularPrice * form.quantity} />
              </dd>
            </div>
            <div className="summary__row">
              <dt>{shipping ? delivery.shipping.label : delivery.pickup.label}</dt>
              <dd>{priceOrFree(deliveryFee)}</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>סה״כ לתשלום</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {delivery.deliveryTime && shipping && <p className="checkout__eta">זמן אספקה: {delivery.deliveryTime}</p>}

          {/* הסכמה */}
          <div className={`consent${errors.terms_accepted ? ' has-error' : ''}`}>
            <label className="consent__label">
              <input
                id="f-terms_accepted"
                type="checkbox"
                checked={form.terms_accepted}
                aria-invalid={Boolean(errors.terms_accepted)}
                aria-describedby={errors.terms_accepted ? 'f-terms_accepted-error' : undefined}
                onChange={(e) => set('terms_accepted', e.target.checked)}
              />
              <span>
                קראתי ואני מאשר/ת את <Link to="/terms" target="_blank">
                  התקנון ומדיניות הביטולים<span className="visually-hidden"> (נפתח בלשונית חדשה)</span>
                </Link>{' '}
                ואת{' '}
                <Link to="/privacy" target="_blank">
                  מדיניות הפרטיות<span className="visually-hidden"> (נפתח בלשונית חדשה)</span>
                </Link>
                .
              </span>
            </label>
            {errors.terms_accepted && (
              <p id="f-terms_accepted-error" className="field__error">
                {errors.terms_accepted}
              </p>
            )}
          </div>

          {notice && (
            <p className={`checkout__notice checkout__notice--${notice.tone}`} role="alert">
              {notice.text}
            </p>
          )}

          {/* תשלום */}
          <div className="checkout__pay">
            {configured ? (
              <PayPalButtons
                onClickValidate={() => {
                  setNotice(null)
                  const errs = validate(formRef.current)
                  if (Object.keys(errs).length) {
                    setShowErrors(true)
                    focusFirstError(errs)
                    return false
                  }
                  return true
                }}
                createOrder={async () => {
                  try {
                    const { orderID } = await createOrder(formRef.current)
                    return orderID
                  } catch (err) {
                    const code = err instanceof ApiError ? err.code : 'unknown'
                    if (err instanceof ApiError && code === 'validation') {
                      const errs = serverFieldErrors(err.details)
                      setServerErrors(errs)
                      setShowErrors(true)
                      focusFirstError(errs)
                    }
                    setNotice({ tone: 'error', text: errorMessage(code) })
                    throw err
                  }
                }}
                approve={async (orderID) => {
                  setBusy(true)
                  try {
                    const result = await captureOrder(orderID)
                    navigate(`/thank-you?order=${result.orderNumber}${result.status === 'payment_review' ? '&review=1' : ''}`)
                    return 'done'
                  } catch (err) {
                    setBusy(false)
                    if (err instanceof ApiError && err.code === 'instrument_declined') {
                      setNotice({ tone: 'info', text: 'אמצעי התשלום נדחה. אפשר לנסות כרטיס אחר.' })
                      return 'retry'
                    }
                    setNotice({ tone: 'error', text: errorMessage(err instanceof ApiError ? err.code : 'unknown') })
                    return 'done'
                  }
                }}
                onCancel={() => setNotice({ tone: 'info', text: 'התשלום בוטל ולא חויבתם. אפשר לנסות שוב.' })}
                onError={() => {
                  setNotice((n) => n ?? { tone: 'error', text: errorMessage('unknown') })
                }}
              />
            ) : (
              <div className="paypal-placeholder" role="note">
                <strong>כאן יופיעו כפתורי התשלום (PayPal וכרטיס אשראי).</strong>
                <span>הם יופיעו אחרי שמגדירים את PayPal ואת Supabase — ההוראות במדריך.</span>
              </div>
            )}
          </div>

          <ul className="checkout__notes">
            {[
              'התשלום מתבצע בעמוד המאובטח של PayPal. פרטי האשראי לא עוברים דרך האתר.',
              'ברוב המקרים אפשר לשלם בכרטיס אשראי גם בלי חשבון PayPal.',
              'אחרי התשלום יישלח אליכם אישור במייל.',
            ].map((note) => (
              <li key={note}>
                <CheckIcon />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </form>
      </div>

      {busy && (
        <div className="checkout__busy" role="status" aria-live="assertive">
          <span className="spinner" aria-hidden="true" />
          מאשרים את התשלום…
        </div>
      )}
    </div>
  )
}

const priceOrFree = (n: number) => (n ? formatPrice(n) : 'חינם')

/* ---------------------------- שדה טופס ---------------------------- */

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'id'> & {
  id: keyof OrderForm
  label: string
  value: string
  error?: string
  optional?: boolean
  onChange: (v: string) => void
}

function Field({ id, label, error, optional, onChange, ...input }: FieldProps) {
  const inputId = `f-${id}`
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
        {optional && <span className="field__opt"> (לא חובה)</span>}
      </label>
      <input
        id={inputId}
        name={id}
        className="field__input"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={!optional}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {error && (
        <p id={`${inputId}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

/* ----------------------------- אייקונים ----------------------------- */

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function CheckIcon() {
  return (
    <svg {...svg}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg {...svg}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg {...svg}>
      <path d="M5 12h14" />
    </svg>
  )
}
