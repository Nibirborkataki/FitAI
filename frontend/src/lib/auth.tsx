import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, setUnauthorizedHandler, tokenStore } from './api'
import type { Me } from './types'

interface AuthState {
  user: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<Me>
  register: (fullName: string, email: string, password: string) => Promise<Me>
  logout: () => void
  refresh: () => Promise<Me | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  const logout = useCallback(() => {
    tokenStore.clear()
    try {
      localStorage.removeItem('fitai.onboarding.draft')
    } catch {
      /* storage unavailable */
    }
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      return null
    }
    try {
      const me = await api.me()
      setUser(me)
      return me
    } catch {
      tokenStore.clear()
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    refresh().finally(() => setLoading(false))
  }, [logout, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password)
    tokenStore.set(access_token)
    const me = await api.me()
    setUser(me)
    return me
  }, [])

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const { access_token } = await api.register(fullName, email, password)
    tokenStore.set(access_token)
    const me = await api.me()
    setUser(me)
    return me
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
