/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYPAL_CLIENT_ID?: string
  readonly VITE_PAYPAL_BUTTON_SHIPPING?: string
  readonly VITE_PAYPAL_BUTTON_PICKUP?: string
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
