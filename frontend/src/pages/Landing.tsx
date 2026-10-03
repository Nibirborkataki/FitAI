import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  Calculator,
  Dumbbell,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

import LazyAthlete from '../components/LazyAthlete'
import type { AthleteGesture } from '../components/Athlete'
import { useAuth } from '../lib/auth'
import { gsap, prefersReducedMotion, ScrollTrigger, SplitText, useGSAP } from '../lib/motion'
import './Landing.css'

const STEPS = [
  {
    title: 'Answer a few questions',
    text: 'One question at a time: your body, goal, fitness level, schedule, preferred style and equipment. It takes about two minutes.',
  },
  {
    title: 'Get instant numbers',
    text: 'BMI, BMR, TDEE, calorie target, macros, hydration and heart-rate zones are calculated in Python straight away, with no AI calls.',
  },
  {
    title: 'Receive your AI plan',
    text: 'Gemini builds a weekly plan on top of those numbers, using only your equipment and working around any injuries you mention.',
  },
  {
    title: 'Ask your coach anything',
    text: 'Ask about form, swaps, recovery or nutrition. The coach already knows your profile and your plan.',
  },
]

const MARQUEE = ['Strength', 'HIIT', 'Mobility', 'Endurance', 'Recovery', 'Fat loss', 'Muscle gain']

