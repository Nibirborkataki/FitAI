from app.core.config import normalize_database_url


def test_hosted_postgres_urls_use_the_psycopg_driver():
    neon = "postgresql://user:pw@ep-x.ap-southeast-1.aws.neon.tech/fitai?sslmode=require"
    assert normalize_database_url(neon) == (
        "postgresql+psycopg://user:pw@ep-x.ap-southeast-1.aws.neon.tech/fitai?sslmode=require"
    )
    # Heroku/Render style scheme
    assert normalize_database_url("postgres://u:p@host/db") == "postgresql+psycopg://u:p@host/db"


def test_explicit_driver_urls_are_left_alone():
    url = "postgresql+psycopg://postgres:pw@localhost:5432/fitai_db"
    assert normalize_database_url(url) == url
    assert normalize_database_url("sqlite://") == "sqlite://"
