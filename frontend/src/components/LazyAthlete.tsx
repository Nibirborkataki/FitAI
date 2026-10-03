import { Suspense, lazy } from 'react'

import type { AthleteProps } from './Athlete'

const Athlete = lazy(() => import('./Athlete'))

/** Code-split wrapper: three.js only downloads when a athlete is on screen. */
export default function LazyAthlete(props: AthleteProps) {
  return (
    <Suspense fallback={<div className={`${props.className ?? ''} athlete-placeholder`} />}>
      <Athlete {...props} />
    </Suspense>
  )
}
