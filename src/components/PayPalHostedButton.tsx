import { useEffect, useRef, useState } from 'react'
import { site } from '../config'

/* טעינת ה-SDK של PayPal פעם אחת בלבד לכל האתר */
type PayPalNamespace = {
  HostedButtons: (opts: { hostedButtonId: string }) => { render: (selector: string) => Promise<void> }
}

declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

let sdkPromise: Promise<PayPalNamespace> | null = null

function loadPayPalSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  if (window.paypal?.HostedButtons) return Promise.resolve(window.paypal)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      'client-id': clientId,
      components: 'hosted-buttons',
      'disable-funding': 'venmo',
      currency,
    })
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`
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

type Props = {
  hostedButtonId: string
}

export default function PayPalHostedButton({ hostedButtonId }: Props) {
  const { clientId, currency } = site.paypal
  const containerId = `paypal-container-${hostedButtonId}`
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const configured = Boolean(clientId && hostedButtonId)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setStatus('loading')

    loadPayPalSdk(clientId, currency)
      .then((paypal) => {
        if (cancelled || !ref.current || ref.current.childElementCount > 0) return
        return paypal.HostedButtons({ hostedButtonId }).render(`#${containerId}`)
      })
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('error'))

    return () => {
      cancelled = true
    }
  }, [configured, clientId, currency, hostedButtonId, containerId])

  if (!configured) {
    return (
      <div className="paypal-placeholder" role="note">
        <strong>כאן יופיע כפתור התשלום של PayPal.</strong>
        <span>
          כדי להפעיל אותו, מגדירים Client ID ומזהה כפתור (hostedButtonId) — ההוראות במדריך, בשלב
          ״חיבור PayPal״.
        </span>
      </div>
    )
  }

  return (
    <div className="paypal-wrap">
      {status === 'loading' && <p className="paypal-status">טוען את אפשרויות התשלום…</p>}
      {status === 'error' && (
        <p className="paypal-status paypal-status--error" role="alert">
          אפשרויות התשלום לא נטענו. בדקו את החיבור לאינטרנט ורעננו את העמוד.
          {site.business.email && <> אם זה חוזר, כתבו לנו ל-{site.business.email}.</>}
        </p>
      )}
      <div id={containerId} ref={ref} />
    </div>
  )
}
