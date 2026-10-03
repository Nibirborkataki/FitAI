from fastapi import APIRouter

from app.schemas.health import (
    HealthCalculationRequest,
    HealthCalculationResponse
)
from app.services.calculations import (
    calculate_bmi,
    calculate_bmi_category,
    calculate_bmr,
    calculate_calorie_target,
    calculate_tdee
)


router = APIRouter(
    prefix="/api/health",
    tags=["Health"]
)


@router.post(
    "/calculate",
    response_model=HealthCalculationResponse
)
def calculate_health(
    data: HealthCalculationRequest
):

    bmi = calculate_bmi(
        data.weight_kg,
        data.height_cm
    )

    bmi_category = calculate_bmi_category(
        bmi
    )

    bmr = calculate_bmr(
        data.weight_kg,
        data.height_cm,
        data.age,
        data.gender
    )

    tdee = calculate_tdee(
        bmr,
        data.activity_level
    )

    calorie_target = calculate_calorie_target(
        tdee,
        data.goal,
        data.gender,
        bmr
    )

    return {
        "bmi": bmi,
        "bmi_category": bmi_category,
        "bmr": bmr,
        "tdee": tdee,
        "calorie_target": calorie_target
    }