export default function Landing() {
  const { user } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<{ name: AthleteGesture; key: number } | null>(null)

  const wave = (name: AthleteGesture = 'Jump') => setGesture({ name, key: Date.now() })

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()

      // Hero headline: characters rise in
      const split = SplitText.create('.hero-title', { type: 'lines,words', mask: 'lines' })
      const intro = gsap.timeline({ delay: reduce ? 0 : 1.1 })
      intro
        .from(split.words, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.04 })
        .from('.hero [data-hero]', { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, '-=0.5')
        .from('.hero-athlete', { scale: 0.85, opacity: 0, duration: 1.1, ease: 'power3.out' }, '<-0.4')
        .from('.float-card', { y: 30, opacity: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.12 }, '-=0.6')
        .add(() => wave('Jump'), '-=0.6')

      if (reduce) return

      // Floating stat cards drift at different speeds
      gsap.utils.toArray<HTMLElement>('.float-card').forEach((card, i) => {
        gsap.to(card, {
          yPercent: -40 - i * 25,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        })
      })

      // Marquee: constant drift, sped up and flipped by scroll velocity
      const track = document.querySelector<HTMLElement>('.marquee-track')
      if (track) {
        const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 30, repeat: -1 })
        ScrollTrigger.create({
          trigger: '.marquee',
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const velocity = self.getVelocity() / 300
            gsap.to(loop, {
              timeScale: gsap.utils.clamp(-6, 6, velocity || 1),
              duration: 0.2,
              overwrite: true,
              onComplete: () => {
                gsap.to(loop, { timeScale: self.direction, duration: 1.2 })
              },
            })
          },
        })
      }

      // How it works: pinned, steps light up as you scroll
      const steps = gsap.utils.toArray<HTMLElement>('.step')
      const mm = gsap.matchMedia()
      mm.add('(min-width: 900px)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: '.how',
            start: 'top top',
            end: `+=${steps.length * 420}`,
            pin: true,
            scrub: 0.6,
          },
        })
        tl.fromTo('.how-progress-fill', { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: steps.length }, 0)
        steps.forEach((step, i) => {
          tl.fromTo(step, { opacity: 0.18, x: 40 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' }, i)
          tl.to(step.querySelector('.step-num'), { backgroundColor: '#c8f65d', color: '#0d1400', duration: 0.3 }, i)
        })
      })
      mm.add('(max-width: 899px)', () => {
        steps.forEach((step) =>
          gsap.from(step, {
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: step, start: 'top 85%' },
          }),
        )
      })

      // Generic reveal for sections below
      gsap.set('[data-reveal]', { opacity: 0 })
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 85%',
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 50, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.1, overwrite: true },
          ),
      })

      // Count-up stats
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count)
        const counter = { value: 0 }
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
          onUpdate: () => {
            el.textContent = Math.round(counter.value).toLocaleString()
          },
        })
      })

      // Big CTA text scales up into view
      gsap.from('.cta-title', {
        scale: 0.85,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'center center', scrub: true },
      })
    },
    { scope: root },
  )

  const primaryCta = user ? (user.has_profile ? '/dashboard' : '/onboarding') : '/auth?mode=register'

  return (
    <div ref={root} className="landing">
      {/* ---------------- Hero ---------------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow" data-hero>
              AI fitness coach
            </span>
            <h1 className="hero-title">
              Train smarter with a coach built around <span className="gradient-text">you.</span>
            </h1>
            <p className="hero-sub muted" data-hero>
              Tell FitAI about your body, goal and equipment. You get your numbers straight away and a weekly
              training plan written for you, plus a coach you can ask anything.
            </p>
            <div className="hero-ctas" data-hero>
              <Link to={primaryCta} className="btn btn-primary btn-lg">
                {user ? 'Open my dashboard' : 'Build my plan'} <ArrowRight className="arrow" />
              </Link>
              <a href="#how" className="btn btn-ghost btn-lg">
                How it works
              </a>
            </div>
            <div className="hero-trust" data-hero>
              <span>
                <Zap /> Instant metrics
              </span>
              <span>
                <ShieldCheck /> Works around injuries
              </span>
              <span>
                <Sparkles /> Powered by Gemini
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-glow" />
            <button className="hero-athlete-btn" onClick={() => wave('Punch')} aria-label="Make the athlete throw a punch">
              <LazyAthlete className="hero-athlete" gesture={gesture} />
            </button>

            <div className="float-card fc-1">
              <span className="fc-label">BMI</span>
              <strong>22.9</strong>
              <span className="chip chip-lime">Healthy</span>
            </div>
            <div className="float-card fc-2">
              <span className="fc-label">Daily target</span>
              <strong>2,340 kcal</strong>
              <div className="fc-macros">
                <i style={{ flex: 162 * 4 }} />
                <i style={{ flex: 276 * 4 }} />
                <i style={{ flex: 65 * 9 }} />
              </div>
            </div>
            <div className="float-card fc-3">
              <HeartPulse />
              <div>
                <span className="fc-label">Zone 2</span>
                <strong>112 - 131 bpm</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Marquee ---------------- */}
      <section className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((word, i) => (
            <span key={i} className={i % 2 ? 'outline' : ''}>
              {word}
              <em>✦</em>
            </span>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="how" id="how">
        <div className="container how-grid">
          <div className="how-head">
            <span className="eyebrow">How it works</span>
            <h2>
              From questions to a plan <span className="accent">in minutes.</span>
            </h2>
            <p className="muted">
              The maths runs locally, so it's quick and costs nothing. Gemini is only called for the parts that need
              it: the plan and the coaching.
            </p>
            <div className="how-progress">
              <div className="how-progress-fill" />
            </div>
          </div>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="step">
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p className="muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="features container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">What you get</span>
          <h2>Everything a good coach would do, in one place.</h2>
        </div>

        <div className="bento">
          <article className="card bento-card span-2" data-reveal>
            <Calculator className="bento-icon" />
            <h3>Precise, instant metrics</h3>
            <p className="muted">
              Uses the Mifflin-St Jeor BMR equation, activity-based TDEE, goal-specific calorie targets, macro splits,
              hydration and Tanaka heart-rate zones. Python calculates all of it on the server.
            </p>
            <div className="mini-metrics">
              <div>
                <small>BMR</small>
                <b>1,830</b>
              </div>
              <div>
                <small>TDEE</small>
                <b>2,836</b>
              </div>
              <div>
                <small>Protein</small>
                <b>162 g</b>
              </div>
              <div>
                <small>Max HR</small>
                <b>187</b>
              </div>
            </div>
          </article>
          <article className="card bento-card violet" data-reveal>
            <Brain className="bento-icon" />
            <h3>AI weekly plan</h3>
            <p className="muted">Exercises, sets, reps, rest and warm-ups for each training day, timed to fit your sessions.</p>
          </article>
          <article className="card bento-card" data-reveal>
            <Dumbbell className="bento-icon" />
            <h3>Your equipment only</h3>
            <p className="muted">Bodyweight, bands, dumbbells, a home gym or a full gym. The plan only uses what you have.</p>
          </article>
          <article className="card bento-card" data-reveal>
            <ShieldCheck className="bento-icon" />
            <h3>Injury-aware</h3>
            <p className="muted">Mention a sore knee or shoulder and the plan avoids movements that would aggravate it.</p>
          </article>
          <article className="card bento-card lime" data-reveal>
            <MessageCircle className="bento-icon" />
            <h3>A coach that knows your numbers</h3>
            <p className="muted">
              Ask "what can I swap for squats?" or "how much protein at dinner?". Answers are based on your profile,
              metrics and current plan.
            </p>
          </article>
        </div>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section className="stats container">
        <div className="stat" data-reveal>
          <b data-count="11">11</b>
          <span className="muted">health metrics calculated locally</span>
        </div>
        <div className="stat" data-reveal>
          <b data-count="0">0</b>
          <span className="muted">AI calls needed for your numbers</span>
        </div>
        <div className="stat" data-reveal>
          <b data-count="16">16</b>
          <span className="muted">quick questions, one at a time</span>
        </div>
        <div className="stat" data-reveal>
          <b>
            <span data-count="7">7</span>/7
          </b>
          <span className="muted">coach availability</span>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="cta container">
        <h2 className="cta-title">
          Your first plan is <span className="gradient-text">two minutes</span> away.
        </h2>
        <Link to={primaryCta} className="btn btn-primary btn-lg">
          {user ? 'Continue' : 'Start for free'} <ArrowRight className="arrow" />
        </Link>
      </section>

      <footer className="footer container">
        <span>© {new Date().getFullYear()} FitAI</span>
        <span className="muted">
          FitAI gives general fitness guidance, not medical advice. Check with a doctor before starting a new programme.
        </span>
      </footer>
    </div>
  )
}
