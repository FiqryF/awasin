import uvicorn

from app.core.config import Settings
from app.core.logging import configure_logging


def main() -> None:
    settings = Settings()
    configure_logging(settings.log_level)
    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=False,
        log_config=None,
    )


if __name__ == "__main__":
    main()
