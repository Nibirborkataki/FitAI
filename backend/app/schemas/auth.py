from pydantic import BaseModel, EmailStr, Field, field_validator


def _normalise_email(value: str) -> str:
    return value.strip().lower()


class RegisterRequest(BaseModel):

    full_name: str = Field(
        min_length=1,
        max_length=80
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=100
    )

    _email = field_validator("email")(_normalise_email)

    @field_validator("full_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name cannot be empty")
        return value


class LoginRequest(BaseModel):

    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=100
    )

    _email = field_validator("email")(_normalise_email)


class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "bearer"