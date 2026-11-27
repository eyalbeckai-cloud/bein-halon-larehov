import { site } from '../config'
import '../styles/book.css'

type Props = {
  className?: string
}

/**
 * הספר כאובייקט תלת-ממדי ב-CSS.
 * אם הוגדרה תמונת כריכה ב-config, היא מוצגת על החזית.
 */
export default function Book({ className = '' }: Props) {
  const { title, author, coverImage } = site.book
  const coverSrc = coverImage ? `${import.meta.env.BASE_URL}${coverImage}` : ''

  return (
    <div className={`book ${className}`} role="img" aria-label={`הספר ${title} מאת ${author}`}>
      <div className="book__body">
        <div className={`book__front${coverSrc ? ' book__front--image' : ''}`}>
          {coverSrc ? (
            <img src={coverSrc} alt="" decoding="async" />
          ) : (
            <div className="book__frame">
              <span className="book__title">{title}</span>
              <span className="book__author">{author}</span>
            </div>
          )}
        </div>
        <div className="book__spine" aria-hidden="true">
          <span>{title}</span>
        </div>
        <div className="book__pages" aria-hidden="true" />
      </div>
    </div>
  )
}
