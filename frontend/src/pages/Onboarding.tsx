import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Cable,
  Check,
  Drumstick,
  Dumbbell,
  Egg,
  Fish,
  Flame,
  Flower2,
  HeartPulse,
  Home,
  Leaf,
  Minus,
  Pencil,
  PersonStanding,
  Plus,
  Scale,
  Shuffle,
  Sparkles,
  Sprout,
  Timer,
  TrendingUp,
  Trophy,
  User,
  Users,
  Utensils,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import LazyAthlete from '../components/LazyAthlete'
import type { AthleteGesture, AthleteLoop } from '../components/Athlete'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion'
import type { ProfileInput } from '../lib/types'
import { QUESTIONS, displayAnswer } from './onboarding/questions'
import type { Answers, ChoiceQuestion, NumberQuestion, Question, TextQuestion } from './onboarding/questions'
import './Onboarding.css'

const ICONS: Record<string, LucideIcon> = {
  User, Users, Flame, Dumbbell, Timer, Sparkles, Scale, Sprout, TrendingUp, Trophy,
  Zap, HeartPulse, Flower2, Shuffle, PersonStanding, Cable, Home, Building2,
  Leaf, Egg, Drumstick, Fish, Utensils,
}

const DRAFT_KEY = 'fitai.onboarding.draft'

function loadDraft(): Answers {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveDraft(answers: Answers) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers))
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function toPayload(a: Answers): ProfileInput {
  const num = (v: unknown) => Number(v)
  return {
    gender: a.gender as ProfileInput['gender'],
    age: num(a.age),
    height_cm: num(a.height_cm),
    weight_kg: num(a.weight_kg),
    target_weight_kg:
      a.goal === 'maintenance' || a.target_weight_kg == null || a.target_weight_kg === ''
        ? null
        : num(a.target_weight_kg),
    goal: a.goal as ProfileInput['goal'],
    experience_level: a.experience_level as ProfileInput['experience_level'],
    activity_level: a.activity_level as ProfileInput['activity_level'],
    workout_days: num(a.workout_days),
    workout_duration: num(a.workout_duration),
    workout_preference: a.workout_preference as ProfileInput['workout_preference'],
    equipment: a.equipment as ProfileInput['equipment'],
    sleep_hours: a.sleep_hours == null || a.sleep_hours === '' ? null : num(a.sleep_hours),
    dietary_preference: (a.dietary_preference as ProfileInput['dietary_preference']) ?? null,
    injuries: (a.injuries as string)?.trim() || null,
    medical_conditions: (a.medical_conditions as string)?.trim() || null,
  }
}

