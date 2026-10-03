import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'fitai.theme'
const META_COLORS: Record<Theme, string> = { dark: '#07090d', light: '#f3f5ef' }

interface ThemeState {
  theme: Theme
  /** Pass the click position to start the circular reveal from there. */
  toggle: (origin?: { x: number; y: number }) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function readTheme(): Theme {
  // index.html applies the stored theme before React loads
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage unavailable */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)

  const toggle = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = theme === 'dark' ? 'light' : 'dark'
      const commit = () => {
        applyTheme(next)
        flushSync(() => setTheme(next))
      }

      const root = document.documentElement
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (!document.startViewTransition || reduce) {
        root.classList.add('theme-fade')
        commit()
        window.setTimeout(() => root.classList.remove('theme-fade'), 450)
        return
      }

      const x = origin?.x ?? window.innerWidth - 40
      const y = origin?.y ?? 40
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

      const transition = document.startViewTransition(commit)
      transition.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
          )
        })
        .catch(() => undefined)
    },
    [theme],
  )

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
