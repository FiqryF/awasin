import pytest

from app.core.config import Settings


@pytest.fixture
def settings():
    # Ignore developer .env and explicitly define values used in deterministic tests.
    return Settings(
        _env_file=None,
        app_name="AWASIN API",
        app_env="test",
        app_debug=False,
        api_v1_prefix="/api/v1",
        host="127.0.0.1",
        port=8000,
        cors_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        log_level="INFO",
    )
