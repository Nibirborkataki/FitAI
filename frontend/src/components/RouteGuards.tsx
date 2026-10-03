import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'

/** Requires login. With `needsProfile`, also requires finished onboarding. */
export function Protected({ children, needsProfile = false }: { children: ReactNode; needsProfile?: boolean }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="page" />
  if (!user) return <Navigate to="/auth?mode=login" replace />
  if (needsProfile && !user.has_profile) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}

/** For login/landing: signed-in users go straight to the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="page" />
  if (user) return <Navigate to={user.has_profile ? '/dashboard' : '/onboarding'} replace />

  return <>{children}</>
}
