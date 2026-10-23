"""Consistent application logs; never record request bodies or exception messages."""

import logging
import traceback


class SafeFormatter(logging.Formatter):
    def formatException(self, exc_info) -> str:
        frames = traceback.extract_tb(exc_info[2])
        locations = " -> ".join(f"{frame.name}:{frame.lineno}" for frame in frames)
        return f"exception={exc_info[0].__name__} locations={locations}"


def configure_logging(level: str) -> logging.Logger:
    for name in ("awasin", "uvicorn.error"):
        logger = logging.getLogger(name)
        logger.setLevel(level)
        logger.propagate = False
        # Own only these application/server loggers; do not replace root handlers.
        if any(getattr(handler, "awasin_handler", False) for handler in logger.handlers):
            continue
        handler = logging.StreamHandler()
        handler.awasin_handler = True
        handler.setFormatter(SafeFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logger.handlers.clear()
        logger.addHandler(handler)
    return logging.getLogger("awasin")


def log_unexpected(logger: logging.Logger, exc: Exception) -> None:
    # Trace locations aid diagnosis without serializing exception text or locals.
    frames = traceback.extract_tb(exc.__traceback__)
    locations = " -> ".join(f"{frame.name}:{frame.lineno}" for frame in frames)
    logger.error("Unhandled exception type=%s locations=%s", type(exc).__name__, locations)
