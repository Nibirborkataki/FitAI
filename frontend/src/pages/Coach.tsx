import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import { ArrowUp, Bot, Trash2, Zap } from 'lucide-react'

import LazyAthlete from '../components/LazyAthlete'
import type { AthleteGesture } from '../components/Athlete'
import { api, ApiError } from '../lib/api'
import { gsap, useGSAP } from '../lib/motion'
import type { ChatMessage, Usage } from '../lib/types'
import './Coach.css'

const SUGGESTIONS = [
  'What should I eat before a workout?',
  'Give me a knee-friendly swap for squats',
  'How do I progress my plan next week?',
  'I missed a workout. What should I do?',
  'Explain my heart-rate zones simply',
  'How much protein should I eat per meal?',
]

export default function Coach() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [gesture, setGesture] = useState<{ name: AthleteGesture; key: number } | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const seen = useRef(new Set<number>())

  useEffect(() => {
    api.chatHistory().then((history) => {
      history.forEach((m) => seen.current.add(m.id))
      setMessages(history)
    })
    api.usage().then(setUsage)
  }, [])

  useGSAP(
    () => {
      gsap
        .timeline({ delay: 0.5 })
        .from('.coach-side > *', { x: -30, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07 })
        .from('.coach-chat', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out' }, '<0.1')
        .add(() => setGesture({ name: 'Jump', key: Date.now() }), '-=0.4')
    },
    { scope: root },
  )

  // Animate only newly-added bubbles, then keep the newest in view
  useLayoutEffect(() => {
    const fresh = root.current?.querySelectorAll<HTMLElement>('.bubble[data-new="true"]')
    fresh?.forEach((el) => {
      gsap.fromTo(el, { y: 18, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' })
      seen.current.add(Number(el.dataset.id))
      el.dataset.new = 'false'
    })
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return

    setError('')
    setInput('')
    setSending(true)
    const temp: ChatMessage = { id: -Date.now(), role: 'user', content: message, created_at: new Date().toISOString() }
    setMessages((m) => [...m, temp])

    try {
      const { reply, remaining_today } = await api.chat(message)
      setMessages((m) => [...m, reply])
      setUsage((u) => (u ? { ...u, remaining_today, used_today: u.daily_limit - remaining_today } : u))
      setGesture({ name: 'Clapping', key: Date.now() })
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== temp.id))
      setInput(message)
      setError(err instanceof ApiError ? err.message : 'The coach could not reply.')
      setGesture({ name: 'Standing', key: Date.now() })
    } finally {
      setSending(false)
      textarea.current?.focus()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  async function clear() {
    await api.clearChat()
    seen.current.clear()
    setMessages([])
  }

  const pct = usage ? (usage.remaining_today / usage.daily_limit) * 100 : 100

  return (
    <div ref={root} className="page coach">
      <div className="container coach-grid">
        <aside className="coach-side">
          <div className="card coach-profile">
            <LazyAthlete className="coach-athlete" gesture={gesture} loop={sending ? 'Run' : 'Idle'} zoom={0.85} />
            <div>
              <h1>FitAI Coach</h1>
              <p className="muted">Knows your profile, your numbers and your current plan.</p>
            </div>
          </div>

          {usage && (
            <div className="card usage">
              <div className="usage-top">
                <span>
                  <Zap /> AI messages today
                </span>
                <b>
                  {usage.remaining_today}/{usage.daily_limit}
                </b>
              </div>
              <div className="usage-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <div className="card suggestions-card">
            <h4>Try asking</h4>
            <div className="prompt-list">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="prompt" onClick={() => send(s)} disabled={sending}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="card coach-chat">
          <header className="chat-head">
            <div className="chat-status">
              <span className="status-dot" /> Online
            </div>
            {messages.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clear}>
                <Trash2 /> Clear chat
              </button>
            )}
          </header>

          <div className="chat-scroll" ref={scroller} data-lenis-prevent>
            {messages.length === 0 && !sending && (
              <div className="chat-empty">
                <Bot />
                <h3>Ask me anything about your training</h3>
                <p className="muted">Exercise swaps, form tips, recovery, nutrition, motivation… I'm here.</p>
              </div>
            )}

            {messages.map((m) => {
              const isNew = !seen.current.has(m.id)
              return (
                <div key={m.id} className={`bubble ${m.role}`} data-new={isNew} data-id={m.id}>
                  {m.role === 'assistant' ? (
                    <div className="md">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    <p>{m.content}</p>
                  )}
                </div>
              )
            })}

            {sending && (
              <div className="bubble assistant typing" aria-label="Coach is typing">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          {error && (
            <div className="form-error chat-error" role="alert">
              {error}
            </div>
          )}

          <form className="composer" onSubmit={onSubmit}>
            <textarea
              ref={textarea}
              rows={1}
              placeholder="Ask your coach…"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Message"
            />
            <button className="send" disabled={!input.trim() || sending} aria-label="Send">
              {sending ? <span className="spinner" /> : <ArrowUp />}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
