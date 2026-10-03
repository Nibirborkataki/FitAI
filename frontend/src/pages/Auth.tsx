import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'

import LazyAthlete from '../components/LazyAthlete'
import type { AthleteGesture } from '../components/Athlete'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { gsap, useGSAP } from '../lib/motion'
import './Auth.css'

type Mode = 'login' | 'register'

export default function Auth() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login'
  const { login, register } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [gesture, setGesture] = useState<{ name: AthleteGesture; key: number } | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const formBody = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP(
    () => {
      gsap
        .timeline({ delay: 0.5 })
        .from('.auth-visual', { x: -40, opacity: 0, duration: 1, ease: 'power3.out' })
        .from('.auth-card > *', { y: 26, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07 }, '<0.15')
        .add(() => setGesture({ name: 'Jump', key: Date.now() }), '-=0.4')
    },
    { scope: root },
  )

  const switchMode = contextSafe((next: Mode) => {
    if (next === mode) return
    setError('')
    gsap.fromTo(
      formBody.current!.children,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 },
    )
    setParams({ mode: next }, { replace: true })
  })

  const shake = contextSafe(() => {
    gsap.fromTo('.auth-card', { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
    setGesture({ name: 'Standing', key: Date.now() })
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (mode === 'register' && !fullName.trim()) {
      setError('Please tell us your name.')
      shake()
      return
    }

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      shake()
      return
    }

    setBusy(true)
    try {
      // <GuestOnly> redirects to /dashboard or /onboarding once the user is set
      await (mode === 'login' ? login(email, password) : register(fullName.trim(), email, password))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
      shake()
    } finally {
      setBusy(false)
    }
  }

  const strength = Math.min(
    4,
    [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean)
      .length,
  )

  return (
    <div ref={root} className="auth page">
      <div className="container auth-grid">
        <aside className="auth-visual">
          <LazyAthlete className="auth-athlete" gesture={gesture} zoom={1.05} />
          <div className="auth-quote">
            <span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Day one'}</span>
            <h2>
              {mode === 'login' ? (
                <>
                  Ready for your <span className="accent">next session?</span>
                </>
              ) : (
                <>
                  Let's build a plan that <span className="accent">fits your life.</span>
                </>
              )}
            </h2>
          </div>
        </aside>

        <div className="auth-card card">
          <div className="auth-tabs" role="tablist">
            <span className="auth-tab-indicator" data-mode={mode} />
            <button role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>
              Log in
            </button>
            <button role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>
              Sign up
            </button>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <div ref={formBody} className="auth-form-body">
              <div>
                <h1>{mode === 'login' ? 'Log in to FitAI' : 'Create your account'}</h1>
                <p className="muted">
                  {mode === 'login'
                    ? 'Pick up where you left off.'
                    : 'Free to start. Your personalised plan is just a few questions away.'}
                </p>
              </div>

              {mode === 'register' && (
                <div className="field">
                  <label htmlFor="full-name">Your name</label>
                  <div className="input-icon">
                    <User />
                    <input
                      id="full-name"
                      className="input"
                      type="text"
                      autoComplete="name"
                      placeholder="e.g. Nibir Borkakati"
                      maxLength={80}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="input-icon">
                  <Mail />
                  <input
                    id="email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-icon">
                  <Lock />
                  <input
                    id="password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {mode === 'register' && password && (
                  <div className="strength" data-level={strength}>
                    <i />
                    <i />
                    <i />
                    <i />
                    <span>{['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][strength]}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button className="btn btn-primary btn-lg auth-submit" disabled={busy || !email || !password || (mode === 'register' && !fullName.trim())}>
                {busy ? (
                  <span className="spinner" />
                ) : (
                  <>
                    {mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight className="arrow" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
