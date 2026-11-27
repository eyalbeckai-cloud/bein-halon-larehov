import { useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Book from '../components/Book'
import BuyButton from '../components/BuyButton'
import { site } from '../config'
import { chapters, finale, hero, type Tone } from '../content/chapters'
import '../styles/landing.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type Side = 'start' | 'end'

/** צבע מסגרת החלון לפי צבע הרקע של המסך */
const frameColor = (tone: Tone) => (tone === 'night' ? '#0f0d24' : '#221c3b')
const isDark = (tone: Tone) => tone === 'night'

/** החלון של מסך k: במסכים זוגיים בצד שמאל, באי-זוגיים בצד ימין */
const slotSide = (k: number): Side => (k % 2 === 0 ? 'end' : 'start')

const panels: { id: string; tone: Tone; label: string }[] = [
  { id: 'hero', tone: 'night', label: 'פתיחה' },
  ...chapters.map((c) => ({ id: c.id, tone: c.tone, label: c.title })),
  { id: 'buy', tone: finale.tone, label: 'רכישה' },
]
const LAST = panels.length - 1

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null)
  const goToRef = useRef<(i: number, smooth?: boolean) => void>(() => {})
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [stacked, setStacked] = useState(false)

  useGSAP(
    () => {
      const stage = stageRef.current!
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        stage.classList.add('is-stacked')
        setStacked(true)

        const sections = gsap.utils.toArray<HTMLElement>('.panel', stage)
        const FULL = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)'

        /** חלון קשת בגודל ובמיקום של החלון במסך k — נקודת ההתחלה של המסך הבא */
        const windowClip = (k: number) => {
          const slot = sections[k].querySelector<HTMLElement>('.window-slot')!
          const s = slot.getBoundingClientRect()
          const st = stage.getBoundingClientRect()
          const top = s.top - st.top
          const left = s.left - st.left
          const right = st.width - left - s.width
          const bottom = st.height - top - s.height
          const r = s.width / 2
          return `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px ${r}px 0px 0px)`
        }

        const setTone = (i: number) => {
          document.documentElement.dataset.tone = isDark(panels[i].tone) ? 'night' : 'light'
        }
        setTone(0)

        // פתיחה: הכותרת עולה, ואז החלון נדלק
        const intro = gsap.timeline({ delay: 0.15 })
        intro
          .from(sections[0].querySelectorAll('[data-reveal]'), {
            y: 28,
            autoAlpha: 0,
            duration: 0.9,
            stagger: 0.1,
            ease: 'power3.out',
          })
          .from(sections[1], { opacity: 0, duration: 1.1, ease: 'power2.out' }, 0.45)

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            pin: true,
            start: 'top top',
            end: () => `+=${LAST * window.innerHeight}`,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            // כל תנועת גלילה מעבירה מסך אחד בדיוק, לפי הכיוון (בלי "לדלג" על מסכים בגלילה מהירה)
            snap: {
              snapTo: () => {
                const st = tl.scrollTrigger
                if (!st) return 0
                const p = st.progress * LAST
                const target = st.direction > 0 ? Math.ceil(p - 0.04) : Math.floor(p + 0.04)
                return gsap.utils.clamp(0, LAST, target) / LAST
              },
              duration: { min: 0.45, max: 1.1 },
              delay: 0.06,
              ease: 'power2.inOut',
            },
            onUpdate: (self) => {
              const i = Math.round(self.progress * LAST)
              if (i !== activeRef.current) {
                activeRef.current = i
                setActive(i)
                setTone(i)
              }
            },
          },
        })

        tl.addLabel('p0', 0)
        tl.to(sections[0].querySelector('.hero__hint'), { autoAlpha: 0, duration: 0.15 }, 0)

        for (let k = 0; k < LAST; k++) {
          const cur = sections[k]
          const next = sections[k + 1]
          const t = k

          // המסך הבא נפתח מתוך החלון ועד מסך מלא
          tl.fromTo(
            next,
            { clipPath: () => windowClip(k) },
            { clipPath: FULL, duration: 0.72, ease: 'power2.inOut' },
            t,
          )

          // המסגרת והספר שבחלון נעלמים כשהחלון נפתח
          const inset = next.querySelector('.window-inset')
          if (inset) tl.to(inset, { autoAlpha: 0, scale: 1.08, duration: 0.25, ease: 'power1.in' }, t)

          // התוכן הנוכחי מתרחק
          tl.to(
            cur.querySelector('.panel__inner'),
            { y: -50, opacity: 0, duration: 0.45, ease: 'power1.in' },
            t,
          )

          // התוכן החדש עולה
          tl.fromTo(
            next.querySelectorAll('[data-reveal]'),
            { y: 36, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' },
            t + 0.6,
          )

          // החלון של המסך שאחרי מופיע רק כשהמסך הבא כבר מלא
          const after = sections[k + 2]
          // (opacity ולא visibility — כדי שקוראי מסך ומקלדת יגיעו לכל התוכן)
          if (after)
            tl.fromTo(
              after,
              { opacity: 0, pointerEvents: 'none' },
              { opacity: 1, pointerEvents: 'auto', duration: 0.15 },
              t + 0.8,
            )

          tl.addLabel(`p${k + 1}`, t + 1)
        }

        const goTo = (i: number, smooth = true) => {
          const st = tl.scrollTrigger
          if (!st) return
          const y = st.start + (st.end - st.start) * (tl.labels[`p${i}`] / tl.duration())
          window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' })
        }
        goToRef.current = goTo

        // ניווט במקלדת: כשהפוקוס נכנס למסך מוסתר, גוללים אליו
        const onFocusIn = (e: FocusEvent) => {
          const panel = (e.target as HTMLElement).closest<HTMLElement>('.panel')
          if (!panel) return
          const i = Number(panel.dataset.index)
          if (i !== activeRef.current) goTo(i, false)
        }
        stage.addEventListener('focusin', onFocusIn)

        return () => {
          stage.removeEventListener('focusin', onFocusIn)
          stage.classList.remove('is-stacked')
          setStacked(false)
          delete document.documentElement.dataset.tone
        }
      })

      return () => mm.revert()
    },
    { scope: stageRef },
  )

  return (
    <div className="stage" ref={stageRef}>
      {panels.map((p, j) => {
        const own: Side | null = j < LAST ? slotSide(j) : null
        const prev: Side | null = j > 0 ? slotSide(j - 1) : null
        const textSide: Side = own === 'end' ? 'start' : 'end'
        const style = {
          '--mull': j > 0 ? frameColor(panels[j - 1].tone) : undefined,
          '--frame': frameColor(p.tone),
          zIndex: j + 1,
        } as CSSProperties

        return (
          <section
            key={p.id}
            id={p.id}
            className={[
              'panel',
              `panel--${p.tone}`,
              j === 0 ? 'panel--hero' : '',
              j === LAST ? 'panel--finale' : `panel--text-${textSide}`,
              prev ? `glow--${prev}` : '',
            ].join(' ')}
            data-index={j}
            aria-labelledby={`${p.id}-title`}
            style={style}
          >
            {prev && (
              <div className={`window-inset geom geom--${prev}`} aria-hidden="true">
                {j === 1 && <Book className="book--in-window" />}
              </div>
            )}

            <div className="panel__inner">{renderContent(j)}</div>

            {j === 0 && (
              <p className="hero__hint" aria-hidden="true">
                {hero.scrollHint}
              </p>
            )}

            {own && (
              <div className={`window-slot geom geom--${own}`} aria-hidden="true">
                {j === 0 && <Book className="book--in-window book--static-only" />}
              </div>
            )}
          </section>
        )
      })}

      {stacked && (
        <nav className="chapters-nav" aria-label="פרקים">
          {panels.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`chapters-nav__dot${i === active ? ' is-active' : ''}`}
              aria-label={p.label}
              aria-current={i === active ? 'step' : undefined}
              onClick={() => goToRef.current(i)}
            />
          ))}
        </nav>
      )}
    </div>
  )
}

