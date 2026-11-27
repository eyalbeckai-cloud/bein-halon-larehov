/**
 * הספר בתלת-ממד (three.js דרך React Three Fiber).
 * נטען רק אחרי שהעמוד מוכן, ועד אז מוצגת תמונת הכריכה.
 * זז מעט עם העכבר, ומסתובב כשגוללים אל המסך הבא.
 */
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { site } from '../config'

// פרופורציות הכריכה (1418×2048) ועובי הספר
const W = 1.385
const H = 2
const D = 0.17

type Props = {
  active: boolean
  exitRef: MutableRefObject<number>
  onReady?: () => void
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** השדרה: רוחב הקנבס = עובי הספר, הגובה = גובה הספר. הטקסט מסובב לאורך השדרה */
function spineTexture() {
  return canvasTexture(128, 1024, (ctx) => {
    ctx.fillStyle = '#f4efe4'
    ctx.fillRect(0, 0, 128, 1024)
    ctx.save()
    ctx.translate(64, 512)
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = '#0f172a'
    ctx.direction = 'rtl'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 50px "Rubik Variable", Arial, sans-serif'
    ctx.fillText(site.book.title, 130, 2)
    ctx.font = '400 36px "Rubik Variable", Arial, sans-serif'
    ctx.fillText(site.book.author, -270, 2)
    ctx.restore()
  })
}

function pagesTexture(vertical: boolean) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#f3ede1'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = 'rgba(120, 100, 70, 0.18)'
    for (let i = 0; i < 256; i += 3) {
      if (vertical) ctx.fillRect(i, 0, 1, 256)
      else ctx.fillRect(0, i, 256, 1)
    }
  })
}

function BookMesh({ exitRef, onReady }: Omit<Props, 'active'>) {
  const coverUrl = `${import.meta.env.BASE_URL}${site.book.coverImage}`
  const cover = useLoader(THREE.TextureLoader, coverUrl)
  const group = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0, touch: false })

  const materials = useMemo(() => {
    cover.colorSpace = THREE.SRGBColorSpace
    cover.anisotropy = 8
    const paper = { roughness: 0.95, metalness: 0 }
    // סדר הפאות ב-BoxGeometry: ימין, שמאל, למעלה, למטה, חזית, גב
    return [
      new THREE.MeshStandardMaterial({ map: spineTexture(), roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ map: pagesTexture(true), ...paper }),
      new THREE.MeshStandardMaterial({ map: pagesTexture(false), ...paper }),
      new THREE.MeshStandardMaterial({ map: pagesTexture(false), ...paper }),
      new THREE.MeshStandardMaterial({ map: cover, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.7 }),
    ]
  }, [cover])

  useEffect(() => {
    onReady?.()
    const onMove = (e: PointerEvent) => {
      pointer.current.touch = e.pointerType === 'touch'
      if (pointer.current.touch) return
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      materials.forEach((m) => {
        m.map?.dispose()
        m.dispose()
      })
    }
  }, [materials, onReady])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const exit = exitRef.current
    const sway = pointer.current.touch || (pointer.current.x === 0 && pointer.current.y === 0)
    const px = sway ? Math.sin(t * 0.6) * 0.35 : pointer.current.x
    const py = sway ? 0 : pointer.current.y

    const targetY = -0.42 + px * 0.3 + exit * 1.6
    const targetX = 0.05 - py * 0.15 + exit * 0.25
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 4, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 4, delta)
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -0.04 + exit * 0.1, 4, delta)
    g.position.y = Math.sin(t * 1.1) * 0.05 - exit * 0.6
  })

  return (
    <group ref={group}>
      <mesh material={materials}>
        <boxGeometry args={[W, H, D]} />
      </mesh>
    </group>
  )
}

export default function Book3D({ active, exitRef, onReady }: Props) {
  return (
    <Canvas
      className="book3d__canvas"
      flat
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.4], fov: 30 }}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.15} />
      <directionalLight position={[-3, 4, 5]} intensity={1.6} />
      <directionalLight position={[4, -2, 3]} intensity={0.35} />
      <Suspense fallback={null}>
        <BookMesh exitRef={exitRef} onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}
