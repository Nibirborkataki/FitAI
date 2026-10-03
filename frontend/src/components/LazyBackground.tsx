import { Suspense, lazy, useEffect, useState } from 'react'

import { useTheme } from '../lib/theme'

const Background3D = lazy(() => import('./Background3D'))

/** Loads the 3D background once the page is idle, so it never delays first paint. */
export default function LazyBackground() {
  const { theme } = useTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const start = () => setReady(true)
    // requestIdleCallback is missing in older Safari; fall back to a short timeout
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(start, 600)
    return () => clearTimeout(id)
  }, [])

  if (!ready) return null

  return (
    <Suspense fallback={null}>
      <Background3D theme={theme} />
    </Suspense>
  )
}
