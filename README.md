# FitAI

An AI fitness web app. Users sign up with their name, answer 16 quick questions (one at a time),
get instant health metrics calculated in Python, and receive a Gemini-generated weekly workout plan
plus an AI coach they can chat with. Dark (default) and light themes, with an animated 3D athlete
and a 3D "pulse field" background.

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, JWT auth (Argon2), Google Gemini (`google-genai`)
- **Frontend:** React 19 + TypeScript (Vite), GSAP (ScrollTrigger, SplitText), Lenis smooth scroll,
  three.js / React Three Fiber (animated 3D athlete + shader background), Sora + Inter fonts

## Run it locally

### 1. Backend

```powershell
cd backend
.venv\Scripts\activate          # or: python -m venv .venv  then  pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

`backend/.env` needs:

| Key | Purpose |
| --- | --- |
| `DATABASE_URL` | e.g. `postgresql+psycopg://postgres:<url-encoded-password>@localhost:5432/fitai_db` |
| `SECRET_KEY` | JWT signing key (long random string) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | Primary model, default `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Used when the primary is overloaded, default `gemini-flash-lite-latest` |
| `AI_DAILY_LIMIT` | Max Gemini calls per user per day (plans + chat), default `40` |
| `CORS_ORIGINS` | Comma-separated frontend origins |

API docs: http://127.0.0.1:8000/docs

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api to :8000)
```

### Tests

```powershell
cd backend
.venv\Scripts\python -m pytest tests -q
```

Tests use in-memory SQLite and a fake Gemini, so they never touch your database or AI quota.

## How AI usage is kept low

1. BMI, BMR, TDEE, calorie target, macros, hydration, heart-rate zones, goal timeline, the weekly
   training split, sleep/recovery status, diet-specific protein sources and safety notes from
   medical conditions are all computed in Python (`app/services/calculations.py`).
2. Gemini only receives a compact summary of those results and fills in exercises and coaching text,
   returning structured JSON.
3. Plans are saved in Postgres. Reopening the dashboard costs no AI calls; Gemini is only called
   when the user presses Generate or Regenerate.
4. Chat sends only the last 6 messages, uses a low thinking level and capped output tokens, and a
   per-user daily limit applies.

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Returns a JWT |
| GET | `/api/auth/me` | Includes `has_profile` |
| GET / PUT | `/api/profile` | PUT creates or updates |
| GET | `/api/metrics` | Python-only health report |
| GET | `/api/plan` | Latest saved plan or `null` |
| POST | `/api/plan/generate` | Gemini call |
| POST | `/api/coach/chat` | Gemini call |
| GET / DELETE | `/api/coach/history` | Chat history |
| GET | `/api/coach/usage` | AI calls left today |
| POST | `/api/health/calculate` | Public calculator |

## Credits

3D athlete: "Man" from the Animated Men Pack by Quaternius (CC0), via poly.pizza.
