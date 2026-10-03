import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'

import { gsap, prefersReducedMotion, ScrollTrigger, useLenis } from '../lib/motion'

/**
 * Keeps rendering the *previous* location while a two-layer curtain
 * covers the screen, then swaps pages and reveals the new one.
 * Works for links, redirects and browser back/forward alike.
 */
export default function PageTransition({
  children,
}: {
  children: (location: Location) => ReactNode
}) {
  const location = useLocation()
  const lenis = useLenis()
  const [displayLocation, setDisplayLocation] = useState(location)
  const curtain = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const active = useRef<gsap.core.Timeline | null>(null)

  // Initial load: lift the curtain
  useEffect(() => {
    const panels = curtain.current?.querySelectorAll('.curtain-panel')
    const logo = curtain.current?.querySelector('.curtain-logo')
    if (!panels) return

    if (prefersReducedMotion()) {
      gsap.set(panels, { yPercent: -100 })
      return
    }

    active.current = gsap
      .timeline()
      .set(panels, { yPercent: 0 })
      .fromTo(logo!, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
      .to(logo!, { opacity: 0, y: -20, duration: 0.35, ease: 'power2.in' }, '+=0.15')
      .to([...panels].reverse(), {
        yPercent: -100,
        duration: 0.8,
        ease: 'power4.inOut',
        stagger: 0.08,
      })
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (location.key === displayLocation.key) return

    const sameRoute = location.pathname === displayLocation.pathname
    const panels = curtain.current?.querySelectorAll('.curtain-panel')

    if (sameRoute || !panels || prefersReducedMotion()) {
      setDisplayLocation(location)
      window.scrollTo(0, 0)
      return
    }

    // Interrupt any running transition; panels already off-screen at the
    // top restart from the bottom, partially covering ones continue.
    active.current?.kill()
    gsap.set(curtain.current!.querySelector('.curtain-logo'), { opacity: 0 })
    panels.forEach((panel) => {
      if (Number(gsap.getProperty(panel, 'yPercent')) <= -99) gsap.set(panel, { yPercent: 100 })
    })

    const tl = gsap.timeline()
    active.current = tl
    tl.to(panels, { yPercent: 0, duration: 0.55, ease: 'power4.inOut', stagger: 0.07 })
      .add(() => {
        setDisplayLocation(location)
        lenis?.scrollTo(0, { immediate: true, force: true })
        window.scrollTo(0, 0)
      })
      .to([...panels].reverse(), {
        yPercent: -100,
        duration: 0.65,
        ease: 'power4.inOut',
        stagger: 0.07,
        delay: 0.1,
        onComplete: () => ScrollTrigger.refresh(),
      })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  return (
    <>
      <div key={displayLocation.pathname} className="route-view">
        {children(displayLocation)}
      </div>
      <div className="curtain" ref={curtain} aria-hidden="true">
        <div className="curtain-panel lime" />
        <div className="curtain-panel ink">
          <div className="curtain-logo">
            Fit<span>AI</span>
          </div>
        </div>
      </div>
    </>
  )
}
