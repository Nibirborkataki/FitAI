"""
Deterministic health & training calculations.

Everything here is plain Python so the app can show useful numbers
instantly, without spending Gemini tokens. The AI layer only receives
the *results* of these functions as context.
"""

import math
import re

ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9
}

# Minimum daily calories we will ever recommend.
CALORIE_FLOORS = {
    "male": 1500,
    "female": 1200,
    "other": 1350
}

# Protein targets in grams per kg of (reference) bodyweight.
PROTEIN_PER_KG = {
    "fat_loss": 2.0,
    "muscle_gain": 1.8,
    "endurance": 1.6,
    "maintenance": 1.6,
    "general_fitness": 1.6
}

# Safe, sustainable rates of change in kg per week.
WEEKLY_LOSS_KG = 0.5
WEEKLY_GAIN_KG = 0.25

WEEK_DAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday"
]

# Training days spread across the week so rest days are interleaved.
SCHEDULE_PATTERNS = {
    1: ["Monday"],
    2: ["Monday", "Thursday"],
    3: ["Monday", "Wednesday", "Friday"],
    4: ["Monday", "Tuesday", "Thursday", "Friday"],
    5: ["Monday", "Tuesday", "Wednesday", "Friday", "Saturday"],
    6: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    7: WEEK_DAYS
}