const isAnswered = (q: Question, a: Answers) => {
  const v = a[q.id]
  return q.optional || (v !== undefined && v !== null && v !== '')
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()

  const [answers, setAnswers] = useState<Answers>(loadDraft)
  const [step, setStep] = useState(0)
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [athleteLoop, setAthleteLoop] = useState<AthleteLoop>('Idle')
  const [gesture, setGesture] = useState<{ name: AthleteGesture; key: number } | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const direction = useRef(1)
  const animating = useRef(false)

  const visible = useMemo(() => QUESTIONS.filter((q) => !q.skipIf?.(answers)), [answers])
  const isReview = step >= visible.length
  const question = isReview ? null : visible[step]
  const total = visible.length
  const totalRef = useRef(total)
  totalRef.current = total

  // Editing an existing profile: prefill and jump to review
  useEffect(() => {
    if (!user?.has_profile) return
    api
      .getProfile()
      .then((profile) => {
        const prefilled: Answers = {}
        for (const q of QUESTIONS) prefilled[q.id] = profile[q.id] as Answers[keyof Answers]
        setAnswers(prefilled)
        setStep(QUESTIONS.filter((q) => !q.skipIf?.(prefilled)).length)
      })
      .catch(() => undefined)
  }, [user?.has_profile])

  useEffect(() => saveDraft(answers), [answers])

  // Athlete reacts to each question
  useEffect(() => {
    setAthleteLoop(question?.athlete?.loop ?? 'Idle')
    const g = isReview ? 'Clapping' : question?.athlete?.gesture
    if (g) setGesture({ name: g, key: Date.now() })
  }, [question, isReview])

  // Animate the new question in
  const { contextSafe } = useGSAP(
    () => {
      // Unlock navigation as soon as the new step mounts; a later out-tween
      // simply takes over these elements, so nothing can get stuck.
      animating.current = false
      const items = root.current?.querySelectorAll('.q-stage [data-anim]')
      if (!items?.length) return
      gsap.fromTo(
        items,
        { y: 46 * direction.current, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: prefersReducedMotion() ? 0.01 : 0.7,
          ease: 'power4.out',
          stagger: 0.05,
        },
      )
    },
    { scope: root, dependencies: [step] },
  )

  // Animate the current question out, then change step
  const goTo = contextSafe((next: number) => {
    if (animating.current || next === step) return
    animating.current = true
    direction.current = next > step ? 1 : -1
    const items = root.current?.querySelectorAll('.q-stage [data-anim]')
    gsap.to(items ?? [], {
      y: -36 * direction.current,
      opacity: 0,
      filter: 'blur(6px)',
      duration: prefersReducedMotion() ? 0.01 : 0.35,
      ease: 'power2.in',
      stagger: 0.025,
      onComplete: () => setStep(next),
    })
  })

  const next = useCallback(() => {
    if (question && !isAnswered(question, answers)) return
    goTo(returnToReview ? total : step + 1)
    if (returnToReview) setReturnToReview(false)
  }, [question, answers, goTo, returnToReview, total, step])

  const back = useCallback(() => {
    if (step > 0) goTo(step - 1)
  }, [step, goTo])

  const setAnswer = (id: keyof ProfileInput, value: Answers[keyof Answers]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const choose = contextSafe((q: ChoiceQuestion, value: string | number) => {
    setAnswer(q.id, value)
    if (animating.current) return
    animating.current = true
    direction.current = 1

    // Short beat so the selection is visible, then slide out and advance.
    // totalRef is read late because this answer may hide later questions.
    const items = root.current?.querySelectorAll('.q-stage [data-anim]')
    gsap.to(items ?? [], {
      y: -36,
      opacity: 0,
      filter: 'blur(6px)',
      delay: 0.26,
      duration: prefersReducedMotion() ? 0.01 : 0.35,
      ease: 'power2.in',
      stagger: 0.025,
      onComplete: () => {
        setStep((current) => (returnToReview ? totalRef.current : Math.min(current + 1, totalRef.current)))
        setReturnToReview(false)
      },
    })
  })

  // Keep the step within range after answers change which questions are visible
  useEffect(() => {
    if (step > total) setStep(total)
  }, [step, total])

  // Keyboard: Enter = next, Esc = back, 1-9 = pick option
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && e.key !== 'Enter')
      if (typing) return
      if (e.key === 'Enter' && !isReview) {
        e.preventDefault()
        next()
      } else if (e.key === 'Escape') {
        back()
      } else if (question?.type === 'choice' && /^[1-9]$/.test(e.key)) {
        const option = question.options[Number(e.key) - 1]
        if (option) choose(question, option.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const edit = (index: number) => {
    setReturnToReview(true)
    goTo(index)
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      await api.saveProfile(toPayload(answers))
      setGesture({ name: 'RunningJump', key: Date.now() })
      clearDraft()
      await refresh()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.')
      setSubmitting(false)
    }
  }

  const progress = Math.min(1, step / total)

  return (
    <div ref={root} className="onboarding page">
      <div className="container onboarding-grid">
        <aside className="ob-athlete-panel">
          <LazyAthlete className="ob-athlete" loop={athleteLoop} gesture={gesture} zoom={1.1} />
          <div className="ob-athlete-caption">
            {isReview ? 'Looking good! Check your answers.' : `Question ${step + 1} of ${total}`}
          </div>
        </aside>

        <section className="ob-main">
          <div className="ob-progress">
            <div className="ob-progress-top">
              <button className="icon-btn" onClick={back} disabled={step === 0} aria-label="Previous question">
                <ArrowLeft />
              </button>
              <span className="muted">
                {isReview ? 'Review' : `${String(step + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}
              </span>
            </div>
            <div className="ob-progress-bar">
              <div className="ob-progress-fill" style={{ transform: `scaleX(${isReview ? 1 : progress})` }} />
            </div>
          </div>

          <div className="q-stage" key={step}>
            {question?.type === 'choice' && (
              <ChoiceStep question={question} value={answers[question.id]} onChoose={(v) => choose(question, v)} />
            )}
            {question?.type === 'number' && (
              <NumberStep
                question={question}
                answers={answers}
                value={answers[question.id] as number | null | undefined}
                onChange={(v) => setAnswer(question.id, v)}
              />
            )}
            {question?.type === 'text' && (
              <TextStep
                question={question}
                value={(answers[question.id] as string) ?? ''}
                onChange={(v) => setAnswer(question.id, v)}
              />
            )}

            {question && question.type !== 'choice' && (
              <div className="q-actions" data-anim>
                <button className="btn btn-primary btn-lg" onClick={next} disabled={!isAnswered(question, answers)}>
                  {returnToReview ? 'Save' : 'Continue'} <ArrowRight className="arrow" />
                </button>
                {question.optional && (
                  <button
                    className="btn btn-ghost btn-lg"
                    onClick={() => {
                      setAnswer(question.id, null)
                      next()
                    }}
                  >
                    Skip
                  </button>
                )}
                <span className="kbd-hint muted">
                  press <kbd>Enter ↵</kbd>
                </span>
              </div>
            )}

            {isReview && (
              <div className="review">
                <div data-anim>
                  <span className="eyebrow">All set</span>
                  <h1 className="q-title">Here's what we know about you.</h1>
                  <p className="q-sub muted">Tap any answer to change it.</p>
                </div>
                <ul className="review-list">
                  {visible.map((q, i) => (
                    <li key={q.id} data-anim>
                      <button onClick={() => edit(i)}>
                        <span className="muted">{q.label}</span>
                        <strong>{displayAnswer(q, answers[q.id])}</strong>
                        <Pencil />
                      </button>
                    </li>
                  ))}
                </ul>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <div className="q-actions" data-anim>
                  <button className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner" /> Calculating your metrics…
                      </>
                    ) : (
                      <>
                        <Check /> {user?.has_profile ? 'Save changes' : 'See my results'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ---------------- Question renderers ---------------- */

function QuestionHeader({ question }: { question: Question }) {
  return (
    <div data-anim>
      {question.optional && <span className="chip">Optional</span>}
      <h1 className="q-title">{question.title}</h1>
      <p className="q-sub muted">{question.subtitle}</p>
    </div>
  )
}

function ChoiceStep({
  question,
  value,
  onChoose,
}: {
  question: ChoiceQuestion
  value: unknown
  onChoose: (value: string | number) => void
}) {
  const compact = question.options.every((o) => !o.description && !o.icon)
  return (
    <>
      <QuestionHeader question={question} />
      <div
        className={`options ${compact ? 'compact' : ''}`}
        style={{ ['--cols' as string]: question.columns ?? 2 }}
        role="radiogroup"
      >
        {question.options.map((option, i) => {
          const Icon = option.icon ? ICONS[option.icon] : null
          const selected = value === option.value
          return (
            <button
              key={String(option.value)}
              role="radio"
              aria-checked={selected}
              className={`option ${selected ? 'selected' : ''}`}
              onClick={() => onChoose(option.value)}
              data-anim
            >
              {Icon && (
                <span className="option-icon">
                  <Icon />
                </span>
              )}
              <span className="option-text">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {!compact && <kbd className="option-key">{i + 1}</kbd>}
              <span className="option-check">
                <Check />
              </span>
            </button>
          )
        })}
      </div>
      {question.id === 'workout_days' && (
        <p className="muted q-footnote" data-anim>
          days per week
        </p>
      )}
    </>
  )
}

function NumberStep({
  question,
  answers,
  value,
  onChange,
}: {
  question: NumberQuestion
  answers: Answers
  value: number | null | undefined
  onChange: (value: number) => void
}) {
  const fallback =
    typeof question.defaultValue === 'function' ? question.defaultValue(answers) : question.defaultValue
  const current = value ?? fallback

  // Commit the default so "Continue" works without touching the slider
  useEffect(() => {
    if (value === undefined || value === null) onChange(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clamp = (v: number) => Math.min(question.max, Math.max(question.min, v))
  const round = (v: number) => Math.round(v / question.step) * question.step
  const pct = ((current - question.min) / (question.max - question.min)) * 100

  return (
    <>
      <QuestionHeader question={question} />
      <div className="number-input" data-anim>
        <button className="icon-btn big" onClick={() => onChange(clamp(round(current - question.step)))} aria-label="Decrease">
          <Minus />
        </button>
        <label className="number-display">
          <input
            type="number"
            inputMode="decimal"
            value={current}
            min={question.min}
            max={question.max}
            step={question.step}
            style={{ width: `${Math.max(1, String(current).length) * 0.62 + 0.15}em` }}
            onChange={(e) => onChange(Number(e.target.value))}
            onBlur={() => onChange(clamp(round(current)))}
            aria-label={question.title}
          />
          <span>{question.unit}</span>
        </label>
        <button className="icon-btn big" onClick={() => onChange(clamp(round(current + question.step)))} aria-label="Increase">
          <Plus />
        </button>
      </div>
      <div className="range-wrap" data-anim>
        <input
          type="range"
          className="range"
          min={question.min}
          max={question.max}
          step={question.step}
          value={current}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${question.title} slider`}
        />
        <div className="range-labels muted">
          <span>
            {question.min} {question.unit}
          </span>
          {question.hint && <span className="range-hint">{question.hint(current, answers)}</span>}
          <span>
            {question.max} {question.unit}
          </span>
        </div>
      </div>
    </>
  )
}

function TextStep({
  question,
  value,
  onChange,
}: {
  question: TextQuestion
  value: string
  onChange: (value: string) => void
}) {
  const toggle = (s: string) => {
    const parts = value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const exists = parts.some((p) => p.toLowerCase() === s.toLowerCase())
    onChange((exists ? parts.filter((p) => p.toLowerCase() !== s.toLowerCase()) : [...parts, s]).join(', '))
  }
  return (
    <>
      <QuestionHeader question={question} />
      <div className="suggestions" data-anim>
        {question.suggestions.map((s) => {
          const active = value.toLowerCase().includes(s.toLowerCase())
          return (
            <button key={s} className={`chip suggestion ${active ? 'chip-lime' : ''}`} onClick={() => toggle(s)}>
              {active ? <Check /> : <Plus />} {s}
            </button>
          )
        })}
      </div>
      <textarea
        data-anim
        className="input"
        placeholder={question.placeholder}
        value={value}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  )
}
