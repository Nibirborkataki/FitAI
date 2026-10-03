import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

export { gsap, ScrollTrigger, SplitText, useGSAP }

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const LenisContext = createContext<Lenis | null>(null)

/** Lenis smooth scrolling driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)
  const rafRef = useRef<((time: number) => void) | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return

    const instance = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      anchors: { offset: -80 },
    })

    instance.on('scroll', ScrollTrigger.update)
    rafRef.current = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(rafRef.current)
    gsap.ticker.lagSmoothing(0)
    setLenis(instance)

    return () => {
      if (rafRef.current) gsap.ticker.remove(rafRef.current)
      instance.destroy()
      setLenis(null)
    }
  }, [])

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLenis = () => useContext(LenisContext)
