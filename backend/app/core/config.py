"""Read environment configuration in one place, without remote dependencies."""

import re
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _normalize_origin(origin: str) -> str:
    origin = origin.strip()
    if not origin:
        raise ValueError("CORS origins cannot contain empty entries")
    parsed = urlsplit(origin)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query or parsed.fragment
        or "*" in origin or "\\" in origin
        or parsed.netloc.endswith(":")
        or any(char.isspace() for char in origin)
    ):
        raise ValueError("CORS requires explicit HTTP(S) origins without credentials or paths")
    # Pydantic validates host/port and supplies the default HTTP(S) port.
    validated = AnyHttpUrl(origin)
    hostname = validated.host
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"
    default_port = 80 if parsed.scheme == "http" else 443
    normalized = f"{parsed.scheme}://{hostname}"
    if validated.port != default_port:
        normalized += f":{validated.port}"
    return normalized


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True)

    app_name: str = Field(default="AWASIN API", min_length=1, max_length=100)
    app_env: Literal["development", "test", "staging", "production"] = "development"
    app_debug: bool = False
    api_v1_prefix: str = "/api/v1"
    host: str = Field(default="127.0.0.1", min_length=1)
    port: int = Field(default=8000, ge=1, le=65535)
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173", "http://127.0.0.1:5173",
    ]
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    supabase_url: str | None = None
    supabase_publishable_key: SecretStr | None = None
    supabase_jwt_algorithm: Literal["ES256", "RS256"] = "ES256"

    @field_validator("supabase_publishable_key")
    @classmethod
    def validate_publishable_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not value.get_secret_value():
            return None
        if value is not None and not value.get_secret_value().startswith("sb_publishable_"):
            raise ValueError("Only a modern Supabase publishable key is accepted")
        return value

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or not parsed.hostname
                or parsed.username or parsed.password or parsed.path not in {"", "/"}
                or parsed.query or parsed.fragment or parsed.port is not None):
            raise ValueError("Supabase must use a trusted HTTPS project origin")
        return value.rstrip("/")

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_prefix(cls, value: str) -> str:
        if not re.fullmatch(r"/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", value):
            raise ValueError("API prefix must contain nonempty path segments without a trailing slash")
        if value in {"/health", "/docs", "/redoc", "/openapi.json"}:
            raise ValueError("API prefix conflicts with an application endpoint")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        origins = value.split(",") if isinstance(value, str) else value
        return list(dict.fromkeys(_normalize_origin(origin) for origin in origins))

    @model_validator(mode="after")
    def validate_debug(self) -> "Settings":
        # Keep the safe JSON error contract even when development debug is requested.
        if self.app_debug and self.app_env not in {"development", "test"}:
            raise ValueError("APP_DEBUG is only permitted in development or test")
        return self

    @property
    def docs_enabled(self) -> bool:
        return self.app_env in {"development", "test"}