STRENGTH_SPLITS = {
    1: ("Full Body", ["Full Body"]),
    2: ("Full Body A / B", ["Full Body A", "Full Body B"]),
    3: ("Full Body", ["Full Body A", "Full Body B", "Full Body C"]),
    4: ("Upper / Lower", ["Upper Body", "Lower Body", "Upper Body", "Lower Body"]),
    5: ("Upper / Lower + Push / Pull / Legs",
        ["Upper Body", "Lower Body", "Push", "Pull", "Legs"]),
    6: ("Push / Pull / Legs x2",
        ["Push", "Pull", "Legs", "Push", "Pull", "Legs"]),
    7: ("Push / Pull / Legs x2 + Recovery",
        ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Active Recovery & Mobility"])
}

PREFERENCE_ROTATIONS = {
    "cardio": ["Steady-State Cardio", "Full Body Strength", "Cardio Intervals"],
    "hiit": ["HIIT Conditioning", "Full Body Strength", "HIIT Circuit"],
    "yoga_mobility": ["Yoga Flow", "Mobility & Core", "Strength & Stability"],
    "mixed": ["Full Body Strength", "Cardio Conditioning", "Upper Body Strength",
              "HIIT Circuit", "Lower Body Strength", "Mobility & Core",
              "Active Recovery"]
}

# (sets, reps, rest seconds, weekly cardio minutes)
GOAL_PARAMETERS = {
    "muscle_gain": ("3-4", "6-12", 90, 60),
    "fat_loss": ("3", "10-15", 60, 150),
    "endurance": ("2-3", "15-20", 40, 200),
    "maintenance": ("3", "8-12", 75, 150),
    "general_fitness": ("3", "8-12", 75, 150)
}

LEVEL_SET_ADJUSTMENT = {
    "beginner": "2-3",
    "intermediate": None,
    "advanced": "4-5"
}

LEVEL_INTENSITY_NOTES = {
    "beginner": "Leave 3 reps in reserve; prioritise technique over load.",
    "intermediate": "Finish most sets with 1-2 reps in reserve.",
    "advanced": "Push key lifts close to failure; use periodised overload."
}


# Recommended adult sleep range (hours)
SLEEP_MIN = 7
SLEEP_MAX = 9

MEALS_PER_DAY = 4

# Everyday protein foods per diet (no AI needed)
PROTEIN_SOURCES = {
    "vegetarian": [
        "Paneer", "Greek yogurt / hung curd", "Dal & rajma", "Chana / chickpeas",
        "Milk", "Soya chunks", "Whey protein (optional)"
    ],
    "eggetarian": [
        "Eggs & egg whites", "Paneer", "Greek yogurt / hung curd", "Dal & chickpeas",
        "Soya chunks", "Milk"
    ],
    "vegan": [
        "Tofu & tempeh", "Soya chunks", "Lentils & chickpeas", "Peanuts & seeds",
        "Soy milk", "Pea protein (optional)"
    ],
    "pescatarian": [
        "Fish (rohu, salmon, tuna)", "Prawns", "Eggs", "Greek yogurt",
        "Lentils & chickpeas", "Paneer"
    ],
    "non_vegetarian": [
        "Chicken breast", "Eggs", "Fish", "Lean mutton (occasionally)",
        "Greek yogurt / hung curd", "Dal & chickpeas"
    ],
    "no_preference": [
        "Chicken or fish", "Eggs", "Paneer or tofu", "Greek yogurt",
        "Dal & chickpeas", "Whey protein (optional)"
    ]
}

WORD_START = r"(?<![a-z])"

# (keywords, level, message) - matched against medical notes and injuries
HEALTH_RULES = [
    (("heart", "cardiac", "chest pain", "arrhythm"), "caution",
     "Heart condition noted: get medical clearance before any high-intensity "
     "training and keep most cardio in Zones 1-2."),
    (("blood pressure", "hypertension", "bp"), "caution",
     "High blood pressure noted: avoid holding your breath while lifting and "
     "skip near-max efforts; keep breathing steady on every rep."),
    (("diabet", "sugar"), "caution",
     "Diabetes noted: check your glucose before and after training and keep a "
     "fast-acting carb snack nearby."),
    (("asthma",), "info",
     "Asthma noted: use a longer, gradual warm-up and keep your inhaler with you."),
    (("pregnan",), "caution",
     "Pregnancy noted: please follow your doctor's guidance on exercise intensity."),
    (("thyroid",), "info",
     "Thyroid condition noted: energy can vary, so adjust intensity day to day."),
    (("pcos", "pcod"), "info",
     "PCOS noted: strength training plus regular walks helps insulin sensitivity."),
    (("back",), "info",
     "Back issue noted: brace your core and favour supported variations "
     "(machines, chest-supported rows)."),
    (("knee",), "info",
     "Knee issue noted: favour hip-dominant moves and controlled ranges of motion."),
    (("shoulder",), "info",
     "Shoulder issue noted: use neutral grips and avoid painful overhead ranges."),
]


def calculate_bmi(
    weight_kg: float,
    height_cm: float
) -> float:

    height_m = height_cm / 100

    bmi = weight_kg / (height_m ** 2)

    return round(bmi, 2)


def calculate_bmi_category(
    bmi: float
) -> str:

    if bmi < 18.5:
        return "Underweight"

    if bmi < 25:
        return "Normal weight"

    if bmi < 30:
        return "Overweight"

    return "Obesity"


def calculate_healthy_weight_range(
    height_cm: float
) -> dict:
    """Weight range that corresponds to a BMI of 18.5 – 24.9."""

    height_m_sq = (height_cm / 100) ** 2

    return {
        "min_kg": round(18.5 * height_m_sq, 1),
        "max_kg": round(24.9 * height_m_sq, 1)
    }


def calculate_bmr(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str
) -> float:
    """Mifflin-St Jeor equation. 'other' uses the midpoint of both."""

    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    gender = gender.lower()

    if gender == "male":
        bmr = base + 5
    elif gender == "female":
        bmr = base - 161
    else:
        bmr = base - 78

    return round(bmr, 2)


def calculate_tdee(
    bmr: float,
    activity_level: str
) -> float:

    factor = ACTIVITY_FACTORS.get(
        activity_level.lower()
    )

    if factor is None:
        raise ValueError(
            f"Unknown activity level: {activity_level}"
        )

    return round(
        bmr * factor,
        2
    )


def calculate_calorie_target(
    tdee: float,
    goal: str,
    gender: str = "other",
    bmr: float = 0
) -> float:
    """
    Fat loss: ~20% deficit (max 500 kcal), never below the BMR or a
    gender-specific floor. Muscle gain: ~10% surplus (max 300 kcal).
    """

    goal = goal.lower()

    if goal == "fat_loss":
        floor = max(
            CALORIE_FLOORS.get(gender.lower(), 1350),
            bmr
        )
        deficit = min(500, tdee * 0.2)
        return round(max(tdee - deficit, floor))

    if goal == "muscle_gain":
        return round(tdee + min(300, tdee * 0.1))

    return round(tdee)


def calculate_macros(
    calories: float,
    weight_kg: float,
    goal: str,
    height_cm: float | None = None
) -> dict:
    """
    Protein from g/kg (using a BMI-25 reference weight for higher BMIs),
    25% of calories from fat, remainder from carbohydrates.
    """

    reference_weight = weight_kg

    if height_cm:
        bmi_25_weight = 25 * (height_cm / 100) ** 2
        reference_weight = min(weight_kg, bmi_25_weight)

    protein_g = round(
        PROTEIN_PER_KG.get(goal, 1.6) * reference_weight
    )
    fat_g = round(calories * 0.25 / 9)
    carbs_g = max(
        0,
        round((calories - protein_g * 4 - fat_g * 9) / 4)
    )

    return {
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g
    }


def calculate_water_liters(
    weight_kg: float
) -> dict:
    """35 ml per kg, plus ~0.5 L on training days."""

    rest_day = round(weight_kg * 0.035, 1)

    return {
        "rest_day": rest_day,
        "training_day": round(rest_day + 0.5, 1)
    }


def calculate_heart_rate_zones(
    age: int
) -> dict:
    """Tanaka max-HR formula (208 - 0.7 x age) with 5 training zones."""

    max_hr = round(208 - 0.7 * age)

    zones = [
        ("Zone 1", 0.50, 0.60, "Recovery & warm-up"),
        ("Zone 2", 0.60, 0.70, "Fat burning & aerobic base"),
        ("Zone 3", 0.70, 0.80, "Aerobic endurance"),
        ("Zone 4", 0.80, 0.90, "Threshold / tempo"),
        ("Zone 5", 0.90, 1.00, "Max effort intervals")
    ]

    return {
        "max_hr": max_hr,
        "zones": [
            {
                "name": name,
                "min_bpm": int(round(max_hr * low)),
                "max_bpm": int(round(max_hr * high)),
                "purpose": purpose
            }
            for name, low, high, purpose in zones
        ]
    }


def assess_sleep(
    sleep_hours: float | None
) -> dict | None:
    """Compare average sleep with the recommended 7-9 h adult range."""

    if sleep_hours is None:
        return None

    if sleep_hours < SLEEP_MIN:
        status = "low"
        note = (f"About {SLEEP_MIN - sleep_hours:g} h below target. Short sleep slows "
                "recovery and raises hunger; try a fixed bedtime.")
    elif sleep_hours > SLEEP_MAX:
        status = "high"
        note = "More than 9 h on average. Fine after hard weeks; if constant, check in with a doctor."
    else:
        status = "good"
        note = "Right in the recovery sweet spot. Keep it consistent."

    return {
        "sleep_hours": sleep_hours,
        "target_min": SLEEP_MIN,
        "target_max": SLEEP_MAX,
        "status": status,
        "note": note
    }


def build_nutrition_guide(
    protein_g: float,
    dietary_preference: str | None
) -> dict:
    """Protein split across meals plus diet-appropriate protein foods."""

    diet = dietary_preference or "no_preference"

    return {
        "diet": diet,
        "meals_per_day": MEALS_PER_DAY,
        "protein_per_meal_g": round(protein_g / MEALS_PER_DAY),
        "protein_sources": PROTEIN_SOURCES.get(diet, PROTEIN_SOURCES["no_preference"])
    }


def build_health_flags(
    medical_conditions: str | None,
    injuries: str | None,
    bmi: float,
    age: int
) -> list[dict]:
    """Rule-based safety notes from the user's own answers."""

    text = f" {medical_conditions or ''} {injuries or ''} ".lower()
    flags = []

    for keywords, level, message in HEALTH_RULES:
        # match at word starts so "bp" can't hit inside other words
        if any(re.search(WORD_START + re.escape(k), text) for k in keywords):
            flags.append({"level": level, "message": message})

    if bmi >= 35:
        flags.append({
            "level": "info",
            "message": "Low-impact cardio (cycling, incline walking, swimming) is "
                       "easier on your joints than running for now."
        })

    if age >= 60:
        flags.append({
            "level": "info",
            "message": "Include balance and mobility work at least twice a week."
        })

    return flags


def estimate_weeks_to_target(
    weight_kg: float,
    target_weight_kg: float | None
) -> int | None:

    if target_weight_kg is None:
        return None

    difference = target_weight_kg - weight_kg

    if abs(difference) < 0.5:
        return 0

    rate = WEEKLY_GAIN_KG if difference > 0 else WEEKLY_LOSS_KG

    return math.ceil(abs(difference) / rate)


def build_training_template(
    workout_days: int,
    goal: str,
    experience_level: str,
    workout_preference: str
) -> dict:
    """
    Rule-based weekly structure. Gemini only fills in exercises for
    this skeleton, which keeps prompts and responses small.
    """

    workout_days = max(1, min(7, workout_days))
    days = SCHEDULE_PATTERNS[workout_days]

    if workout_preference in PREFERENCE_ROTATIONS:
        rotation = PREFERENCE_ROTATIONS[workout_preference]
        focuses = [rotation[i % len(rotation)] for i in range(workout_days)]
        split_name = {
            "cardio": "Cardio-focused hybrid",
            "hiit": "HIIT + strength hybrid",
            "yoga_mobility": "Mobility & stability",
            "mixed": "Mixed training"
        }[workout_preference]
    else:
        split_name, focuses = STRENGTH_SPLITS[workout_days]
        if workout_days == 3 and experience_level != "beginner":
            split_name, focuses = "Push / Pull / Legs", ["Push", "Pull", "Legs"]

    sets, reps, rest_seconds, cardio_minutes = GOAL_PARAMETERS.get(
        goal, GOAL_PARAMETERS["general_fitness"]
    )
    sets = LEVEL_SET_ADJUSTMENT.get(experience_level) or sets

    return {
        "split_name": split_name,
        "schedule": [
            {"day": day, "focus": focus}
            for day, focus in zip(days, focuses)
        ],
        "rest_days": [d for d in WEEK_DAYS if d not in days],
        "sets": sets,
        "reps": reps,
        "rest_seconds": rest_seconds,
        "cardio_minutes_per_week": cardio_minutes,
        "intensity_note": LEVEL_INTENSITY_NOTES.get(
            experience_level, LEVEL_INTENSITY_NOTES["beginner"]
        )
    }


def build_health_report(
    *,
    age: int,
    gender: str,
    height_cm: float,
    weight_kg: float,
    goal: str,
    activity_level: str,
    experience_level: str,
    workout_days: int,
    workout_duration: int,
    workout_preference: str,
    target_weight_kg: float | None = None,
    sleep_hours: float | None = None,
    dietary_preference: str | None = None,
    medical_conditions: str | None = None,
    injuries: str | None = None
) -> dict:
    """Everything the dashboard shows, computed in one pass."""

    bmi = calculate_bmi(weight_kg, height_cm)
    bmr = calculate_bmr(weight_kg, height_cm, age, gender)
    tdee = calculate_tdee(bmr, activity_level)
    calorie_target = calculate_calorie_target(tdee, goal, gender, bmr)

    training = build_training_template(
        workout_days, goal, experience_level, workout_preference
    )
    training["session_minutes"] = workout_duration
    training["weekly_minutes"] = workout_days * workout_duration

    macros = calculate_macros(calorie_target, weight_kg, goal, height_cm)

    return {
        "bmi": bmi,
        "bmi_category": calculate_bmi_category(bmi),
        "healthy_weight_range": calculate_healthy_weight_range(height_cm),
        "bmr": bmr,
        "tdee": tdee,
        "calorie_target": calorie_target,
        "calorie_adjustment": round(calorie_target - tdee),
        "macros": macros,
        "nutrition": build_nutrition_guide(macros["protein_g"], dietary_preference),
        "recovery": assess_sleep(sleep_hours),
        "health_flags": build_health_flags(medical_conditions, injuries, bmi, age),
        "water_liters": calculate_water_liters(weight_kg),
        "heart_rate": calculate_heart_rate_zones(age),
        "weeks_to_target": estimate_weeks_to_target(weight_kg, target_weight_kg),
        "training": training
    }
