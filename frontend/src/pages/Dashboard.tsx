import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Droplets,
  Flame,
  HeartPulse,
  Lightbulb,
  Moon,
  MessageCircle,
  Repeat,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
} from 'lucide-react'

import CountUp from '../components/CountUp'
import LazyAthlete from '../components/LazyAthlete'
import type { AthleteGesture, AthleteLoop } from '../components/Athlete'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { gsap, ScrollTrigger, useGSAP } from '../lib/motion'
import type { HealthReport, Profile, WorkoutPlan } from '../lib/types'
import './Dashboard.css'

const GOAL_LABEL: Record<string, string> = {
  fat_loss: 'Fat loss',
  muscle_gain: 'Muscle gain',
  maintenance: 'Maintenance',
  endurance: 'Endurance',
  general_fitness: 'General fitness',
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const LOADING_LINES = [
  'Reading your metrics…',
  'Matching exercises to your equipment…',
  'Working around your injuries…',
  'Balancing volume across the week…',
  'Timing each session…',
  'Adding coaching notes…',
]

export default function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<HealthReport | null>(null)
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [planError, setPlanError] = useState('')
  const [loadingLine, setLoadingLine] = useState(0)
  const [activeDay, setActiveDay] = useState(0)
  const [athleteLoop, setAthleteLoop] = useState<AthleteLoop>('Idle')
  const [gesture, setGesture] = useState<{ name: AthleteGesture; key: number } | null>(null)

  const root = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    Promise.all([api.getProfile(), api.getMetrics(), api.getPlan()])
      .then(([p, r, pl]) => {
        setProfile(p)
        setReport(r)
        setPlan(pl)
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load your dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    if (!generating) return
    const id = window.setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2200)
    return () => window.clearInterval(id)
  }, [generating])

  // Entrance + scroll reveals once data is in
  useGSAP(
    () => {
      if (loading) return
      gsap
        .timeline({ delay: 0.5 })
        .from('.dash-hero [data-anim]', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 })
        .add(() => setGesture({ name: 'Clapping', key: Date.now() }), 0.4)

      gsap.set('.dash [data-reveal]', { opacity: 0, y: 40 })
      ScrollTrigger.batch('.dash [data-reveal]', {
        start: 'top 92%',
        onEnter: (els) =>
          gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07, overwrite: true }),
      })

      gsap.from('.bmi-marker', {
        left: '0%',
        duration: 1.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.bmi-scale', start: 'top 95%' },
      })
      gsap.from('.donut-seg', {
        strokeDasharray: '0 999',
        duration: 1.4,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: { trigger: '.donut', start: 'top 95%' },
      })
      gsap.from('.zone-bar i', {
        scaleX: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: '.zones', start: 'top 95%' },
      })
      gsap.from('.water-fill', {
        scaleY: 0,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.water-glass', start: 'top 95%' },
      })
    },
    { scope: root, dependencies: [loading] },
  )

  // Day switch animation
  useGSAP(
    () => {
      if (!plan) return
      gsap.from('.day-detail [data-day-anim]', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.04,
      })
    },
    { scope: root, dependencies: [activeDay, plan?.id] },
  )

  async function generate() {
    setGenerating(true)
    setPlanError('')
    setAthleteLoop('Run')
    try {
      const fresh = await api.generatePlan()
      setPlan(fresh)
      setActiveDay(0)
      setAthleteLoop('Idle')
      setGesture({ name: 'RunningJump', key: Date.now() })
      requestAnimationFrame(() => ScrollTrigger.refresh())
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Could not generate a plan.')
      setAthleteLoop('Idle')
      setGesture({ name: 'Standing', key: Date.now() })
    } finally {
      setGenerating(false)
    }
  }

  if (loading || !report || !profile) {
    return (
      <div ref={root} className="page dash">
        <div className="container dash-loading">
          {loadError ? (
            <>
              <div className="form-error">{loadError}</div>
              <button className="btn btn-ghost btn-sm" onClick={load}>
                <RotateCcw /> Try again
              </button>
            </>
          ) : (
            <>
              <span className="spinner" /> Loading your dashboard…
            </>
          )}
        </div>
      </div>
    )
  }

  const name = user?.first_name || 'athlete'
  const t = report.training
  const macroKcal = {
    protein: report.macros.protein_g * 4,
    carbs: report.macros.carbs_g * 4,
    fat: report.macros.fat_g * 9,
  }
  const macroTotal = macroKcal.protein + macroKcal.carbs + macroKcal.fat
  const bmiPos = Math.min(100, Math.max(0, ((report.bmi - 15) / (40 - 15)) * 100))
  const planIsStale = plan && new Date(plan.created_at + 'Z') < new Date(profile.updated_at + 'Z')
  const day = plan?.plan.days[activeDay]
  const trainingDays = new Map(t.schedule.map((d) => [d.day, d.focus]))

  return (
    <div ref={root} className="page dash">
      <div className="container">
        {/* ---------- Header ---------- */}
        <section className="dash-hero">
          <div className="dash-hero-copy">
            <span className="eyebrow" data-anim>
              Your dashboard
            </span>
            <h1 data-anim>
              Hey <span className="accent">{name}</span>, here's your blueprint.
            </h1>
            <div className="dash-chips" data-anim>
              <span className="chip chip-lime">
                <Target /> {GOAL_LABEL[profile.goal]}
              </span>
              <span className="chip">
                <CalendarDays /> {profile.workout_days}× / week
              </span>
              <span className="chip">
                <Clock /> {profile.workout_duration} min
              </span>
              <span className="chip chip-violet">
                <Repeat /> {t.split_name}
              </span>
            </div>
            <div className="dash-actions" data-anim>
              <Link to="/coach" className="btn btn-primary">
                <MessageCircle /> Ask your coach
              </Link>
              <Link to="/onboarding" className="btn btn-ghost">
                <SlidersHorizontal /> Edit profile
              </Link>
            </div>
          </div>
          <LazyAthlete className="dash-athlete" loop={athleteLoop} gesture={gesture} zoom={0.85} />
        </section>

        {report.health_flags.length > 0 && (
          <section className="flags card" data-reveal>
            <header>
              <ShieldAlert />
              <h3>Safety notes for you</h3>
            </header>
            <ul>
              {report.health_flags.map((f) => (
                <li key={f.message} className={`flag ${f.level}`}>
                  {f.message}
                </li>
              ))}
            </ul>
            <p className="muted flags-foot">Based on what you told us. Always follow your doctor's advice.</p>
          </section>
        )}

        {/* ---------- Metrics ---------- */}
        <div className="section-label" data-reveal>
          <h2>Your numbers</h2>
          <span className="chip">
            <Sparkles /> Calculated instantly, no AI needed
          </span>
        </div>

        <section className="metrics">
          <article className="card metric" data-reveal>
            <header>
              <span>Body Mass Index</span>
              <span className={`chip ${report.bmi_category === 'Normal weight' ? 'chip-lime' : 'chip-coral'}`}>
                {report.bmi_category}
              </span>
            </header>
            <div className="metric-value">
              <CountUp value={report.bmi} decimals={1} />
            </div>
            <div className="bmi-scale">
              <div className="bmi-track" />
              <span className="bmi-marker" style={{ left: `${bmiPos}%` }} />
              <div className="bmi-ticks muted">
                <span>15</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>40</span>
              </div>
            </div>
            <p className="metric-foot muted">
              Healthy range for your height: {report.healthy_weight_range.min_kg}–{report.healthy_weight_range.max_kg} kg
            </p>
          </article>

          <article className="card metric" data-reveal>
            <header>
              <span>Daily calories</span>
              <Flame className="metric-icon coral" />
            </header>
            <div className="metric-value">
              <CountUp value={report.calorie_target} />
              <small>kcal</small>
            </div>
            <div className="calorie-rows">
              <div>
                <span className="muted">Maintenance (TDEE)</span>
                <b>{Math.round(report.tdee).toLocaleString()}</b>
              </div>
              <div>
                <span className="muted">Resting (BMR)</span>
                <b>{Math.round(report.bmr).toLocaleString()}</b>
              </div>
              <div>
                <span className="muted">Adjustment</span>
                <b className={report.calorie_adjustment < 0 ? 'coral' : 'accent'}>
                  {report.calorie_adjustment > 0 ? '+' : ''}
                  {report.calorie_adjustment}
                </b>
              </div>
            </div>
          </article>

          <article className="card metric" data-reveal>
            <header>
              <span>Daily macros</span>
            </header>
            <div className="macros">
              <svg className="donut" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" className="donut-bg" />
                {(() => {
                  const c = 2 * Math.PI * 48
                  let offset = 0
                  return (['protein', 'carbs', 'fat'] as const).map((k) => {
                    const len = (macroKcal[k] / macroTotal) * c
                    const seg = (
                      <circle
                        key={k}
                        cx="60"
                        cy="60"
                        r="48"
                        className={`donut-seg ${k}`}
                        strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
                        strokeDashoffset={-offset}
                      />
                    )
                    offset += len
                    return seg
                  })
                })()}
                <text x="60" y="57" textAnchor="middle" className="donut-num">
                  {report.macros.protein_g}g
                </text>
                <text x="60" y="74" textAnchor="middle" className="donut-label">
                  protein
                </text>
              </svg>
              <ul className="macro-legend">
                <li>
                  <i className="protein" /> Protein <b>{report.macros.protein_g} g</b>
                </li>
                <li>
                  <i className="carbs" /> Carbs <b>{report.macros.carbs_g} g</b>
                </li>
                <li>
                  <i className="fat" /> Fat <b>{report.macros.fat_g} g</b>
                </li>
              </ul>
            </div>
          </article>

          <article className="card metric" data-reveal>
            <header>
              <span>Hydration</span>
              <Droplets className="metric-icon sky" />
            </header>
            <div className="water">
              <div className="water-glass">
                <div className="water-fill" />
              </div>
              <div>
                <div className="metric-value">
                  <CountUp value={report.water_liters.training_day} decimals={1} />
                  <small>L</small>
                </div>
                <p className="muted">on training days</p>
                <p className="muted">{report.water_liters.rest_day} L on rest days</p>
              </div>
            </div>
          </article>

          <article className="card metric span-2" data-reveal>
            <header>
              <span>Heart-rate zones</span>
              <span className="chip chip-coral">
                <HeartPulse /> Max {report.heart_rate.max_hr} bpm
              </span>
            </header>
            <ul className="zones">
              {report.heart_rate.zones.map((z, i) => (
                <li key={z.name}>
                  <span className="zone-name">{z.name}</span>
                  <div className="zone-bar">
                    <i style={{ width: `${50 + i * 12.5}%` }} data-zone={i + 1} />
                  </div>
                  <span className="zone-bpm">
                    {z.min_bpm}–{z.max_bpm}
                  </span>
                  <span className="zone-purpose muted">{z.purpose}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card metric" data-reveal>
            <header>
              <span>Goal timeline</span>
              <TrendingUp className="metric-icon" />
            </header>
            {report.weeks_to_target ? (
              <>
                <div className="metric-value">
                  <CountUp value={report.weeks_to_target} />
                  <small>weeks</small>
                </div>
                <p className="muted">
                  {profile.weight_kg} kg → {profile.target_weight_kg} kg at a sustainable pace (
                  {(profile.target_weight_kg ?? 0) < profile.weight_kg ? '~0.5' : '~0.25'} kg / week).
                </p>
              </>
            ) : (
              <>
                <div className="metric-value small">On target</div>
                <p className="muted">Focus on performance, consistency and body composition.</p>
              </>
            )}
          </article>

          <article className="card metric" data-reveal>
            <header>
              <span>Recovery</span>
              <Moon className="metric-icon violet" />
            </header>
            {report.recovery ? (
              <>
                <div className="metric-value">
                  <CountUp value={report.recovery.sleep_hours} decimals={1} />
                  <small>h sleep</small>
                </div>
                <div className="sleep-bar" aria-hidden="true">
                  <span className="sleep-target" />
                  <i
                    className={`sleep-marker ${report.recovery.status}`}
                    style={{ left: `${((Math.min(12, Math.max(4, report.recovery.sleep_hours)) - 4) / 8) * 100}%` }}
                  />
                </div>
                <p className="muted">{report.recovery.note}</p>
              </>
            ) : (
              <p className="muted">Add your sleep hours in your profile to see recovery insights.</p>
            )}
          </article>

          <article className="card metric span-2-cols" data-reveal>
            <header>
              <span>Protein plan</span>
              <Utensils className="metric-icon" />
            </header>
            <div className="protein-plan">
              <div>
                <div className="metric-value">
                  <CountUp value={report.nutrition.protein_per_meal_g} />
                  <small>g / meal</small>
                </div>
                <p className="muted">
                  {report.macros.protein_g} g a day across {report.nutrition.meals_per_day} meals
                </p>
              </div>
              <ul className="foods">
                {report.nutrition.protein_sources.map((food) => (
                  <li key={food} className="chip">
                    {food}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        {/* ---------- Week ---------- */}
        <section className="week card" data-reveal>
          <header className="week-head">
            <div>
              <h3>Your training week</h3>
              <p className="muted">{t.intensity_note}</p>
            </div>
            <div className="week-chips">
              <span className="chip">
                {t.sets} sets × {t.reps}
              </span>
              <span className="chip">{t.rest_seconds}s rest</span>
              <span className="chip">{t.cardio_minutes_per_week} min cardio / wk</span>
              <span className="chip chip-lime">{t.weekly_minutes} min total</span>
            </div>
          </header>
          <div className="week-days">
            {WEEK.map((d) => {
              const focus = trainingDays.get(d)
              return (
                <div key={d} className={`week-day ${focus ? 'train' : 'rest'}`}>
                  <span className="wd-name">{d.slice(0, 3)}</span>
                  <span className="wd-focus">{focus ?? 'Rest'}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------- AI plan ---------- */}
        <div className="section-label" data-reveal>
          <h2>Your AI workout plan</h2>
          <span className="chip chip-violet">
            <Sparkles /> Gemini
          </span>
        </div>

        {planIsStale && !generating && (
          <div className="stale" data-reveal>
            <AlertTriangle />
            <span>You've changed your profile since this plan was made. Generate a new one to match.</span>
            <button className="btn btn-primary btn-sm" onClick={generate}>
              Update plan
            </button>
          </div>
        )}

        {generating ? (
          <section className="card plan-loading">
            <div className="pl-orb" />
            <h3>Building your plan…</h3>
            <p key={loadingLine} className="muted pl-line">
              {LOADING_LINES[loadingLine]}
            </p>
            <div className="pl-bar">
              <i />
            </div>
          </section>
        ) : !plan ? (
          <section className="card plan-empty" data-reveal>
            <Sparkles className="plan-empty-icon" />
            <h3>Ready for your personalised plan?</h3>
            <p className="muted">
              Gemini will choose exercises for each of your {t.schedule.length} training days, based on your metrics,
              equipment and injuries. It takes about 10–20 seconds.
            </p>
            {planError && <div className="form-error">{planError}</div>}
            <button className="btn btn-primary btn-lg" onClick={generate}>
              <Sparkles /> Generate my plan
            </button>
          </section>
        ) : (
          <section className="plan" data-reveal>
            <div className="card plan-head">
              <div>
                <h3>{plan.plan.title}</h3>
                <p className="muted">{plan.plan.summary}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={generate} title="Uses one AI request">
                <RotateCcw /> Regenerate
              </button>
            </div>
            {planError && <div className="form-error">{planError}</div>}

            <div className="day-tabs" role="tablist">
              {plan.plan.days.map((d, i) => (
                <button
                  key={d.day}
                  role="tab"
                  aria-selected={i === activeDay}
                  className={`day-tab ${i === activeDay ? 'active' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  <span>{d.day.slice(0, 3)}</span>
                  <small>{d.focus}</small>
                </button>
              ))}
            </div>

            {day && (
              <div className="card day-detail" key={activeDay}>
                <header data-day-anim>
                  <div>
                    <span className="eyebrow">{day.day}</span>
                    <h3>{day.focus}</h3>
                  </div>
                  <span className="chip">
                    <Clock /> ~{day.estimated_minutes} min
                  </span>
                </header>
                <div className="phase" data-day-anim>
                  <b>Warm-up</b>
                  <p className="muted">{day.warmup}</p>
                </div>
                <ol className="exercises">
                  {day.exercises.map((ex, i) => (
                    <li key={`${ex.name}-${i}`} data-day-anim>
                      <span className="ex-num">{i + 1}</span>
                      <div className="ex-main">
                        <strong>{ex.name}</strong>
                        {ex.notes && <p className="muted">{ex.notes}</p>}
                      </div>
                      <div className="ex-stats">
                        <span>
                          <b>{ex.sets}</b> sets
                        </span>
                        <span>
                          <b>{ex.reps}</b> reps
                        </span>
                        <span>
                          <b>{ex.rest_seconds}s</b> rest
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="phase" data-day-anim>
                  <b>Cooldown</b>
                  <p className="muted">{day.cooldown}</p>
                </div>
              </div>
            )}

            <div className="plan-extras">
              <article className="card" data-reveal>
                <h4>
                  <TrendingUp /> Progression
                </h4>
                <p className="muted">{plan.plan.progression}</p>
              </article>
              <article className="card" data-reveal>
                <h4>
                  <Lightbulb /> Coach tips
                </h4>
                <ul className="tips">
                  {plan.plan.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </article>
              <article className="card safety" data-reveal>
                <h4>
                  <ShieldAlert /> Safety
                </h4>
                <p className="muted">{plan.plan.safety_notes}</p>
              </article>
            </div>
            <p className="plan-meta muted">
              Generated {new Date(plan.created_at + 'Z').toLocaleString()} · {plan.model} · General guidance, not
              medical advice.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
