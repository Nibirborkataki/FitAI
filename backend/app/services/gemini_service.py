"""
Thin wrapper around Gemini.

Design goals (keep API load low):
  * All numbers (BMI, calories, macros, split, sets/reps) are computed in
    Python first and passed in as compact context; Gemini only writes the
    exercise selection and coaching text.
  * Structured JSON output for plans (no parsing guesswork, no retries
    for malformed output).
  * Low "thinking" level and capped output tokens.
  * Short chat history window.
  * Retry once on overload, then fall back to a lighter model.
"""

import logging
import time

from google import genai
from google.genai import errors, types

from app.core.config import settings
from app.schemas.ai import GeneratedPlan


logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 503, 504}
CHAT_HISTORY_WINDOW = 6

LABELS = {
    "fat_loss": "fat loss",
    "muscle_gain": "muscle gain",
    "maintenance": "maintenance",
    "endurance": "endurance",
    "general_fitness": "general fitness",
    "none": "no equipment (bodyweight only)",
    "bands": "resistance bands",
    "dumbbells": "dumbbells",
    "home_gym": "home gym (rack, barbell, dumbbells, bench)",
    "full_gym": "full commercial gym",
    "yoga_mobility": "yoga & mobility",
    "hiit": "HIIT",
    "very_active": "very active",
    "no_preference": "no preference",
    "non_vegetarian": "non-vegetarian",
}

PLAN_SYSTEM_PROMPT = """You are FitAI, an evidence-based strength & conditioning coach.
Write a weekly workout plan that follows the given schedule EXACTLY
(same days, same focus, same order). Rules:
- Use ONLY the listed equipment.
- Respect injuries/medical notes: avoid aggravating movements and suggest safe swaps.
- Fit each session (warm-up + exercises + cooldown) inside the session length.
- 4-7 exercises per day; use the given sets/reps/rest as the default prescription
  (cardio, HIIT or mobility days may use time-based reps like "30s" or "20 min").
- Keep every text field short and practical. No medical diagnoses."""

CHAT_SYSTEM_PROMPT = """You are FitAI Coach, a friendly, concise, evidence-based fitness coach.
Answer using the user's profile and computed metrics below; never recompute
them differently. Keep answers under ~180 words unless asked for detail and use
short markdown (bullets, bold) where helpful. Only discuss fitness, training,
recovery, nutrition and healthy habits; politely decline anything else. For pain,
injury or medical concerns, recommend seeing a qualified professional."""


class AIServiceError(Exception):
    """Raised when Gemini is unavailable or returns unusable output."""


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client

    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)

    return _client


def _label(value: str | None) -> str:
    if not value:
        return "-"
    return LABELS.get(value, value.replace("_", " "))


def build_context(profile, report: dict) -> str:
    """Compact, token-cheap summary of the user + Python-computed metrics."""

    training = report["training"]
    macros = report["macros"]
    schedule = "; ".join(
        f"{d['day']}: {d['focus']}" for d in training["schedule"]
    )

    lines = [
        f"Profile: {profile.age}y {profile.gender}, {profile.height_cm:g} cm, "
        f"{profile.weight_kg:g} kg"
        + (f" (target {profile.target_weight_kg:g} kg)" if profile.target_weight_kg else ""),
        f"Goal: {_label(profile.goal)} | Fitness level: {profile.experience_level} | "
        f"Daily activity: {_label(profile.activity_level)}",
        f"Preference: {_label(profile.workout_preference)} | "
        f"Equipment: {_label(profile.equipment)}",
        f"Training: {profile.workout_days} days/week, {profile.workout_duration} min/session",
        f"Sleep: {f'{profile.sleep_hours:g} h/night' if profile.sleep_hours else 'unknown'} | "
        f"Diet: {_label(profile.dietary_preference)}",
        f"Injuries/medical: {profile.injuries or 'none'}"
        + (f"; {profile.medical_conditions}" if profile.medical_conditions else ""),
        f"Metrics: BMI {report['bmi']} ({report['bmi_category']}), "
        f"BMR {report['bmr']:.0f}, TDEE {report['tdee']:.0f}, "
        f"target {report['calorie_target']:.0f} kcal "
        f"(P {macros['protein_g']}g / C {macros['carbs_g']}g / F {macros['fat_g']}g), "
        f"max HR {report['heart_rate']['max_hr']}",
        f"Split: {training['split_name']} -> {schedule}",
        f"Default prescription: {training['sets']} sets x {training['reps']} reps, "
        f"{training['rest_seconds']}s rest. {training['intensity_note']} "
        f"Cardio target {training['cardio_minutes_per_week']} min/week.",
    ]

    return "\n".join(lines)


def _generate(contents, config: types.GenerateContentConfig):
    """Call Gemini with one retry per model and a fallback model."""

    client = _get_client()
    models = [settings.GEMINI_MODEL]

    if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL not in models:
        models.append(settings.GEMINI_FALLBACK_MODEL)

    last_error: Exception | None = None

    for model in models:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )
                return response, model

            except errors.APIError as exc:
                last_error = exc
                logger.warning(
                    "Gemini %s attempt %s failed: %s", model, attempt + 1, exc.code
                )
                if exc.code not in RETRYABLE_STATUS_CODES:
                    break
                time.sleep(1.5 * (attempt + 1))

            except Exception as exc:  # network errors etc.
                last_error = exc
                logger.warning("Gemini %s error: %s", model, exc)
                break

    raise AIServiceError(
        "The AI coach is busy right now. Please try again in a moment."
    ) from last_error


def _base_config(**kwargs) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="low"),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            disable=True
        ),
        **kwargs
    )


def generate_workout_plan(profile, report: dict) -> tuple[GeneratedPlan, str]:

    prompt = (
        build_context(profile, report)
        + "\n\nCreate the weekly plan for the schedule above."
    )

    config = _base_config(
        system_instruction=PLAN_SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=GeneratedPlan,
        temperature=0.6,
        max_output_tokens=8000
    )

    response, model = _generate(prompt, config)

    plan = response.parsed

    if not isinstance(plan, GeneratedPlan):
        try:
            plan = GeneratedPlan.model_validate_json(response.text or "")
        except Exception as exc:
            raise AIServiceError(
                "The AI returned an incomplete plan. Please try again."
            ) from exc

    return _align_with_schedule(plan, report), model


def _align_with_schedule(plan: GeneratedPlan, report: dict) -> GeneratedPlan:
    """Keep the AI's days in the same order as the Python schedule."""

    order = [d["day"] for d in report["training"]["schedule"]]
    by_day = {d.day.strip().lower(): d for d in plan.days}
    aligned = [by_day[day.lower()] for day in order if day.lower() in by_day]

    if aligned:
        plan.days = aligned

    return plan


def coach_reply(profile, report: dict, plan_summary: str | None,
                history: list, message: str) -> tuple[str, str]:

    context = build_context(profile, report)

    if plan_summary:
        context += f"\nCurrent plan: {plan_summary}"

    contents = [
        types.Content(
            role="user" if m.role == "user" else "model",
            parts=[types.Part(text=m.content)]
        )
        for m in history[-CHAT_HISTORY_WINDOW:]
    ]
    contents.append(
        types.Content(role="user", parts=[types.Part(text=message)])
    )

    config = _base_config(
        system_instruction=f"{CHAT_SYSTEM_PROMPT}\n\n{context}",
        temperature=0.7,
        max_output_tokens=1500
    )

    response, model = _generate(contents, config)
    text = (response.text or "").strip()

    if not text:
        raise AIServiceError("The AI coach had nothing to say. Please rephrase.")

    return text, model
