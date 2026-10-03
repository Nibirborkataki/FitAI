import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, MessageCircle, Moon, SlidersHorizontal, Sun } from 'lucide-react'

import { useAuth } from '../lib/auth'
import { gsap, useGSAP } from '../lib/motion'
import { useTheme } from '../lib/theme'
import './Navbar.css'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="FitAI home">
      <span className="logo-mark">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path
            d="M18 46V18h22M18 32h16"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="46" cy="44" r="5" fill="#8b7cff" />
        </svg>
      </span>
      <span>
        Fit<span className="accent">AI</span>
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button
      className="icon-btn theme-toggle"
      data-theme-state={theme}
      onClick={(e) => toggle({ x: e.clientX, y: e.clientY })}
      title={label}
      aria-label={label}
    >
      <Sun className="sun" />
      <Moon className="moon" />
    </button>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const nav = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useGSAP(
    () => {
      gsap.from(nav.current, { y: -30, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.9 })
    },
    { scope: nav },
  )

  const inApp = Boolean(user?.has_profile)
  const onOnboarding = pathname.startsWith('/onboarding')

  return (
    <header ref={nav} className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Logo />

        {user ? (
          <nav className="nav-links">
            {inApp && !onOnboarding && (
              <>
                <NavLink to="/dashboard" className="nav-link">
                  <LayoutDashboard /> <span>Dashboard</span>
                </NavLink>
                <NavLink to="/coach" className="nav-link">
                  <MessageCircle /> <span>AI Coach</span>
                </NavLink>
                <NavLink to="/onboarding" className="nav-link">
                  <SlidersHorizontal /> <span>Profile</span>
                </NavLink>
              </>
            )}
            <ThemeToggle />
            {user.first_name && (
              <span className="avatar" title={user.full_name || user.email}>
                {user.first_name.charAt(0).toUpperCase()}
              </span>
            )}
            <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
              <LogOut />
            </button>
          </nav>
        ) : (
          <nav className="nav-links">
            <ThemeToggle />
            <Link to="/auth?mode=login" className="nav-link plain">
              Log in
            </Link>
            <Link to="/auth?mode=register" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