function renderContent(j: number) {
  if (j === 0) {
    return (
      <>
        <h1 id="hero-title" className="hero__title" data-reveal>
          <span>בין חלון</span>
          <span>לרחוב</span>
        </h1>
        <p className="hero__author" data-reveal>
          ספרו של {site.book.author}
        </p>
        <p className="hero__lead" data-reveal>
          {hero.lead}
        </p>
        <div data-reveal>
          <BuyButton tone="gold" />
        </div>
      </>
    )
  }

  if (j === LAST) {
    return (
      <>
        <div data-reveal>
          <Book className="book--finale" />
        </div>
        <div className="finale__text">
          <h2 id="buy-title" className="chapter__title" data-reveal>
            {finale.title}
          </h2>
          <p className="chapter__body" data-reveal>
            {finale.body}
          </p>
          <div data-reveal>
            <BuyButton tone="gold" />
          </div>
        </div>
      </>
    )
  }

  const c = chapters[j - 1]
  return (
    <>
      <h2 id={`${c.id}-title`} className="chapter__title" data-reveal>
        {c.title}
      </h2>
      {c.body.map((para, i) => (
        <p key={i} className="chapter__body" data-reveal>
          {para}
        </p>
      ))}
      <div data-reveal>
        <BuyButton tone={isDark(c.tone) ? 'gold' : 'ink'} />
      </div>
    </>
  )
}
