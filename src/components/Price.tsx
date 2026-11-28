import { site, formatPrice } from '../config'

/** יש מבצע כשהמחיר הרגיל גבוה מהמחיר שנגבה */
export const onSale = () => site.book.regularPrice > site.book.price

/** "במבצע כרגע: 55 ₪ בלבד" */
export const saleNote = () => `במבצע כרגע: ${formatPrice(site.book.price)} בלבד`

type Props = {
  /** המחיר שנגבה (ברירת מחדל: מחיר עותק) */
  amount?: number
  /** המחיר הרגיל, עם קו חוצה (ברירת מחדל: המחיר הרגיל של עותק) */
  regular?: number
  className?: string
}

/** מחיר, ובמבצע: המחיר הרגיל עם קו חוצה ולידו מחיר המבצע */
export default function Price({ amount = site.book.price, regular = site.book.regularPrice, className = '' }: Props) {
  if (!(regular > amount)) return <span className={className || undefined}>{formatPrice(amount)}</span>
  return (
    <span className={`price ${className}`.trim()}>
      <s className="price__was" aria-hidden="true">
        {formatPrice(regular)}
      </s>
      <span className="price__now">{formatPrice(amount)}</span>
      <span className="visually-hidden"> (מחיר מבצע, במקום {formatPrice(regular)})</span>
    </span>
  )
}
