import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Book from '../components/Book'
import BuyButton from '../components/BuyButton'
import { site, formatPrice } from '../config'
import { chapters, finale, hero, type Chapter, type Tone } from '../content/chapters'
import '../styles/landing.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// התלת-ממד נטען בנפרד, אחרי שהעמוד כבר עובד
const Book3D = lazy(() => import('../components/Book3D'))

const panels: { id: string; tone: Tone; label: string }[] = [
  { id: 'hero', tone: 'sky', label: 'פתיחה' },
  ...chapters.map((c) => ({ id: c.id, tone: c.tone, label: c.title })),
  { id: 'buy', tone: finale.tone, label: 'רכישה' },
]
const LAST = panels.length - 1
const isDark = (tone: Tone) => tone === 'night' || tone === 'red'
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef(0)
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [motion, setMotion] = useState(false)
  const [book3dReady, setBook3dReady] = useState(false)
  const [webgl] = useState(hasWebGL)
  const onBookReady = useCallback(() => setBook3dReady(true), [])

  useGSAP(
    () => {
      const stage = stageRef.current!
      const root = document.documentElement
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        stage.classList.add('is-stacked')
        setMotion(true)

        const sections = gsap.utils.toArray<HTMLElement>('.panel', stage)
        // המסך הבא עולה מלמטה כמו גיליון, עם פינות מעוגלות
        const HIDDEN = 'inset(100% 0% 0% 0% round 56px 56px 0px 0px)'
        const FULL = 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)'

        // פתיחה
        gsap
          .timeline({ delay: 0.1 })
          .from(sections[0].querySelectorAll('[data-reveal]'), {
            y: 40,
            opacity: 0,
            duration: 1,
            stagger: 0.08,
            ease: 'power3.out',
          })
          .from(sections[0].querySelector('.hero__visual'), { y: 70, opacity: 0, duration: 1.2, ease: 'power3.out' }, 0.2)

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
            // כל תנועת גלילה מעבירה מסך אחד בדיוק, לפי הכיוון
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
              root.style.setProperty('--progress', self.progress.toFixed(4))
              exitRef.current = gsap.utils.clamp(0, 1, self.progress * LAST)
              const i = Math.round(self.progress * LAST)
              if (i !== activeRef.current) {
                activeRef.current = i
                setActive(i)
              }
            },
          },
        })

        tl.addLabel('p0', 0)
        tl.to(sections[0].querySelector('.hero__hint'), { opacity: 0, duration: 0.15 }, 0)

        for (let k = 0; k < LAST; k++) {
          const cur = sections[k]
          const next = sections[k + 1]

          tl.fromTo(next, { clipPath: HIDDEN }, { clipPath: FULL, duration: 0.75, ease: 'power3.inOut' }, k)
          tl.to(cur.querySelector('.panel__shade'), { opacity: 0.5, duration: 0.75, ease: 'power2.in' }, k)
          tl.to(cur.querySelector('.panel__inner'), { scale: 0.94, y: -30, duration: 0.75, ease: 'power2.inOut' }, k)

          const img = next.querySelector('.scene img')
          if (img) tl.fromTo(img, { scale: 1.2 }, { scale: 1, duration: 1, ease: 'power2.out' }, k)

          tl.fromTo(
            next.querySelectorAll('[data-reveal]'),
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out' },
            k + 0.45,
          )
          tl.addLabel(`p${k + 1}`, k + 1)
        }

        const goTo = (i: number) => {
          const st = tl.scrollTrigger
          if (!st) return
          window.scrollTo({ top: st.start + (st.end - st.start) * (tl.labels[`p${i}`] / tl.duration()) })
        }

        // ניווט במקלדת: כשהפוקוס נכנס למסך מוסתר, עוברים אליו
        const onFocusIn = (e: FocusEvent) => {
          const panel = (e.target as HTMLElement).closest<HTMLElement>('.panel')
          if (!panel) return
          const i = Number(panel.dataset.index)
          if (i !== activeRef.current) goTo(i)
        }
        stage.addEventListener('focusin', onFocusIn)

        return () => {
          stage.removeEventListener('focusin', onFocusIn)
          stage.classList.remove('is-stacked')
          setMotion(false)
          root.style.removeProperty('--progress')
        }
      })

      return () => mm.revert()
    },
    { scope: stageRef },
  )

  const show3d = motion && webgl

  return (
    <div className="stage" ref={stageRef}>
      {/* פתיחה */}
      <section id="hero" className="panel panel--sky panel--hero" data-index={0} aria-labelledby="hero-title" style={{ zIndex: 1 }}>
        <div className="panel__inner hero">
          <div className="hero__text">
            <h1 id="hero-title" className="hero__title" data-reveal>
              <span>בין חלון</span>
              <span>לרחוב</span>
            </h1>
            <p className="hero__author" data-reveal>
              {site.book.author}
            </p>
            <p className="hero__lead" data-reveal>
              {hero.lead}
            </p>
            <div data-reveal>
              <BuyButton />
            </div>
          </div>

          <div className="hero__visual">
            <div className="book3d">
              <img
                className={`book3d__fallback${show3d && book3dReady ? ' is-hidden' : ''}`}
                src={asset(site.book.coverImage)}
                alt={`כריכת הספר ${site.book.title}`}
                width={900}
                height={1300}
                fetchPriority="high"
              />
              {show3d && (
                <Suspense fallback={null}>
                  <Book3D active={active === 0} exitRef={exitRef} onReady={onBookReady} />
                </Suspense>
              )}
              <div className="book3d__shadow" aria-hidden="true" />
            </div>
          </div>
        </div>
        <p className="hero__hint" aria-hidden="true">
          {hero.scrollHint}
        </p>
        <div className="panel__shade" aria-hidden="true" />
      </section>

      {/* פרקים */}
      {chapters.map((c, i) => (
        <ChapterPanel key={c.id} chapter={c} index={i + 1} />
      ))}

      {/* רכישה */}
      <section
        id="buy"
        className={`panel panel--${finale.tone} panel--finale`}
        data-index={LAST}
        aria-labelledby="buy-title"
        style={{ zIndex: LAST + 1 }}
      >
        <div className="panel__inner finale">
          <div className="finale__book" data-reveal>
            <Book />
          </div>
          <div className="finale__text">
            <h2 id="buy-title" className="chapter__title" data-reveal>
              {finale.title}
            </h2>
            <p className="finale__price" data-reveal>
              {formatPrice(site.book.price)}
            </p>
            <p className="chapter__body" data-reveal>
              {finale.body}
            </p>
            <div data-reveal>
              <BuyButton tone="light" />
            </div>
          </div>
        </div>
        <div className="panel__shade" aria-hidden="true" />
      </section>
    </div>
  )
}

function ChapterPanel({ chapter: c, index }: { chapter: Chapter; index: number }) {
  const layout = c.scene ? (index % 2 === 0 ? 'split split--flip' : 'split') : 'statement'
  return (
    <section
      id={c.id}
      className={`panel panel--${c.tone}`}
      data-index={index}
      aria-labelledby={`${c.id}-title`}
      style={{ zIndex: index + 1 }}
    >
      <div className={`panel__inner ${layout}`}>
        {c.scene && (
          <figure className="scene">
            <img
              src={asset(c.scene)}
              alt={c.sceneAlt ?? ''}
              width={600}
              height={900}
              loading="lazy"
              style={{ objectPosition: c.sceneFocus }}
            />
          </figure>
        )}
        <div className="copy">
          <h2 id={`${c.id}-title`} className="chapter__title" data-reveal>
            {c.title}
          </h2>
          {c.body.map((para, i) => (
            <p key={i} className="chapter__body" data-reveal>
              {para}
            </p>
          ))}
          <div data-reveal>
            <BuyButton tone={isDark(c.tone) ? 'light' : 'primary'} />
          </div>
        </div>
      </div>
      <div className="panel__shade" aria-hidden="true" />
    </section>
  )
}
