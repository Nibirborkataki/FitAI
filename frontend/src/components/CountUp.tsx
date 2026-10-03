import { useRef } from 'react'

import { gsap, useGSAP } from '../lib/motion'

/** Number that counts up from 0 when it first scrolls into view. */
export default function CountUp({
  value,
  decimals = 0,
  duration = 1.6,
  className,
}: {
  value: number
  decimals?: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const format = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  useGSAP(
    () => {
      const counter = { n: 0 }
      gsap.to(counter, {
        n: value,
        duration,
        ease: 'power3.out',
        delay: 0.2,
        scrollTrigger: { trigger: ref.current, start: 'top 95%' },
        onUpdate: () => {
          if (ref.current) ref.current.textContent = format(counter.n)
        },
      })
    },
    { dependencies: [value] },
  )

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}
