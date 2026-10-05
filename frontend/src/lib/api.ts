import type {
  ChatMessage,
  HealthReport,
  Me,
  Profile,
  ProfileInput,
  Usage,
  WorkoutPlan,
} from './types'

const TOKEN_KEY = 'fitai.token'

/**
 * Backend origin. Empty in development (Vite proxies /api to :8000);
 * set VITE_API_URL to the deployed API, e.g. https://fitai-api.onrender.com
 */
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

function describeError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    // FastAPI validation errors: [{ loc, msg }]
    if (Array.isArray(detail) && detail[0]?.msg) {
      const field = detail[0].loc?.slice(-1)[0]
      return field ? `${String(field).replace(/_/g, ' ')}: ${detail[0].msg}` : detail[0].msg
    }
  }
  // The Vite dev proxy (or a waking host) answers 502/504 when the API isn't up
  if (status === 502 || status === 504) {
    return import.meta.env.DEV
      ? 'Cannot reach the server. Is the backend running on port 8000?'
      : 'The server is starting up. Please try again in a few seconds.'
  }
  if (status >= 500) return 'Server error. Please try again.'
  return 'Something went wrong. Please try again.'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const headers = new Headers(options.headers)

  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(API_BASE + path, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.')
  }

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/api/auth/login')) {
      onUnauthorized?.()
    }
    throw new ApiError(response.status, describeError(body, response.status))
  }

  return body as T
}

const json = (data: unknown) => JSON.stringify(data)

/**
 * Fire-and-forget ping so a sleeping free-tier backend starts booting
 * while the user is still reading the page.
 */
export function wakeServer() {
  fetch(API_BASE + '/api/health', { cache: 'no-store' }).catch(() => undefined)
}

export const api = {
  register: (fullName: string, email: string, password: string) =>
    request<{ access_token: string }>('/api/auth/register', {
      method: 'POST',
      body: json({ full_name: fullName, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: json({ email, password }),
    }),

  me: () => request<Me>('/api/auth/me'),

  getProfile: () => request<Profile>('/api/profile'),

  saveProfile: (data: ProfileInput) =>
    request<Profile>('/api/profile', { method: 'PUT', body: json(data) }),

  getMetrics: () => request<HealthReport>('/api/metrics'),

  /** Latest saved plan, or null if none has been generated yet. */
  getPlan: () => request<WorkoutPlan | null>('/api/plan'),

  generatePlan: () => request<WorkoutPlan>('/api/plan/generate', { method: 'POST' }),

  chatHistory: () => request<ChatMessage[]>('/api/coach/history'),

  clearChat: () => request<void>('/api/coach/history', { method: 'DELETE' }),

  usage: () => request<Usage>('/api/coach/usage'),

  chat: (message: string) =>
    request<{ reply: ChatMessage; remaining_today: number }>('/api/coach/chat', {
      method: 'POST',
      body: json({ message }),
    }),
}
