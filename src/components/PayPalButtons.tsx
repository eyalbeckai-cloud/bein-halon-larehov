import { useEffect, useRef, useState } from 'react'
import { site } from '../config'

/* ------------------------------------------------------------------
   כפתורי PayPal (JavaScript SDK v5) — כפתור PayPal וכפתור "כרטיס אשראי".
   יצירת ההזמנה והגבייה נעשות בשרת (Supabase Edge Function),
   כך שאף אחד לא יכול לשנות את המחיר מהדפדפן.
   ------------------------------------------------------------------ */

type ButtonsActions = { resolve: () => Promise<void>; reject: () => Promise<void> }
type ApproveActions = { restart: () => Promise<void> }

type PayPalButtonsInstance = {
  isEligible: () => boolean
  render: (el: HTMLElement) => Promise<void>
  close: () => Promise<void>
}

type PayPalNamespace = {
  Buttons: (opts: Record<string, unknown>) => PayPalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

let sdkPromise: Promise<PayPalNamespace> | null = null

function loadSdk(): Promise<PayPalNamespace> {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      'client-id': site.paypal.clientId,
      currency: site.paypal.currency,
      intent: 'capture',
      components: 'buttons',
      locale: 'he_IL',
      'enable-funding': 'card',
      'disable-funding': 'paylater,venmo',
    })
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?${params}`
    script.async = true
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK missing')))
    script.onerror = () => {
      sdkPromise = null
      script.remove()
      reject(new Error('PayPal SDK failed to load'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

export type PayPalHandlers = {
  /** מופעל בלחיצה: true = אפשר להמשיך לתשלום */
  onClickValidate: () => boolean
  /** יוצר הזמנה בשרת ומחזיר את מזהה ההזמנה של PayPal */
  createOrder: () => Promise<string>
  /** גובה את התשלום בשרת. 'retry' = הכרטיס נדחה, לפתוח שוב את חלון PayPal */
  approve: (orderID: string) => Promise<'done' | 'retry'>
  onCancel: () => void
  onError: (err: unknown) => void
}

export default function PayPalButtons(props: PayPalHandlers) {
  const ref = useRef<HTMLDivElement>(null)
  const handlers = useRef(props)
  handlers.current = props
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let instance: PayPalButtonsInstance | null = null

    loadSdk()
      .then((paypal) => {
        if (cancelled || !ref.current) return
        instance = paypal.Buttons({
          style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
          onClick: (_data: unknown, actions: ButtonsActions) =>
            handlers.current.onClickValidate() ? actions.resolve() : actions.reject(),
          createOrder: () => handlers.current.createOrder(),
          onApprove: async (data: { orderID: string }, actions: ApproveActions) => {
            const result = await handlers.current.approve(data.orderID)
            if (result === 'retry') return actions.restart()
          },
          onCancel: () => handlers.current.onCancel(),
          onError: (err: unknown) => handlers.current.onError(err),
        })
        return instance.render(ref.current)
      })
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('error'))

    return () => {
      cancelled = true
      instance?.close().catch(() => {})
    }
  }, [])

  return (
    <div className="paypal-wrap">
      {status === 'loading' && <p className="paypal-status">טוען את אפשרויות התשלום…</p>}
      {status === 'error' && (
        <p className="paypal-status paypal-status--error" role="alert">
          אפשרויות התשלום לא נטענו. בדקו את החיבור לאינטרנט ורעננו את העמוד.
        </p>
      )}
      <div ref={ref} />
    </div>
  )
}
