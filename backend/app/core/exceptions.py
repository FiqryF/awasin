"""Safe, stable error envelopes for HTTP, validation and unexpected failures."""

from http import HTTPStatus
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from app.core.logging import log_unexpected


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(status: int, code: str, message: str, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=ErrorResponse(error=ErrorDetail(code=code, message=message)).model_dump(),
        headers={"Cache-Control": "no-store", **(headers or {})},
    )


def register_exception_handlers(app: FastAPI, logger: logging.Logger) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        try:
            message = HTTPStatus(exc.status_code).phrase
        except ValueError:
            message = "Request failed"
        return error_response(exc.status_code, "http_error", message, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Do not echo rejected values: future inputs may contain private content.
        return error_response(422, "validation_error", "Request validation failed")

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        log_unexpected(logger, exc)
        return error_response(500, "internal_error", "Internal server error")
