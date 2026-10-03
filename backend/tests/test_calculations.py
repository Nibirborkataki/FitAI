import pytest

from app.services.calculations import (
    build_health_report,
    build_training_template,
    calculate_bmi,
    calculate_bmi_category,
    calculate_bmr,
    calculate_calorie_target,
    calculate_heart_rate_zones,
    calculate_healthy_weight_range,
    calculate_macros,
    calculate_tdee,
    calculate_water_liters,
    estimate_weeks_to_target,
)


def test_bmi_and_category():
    assert calculate_bmi(70, 175) == 22.86
    assert calculate_bmi_category(17.0) == "Underweight"
    assert calculate_bmi_category(22.86) == "Normal weight"
    assert calculate_bmi_category(27.0) == "Overweight"
    assert calculate_bmi_category(31.0) == "Obesity"


def test_bmr_mifflin_st_jeor():
    assert calculate_bmr(70, 175, 25, "male") == 1673.75
    assert calculate_bmr(70, 175, 25, "female") == 1507.75
    # "other" uses the midpoint of both equations
    assert calculate_bmr(70, 175, 25, "other") == 1590.75


def test_tdee_uses_activity_factor():
    assert calculate_tdee(1500, "sedentary") == 1800
    assert calculate_tdee(1500, "moderate") == 2325
    with pytest.raises(ValueError):
        calculate_tdee(1500, "couch")


def test_calorie_target_by_goal_with_safety_floor():
    assert calculate_calorie_target(2500, "fat_loss", "male", 1700) == 2000
    assert calculate_calorie_target(2500, "muscle_gain", "male", 1700) == 2750
    assert calculate_calorie_target(2500, "maintenance", "male", 1700) == 2500
    # Deficit never drops below the floor for the gender
    assert calculate_calorie_target(1500, "fat_loss", "female", 1300) == 1300


def test_macros_add_up_to_calories():
    macros = calculate_macros(2400, 80, "muscle_gain")
    assert macros["protein_g"] == 144  # 1.8 g/kg
    kcal = macros["protein_g"] * 4 + macros["carbs_g"] * 4 + macros["fat_g"] * 9
    assert abs(kcal - 2400) < 15


def test_water_and_heart_rate():
    water = calculate_water_liters(80)
    assert water == {"rest_day": 2.8, "training_day": 3.3}

    hr = calculate_heart_rate_zones(30)
    assert hr["max_hr"] == 187
    assert len(hr["zones"]) == 5
    assert hr["zones"][0]["min_bpm"] == 94


def test_healthy_weight_range():
    assert calculate_healthy_weight_range(175) == {"min_kg": 56.7, "max_kg": 76.3}


def test_weeks_to_target():
    assert estimate_weeks_to_target(90, 80) == 20
    assert estimate_weeks_to_target(70, 75) == 20
    assert estimate_weeks_to_target(70, 70.2) == 0
    assert estimate_weeks_to_target(70, None) is None


def test_training_template_matches_available_days():
    template = build_training_template(
        workout_days=4,
        goal="muscle_gain",
        experience_level="intermediate",
        workout_preference="strength",
    )
    assert len(template["schedule"]) == 4
    assert [d["day"] for d in template["schedule"]] == [
        "Monday", "Tuesday", "Thursday", "Friday"
    ]
    assert template["split_name"] == "Upper / Lower"
    assert template["rest_days"] == ["Wednesday", "Saturday", "Sunday"]


def test_training_template_respects_preference():
    template = build_training_template(3, "fat_loss", "beginner", "hiit")
    focuses = " ".join(d["focus"] for d in template["schedule"])
    assert "HIIT" in focuses


def test_full_health_report_shape():
    report = build_health_report(
        age=28, gender="female", height_cm=165, weight_kg=72,
        target_weight_kg=64, goal="fat_loss", activity_level="light",
        experience_level="beginner", workout_days=3, workout_duration=45,
        workout_preference="mixed",
    )
    for key in (
        "bmi", "bmi_category", "bmr", "tdee", "calorie_target", "macros",
        "water_liters", "heart_rate", "healthy_weight_range",
        "weeks_to_target", "training",
    ):
        assert key in report
    assert report["weeks_to_target"] == 16


def test_sleep_assessment():
    from app.services.calculations import assess_sleep
    assert assess_sleep(None) is None
    assert assess_sleep(6)["status"] == "low"
    assert assess_sleep(8)["status"] == "good"
    assert assess_sleep(10.5)["status"] == "high"


def test_nutrition_guide_matches_diet():
    from app.services.calculations import build_nutrition_guide
    veg = build_nutrition_guide(160, "vegetarian")
    assert veg["protein_per_meal_g"] == 40
    joined = " ".join(veg["protein_sources"]).lower()
    assert "paneer" in joined and "chicken" not in joined

    vegan = " ".join(build_nutrition_guide(120, "vegan")["protein_sources"]).lower()
    assert "paneer" not in vegan and "tofu" in vegan

    assert build_nutrition_guide(120, None)["protein_sources"]


def test_health_flags_from_conditions():
    from app.services.calculations import build_health_flags
    flags = build_health_flags("High blood pressure, diabetes", None, bmi=24, age=30)
    text = " ".join(f["message"] for f in flags).lower()
    assert "blood pressure" in text and "glucose" in text
    assert all(f["level"] in ("info", "caution") for f in flags)

    assert build_health_flags(None, None, bmi=22, age=30) == []
    assert build_health_flags(None, None, bmi=36, age=65)  # BMI and age flags


def test_report_includes_recovery_nutrition_and_flags():
    report = build_health_report(
        age=28, gender="female", height_cm=165, weight_kg=72,
        target_weight_kg=64, goal="fat_loss", activity_level="light",
        experience_level="beginner", workout_days=3, workout_duration=45,
        workout_preference="mixed", sleep_hours=6,
        dietary_preference="eggetarian", medical_conditions="Asthma",
    )
    assert report["recovery"]["status"] == "low"
    assert "Eggs" in " ".join(report["nutrition"]["protein_sources"])
    assert any("asthma" in f["message"].lower() for f in report["health_flags"])
